import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

router.get("/", async (req, res) => {
  try {
    const auth = getAdminAuth(req);
    const { approved, featured } = req.query;
    const limit = parseLimit(req.query.limit, auth ? 100 : 30, auth ? 200 : 60);

    if (!auth) {
      const conditions = [eq(reviewsTable.approved, true)];
      if (featured !== undefined) conditions.push(eq(reviewsTable.featured, featured === "true"));

      const reviews = await db
        .select({
          id: reviewsTable.id,
          customerName: reviewsTable.customerName,
          rating: reviewsTable.rating,
          comment: reviewsTable.comment,
          photoUrl: reviewsTable.photoUrl,
          featured: reviewsTable.featured,
          createdAt: reviewsTable.createdAt,
        })
        .from(reviewsTable)
        .where(and(...conditions))
        .orderBy(desc(reviewsTable.createdAt))
        .limit(limit);

      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res.json(reviews);
    }

    const conditions: any[] = [];
    if (approved !== undefined) conditions.push(eq(reviewsTable.approved, approved === "true"));
    if (featured !== undefined) conditions.push(eq(reviewsTable.featured, featured === "true"));

    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(reviewsTable.createdAt))
      .limit(limit);

    res.setHeader("Cache-Control", "private, no-store");
    res.json(reviews);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { customerName, rating, comment, photoUrl } = req.body;
    const safeName = String(customerName || "").trim().slice(0, 120);
    const safeComment = String(comment || "").trim().slice(0, 2000);
    const safeRating = Number.parseInt(String(rating), 10);
    if (!safeName || !safeComment || !Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
      return res.status(400).json({ error: "Name, a 1–5 rating and review text are required." });
    }
    const [review] = await db.insert(reviewsTable).values({
      customerName: safeName,
      rating: safeRating,
      comment: safeComment,
      photoUrl: /^https?:\/\//i.test(String(photoUrl || "")) ? String(photoUrl).slice(0, 1000) : null,
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
