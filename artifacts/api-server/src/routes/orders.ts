import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, settingsTable, productsTable, clientsTable } from "@workspace/db/schema";
import { invoicesTable } from "@workspace/db/schema";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import multer from "multer";
import { uploadToCloudinary } from "../lib/cloudinary";
import { randomUUID } from "node:crypto";
import { sendOrderNotificationEmail, sendCustomerConfirmationEmail, sendOrderCompletionEmail } from "../lib/mailer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function parseArr(s: string): any[] {
  try { return JSON.parse(s); } catch { return []; }
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

  // Query all existing orders to determine the next sequential number
  const allOrders = await db.select({ orderId: ordersTable.orderId }).from(ordersTable);

  // Find the highest sequential number used so far (supports all formats:
  //   legacy: PB-MON-NNNN, PB-MON-NNNN-XXX
  //   current: MON-NNNN-XXX)
  let maxSeq = 0;
  for (const o of allOrders) {
    const match = o.orderId?.match(/(?:PB-)?[A-Z]+-(\d{4})(?:-[A-Z0-9]+)?$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }

  // Use max(total order count, highest existing sequence) + 1 as the next number
  const nextSeq = Math.max(maxSeq, allOrders.length) + 1;
  const padded = String(nextSeq).padStart(4, "0");
  // Append a 3-char random alphanumeric suffix so customers cannot enumerate
  // adjacent order IDs and access other customers' details
  return `PB-${month}-${padded}-${randomSuffix()}`;
}

