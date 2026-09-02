import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import { ensureFinanceStorage } from "./finance-inventory";

const router = Router();
router.use(requireAdmin);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const lkDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const money = (value: unknown) =>
  Math.max(0, Number(String(value ?? 0).replace(/[^0-9.-]/g, "")) || 0);
const clean = (value: unknown, max = 160) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
let ready: Promise<void> | null = null;

async function initialize() {
  await ensureFinanceStorage();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pos_sessions (
      id SERIAL PRIMARY KEY,
      business_date DATE NOT NULL UNIQUE,
      opening_float NUMERIC(14,2) NOT NULL CHECK(opening_float >= 0),
      opened_by TEXT NOT NULL,
      opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMP,
      closing_cash NUMERIC(14,2)
    );
    CREATE TABLE IF NOT EXISTS pos_sales (
      id SERIAL PRIMARY KEY,
      receipt_number TEXT NOT NULL UNIQUE,
      session_id INTEGER NOT NULL REFERENCES pos_sessions(id) ON DELETE RESTRICT,
      invoice_id INTEGER,
      invoice_number TEXT,
      customer_name TEXT,
      items JSONB NOT NULL,
      subtotal NUMERIC(14,2) NOT NULL,
      total NUMERIC(14,2) NOT NULL CHECK(total > 0),
      amount_tendered NUMERIC(14,2) NOT NULL,
      change_due NUMERIC(14,2) NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      sold_by TEXT NOT NULL,
      sold_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pos_sales_invoice_uidx ON pos_sales(invoice_id) WHERE invoice_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS pos_sales_session_idx ON pos_sales(session_id);
    CREATE INDEX IF NOT EXISTS pos_sales_sold_at_idx ON pos_sales(sold_at);
    CREATE TABLE IF NOT EXISTS pos_items (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price NUMERIC(14,2) NOT NULL CHECK(price >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}
const ensurePos = () =>
  (ready ||= initialize().catch((error) => {
    ready = null;
    throw error;
  }));

router.get("/catalog", async (_req, res) => {
  try {
    await ensurePos();
    const { rows } = await pool.query(
      `SELECT id,name,invoice_name,price,image_url,slug,custom_config FROM products WHERE active=true ORDER BY sort_order,name`,
    );
    const productItems = rows.map((row) => {
      let configuredCode = "";
      try {
        configuredCode = clean(
          JSON.parse(row.custom_config || "{}").itemCode,
          40,
        );
      } catch {}
      return {
        id: `product-${row.id}`,
        code: configuredCode || `P${String(row.id).padStart(4, "0")}`,
        name: row.invoice_name || row.name,
        price: money(row.price),
        imageUrl: row.image_url || "",
        slug: row.slug || "",
      };
    });
    const custom = await pool.query(
      "SELECT id,code,name,price FROM pos_items WHERE active=true ORDER BY name",
    );
    res.json([
      ...custom.rows.map((row) => ({
        id: `pos-${row.id}`,
        code: row.code,
        name: row.name,
        price: money(row.price),
        imageUrl: "",
        posOnly: true,
      })),
      ...productItems,
    ]);
  } catch (error) {
    _req.log.error(error);
    res.status(500).json({ error: "POS catalogue could not load" });
  }
});

router.post("/items", async (req, res) => {
  try {
    await ensurePos();
    const code = clean(req.body?.code, 40).toUpperCase();
    const name = clean(req.body?.name, 200);
    const price = money(req.body?.price);
    if (!code || !name)
      return res.status(400).json({ error: "Item code and name are required" });
    const { rows } = await pool.query(
      `INSERT INTO pos_items(code,name,price) VALUES($1,$2,$3)
      ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,active=true RETURNING *`,
      [code, name, price],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "POS item could not be saved" });
  }
});

router.get("/invoices", async (req, res) => {
  try {
    await ensurePos();
    const q = `%${clean(req.query.q, 80)}%`;
    const { rows } = await pool.query(
      `SELECT id,invoice_number,client_name,amount,status,metadata FROM invoices
      WHERE deleted_at IS NULL AND status NOT IN ('cancelled','paid') AND (invoice_number ILIKE $1 OR client_name ILIKE $1)
      ORDER BY created_at DESC LIMIT 20`,
      [q],
    );
    res.json(
      rows.map((row) => {
        let advance = 0;
        try {
          advance = money(JSON.parse(row.metadata || "{}").advance);
        } catch {}
        const amount = money(row.amount);
        return {
          id: row.id,
          invoiceNumber: row.invoice_number,
          clientName: row.client_name,
          amount,
          balance: Math.max(0, amount - advance),
          status: row.status,
        };
      }),
    );
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Invoices could not load" });
  }
});

router.get("/day", async (req, res) => {
  try {
    await ensurePos();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))
      ? String(req.query.date)
      : lkDate();
    const session = await pool.query(
      "SELECT * FROM pos_sessions WHERE business_date=$1",
      [date],
    );
    const sales = await pool.query(
      `SELECT id,receipt_number,invoice_number,customer_name,items,subtotal,total,amount_tendered,change_due,payment_method,sold_by,sold_at
      FROM pos_sales WHERE session_id=$1 ORDER BY sold_at DESC`,
      [session.rows[0]?.id || -1],
    );
    const total = sales.rows.reduce((sum, sale) => sum + Number(sale.total), 0);
    const cashSales = sales.rows
      .filter((sale) => sale.payment_method === "cash")
      .reduce((sum, sale) => sum + Number(sale.total), 0);
    res.json({
      date,
      session: session.rows[0] || null,
      sales: sales.rows,
      summary: {
        count: sales.rows.length,
        sales: total,
        cashSales,
        expectedCash: Number(session.rows[0]?.opening_float || 0) + cashSales,
      },
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "POS day could not load" });
  }
});

