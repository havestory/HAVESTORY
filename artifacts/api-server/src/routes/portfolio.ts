import { Router } from "express";
import { db } from "@workspace/db";
import { portfolioTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

function parseArr(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

router.get("/", async (req, res) => {
  try {
    const { featured, category } = req.query;
    const conditions: any[] = [];
    if (featured !== undefined) conditions.push(eq(portfolioTable.featured, featured === "true"));
    if (category) conditions.push(eq(portfolioTable.category, category as string));
    const items = await db.select().from(portfolioTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(portfolioTable.createdAt);
    res.json(items.map(i => ({ ...i, galleryImages: parseArr(i.galleryImages), tags: parseArr(i.tags) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { title, category, clientName, description = "", imageUrl, galleryImages = [], tags = [], featured = false, completedAt } = req.body;
    const [item] = await db.insert(portfolioTable).values({
      title, category, clientName, description, imageUrl,
      galleryImages: JSON.stringify(galleryImages), tags: JSON.stringify(tags), featured, completedAt,
    }).returning();
    res.status(201).json({ ...item, galleryImages: parseArr(item.galleryImages), tags: parseArr(item.tags) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create portfolio item" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { title, category, clientName, description, imageUrl, galleryImages, tags, featured, completedAt } = req.body;
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (galleryImages !== undefined) updateData.galleryImages = JSON.stringify(galleryImages);
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (featured !== undefined) updateData.featured = featured;
    if (completedAt !== undefined) updateData.completedAt = completedAt;
    const [item] = await db.update(portfolioTable).set(updateData).where(eq(portfolioTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Portfolio item not found" });
    res.json({ ...item, galleryImages: parseArr(item.galleryImages), tags: parseArr(item.tags) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update portfolio item" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(portfolioTable).where(eq(portfolioTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete portfolio item" });
  }
});

export default router;
