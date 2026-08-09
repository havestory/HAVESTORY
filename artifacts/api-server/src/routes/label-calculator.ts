import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth-cookie";

const router = Router();

const DEFAULT_CONFIG = {
  enabled: true,
  pricingMessage: "Quantity වැඩි කරන තරමට price per sticker අඩු වෙන්න පුළුවන්. Below value options බලලා ඔබට හොඳම quantity එක select කරන්න.",
  sheets: [
    { id: "a4", name: "A4", widthMm: 210, heightMm: 297, price: 180, marginMm: 5, marginTopMm: 5, marginBottomMm: 5, marginLeftMm: 5, marginRightMm: 5, gapMm: 2, enabled: true, priceTiers: [{ minQty: 1, maxQty: null, price: 180 }] },
  ],
  products: [
    {
      id: "stickers", name: "Sticker Printing", enabled: true, sheetIds: ["a4"], shapes: ["round","rectangle","square"],
      optionGroups: [
        { id: "lamination", title: "Lamination", choices: [
          { id: "none", name: "No Lamination", price: 0, chargeType: "flat" },
          { id: "gloss", name: "Gloss Lamination", price: 30, chargeType: "per_sheet" },
          { id: "matte", name: "Matte Lamination", price: 40, chargeType: "per_sheet" }
        ] }
      ]
    },
    { id: "business-cards", name: "Business Card Printing", enabled: true, sheetIds: ["a4"], shapes: ["rectangle","square"], optionGroups: [] }
  ],
};

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS label_calculator_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      config TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `INSERT INTO label_calculator_settings (id, config)
     VALUES (1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(DEFAULT_CONFIG)]
  );
}

router.get("/", async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query("SELECT config FROM label_calculator_settings WHERE id = 1");
    const config = JSON.parse(rows[0]?.config || JSON.stringify(DEFAULT_CONFIG));
    res.json(config);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to load label calculator settings" });
  }
});

router.put("/", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const sheets = Array.isArray(body.sheets) ? body.sheets : [];
    const cleaned = sheets.slice(0, 20).map((sheet: any, index: number) => ({
      id: String(sheet.id || `sheet-${index + 1}`).slice(0, 60),
      name: String(sheet.name || `Sheet ${index + 1}`).slice(0, 80),
      widthMm: Math.max(1, Number(sheet.widthMm) || 1),
      heightMm: Math.max(1, Number(sheet.heightMm) || 1),
      price: Math.max(0, Number(sheet.price) || 0),
      // Keep marginMm for backwards compatibility. Individual sides take
      // precedence and fall back to the legacy value for existing configs.
      marginMm: Math.max(0, Number(sheet.marginMm) || 0),
      marginTopMm: Math.max(0, Number(sheet.marginTopMm ?? sheet.marginMm) || 0),
      marginBottomMm: Math.max(0, Number(sheet.marginBottomMm ?? sheet.marginMm) || 0),
      marginLeftMm: Math.max(0, Number(sheet.marginLeftMm ?? sheet.marginMm) || 0),
      marginRightMm: Math.max(0, Number(sheet.marginRightMm ?? sheet.marginMm) || 0),
      gapMm: Math.max(0, Number(sheet.gapMm) || 0),
      enabled: sheet.enabled !== false,
      priceTiers: (Array.isArray(sheet.priceTiers) ? sheet.priceTiers : []).slice(0, 30).map((tier: any) => ({
        minQty: Math.max(1, Math.floor(Number(tier.minQty) || 1)),
        maxQty: tier.maxQty === null || tier.maxQty === "" ? null : Math.max(1, Math.floor(Number(tier.maxQty) || 1)),
        price: Math.max(0, Number(tier.price) || 0),
      })),
    }));
    if (!cleaned.length) return res.status(400).json({ error: "Add at least one sheet size" });
    const products = (Array.isArray(body.products) ? body.products : []).slice(0, 30).map((product: any, pIndex: number) => ({
      id: String(product.id || `product-${pIndex + 1}`).slice(0, 60),
      name: String(product.name || `Product ${pIndex + 1}`).slice(0, 100),
      enabled: product.enabled !== false,
      sheetIds: (Array.isArray(product.sheetIds) ? product.sheetIds : []).map((id: any) => String(id).slice(0, 60)),
      shapes: (Array.isArray(product.shapes) && product.shapes.length ? product.shapes : ["rectangle"]).map((shape: any) => shape === "circle" ? "round" : shape).filter((shape: any) => ["round","rectangle","square"].includes(shape)),
      optionGroups: (Array.isArray(product.optionGroups) ? product.optionGroups : []).slice(0, 15).map((group: any, gIndex: number) => ({
        id: String(group.id || `group-${gIndex + 1}`).slice(0, 60),
        title: String(group.title || `Option ${gIndex + 1}`).slice(0, 100),
        choices: (Array.isArray(group.choices) ? group.choices : []).slice(0, 30).map((choice: any, cIndex: number) => ({
          id: String(choice.id || `choice-${cIndex + 1}`).slice(0, 60),
          name: String(choice.name || `Choice ${cIndex + 1}`).slice(0, 100),
          price: Math.max(0, Number(choice.price) || 0),
          chargeType: ["per_sheet", "per_label", "flat"].includes(choice.chargeType) ? choice.chargeType : "flat",
          priceTiers: (Array.isArray(choice.priceTiers) ? choice.priceTiers : []).slice(0, 30).map((tier: any) => ({
            minQty: Math.max(1, Math.floor(Number(tier.minQty) || 1)),
            maxQty: tier.maxQty === null || tier.maxQty === "" ? null : Math.max(1, Math.floor(Number(tier.maxQty) || 1)),
            price: Math.max(0, Number(tier.price) || 0),
          })),
        })),
      })),
    }));
    const config = {
      enabled: body.enabled !== false,
      pricingMessage: String(body.pricingMessage || "").slice(0, 500),
      sheets: cleaned,
      products,
    };
    await ensureTable();
    await pool.query(
      "UPDATE label_calculator_settings SET config = $1, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(config)]
    );
    res.json(config);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to save label calculator settings" });
  }
});

export default router;