function serializeOrder(o: any) {
  return {
    ...o,
    items: parseArr(o.items),
    designLinks: parseArr(o.designLinks),
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
    res.json(orders.map(serializeOrder));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yyyyMMdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  // Retry on the (rare) case the random suffix collides with an existing
  // invoice number — the DB has a unique constraint on `invoiceNumber`.
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = Math.floor(Math.random() * 900 + 100);
    const candidate = `PB-INV-${yyyyMMdd}-${suffix}`;
    const [existing] = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `PB-INV-${yyyyMMdd}-${Date.now().toString().slice(-6)}`;
}

router.post("/", async (req, res) => {
  try {
    const {
      customerName, customerPhone, customerEmail, customerAddress,
      orderType = "standard", items = [], designLinks = [], attachments = [],
      notes, shippingMethod, serviceTypeId,
      dueDate, startDate, priority, discountAmount, advancePaid, tags,
      // Optional invoice handling. Defaults preserve the original behaviour
      // (auto-create a fresh invoice) so customer checkout keeps working
      // unchanged. The admin "New Order" modal now passes autoInvoice=false
      // and optionally linkInvoiceId to attach an existing manual invoice.
      autoInvoice = true,
      linkInvoiceId,
    } = req.body;

    // Resolve the invoice we are linking to (if any) BEFORE inserting the
    // order so we can fail fast on bad input.
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
    const [order] = await db.insert(ordersTable).values({
      orderId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress: customerAddress || "",
      orderType,
      items: JSON.stringify(items),
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
      discountAmount: Number.isFinite(Number(discountAmount)) ? Math.max(0, Math.round(Number(discountAmount))) : 0,
      advancePaid: Number.isFinite(Number(advancePaid)) ? Math.max(0, Math.round(Number(advancePaid))) : 0,
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
    }).returning();

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
        const [settingsRow] = await db.select().from(settingsTable);
        const enabled = (settingsRow?.orderEmailNotificationsEnabled ?? 1) !== 0;
        const recipients = String(settingsRow?.orderEmailRecipients ?? "")
          .split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
        if (!enabled || recipients.length === 0) return;
        let itemsAny = (Array.isArray(items) ? items : []) as any[];
        const shippingMethodVal = shippingMethod === "courier" ? "courier"
                                : shippingMethod === "sl_post" ? "sl_post"
                                : null;
        let itemTotal = itemsAny.reduce((s, it) => {
          const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
          const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
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
          const [settingsRow] = await db.select().from(settingsTable);
          const courierCh = parseFloat(settingsRow?.courierCharge ?? "450") || 450;
          const slPostCh = parseFloat(settingsRow?.slPostCharge ?? "250") || 250;
          const shipCost = shippingMethod === "courier" ? courierCh
                         : shippingMethod === "sl_post" ? slPostCh : 0;
          const disc = Number.isFinite(Number(discountAmount)) ? Math.max(0, Math.round(Number(discountAmount))) : 0;
          let itemsAny = (Array.isArray(items) ? items : []) as any[];
          let itemTotal = itemsAny.reduce((s: number, it: any) => {
            const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
            const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
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
    let courierCharge = 450;
    let slPostCharge  = 250;
    try {
      const [settings] = await db.select().from(settingsTable);
      courierCharge = parseFloat(settings?.courierCharge ?? "450") || 450;
      slPostCharge  = parseFloat(settings?.slPostCharge  ?? "250") || 250;
    } catch (settingsErr) {
      req.log.warn({ err: settingsErr }, "Auto-invoice: could not read settings, using defaults");
    }

    try {
      const shippingAmount = shippingMethod === "courier" ? courierCharge
                           : shippingMethod === "sl_post"  ? slPostCharge
                           : 0;

      // Build line items — use product invoiceName if set, and include any
      // extra options / size info appearing after the base product name.
      const productIdSet = [...new Set(
        (items as any[])
          .map((it: any) => Number(it.productId))
          .filter(n => Number.isFinite(n) && n > 0)
      )];
      const productInvoiceNameMap: Record<number, string> = {};
      if (productIdSet.length > 0) {
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

      const lineItems = (items as any[]).map((it: any) => {
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
        return {
          id: randomUUID(),
          description,
          qty: Number(it.quantity ?? it.qty ?? 1) || 1,
          unitPrice: String(parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0),
          notes: it.notes ?? "",
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
      const shippingLabel = shippingMethod === "courier" ? "Courier Service"
                          : shippingMethod === "sl_post"  ? "Sri Lanka Post"
                          : "";

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
        { err: invErr, orderId, customerName, itemCount: (items as any[]).length },
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
router.get("/track/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });

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
      customerPhone: order.customerPhone,
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
      paymentProofUrl: order.paymentProofUrl,
      proofFileUrl: order.proofFileUrl,
      proofFileName: order.proofFileName,
      attachments: parseArr(order.attachments),
      invoice: invoice ? {
        invoiceNumber: invoice.invoiceNumber,
        clientName:    invoice.clientName,
        orderId:       invoice.orderId,
        amount:        invoice.amount,
        status:        invoice.status,
        metadata:      publicInvoiceMetadata(invoice.metadata),
        createdAt:     invoice.createdAt?.toISOString?.() ?? invoice.createdAt,
      } : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to track order" });
  }
});

// Customer uploads design files (no auth)
router.post("/track/:orderId/design-files", upload.array("files", 10), async (req, res) => {
  try {
    const { orderId } = req.params;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });

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
router.post("/track/:orderId/payment-proof", upload.single("file"), async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { url: fileUrl } = await uploadToCloudinary(req.file.buffer, "havestory/payment-proofs", req.file.originalname);
    await db.update(ordersTable)
      .set({ paymentProofUrl: fileUrl, updatedAt: new Date() })
      .where(eq(ordersTable.orderId, orderId));

    res.json({ url: fileUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload payment proof" });
  }
});

// Admin uploads multiple online delivery files (requires auth)
router.post("/:id/online-files", upload.array("files", 20), async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;
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

    const id = req.params.id;
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

// Admin uploads design proof (requires auth)
router.post("/:id/proof-file", upload.single("file"), async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

    const id = req.params.id;
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
    const id = req.params.id;
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
    const id = req.params.id;
    const idNum = parseInt(id);
    const {
      status, adminNotes, estimatedCompletion,
      deliveryMethod, courierName, courierTrackingNumber, orderDescription,
      onlineDeliveryLinks, serviceTypeId,
      customerName, customerPhone, customerEmail, customerAddress,
      discountAmount, advancePaid, dueDate, startDate, priority, tags,
    } = req.body;

    const [existing] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));

    if (!existing) return res.status(404).json({ error: "Order not found" });

    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) {
      updateData.status = status;
      const history = parseArr(existing.statusHistory);
      history.push({ status, timestamp: new Date().toISOString(), note: "" });
      updateData.statusHistory = JSON.stringify(history);
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (estimatedCompletion !== undefined) updateData.estimatedCompletion = estimatedCompletion;
    if (deliveryMethod !== undefined) updateData.deliveryMethod = deliveryMethod || null;
    if (courierName !== undefined) updateData.courierName = courierName || null;
    if (courierTrackingNumber !== undefined) updateData.courierTrackingNumber = courierTrackingNumber || null;
    if (orderDescription !== undefined) updateData.orderDescription = orderDescription || null;
    if (onlineDeliveryLinks !== undefined) updateData.onlineDeliveryLinks = JSON.stringify(onlineDeliveryLinks);
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
              price: parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0,
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
router.delete("/:id", async (req, res) => {
  try {
    if (!getAdminAuth(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const idNum = Number(id);
    const [existing] = isNaN(idNum)
      ? await db.select().from(ordersTable).where(eq(ordersTable.orderId, id))
      : await db.select().from(ordersTable).where(eq(ordersTable.id, idNum));
    if (!existing) return res.status(404).json({ error: "Order not found" });
    await db.delete(invoicesTable).where(eq(invoicesTable.orderId, existing.orderId));
    await db.delete(ordersTable).where(eq(ordersTable.id, existing.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
