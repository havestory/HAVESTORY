import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth-cookie";

const router = Router();
router.use(requireAdmin);
router.use((_req, res, next) => { res.set("Cache-Control", "no-store, no-cache, must-revalidate"); next(); });

const monthValue = (value: unknown) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || "")) ? String(value) : new Date().toISOString().slice(0, 7);
const positiveNumber = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; };
const positiveInteger = (value: unknown) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; };
const text = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);

async function ensureStorage() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    INSERT INTO finance_settings (id, initial_balance) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS finance_transactions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
      project_id TEXT,
      invoice_id TEXT,
      inventory_item_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
      inventory_quantity INTEGER,
      unit_cost NUMERIC(14,4),
      pack_count INTEGER,
      units_per_pack INTEGER,
      cost_breakdown JSONB,
      inventory_usage_quantity INTEGER,
      source TEXT,
      source_ref TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS pack_count INTEGER;
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS units_per_pack INTEGER;
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS cost_breakdown JSONB;
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS inventory_usage_quantity INTEGER;
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS source TEXT;
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS source_ref TEXT;

    CREATE TABLE IF NOT EXISTS production_cost_values (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'printing',
      unit TEXT NOT NULL DEFAULT 'sheet',
      unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoice_material_usage (
      id SERIAL PRIMARY KEY,
      invoice_row_id TEXT NOT NULL,
      invoice_number TEXT,
      line_item_id TEXT NOT NULL,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
      used_quantity INTEGER NOT NULL DEFAULT 0 CHECK (used_quantity >= 0),
      waste_quantity INTEGER NOT NULL DEFAULT 0 CHECK (waste_quantity >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(invoice_row_id, line_item_id, inventory_item_id)
    );

    CREATE TABLE IF NOT EXISTS material_waste (
      id SERIAL PRIMARY KEY,
      project_id TEXT,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      note TEXT,
      waste_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS finance_transactions_date_idx ON finance_transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS production_cost_values_category_idx ON production_cost_values(category);
    CREATE INDEX IF NOT EXISTS finance_transactions_project_idx ON finance_transactions(project_id);
    CREATE INDEX IF NOT EXISTS finance_transactions_invoice_idx ON finance_transactions(invoice_id);
    CREATE UNIQUE INDEX IF NOT EXISTS finance_transactions_source_ref_uidx ON finance_transactions(source, source_ref) WHERE source IS NOT NULL AND source_ref IS NOT NULL;
    CREATE INDEX IF NOT EXISTS invoice_material_usage_invoice_idx ON invoice_material_usage(invoice_row_id);
    CREATE INDEX IF NOT EXISTS material_waste_date_idx ON material_waste(waste_date);
    CREATE INDEX IF NOT EXISTS material_waste_project_idx ON material_waste(project_id);
  `);
}

export async function syncInvoiceFinance(invoice: any) {
  await ensureStorage();
  const invoiceId = String(invoice?.id || "").trim();
  const invoiceNumber = text(invoice?.invoiceNumber, 80);
  const total = Math.max(0, Number(String(invoice?.amount || 0).replace(/[^0-9.-]/g, "")) || 0);
  const status = String(invoice?.status || "").toLowerCase();
  let metadata: any = {};
  try {
    metadata = typeof invoice?.metadata === "string" ? JSON.parse(invoice.metadata) : (invoice?.metadata || {});
  } catch {}
  let received = status === "paid" ? total : 0;
  if (status === "partial") {
    const advance = Math.max(0, Number(String(metadata?.advance || 0).replace(/[^0-9.-]/g, "")) || 0);
    received = Math.min(advance, total);
  }
  const requestedPaymentDate = String(metadata?.paymentReceivedDate || "").trim();
  const paymentDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedPaymentDate)
    ? requestedPaymentDate
    : new Date().toISOString().slice(0, 10);
  if (!invoiceId || received <= 0 || status === "cancelled") {
    if (invoiceId) await pool.query("DELETE FROM finance_transactions WHERE source='invoice_payment' AND source_ref=$1", [invoiceId]);
    return;
  }
  const description = `Invoice payment · ${invoiceNumber || invoiceId} · ${text(invoice?.clientName, 120) || "Customer"}`;
  await pool.query(`INSERT INTO finance_transactions(type,category,description,amount,transaction_date,invoice_id,source,source_ref)
    VALUES('income','sales',$1,$2,$3,$4,'invoice_payment',$5)
    ON CONFLICT (source,source_ref) WHERE source IS NOT NULL AND source_ref IS NOT NULL
    DO UPDATE SET amount=EXCLUDED.amount,description=EXCLUDED.description,invoice_id=EXCLUDED.invoice_id,
      transaction_date=EXCLUDED.transaction_date`,
    [description, received, paymentDate, invoiceNumber || null, invoiceId]);
}

export async function syncInvoiceMaterialUsage(invoice: any) {
  await ensureStorage();
  const invoiceRowId = String(invoice?.id || "").trim();
  if (!invoiceRowId) return;
  let items: any[] = [];
  try {
    const metadata = typeof invoice?.metadata === "string" ? JSON.parse(invoice.metadata) : invoice?.metadata;
    items = Array.isArray(metadata?.items) ? metadata.items : [];
  } catch { items = []; }
  const requested = items.flatMap((item: any) => {
    if (!item?.deductStock || !Array.isArray(item?.costComponents)) return [];
    return item.costComponents.filter((component: any) => component?.type === "inventory").map((component: any) => ({
      lineItemId: text(item.id, 120),
      inventoryItemId: positiveInteger(component.refId),
      usedQuantity: Math.max(0, Math.trunc(Number(component.quantity) || 0)),
      wasteQuantity: Math.max(0, Math.trunc(Number(component.wasteQuantity) || 0)),
    })).filter((row: any) => row.lineItemId && row.inventoryItemId && row.usedQuantity + row.wasteQuantity > 0);
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query("SELECT inventory_item_id, used_quantity, waste_quantity FROM invoice_material_usage WHERE invoice_row_id=$1 FOR UPDATE", [invoiceRowId]);
    for (const row of previous.rows) {
      await client.query("UPDATE inventory SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2", [Number(row.used_quantity) + Number(row.waste_quantity), row.inventory_item_id]);
    }
    await client.query("DELETE FROM invoice_material_usage WHERE invoice_row_id=$1", [invoiceRowId]);
    for (const row of requested) {
      const total = row.usedQuantity + row.wasteQuantity;
      const deducted = await client.query("UPDATE inventory SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2 AND quantity >= $1 RETURNING id", [total, row.inventoryItemId]);
      if (!deducted.rows[0]) throw new Error("Not enough inventory stock for invoice material usage");
      await client.query(`INSERT INTO invoice_material_usage(invoice_row_id,invoice_number,line_item_id,inventory_item_id,used_quantity,waste_quantity)
        VALUES($1,$2,$3,$4,$5,$6)`, [invoiceRowId, text(invoice?.invoiceNumber,80)||null, row.lineItemId, row.inventoryItemId, row.usedQuantity, row.wasteQuantity]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function removeInvoiceMaterialUsage(invoiceId: number | string) {
  await ensureStorage();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query("DELETE FROM invoice_material_usage WHERE invoice_row_id=$1 RETURNING inventory_item_id,used_quantity,waste_quantity", [String(invoiceId)]);
    for (const row of previous.rows) {
      await client.query("UPDATE inventory SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2", [Number(row.used_quantity) + Number(row.waste_quantity), row.inventory_item_id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function removeInvoiceFinance(invoiceId: number | string) {
  await ensureStorage();
  await pool.query("DELETE FROM finance_transactions WHERE source='invoice_payment' AND source_ref=$1", [String(invoiceId)]);
}

router.get("/summary", async (req, res) => {
  try {
    await ensureStorage();
    const month = monthValue(req.query.month);
    const [settings, totals, monthTotals, stock, lowStock] = await Promise.all([
      pool.query("SELECT initial_balance FROM finance_settings WHERE id = 1"),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) AS movement
        FROM finance_transactions
        WHERE transaction_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'`, [month]),
      pool.query(`SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
        FROM finance_transactions
        WHERE transaction_date >= to_date($1 || '-01','YYYY-MM-DD')
          AND transaction_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'`, [month]),
      pool.query("SELECT COALESCE(SUM(quantity * CASE WHEN COALESCE(cost,'') ~ '^[0-9]+([.][0-9]+)?$' THEN cost::numeric ELSE 0 END),0) AS value FROM inventory"),
      pool.query("SELECT COUNT(*)::int AS count FROM inventory WHERE quantity <= low_stock_threshold"),
    ]);
    const initialBalance = Number(settings.rows[0]?.initial_balance || 0);
    const movement = Number(totals.rows[0]?.movement || 0);
    const income = Number(monthTotals.rows[0]?.income || 0);
    const expenses = Number(monthTotals.rows[0]?.expenses || 0);
    return res.json({ month, initialBalance, currentBalance: initialBalance + movement, income, expenses, netProfit: income - expenses, inventoryValue: Number(stock.rows[0]?.value || 0), lowStockItems: Number(lowStock.rows[0]?.count || 0) });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load finance summary" });
  }
});