router.get("/month", async (req, res) => {
  try {
    await ensurePos();
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || ""))
      ? String(req.query.month)
      : lkDate().slice(0, 7);
    const { rows } = await pool.query(`SELECT ps.receipt_number,ps.invoice_number,ps.customer_name,ps.total,ps.amount_tendered,ps.change_due,ps.payment_method,ps.sold_by,ps.sold_at,to_char(s.business_date,'YYYY-MM-DD') AS business_date
      FROM pos_sales ps JOIN pos_sessions s ON s.id=ps.session_id
      WHERE s.business_date >= to_date($1 || '-01','YYYY-MM-DD')
        AND s.business_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'
      ORDER BY ps.sold_at`, [month]);
    const paymentTotals = { cash: 0, card: 0, transfer: 0 };
    const daily = new Map<string, { date: string; bills: number; total: number }>();
    for (const row of rows) {
      const total = Number(row.total || 0);
      const method = row.payment_method as keyof typeof paymentTotals;
      if (method in paymentTotals) paymentTotals[method] += total;
      const date = String(row.business_date).slice(0, 10);
      const current = daily.get(date) || { date, bills: 0, total: 0 };
      current.bills += 1; current.total += total; daily.set(date, current);
    }
    res.json({ month, sales: rows, daily: [...daily.values()], summary: { count: rows.length, total: rows.reduce((sum, row) => sum + Number(row.total || 0), 0), ...paymentTotals } });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Monthly POS report could not load" });
  }
});

