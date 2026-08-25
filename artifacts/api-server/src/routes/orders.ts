import { Router } from "express";
import { db, pool } from "@workspace/db";
import { ordersTable, settingsTable, productsTable, clientsTable, couponsTable } from "@workspace/db/schema";
import { invoicesTable } from "@workspace/db/schema";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import multer from "multer";
import { uploadToCloudinary } from "../lib/cloudinary";
import { randomUUID } from "node:crypto";
import { sendOrderNotificationEmail, sendCustomerConfirmationEmail, sendOrderCompletionEmail } from "../lib/mailer";
import { syncInvoiceFinance } from "./finance-inventory";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function parseArr(s: string): any[] {
  try { return JSON.parse(s); } catch { return []; }
}

function isWebUrl(value: unknown): value is string {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDesignPreviews(raw: string | null | undefined): any[] {
  return parseArr(raw || "[]")
    .filter((entry: any) => entry && typeof entry === "object" && entry.type === "design-preview")
    .map((entry: any, index: number) => ({
      id: String(entry.id || `preview-${index + 1}`),
      type: "design-preview",
      name: String(entry.name || `Design preview ${index + 1}`),
      previewUrl: isWebUrl(entry.previewUrl) ? String(entry.previewUrl) : "",
      driveUrl: isWebUrl(entry.driveUrl) ? String(entry.driveUrl) : "",
      downloadEnabled: entry.downloadEnabled === true,
      watermarkText: String(entry.watermarkText || "HAVESTORY"),
      watermarkOpacity: Math.min(0.6, Math.max(0.05, Number(entry.watermarkOpacity) || 0.18)),
      createdAt: String(entry.createdAt || ""),
    }))
    .filter((entry: any) => entry.previewUrl);
}

function publicDesignPreviews(order: any) {
  const paymentApproved = ["paid", "approved"].includes(String(order.paymentStatus || "").toLowerCase())
    || String(order.paymentProofStatus || "").toLowerCase() === "approved"
    || String(order.status || "").toLowerCase() === "completed";
  return parseDesignPreviews(order.designLinks).map((preview: any) => ({
    id: preview.id,
    name: preview.name,
    previewUrl: preview.previewUrl,
    watermarkText: preview.watermarkText,
    watermarkOpacity: preview.watermarkOpacity,
    downloadEnabled: preview.downloadEnabled,
    downloadUrl: preview.downloadEnabled && paymentApproved && preview.driveUrl ? preview.driveUrl : null,
    downloadLocked: preview.downloadEnabled && !paymentApproved,
  }));
}

function parseProductPaymentRules(raw: string | null | undefined) {
  try {
    const config = JSON.parse(raw || "{}");
    return {
      codEnabled: config?.codEnabled === true,
      fullPaymentOfferEnabled: config?.fullPaymentOfferEnabled === true,
      fullPaymentOfferDiscount: Math.min(100, Math.max(0, Number(config?.fullPaymentOfferDiscount) || 0)),
    };
  } catch {
    return { codEnabled: false, fullPaymentOfferEnabled: false, fullPaymentOfferDiscount: 0 };
  }
}

function resolveProductLine(rawConfig: string | null | undefined, selectedOptions: unknown, quantity: number, basePrice: number) {
  let config: any = {};
  try { config = JSON.parse(rawConfig || "{}"); } catch { config = {}; }

  const selected = Array.isArray(selectedOptions) ? selectedOptions : [];
  const qty = Math.max(1, Number(quantity) || 1);
  const selectedDetails: any[] = [];
  let optionTotal = 0;
  let resolvedBasePrice = Math.max(0, basePrice);

  const selectedSize = selected.find((entry: any) => entry?.groupId === "product-size");
  const size = Array.isArray(config.sizes)
    ? config.sizes.find((entry: any) => entry?.id === selectedSize?.choiceId)
    : undefined;
  if (size) {
    const tiers = Array.isArray(size.tiers) ? size.tiers : [];
    const tier = tiers.find((entry: any) => qty >= Number(entry?.from || 0) && qty <= Number(entry?.to || Number.MAX_SAFE_INTEGER)) || tiers[tiers.length - 1];
    const tierPrice = Number.parseFloat(String(tier?.pricePerUnit ?? 0));
    if (Number.isFinite(tierPrice) && tierPrice > 0) resolvedBasePrice = tierPrice;
    selectedDetails.push({
      groupId: "product-size",
      groupTitle: String(config.sizeLabel || "Size"),
      choiceId: String(size.id),
      choiceName: String(size.name || "Selected size"),
      price: 0,
      imageUrl: size.imageUrl || undefined,
    });
  }

  for (const selection of selected) {
    if (!selection?.groupId || selection.groupId === "product-size") continue;
    const group = (Array.isArray(config.optionGroups) ? config.optionGroups : []).find((entry: any) => entry?.id === selection.groupId);
    const choice = (Array.isArray(group?.choices) ? group.choices : []).find((entry: any) => entry?.id === selection.choiceId);
    if (!choice) continue;
    const sizeOverride = selectedSize?.choiceId && Array.isArray(choice.sizePrices)
      ? choice.sizePrices.find((override: any) => String(override?.sizeId) === String(selectedSize.choiceId))
      : undefined;
    const choicePrice = Number.parseFloat(String(sizeOverride ? sizeOverride.price : choice.price ?? 0));
    const safeChoicePrice = Number.isFinite(choicePrice) && choicePrice >= 0 ? choicePrice : 0;
    optionTotal += safeChoicePrice;
    selectedDetails.push({
      groupId: String(group.id),
      groupTitle: String(group.title || "Option"),
      choiceId: String(choice.id),
      choiceName: String(choice.name || "Selected option"),
      price: safeChoicePrice,
      imageUrl: choice.imageUrls?.[0] || choice.imageUrl || undefined,
    });
  }

  return {
    unitPrice: resolvedBasePrice + optionTotal,
    selectedDetails,
  };
}

const TRACKING_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 to avoid confusion

function randomSuffix(len = 3): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += TRACKING_CHARS[Math.floor(Math.random() * TRACKING_CHARS.length)];
  }
  return out;
}

async function generateOrderId(): Promise<string> {
  const now = new Date();
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const month = months[now.getMonth()];

  // The sequence is seeded from legacy order IDs during startup migration.
  // nextval is O(1) and concurrency-safe, unlike the old full-table scan.
  const { rows } = await pool.query<{ seq: string }>("SELECT nextval('order_number_seq') AS seq");
  const nextSeq = Number(rows[0]?.seq) || 1;
  const padded = String(nextSeq).padStart(4, "0");
  // Append a 3-char random alphanumeric suffix so customers cannot enumerate
  // adjacent order IDs and access other customers' details.
  return `HS-${month}-${padded}-${randomSuffix()}`;
}

function normalizedPhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

async function requireOrderAccess(req: any, res: any, next: any) {
  try {
    const orderId = String(req.params.orderId || "");
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const suppliedPhone = normalizedPhone(req.get("x-order-phone"));
    const savedPhone = normalizedPhone(order.customerPhone);
    if (!suppliedPhone || suppliedPhone.length < 7 || suppliedPhone !== savedPhone) {
      return res.status(403).json({ error: "Order ID and phone number do not match" });
    }

    req.trackedOrder = order;
    next();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to verify order access" });
  }
}

function serializeOrder(o: any) {
  return {
    ...o,
    items: parseArr(o.items),
    designLinks: parseArr(o.designLinks),
    designPreviews: parseDesignPreviews(o.designLinks),
    attachments: parseArr(o.attachments),
    statusHistory: parseArr(o.statusHistory),
    onlineDeliveryFiles: parseArr(o.onlineDeliveryFiles),
    onlineDeliveryLinks: parseArr(o.onlineDeliveryLinks),
    tags: parseArr(o.tags),
    createdAt: o.createdAt?.toISOString?.() ?? o.createdAt,
    updatedAt: o.updatedAt?.toISOString?.() ?? o.updatedAt,
  };
}

function publicInvoiceMetadata(raw: string | null | undefined): string {
  try {
    const metadata = JSON.parse(raw || "{}");
    const form = metadata?.form && typeof metadata.form === "object"
      ? Object.fromEntries(Object.entries(metadata.form).filter(([key]) => !["internalNotes"].includes(key)))
      : metadata?.form;
    const items = Array.isArray(metadata?.items) ? metadata.items.map((item: any) => {
      const { costPrice: _costPrice, costComponents: _costComponents, deductStock: _deductStock, ...customerItem } = item || {};
      return customerItem;
    }) : [];
    return JSON.stringify({ ...metadata, form, items });
  } catch {
    return JSON.stringify({ items: [] });
  }
}

function linkedInvoiceEmailSnapshot(invoice: typeof invoicesTable.$inferSelect) {
  const amount = (value: unknown) => parseFloat(String(value ?? "0").replace(/[^0-9.-]/g, "")) || 0;
  let meta: any = {};
  try { meta = JSON.parse(invoice.metadata || "{}"); } catch { meta = {}; }

  const items = (Array.isArray(meta.items) ? meta.items : []).map((item: any) => ({
    name: item.description || item.name || "Item",
    quantity: Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1),
    price: amount(item.unitPrice ?? item.price),
    size: item.size || undefined,
    description: item.notes || item.description || undefined,
  }));
  const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0);

  let shipping = 0;
  if (meta.shipping === "custom") shipping = amount(meta.shippingCustom);
  else if (meta.shipping === "standard") shipping = amount(meta.standardRate ?? 350);
  else if (meta.shipping === "express") shipping = amount(meta.expressRate ?? 530);
  else if (meta.shipping === "weight") {
    const kg = amount(meta.weightKg);
    if (kg > 0) {
      const first = amount(meta.firstKgRate ?? meta.ratePerKg ?? 0);
      const additional = amount(meta.addKgRate ?? meta.ratePerKg ?? 0);
      shipping = first + Math.ceil(Math.max(0, kg - 1)) * additional;
    }
  }

  const storedAmount = amount(invoice.amount);
  const metadataTotal = amount(meta.grandTotal ?? meta.totalAmount ?? meta.total);
  return {
    items,
    totalAmount: storedAmount > 0 ? storedAmount : metadataTotal > 0 ? metadataTotal : subtotal + shipping,
  };
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, type } = req.query;
    const conditions: any[] = [isNull(ordersTable.deletedAt)];
    if (status) conditions.push(eq(ordersTable.status, status as string));
    if (type) conditions.push(eq(ordersTable.orderType, type as string));
    const orders = await db.select().from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt));
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    res.json(orders.map(serializeOrder));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyyMMdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  // A six-character suffix gives hundreds of millions of combinations while
  // avoiding the old 1–8 sequential uniqueness queries on every checkout.
  // The invoiceNumber unique constraint remains the final safeguard.
  return `HS-INV-${yyyyMMdd}-${randomSuffix(6)}`;
}

