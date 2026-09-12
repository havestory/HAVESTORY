import { Router } from "express";
import { pool } from "@workspace/db";
import { getAdminAuth, hasPermission, requireAdmin } from "../lib/auth-cookie";

const router = Router();
router.use(requireAdmin);
router.use((req, res, next) => {
  const auth = getAdminAuth(req);
  if (!hasPermission(auth, "pos_access")) {
    return res.status(403).json({ error: "POS / Counter Sales access permission required" });
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

router.get("/range", async (req, res) => {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!datePattern.test(from) || !datePattern.test(to)) {
      return res.status(400).json({ error: "Choose a valid From date and To date" });
    }
    if (from > to) {
      return res.status(400).json({ error: "From date cannot be after To date" });
    }

    const span = await pool.query(
      "SELECT ($2::date - $1::date) AS days",
      [from, to],
    );
    if (Number(span.rows[0]?.days || 0) > 366) {
      return res.status(400).json({ error: "Date range cannot be longer than 366 days" });
    }

    const { rows } = await pool.query(
      `SELECT ps.id, ps.receipt_number, ps.invoice_number, ps.customer_name,
              ps.items, ps.subtotal, ps.total, ps.amount_tendered, ps.change_due,
              ps.payment_method, ps.sold_by, ps.sold_at,
              to_char(s.business_date, 'YYYY-MM-DD') AS business_date
       FROM pos_sales ps
       JOIN pos_sessions s ON s.id = ps.session_id
       WHERE s.business_date BETWEEN $1::date AND $2::date
       ORDER BY s.business_date DESC, ps.sold_at DESC`,
      [from, to],
    );

    const summary = rows.reduce(
      (acc, row) => {
        const total = Number(row.total || 0);
        acc.count += 1;
        acc.total += total;
        if (row.payment_method === "cash") acc.cash += total;
        else if (row.payment_method === "card") acc.card += total;
        else if (row.payment_method === "transfer") acc.transfer += total;
        return acc;
      },
      { count: 0, total: 0, cash: 0, card: 0, transfer: 0 },
    );

    res.json({ from, to, sales: rows, summary });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "POS bill history could not load" });
  }
});

export default router;
