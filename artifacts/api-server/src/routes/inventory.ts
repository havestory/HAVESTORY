import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getAdminAuth, hasPermission, requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

// Inventory is admin-only.
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(inventoryTable).orderBy(inventoryTable.name);
    const canSeeCosts = hasPermission(getAdminAuth(req), "finance");
    res.json(canSeeCosts ? items : items.map(({ cost, supplier, ...item }) => item));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, quantity = 0, unit = "units", lowStockThreshold = 10, cost, supplier } = req.body;
    const canEditCosts = hasPermission(getAdminAuth(req), "finance");
    const [item] = await db.insert(inventoryTable).values({ name, description, quantity, unit, lowStockThreshold, cost: canEditCosts ? cost : null, supplier: canEditCosts ? supplier : null }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { name, description, quantity, unit, lowStockThreshold, cost, supplier } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (unit !== undefined) updateData.unit = unit;
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (hasPermission(getAdminAuth(req), "finance")) {
      if (cost !== undefined) updateData.cost = cost;
      if (supplier !== undefined) updateData.supplier = supplier;
    }
    const [item] = await db.update(inventoryTable).set(updateData).where(eq(inventoryTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Item not found" });
    const canSeeCosts = hasPermission(getAdminAuth(req), "finance");
    if (canSeeCosts) res.json(item);
    else { const { cost: _cost, supplier: _supplier, ...safeItem } = item; res.json(safeItem); }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
