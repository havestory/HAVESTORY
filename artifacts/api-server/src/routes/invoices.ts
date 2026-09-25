import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { invoicesTable, ordersTable } from "@workspace/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { getAdminAuth, hasPermission, requireAdmin } from "../lib/auth-cookie";
import { removeInvoiceFinance, removeInvoiceMaterialUsage, syncInvoiceFinance, syncInvoiceMaterialUsage } from "./finance-inventory";
import { queueDeletionRequest } from "../lib/team-access";
import { findClientIdByPhone } from "../lib/client-dedupe";
import { generateInvoiceNumber } from "../lib/invoice-number";

const router = Router();

// Every invoice route is admin-only. Customers never need direct access.
router.use(requireAdmin);

function normInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return typeof v === "string" ? v : String(v);
}

function moneyNumber(value: unknown): number {
  const parsed = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

async function resolveInvoiceClientId(clientId: unknown, clientPhone: unknown, orderId: unknown): Promise<number|null> {
  const supplied = normInt(clientId);
  if (supplied != null) return supplied;
  let phone = String(clientPhone || "");
  if (!phone && orderId) {
    const [order] = await db.select({ phone: ordersTable.customerPhone }).from(ordersTable).where(eq(ordersTable.orderId, String(orderId))).limit(1);
    phone = order?.phone || "";
  }
  return phone ? await findClientIdByPhone(phone) : null;
}

function parseMetadata(value: unknown): any {
  try { return typeof value === "string" ? JSON.parse(value) : (value || {}); } catch { return {}; }
}

/**
 * A customer may hand over more money than the invoice total. The invoice itself
 * must never carry a payment greater than its total because finance/status logic
 * treats `advance` as the amount applied to this invoice. Keep the excess as
 * customer credit instead of rejecting the invoice.
 *
 * Example: invoice 1,000 / customer paid 1,500
 *   advance            = 1,000 (applied to invoice)
 *   paymentReceived    = 1,500 (what the customer actually paid)
 *   customerCredit     =   500 (available customer credit / overpayment)
 */
function normalizePaymentMetadata(value: unknown, invoiceAmount: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return value as null | "";
  const meta = parseMetadata(value);
  const total = moneyNumber(invoiceAmount);
  const supplied = moneyNumber(meta.paymentReceivedTotal ?? meta.paymentReceived ?? meta.advance);
  const applied = total > 0 ? Math.min(supplied, total) : supplied;
  const credit = total > 0 ? Math.max(0, supplied - total) : 0;
  return JSON.stringify({
    ...meta,
    advance: String(applied),
    paymentReceivedTotal: String(supplied),
    customerCredit: String(credit),
    overpayment: String(credit),
  });
}

function stripPrivateInvoiceFields(invoice: any): any {
  const meta = parseMetadata(invoice?.metadata);
  const clean = {
    ...meta,
    form: meta.form ? { ...meta.form, internalNotes: "" } : meta.form,
    items: Array.isArray(meta.items) ? meta.items.map((item: any) => {
      const { costPrice, costComponents, deductStock, ...publicItem } = item || {};
      return publicItem;
    }) : meta.items,
  };
  return { ...invoice, metadata: JSON.stringify(clean) };
}
function invoiceForCaller(req: any, invoice: any): any {
  return hasPermission(getAdminAuth(req), "finance") ? invoice : stripPrivateInvoiceFields(invoice);
}
function preservePrivateMetadata(existingValue: unknown, incomingValue: unknown): string {
  const existing = parseMetadata(existingValue);
  const incoming = parseMetadata(incomingValue);
  const privateById = new Map((Array.isArray(existing.items) ? existing.items : []).map((item: any) => [String(item.id), {
    costPrice: item.costPrice, costComponents: item.costComponents, deductStock: item.deductStock,
  }]));
  const items = (Array.isArray(incoming.items) ? incoming.items : []).map((item: any) => {
    const { costPrice, costComponents, deductStock, ...safeItem } = item || {};
    return { ...safeItem, ...(privateById.get(String(item.id)) || {}) };
  });
  return JSON.stringify({
    ...incoming,
    form: { ...(incoming.form || {}), internalNotes: existing?.form?.internalNotes || "" },
    items,
  });
}

router.get("/", async (req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).where(isNull(invoicesTable.deletedAt)).orderBy(desc(invoicesTable.createdAt));
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    res.json(invoices.map(invoice => invoiceForCaller(req, invoice)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      clientName,
      clientId,
      clientPhone,
      clientEmail,
      orderId,
      amount,
      status = "pending",
      dueDate,
      notes,
      metadata,
    } = req.body;
    const invoiceNumber = await generateInvoiceNumber();
    const resolvedClientId = await resolveInvoiceClientId(clientId, clientPhone, orderId);
    const normalizedMetadata = normalizePaymentMetadata(metadata, amount);
    const paymentMeta = parseMetadata(normalizedMetadata);
    const resolvedStatus = status !== "cancelled" && moneyNumber(amount) > 0 && moneyNumber(paymentMeta.paymentReceivedTotal) >= moneyNumber(amount)
      ? "paid"
      : status;
    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        invoiceNumber,
        clientName,
        clientId: resolvedClientId,
        clientPhone: normStr(clientPhone) ?? null,
        clientEmail: normStr(clientEmail) ?? null,
        orderId,
        amount,
        status: resolvedStatus,
        dueDate,
        notes,
        metadata: hasPermission(getAdminAuth(req), "finance") ? normalizedMetadata : stripPrivateInvoiceFields({ metadata: normalizedMetadata }).metadata,
      })
      .returning();
    await syncInvoiceFinance(invoice).catch(syncErr => req.log.error(syncErr));
    await syncInvoiceMaterialUsage(invoice).catch(syncErr => req.log.error(syncErr));
    res.status(201).json(invoiceForCaller(req, invoice));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }
    const {
      clientName,
      clientId,
      clientPhone,
      clientEmail,
      orderId,
      amount,
      status,
      dueDate,
      notes,
      metadata,
    } = req.body;
    const [existingInvoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
    if (!existingInvoice) return res.status(404).json({ error: "Invoice not found" });

    const updateData: Record<string, unknown> = {};
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientId !== undefined) updateData.clientId = normInt(clientId);
    if (clientPhone !== undefined) updateData.clientPhone = normStr(clientPhone);
    if (clientEmail !== undefined) updateData.clientEmail = normStr(clientEmail);
    if (orderId !== undefined) updateData.orderId = orderId;
    if (amount !== undefined) updateData.amount = amount;
    // Editing line items must never accidentally turn a paid invoice back into
    // pending/partial/issued. Cancellation remains an explicit status action.
    if (status !== undefined) {
      const incomingStatus = String(status).toLowerCase();
      updateData.status = existingInvoice.status === "paid" && incomingStatus !== "paid" && incomingStatus !== "cancelled"
        ? "paid"
        : status;
    }
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (notes !== undefined) updateData.notes = notes;
    if (metadata !== undefined) {
      const existingMeta = parseMetadata(existingInvoice.metadata);
      const normalizedIncoming = normalizePaymentMetadata(metadata, amount ?? existingInvoice.amount);
      const incomingMeta = parseMetadata(normalizedIncoming);
      // Payment date is an accounting fact. Full invoice edits may send an
      // older metadata snapshot, so retain it unless the caller explicitly
      // supplies a replacement date.
      const withPaymentDate = JSON.stringify({
        ...incomingMeta,
        ...(incomingMeta.paymentReceivedDate ? {} : existingMeta.paymentReceivedDate ? { paymentReceivedDate: existingMeta.paymentReceivedDate } : {}),
      });
      if (hasPermission(getAdminAuth(req), "finance")) updateData.metadata = withPaymentDate;
      else updateData.metadata = preservePrivateMetadata(existingInvoice.metadata, withPaymentDate);

      const nextAmount = moneyNumber(amount ?? existingInvoice.amount);
      if (String(updateData.status ?? existingInvoice.status).toLowerCase() !== "cancelled" && nextAmount > 0 && moneyNumber(incomingMeta.paymentReceivedTotal) >= nextAmount) {
        updateData.status = "paid";
      }
    }

    // Any realised-payment state gets a payment date, even if the caller did
    // not open the date-confirmation UI. This keeps partial advances, Paid
    // invoices, Dashboard Today Earnings and Finance on one accounting date.
    const finalStatus = String(updateData.status ?? existingInvoice.status).toLowerCase();
    if (finalStatus === "paid" || finalStatus === "partial") {
      const baseMeta = parseMetadata(updateData.metadata ?? existingInvoice.metadata);
      if (!baseMeta.paymentReceivedDate) {
        baseMeta.paymentReceivedDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        updateData.metadata = JSON.stringify(baseMeta);
      }
    }
    const [invoice] = await db
      .update(invoicesTable)
      .set(updateData)
      .where(eq(invoicesTable.id, id))
      .returning();
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    await syncInvoiceFinance(invoice).catch(syncErr => req.log.error(syncErr));
    await syncInvoiceMaterialUsage(invoice).catch(syncErr => req.log.error(syncErr));
    return res.json(invoiceForCaller(req, invoice));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid invoice id" });
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id,id)).limit(1);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const auth = getAdminAuth(req);
    if (auth?.role === "staff") {
      const request = await queueDeletionRequest(req,"invoice",id,invoice.invoiceNumber,req.body?.reason);
      return res.status(202).json({ success:true,pendingApproval:true,message:"Invoice cancellation request sent to Owner",request });
    }
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
    await removeInvoiceFinance(id).catch(syncErr => req.log.error(syncErr));
    await removeInvoiceMaterialUsage(id).catch(syncErr => req.log.error(syncErr));
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete invoice" });
  }
});

export default router;