router.post("/", async (req, res) => {
  try {
    const {
      customerName, customerPhone, customerEmail, customerAddress,
      orderType = "standard", items = [], designLinks = [], attachments = [],
      notes, shippingMethod, serviceTypeId,
      dueDate, startDate, priority, advancePaid, tags,
      paymentMethod = "bank_transfer", paymentAmount = 0,
      // couponCode: validated server-side; discountAmount is only used for
      // admin-created orders (when the caller is authenticated as admin).
      couponCode,
      // Optional invoice handling. Defaults preserve the original behaviour
      // (auto-create a fresh invoice) so customer checkout keeps working
      // unchanged. The admin "New Order" modal now passes autoInvoice=false
      // and optionally linkInvoiceId to attach an existing manual invoice.
      autoInvoice = true,
      linkInvoiceId,
    } = req.body;

    // ── Pre-computation: trusted item total from DB prices ───────────────────
    // This runs outside the transaction so the heavy product lookup doesn't
    // hold a transaction open, but the actual coupon *claim* is atomic inside.
    const adminAuth = getAdminAuth(req);
    const clientDiscountAmount = req.body.discountAmount;
    const normalizedPaymentMethod = ["bank_transfer", "full_payment", "cod"].includes(String(paymentMethod))
      ? String(paymentMethod)
      : "bank_transfer";

    const requestedItems = Array.isArray(items) ? items : [];
    let trustedItems = requestedItems;
    let productMap = new Map<number, any>();
    const productIds = requestedItems
      .map((it: any) => Number(it.productId)).filter((id: number) => Number.isFinite(id) && id > 0);
    const dbProductsPromise = !adminAuth && productIds.length > 0
      ? db.select({ id: productsTable.id, name: productsTable.name, price: productsTable.price, active: productsTable.active, customConfig: productsTable.customConfig, invoiceName: productsTable.invoiceName })
        .from(productsTable).where(inArray(productsTable.id, productIds))
      : Promise.resolve([] as any[]);
    // Settings do not depend on the product lookup; start both reads together
    // so checkout avoids an unnecessary serial database round trip.
    const checkoutSettingsPromise = db.select().from(settingsTable).limit(1);
    if (!adminAuth && requestedItems.length > 0) {
      const dbProducts = await dbProductsPromise;
      productMap = new Map(dbProducts.map(product => [product.id, product]));

      trustedItems = requestedItems.map((item: any) => {
        const product = productMap.get(Number(item.productId));
        if (!product || !product.active) return { ...item, productId: null, unitPrice: 0 };
        const quantity = Math.max(1, Number(item.quantity ?? 1) || 1);
        const resolved = resolveProductLine(
          product.customConfig,
          item.selectedOptions,
          quantity,
          Number.parseFloat(String(product.price)) || 0,
        );
        return {
          ...item,
          productName: product.name,
          quantity,
          unitPrice: resolved.unitPrice,
          selectedDetails: resolved.selectedDetails,
        };
      });
    }

    const itemTotalForCoupon = trustedItems.reduce((sum: number, item: any) => {
      const qty = Math.max(1, Number(item.quantity ?? 1) || 1);
      const price = Number.parseFloat(String(item.unitPrice ?? item.price ?? 0)) || 0;
      return sum + qty * price;
    }, 0);

    let productOfferDiscount = 0;
    if (!adminAuth && requestedItems.length > 0 && (normalizedPaymentMethod === "cod" || normalizedPaymentMethod === "full_payment")) {
      const cartProducts = requestedItems.map((item: any) => productMap.get(Number(item.productId)));
      if (cartProducts.some(product => !product || !product.active)) {
        return res.status(400).json({ error: "One or more products in your cart are no longer available. Please refresh your cart." });
      }
      const rules = cartProducts.map(product => parseProductPaymentRules(product.customConfig));
      if (normalizedPaymentMethod === "cod" && !rules.every(rule => rule.codEnabled)) {
        return res.status(400).json({ error: "Cash on delivery is not available for every product in this order." });
      }
      if (normalizedPaymentMethod === "full_payment") {
        if (!rules.every(rule => rule.fullPaymentOfferEnabled)) {
          return res.status(400).json({ error: "The full-payment offer is not available for every product in this order." });
        }
        productOfferDiscount = trustedItems.reduce((sum: number, item: any) => {
          const product = productMap.get(Number(item.productId));
          const rule = parseProductPaymentRules(product?.customConfig);
          const qty = Math.max(1, Number(item.quantity ?? 1) || 1);
          const price = Number.parseFloat(String(item.unitPrice ?? item.price ?? 0)) || 0;
          const lineTotal = Math.max(0, qty * price);
          return sum + Math.min(lineTotal, lineTotal * rule.fullPaymentOfferDiscount / 100);
        }, 0);
      }
    }

    const [checkoutSettings] = await checkoutSettingsPromise;
    const deliveryConfig = {
      courier: {
        enabled: Number(checkoutSettings?.checkoutCourierEnabled ?? 1) !== 0,
        label: String(checkoutSettings?.checkoutCourierLabel || "Studio courier"),
        charge: Math.max(0, Number.parseFloat(String(checkoutSettings?.courierCharge ?? "450")) || 450),
      },
      sl_post: {
        enabled: Number(checkoutSettings?.checkoutSlPostEnabled ?? 1) !== 0,
        label: String(checkoutSettings?.checkoutSlPostLabel || "Sri Lanka Post"),
        charge: Math.max(0, Number.parseFloat(String(checkoutSettings?.slPostCharge ?? "250")) || 250),
      },
      pickup: {
        enabled: Number(checkoutSettings?.checkoutPickupEnabled ?? 0) !== 0,
        label: String(checkoutSettings?.checkoutPickupLabel || "Studio pickup"),
        charge: 0,
      },
    } as const;
    const deliveryKey = String(shippingMethod || "") as keyof typeof deliveryConfig;
    const selectedDeliveryConfig = deliveryConfig[deliveryKey];
    if (!adminAuth && (!selectedDeliveryConfig || !selectedDeliveryConfig.enabled)) {
      return res.status(400).json({ error: "The selected delivery method is currently unavailable. Please refresh checkout and choose another option." });
    }

    // Resolve the invoice we are linking to (if any) BEFORE the transaction
    // so we can fail fast on bad input without rolling back.
    let invoiceToLink: typeof invoicesTable.$inferSelect | null = null;
    if (linkInvoiceId !== undefined && linkInvoiceId !== null && linkInvoiceId !== "") {
      const linkId = Number(linkInvoiceId);
      if (!Number.isFinite(linkId) || linkId <= 0) {
        return res.status(400).json({ error: "Invalid linkInvoiceId" });
      }
      const [found] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, linkId)).limit(1);
      if (!found) return res.status(404).json({ error: "Invoice to link not found" });
      if (found.deletedAt) return res.status(400).json({ error: "Cannot link a deleted invoice" });
      if (found.orderId) return res.status(409).json({ error: `Invoice ${found.invoiceNumber} is already linked to order ${found.orderId}` });
      invoiceToLink = found;
    }

    const orderId = await generateOrderId();
    const statusHistory = JSON.stringify([{ status: "submitted", timestamp: new Date().toISOString(), note: "Order request submitted" }]);

    // ── Atomic coupon claim + order insert in a single transaction ────────────
    // The conditional UPDATE increments usedCount only when all eligibility
    // conditions still hold at commit time, preventing overselling under
    // concurrent requests.  If the claim fails the transaction is rolled back
    // and the order is never created.
    let discountAmount = Math.max(0, Math.round(productOfferDiscount));

    let order: typeof ordersTable.$inferSelect;
    try {
      [order] = await db.transaction(async (tx) => {
        if (couponCode) {
          const code = String(couponCode).toUpperCase().trim().slice(0, 100);
          // Single conditional UPDATE: claim the coupon slot atomically.
          // Only proceeds when active, not expired, under max-use cap, and
          // order total meets the minimum requirement.
          const [claimed] = await tx
            .update(couponsTable)
            .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
            .where(sql`
              ${couponsTable.code} = ${code}
              AND ${couponsTable.isActive} = 1
              AND (${couponsTable.expiresAt} IS NULL OR ${couponsTable.expiresAt} > NOW())
              AND (${couponsTable.maxUses} IS NULL OR ${couponsTable.usedCount} < ${couponsTable.maxUses})
              AND (${couponsTable.minOrder} IS NULL OR ${itemTotalForCoupon} >= ${couponsTable.minOrder})
            `)
            .returning();

          if (!claimed) {
            throw Object.assign(
              new Error("Coupon is not valid, has expired, or the usage limit has been reached"),
              { couponError: true, status: 400 }
            );
          }

          // Derive discount from the claimed coupon row — never from client data
          const couponType = String(claimed.type ?? "");
          const couponValue = Number(claimed.value);
          if (!["percentage", "fixed"].includes(couponType) || !Number.isFinite(couponValue) || couponValue < 0) {
            throw new Error("Invalid coupon configuration");
          }
          const rawDiscount = couponType === "percentage"
            ? Math.round(Math.min(100, couponValue) * itemTotalForCoupon / 100)
            : Math.min(couponValue, itemTotalForCoupon);
          discountAmount = Math.min(itemTotalForCoupon, Math.max(0, discountAmount + rawDiscount));
        } else if (adminAuth && Number.isFinite(Number(clientDiscountAmount))) {
          // Admin-created orders may supply a manual discount — still bounded
          discountAmount = Math.max(0, Math.round(Number(clientDiscountAmount)));
        }

        return tx.insert(ordersTable).values({
          orderId,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress: customerAddress || "",
          orderType,
          items: JSON.stringify(trustedItems),
          designLinks: JSON.stringify(designLinks),
          attachments: JSON.stringify(attachments),
          status: "submitted",
          adminNotes: notes,
          statusHistory,
          shippingMethod: shippingMethod || null,
          serviceTypeId: serviceTypeId ? Number(serviceTypeId) : null,
          dueDate: dueDate || null,
          startDate: startDate || null,
          priority: priority || null,
          discountAmount,
          advancePaid: Number.isFinite(Number(advancePaid)) ? Math.max(0, Math.round(Number(advancePaid))) : 0,
          tags: JSON.stringify(Array.isArray(tags) ? tags : []),
          paymentMethod: normalizedPaymentMethod,
          paymentAmount: Number.isFinite(Number(paymentAmount)) ? Math.max(0, Math.round(Number(paymentAmount))) : 0,
          paymentStatus: normalizedPaymentMethod === "cod" ? "cod_pending" : "pending",
          paymentProofStatus: "not_uploaded",
        }).returning();
      });
    } catch (txErr: any) {
      if (txErr?.couponError) {
        return res.status(txErr.status ?? 400).json({ error: txErr.message });
      }
      throw txErr; // re-throw for the outer catch handler
    }

    // Fire-and-forget admin email notification. Reads recipients + enabled
    // flag from settings; never blocks the response and swallows errors so
    // a flaky SMTP can never break order creation.
    //
    // When the order is created via the admin "Link to existing invoice"
    // flow the order row itself carries no items (line items live on the
    // linked invoice). In that case we pull the items + total from the
    // invoice metadata so the email is never just "No line items / Rs.
    // 0.00".
    void (async () => {
      try {
        const settingsRow = checkoutSettings;
        const enabled = (settingsRow?.orderEmailNotificationsEnabled ?? 1) !== 0;
        const recipients = String(settingsRow?.orderEmailRecipients ?? "")
          .split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
        if (!enabled || recipients.length === 0) return;
        let itemsAny = trustedItems as any[];
        const shippingMethodVal = selectedDeliveryConfig?.label || null;
        let itemTotal = itemsAny.reduce((s, it) => {
          const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
          const unit = parseFloat(String(it.unitPrice ?? it.price ?? 0)) || 0;
          return s + qty * unit;
        }, 0);

        if (invoiceToLink && (itemsAny.length === 0 || itemTotal === 0)) {
          const snapshot = linkedInvoiceEmailSnapshot(invoiceToLink);
          if (snapshot.items.length > 0) itemsAny = snapshot.items;
          if (snapshot.totalAmount > 0) itemTotal = snapshot.totalAmount;
        }

        await sendOrderNotificationEmail({
          recipients,
          businessName: settingsRow?.businessName || "HAVESTORY",
          credentials: {
            user: (settingsRow as any)?.gmailUser ?? null,
            pass: (settingsRow as any)?.gmailAppPassword ?? null,
          },
          payload: {
            orderId,
            customerName: customerName || "Unknown",
            customerPhone: customerPhone || null,
            customerEmail: customerEmail || null,
            customerAddress: customerAddress || null,
            orderType: orderType || null,
            items: itemsAny.map((it: any) => ({ ...it, description: it.notes || it.description || undefined })),
            notes: notes || null,
            shippingMethod: shippingMethodVal,
            totalAmount: itemTotal,
          },
          log: (msg, extra) => req.log.info(extra ?? {}, msg),
          errorLog: (msg, extra) => req.log.error(extra ?? {}, msg),
        });
      } catch (mailErr) {
        req.log.error({ err: mailErr, orderId }, "Order email notification crashed");
      }
    })();

    // Fire-and-forget customer confirmation email (only if they provided an
    // email address). Uses the same payload as the admin notification.
    if (customerEmail) {
      void (async () => {
        try {
          const settingsRow = checkoutSettings;
          const shipCost = selectedDeliveryConfig?.charge || 0;
          const disc = Number.isFinite(Number(discountAmount)) ? Math.max(0, Math.round(Number(discountAmount))) : 0;
          let itemsAny = trustedItems as any[];
          let itemTotal = itemsAny.reduce((s: number, it: any) => {
            const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
            const unit = parseFloat(String(it.unitPrice ?? it.price ?? 0)) || 0;
            return s + qty * unit;
          }, 0);
          if (invoiceToLink && (itemsAny.length === 0 || itemTotal === 0)) {
            const snapshot = linkedInvoiceEmailSnapshot(invoiceToLink);
            if (snapshot.items.length > 0) itemsAny = snapshot.items;
            if (snapshot.totalAmount > 0) itemTotal = snapshot.totalAmount;
          }

          let bankDetails: { bankName?: string; accountHolder?: string; accountNumber?: string; branch?: string }[] = [];
          try { bankDetails = JSON.parse(settingsRow?.bankDetails || "[]"); } catch { /* ignore */ }

          const website = (settingsRow?.website || "")
            .trim()
            .replace(/^https?:?\/+/i, "")
            .replace(/\/+$/, "");
          const trackingUrl = website
            ? `https://${website}/track-order?id=${encodeURIComponent(orderId)}`
            : "";

          await sendCustomerConfirmationEmail({
            customerEmail,
            businessName: settingsRow?.businessName || "HAVESTORY",
            shippingCost: shipCost,
            discountAmount: disc,
            bankDetails,
            trackingUrl,
            payload: {
              orderId,
              customerName: customerName || "Customer",
              customerPhone: customerPhone || null,
              customerEmail: customerEmail || null,
              customerAddress: customerAddress || null,
              orderType: orderType || null,
              items: itemsAny.map((it: any) => ({ ...it, description: it.notes || it.description || undefined })),
              notes: notes || null,
              shippingMethod: shippingMethod || null,
              totalAmount: itemTotal,
            },
            log: (msg, extra) => req.log.info(extra ?? {}, msg),
            errorLog: (msg, extra) => req.log.error(extra ?? {}, msg),
          });
        } catch (custMailErr) {
          req.log.error({ err: custMailErr, orderId }, "Customer confirmation email crashed");
        }
      })();
    }

    // Three invoice paths after the order row is saved:
    //   1) linkInvoiceId set → attach the existing manual invoice to this order
    //   2) autoInvoice === false → caller wants no invoice yet
    //   3) otherwise → preserve the legacy auto-generate-from-items behaviour
    //      (used by the customer-facing checkout flow)
    if (invoiceToLink) {
      try {
        await db.update(invoicesTable)
          .set({ orderId, clientName: invoiceToLink.clientName || customerName || "Unknown" })
          .where(eq(invoicesTable.id, invoiceToLink.id));
        req.log.info({ orderId, invoiceId: invoiceToLink.id, invoiceNumber: invoiceToLink.invoiceNumber }, "Linked existing invoice to new order");
      } catch (linkErr) {
        req.log.error({ err: linkErr, orderId, invoiceId: invoiceToLink.id }, "Failed to link existing invoice");
      }
      return res.status(201).json(serializeOrder(order));
    }
    if (autoInvoice === false || autoInvoice === "false") {
      req.log.info({ orderId }, "Order created without auto-invoice (autoInvoice=false)");
      return res.status(201).json(serializeOrder(order));
    }

    // Auto-create / upsert customer profile in the clients database for every
    // online order (non-admin). Uses phone number as the dedup key — if a client
    // with this phone already exists we leave them unchanged; otherwise we create
    // a new record. Errors are swallowed so client creation never blocks the order.
    if (customerPhone || customerEmail) {
      void (async () => {
        try {
          const normPhone = (customerPhone || "").trim().replace(/\s+/g, "");
          if (normPhone) {
            const [existing] = await db
              .select({ id: clientsTable.id, deletedAt: clientsTable.deletedAt })
              .from(clientsTable)
              .where(eq(clientsTable.phone, normPhone))
              .limit(1);
            if (!existing || existing.deletedAt) {
              await db.insert(clientsTable).values({
                name: customerName || normPhone,
                phone: normPhone,
                email: (customerEmail || "").trim() || null,
                address: (customerAddress || "").trim() || null,
                approved: true,
              });
              req.log.info({ orderId, phone: normPhone }, "Auto-created client profile from online order");
            }
          }
        } catch (clientErr) {
          req.log.warn({ err: clientErr, orderId }, "Auto-client upsert failed");
        }
      })();
    }

        // Auto-generate invoice for every new order. We swallow errors so the
    // order itself still succeeds, but we log at ERROR level so silent
    // invoice failures show up in production logs (Vercel function logs).
    try {
      const shippingAmount = selectedDeliveryConfig?.charge || 0;

      // Build line items — use product invoiceName if set, and include any
      // extra options / size info appearing after the base product name.
      const productIdSet = [...new Set(
        (trustedItems as any[])
          .map((it: any) => Number(it.productId))
          .filter(n => Number.isFinite(n) && n > 0)
      )];
      const productInvoiceNameMap: Record<number, string> = {};
      for (const pid of productIdSet) {
        const invoiceName = productMap.get(pid)?.invoiceName;
        if (invoiceName) productInvoiceNameMap[pid] = invoiceName;
      }
      // Admin-created orders may bypass the customer product lookup. Only
      // fetch invoice names in that path; customer checkout already selected
      // them in the initial trusted-price query above.
      if (productIdSet.length > 0 && Object.keys(productInvoiceNameMap).length === 0 && adminAuth) {
        try {
          const fetchedProducts = await db
            .select({ id: productsTable.id, invoiceName: productsTable.invoiceName })
            .from(productsTable)
            .where(inArray(productsTable.id, productIdSet));
          for (const p of fetchedProducts) {
            if (p.invoiceName) productInvoiceNameMap[p.id] = p.invoiceName;
          }
        } catch (pErr) {
          req.log.warn({ err: pErr }, "Auto-invoice: could not fetch product invoiceNames");
        }
      }

      const lineItems = (trustedItems as any[]).map((it: any) => {
        const rawName: string = it.name ?? it.productName ?? "Item";
        const pid = Number(it.productId);
        let description: string;
        if (Number.isFinite(pid) && pid > 0 && productInvoiceNameMap[pid]) {
          // Replace the base product name with the shorter invoice name,
          // keeping any trailing options/size info (e.g. " — Glossy (100 pcs)").
          const invoiceName = productInvoiceNameMap[pid];
          const sepIdx = rawName.indexOf(" — ");
          const extras = sepIdx > -1 ? rawName.slice(sepIdx) : "";
          description = invoiceName + extras;
        } else {
          description = rawName;
        }
        const selectedDetails = Array.isArray(it.selectedDetails) ? it.selectedDetails : [];
        const baseNotes = String(it.notes ?? "").trim();
        return {
          id: randomUUID(),
          description,
          qty: Number(it.quantity ?? it.qty ?? 1) || 1,
          unitPrice: String(parseFloat(String(it.unitPrice ?? it.price ?? 0)) || 0),
          notes: baseNotes,
          selectedOptions: selectedDetails,
          imageUrl: it.imageUrl || undefined,
        };
      });

      const itemAmount = lineItems.reduce(
        (s: number, it: any) => s + (parseFloat(it.unitPrice) * it.qty),
        0
      );
      // Apply discount + advance from the order so the auto-invoice matches
      // what the customer/admin actually agreed. Discount is already a final
      // Rs. value (percentage resolved client-side).
      const discAmt = Math.max(0, Math.floor(Number(discountAmount) || 0));
      const advAmt = Math.max(0, Math.floor(Number(advancePaid) || 0));
      const totalAmount = Math.max(0, itemAmount + shippingAmount - discAmt);

      // Human-readable shipping method label for the invoice
      const shippingLabel = selectedDeliveryConfig?.label || "";

      // Build structured metadata so InvoicePreview renders correctly.
      // projectTitle is kept for backward compatibility with legacy invoices
      // but the Order ID is now displayed natively in the ORDER DETAILS
      // panel via invoice.orderId, so we no longer mirror it here.
      const metaForm = {
        clientName:      customerName  || "",
        phone:           customerPhone || "",
        email:           customerEmail || "",
        address:         customerAddress || "",
        businessName:    "",
        projectTitle:    "",
        additionalNotes: "",
        internalNotes:   "",
      };
      const metadata = JSON.stringify({
        form:           metaForm,
        items:          lineItems,
        shipping:       shippingAmount > 0 ? "custom" : "none",
        shippingCustom: String(shippingAmount),
        shippingLabel,
        weightKg:       "",
        ratePerKg:      "120",
        advance:        String(advAmt),
        discount:       String(discAmt),
      });

      // partial if any advance has been recorded against the total, else pending.
      const initialStatus = advAmt > 0 && totalAmount > 0
        ? (advAmt >= totalAmount ? "paid" : "partial")
        : "pending";

      const invoiceNumber = await generateInvoiceNumber();
      await db.insert(invoicesTable).values({
        invoiceNumber,
        clientName:    customerName || "Unknown",
        clientPhone:   (customerPhone || "").trim() || null,
        clientEmail:   (customerEmail || "").trim() || null,
        orderId,
        amount:        String(totalAmount),
        status:        initialStatus,
        metadata,
      });
      req.log.info({ orderId, invoiceNumber, totalAmount, status: initialStatus }, "Auto-invoice created");
    } catch (invErr) {
      // Log at ERROR level so the failure is visible in Vercel function logs.
      // The order has already been saved, so we deliberately do not 500 here.
      req.log.error(
        { err: invErr, orderId, customerName, itemCount: (trustedItems as any[]).length },
        "Auto-invoice creation failed",
      );
    }

    res.status(201).json(serializeOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// IMPORTANT: named routes must be before /:id
router.get("/track/:orderId", requireOrderAccess, async (req: any, res) => {
  try {
    const orderId = String(req.params.orderId);
    const order = req.trackedOrder;

    // Look up attached invoice
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.orderId, orderId));

    // Resolve courier tracking URL from settings
    let courierTrackingUrl: string | null = null;
    if (order.courierName && order.courierTrackingNumber) {
      const [settings] = await db.select().from(settingsTable);
      if (settings?.courierServices) {
        try {
          const couriers: { name: string; trackingUrl: string }[] = JSON.parse(settings.courierServices);
          const matched = couriers.find(c => c.name === order.courierName);
          if (matched?.trackingUrl) {
            courierTrackingUrl = matched.trackingUrl;
          }
        } catch {}
      }
    }

    const firstItem = parseArr(order.items)[0];
    const orderDescriptionText =
      order.orderDescription ||
      firstItem?.name ||
      (order.orderType === "custom" ? "Custom Project" : null);

    res.json({
      orderId: order.orderId,
      customerName: order.customerName,
      status: order.status,
      estimatedCompletion: order.estimatedCompletion,
      createdAt: order.createdAt?.toISOString?.() ?? order.createdAt,
      updatedAt: order.updatedAt?.toISOString?.() ?? order.updatedAt,
      statusHistory: parseArr(order.statusHistory),
      orderDescription: orderDescriptionText,
      deliveryMethod: order.deliveryMethod,
      courierName: order.courierName,
      courierTrackingNumber: order.courierTrackingNumber,
      courierTrackingUrl,
      onlineDeliveryFiles: parseArr(order.onlineDeliveryFiles),
      onlineDeliveryLinks: parseArr(order.onlineDeliveryLinks),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentAmount: order.paymentAmount,
      paymentType: (order as any).paymentType,
      paymentSubmittedAmount: (order as any).paymentSubmittedAmount,
      paymentProofStatus: order.paymentProofStatus,
      paymentProofUploadedAt: order.paymentProofUploadedAt?.toISOString?.() ?? order.paymentProofUploadedAt,
      paymentProofExpiresAt: order.paymentProofExpiresAt?.toISOString?.() ?? order.paymentProofExpiresAt,
      paymentApprovedAt: order.paymentApprovedAt?.toISOString?.() ?? order.paymentApprovedAt,
      paymentRejectionReason: order.paymentRejectionReason,
      customerPaymentConfirmedAt: (order as any).customerPaymentConfirmedAt?.toISOString?.() ?? (order as any).customerPaymentConfirmedAt,
      designPreviews: publicDesignPreviews(order),
      invoice: invoice ? {
        invoiceNumber: invoice.invoiceNumber,
        amount:        invoice.amount,
        status:        invoice.status,
        createdAt:     invoice.createdAt?.toISOString?.() ?? invoice.createdAt,
      } : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to track order" });
  }
});

// Customer uploads design files (no auth)
router.post("/track/:orderId/design-files", requireOrderAccess, upload.array("files", 10), async (req: any, res) => {
  try {
    const orderId = String(req.params.orderId);
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const order = req.trackedOrder;

    const existing = parseArr(order.attachments) as any[];
    const uploaded = await Promise.all(
      files.map((f) => uploadToCloudinary(f.buffer, "havestory/design-files", f.originalname))
    );
    const newFiles = uploaded.map((u) => ({ url: u.url, name: u.name }));
    const merged = [...existing, ...newFiles];

    await db.update(ordersTable)
      .set({ attachments: JSON.stringify(merged), updatedAt: new Date() })
      .where(eq(ordersTable.orderId, orderId));

    res.json({ files: newFiles, total: merged.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload design files" });
  }
});

// Customer uploads payment proof (no auth)
router.post("/track/:orderId/payment-proof", requireOrderAccess, upload.single("file"), async (req: any, res) => {
  try {
    const orderId = String(req.params.orderId);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const order = req.trackedOrder;
    const paymentType = String(req.body?.paymentType || "").toLowerCase();
    const paymentAmount = Number(req.body?.paymentAmount);
    if (!["advance", "full", "custom"].includes(paymentType) || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "Choose a payment type and enter a valid payment amount" });
    }
    const [linkedInvoice] = await db.select({ amount: invoicesTable.amount }).from(invoicesTable).where(eq(invoicesTable.orderId, orderId)).limit(1);
    const invoiceTotal = Number(String(linkedInvoice?.amount || order.paymentAmount || 0).replace(/[^0-9.-]/g, "")) || 0;
    if (invoiceTotal > 0 && paymentAmount > invoiceTotal) {
      return res.status(400).json({ error: `Payment amount cannot exceed the invoice total of Rs. ${invoiceTotal.toLocaleString("en-LK")}` });
    }

    const { url: fileUrl } = await uploadToCloudinary(req.file.buffer, "havestory/payment-proofs", req.file.originalname);
    const uploadedAt = new Date();
    const expiresAt = new Date(uploadedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    await db.update(ordersTable)
      .set({
        paymentProofUrl: fileUrl,
        paymentProofStatus: "uploaded",
        paymentProofUploadedAt: uploadedAt,
        paymentProofExpiresAt: expiresAt,
        paymentType: paymentType as any,
        paymentSubmittedAmount: Math.round(paymentAmount),
        paymentRejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.orderId, orderId));

    res.json({ url: fileUrl, status: "uploaded", expiresAt: expiresAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload payment proof" });
  }
});

// Customer confirms that the transfer/payment has been made. Admin approval
// remains required before the order moves into production.
router.post("/track/:orderId/payment-confirm", requireOrderAccess, async (req: any, res) => {
  try {
    const orderId = String(req.params.orderId);
    const order = req.trackedOrder;
    if (order.paymentMethod === "cod") {
      return res.status(400).json({ error: "COD orders do not require payment confirmation" });
    }
    const paymentType = String(req.body?.paymentType || "").toLowerCase();
    const paymentAmount = Number(req.body?.paymentAmount);
    if (!["advance", "full", "custom"].includes(paymentType)) {
      return res.status(400).json({ error: "Choose advance, full, or custom payment type" });
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "Enter a valid payment amount" });
    }
    const [linkedInvoice] = await db.select({ amount: invoicesTable.amount }).from(invoicesTable).where(eq(invoicesTable.orderId, orderId)).limit(1);
    const invoiceTotal = Number(String(linkedInvoice?.amount || order.paymentAmount || 0).replace(/[^0-9.-]/g, "")) || 0;
    if (invoiceTotal > 0 && paymentAmount > invoiceTotal) {
      return res.status(400).json({ error: `Payment amount cannot exceed the invoice total of Rs. ${invoiceTotal.toLocaleString("en-LK")}` });
    }
    const [updated] = await db.update(ordersTable).set({
      paymentStatus: "customer_confirmed",
      paymentType,
      paymentSubmittedAmount: paymentAmount.toFixed(2),
      customerPaymentConfirmedAt: new Date(),
      paymentProofStatus: order.paymentProofUrl ? "uploaded" : order.paymentProofStatus,
      updatedAt: new Date(),
    } as any).where(eq(ordersTable.orderId, orderId)).returning();
    res.json({ ok: true, order: serializeOrder(updated) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

// Admin uploads multiple online delivery files (requires auth)
router.post("/:id/online-files", upload.array("files", 20), async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

    const id = String(req.params.id);
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const idNum = parseInt(id);
    const [order] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));

    if (!order) return res.status(404).json({ error: "Order not found" });

    const existingFiles = parseArr(order.onlineDeliveryFiles);
    const uploadedFiles = await Promise.all(
      (req.files as Express.Multer.File[]).map((f) =>
        uploadToCloudinary(f.buffer, "havestory/delivery-files", f.originalname)
      )
    );
    const newFiles = uploadedFiles.map((u) => ({ url: u.url, name: u.name }));
    const allFiles = [...existingFiles, ...newFiles];

    await db.update(ordersTable)
      .set({ onlineDeliveryFiles: JSON.stringify(allFiles), updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    res.json({ files: allFiles });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload files" });
  }
});

// Admin removes a specific online delivery file (requires auth)
router.delete("/:id/online-files", async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

    const id = String(req.params.id);
    const { url } = req.body;

    const idNum = parseInt(id);
    const [order] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));

    if (!order) return res.status(404).json({ error: "Order not found" });

    const files = parseArr(order.onlineDeliveryFiles).filter((f: any) => f.url !== url);
    await db.update(ordersTable)
      .set({ onlineDeliveryFiles: JSON.stringify(files), updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    res.json({ files });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to remove file" });
  }
});

// Admin approves or rejects a customer payment proof. Approval is separate from
// upload so no order is processed until the business reviews the transfer.
router.post("/:id/payment-review", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const action = String(req.body?.action || "");
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "Action must be approve or reject" });
    const paymentType = String(req.body?.paymentType || "").toLowerCase();
    const approvedAmount = Number(req.body?.approvedAmount);
    if (action === "approve" && !["advance", "full", "custom"].includes(paymentType)) {
      return res.status(400).json({ error: "Choose advance, full, or custom payment type" });
    }
    if (action === "approve" && (!Number.isFinite(approvedAmount) || approvedAmount <= 0)) {
      return res.status(400).json({ error: "Enter a valid approved payment amount" });
    }
    const idNum = parseInt(id);
    const [order] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));
    if (!order) return res.status(404).json({ error: "Order not found" });

    let linkedInvoice: any = null;
    let invoiceTotal = Math.max(0, Number(order.paymentAmount || 0) || 0);
    if (order.orderId) {
      [linkedInvoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.orderId, order.orderId)).limit(1);
      if (linkedInvoice) invoiceTotal = Math.max(0, Number(String(linkedInvoice.amount || 0).replace(/[^0-9.-]/g, "")) || 0);
    }
    if (action === "approve" && invoiceTotal > 0 && approvedAmount > invoiceTotal) {
      return res.status(400).json({ error: `Approved amount cannot exceed the invoice total of Rs. ${invoiceTotal.toLocaleString("en-LK")}` });
    }

    const updateData: any = {
      paymentProofStatus: action === "approve" ? "approved" : "rejected",
      paymentStatus: action === "approve" ? "paid" : "payment_action_required",
      paymentApprovedAt: action === "approve" ? new Date() : null,
      paymentRejectionReason: action === "reject" ? String(req.body?.reason || "Payment proof needs review") : null,
      ...(action === "approve" ? { paymentType, paymentSubmittedAmount: Math.round(approvedAmount) } : {}),
      updatedAt: new Date(),
    };
    const [updated] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, order.id)).returning();

    if (action === "approve" && linkedInvoice) {
      let metadata: any = {};
      try { metadata = JSON.parse(linkedInvoice.metadata || "{}"); } catch { metadata = {}; }
      const received = Math.min(approvedAmount, invoiceTotal || approvedAmount);
      const invoiceStatus = invoiceTotal > 0 && received >= invoiceTotal ? "paid" : "partial";
      metadata.advance = Number(received.toFixed(2));
      metadata.paymentType = paymentType;
      metadata.paymentReceivedDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const [syncedInvoice] = await db.update(invoicesTable).set({
        status: invoiceStatus,
        metadata: JSON.stringify(metadata),
      }).where(eq(invoicesTable.id, linkedInvoice.id)).returning();
      linkedInvoice = syncedInvoice;
      await syncInvoiceFinance(syncedInvoice).catch((syncErr) => req.log.error(syncErr));
    }
    res.json({ ...serializeOrder(updated), invoice: linkedInvoice ? { amount: linkedInvoice.amount, status: linkedInvoice.status, metadata: publicInvoiceMetadata(linkedInvoice.metadata) } : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to review payment proof" });
  }
});

