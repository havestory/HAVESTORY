import { Router } from "express";
import { pool, db } from "@workspace/db";
import { couponsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin, requireOwner } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

/* ─── Public: validate a coupon code ──────────────────────────────────────── */
router.post("/validate", async (req, res) => {
  try {
    const { code, orderTotal = 0 } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: "No code provided" });

    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code.toUpperCase().trim()));

    if (!coupon) return res.json({ valid: false, message: "Invalid coupon code" });
    if (!coupon.isActive) return res.json({ valid: false, message: "This coupon is no longer active" });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return res.json({ valid: false, message: "This coupon has expired" });
    if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) return res.json({ valid: false, message: "This coupon has reached its usage limit" });
    if (coupon.minOrder && orderTotal < coupon.minOrder) return res.json({ valid: false, message: `Minimum order of Rs. ${coupon.minOrder.toLocaleString("en-IN")} required` });

    const discount = coupon.type === "percentage"
      ? Math.round(orderTotal * coupon.value / 100)
      : Math.min(coupon.value, orderTotal);

    res.json({ valid: true, id: coupon.id, discount, type: coupon.type, value: coupon.value, code: coupon.code });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ valid: false, message: "Failed to validate coupon" });
  }
});

/* ─── Admin: list all coupons ─────────────────────────────────────────────── */
router.get("/", requireOwner, async (req, res) => {
  try {
    const coupons = await db.select().from(couponsTable).orderBy(couponsTable.createdAt);
    res.json(coupons);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

/* ─── Admin: create coupon ────────────────────────────────────────────────── */
router.post("/", requireOwner, async (req, res) => {
  try {
    const { code, type, value, minOrder, maxUses, expiresAt } = req.body;
    if (!code || !type || value === undefined) return res.status(400).json({ error: "code, type, and value are required" });
    const [coupon] = await db.insert(couponsTable).values({
      code: code.toUpperCase().trim(),
      type,
      value: parseFloat(value),
      minOrder: minOrder ? parseFloat(minOrder) : null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.status(201).json(coupon);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "A coupon with this code already exists" });
    req.log.error(err);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

/* ─── Admin: toggle active / update fields ───────────────────────────────── */
router.patch("/:id", requireOwner, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { code, type, value, minOrder, maxUses, expiresAt, isActive } = req.body;
    const updateData: any = {};
    if (code !== undefined) updateData.code = String(code).toUpperCase().trim();
    if (type !== undefined) updateData.type = type;
    if (value !== undefined) updateData.value = parseFloat(value);
    if (minOrder !== undefined) updateData.minOrder = minOrder ? parseFloat(minOrder) : null;
    if (maxUses !== undefined) updateData.maxUses = maxUses ? parseInt(maxUses) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = isActive ? 1 : 0;
    const [coupon] = await db.update(couponsTable).set(updateData).where(eq(couponsTable.id, id)).returning();
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    res.json(coupon);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "A coupon with this code already exists" });
    req.log.error(err);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

/* ─── Admin: increment used count (called when order placed) ─────────────── */
router.post("/:id/use", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const [coupon] = await db.update(couponsTable).set({ usedCount: sql`${couponsTable.usedCount} + 1` }).where(eq(couponsTable.id, id)).returning();
    res.json(coupon);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to record coupon use" });
  }
});

/* ─── Admin: delete coupon ────────────────────────────────────────────────── */
router.delete("/:id", requireOwner, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(couponsTable).where(eq(couponsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});

export default router;
