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

const PAGE_SIZE = 250;

// GET /reports/orders?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&type=...&offset=N
router.get("/orders", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);
    const status = String(req.query.status || "").trim() || null;
    const type = String(req.query.type || "").trim() || null;
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);

    // Sargable timestamp range — lets PostgreSQL use the btree index on created_at
    const conditions = [
      "o.deleted_at IS NULL",
      "o.created_at >= $1::date",
      "o.created_at < ($2::date + interval '1 day')",
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

    const whereClause = conditions.join(" AND ");

    // Summary aggregate only on first page — avoids a repeated full-range scan
    // on every Load More click.
    let summary: { count: number; totalAmount: number; totalAdvance: number } | null = null;
    if (offset === 0) {
      const { rows: agg } = await pool.query(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(o.payment_amount::numeric), 0) AS total_amount,
               COALESCE(SUM(o.advance_paid::numeric), 0) AS total_advance
        FROM orders o
        WHERE ${whereClause}
      `, params);
      summary = {
        count: Number(agg[0]?.total ?? 0),
        totalAmount: Number(agg[0]?.total_amount ?? 0),
        totalAdvance: Number(agg[0]?.total_advance ?? 0),
      };
    }

    params.push(PAGE_SIZE + 1, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await pool.query(`
      SELECT
        o.id,
        o.order_id,
        o.customer_name,
        o.customer_phone,
        o.status,
        o.payment_amount AS amount,
        o.advance_paid,
        o.discount_amount,
        o.created_at,
        o.due_date,
        o.priority,
        COALESCE(o.order_type, 'order') AS order_type,
        pst.name AS service_type_name
      FROM orders o
      LEFT JOIN project_service_types pst ON pst.id = o.service_type_id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    const hasMore = rows.length > PAGE_SIZE;
    return res.json({
      rows: hasMore ? rows.slice(0, PAGE_SIZE) : rows,
      hasMore, offset, pageSize: PAGE_SIZE, summary, from, to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load orders report" });
  }
});

// GET /reports/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&offset=N
router.get("/invoices", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);
    const status = String(req.query.status || "").trim() || null;
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);

    const conditions = [
      "i.deleted_at IS NULL",
      "i.created_at >= $1::date",
      "i.created_at < ($2::date + interval '1 day')",
    ];
    const params: any[] = [from, to];

    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    let summary: { count: number; totalAmount: number; totalPaid: number; paidCount: number } | null = null;
    if (offset === 0) {
      const { rows: agg } = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(i.amount::numeric), 0) AS total_amount,
          COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount::numeric ELSE 0 END), 0) AS total_paid,
          COUNT(CASE WHEN i.status = 'paid' THEN 1 END) AS paid_count
        FROM invoices i
        WHERE ${whereClause}
      `, params);
      summary = {
        count: Number(agg[0]?.total ?? 0),
        totalAmount: Number(agg[0]?.total_amount ?? 0),
        totalPaid: Number(agg[0]?.total_paid ?? 0),
        paidCount: Number(agg[0]?.paid_count ?? 0),
      };
    }

    params.push(PAGE_SIZE + 1, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

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
        CASE
          WHEN i.metadata IS NOT NULL AND i.metadata <> ''
          THEN (i.metadata::jsonb ->> 'advance')
          ELSE NULL
        END AS advance_paid
      FROM invoices i
      WHERE ${whereClause}
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    const hasMore = rows.length > PAGE_SIZE;
    return res.json({
      rows: hasMore ? rows.slice(0, PAGE_SIZE) : rows,
      hasMore, offset, pageSize: PAGE_SIZE, summary, from, to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load invoices report" });
  }
});

// GET /reports/clients?from=YYYY-MM-DD&to=YYYY-MM-DD&offset=N
//
// Two-step design to avoid global table scans on every page:
//
// Step 1 — cheap pagination query: identify which clients belong on this page
//   using a UNION ALL of new-clients (date filter on clients.created_at) and
//   returning-clients (IN lookup against the set of phones/ids that have date-
//   range activity).  No aggregation happens here.
//
// Step 2 — bounded enrichment: aggregate orders/invoices only for the ≤250
//   clients returned by step 1, using = ANY($phones) / = ANY($ids) so the
//   aggregation is always bounded to the page size, not the full history.
//
// New-client lifetime stats (all-time order/invoice counts) are scoped to
// the page's phones/ids; returning-client stats are scoped to the date range.
router.get("/clients", async (req, res) => {
  try {
    const from = dateParam(req.query.from) ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to = dateParam(req.query.to) ?? new Date().toISOString().slice(0, 10);
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);

    // ── Summary counts (first page only) ────────────────────────────
    let summary: { newCount: number; returningCount: number; totalCount: number } | null = null;
    if (offset === 0) {
      const [{ rows: newRow }, { rows: retRow }] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS cnt
           FROM clients
           WHERE deleted_at IS NULL
             AND created_at >= $1::date
             AND created_at < ($2::date + interval '1 day')`,
          [from, to]
        ),
        pool.query(
          `WITH
             active_phones AS (
               SELECT DISTINCT customer_phone
               FROM orders
               WHERE deleted_at IS NULL
                 AND created_at >= $1::date
                 AND created_at < ($2::date + interval '1 day')
             ),
             active_client_ids AS (
               SELECT DISTINCT client_id
               FROM invoices
               WHERE deleted_at IS NULL
                 AND created_at >= $1::date
                 AND created_at < ($2::date + interval '1 day')
           SELECT COUNT(DISTINCT c.id)::int AS cnt
           FROM clients c
           WHERE c.deleted_at IS NULL
             AND c.created_at < $1::date
             AND (
               c.phone IN (SELECT customer_phone FROM active_phones)
               OR c.id  IN (SELECT client_id FROM active_client_ids)
             )`,
          [from, to]
        ),
      ]);
      const newCount = Number(newRow[0]?.cnt ?? 0);
      const returningCount = Number(retRow[0]?.cnt ?? 0);
      summary = { newCount, returningCount, totalCount: newCount + returningCount };
    }

    // ── Step 1: paginate the combined client set (no aggregation) ────
    //
    // "New" clients: joined within the date range.
    // "Returning" clients: joined before range, have order or invoice activity
    //   in range (determined by an IN lookup against pre-computed distinct sets,
    //   not by joining and grouping the full activity tables).
    const { rows: pageClients } = await pool.query(`
      WITH
        active_phones AS (
          SELECT DISTINCT customer_phone
          FROM orders
          WHERE deleted_at IS NULL
            AND created_at >= $1::date
            AND created_at < ($2::date + interval '1 day')
        ),
        active_client_ids AS (
          SELECT DISTINCT client_id
          FROM invoices
          WHERE deleted_at IS NULL
            AND created_at >= $1::date
            AND created_at < ($2::date + interval '1 day')
        )
      SELECT id, name, phone, email, created_at, client_type
      FROM (
        SELECT c.id, c.name, c.phone, c.email, c.created_at, 'new'::text AS client_type
        FROM clients c
        WHERE c.deleted_at IS NULL
          AND c.created_at >= $1::date
          AND c.created_at < ($2::date + interval '1 day')

        UNION ALL

        SELECT c.id, c.name, c.phone, c.email, c.created_at, 'returning'::text AS client_type
        FROM clients c
        WHERE c.deleted_at IS NULL
          AND c.created_at < $1::date
          AND (
            c.phone IN (SELECT customer_phone FROM active_phones)
            OR c.id  IN (SELECT client_id FROM active_client_ids)
          )
      ) combined
      ORDER BY created_at DESC, id DESC
      LIMIT $3 OFFSET $4
    `, [from, to, PAGE_SIZE + 1, offset]);

    const hasMore = pageClients.length > PAGE_SIZE;
    const pageRows = hasMore ? pageClients.slice(0, PAGE_SIZE) : pageClients;

    if (pageRows.length === 0) {
      return res.json({ rows: [], hasMore: false, offset, pageSize: PAGE_SIZE, summary, from, to });
    }

    // ── Step 2: enrich with per-client metrics (bounded to this page) ──
    //
    // All aggregations run only over the ≤250 phones / ids on this page.
    const newRows = pageRows.filter((r: any) => r.client_type === 'new');
    const retRows = pageRows.filter((r: any) => r.client_type === 'returning');

    const newPhones = newRows.map((r: any) => r.phone).filter(Boolean) as string[];
    const newIds = newRows.map((r: any) => r.id) as number[];
    const retPhones = retRows.map((r: any) => r.phone).filter(Boolean) as string[];
    const retIds = retRows.map((r: any) => r.id) as number[];

    const [
      { rows: newOrderStats },
      { rows: newInvoiceStats },
      { rows: retOrderStats },
      { rows: retInvoiceStats },
    ] = await Promise.all([
      // New-client lifetime order count (bounded to page phones)
      newPhones.length > 0
        ? pool.query(
            `SELECT customer_phone, COUNT(*) AS order_count
             FROM orders
             WHERE deleted_at IS NULL AND customer_phone = ANY($1::text[])
             GROUP BY customer_phone`,
            [newPhones]
          )
        : Promise.resolve({ rows: [] as any[] }),

      // New-client lifetime invoice count (bounded to page ids)
      newIds.length > 0
        ? pool.query(
            `SELECT client_id,
                    COUNT(*) AS invoice_count,
                    COALESCE(SUM(CASE WHEN status IN ('paid','partial') THEN amount::numeric ELSE 0 END), 0) AS total_revenue
             FROM invoices
             WHERE deleted_at IS NULL AND client_id = ANY($1::int[])
             GROUP BY client_id`,
            [newIds]
          )
        : Promise.resolve({ rows: [] as any[] }),

      // Returning-client range order count (bounded to page phones + date range)
      retPhones.length > 0
        ? pool.query(
            `SELECT customer_phone, COUNT(*) AS order_count
             FROM orders
             WHERE deleted_at IS NULL
               AND created_at >= $1::date
               AND created_at < ($2::date + interval '1 day')
               AND customer_phone = ANY($3::text[])
             GROUP BY customer_phone`,
            [from, to, retPhones]
          )
        : Promise.resolve({ rows: [] as any[] }),

      // Returning-client range invoice count (bounded to page ids + date range)
      retIds.length > 0
        ? pool.query(
            `SELECT client_id,
                    COUNT(*) AS invoice_count,
                    COALESCE(SUM(CASE WHEN status IN ('paid','partial') THEN amount::numeric ELSE 0 END), 0) AS total_revenue
             FROM invoices
             WHERE deleted_at IS NULL
               AND created_at >= $1::date
               AND created_at < ($2::date + interval '1 day')
               AND client_id = ANY($3::int[])
             GROUP BY client_id`,
            [from, to, retIds]
          )
        : Promise.resolve({ rows: [] as any[] }),
    ]);

    // Build lookup maps
    const newOrderMap = new Map<string, number>(
      newOrderStats.map((r: any) => [r.customer_phone, Number(r.order_count)])
    );
    const newInvMap = new Map<number, { invoice_count: number; total_revenue: number }>(
      newInvoiceStats.map((r: any) => [
        Number(r.client_id),
        { invoice_count: Number(r.invoice_count), total_revenue: Number(r.total_revenue) },
      ])
    );
    const retOrderMap = new Map<string, number>(
      retOrderStats.map((r: any) => [r.customer_phone, Number(r.order_count)])
    );
    const retInvMap = new Map<number, { invoice_count: number; total_revenue: number }>(
      retInvoiceStats.map((r: any) => [
        Number(r.client_id),
        { invoice_count: Number(r.invoice_count), total_revenue: Number(r.total_revenue) },
      ])
    );

    const enriched = pageRows.map((r: any) => {
      if (r.client_type === 'new') {
        const inv = newInvMap.get(r.id) ?? { invoice_count: 0, total_revenue: 0 };
        return {
          ...r,
          order_count: newOrderMap.get(r.phone) ?? 0,
          invoice_count: inv.invoice_count,
          total_revenue: inv.total_revenue,
        };
      } else {
        const inv = retInvMap.get(r.id) ?? { invoice_count: 0, total_revenue: 0 };
        return {
          ...r,
          order_count: retOrderMap.get(r.phone) ?? 0,
          invoice_count: inv.invoice_count,
          total_revenue: inv.total_revenue,
        };
      }
    });

    return res.json({ rows: enriched, hasMore, offset, pageSize: PAGE_SIZE, summary, from, to });
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
        AND iu.created_at >= $1::date
        AND iu.created_at < ($2::date + interval '1 day')
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
        AND w.waste_date < ($2::date + interval '1 day')
      GROUP BY inv.id, inv.name, inv.unit
      HAVING SUM(w.quantity) > 0
      ORDER BY manual_waste DESC
    `, [from, to]);

    const totalUsed = usageRows.reduce((s: number, r: any) => s + Number(r.used_quantity), 0);
    const totalWaste = usageRows.reduce((s: number, r: any) => s + Number(r.waste_quantity), 0);

    return res.json({
      usageRows,
      wasteRows,
      summary: { totalUsed, totalWaste, itemCount: usageRows.filter((r: any) => Number(r.total_consumed) > 0).length },
      from,
      to,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load inventory report" });
  }
});

export default router;
