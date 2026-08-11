import { Router } from "express";
import { db } from "@workspace/db";
import { serviceCategoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cats = await db.select().from(serviceCategoriesTable).orderBy(serviceCategoriesTable.sortOrder);
    res.json(cats);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch service categories" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, sortOrder = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const [cat] = await db.insert(serviceCategoriesTable).values({ name, sortOrder }).returning();
    res.status(201).json(cat);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create service category" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { name, sortOrder } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    const [cat] = await db.update(serviceCategoriesTable).set(updateData).where(eq(serviceCategoriesTable.id, id)).returning();
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json(cat);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update service category" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(serviceCategoriesTable).where(eq(serviceCategoriesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete service category" });
  }
});

export default router;
