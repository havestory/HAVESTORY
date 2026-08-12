import { Router } from "express";
import { pool, db } from "@workspace/db";
import {
  productsTable, servicesTable, ordersTable, settingsTable
} from "@workspace/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";
import { ensureFinanceStorage } from "./finance-inventory";

const router = Router();

const dashboardRange = (value: unknown) => {
  const days = Number(value);
  return [7, 30, 90, 365].includes(days) ? days : 30;
};

const percentageChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

// GET /stats/dashboard?days=30 — one request for the complete admin overview.
// Queries run concurrently and replace the previous dashboard's four HTTP
// requests plus repeated client-side list downloads.
router.get("/dashboard", requireAdmin, async (req, res) => {
  try {
    await ensureFinanceStorage();
    const days = dashboardRange(req.query.days);
    const bucket = days <= 30 ? "day" : days <= 90 ? "week" : "month";

    const [overviewResult, trendResult, statusResult, recentOrdersResult, recentMessagesResult, categoryResult] = await Promise.all([
      pool.query(`
        WITH bounds AS (
          SELECT CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day' AS current_start,
                 CURRENT_DATE - ($1::int * 2 - 1) * INTERVAL '1 day' AS previous_start
        )
        SELECT
          (SELECT COUNT(*) FROM orders, bounds WHERE deleted_at IS NULL AND created_at >= current_start) AS orders_current,
          (SELECT COUNT(*) FROM orders, bounds WHERE deleted_at IS NULL AND created_at >= previous_start AND created_at < current_start) AS orders_previous,
          (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND status NOT IN ('completed','cancelled')) AS pending_orders,
          (SELECT COUNT(*) FROM orders, bounds WHERE deleted_at IS NULL AND status='completed' AND created_at >= current_start) AS completed_current,
          (SELECT COUNT(*) FROM clients, bounds WHERE deleted_at IS NULL AND created_at >= current_start) AS clients_current,
          (SELECT COUNT(*) FROM clients, bounds WHERE deleted_at IS NULL AND created_at >= previous_start AND created_at < current_start) AS clients_previous,
          (SELECT COALESCE(SUM(amount),0) FROM finance_transactions, bounds WHERE type='income' AND transaction_date >= current_start::date) AS revenue_current,
          (SELECT COALESCE(SUM(amount),0) FROM finance_transactions, bounds WHERE type='income' AND transaction_date >= previous_start::date AND transaction_date < current_start::date) AS revenue_previous,
          (SELECT COALESCE(SUM(amount),0) FROM finance_transactions, bounds WHERE type='expense' AND transaction_date >= current_start::date) AS expenses_current,
          (SELECT COALESCE(SUM(amount),0) FROM finance_transactions, bounds WHERE type='expense' AND transaction_date >= previous_start::date AND transaction_date < current_start::date) AS expenses_previous,
          (SELECT COUNT(*) FROM messages WHERE is_read=false) AS unread_messages,
          (SELECT COUNT(*) FROM inventory WHERE quantity <= low_stock_threshold) AS low_stock_items,
          (SELECT COUNT(*) FROM invoices WHERE deleted_at IS NULL AND status IN ('pending','issued','partial','overdue')) AS unpaid_invoices,
          (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE approved=true) AS average_rating
      `, [days]),
      pool.query(`
        WITH series AS (
          SELECT generate_series(
            date_trunc('${bucket}', CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'),
            date_trunc('${bucket}', CURRENT_DATE),
            INTERVAL '1 ${bucket}'
          ) AS bucket
        ), finance AS (
          SELECT date_trunc('${bucket}', transaction_date)::timestamp AS bucket,
            COALESCE(SUM(amount) FILTER (WHERE type='income'),0) AS revenue,
            COALESCE(SUM(amount) FILTER (WHERE type='expense'),0) AS expenses
          FROM finance_transactions
          WHERE transaction_date >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
          GROUP BY 1
        ), order_counts AS (
          SELECT date_trunc('${bucket}', created_at)::timestamp AS bucket, COUNT(*) AS orders
          FROM orders
          WHERE deleted_at IS NULL AND created_at >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
          GROUP BY 1
        )
        SELECT series.bucket, COALESCE(finance.revenue,0) AS revenue,
          COALESCE(finance.expenses,0) AS expenses, COALESCE(order_counts.orders,0) AS orders
        FROM series LEFT JOIN finance USING(bucket) LEFT JOIN order_counts USING(bucket)
        ORDER BY series.bucket
      `, [days]),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM orders WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC`),
      pool.query(`SELECT id,order_id,customer_name,status,due_date,created_at FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 6`),
      pool.query(`SELECT id,full_name,subject,is_read,created_at FROM messages ORDER BY created_at DESC LIMIT 5`),
      pool.query(`
        SELECT category, COALESCE(SUM(amount),0) AS total
        FROM finance_transactions
        WHERE type='income' AND transaction_date >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
        GROUP BY category ORDER BY total DESC LIMIT 5
      `, [days]),
    ]);

    const row = overviewResult.rows[0] || {};
    const revenue = Number(row.revenue_current || 0);
    const expenses = Number(row.expenses_current || 0);
    const previousRevenue = Number(row.revenue_previous || 0);
    const previousExpenses = Number(row.expenses_previous || 0);
    const orders = Number(row.orders_current || 0);
    const previousOrders = Number(row.orders_previous || 0);
    const clients = Number(row.clients_current || 0);
    const previousClients = Number(row.clients_previous || 0);

    res.setHeader("Cache-Control", "private, max-age=20, stale-while-revalidate=40");
    return res.json({
      rangeDays: days,
      generatedAt: new Date().toISOString(),
      overview: {
        revenue, expenses, profit: revenue - expenses, orders, clients,
        pendingOrders: Number(row.pending_orders || 0),
        completedOrders: Number(row.completed_current || 0),
        unreadMessages: Number(row.unread_messages || 0),
        lowStockItems: Number(row.low_stock_items || 0),
        unpaidInvoices: Number(row.unpaid_invoices || 0),
        averageRating: Math.round(Number(row.average_rating || 0) * 10) / 10,
      },
      changes: {
        revenue: percentageChange(revenue, previousRevenue),
        expenses: percentageChange(expenses, previousExpenses),
        profit: percentageChange(revenue - expenses, previousRevenue - previousExpenses),
        orders: percentageChange(orders, previousOrders),
        clients: percentageChange(clients, previousClients),
      },
      trend: trendResult.rows.map(item => ({
        date: item.bucket, revenue: Number(item.revenue || 0),
        expenses: Number(item.expenses || 0), orders: Number(item.orders || 0),
      })),
      orderStatuses: statusResult.rows.map(item => ({ status: item.status, count: Number(item.count) })),
      recentOrders: recentOrdersResult.rows.map(item => ({
        id: item.id, orderId: item.order_id, customerName: item.customer_name,
        status: item.status, dueDate: item.due_date, createdAt: item.created_at,
      })),
      recentMessages: recentMessagesResult.rows.map(item => ({
        id: item.id, fullName: item.full_name, subject: item.subject,
        isRead: item.is_read, createdAt: item.created_at,
      })),
      revenueCategories: categoryResult.rows.map(item => ({ category: item.category, total: Number(item.total || 0) })),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to load dashboard analytics" });
  }
});

// GET /stats — admin dashboard stats (single combined query, no N+1)
router.get("/", requireAdmin, async (req, res) => {
  try {
    // One combined query replaces 9 sequential awaits
    const { rows } = await pool.query<{
      total_orders:     string;
      pending_orders:   string;
      completed_orders: string;
      total_messages:   string;
      unread_messages:  string;
      low_stock_items:  string;
      total_clients:    string;
      total_reviews:    string;
      avg_rating:       string | null;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM orders       WHERE deleted_at IS NULL)                                          AS total_orders,
        (SELECT COUNT(*) FROM orders       WHERE deleted_at IS NULL AND status NOT IN ('completed','cancelled')) AS pending_orders,
        (SELECT COUNT(*) FROM orders       WHERE deleted_at IS NULL AND status = 'completed')                  AS completed_orders,
        (SELECT COUNT(*) FROM messages)                                                                       AS total_messages,
        (SELECT COUNT(*) FROM messages     WHERE is_read = false)                                             AS unread_messages,
        (SELECT COUNT(*) FROM inventory    WHERE quantity <= low_stock_threshold)                             AS low_stock_items,
        (SELECT COUNT(*) FROM clients      WHERE deleted_at IS NULL AND approved = true)                      AS total_clients,
        (SELECT COUNT(*) FROM reviews)                                                                        AS total_reviews,
        (SELECT AVG(rating) FROM reviews   WHERE approved = true)                                             AS avg_rating
    `);

    // Fetch settings separately (only needed for starRating fallback) in parallel is fine
    // since the combined query already covers everything else
    const [settings] = await db.select({
      starRating:          settingsTable.starRating,
      happyClientsPercent: settingsTable.happyClientsPercent,
    }).from(settingsTable);

    const r = rows[0];
    const avgRating = r.avg_rating !== null
      ? Math.round(Number(r.avg_rating) * 10) / 10
      : (settings?.starRating ?? 5.0);

    res.json({
      happyClients:    Number(r.total_clients),
      productTypes:    0, // not displayed on dashboard; keep field for compatibility
      ordersDelivered: Number(r.completed_orders),
      starRating:      avgRating,
      totalOrders:     Number(r.total_orders),
      pendingOrders:   Number(r.pending_orders),
      completedOrders: Number(r.completed_orders),
      totalReviews:    Number(r.total_reviews),
      totalMessages:   Number(r.total_messages),
      unreadMessages:  Number(r.unread_messages),
      lowStockItems:   Number(r.low_stock_items),
      happyClientsPercent: Number(settings?.happyClientsPercent ?? 99),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/* ─── Public: safe stats for homepage (no auth required) ─────────────────── */
router.get("/public", async (req, res) => {
  try {
    const [activeProducts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .where(eq(productsTable.active, true));

    const [activeServices] = await db
      .select({ count: sql<number>`count(*)` })
      .from(servicesTable)
      .where(eq(servicesTable.active, true));

    const [completedOrders] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ordersTable)
      .where(and(eq(ordersTable.status, "completed"), isNull(ordersTable.deletedAt)));

    const [settings] = await db.select({
      ordersCompletedCount: settingsTable.ordersCompletedCount,
      happyClientsPercent:  settingsTable.happyClientsPercent,
      starRating:           settingsTable.starRating,
    }).from(settingsTable);

    res.json({
      productTypes:           Number(activeProducts.count) + Number(activeServices.count),
      ordersDelivered:        Number(completedOrders.count),
      ordersDeliveredDefault: Number(settings?.ordersCompletedCount ?? 0),
      happyClientsPercent:    Number(settings?.happyClientsPercent ?? 99),
      starRating:             Number(settings?.starRating ?? 4.9),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch public stats" });
  }
});

export default router;
