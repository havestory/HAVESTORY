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

// Safe pagination helpers
const PAGE_LIMIT_MAX = 500;
const PAGE_LIMIT_DEFAULT = 200;

function paginate(query: unknown, limitQ: unknown) {
  const page  = Math.max(1, parseInt(String(query ?? "1"), 10) || 1);
  const limit = Math.min(PAGE_LIMIT_MAX, Math.max(10, parseInt(String(limitQ ?? PAGE_LIMIT_DEFAULT), 10) || PAGE_LIMIT_DEFAULT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Wrap a single query in a 20-second statement timeout
async function withTimeout<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL statement_timeout = '20000'");
    return await fn.call({ query: client.query.bind(client) } as any);
  } finally {
    client.release();
  }
}

// GET /reports/orders?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&type=...&page=1&limit=200
router.get("/orders", async (req, res) => {
  try {
    const from   = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to     = dateParam(req.query.to)   ?? new Date().toISOString().slice(0, 10);
    const status = String(req.query.status || "").trim() || null;
    const type   = String(req.query.type   || "").trim() || null;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);

    // Range predicate — avoids DATE() cast so indexes can be used
    const conditions = [
      "o.deleted_at IS NULL",
      "o.created_at >= $1::date",
      "o.created_at  < ($2::date + INTERVAL '1 day')",
    ];
    const params: any[] = [from, to];

    if (status) { params.push(status); conditions.push(`o.status = $${params.length}`); }
    if (type)   { params.push(type);   conditions.push(`o.order_type = $${params.length}`); }

    const where = conditions.join(" AND ");

    // Run summary and page query in parallel
    const [summaryRes, pageRes] = await Promise.all([
      pool.query<{ total_count: string; total_amount: string; total_advance: string }>(`
        SELECT
          COUNT(*)                             AS total_count,
          COALESCE(SUM(o.amount::numeric), 0)         AS total_amount,
          COALESCE(SUM(o.advance_paid::numeric), 0)   AS total_advance
        FROM orders o
        WHERE ${where}
      `, params),

      pool.query(`
        SELECT
          o.id, o.order_id, o.customer_name, o.customer_phone,
          o.status, o.amount, o.advance_paid, o.discount_amount,
          o.created_at, o.due_date, o.priority,
          COALESCE(o.order_type, 'order') AS order_type,
          pst.name AS service_type_name
        FROM orders o
        LEFT JOIN project_service_types pst ON pst.id = o.service_type_id
        WHERE ${where}
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params),
    ]);

    const { total_count, total_amount, total_advance } = summaryRes.rows[0];
    const totalCount = Number(total_count);
    const totalPages = Math.ceil(totalCount / limit);

    return res.json({
      rows: pageRes.rows,
      summary: {
        count:        totalCount,
        totalAmount:  Number(total_amount),
        totalAdvance: Number(total_advance),
      },
      pagination: { page, limit, totalPages, totalCount },
      from,
      to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load orders report" });
  }
});

// GET /reports/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&page=1&limit=200
router.get("/invoices", async (req, res) => {
  try {
    const from   = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to     = dateParam(req.query.to)   ?? new Date().toISOString().slice(0, 10);
    const status = String(req.query.status || "").trim() || null;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);

    const conditions = [
      "i.deleted_at IS NULL",
      "i.created_at >= $1::date",
      "i.created_at  < ($2::date + INTERVAL '1 day')",
    ];
    const params: any[] = [from, to];
    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }

    const where = conditions.join(" AND ");

    const [summaryRes, pageRes] = await Promise.all([
      pool.query<{ total_count: string; total_amount: string; paid_amount: string; paid_count: string }>(`
        SELECT
          COUNT(*)                                                                              AS total_count,
          COALESCE(SUM(i.amount::numeric), 0)                                                  AS total_amount,
          COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount::numeric ELSE 0 END), 0)      AS paid_amount,
          COUNT(CASE WHEN i.status = 'paid' THEN 1 END)                                        AS paid_count
        FROM invoices i
        WHERE ${where}
      `, params),

      pool.query(`
        SELECT
          i.id, i.invoice_number, i.client_name, i.client_phone, i.client_email,
          i.amount, i.status, i.due_date, i.created_at, i.order_id,
          CASE
            WHEN i.metadata IS NOT NULL AND i.metadata <> ''
            THEN (i.metadata::jsonb ->> 'advance')
            ELSE NULL
          END AS advance_paid
        FROM invoices i
        WHERE ${where}
        ORDER BY i.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params),
    ]);

    const s = summaryRes.rows[0];
    const totalCount = Number(s.total_count);
    const totalPages = Math.ceil(totalCount / limit);

    return res.json({
      rows: pageRes.rows,
      summary: {
        count:      totalCount,
        totalAmount: Number(s.total_amount),
        totalPaid:   Number(s.paid_amount),
        paidCount:   Number(s.paid_count),
      },
      pagination: { page, limit, totalPages, totalCount },
      from,
      to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load invoices report" });
  }
});

