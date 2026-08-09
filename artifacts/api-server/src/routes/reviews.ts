import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { approved, featured, limit } = req.query;
    const conditions: any[] = [];
    if (approved !== undefined) conditions.push(eq(reviewsTable.approved, approved === "true"));
    if (featured !== undefined) conditions.push(eq(reviewsTable.featured, featured === "true"));
    let query: any = db.select().from(reviewsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(reviewsTable.createdAt));
    if (limit) query = query.limit(parseInt(limit as string));
    const reviews = await query;
    res.json(reviews);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { customerName, rating, comment, photoUrl } = req.body;
    const [review] = await db.insert(reviewsTable).values({
      customerName,
      rating: parseInt(rating),
      comment,
      photoUrl: photoUrl || null,
      approved: false,
      featured: false,
    }).returning();
    res.status(201).json(review);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { approved, featured } = req.body;
    const updateData: any = {};
    if (approved !== undefined) updateData.approved = approved;
    if (featured !== undefined) updateData.featured = featured;
    const [review] = await db.update(reviewsTable).set(updateData).where(eq(reviewsTable.id, id)).returning();
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