router.put("/initial-balance", async (req, res) => {
  try {
    await ensureStorage();
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount)) return res.status(400).json({ error: "Enter a valid initial balance" });
    const { rows } = await pool.query("UPDATE finance_settings SET initial_balance=$1, updated_at=NOW() WHERE id=1 RETURNING initial_balance", [amount]);
    return res.json({ initialBalance: Number(rows[0].initial_balance) });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to update initial balance" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    await ensureStorage();
    const month = monthValue(req.query.month);
    const { rows } = await pool.query(`SELECT t.*, i.name AS inventory_name
      FROM finance_transactions t LEFT JOIN inventory i ON i.id=t.inventory_item_id
      WHERE t.transaction_date >= to_date($1 || '-01','YYYY-MM-DD')
        AND t.transaction_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'
      ORDER BY t.transaction_date DESC, t.id DESC`, [month]);
    return res.json(rows);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load transactions" });
  }
});

router.post("/transactions", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStorage();
    const type = req.body?.type === "income" ? "income" : req.body?.type === "expense" ? "expense" : "";
    const amount = positiveNumber(req.body?.amount);
    const category = text(req.body?.category, 80);
    const description = text(req.body?.description, 300);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.transactionDate || "")) ? req.body.transactionDate : new Date().toISOString().slice(0, 10);
    if (!type || !amount || !category || !description) return res.status(400).json({ error: "Type, category, description and a positive amount are required" });

    const inventoryItemId = category === "material_purchase" ? positiveInteger(req.body?.inventoryItemId) : null;
    const packCount = category === "material_purchase" ? positiveInteger(req.body?.packCount) : null;
    const unitsPerPack = category === "material_purchase" ? positiveInteger(req.body?.unitsPerPack) : null;
    const directQuantity = category === "material_purchase" ? positiveInteger(req.body?.inventoryQuantity) : null;
    const inventoryQuantity = packCount && unitsPerPack ? packCount * unitsPerPack : directQuantity;
    if (category === "material_purchase" && (type !== "expense" || !inventoryItemId || !inventoryQuantity)) {
      return res.status(400).json({ error: "Material purchases require an expense, inventory item and quantity" });
    }

    const usageItemId = category === "project_cost" ? positiveInteger(req.body?.usageItemId) : null;
    const usageQuantity = category === "project_cost" ? positiveInteger(req.body?.usageQuantity) : null;
    const costItems = Array.isArray(req.body?.costItems) ? req.body.costItems.slice(0, 30).map((item: any) => ({ id: positiveInteger(item?.id), quantity: positiveNumber(item?.quantity) })).filter((item: any) => item.id && item.quantity) : [];
    await client.query("BEGIN");
    if (usageItemId && usageQuantity) {
      const consumed = await client.query("UPDATE inventory SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2 AND quantity >= $1 RETURNING id", [usageQuantity, usageItemId]);
      if (!consumed.rows[0]) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Not enough raw material stock for this project cost" }); }
    }
    const unitCost = inventoryQuantity ? amount / inventoryQuantity : null;
    const costBreakdown = category === "project_cost" ? { material: usageItemId && usageQuantity ? { inventoryItemId: usageItemId, quantity: usageQuantity } : null, costItems } : null;
    if (inventoryItemId && inventoryQuantity) {
      const updated = await client.query("UPDATE inventory SET quantity=quantity+$1, cost=$2, updated_at=NOW() WHERE id=$3 RETURNING id", [inventoryQuantity, unitCost?.toFixed(4), inventoryItemId]);
      if (!updated.rows[0]) throw new Error("Inventory item not found");
    }
    const { rows } = await client.query(`INSERT INTO finance_transactions
      (type,category,description,amount,transaction_date,project_id,invoice_id,inventory_item_id,inventory_quantity,unit_cost,pack_count,units_per_pack,cost_breakdown,inventory_usage_quantity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [
      type, category, description, amount, date, text(req.body?.projectId, 80) || null, text(req.body?.invoiceId, 80) || null,
      inventoryItemId || usageItemId, inventoryQuantity, unitCost, packCount, unitsPerPack, costBreakdown ? JSON.stringify(costBreakdown) : null, usageQuantity,
    ]);
    await client.query("COMMIT");
    return res.status(201).json(rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    return res.status(error.message === "Inventory item not found" ? 404 : 500).json({ error: error.message || "Unable to save transaction" });
  } finally {
    client.release();
  }
});

router.delete("/transactions/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStorage();
    const id = positiveInteger(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid transaction ID" });
    await client.query("BEGIN");
    const found = await client.query("SELECT * FROM finance_transactions WHERE id=$1 FOR UPDATE", [id]);
    if (!found.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Transaction not found" }); }
    const row = found.rows[0];
    let forcedUsedPurchase = false;
    if (row.category === "material_purchase" && row.inventory_item_id && row.inventory_quantity) {
      const reversed = await client.query("UPDATE inventory SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2 AND quantity >= $1 RETURNING id", [row.inventory_quantity, row.inventory_item_id]);
      if (!reversed.rows[0]) {
        const force = String(req.query.force || "") === "1";
        if (!force) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Cannot delete purchase because some of that stock has already been used",
            code: "PURCHASE_STOCK_ALREADY_USED",
            canForceDelete: true,
          });
        }
        // Stock is not lot-tracked, so after consumption we cannot safely
        // identify which remaining sheets belong to this purchase. Forced
        // deletion removes the accounting purchase only and deliberately
        // leaves current physical stock unchanged.
        forcedUsedPurchase = true;
      }
    }
    if (row.category === "project_cost" && row.inventory_item_id && row.inventory_usage_quantity) {
      await client.query("UPDATE inventory SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2", [row.inventory_usage_quantity, row.inventory_item_id]);
    }
    await client.query("DELETE FROM finance_transactions WHERE id=$1", [id]);
    await client.query("COMMIT");
    return res.json({ success: true, forcedUsedPurchase });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    return res.status(500).json({ error: "Unable to delete transaction" });
  } finally {
    client.release();
  }
});

router.get("/waste", async (req, res) => {
  try {
    await ensureStorage();
    const month = monthValue(req.query.month);
    const { rows } = await pool.query(`SELECT w.*, i.name AS inventory_name, i.unit
      FROM material_waste w JOIN inventory i ON i.id=w.inventory_item_id
      WHERE w.waste_date >= to_date($1 || '-01','YYYY-MM-DD')
        AND w.waste_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'
      ORDER BY w.waste_date DESC, w.id DESC`, [month]);
    return res.json(rows);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load waste records" });
  }
});

router.post("/waste", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStorage();
    const inventoryItemId = positiveInteger(req.body?.inventoryItemId);
    const quantity = positiveInteger(req.body?.quantity);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.wasteDate || "")) ? req.body.wasteDate : new Date().toISOString().slice(0, 10);
    if (!inventoryItemId || !quantity) return res.status(400).json({ error: "Inventory item and waste quantity are required" });
    await client.query("BEGIN");
    const stock = await client.query("UPDATE inventory SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2 AND quantity >= $1 RETURNING id", [quantity, inventoryItemId]);
    if (!stock.rows[0]) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Not enough inventory stock for this waste quantity" }); }
    const { rows } = await client.query(`INSERT INTO material_waste(project_id,inventory_item_id,quantity,note,waste_date)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [text(req.body?.projectId, 80) || null, inventoryItemId, quantity, text(req.body?.note, 300) || null, date]);
    await client.query("COMMIT");
    return res.status(201).json(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    return res.status(500).json({ error: "Unable to save waste record" });
  } finally {
    client.release();
  }
});

