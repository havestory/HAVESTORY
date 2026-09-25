import { randomBytes } from "node:crypto";
import { Router } from "express";
import { pool } from "@workspace/db";
import { getAdminAuth, requireAdmin, requireOwner, requirePermission } from "../lib/auth-cookie";

const router = Router();

type PriceListSection = {
  id: string;
  title: string;
  columns: string[];
  visibleColumns?: boolean[];
  rows: Array<{ id: string; cells: string[] }>;
};
type PremiumItem = { id: string; name: string; size: string; unitPrice: number; minQuantity: number };

function cleanPremiumItems(value: unknown): PremiumItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).map((raw: any, index) => ({
    id: String(raw?.id || `premium-${index + 1}`).slice(0, 80),
    name: String(raw?.name || "").trim().slice(0, 160),
    size: String(raw?.size || "").trim().slice(0, 100),
    unitPrice: Number(raw?.unitPrice),
    minQuantity: Number(raw?.minQuantity),
  })).filter(item => item.name && Number.isFinite(item.unitPrice) && item.unitPrice >= 0 && item.unitPrice <= 100000000 && Number.isSafeInteger(item.minQuantity) && item.minQuantity >= 1 && item.minQuantity <= 100000);
}

function publicId() {
  return randomBytes(12).toString("base64url");
}

let tableReady: Promise<void> | null = null;

async function initializeTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS price_lists (
      id SERIAL PRIMARY KEY,
      public_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      requirements TEXT NOT NULL DEFAULT '',
      premium_items TEXT NOT NULL DEFAULT '[]',
      offer_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      sections TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      staff_visible INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS staff_visible INTEGER NOT NULL DEFAULT 1");
  await pool.query("ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS offer_percent NUMERIC(5,2) NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS premium_items TEXT NOT NULL DEFAULT '[]'");
  await pool.query("CREATE INDEX IF NOT EXISTS price_lists_public_id_idx ON price_lists(public_id)");
}

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = initializeTable().catch(error => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}
export { ensureTable as ensurePriceListsTable };

function cleanSections(value: unknown): PriceListSection[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((section: any, sectionIndex) => {
    const columns = (Array.isArray(section?.columns) ? section.columns : [])
      .slice(0, 20)
      .map((column: unknown) => String(column ?? "").trim().slice(0, 80));
    return {
      id: String(section?.id || `section-${sectionIndex + 1}`).slice(0, 80),
      title: String(section?.title || `Price Table ${sectionIndex + 1}`).trim().slice(0, 140),
      columns,
      visibleColumns: columns.map((_column: string, index: number) => section?.visibleColumns?.[index] !== false),
      rows: (Array.isArray(section?.rows) ? section.rows : []).slice(0, 200).map((row: any, rowIndex: number) => ({
        id: String(row?.id || `row-${rowIndex + 1}`).slice(0, 80),
        cells: columns.map((_column: string, columnIndex: number) => String(row?.cells?.[columnIndex] ?? "").trim().slice(0, 200)),
      })),
    };
  });
}

function serialize(row: any) {
  let sections: PriceListSection[] = [];
  try { sections = cleanSections(typeof row.sections === "string" ? JSON.parse(row.sections) : row.sections); } catch {}
  let premiumItems: PremiumItem[] = [];
  try { premiumItems = cleanPremiumItems(typeof row.premium_items === "string" ? JSON.parse(row.premium_items) : row.premium_items); } catch {}
  return {
    id: row.id,
    publicId: row.public_id,
    title: row.title,
    subtitle: row.subtitle || "",
    note: row.note || "",
    requirements: row.requirements || "",
    premiumItems,
    sections,
    active: row.active === 1,
    staffVisible: row.staff_visible !== 0,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

router.get("/public/:publicId", async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM price_lists
       WHERE public_id = $1
         AND active = 1
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [String(req.params.publicId || "").slice(0, 80)]
    );
    if (!rows[0]) return res.status(404).json({ error: "Price list not found or no longer available" });
    const { premiumItems: _invoiceOnlyItems, ...publicPriceList } = serialize(rows[0]);
    res.json(publicPriceList);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to load price list" });
  }
});

