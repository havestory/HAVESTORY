import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth-cookie";

const router = Router();
router.use(requireAdmin);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

// Validate a date string YYYY-MM-DD
const dateParam = (value: unknown): string | null => {
  const s = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// GET /reports/orders?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&type=...
router.get("/orders", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);
    const status = String(req.query.status || "").trim() || null;
    const type = String(req.query.type || "").trim() || null;

    const conditions = [
      "o.deleted_at IS NULL",
      "DATE(o.created_at) >= $1",
      "DATE(o.created_at) <= $2",
    ];
    const params: any[] = [from, to];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`o.order_type = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT
        o.id,
        o.order_id,
        o.customer_name,
        o.customer_phone,
        o.status,
        o.amount,
        o.advance_paid,
        o.discount_amount,
        o.created_at,
        o.due_date,
        o.priority,
        COALESCE(o.order_type, 'order') AS order_type,
        pst.name AS service_type_name
      FROM orders o
      LEFT JOIN project_service_types pst ON pst.id = o.service_type_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY o.created_at DESC
      LIMIT 1000
    `, params);

    // Aggregate totals
    const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalAdvance = rows.reduce((s, r) => s + Number(r.advance_paid || 0), 0);

    return res.json({ rows, summary: { count: rows.length, totalAmount, totalAdvance }, from, to });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load orders report" });
  }
});

// GET /reports/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...
router.get("/invoices", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);
    const status = String(req.query.status || "").trim() || null;

    const conditions = [
      "i.deleted_at IS NULL",
      "DATE(i.created_at) >= $1",
      "DATE(i.created_at) <= $2",
    ];
    const params: any[] = [from, to];

    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT
        i.id,
        i.invoice_number,
        i.client_name,
        i.client_phone,
        i.client_email,
        i.amount,
        i.status,
        i.due_date,
        i.created_at,
        i.order_id,
        -- Pull advance from metadata JSON safely
        CASE
          WHEN i.metadata IS NOT NULL AND i.metadata <> ''
          THEN (i.metadata::jsonb ->> 'advance')
          ELSE NULL
        END AS advance_paid
      FROM invoices i
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.created_at DESC
      LIMIT 1000
    `, params);

    const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const paidRows = rows.filter(r => r.status === "paid");
    const totalPaid = paidRows.reduce((s, r) => s + Number(r.amount || 0), 0);

    return res.json({ rows, summary: { count: rows.length, totalAmount, totalPaid, paidCount: paidRows.length }, from, to });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load invoices report" });
  }
});

// GET /reports/clients?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/clients", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);

    // New clients in range
    const { rows: newClients } = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.created_at,
        COALESCE(o_counts.order_count, 0) AS order_count,
        COALESCE(i_counts.invoice_count, 0) AS invoice_count,
        COALESCE(i_counts.total_revenue, 0) AS total_revenue,
        'new' AS client_type
      FROM clients c
      LEFT JOIN (
        SELECT customer_phone, COUNT(*) AS order_count
        FROM orders
        WHERE deleted_at IS NULL
        GROUP BY customer_phone
      ) o_counts ON o_counts.customer_phone = c.phone
      LEFT JOIN (
        SELECT client_id, COUNT(*) AS invoice_count, SUM(amount::numeric) AS total_revenue
        FROM invoices
        WHERE deleted_at IS NULL AND status IN ('paid', 'partial')
        GROUP BY client_id
      ) i_counts ON i_counts.client_id = c.id
      WHERE c.deleted_at IS NULL
        AND DATE(c.created_at) >= $1
        AND DATE(c.created_at) <= $2
      ORDER BY c.created_at DESC
      LIMIT 500
    `, [from, to]);

    // Returning clients: have orders/invoices in range but joined before range
    const { rows: returningClients } = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.created_at,
        activity.order_count,
        activity.invoice_count,
        activity.total_revenue,
        'returning' AS client_type
      FROM clients c
      JOIN (
        SELECT
          c2.id AS client_id,
          COUNT(DISTINCT o.id) AS order_count,
          COUNT(DISTINCT i.id) AS invoice_count,
          COALESCE(SUM(CASE WHEN i.status IN ('paid','partial') THEN i.amount::numeric ELSE 0 END), 0) AS total_revenue
        FROM clients c2
        LEFT JOIN orders o ON o.customer_phone = c2.phone
          AND o.deleted_at IS NULL
          AND DATE(o.created_at) >= $1
          AND DATE(o.created_at) <= $2
        LEFT JOIN invoices i ON i.client_id = c2.id
          AND i.deleted_at IS NULL
          AND DATE(i.created_at) >= $1
          AND DATE(i.created_at) <= $2
        WHERE c2.deleted_at IS NULL
          AND DATE(c2.created_at) < $1
        GROUP BY c2.id
        HAVING COUNT(DISTINCT o.id) + COUNT(DISTINCT i.id) > 0
      ) activity ON activity.client_id = c.id
      ORDER BY c.name
      LIMIT 500
    `, [from, to]);

    const allRows = [...newClients, ...returningClients];
    return res.json({
      rows: allRows,
      summary: {
        newCount: newClients.length,
        returningCount: returningClients.length,
        totalCount: allRows.length,
      },
      from,
      to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load clients report" });
  }
});

// GET /reports/inventory?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/inventory", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);

    const { rows: usageRows } = await pool.query(`
      SELECT
        inv.id,
        inv.name,
        inv.unit,
        inv.quantity AS current_stock,
        inv.low_stock_threshold,
        COALESCE(SUM(iu.used_quantity), 0) AS used_quantity,
        COALESCE(SUM(iu.waste_quantity), 0) AS waste_quantity,
        COALESCE(SUM(iu.used_quantity + iu.waste_quantity), 0) AS total_consumed
      FROM inventory inv
      LEFT JOIN invoice_material_usage iu ON iu.inventory_item_id = inv.id
        AND DATE(iu.created_at) >= $1
        AND DATE(iu.created_at) <= $2
      GROUP BY inv.id, inv.name, inv.unit, inv.quantity, inv.low_stock_threshold
      ORDER BY total_consumed DESC, inv.name
    `, [from, to]);

    const { rows: wasteRows } = await pool.query(`
      SELECT
        inv.id AS inventory_id,
        inv.name,
        inv.unit,
        COALESCE(SUM(w.quantity), 0) AS manual_waste
      FROM inventory inv
      LEFT JOIN material_waste w ON w.inventory_item_id = inv.id
        AND w.waste_date >= $1::date
        AND w.waste_date <= $2::date
      GROUP BY inv.id, inv.name, inv.unit
      HAVING SUM(w.quantity) > 0
      ORDER BY manual_waste DESC
    `, [from, to]);

    const totalUsed = usageRows.reduce((s, r) => s + Number(r.used_quantity), 0);
    const totalWaste = usageRows.reduce((s, r) => s + Number(r.waste_quantity), 0);

    return res.json({
      usageRows,
      wasteRows,
      summary: { totalUsed, totalWaste, itemCount: usageRows.filter(r => Number(r.total_consumed) > 0).length },
      from,
      to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load inventory report" });
  }
});

export default router;
