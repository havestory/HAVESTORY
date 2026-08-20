export type LineItem = { id: string; description: string; qty: number; unitPrice: string; notes: string; costPrice?: string };
export type ShippingOption = "none" | "standard" | "express" | "weight" | "custom" | "courier_service";

export const SHIPPING_OPTIONS: { key: ShippingOption; label: string; amount: number | null }[] = [
  { key: "none", label: "No Shipping / Pickup", amount: 0 },
  { key: "courier_service", label: "Courier Service", amount: null },
  { key: "standard", label: "Standard Delivery", amount: 350 },
  { key: "express", label: "Express Delivery", amount: 530 },
  { key: "weight", label: "Weight-based", amount: null },
  { key: "custom", label: "Custom / Manual Amount", amount: null },
];

export function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", qty: 1, unitPrice: "", notes: "", costPrice: "" };
}

export const INVOICE_EMPTY_FORM = {
  clientName: "", phone: "", email: "", businessName: "",
  address: "", projectTitle: "", additionalNotes: "", internalNotes: "",
};

export function num(v: any): number {
  return parseFloat(String(v || 0).replace(/[^0-9.-]/g, "")) || 0;
}

export function rs(v: any): string {
  return `Rs. ${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Calculate shipping amount.
 * Weight-based (new): firstKgRate for first kg, addKgRate × ceil(extra kg) for additional.
 * Weight-based (legacy): flat ratePerKg × ceil(kg).
 * Standard/Express: use standardRate / expressRate (from settings), falling back to SHIPPING_OPTIONS defaults.
 */
export function calcWeightCharge(kg: number, firstKgRate: string | undefined, addKgRate: string | undefined, ratePerKg?: string): number {
  if (kg <= 0) return 0;
  if (firstKgRate !== undefined) {
    const fkg = num(firstKgRate) || 450;
    const akg = num(addKgRate) || 200;
    return fkg + Math.ceil(Math.max(0, kg - 1)) * akg;
  }
  if (ratePerKg) return Math.ceil(kg * num(ratePerKg));
  return 0;
}

export function calcShipping(
  shipping: ShippingOption,
  shippingCustom: string,
  weightKg: string,
  ratePerKg: string,         // legacy: flat rate per kg
  firstKgRate?: string,      // new: rate for first kg (e.g. "450")
  addKgRate?: string,        // new: rate for each additional kg (e.g. "200")
  standardRate?: number,     // configured standard delivery rate
  expressRate?: number,      // configured express delivery rate
): number {
  if (shipping === "none") return 0;
  if (shipping === "custom") return num(shippingCustom);
  if (shipping === "standard") return standardRate ?? 350;
  if (shipping === "express") return expressRate ?? 530;
  if (shipping === "weight" || shipping === "courier_service") {
    const kg = num(weightKg);
    return calcWeightCharge(kg, firstKgRate, addKgRate, ratePerKg);
  }
  return 0;
}

export function parseInvoiceMeta(inv: any) {
  try {
    if (inv.metadata) {
      const m = JSON.parse(inv.metadata);
      if (m.form && m.items) return {
        form: m.form,
        items: m.items as LineItem[],
        shipping: (m.shipping || "none") as ShippingOption,
        shippingCustom: m.shippingCustom || "",
        shippingLabel: (m.shippingLabel || "") as string,
        weightKg: m.weightKg || "",
        ratePerKg: m.ratePerKg || "120",
        // new rate fields (undefined for old invoices → triggers legacy path in calcShipping)
        firstKgRate: m.firstKgRate as string | undefined,
        addKgRate: m.addKgRate as string | undefined,
        standardRate: m.standardRate as number | undefined,
        expressRate: m.expressRate as number | undefined,
        advance: m.advance || "0",
        courierName: (m.courierName || "") as string,
      };
    }
  } catch {}
  const amount = num(inv.amount);
  return {
    form: { clientName: inv.clientName || "", phone: "", email: "", businessName: "", address: "", projectTitle: "", additionalNotes: inv.notes || "", internalNotes: "" },
    items: [{ id: crypto.randomUUID(), description: "Invoice total", qty: 1, unitPrice: String(amount), notes: "" }] as LineItem[],
    shipping: "none" as ShippingOption,
    shippingCustom: "",
    shippingLabel: "" as string,
    weightKg: "",
    ratePerKg: "120",
    firstKgRate: undefined as string | undefined,
    addKgRate: undefined as string | undefined,
    standardRate: undefined as number | undefined,
    expressRate: undefined as number | undefined,
    advance: "0",
    courierName: "" as string,
  };
}

// Best-effort extractor for the advance amount stored inside an invoice's
// metadata JSON. Older invoices that pre-date the auto-status feature, or
// rows where the JSON is malformed, return 0.
export function getInvoiceAdvance(inv: { metadata?: string | null }): number {
  if (!inv?.metadata) return 0;
  try {
    const m = JSON.parse(inv.metadata);
    return num(m?.advance);
  } catch {
    return 0;
  }
}

// Best-effort extractor for the shipping amount stored on an invoice. The
// auto-invoice generator stores the courier / SL Post / weight / custom
// shipping fee under metadata.shippingCustom (or a computed weight-based
// charge). Returns 0 when the metadata is missing or unparseable.
export function getInvoiceShipping(inv: { metadata?: string | null }): number {
  if (!inv?.metadata) return 0;
  try {
    const m = JSON.parse(inv.metadata);
    return Math.max(0, num(m?.shippingCustom));
  } catch {
    return 0;
  }
}

// Best-effort extractor for the shipping method label stored on an invoice.
// Used to break down shipping revenue by Courier / SL Post / Custom.
export function getInvoiceShippingLabel(inv: { metadata?: string | null }): string {
  if (!inv?.metadata) return "";
  try {
    const m = JSON.parse(inv.metadata);
    if (m?.shippingLabel) return String(m.shippingLabel);
    if (m?.shipping === "courier_service" && m?.courierName) return m.courierName;
    if (m?.shipping === "courier") return "Courier Service";
    if (m?.shipping === "sl_post") return "Sri Lanka Post";
    if (m?.shipping === "weight") return "Weight-based";
    if (m?.shipping === "custom") return "Custom";
    return "";
  } catch {
    return "";
  }
}

// Money realised on an invoice today — i.e. how much the business has
// actually received against this invoice. Used by the Dashboard / Revenue
// / Reports / Invoices "Total Revenue" / "Total Received" tiles so an
// advance payment is counted as revenue even before the invoice is fully
// settled.
//
//   status="paid"      → the full invoice amount
//   status="partial"   → the advance amount (capped at the invoice total)
//   anything else      → 0
//
// "cancelled" / "overdue" / "draft" / "issued" deliberately contribute 0
// even if metadata still carries an advance — those statuses indicate the
// payment was not actually received / kept.
export function getInvoicePaidAmount(inv: {
  amount?: string | number | null;
  status?: string | null;
  metadata?: string | null;
}): number {
  const total = Math.max(0, num(inv?.amount));
  const status = (inv?.status || "").toLowerCase();
  if (status === "paid") return total;
  if (status === "partial") {
    const adv = getInvoiceAdvance(inv);
    return Math.max(0, Math.min(adv, total));
  }
  return 0;
}

// Whether an invoice's status counts as a "pending payment" — i.e. the
// invoice has been generated but the money hasn't actually been received
// yet. We treat both `pending` (generated, awaiting payment) and `issued`
// (sent to the client, still awaiting payment) the same way: the value
// shows up in Pending Payments tiles, Reports, etc. so the admin doesn't
// lose sight of money that's still owed once an invoice is marked issued.
//
// `partial` is intentionally NOT in this set — partial invoices have a
// known received portion and a known remaining balance, so the rest of
// the codebase tracks them separately via `getInvoicePaidAmount` and
// `getRemainingBalance`.
export function isUnpaidInvoiceStatus(status?: string | null): boolean {
  const s = (status || "").toLowerCase();
  return s === "pending" || s === "issued";
}

// Auto-derive an invoice's status from the advance amount and grand total.
//
// Money received takes precedence over a preserved manual status:
//   - advance >= total (and total > 0) → "paid"
//   - 0 < advance < total              → "partial"
//
// If no money has been received yet (advance == 0), preserve manual statuses
// the admin set explicitly ("issued", "draft", "overdue") so the auto-rule
// doesn't clobber them. "cancelled" is always preserved — it's a terminal
// state and a payment landing against a cancelled invoice should still keep
// it cancelled until the admin un-cancels it.
//
// Why money trumps `issued`/`draft`/`overdue`: an admin who marked an invoice
// as "issued" (sent to client, awaiting payment) and then records an advance
// expects the invoice to flip to "partial" — otherwise the realised-revenue
// tiles never reflect the advance and the invoice stays stuck on Pending
// Payments forever.
export function deriveInvoiceStatus(
  advance: number,
  total: number,
  currentStatus?: string | null,
): string {
  const a = Math.max(0, Number.isFinite(advance) ? advance : 0);
  const t = Math.max(0, Number.isFinite(total) ? total : 0);

  // Cancelled is terminal — never auto-overwrite, even if money is received.
  if (currentStatus === "cancelled") return "cancelled";

  // Real money received? Status reflects payment reality.
  if (t > 0 && a >= t) return "paid";
  if (a > 0) return "partial";

  // No money received yet — keep the admin's manual tag if any.
  const preserveWhenUnpaid = new Set(["issued", "draft", "overdue"]);
  if (currentStatus && preserveWhenUnpaid.has(currentStatus)) return currentStatus;

  return "pending";
}

export function buildInvoiceMetadata(
  form: typeof INVOICE_EMPTY_FORM,
  items: LineItem[],
  shipping: ShippingOption,
  shippingCustom: string,
  weightKg: string,
  ratePerKg: string,
  advance: string,
  firstKgRate?: string,
  addKgRate?: string,
  standardRate?: number,
  expressRate?: number,
  courierName?: string,
): string {
  return JSON.stringify({ form, items, shipping, shippingCustom, weightKg, ratePerKg, advance, firstKgRate, addKgRate, standardRate, expressRate, courierName });
}