router.delete("/waste/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStorage();
    const id = positiveInteger(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid waste record ID" });
    await client.query("BEGIN");
    const found = await client.query("DELETE FROM material_waste WHERE id=$1 RETURNING *", [id]);
    if (!found.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Waste record not found" }); }
    await client.query("UPDATE inventory SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2", [found.rows[0].quantity, found.rows[0].inventory_item_id]);
    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    return res.status(500).json({ error: "Unable to delete waste record" });
  } finally {
    client.release();
  }
});


router.get("/cost-values", async (req, res) => {
  try {
    await ensureStorage();
    const { rows } = await pool.query("SELECT * FROM production_cost_values ORDER BY category, name");
    return res.json(rows);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to load production cost values" });
  }
});

router.post("/cost-values", async (req, res) => {
  try {
    await ensureStorage();
    const name = text(req.body?.name, 120);
    const category = text(req.body?.category, 60) || "printing";
    const unit = text(req.body?.unit, 40) || "sheet";
    const unitCost = Number(req.body?.unitCost);
    if (!name || !Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: "Name and a valid unit cost are required" });
    const { rows } = await pool.query(`INSERT INTO production_cost_values(name,category,unit,unit_cost,notes)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [name, category, unit, unitCost, text(req.body?.notes, 300) || null]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to save production cost value" });
  }
});

router.put("/cost-values/:id", async (req, res) => {
  try {
    await ensureStorage();
    const id = positiveInteger(req.params.id);
    const name = text(req.body?.name, 120);
    const unitCost = Number(req.body?.unitCost);
    if (!id || !name || !Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: "Valid cost value details are required" });
    const { rows } = await pool.query(`UPDATE production_cost_values SET name=$1,category=$2,unit=$3,unit_cost=$4,notes=$5,updated_at=NOW()
      WHERE id=$6 RETURNING *`, [name, text(req.body?.category,60)||"printing", text(req.body?.unit,40)||"sheet", unitCost, text(req.body?.notes,300)||null, id]);
    if (!rows[0]) return res.status(404).json({ error: "Cost value not found" });
    return res.json(rows[0]);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to update production cost value" });
  }
});

router.delete("/cost-values/:id", async (req, res) => {
  try {
    await ensureStorage();
    const id = positiveInteger(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid cost value ID" });
    const result = await pool.query("DELETE FROM production_cost_values WHERE id=$1", [id]);
    if (!result.rowCount) return res.status(404).json({ error: "Cost value not found" });
    return res.json({ success: true });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Unable to delete production cost value" });
  }
});

export default router;
