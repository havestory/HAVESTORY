import { randomBytes } from "node:crypto";
import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth-cookie";

const router = Router();

const DEFAULT_LABEL_CONFIG = {
  qrBaseUrl: process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() || "https://havestory.vercel.app",
  labelTitle: "Shipping Label",
  senderName: "",
  senderPhone: "",
  senderWhatsapp: "",
  senderAddress: "",
  footerText: "Thank you for choosing HAVESTORY",
  accentColor: "#111111",
  defaultSize: "standard",
  showLogo: true,
  showQr: true,
  showBarcode: true,
  fragileImageUrl: "",
  handleWithCareImageUrl: "",
  thisSideUpImageUrl: "",
  keepDryImageUrl: "",
  businessFontSize: 20,
  senderPhoneFontSize: 11,
  labelTitleFontSize: 9,
  invoiceFontSize: 14,
  recipientNameFontSize: 24,
  addressFontSize: 16,
  recipientPhoneFontSize: 14,
  footerFontSize: 8,
  addressFormat: "{address}\n{city}\n{district}\n{postalCode}",
};

const EMPTY_DETAILS = {
  recipientName: "",
  phone: "",
  alternatePhone: "",
  address: "",
  city: "",
  district: "",
  postalCode: "",
  deliveryNotes: "",
  urgent: false,
  fragile: false,
  handleWithCare: false,
  thisSideUp: false,
  keepDry: false,
  labelSize: "standard",
};

function token() {
  return randomBytes(18).toString("base64url");
}

function phoneKey(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("94")) return `0${digits.slice(2)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `0${digits}`;
  return digits;
}

function splitPhones(value: unknown) {
  return String(value || "").split(/[,;\/\n]+/).map(item => item.trim()).filter(Boolean);
}

function nameKey(value: unknown) {
  return String(value || "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function savedAddress(value: unknown) {
  try { return String(JSON.parse(String(value || "{}")).address || "").trim(); } catch { return ""; }
}

function fontSize(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function cleanDetails(value: any) {
  const field = (key: keyof typeof EMPTY_DETAILS, max: number) => String(value?.[key] || "").trim().slice(0, max);
  return {
    recipientName: field("recipientName", 140),
    phone: field("phone", 50),
    alternatePhone: field("alternatePhone", 50),
    address: field("address", 500),
    city: field("city", 100),
    district: field("district", 100),
    postalCode: field("postalCode", 30),
    deliveryNotes: field("deliveryNotes", 500),
    urgent: value?.urgent === true,
    fragile: value?.fragile === true,
    handleWithCare: value?.handleWithCare === true,
    thisSideUp: value?.thisSideUp === true,
    keepDry: value?.keepDry === true,
    labelSize: value?.labelSize === "a5" ? "a5" : "standard",
  };
}

let storageReady: Promise<void> | null = null;

async function initializeStorage() {
  await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS shipping_details TEXT NOT NULL DEFAULT '{}'");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_label_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS shipping_label_tokens_token_idx ON shipping_label_tokens(token)");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_label_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      config TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    `INSERT INTO shipping_label_settings (id, config) VALUES (1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(DEFAULT_LABEL_CONFIG)]
  );
}

function ensureStorage(): Promise<void> {
  if (!storageReady) {
    storageReady = initializeStorage().catch(error => {
      storageReady = null;
      throw error;
    });
  }
  return storageReady;
}

router.get("/settings", requireAdmin, async (req, res) => {
  try {
    await ensureStorage();
    const { rows } = await pool.query("SELECT config FROM shipping_label_settings WHERE id = 1");
    let config = DEFAULT_LABEL_CONFIG;
    try { config = { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(rows[0]?.config || "{}") }; } catch {}
    res.json(config);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to load shipping label settings" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    await ensureStorage();
    const body = req.body || {};
    const url = String(body.qrBaseUrl || "").trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "QR website link must start with http:// or https://" });
    const config = {
      qrBaseUrl: url.slice(0, 300),
      labelTitle: String(body.labelTitle ?? "").trim().slice(0, 80),
      senderName: String(body.senderName || "").trim().slice(0, 140),
      senderPhone: String(body.senderPhone || "").trim().slice(0, 60),
      senderWhatsapp: String(body.senderWhatsapp || "").trim().slice(0, 60),
      senderAddress: String(body.senderAddress || "").trim().slice(0, 300),
      footerText: String(body.footerText || "").trim().slice(0, 200),
      accentColor: /^#[0-9a-f]{6}$/i.test(String(body.accentColor || "")) ? String(body.accentColor) : "#111111",
      defaultSize: body.defaultSize === "a5" ? "a5" : "standard",
      showLogo: body.showLogo !== false,
      showQr: body.showQr !== false,
      showBarcode: body.showBarcode !== false,
      fragileImageUrl: String(body.fragileImageUrl || "").trim().slice(0, 1000),
      handleWithCareImageUrl: String(body.handleWithCareImageUrl || "").trim().slice(0, 1000),
      thisSideUpImageUrl: String(body.thisSideUpImageUrl || "").trim().slice(0, 1000),
      keepDryImageUrl: String(body.keepDryImageUrl || "").trim().slice(0, 1000),
      businessFontSize: fontSize(body.businessFontSize, 20, 14, 32),
      senderPhoneFontSize: fontSize(body.senderPhoneFontSize, 11, 8, 20),
      labelTitleFontSize: fontSize(body.labelTitleFontSize, 9, 7, 18),
      invoiceFontSize: fontSize(body.invoiceFontSize, 14, 9, 24),
      recipientNameFontSize: fontSize(body.recipientNameFontSize, 24, 16, 38),
      addressFontSize: fontSize(body.addressFontSize, 16, 10, 26),
      recipientPhoneFontSize: fontSize(body.recipientPhoneFontSize, 14, 10, 24),
      footerFontSize: fontSize(body.footerFontSize, 8, 6, 16),
      addressFormat: String(body.addressFormat ?? DEFAULT_LABEL_CONFIG.addressFormat).trim().slice(0, 500) || DEFAULT_LABEL_CONFIG.addressFormat,
    };
    await pool.query("UPDATE shipping_label_settings SET config = $1, updated_at = NOW() WHERE id = 1", [JSON.stringify(config)]);
    res.json(config);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to save shipping label settings" });
  }
});

