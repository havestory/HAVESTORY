import { randomBytes } from "node:crypto";
import { Router } from "express";
import { pool } from "@workspace/db";
import { getAdminAuth, requireOwner, requirePermission } from "../lib/auth-cookie";

const router = Router();

type PriceListSection = {
  id: string;
  title: string;
  columns: string[];
  rows: Array<{ id: string; cells: string[] }>;
};

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
      sections TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      staff_visible INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS staff_visible INTEGER NOT NULL DEFAULT 1");
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
  return {
    id: row.id,
    publicId: row.public_id,
    title: row.title,
    subtitle: row.subtitle || "",
    note: row.note || "",
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
    res.json(serialize(rows[0]));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to load price list" });
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
    const sections = cleanSections(req.body?.sections);
    const active = req.body?.active === false ? 0 : 1;
    const staffVisible = req.body?.staffVisible === false ? 0 : 1;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const { rows } = await pool.query(
      `INSERT INTO price_lists (public_id, title, subtitle, note, sections, active, staff_visible, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [publicId(), title, subtitle, note, JSON.stringify(sections), active, staffVisible, expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null]
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
    const sections = cleanSections(req.body?.sections);
    const active = req.body?.active === false ? 0 : 1;
    const staffVisible = req.body?.staffVisible === false ? 0 : 1;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const { rows } = await pool.query(
      `UPDATE price_lists
       SET title = $2, subtitle = $3, note = $4, sections = $5, active = $6,
           staff_visible = $7, expires_at = $8, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, title, subtitle, note, JSON.stringify(sections), active, staffVisible, expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null]
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
    const result = await pool.query("DELETE FROM price_lists WHERE id = $1", [Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ error: "Price list not found" });
    res.status(204).send();
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to delete price list" });
  }
});

export default router;