router.post("/start-day", async (req, res) => {
  try {
    await ensurePos();
    const opening = money(req.body?.openingFloat);
    const auth = getAdminAuth(req)!;
    const { rows } = await pool.query(
      `INSERT INTO pos_sessions(business_date,opening_float,opened_by) VALUES($1,$2,$3)
      ON CONFLICT(business_date) DO UPDATE SET opening_float=CASE WHEN pos_sessions.closed_at IS NULL THEN EXCLUDED.opening_float ELSE pos_sessions.opening_float END
      RETURNING *`,
      [lkDate(), opening, auth.username],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not start POS day" });
  }
});

router.post("/sales", async (req, res) => {
  await ensurePos();
  const auth = getAdminAuth(req)!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query(
      "SELECT * FROM pos_sessions WHERE business_date=$1 AND closed_at IS NULL FOR UPDATE",
      [lkDate()],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "Start today's POS session before making a sale" });
    }

    const invoiceId = Number(req.body?.invoiceId) || null;
    let items = Array.isArray(req.body?.items)
      ? req.body.items
          .slice(0, 100)
          .map((item: any) => ({
            code: clean(item.code, 40),
            name: clean(item.name, 200),
            qty: Math.max(1, Math.trunc(Number(item.qty) || 1)),
            price: money(item.price),
          }))
          .filter((item: any) => item.name && item.price >= 0)
      : [];
    let customerName = clean(req.body?.customerName, 160) || "Walk-in customer";
    let invoiceNumber: string | null = null;
    let total = items.reduce(
      (sum: number, item: any) => sum + item.qty * item.price,
      0,
    );
    const receiptNumber = `POS-${lkDate().replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    if (invoiceId) {
      const invoiceResult = await client.query(
        "SELECT * FROM invoices WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
        [invoiceId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === "cancelled")
        throw new Error("Cancelled invoice cannot be settled");
      const duplicate = await client.query(
        "SELECT id FROM pos_sales WHERE invoice_id=$1",
        [invoiceId],
      );
      if (duplicate.rows[0])
        throw new Error("This invoice is already recorded in Counter Sales");
      invoiceNumber = invoice.invoice_number;
      customerName = invoice.client_name || customerName;
      total = money(invoice.amount);
      try {
        const meta = JSON.parse(invoice.metadata || "{}");
        const advance = money(meta.advance);
        total = Math.max(0, total - advance);
        items = [
          {
            code: "",
            name: `Invoice balance · ${invoiceNumber}`,
            qty: 1,
            price: total,
          },
        ];
        meta.posPriorAdvance = advance;
        meta.posSettlementReceipt = receiptNumber;
        meta.advance = String(money(invoice.amount));
        meta.paymentReceivedDate = lkDate();
        await client.query(
          "UPDATE invoices SET status='paid',metadata=$1 WHERE id=$2",
          [JSON.stringify(meta), invoiceId],
        );
      } catch {
        await client.query("UPDATE invoices SET status='paid' WHERE id=$1", [
          invoiceId,
        ]);
      }
    }

    if (total <= 0) throw new Error("Sale total must be greater than zero");
    const tendered = money(req.body?.amountTendered);
    if (tendered < total)
      throw new Error("Customer payment is less than the amount due");
    const change = tendered - total;
    const paymentMethod = ["cash", "card", "transfer"].includes(
      req.body?.paymentMethod,
    )
      ? req.body.paymentMethod
      : "cash";
    const inserted = await client.query(
      `INSERT INTO pos_sales(receipt_number,session_id,invoice_id,invoice_number,customer_name,items,subtotal,total,amount_tendered,change_due,payment_method,sold_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        receiptNumber,
        session.id,
        invoiceId,
        invoiceNumber,
        customerName,
        JSON.stringify(items),
        total,
        total,
        tendered,
        change,
        paymentMethod,
        auth.username,
      ],
    );
    await client.query(
      `INSERT INTO finance_transactions(type,category,description,amount,transaction_date,invoice_id,source,source_ref)
      VALUES('income','shop_sales',$1,$2,$3,$4,'pos_sale',$5)`,
      [
        `Counter sale · ${receiptNumber}${invoiceNumber ? ` · ${invoiceNumber}` : ""}`,
        total,
        lkDate(),
        invoiceNumber,
        receiptNumber,
      ],
    );
    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    res
      .status(400)
      .json({ error: error.message || "POS sale could not be completed" });
  } finally {
    client.release();
  }
});

router.post("/close-day", async (req, res) => {
  try {
    await ensurePos();
    const amount = money(req.body?.closingCash);
    const { rows } = await pool.query(
      "UPDATE pos_sessions SET closing_cash=$1,closed_at=NOW() WHERE business_date=$2 AND closed_at IS NULL RETURNING *",
      [amount, lkDate()],
    );
    if (!rows[0])
      return res.status(409).json({ error: "No open POS session found" });
    res.json(rows[0]);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not close POS day" });
  }
});

export default router;