router.get("/verify/:token", async (req, res) => {
  try {
    await ensureStorage();
    const { rows } = await pool.query(
      `SELECT i.invoice_number, o.status, o.created_at
         FROM shipping_label_tokens s
         JOIN orders o ON o.order_id = s.order_id
         LEFT JOIN invoices i ON i.order_id = o.order_id AND i.deleted_at IS NULL
        WHERE s.token = $1 AND o.deleted_at IS NULL
        ORDER BY i.created_at DESC NULLS LAST
        LIMIT 1`,
      [String(req.params.token || "").slice(0, 100)]
    );
    if (!rows[0]) return res.status(404).json({ error: "Shipping label verification not found" });
    res.json({
      valid: true,
      invoiceNumber: rows[0].invoice_number || null,
      status: rows[0].status,
      createdAt: rows[0].created_at,
      privacy: "Customer details are protected and are not shown on this page.",
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to verify shipping label" });
  }
});

router.post("/token", requireAdmin, async (req, res) => {
  try {
    await ensureStorage();
    const orderId = String(req.body?.orderId || "").trim().slice(0, 100);
    if (!orderId) return res.status(400).json({ error: "orderId is required" });
    const order = await pool.query("SELECT order_id FROM orders WHERE order_id = $1 AND deleted_at IS NULL LIMIT 1", [orderId]);
    if (!order.rows[0]) return res.status(404).json({ error: "Order not found" });
    const existing = await pool.query("SELECT token FROM shipping_label_tokens WHERE order_id = $1 LIMIT 1", [orderId]);
    if (existing.rows[0]) return res.json({ token: existing.rows[0].token });
    const created = await pool.query(
      `INSERT INTO shipping_label_tokens (token, order_id) VALUES ($1, $2)
       ON CONFLICT (order_id) DO UPDATE SET updated_at = NOW()
       RETURNING token`,
      [token(), orderId]
    );
    res.status(201).json({ token: created.rows[0].token });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to create shipping label token" });
  }
});

router.get("/client-details", requireAdmin, async (req, res) => {
  try {
    await ensureStorage();
    const phone = phoneKey(req.query.phone);
    const requestedName = nameKey(req.query.name);
    if (!phone) return res.json(null);
    const { rows } = await pool.query(
      "SELECT id, name, phone, address, shipping_details FROM clients WHERE deleted_at IS NULL ORDER BY updated_at DESC NULLS LAST, id DESC"
    );
    const matches = rows.filter((row: any) => splitPhones(row.phone).some(item => phoneKey(item) === phone));
    const client = matches.sort((a: any, b: any) => {
      const score = (row: any) => (requestedName && nameKey(row.name) === requestedName ? 100 : 0) + (savedAddress(row.shipping_details) ? 20 : 0) + (String(row.address || "").trim() ? 10 : 0);
      return score(b) - score(a);
    })[0];
    if (!client) return res.json(null);
    let saved = EMPTY_DETAILS;
    try { saved = { ...EMPTY_DETAILS, ...JSON.parse(client.shipping_details || "{}") }; } catch {}
    res.json({
      clientId: client.id,
      clientName: client.name,
      details: {
        ...saved,
        recipientName: saved.recipientName || client.name || "",
        phone: saved.phone || splitPhones(client.phone)[0] || "",
        address: saved.address || client.address || "",
      },
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to load customer shipping details" });
  }
});

router.get("/client-details/:clientId", requireAdmin, async (req, res) => {
  try {
    await ensureStorage();
    const clientId = Number(req.params.clientId);
    if (!Number.isInteger(clientId) || clientId <= 0) return res.status(400).json({ error: "Invalid client ID" });
    const { rows } = await pool.query(
      "SELECT id, name, phone, address, shipping_details FROM clients WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [clientId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Client not found" });
    let saved = EMPTY_DETAILS;
    try { saved = { ...EMPTY_DETAILS, ...JSON.parse(rows[0].shipping_details || "{}") }; } catch {}
    res.json({
      clientId: rows[0].id,
      details: {
        ...saved,
        recipientName: saved.recipientName || rows[0].name || "",
        phone: saved.phone || splitPhones(rows[0].phone)[0] || "",
        address: saved.address || rows[0].address || "",
      },
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to load customer shipping details" });
  }
});

router.put("/client-details/:clientId", requireAdmin, async (req, res) => {
  try {
    await ensureStorage();
    const clientId = Number(req.params.clientId);
    if (!Number.isInteger(clientId) || clientId <= 0) return res.status(400).json({ error: "Invalid client ID" });
    const current = await pool.query(
      "SELECT id, address, shipping_details FROM clients WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      [clientId]
    );
    if (!current.rows[0]) return res.status(404).json({ error: "Client not found" });
    const details = cleanDetails(req.body);
    if (!details.address && req.body?.clearAddress !== true) {
      details.address = savedAddress(current.rows[0].shipping_details) || String(current.rows[0].address || "").trim().slice(0, 500);
    }
    const result = await pool.query(
      "UPDATE clients SET shipping_details = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [clientId, JSON.stringify(details)]
    );
    res.json({ clientId: result.rows[0].id, details });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Unable to save customer shipping details" });
  }
});

export default router;
