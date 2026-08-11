import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, productsTable, servicesTable, ordersTable, reviewsTable, messagesTable, inventoryTable, settingsTable
} from "@workspace/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const [clients] = await db.select({ count: sql<number>`count(*)` }).from(clientsTable).where(and(eq(clientsTable.approved, true), isNull(clientsTable.deletedAt)));
    const [products] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.active, true));
    const [totalOrders] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(isNull(ordersTable.deletedAt));
    const [completedOrders] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(eq(ordersTable.status, "completed"), isNull(ordersTable.deletedAt)));
    const [pendingOrders] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable)
      .where(sql`status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL`);
    const [totalReviews] = await db.select({ count: sql<number>`count(*)` }).from(reviewsTable);
    const [totalMessages] = await db.select({ count: sql<number>`count(*)` }).from(messagesTable);
    const [unreadMessages] = await db.select({ count: sql<number>`count(*)` }).from(messagesTable).where(eq(messagesTable.isRead, false));
    const [lowStock] = await db.select({ count: sql<number>`count(*)` }).from(inventoryTable)
      .where(sql`quantity <= low_stock_threshold`);

    const [settings] = await db.select().from(settingsTable);

    const approvedReviews = await db.select().from(reviewsTable).where(eq(reviewsTable.approved, true));
    const avgRating = approvedReviews.length > 0
      ? approvedReviews.reduce((acc, r) => acc + r.rating, 0) / approvedReviews.length
      : (settings?.starRating ?? 5.0);

    res.json({
      happyClients: Number(clients.count),
      productTypes: Number(products.count),
      ordersDelivered: Number(completedOrders.count),
      starRating: Math.round(avgRating * 10) / 10,
      totalOrders: Number(totalOrders.count),
      pendingOrders: Number(pendingOrders.count),
      completedOrders: Number(completedOrders.count),
      totalReviews: Number(totalReviews.count),
      totalMessages: Number(totalMessages.count),
      unreadMessages: Number(unreadMessages.count),
      lowStockItems: Number(lowStock.count),
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

    const realProductTypes = Number(activeProducts.count) + Number(activeServices.count);
    const realOrdersDelivered = Number(completedOrders.count);

    res.json({
      productTypes:        realProductTypes,
      ordersDelivered:     realOrdersDelivered,
      // Admin-configured fallback/minimum display values
      ordersDeliveredDefault: Number(settings?.ordersCompletedCount ?? 0),
      happyClientsPercent: Number(settings?.happyClientsPercent ?? 99),
      starRating:          Number(settings?.starRating ?? 4.9),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch public stats" });
  }
});

export default router;
