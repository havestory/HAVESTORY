import { Router } from "express";
import { requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";
import { db } from "@workspace/db";
import { projectServiceTypesTable, ordersTable, crmProjectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const types = await db.select().from(projectServiceTypesTable).orderBy(projectServiceTypesTable.sortOrder);
    res.json(types);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch project service types" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, sortOrder = 0 } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
    const [type] = await db.insert(projectServiceTypesTable).values({ name: String(name).trim(), sortOrder: Number(sortOrder) || 0 }).returning();
    res.status(201).json(type);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create project service type" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { name, sortOrder } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder) || 0;
    const [type] = await db.update(projectServiceTypesTable).set(updateData).where(eq(projectServiceTypesTable.id, id)).returning();
    if (!type) return res.status(404).json({ error: "Project service type not found" });
    res.json(type);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update project service type" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    // Clear references on orders and CRM projects before deleting
    await db.update(ordersTable).set({ serviceTypeId: null as any }).where(eq(ordersTable.serviceTypeId as any, id));
    try {
      await db.update(crmProjectsTable).set({ serviceTypeId: null as any }).where(eq(crmProjectsTable.serviceTypeId as any, id));
    } catch {}
    await db.delete(projectServiceTypesTable).where(eq(projectServiceTypesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete project service type" });
  }
});

export default router;
