import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable, serviceCategoriesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

function parseHighlights(h: string): string[] {
  try { return JSON.parse(h); } catch { return []; }
}

router.get("/", async (req, res) => {
  try {
    const { featured } = req.query;
    const conditions: any[] = [eq(servicesTable.active, true)];
    if (featured !== undefined) conditions.push(eq(servicesTable.featured, featured === "true"));
    const services = await db.select().from(servicesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(servicesTable.sortOrder);
    const categories = await db.select().from(serviceCategoriesTable).orderBy(serviceCategoriesTable.sortOrder);
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    res.json(services.map(s => ({
      ...s,
      highlights: parseHighlights(s.highlights),
      categoryName: s.categoryId ? (catMap[s.categoryId] || null) : null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, description = "", price, priceType = "custom_quote", packageDetails, highlights = [], imageUrl, featured = false, active = true, sortOrder = 0, categoryId } = req.body;
    const [svc] = await db.insert(servicesTable).values({
      name, description, price, priceType, packageDetails,
      highlights: JSON.stringify(highlights), imageUrl, featured, active, sortOrder,
      categoryId: categoryId ? Number(categoryId) : null,
    }).returning();
    const categories = await db.select().from(serviceCategoriesTable);
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    res.status(201).json({ ...svc, highlights: parseHighlights(svc.highlights), categoryName: svc.categoryId ? (catMap[svc.categoryId] || null) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { name, description, price, priceType, packageDetails, highlights, imageUrl, featured, active, sortOrder, categoryId } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (priceType !== undefined) updateData.priceType = priceType;
    if (packageDetails !== undefined) updateData.packageDetails = packageDetails;
    if (highlights !== undefined) updateData.highlights = JSON.stringify(highlights);
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (featured !== undefined) updateData.featured = featured;
    if (active !== undefined) updateData.active = active;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (categoryId !== undefined) updateData.categoryId = categoryId ? Number(categoryId) : null;
    const [svc] = await db.update(servicesTable).set(updateData).where(eq(servicesTable.id, id)).returning();
    if (!svc) return res.status(404).json({ error: "Service not found" });
    const categories = await db.select().from(serviceCategoriesTable);
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    res.json({ ...svc, highlights: parseHighlights(svc.highlights), categoryName: svc.categoryId ? (catMap[svc.categoryId] || null) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(servicesTable).where(eq(servicesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

export default router;