router.get("/for-client/:clientId", requirePermission("price_lists_view"), async (req, res) => {
  try {
    await ensureTable();
    const clientId = Number(req.params.clientId);
    if (!Number.isSafeInteger(clientId) || clientId <= 0) return res.status(400).json({ error: "Invalid client" });
    const auth = getAdminAuth(req);
    const { rows } = await pool.query(`SELECT p.* FROM clients c JOIN price_lists p ON p.id=c.premium_price_list_id
      WHERE c.id=$1 AND c.deleted_at IS NULL AND c.approved=TRUE AND p.active=1
        AND (p.expires_at IS NULL OR p.expires_at>NOW())
        AND ($2::boolean OR p.staff_visible=1) LIMIT 1`, [clientId, auth?.role === "owner"]);
    res.setHeader("Cache-Control", "no-store, private");
    res.json(rows[0] ? serialize(rows[0]) : null);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to load client price list" });
  }
});

router.get("/", requirePermission("price_lists_view"), async (req, res) => {
  try {
    await ensureTable();
    const auth = getAdminAuth(req);
    const { rows } = await pool.query(
      auth?.role === "staff"
        ? "SELECT * FROM price_lists WHERE staff_visible=1 ORDER BY updated_at DESC"
        : "SELECT * FROM price_lists ORDER BY updated_at DESC"
    );
    res.json(rows.map(serialize));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to load price lists" });
  }
});

router.post("/", requireOwner, async (req, res) => {
  try {
    await ensureTable();
    const title = String(req.body?.title || "Untitled Price List").trim().slice(0, 160);
    const subtitle = String(req.body?.subtitle || "").trim().slice(0, 300);
    const note = String(req.body?.note || "").trim().slice(0, 1000);
    const requirements = String(req.body?.requirements || "").trim().slice(0, 4000);
    const premiumItems = cleanPremiumItems(req.body?.premiumItems);
    if (Array.isArray(req.body?.premiumItems) && premiumItems.length !== req.body.premiumItems.length) return res.status(400).json({ error: "Premium items need a name, valid price and minimum quantity" });
    const sections = cleanSections(req.body?.sections);
    const active = req.body?.active === false ? 0 : 1;
    const staffVisible = req.body?.staffVisible === false ? 0 : 1;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const { rows } = await pool.query(
      `INSERT INTO price_lists (public_id, title, subtitle, note, sections, active, staff_visible, expires_at, requirements, premium_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [publicId(), title, subtitle, note, JSON.stringify(sections), active, staffVisible, expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null, requirements, JSON.stringify(premiumItems)]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to create price list" });
  }
});

router.put("/:id", requireOwner, async (req, res) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid price list" });
    const title = String(req.body?.title || "Untitled Price List").trim().slice(0, 160);
    const subtitle = String(req.body?.subtitle || "").trim().slice(0, 300);
    const note = String(req.body?.note || "").trim().slice(0, 1000);
    const requirements = String(req.body?.requirements || "").trim().slice(0, 4000);
    const premiumItems = cleanPremiumItems(req.body?.premiumItems);
    if (Array.isArray(req.body?.premiumItems) && premiumItems.length !== req.body.premiumItems.length) return res.status(400).json({ error: "Premium items need a name, valid price and minimum quantity" });
    const sections = cleanSections(req.body?.sections);
    const active = req.body?.active === false ? 0 : 1;
    const staffVisible = req.body?.staffVisible === false ? 0 : 1;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const { rows } = await pool.query(
      `UPDATE price_lists
       SET title = $2, subtitle = $3, note = $4, sections = $5, active = $6,
           staff_visible = $7, expires_at = $8, requirements=$9, premium_items=$10, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, title, subtitle, note, JSON.stringify(sections), active, staffVisible, expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null, requirements, JSON.stringify(premiumItems)]
    );
    if (!rows[0]) return res.status(404).json({ error: "Price list not found" });
    res.json(serialize(rows[0]));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to update price list" });
  }
});

router.post("/:id/regenerate-link", requireOwner, async (req, res) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      "UPDATE price_lists SET public_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id, publicId()]
    );
    if (!rows[0]) return res.status(404).json({ error: "Price list not found" });
    res.json(serialize(rows[0]));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to regenerate link" });
  }
});

router.delete("/:id", requireOwner, async (req, res) => {
  try {
    await ensureTable();
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      await client.query("UPDATE clients SET premium_price_list_id=NULL WHERE premium_price_list_id=$1", [Number(req.params.id)]);
      result = await client.query("DELETE FROM price_lists WHERE id = $1", [Number(req.params.id)]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    if (!result.rowCount) return res.status(404).json({ error: "Price list not found" });
    res.status(204).send();
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to delete price list" });
  }
});

export default router;
