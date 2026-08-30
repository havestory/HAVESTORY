import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder);
    res.setHeader("Cache-Control", getAdminAuth(req) ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300");
    res.json(categories);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, description = "", imageUrl, sortOrder = 0 } = req.body;
    const [cat] = await db.insert(categoriesTable).values({ name, description, imageUrl, sortOrder }).returning();
    res.status(201).json(cat);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { name, description, imageUrl, sortOrder } = req.body;
    const [cat] = await db.update(categoriesTable).set({ name, description, imageUrl, sortOrder }).where(eq(categoriesTable.id, id)).returning();
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json(cat);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
