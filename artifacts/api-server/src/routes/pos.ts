import { discountPosBill, validatePosOptions } from "../lib/pos-options";
import { posConfig, quotePosProduct } from "@workspace/api-zod";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { getAdminAuth, hasPermission, requireAdmin, requireOwner } from "../lib/auth-cookie";
import { ensureFinanceStorage } from "./finance-inventory";
import { clientPhoneKeys, findClientIdByPhone } from "../lib/client-dedupe";
import { allocatePosPayment } from "../lib/pos-settlement";

const router = Router();
router.use(requireAdmin);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use((req, res, next) => {
  const auth = getAdminAuth(req);
  if (!hasPermission(auth, "pos_access")) {
    res.status(403).json({ error: "POS / Counter Sales access permission required" });
    return;
  }
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

async function issuerFirstName(auth: ReturnType<typeof getAdminAuth>): Promise<string> {
  if (!auth) return "HAVESTORY";
  let name = auth.username;
  try {
    if (auth.role === "staff" && auth.staffId) {
      const result = await pool.query("SELECT name FROM admin_staff WHERE id=$1", [auth.staffId]);
      name = clean(result.rows[0]?.name, 160) || auth.username;
    } else {
      const result = await pool.query("SELECT owner_name FROM settings ORDER BY id LIMIT 1");
      name = clean(result.rows[0]?.owner_name, 160) || auth.username;
    }
  } catch {}
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return /^(mr|mrs|ms|miss|dr)\.?$/i.test(parts[0] || "")
    ? parts[1] || parts[0] || auth.username
    : parts[0] || auth.username;
}
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
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closed_by TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS reopened_by TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS deposit_tomorrow BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(14,2);
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS next_day_float NUMERIC(14,2);
    CREATE TABLE IF NOT EXISTS pos_bank_deposits (
      id BIGSERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL UNIQUE REFERENCES pos_sessions(id) ON DELETE RESTRICT,
      internal_reference TEXT NOT NULL UNIQUE,
      business_date DATE NOT NULL,
      bank_remark TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
      status TEXT NOT NULL CHECK(status IN ('pending','deposited')),
      bank_transaction TEXT,
      proof_url TEXT,
      confirmed_at TIMESTAMP,
      confirmed_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pos_reopen_requests (
      id BIGSERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES pos_sessions(id) ON DELETE CASCADE,
      requested_by INTEGER,
      requested_by_username TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      decided_by TEXT,
      decided_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pos_reopen_pending_uidx
      ON pos_reopen_requests(session_id) WHERE status='pending';
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
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2);
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS request_id TEXT UNIQUE;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS voided_by TEXT;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS void_reason TEXT;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;
    ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS edited_by TEXT;
    UPDATE pos_sales SET paid_amount=total WHERE paid_amount IS NULL;
    ALTER TABLE pos_sales ALTER COLUMN paid_amount SET DEFAULT 0;
    ALTER TABLE pos_sales ALTER COLUMN paid_amount SET NOT NULL;
    CREATE INDEX IF NOT EXISTS pos_sales_outstanding_idx ON pos_sales(client_id,sold_at,id) WHERE paid_amount < total AND voided_at IS NULL;
    CREATE TABLE IF NOT EXISTS pos_sale_audit (
      id BIGSERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES pos_sales(id) ON DELETE RESTRICT,
      action TEXT NOT NULL CHECK(action IN ('edit','void')),
      before_value JSONB NOT NULL,
      after_value JSONB NOT NULL,
      actor TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pos_sale_audit_sale_idx ON pos_sale_audit(sale_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS pos_settlements (
      id BIGSERIAL PRIMARY KEY,
      receipt_number TEXT NOT NULL UNIQUE,
      request_id TEXT UNIQUE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      session_id INTEGER REFERENCES pos_sessions(id) ON DELETE RESTRICT,
      amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card','transfer')),
      allocations JSONB NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE pos_settlements ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES pos_sessions(id) ON DELETE RESTRICT;
    ALTER TABLE pos_settlements ADD COLUMN IF NOT EXISTS request_id TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS pos_sales_client_sold_idx ON pos_sales(client_id,sold_at DESC) WHERE client_id IS NOT NULL;
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
    ALTER TABLE pos_items ADD COLUMN IF NOT EXISTS custom_config JSONB NOT NULL DEFAULT '{}'::jsonb;
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
        customConfig: row.custom_config || "{}",
      };
    });
    const custom = await pool.query(
      "SELECT id,code,name,price,custom_config FROM pos_items WHERE active=true ORDER BY name",
    );
    res.json([
      ...custom.rows.map((row) => ({
        id: `pos-${row.id}`,
        code: row.code,
        name: row.name,
        price: money(row.price),
        imageUrl: "",
        posOnly: true,
        customConfig: JSON.stringify(row.custom_config || {}),
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
    const auth = getAdminAuth(req)!;
    if (!hasPermission(auth, "pos_access"))
      return res.status(403).json({ error: "POS access permission required" });
    const code = clean(req.body?.code, 40).toUpperCase();
    const name = clean(req.body?.name, 200);
    const price = Number(req.body?.price);
    if (req.body?.price === "" || req.body?.price == null || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Enter a valid unit price" });
    let config;
    try { config = validatePosOptions(req.body?.customConfig); } catch (error: any) { return res.status(400).json({ error: error.message }); }
    if (!code || !name)
      return res.status(400).json({ error: "Item code and name are required" });
    const { rows } = await pool.query(
      `INSERT INTO pos_items(code,name,price,custom_config) VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(code) DO NOTHING RETURNING *`,
      [code, name, price, JSON.stringify(config)],
    );
    if (!rows[0]) return res.status(409).json({ error: "Item code already exists. Edit the existing POS item or choose a different code." });
    res.status(201).json(rows[0]);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "POS item could not be saved" });
  }
});

router.put("/items/:id", async (req, res) => {
  try {
    await ensurePos();
    const id = Number(req.params.id);
    const code = clean(req.body?.code, 40).toUpperCase();
    const name = clean(req.body?.name, 200);
    const price = Number(req.body?.price);
    if (!Number.isSafeInteger(id) || id <= 0 || !code || !name || req.body?.price === "" || req.body?.price == null || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Enter a valid item code, name and price" });
    let config;
    try { config = req.body?.customConfig === undefined ? null : JSON.stringify(validatePosOptions(req.body.customConfig)); } catch (error: any) { return res.status(400).json({ error: error.message }); }
    const { rows } = await pool.query("UPDATE pos_items SET code=$2,name=$3,price=$4,custom_config=COALESCE($5::jsonb,custom_config) WHERE id=$1 AND active=true RETURNING *", [id, code, name, price, config]);
    if (!rows[0]) return res.status(404).json({ error: "POS item not found" });
    res.json(rows[0]);
  } catch (error: any) {
    if (error.code === "23505") return res.status(409).json({ error: "Item code already exists" });
    req.log.error(error);
    res.status(500).json({ error: "POS item could not be updated" });
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
      `SELECT id,receipt_number,invoice_number,customer_name,customer_phone,client_id,items,subtotal,total,paid_amount,amount_tendered,change_due,payment_method,sold_by,sold_at,voided_at,voided_by,void_reason,edited_at,edited_by
      FROM pos_sales WHERE session_id=$1 ORDER BY sold_at DESC`,
      [session.rows[0]?.id || -1],
    );
    const activeSales = sales.rows.filter(sale => !sale.voided_at);
    const total = activeSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const cashSales = activeSales
      .filter((sale) => sale.payment_method === "cash")
      .reduce((sum, sale) => sum + Number(sale.total), 0);
    const settlementCash = await pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM pos_settlements WHERE session_id=$1 AND payment_method='cash'", [session.rows[0]?.id || -1]);
    const auth = getAdminAuth(req)!;
    const reopenRequest = session.rows[0]?.closed_at
      ? await pool.query(
          `SELECT id,reason,status,requested_by_username,created_at
           FROM pos_reopen_requests
           WHERE session_id=$1 AND ($2='owner' OR requested_by=$3)
           ORDER BY created_at DESC LIMIT 1`,
          [session.rows[0].id, auth.role, auth.staffId || null],
        )
      : { rows: [] };
    res.json({
      date,
      session: session.rows[0] || null,
      reopenRequest: reopenRequest.rows[0] || null,
      sales: sales.rows,
      summary: {
        count: activeSales.length,
        sales: total,
        cashSales: cashSales + Number(settlementCash.rows[0]?.total || 0),
        expectedCash: Number(session.rows[0]?.opening_float || 0) + cashSales + Number(settlementCash.rows[0]?.total || 0),
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
      WHERE ps.voided_at IS NULL AND s.business_date >= to_date($1 || '-01','YYYY-MM-DD')
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
    const settlements = await pool.query(`SELECT p.payment_method,COALESCE(SUM(p.amount),0) AS amount
      FROM pos_settlements p JOIN pos_sessions s ON s.id=p.session_id
      WHERE s.business_date >= to_date($1 || '-01','YYYY-MM-DD')
      AND s.business_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'
      GROUP BY p.payment_method`, [month]);
    for (const row of settlements.rows) {
      const method = row.payment_method as keyof typeof paymentTotals;
      if (method in paymentTotals) paymentTotals[method] += Number(row.amount);
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
    const auth = getAdminAuth(req)!;
    if (!hasPermission(auth, "pos_day_start"))
      return res.status(403).json({ error: "POS day-start permission required" });
    const opening = Number(req.body?.openingFloat);
    if (req.body?.openingFloat === '' || !Number.isFinite(opening) || opening < 0 || opening > 999999999999.99)
      return res.status(400).json({ error: "Enter a valid opening float" });
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
  if (!hasPermission(auth, "pos_access"))
    return res.status(403).json({ error: "POS access permission required" });
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
    const requestId = clean(req.body?.requestId, 80);
    if (requestId && !/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Invalid sale request identifier");
    if (requestId) {
      const existing = await client.query("SELECT * FROM pos_sales WHERE request_id=$1", [requestId]);
      if (existing.rows[0]) { await client.query("COMMIT"); return res.json(existing.rows[0]); }
    }

    const invoiceId = Number(req.body?.invoiceId) || null;
    let items: any[] = [];
    if (!invoiceId) {
      const submitted = req.body?.items;
      if (!Array.isArray(submitted) || !submitted.length || submitted.length > 100) throw new Error("Select 1–100 items");
      for (const item of submitted) {
        const match = /^(product|pos)-(\d+)$/.exec(String(item.id));
        if (!match) throw new Error("Unknown catalogue item; reload POS");
        const product = match[1] === 'product';
        const result = await client.query(product
          ? "SELECT name,invoice_name,price,custom_config FROM products WHERE id=$1 AND active=true"
          : "SELECT name,code,price,custom_config FROM pos_items WHERE id=$1 AND active=true", [Number(match[2])]);
        const row = result.rows[0];
        if (!row) throw new Error("Item is no longer available; reload POS");
        const quote = quotePosProduct(Number(row.price), row.custom_config, Number(item.qty), item.sizeId || '', item.choices || {});
        if (Math.abs(quote.price - Number(item.price)) > .001 || !Number.isFinite(Number(item.price))) throw new Error("Product price changed; reload POS before collecting payment");
        const config = posConfig(row.custom_config);
        items.push({ id: item.id, code: product ? clean(config.itemCode, 40) || `P${String(match[2]).padStart(4, '0')}` : row.code,
          name: [row.invoice_name || row.name, quote.description].filter(Boolean).join(' · '),
          qty: Number(item.qty), price: quote.price, unitLabel: quote.unitLabel });
      }
    }
    let customerName = clean(req.body?.customerName, 160) || "Counter Sale";
    const customerPhone = clean(req.body?.customerPhone, 40);
    if (customerPhone && (clientPhoneKeys(customerPhone).length !== 1 || customerPhone.replace(/\D/g, "").length > 15))
      throw new Error("Enter one valid customer phone number or leave it blank");
    let linkedClientId = customerPhone ? await findClientIdByPhone(customerPhone, client) : null;
    const onAccount = req.body?.onAccount === true;
    if (onAccount && invoiceId) throw new Error("Invoice settlement cannot be issued on account");
    if (onAccount && !linkedClientId) throw new Error("Select an existing client phone number before issuing an unpaid bill");
    if (linkedClientId && customerName === "Counter Sale") {
      const linked = await client.query("SELECT name FROM clients WHERE id=$1 AND deleted_at IS NULL", [linkedClientId]);
      customerName = linked.rows[0]?.name || customerName;
    }
    let invoiceNumber: string | null = null;
    let total = items.reduce(
      (sum: number, item: any) => sum + Math.round(item.qty * item.price * 100),
      0,
    );
    total /= 100;
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
      linkedClientId = invoice.client_id || linkedClientId;
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

    const discounted = discountPosBill(total, req.body?.discountType, req.body?.discountValue, !!invoiceId);
    const subtotal = discounted.subtotal;
    total = discounted.total;
    if (total <= 0) throw new Error("Sale total after discount must be greater than zero");
    const tendered = money(req.body?.amountTendered);
    if (!onAccount && tendered < total)
      throw new Error("Customer payment is less than the amount due");
    const change = onAccount ? 0 : Math.round((tendered - total) * 100) / 100;
    const paymentMethod = ["cash", "card", "transfer"].includes(
      req.body?.paymentMethod,
    )
      ? req.body.paymentMethod
      : "cash";
    const soldBy = await issuerFirstName(auth);
    const inserted = await client.query(
      `INSERT INTO pos_sales(receipt_number,request_id,session_id,invoice_id,invoice_number,customer_name,customer_phone,client_id,items,subtotal,total,paid_amount,amount_tendered,change_due,payment_method,sold_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        receiptNumber,
        requestId || null,
        session.id,
        invoiceId,
        invoiceNumber,
        customerName,
        customerPhone || null,
        linkedClientId,
        JSON.stringify(items),
        subtotal,
        total,
        onAccount ? 0 : total,
        onAccount ? 0 : tendered,
        change,
        onAccount ? "unpaid" : paymentMethod,
        soldBy,
      ],
    );
    if (!onAccount) await client.query(
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

router.get("/outstanding", async (req, res) => {
  try {
    await ensurePos();
    const id = Number(req.query.clientId);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Select an existing client" });
    const client = await pool.query("SELECT id,name,phone FROM clients WHERE id=$1 AND deleted_at IS NULL", [id]);
    if (!client.rows[0]) return res.status(404).json({ error: "Client not found" });
    const sales = await pool.query(`SELECT id,receipt_number,items,total,paid_amount,sold_at FROM pos_sales
      WHERE client_id=$1 AND paid_amount < total AND voided_at IS NULL ORDER BY sold_at,id LIMIT 100`, [id]);
    res.json({ client: client.rows[0], sales: sales.rows });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Outstanding POS bills could not load" });
  }
});

router.post("/settlements", async (req, res) => {
  await ensurePos();
  const id = Number(req.body?.clientId);
  const ids = req.body?.saleIds;
  const amount = Number(req.body?.amount);
  const paymentMethod = req.body?.paymentMethod;
  const requestId = clean(req.body?.requestId, 80);
  if (!Number.isSafeInteger(id) || id <= 0 || !Array.isArray(ids) || !ids.length || ids.length > 100 ||
      new Set(ids).size !== ids.length || ids.some((n: unknown) => !Number.isSafeInteger(n) || Number(n) <= 0) ||
      !Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6 ||
      !["cash", "card", "transfer"].includes(paymentMethod) || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return res.status(400).json({ error: "Choose valid bills, payment amount and method" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query("SELECT id FROM pos_sessions WHERE business_date=$1 AND closed_at IS NULL FOR UPDATE", [lkDate()]);
    if (!session.rows[0]) throw new Error("Open today's POS session before recording payment");
    const prior = await client.query("SELECT receipt_number FROM pos_settlements WHERE request_id=$1", [requestId]);
    if (prior.rows[0]) throw new Error(`This payment was already recorded as ${prior.rows[0].receipt_number}. Refresh the client bills.`);
    const customer = await client.query("SELECT id,name,phone FROM clients WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [id]);
    if (!customer.rows[0]) throw new Error("Client not found");
    const sales = await client.query(`SELECT id,receipt_number,total,paid_amount,sold_at FROM pos_sales
      WHERE client_id=$1 AND id=ANY($2::int[]) AND voided_at IS NULL ORDER BY sold_at,id FOR UPDATE`, [id, ids]);
    if (sales.rows.length !== ids.length || sales.rows.some((s) => Number(s.paid_amount) >= Number(s.total)))
      throw new Error("Bills changed; refresh outstanding bills before collecting payment");
    const { allocations, remaining } = allocatePosPayment(sales.rows, amount);
    for (const allocation of allocations)
      await client.query("UPDATE pos_sales SET paid_amount=paid_amount+$1 WHERE id=$2", [allocation.applied, allocation.saleId]);
    const receiptNumber = `POS-PAY-${lkDate().replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    await client.query(`INSERT INTO pos_settlements(receipt_number,request_id,client_id,session_id,amount,payment_method,allocations,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [receiptNumber, requestId, id, session.rows[0].id, amount, paymentMethod, JSON.stringify(allocations), await issuerFirstName(getAdminAuth(req))]);
    await client.query(`INSERT INTO finance_transactions(type,category,description,amount,transaction_date,source,source_ref)
      VALUES('income','shop_sales',$1,$2,$3,'pos_settlement',$4)`, [`Counter settlement · ${receiptNumber}`, amount, lkDate(), receiptNumber]);
    await client.query("COMMIT");
    res.status(201).json({ receiptNumber, client: customer.rows[0], amount, paymentMethod, allocations, remaining });
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    res.status(409).json({ error: error.message || "Payment could not be recorded" });
  } finally { client.release(); }
});

router.get("/outstanding-summary", async (req, res) => {
  try {
    await ensurePos();
    const phone = clean(req.query.phone, 40);
    const id = await findClientIdByPhone(phone);
    if (!id) return res.json({ client: null, count: 0, balance: 0 });
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count,
      COALESCE(SUM(total-paid_amount),0) AS balance FROM pos_sales
      WHERE client_id=$1 AND paid_amount < total AND voided_at IS NULL`, [id]);
    res.json({ clientId: id, count: rows[0].count, balance: Number(rows[0].balance) });
  } catch (error) { req.log.error(error); res.status(500).json({ error: "Could not check outstanding bills" }); }
});

router.get("/opening-context", async (req, res) => {
  try {
    await ensurePos();
    const { rows } = await pool.query(`SELECT opening_float,next_day_float FROM pos_sessions
      WHERE closed_at IS NOT NULL ORDER BY business_date DESC LIMIT 1`);
    const pending = await pool.query(`SELECT COALESCE(SUM(deposit_amount),0) AS amount FROM pos_sessions s
      WHERE s.closed_at IS NOT NULL AND s.deposit_tomorrow=true
      AND NOT EXISTS (SELECT 1 FROM pos_bank_deposits d WHERE d.session_id=s.id AND d.status='deposited')`);
    res.json({ suggestedFloat: Number(rows[0]?.next_day_float ?? rows[0]?.opening_float ?? 5000), pendingDeposit: Number(pending.rows[0]?.amount || 0) });
  } catch (error) { req.log.error(error); res.status(500).json({ error: "Opening context could not load" }); }
});

router.patch("/sales/:id", requireOwner, async (req, res) => {
  await ensurePos();
  const id = Number(req.params.id);
  const name = clean(req.body?.customerName, 160) || "Counter Sale";
  const phone = clean(req.body?.customerPhone, 40);
  const method = clean(req.body?.paymentMethod, 16);
  if (!Number.isSafeInteger(id) || id <= 0 || (phone && clientPhoneKeys(phone).length !== 1) || !['cash','card','transfer','unpaid'].includes(method))
    return res.status(400).json({ error: "Enter a valid customer and payment method" });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT ps.* FROM pos_sales ps JOIN pos_sessions s ON s.id=ps.session_id
      WHERE ps.id=$1 AND s.closed_at IS NULL AND ps.voided_at IS NULL FOR UPDATE OF ps`, [id]);
    const sale = rows[0];
    if (!sale) throw new Error('Bill is unavailable or the POS day is closed');
    const settled = await client.query(`SELECT 1 FROM pos_settlements WHERE allocations @> $1::jsonb LIMIT 1`, [JSON.stringify([{ saleId:id }])]);
    if (settled.rows.length) throw new Error('A settled bill cannot be edited');
    if (method === 'unpaid' && Number(sale.paid_amount) > 0 || method !== 'unpaid' && Number(sale.paid_amount) === 0)
      throw new Error('Payment method cannot change between paid and unpaid');
    const linked = phone ? await findClientIdByPhone(phone, client) : null;
    if (method === 'unpaid' && !linked) throw new Error('Unpaid bills require an existing client phone');
    const changed = await client.query(`UPDATE pos_sales SET customer_name=$2,customer_phone=$3,client_id=$4,
      payment_method=$5,edited_at=NOW(),edited_by=$6 WHERE id=$1 RETURNING *`,
      [id,name,phone || null,linked,method,getAdminAuth(req)!.username]);
    await client.query(`INSERT INTO pos_sale_audit(sale_id,action,before_value,after_value,actor)
      VALUES($1,'edit',$2::jsonb,$3::jsonb,$4)`, [id, JSON.stringify(sale), JSON.stringify(changed.rows[0]), getAdminAuth(req)!.username]);
    await client.query('COMMIT'); res.json(changed.rows[0]);
  } catch (error: any) { await client.query('ROLLBACK').catch(() => {}); res.status(409).json({ error: error.message || 'Could not edit bill' }); }
  finally { client.release(); }
});

router.post("/sales/:id/void", requireOwner, async (req, res) => {
  await ensurePos();
  const id = Number(req.params.id);
  const reason = clean(req.body?.reason, 300);
  if (!Number.isSafeInteger(id) || id <= 0 || reason.length < 5) return res.status(400).json({ error: 'Enter a void reason of at least five characters' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT ps.* FROM pos_sales ps JOIN pos_sessions s ON s.id=ps.session_id
      WHERE ps.id=$1 AND s.closed_at IS NULL AND ps.voided_at IS NULL FOR UPDATE OF ps`, [id]);
    const sale = rows[0];
    if (!sale) throw new Error('Bill is unavailable or the POS day is closed');
    if (sale.invoice_id || Number(sale.paid_amount) > 0) throw new Error('Only unpaid bills without an invoice or payment can be voided');
    const changed = await client.query(`UPDATE pos_sales SET voided_at=NOW(),voided_by=$2,void_reason=$3 WHERE id=$1 RETURNING *`,
      [id,getAdminAuth(req)!.username,reason]);
    await client.query(`INSERT INTO pos_sale_audit(sale_id,action,before_value,after_value,actor)
      VALUES($1,'void',$2::jsonb,$3::jsonb,$4)`, [id, JSON.stringify(sale), JSON.stringify(changed.rows[0]), getAdminAuth(req)!.username]);
    await client.query('COMMIT'); res.json(changed.rows[0]);
  } catch (error: any) { await client.query('ROLLBACK').catch(() => {}); res.status(409).json({ error: error.message || 'Could not void bill' }); }
  finally { client.release(); }
});

router.post("/request-reopen", async (req, res) => {
  try {
    await ensurePos();
    const auth = getAdminAuth(req)!;
    if (auth.role !== "staff" || !auth.staffId)
      return res.status(400).json({ error: "Staff accounts should use this request" });
    const reason = clean(req.body?.reason, 300);
    if (!reason) return res.status(400).json({ error: "Please explain why the day must be reopened" });
    const session = await pool.query(
      "SELECT id FROM pos_sessions WHERE business_date=$1 AND closed_at IS NOT NULL",
      [lkDate()],
    );
    if (!session.rows[0]) return res.status(409).json({ error: "Today's POS day is not closed" });
    const { rows } = await pool.query(
      `INSERT INTO pos_reopen_requests(session_id,requested_by,requested_by_username,reason)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (session_id) WHERE status='pending'
       DO UPDATE SET reason=EXCLUDED.reason,requested_by=EXCLUDED.requested_by,
         requested_by_username=EXCLUDED.requested_by_username,created_at=NOW()
       RETURNING *`,
      [session.rows[0].id, auth.staffId, auth.username, reason],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not send the reopen request" });
  }
});

router.post("/reopen-day", requireOwner, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensurePos();
    const auth = getAdminAuth(req)!;
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE pos_sessions SET closed_at=NULL,closing_cash=NULL,reopened_at=NOW(),reopened_by=$1
       WHERE business_date=$2 AND closed_at IS NOT NULL RETURNING *`,
      [auth.username, lkDate()],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Today's POS day is not closed" });
    }
    const confirmed = await client.query("SELECT 1 FROM pos_bank_deposits WHERE session_id=$1 AND status='deposited'", [rows[0].id]);
    if (confirmed.rows.length) throw new Error("A deposited day cannot be reopened without bank reconciliation");
    await client.query("DELETE FROM pos_bank_deposits WHERE session_id=$1 AND status='pending'", [rows[0].id]);
    await client.query(
      `UPDATE pos_reopen_requests SET status='approved',decided_by=$1,decided_at=NOW()
       WHERE session_id=$2 AND status='pending'`,
      [auth.username, rows[0].id],
    );
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    res.status(500).json({ error: "Could not reopen the POS day" });
  } finally {
    client.release();
  }
});

export default router;
