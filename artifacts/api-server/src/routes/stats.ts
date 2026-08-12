import { Router } from "express";
import { pool, db } from "@workspace/db";
import {
  productsTable, servicesTable, ordersTable, settingsTable
} from "@workspace/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";

const router = Router();

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
