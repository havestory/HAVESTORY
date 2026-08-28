import { Router } from "express";
import { db, pool } from "@workspace/db";
import { settingsTable, noticeTable, noticesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { uploadToCloudinary } from "../lib/cloudinary";
import { safeUpload } from "../lib/upload-policy";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";
import { sendTestEmail } from "../lib/mailer";

const siteUpload = safeUpload({
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 1,
  maxFields: 10,
});

const router = Router();

let settingsCompatibilityReady: Promise<void> | null = null;

function ensureSettingsCompatibility(): Promise<void> {
  if (!settingsCompatibilityReady) {
    settingsCompatibilityReady = pool
      .query(
        `
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS home_feature_cards TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS home_benefits TEXT NOT NULL DEFAULT '[{"title":"Easy Online Ordering","copy":"Simple steps from photo to checkout.","icon":"shopping-cart","color":"rose","enabled":true},{"title":"Print-Ready Quality","copy":"Colour-checked prints with premium materials.","icon":"badge-check","color":"blue","enabled":true},{"title":"Islandwide Delivery","copy":"Carefully packed and delivered across Sri Lanka.","icon":"truck","color":"rose","enabled":true},{"title":"Friendly Studio Support","copy":"Real guidance from idea to finished frame.","icon":"headphones","color":"blue","enabled":true}]';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS home_benefits_enabled INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS home_benefits_animated INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS home_benefits_speed INTEGER NOT NULL DEFAULT 28;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image6 TEXT;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image7 TEXT;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image8 TEXT;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image9 TEXT;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image10 TEXT;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_enabled TEXT NOT NULL DEFAULT '[true,true,true,true,true,true,true,true,true,true]';
    `,
      )
      .then(() => undefined)
      .catch((error) => {
        settingsCompatibilityReady = null;
        throw error;
      });
  }
  return settingsCompatibilityReady;
}

async function getOrCreateSettings() {
  // Additive runtime compatibility for existing production databases. No
  // existing settings values are rewritten.
  await ensureSettingsCompatibility();
  const [existing] = await db.select().from(settingsTable);
  if (existing) return existing;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

async function getOrCreateNotice() {
  const [existing] = await db.select().from(noticeTable);
  if (existing) return existing;
  const [created] = await db.insert(noticeTable).values({}).returning();
  return created;
}

router.get("/", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    if (getAdminAuth(req)) {
      return res.json(settings);
    }

    // This endpoint powers the public website. Never expose operational
    // credentials or private notification recipients to anonymous visitors.
    const {
      gmailUser: _gmailUser,
      gmailAppPassword: _gmailAppPassword,
      ipayToken: _ipayToken,
      ipaySecret: _ipaySecret,
      orderEmailRecipients: _orderEmailRecipients,
      financeReportEmailRecipient: _financeReportEmailRecipient,
      ...publicSettings
    } = settings;
    return res.json(publicSettings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", requireAdmin, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const updateData: any = { updatedAt: new Date() };
    const fields = [
      "businessName",
      "tagline",
      "heroTitle",
      "heroSubtitle",
      "whatsappNumber",
      "whatsappMessage",
      "aboutStory",
      "aboutMission",
      "aboutImage",
      "ordersCompletedCount",
      "happyClientsPercent",
      "starRating",
      "facebookUrl",
      "instagramUrl",
      "address",
      "email",
      "phone",
      "website",
      "bankName",
      "bankAccountHolder",
      "bankAccountNumber",
      "bankBranch",
      "bankSwiftBic",
      "paymentDueDays",
      "overdueDays",
      "termsConditions",
      "courierServices",
      "heroBgImage",
      "heroCtaText",
      "heroCtaLink",
      "heroBadgeText",
      "heroHighlightWord",
      "aboutVision",
      "aboutFoundedYear",
      "aboutTeamSize",
      "aboutLocation",
      "privacyPolicy",
      "termsOfService",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
      "seoOgImage",
      "themePreset",
      "specialEventEnabled",
      "specialEventType",
      "specialEventMessage",
      "heroAvatarImage1",
      "heroAvatarImage2",
      "heroAvatarImage3",
      "heroAvatarImage4",
      "designerCredit",
      "ownerName",
      "logoUrl",
      "tiktokUrl",
      "bankDetails",
      "courierCharge",
      "slPostCharge",
      "checkoutCourierLabel",
      "checkoutCourierDescription",
      "checkoutSlPostLabel",
      "checkoutSlPostDescription",
      "checkoutPickupLabel",
      "checkoutPickupDescription",
      "checkoutPickupAddress",
      "invoiceStandardRate",
      "invoiceExpressRate",
      "invoiceWeightFirstKg",
      "invoiceWeightAddKg",
      "faviconUrl",
      "whatsappOrderTemplate",
      "heroSlideImage1",
      "heroSlideImage2",
      "heroSlideImage3",
      "heroSlideImage4",
      "heroSlideImage5",
      "heroSlideImage6",
      "heroSlideImage7",
      "heroSlideImage8",
      "heroSlideImage9",
      "heroSlideImage10",
      "heroSlideEnabled",
      "homeFeatureCards",
      "homeBenefits",
      "homeBenefitsSpeed",
      "paymentQrUrl",
      "paymentButtonUrl",
      "paymentButtonLabel",
      "siteClosedMessage",
      "ipayToken",
      "ipaySecret",
      "googlePayNumber",
      "googlePayQrUrl",
      "googlePayInstructions",
      "orderEmailRecipients",
      "gmailUser",
      "gmailAppPassword",
      "financeReportEmailRecipient",
      "checkoutBankTransferEnabled",
      "checkoutDepositAmount",
      "checkoutDepositMessage",
      "checkoutFullPaymentEnabled",
      "checkoutFullPaymentOffer",
      "checkoutFullPaymentDiscount",
      "checkoutCodEnabled",
      "checkoutCodMessage",
      "checkoutCourierEnabled",
      "checkoutSlPostEnabled",
      "checkoutPickupEnabled",
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }
    // Boolean-like integer fields (stored as 0/1)
    if (req.body.orderEmailNotificationsEnabled !== undefined) {
      updateData.orderEmailNotificationsEnabled = req.body
        .orderEmailNotificationsEnabled
        ? 1
        : 0;
    }
    if (req.body.financeReportEmailEnabled !== undefined) {
      updateData.financeReportEmailEnabled = req.body.financeReportEmailEnabled
        ? 1
        : 0;
    }
    if (req.body.taglineEnabled !== undefined) {
      updateData.taglineEnabled = req.body.taglineEnabled ? 1 : 0;
    }
    if (req.body.showNameWithLogo !== undefined) {
      updateData.showNameWithLogo = req.body.showNameWithLogo ? 1 : 0;
    }
    if (req.body.siteClosedEnabled !== undefined) {
      updateData.siteClosedEnabled = req.body.siteClosedEnabled ? 1 : 0;
    }
    if (req.body.ipayEnabled !== undefined) {
      updateData.ipayEnabled = req.body.ipayEnabled ? 1 : 0;
    }
    if (req.body.ipaySandbox !== undefined) {
      updateData.ipaySandbox = req.body.ipaySandbox ? 1 : 0;
    }
    if (req.body.payButtonVisible !== undefined) {
      updateData.payButtonVisible = req.body.payButtonVisible ? 1 : 0;
    }
    if (req.body.googlePayEnabled !== undefined) {
      updateData.googlePayEnabled = req.body.googlePayEnabled ? 1 : 0;
    }
    if (req.body.specialEventEnabled !== undefined) {
      updateData.specialEventEnabled = req.body.specialEventEnabled ? 1 : 0;
    }
    if (req.body.homeBenefitsEnabled !== undefined) {
      updateData.homeBenefitsEnabled = req.body.homeBenefitsEnabled ? 1 : 0;
    }
    if (req.body.homeBenefitsAnimated !== undefined) {
      updateData.homeBenefitsAnimated = req.body.homeBenefitsAnimated ? 1 : 0;
    }
    if (req.body.checkoutBankTransferEnabled !== undefined) {
      updateData.checkoutBankTransferEnabled = req.body
        .checkoutBankTransferEnabled
        ? 1
        : 0;
    }
    if (req.body.checkoutFullPaymentEnabled !== undefined) {
      updateData.checkoutFullPaymentEnabled = req.body
        .checkoutFullPaymentEnabled
        ? 1
        : 0;
    }
    if (req.body.checkoutCodEnabled !== undefined) {
      updateData.checkoutCodEnabled = req.body.checkoutCodEnabled ? 1 : 0;
    }
    if (req.body.checkoutCourierEnabled !== undefined) {
      updateData.checkoutCourierEnabled = req.body.checkoutCourierEnabled
        ? 1
        : 0;
    }
    if (req.body.checkoutSlPostEnabled !== undefined) {
      updateData.checkoutSlPostEnabled = req.body.checkoutSlPostEnabled ? 1 : 0;
    }
    if (req.body.checkoutPickupEnabled !== undefined) {
      updateData.checkoutPickupEnabled = req.body.checkoutPickupEnabled ? 1 : 0;
    }
    const [updated] = await db
      .update(settingsTable)
      .set(updateData)
      .where(eq(settingsTable.id, settings.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Sends a one-shot test email to the recipients in the request body (or to
// the saved recipients if none are passed) so the admin can verify SMTP is
// configured correctly. Requires GMAIL_USER + GMAIL_APP_PASSWORD env vars.
router.post("/test-email", requireAdmin, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const raw =
      (req.body?.recipients as string | undefined) ??
      settings.orderEmailRecipients ??
      "";
    const recipients = String(raw)
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No recipient email configured. Add one in Settings first.",
      });
    }
    // Allow the admin to test a value typed into the form *before* it has
    // been saved to the DB (so they can verify a fresh App Password
    // without an explicit save round-trip). Falls back to the saved
    // values, then to env vars in mailer.ts.
    const overrideUser =
      typeof req.body?.gmailUser === "string" ? req.body.gmailUser : null;
    const overridePass =
      typeof req.body?.gmailAppPassword === "string"
        ? req.body.gmailAppPassword
        : null;
    const result = await sendTestEmail({
      recipients,
      businessName: settings.businessName || "HAVESTORY",
      credentials: {
        user: overrideUser ?? (settings as any).gmailUser ?? null,
        pass: overridePass ?? (settings as any).gmailAppPassword ?? null,
      },
      log: (msg, extra) => req.log.info(extra ?? {}, msg),
      errorLog: (msg, extra) => req.log.error(extra ?? {}, msg),
    });
    if (result.ok) return res.json({ ok: true, recipients });
    if (result.reason === "smtp_not_configured") {
      return res.status(503).json({
        ok: false,
        error:
          "Mailer is not configured. Enter your Gmail address and App Password in Settings.",
      });
    }
    return res
      .status(502)
      .json({ ok: false, error: result.reason || "Failed to send email" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ ok: false, error: "Failed to send test email" });
  }
});

router.post(
  "/upload-image",
  requireAdmin,
  siteUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const { url: fileUrl } = await uploadToCloudinary(
        req.file.buffer,
        "havestory/site-images",
        req.file.originalname,
      );
      res.json({ url: fileUrl, originalName: req.file.originalname });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

router.get("/backup", requireAdmin, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      settings,
    };
    const json = JSON.stringify(backup, null, 2);
    const filename = `havestory-settings-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(json);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to export settings" });
  }
});

router.post("/restore", requireAdmin, async (req, res) => {
  try {
    const { settings: incoming, version } = req.body;
    if (!incoming || typeof incoming !== "object") {
      return res
        .status(400)
        .json({ error: "Invalid backup file — missing settings object" });
    }
    const current = await getOrCreateSettings();
    const updateData: any = { updatedAt: new Date() };
    const fields = [
      "businessName",
      "tagline",
      "heroTitle",
      "heroSubtitle",
      "whatsappNumber",
      "whatsappMessage",
      "aboutStory",
      "aboutMission",
      "aboutImage",
      "ordersCompletedCount",
      "happyClientsPercent",
      "starRating",
      "facebookUrl",
      "instagramUrl",
      "address",
      "email",
      "phone",
      "website",
      "bankName",
      "bankAccountHolder",
      "bankAccountNumber",
      "bankBranch",
      "bankSwiftBic",
      "paymentDueDays",
      "overdueDays",
      "termsConditions",
      "courierServices",
      "heroBgImage",
      "heroCtaText",
      "heroCtaLink",
      "heroBadgeText",
      "heroHighlightWord",
      "aboutVision",
      "aboutFoundedYear",
      "aboutTeamSize",
      "aboutLocation",
      "privacyPolicy",
      "termsOfService",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
      "seoOgImage",
      "themePreset",
      "specialEventEnabled",
      "specialEventType",
      "specialEventMessage",
      "heroAvatarImage1",
      "heroAvatarImage2",
      "heroAvatarImage3",
      "heroAvatarImage4",
      "designerCredit",
      "ownerName",
      "logoUrl",
      "tiktokUrl",
      "bankDetails",
      "courierCharge",
      "slPostCharge",
      "checkoutCourierLabel",
      "checkoutCourierDescription",
      "checkoutSlPostLabel",
      "checkoutSlPostDescription",
      "checkoutPickupLabel",
      "checkoutPickupDescription",
      "checkoutPickupAddress",
      "invoiceStandardRate",
      "invoiceExpressRate",
      "invoiceWeightFirstKg",
      "invoiceWeightAddKg",
      "faviconUrl",
      "taglineEnabled",
      "showNameWithLogo",
      "heroSlideImage1",
      "heroSlideImage2",
      "heroSlideImage3",
      "heroSlideImage4",
      "heroSlideImage5",
      "heroSlideImage6",
      "heroSlideImage7",
      "heroSlideImage8",
      "heroSlideImage9",
      "heroSlideImage10",
      "heroSlideEnabled",
      "homeFeatureCards",
      "homeBenefits",
      "homeBenefitsEnabled",
      "homeBenefitsAnimated",
      "homeBenefitsSpeed",
      "paymentQrUrl",
      "paymentButtonUrl",
      "paymentButtonLabel",
      "siteClosedEnabled",
      "siteClosedMessage",
      "ipayToken",
      "ipaySecret",
      "ipayEnabled",
      "ipaySandbox",
      "payButtonVisible",
      "googlePayEnabled",
      "googlePayNumber",
      "googlePayQrUrl",
      "googlePayInstructions",
      "orderEmailNotificationsEnabled",
      "orderEmailRecipients",
      "gmailUser",
      "gmailAppPassword",
      "financeReportEmailEnabled",
      "financeReportEmailRecipient",
      "checkoutBankTransferEnabled",
      "checkoutDepositAmount",
      "checkoutDepositMessage",
      "checkoutFullPaymentEnabled",
      "checkoutFullPaymentOffer",
      "checkoutFullPaymentDiscount",
      "checkoutCodEnabled",
      "checkoutCodMessage",
      "checkoutCourierEnabled",
      "checkoutSlPostEnabled",
      "checkoutPickupEnabled",
    ];
    for (const f of fields) {
      if (incoming[f] !== undefined) updateData[f] = incoming[f];
    }
    if (incoming.homeBenefitsEnabled !== undefined) {
      updateData.homeBenefitsEnabled = incoming.homeBenefitsEnabled ? 1 : 0;
    }
    if (incoming.homeBenefitsAnimated !== undefined) {
      updateData.homeBenefitsAnimated = incoming.homeBenefitsAnimated ? 1 : 0;
    }
    const [updated] = await db
      .update(settingsTable)
      .set(updateData)
      .where(eq(settingsTable.id, current.id))
      .returning();
    res.json({ success: true, settings: updated });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to restore settings" });
  }
});

export default router;

export const noticeRouter = Router();

noticeRouter.get("/", async (req, res) => {
  try {
    const notice = await getOrCreateNotice();
    res.json({
      enabled: notice.enabled === 1,
      message: notice.message,
      type: notice.type,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch notice" });
  }
});

noticeRouter.put("/", requireAdmin, async (req, res) => {
  try {
    const notice = await getOrCreateNotice();
    const { enabled, message, type } = req.body;
    const [updated] = await db
      .update(noticeTable)
      .set({
        enabled: enabled ? 1 : 0,
        message: message ?? notice.message,
        type: type ?? notice.type,
        updatedAt: new Date(),
      })
      .where(eq(noticeTable.id, notice.id))
      .returning();
    res.json({
      enabled: updated.enabled === 1,
      message: updated.message,
      type: updated.type,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update notice" });
  }
});

/* ── Multi-notice CRUD ─────────────────────────────────────────────────────── */
export const noticesRouter = Router();

noticesRouter.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(noticesTable)
      .orderBy(asc(noticesTable.sortOrder), asc(noticesTable.createdAt));
    res.json(rows.map((r) => ({ ...r, enabled: r.enabled === 1 })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch notices" });
  }
});

noticesRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      message,
      style = "info",
      placement = "banner",
      enabled = true,
      sortOrder = 0,
      topic,
      imageUrl,
    } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });
    const [created] = await db
      .insert(noticesTable)
      .values({
        message,
        style,
        placement,
        enabled: enabled ? 1 : 0,
        sortOrder,
        topic: topic || null,
        imageUrl: imageUrl || null,
      })
      .returning();
    res.status(201).json({ ...created, enabled: created.enabled === 1 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create notice" });
  }
});

noticesRouter.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { message, style, placement, enabled, sortOrder, topic, imageUrl } =
      req.body;
    const updateData: any = { updatedAt: new Date() };
    if (message !== undefined) updateData.message = message;
    if (style !== undefined) updateData.style = style;
    if (placement !== undefined) updateData.placement = placement;
    if (enabled !== undefined) updateData.enabled = enabled ? 1 : 0;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (topic !== undefined) updateData.topic = topic || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    const [updated] = await db
      .update(noticesTable)
      .set(updateData)
      .where(eq(noticesTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Notice not found" });
    res.json({ ...updated, enabled: updated.enabled === 1 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update notice" });
  }
});

noticesRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(noticesTable).where(eq(noticesTable.id, id));
    res.json({ success: true, message: "Notice deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete notice" });
  }
});