// Admin uploads a customer-facing design preview (requires auth).
// The preview is stored separately as a typed design-preview entry inside
// designLinks so legacy design links and customer attachments stay untouched.
router.post("/:id/design-preview", upload.single("file"), async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });
    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const idNum = parseInt(id);
    const [order] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { url: previewUrl } = await uploadToCloudinary(req.file.buffer, "havestory/design-previews", req.file.originalname);
    const preview = {
      id: randomUUID(),
      type: "design-preview",
      name: req.file.originalname,
      previewUrl,
      driveUrl: "",
      downloadEnabled: false,
      watermarkText: "HAVESTORY",
      watermarkOpacity: 0.18,
      createdAt: new Date().toISOString(),
    };
    const existing = parseArr(order.designLinks);
    const [updated] = await db.update(ordersTable)
      .set({ designLinks: JSON.stringify([...existing, preview]), updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id))
      .returning();
    res.json({ preview, order: serializeOrder(updated) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload design preview" });
  }
});

// Admin uploads design proof (requires auth)
router.post("/:id/proof-file", upload.single("file"), async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

    const id = String(req.params.id);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const idNum = parseInt(id);
    const [order] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));

    if (!order) return res.status(404).json({ error: "Order not found" });

    const { url: fileUrl } = await uploadToCloudinary(req.file.buffer, "havestory/proof-files", req.file.originalname);
    await db.update(ordersTable)
      .set({ proofFileUrl: fileUrl, proofFileName: req.file.originalname, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    res.json({ url: fileUrl, name: req.file.originalname });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload proof file" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const idNum = parseInt(id);
    const [order] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(serializeOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const idNum = parseInt(id);
    const {
      status, statusNote, adminNotes, estimatedCompletion,
      deliveryMethod, courierName, courierTrackingNumber, orderDescription,
      onlineDeliveryLinks, designLinks, serviceTypeId,
      customerName, customerPhone, customerEmail, customerAddress,
      discountAmount, advancePaid, dueDate, startDate, priority, tags,
    } = req.body;

    const [existing] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));

    if (!existing) return res.status(404).json({ error: "Order not found" });

    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined && status !== existing.status) {
      updateData.status = status;
      const history = parseArr(existing.statusHistory);
      history.push({
        status,
        timestamp: new Date().toISOString(),
        note: typeof statusNote === "string" ? statusNote.trim().slice(0, 240) : "",
      });
      updateData.statusHistory = JSON.stringify(history);
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (estimatedCompletion !== undefined) updateData.estimatedCompletion = estimatedCompletion;
    if (deliveryMethod !== undefined) updateData.deliveryMethod = deliveryMethod || null;
    if (courierName !== undefined) updateData.courierName = courierName || null;
    if (courierTrackingNumber !== undefined) updateData.courierTrackingNumber = courierTrackingNumber || null;
    if (orderDescription !== undefined) updateData.orderDescription = orderDescription || null;
    if (onlineDeliveryLinks !== undefined) updateData.onlineDeliveryLinks = JSON.stringify(onlineDeliveryLinks);
    if (designLinks !== undefined) {
      updateData.designLinks = JSON.stringify(Array.isArray(designLinks) ? designLinks : []);
    }
    if (serviceTypeId !== undefined) updateData.serviceTypeId = serviceTypeId ? Number(serviceTypeId) : null;
    if (customerName !== undefined) {
      const trimmed = String(customerName ?? "").trim();
      if (!trimmed) return res.status(400).json({ error: "Customer name cannot be empty" });
      updateData.customerName = trimmed;
    }
    if (customerPhone !== undefined) {
      const trimmed = String(customerPhone ?? "").trim();
      updateData.customerPhone = trimmed || null;
    }
    if (customerEmail !== undefined) {
      const trimmed = String(customerEmail ?? "").trim();
      updateData.customerEmail = trimmed || null;
    }
    if (customerAddress !== undefined) {
      const trimmed = String(customerAddress ?? "").trim();
      updateData.customerAddress = trimmed || null;
    }
    if (discountAmount !== undefined) updateData.discountAmount = Number.isFinite(Number(discountAmount)) ? Math.max(0, Math.round(Number(discountAmount))) : 0;
    if (advancePaid !== undefined) updateData.advancePaid = Number.isFinite(Number(advancePaid)) ? Math.max(0, Math.round(Number(advancePaid))) : 0;
    if (dueDate !== undefined) updateData.dueDate = dueDate || null;
    if (startDate !== undefined) updateData.startDate = startDate || null;
    if (priority !== undefined) updateData.priority = priority || null;
    if (tags !== undefined) updateData.tags = JSON.stringify(Array.isArray(tags) ? tags : []);

    const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, existing.id)).returning();

    // When an order is marked as completed, automatically mark its
    // attached invoice as paid (only if the status actually transitioned
    // and the invoice is not already paid).
    if (
      status === "completed" &&
      existing.status !== "completed" &&
      order?.orderId
    ) {
      try {
        const [linkedInvoice] = await db
          .select()
          .from(invoicesTable)
          .where(eq(invoicesTable.orderId, order.orderId));
        if (linkedInvoice && linkedInvoice.status !== "paid") {
          await db
            .update(invoicesTable)
            .set({ status: "paid" })
            .where(eq(invoicesTable.id, linkedInvoice.id));
        }
      } catch (invErr) {
        req.log.warn(
          { err: invErr },
          "Failed to auto-mark invoice as paid on order completion (non-fatal)",
        );
      }

      // Fire-and-forget completion email to the customer
      if (order?.customerEmail) {
        void (async () => {
          try {
            const [settingsRow] = await db.select().from(settingsTable);
            const website = (settingsRow?.website || "")
              .trim()
              .replace(/^https?:?\/+/i, "")
              .replace(/\/+$/, "");
            const trackingUrl = website
              ? `https://${website}/track-order?id=${encodeURIComponent(order.orderId)}`
              : "";

            // Build the item payload from stored order items, including per-item notes
            const orderItems = parseArr(order.items) as any[];
            const emailItems = orderItems.map((it: any) => ({
              name: it.name ?? it.productName ?? "Item",
              quantity: Number(it.quantity ?? it.qty ?? 1) || 1,
              price: parseFloat(String(it.unitPrice ?? it.price ?? 0)) || 0,
              description: it.notes || undefined,
              size: it.size || undefined,
            }));

            const itemTotal = emailItems.reduce(
              (s, it) => s + (it.price * it.quantity),
              0
            );

            await sendOrderCompletionEmail({
              customerEmail: order.customerEmail!,
              businessName: settingsRow?.businessName || "HAVESTORY",
              trackingUrl,
              credentials: {
                user: (settingsRow as any)?.gmailUser ?? null,
                pass: (settingsRow as any)?.gmailAppPassword ?? null,
              },
              payload: {
                orderId: order.orderId,
                customerName: order.customerName || "Customer",
                customerPhone: order.customerPhone || null,
                customerEmail: order.customerEmail || null,
                customerAddress: order.customerAddress || null,
                orderType: order.orderType || null,
                items: emailItems,
                notes: order.adminNotes || null,
                shippingMethod: order.shippingMethod || null,
                totalAmount: itemTotal,
              },
              log: (msg, extra) => req.log.info(extra ?? {}, msg),
              errorLog: (msg, extra) => req.log.error(extra ?? {}, msg),
            });
          } catch (completionMailErr) {
            req.log.error({ err: completionMailErr, orderId: order?.orderId }, "Order completion email crashed");
          }
        })();
      }
    }

    res.json(serializeOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// Delete an order (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const idNum = Number(id);
    const [existing] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));
    if (!existing) return res.status(404).json({ error: "Order not found" });
    const deletedAt = new Date();
    await db.update(invoicesTable).set({ deletedAt }).where(eq(invoicesTable.orderId, existing.orderId));
    await db.update(ordersTable).set({ deletedAt, updatedAt: deletedAt }).where(eq(ordersTable.id, existing.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