// GET /reports/clients?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/clients", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to   = dateParam(req.query.to)   ?? new Date().toISOString().slice(0, 10);

    // New clients — joined in range, with their all-time order/invoice totals
    // Returning clients — joined before range, had activity in range
    // Both use range predicates to allow index use.
    const [newRes, returningRes] = await Promise.all([
      pool.query(`
        SELECT
          c.id, c.name, c.phone, c.email, c.created_at,
          COALESCE(o_cnt.order_count,   0)  AS order_count,
          COALESCE(i_cnt.invoice_count, 0)  AS invoice_count,
          COALESCE(i_cnt.total_revenue, 0)  AS total_revenue,
          'new' AS client_type
        FROM clients c
        LEFT JOIN (
          SELECT customer_phone, COUNT(*) AS order_count
            FROM orders
           WHERE deleted_at IS NULL
           GROUP BY customer_phone
        ) o_cnt ON o_cnt.customer_phone = c.phone
        LEFT JOIN (
          SELECT client_id,
                 COUNT(*)          AS invoice_count,
                 SUM(amount::numeric) AS total_revenue
            FROM invoices
           WHERE deleted_at IS NULL AND status IN ('paid','partial')
           GROUP BY client_id
        ) i_cnt ON i_cnt.client_id = c.id
        WHERE c.deleted_at IS NULL
          AND c.created_at >= $1::date
          AND c.created_at  < ($2::date + INTERVAL '1 day')
        ORDER BY c.created_at DESC
        LIMIT 500
      `, [from, to]),

      pool.query(`
        SELECT
          c.id, c.name, c.phone, c.email, c.created_at,
          act.order_count,
          act.invoice_count,
          act.total_revenue,
          'returning' AS client_type
        FROM clients c
        JOIN (
          SELECT
            c2.id AS client_id,
            COUNT(DISTINCT o.id)  AS order_count,
            COUNT(DISTINCT i.id)  AS invoice_count,
            COALESCE(SUM(CASE WHEN i.status IN ('paid','partial') THEN i.amount::numeric ELSE 0 END), 0) AS total_revenue
          FROM clients c2
          LEFT JOIN orders o
            ON o.customer_phone = c2.phone
           AND o.deleted_at IS NULL
           AND o.created_at >= $1::date
           AND o.created_at  < ($2::date + INTERVAL '1 day')
          LEFT JOIN invoices i
            ON i.client_id = c2.id
           AND i.deleted_at IS NULL
           AND i.created_at >= $1::date
           AND i.created_at  < ($2::date + INTERVAL '1 day')
          WHERE c2.deleted_at IS NULL
            AND c2.created_at < $1::date
          GROUP BY c2.id
          HAVING COUNT(DISTINCT o.id) + COUNT(DISTINCT i.id) > 0
        ) act ON act.client_id = c.id
        ORDER BY c.name
        LIMIT 500
      `, [from, to]),
    ]);

    const allRows = [...newRes.rows, ...returningRes.rows];
    return res.json({
      rows: allRows,
      summary: {
        newCount:       newRes.rows.length,
        returningCount: returningRes.rows.length,
        totalCount:     allRows.length,
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
    const to   = dateParam(req.query.to)   ?? new Date().toISOString().slice(0, 10);

    const [usageRes, wasteRes] = await Promise.all([
      pool.query(`
        SELECT
          inv.id, inv.name, inv.unit,
          inv.quantity          AS current_stock,
          inv.low_stock_threshold,
          COALESCE(SUM(iu.used_quantity),                     0) AS used_quantity,
          COALESCE(SUM(iu.waste_quantity),                    0) AS waste_quantity,
          COALESCE(SUM(iu.used_quantity + iu.waste_quantity), 0) AS total_consumed
        FROM inventory inv
        LEFT JOIN invoice_material_usage iu
          ON iu.inventory_item_id = inv.id
         AND iu.created_at >= $1::date
         AND iu.created_at  < ($2::date + INTERVAL '1 day')
        GROUP BY inv.id, inv.name, inv.unit, inv.quantity, inv.low_stock_threshold
        ORDER BY total_consumed DESC, inv.name
      `, [from, to]),

      pool.query(`
        SELECT
          inv.id AS inventory_id, inv.name, inv.unit,
          COALESCE(SUM(w.quantity), 0) AS manual_waste
        FROM inventory inv
        LEFT JOIN material_waste w
          ON w.inventory_item_id = inv.id
         AND w.waste_date >= $1::date
         AND w.waste_date <= $2::date
        GROUP BY inv.id, inv.name, inv.unit
        HAVING SUM(w.quantity) > 0
        ORDER BY manual_waste DESC
      `, [from, to]),
    ]);

    const totalUsed  = usageRes.rows.reduce((s, r) => s + Number(r.used_quantity),  0);
    const totalWaste = usageRes.rows.reduce((s, r) => s + Number(r.waste_quantity), 0);

    return res.json({
      usageRows: usageRes.rows,
      wasteRows: wasteRes.rows,
      summary: {
        totalUsed,
        totalWaste,
        itemCount: usageRes.rows.filter(r => Number(r.total_consumed) > 0).length,
      },
      from,
      to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load inventory report" });
  }
});

export default router;
