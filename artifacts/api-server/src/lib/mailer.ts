import nodemailer, { type Transporter } from "nodemailer";

/**
 * Lazy-cached Gmail SMTP transport. Resolves credentials from
 * `overrides` (admin-set in DB) first, then falls back to
 * `GMAIL_USER` / `GMAIL_APP_PASSWORD` env vars. Returns `null`
 * (and logs a warning) if both sources are empty so callers never crash.
 */
let _transport: Transporter | null = null;
let _transportKey = "";
let _transportUser = "";

export interface MailerCredentials {
  user?: string | null;
  pass?: string | null;
}

function resolveCreds(overrides?: MailerCredentials): { user: string; pass: string } {
  const user = ((overrides?.user ?? "").trim() || (process.env.GMAIL_USER || "").trim());
  const passRaw = (overrides?.pass ?? "") || (process.env.GMAIL_APP_PASSWORD || "");
  const pass = String(passRaw).replace(/\s+/g, "");
  return { user, pass };
}

function getTransport(overrides?: MailerCredentials, log?: (msg: string) => void): Transporter | null {
  const { user, pass } = resolveCreds(overrides);
  if (!user || !pass) {
    if (log) log("[mailer] Gmail credentials not set (settings panel or env vars); email notifications disabled");
    return null;
  }
  const key = `${user}:${pass.length}:${pass.slice(-2)}`;
  if (_transport && _transportKey === key) return _transport;
  _transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  _transportKey = key;
  _transportUser = user;
  return _transport;
}

export interface OrderEmailItem {
  name?: string;
  description?: string;
  quantity?: number;
  qty?: number;
  price?: number | string;
  unitPrice?: number | string;
  size?: string;
}

export interface OrderEmailPayload {
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  orderType?: string | null;
  items: OrderEmailItem[];
  notes?: string | null;
  shippingMethod?: string | null;
  totalAmount?: number;
  storefrontUrl?: string;
}

function rs(v: number | string | null | undefined): string {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  if (!Number.isFinite(n)) return "Rs. 0.00";
  return `Rs. ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** @deprecated internal alias — use escapeHtml */
const esc = escapeHtml;

function renderHtml(p: OrderEmailPayload, businessName: string): string {
  const itemsRows = (p.items || []).map(it => {
    const name = esc(it.name || "Item");
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    const line = unit * qty;
    const sizeLabel = it.size ? ` <span style="color:#9ca3af;font-size:12px">(${esc(it.size)})</span>` : "";
    const descLabel = it.description && it.description !== it.name
      ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${esc(it.description)}</div>`
      : "";
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#111827;font-size:14px">${name}${sizeLabel}${descLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#374151;font-size:14px">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#374151;font-size:14px">${rs(unit)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#111827;font-weight:600;font-size:14px">${rs(line)}</td>
      </tr>`;
  }).join("");

  const shippingLabel = p.shippingMethod === "courier" ? "Courier Service"
                      : p.shippingMethod === "sl_post" ? "Sri Lanka Post"
                      : p.shippingMethod || "—";

  const total = p.totalAmount ?? (p.items || []).reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    return s + (qty * unit);
  }, 0);

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:0">
  <div style="background:linear-gradient(135deg,#a87842,#5c4938);padding:24px 28px;color:#ffffff">
    <div style="font-size:13px;letter-spacing:2px;opacity:0.85">NEW ORDER</div>
    <div style="font-size:24px;font-weight:700;margin-top:4px">${esc(p.orderId)}</div>
    <div style="font-size:13px;opacity:0.9;margin-top:6px">${esc(businessName)} \u2014 ${new Date().toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</div>
  </div>

  <div style="padding:24px 28px">
    <h2 style="margin:0 0 12px;font-size:16px;color:#111827">Customer</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
      <tr><td style="padding:4px 0;color:#6b7280;width:120px">Name</td><td style="padding:4px 0;font-weight:600;color:#111827">${esc(p.customerName)}</td></tr>
      ${p.customerPhone ? `<tr><td style="padding:4px 0;color:#6b7280">Phone</td><td style="padding:4px 0"><a href="tel:${esc(p.customerPhone)}" style="color:#a87842;text-decoration:none">${esc(p.customerPhone)}</a></td></tr>` : ""}
      ${p.customerEmail ? `<tr><td style="padding:4px 0;color:#6b7280">Email</td><td style="padding:4px 0"><a href="mailto:${esc(p.customerEmail)}" style="color:#a87842;text-decoration:none">${esc(p.customerEmail)}</a></td></tr>` : ""}
      ${p.customerAddress ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">Address</td><td style="padding:4px 0;white-space:pre-line">${esc(p.customerAddress)}</td></tr>` : ""}
      <tr><td style="padding:4px 0;color:#6b7280">Shipping</td><td style="padding:4px 0">${esc(shippingLabel)}</td></tr>
      ${p.orderType ? `<tr><td style="padding:4px 0;color:#6b7280">Type</td><td style="padding:4px 0;text-transform:capitalize">${esc(p.orderType)}</td></tr>` : ""}
    </table>

    <h2 style="margin:24px 0 12px;font-size:16px;color:#111827">Items</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Unit</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Line</th>
        </tr>
      </thead>
      <tbody>${itemsRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px">No line items</td></tr>`}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:14px 12px;text-align:right;font-weight:700;color:#111827;background:#fdf2f8">TOTAL</td>
            <td style="padding:14px 12px;text-align:right;font-weight:800;color:#db2777;background:#fdf2f8;font-size:16px">${rs(total)}</td></tr>
      </tfoot>
    </table>

    ${p.notes ? `<h2 style="margin:24px 0 8px;font-size:16px;color:#111827">Notes</h2><div style="padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:14px;color:#78350f;white-space:pre-line">${esc(p.notes)}</div>` : ""}

    ${p.storefrontUrl ? `<div style="margin-top:24px;text-align:center"><a href="${esc(p.storefrontUrl)}" style="display:inline-block;background:linear-gradient(135deg,#a87842,#5c4938);color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Admin Dashboard</a></div>` : ""}
  </div>

  <div style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    Automated notification from ${esc(businessName)}. Reply directly to this email to contact the customer if needed.
  </div>
</div></body></html>`;
}

function renderText(p: OrderEmailPayload, businessName: string): string {
  const lines: string[] = [];
  lines.push(`NEW ORDER ${p.orderId}`);
  lines.push(`${businessName} \u2014 ${new Date().toLocaleString("en-LK")}`);
  lines.push("");
  lines.push(`Customer: ${p.customerName}`);
  if (p.customerPhone) lines.push(`Phone:    ${p.customerPhone}`);
  if (p.customerEmail) lines.push(`Email:    ${p.customerEmail}`);
  if (p.customerAddress) lines.push(`Address:  ${p.customerAddress}`);
  lines.push("");
  lines.push("Items:");
  for (const it of p.items || []) {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    const descSuffix = it.description && it.description !== it.name ? ` [${it.description}]` : "";
    lines.push(`  - ${it.name || "Item"}${descSuffix}  x${qty}  @ ${rs(unit)}  = ${rs(unit * qty)}`);
  }
  const total = p.totalAmount ?? (p.items || []).reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    return s + (qty * unit);
  }, 0);
  lines.push("");
  lines.push(`TOTAL: ${rs(total)}`);
  if (p.notes) { lines.push(""); lines.push(`Notes: ${p.notes}`); }
  return lines.join("\n");
}

export interface SendOrderEmailOpts {
  recipients: string[];
  businessName?: string;
  payload: OrderEmailPayload;
  credentials?: MailerCredentials;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
  errorLog?: (msg: string, extra?: Record<string, unknown>) => void;
}

/**
 * Send a "new order" notification email via Gmail SMTP. Returns true on
 * success, false if the transport isn't configured or sending failed.
 * Never throws — callers can safely fire-and-forget.
 */
export async function sendOrderNotificationEmail(opts: SendOrderEmailOpts): Promise<boolean> {
  const { recipients, payload, log, errorLog } = opts;
  const businessName = opts.businessName || "HAVESTORY";
  const to = (recipients || []).map(s => s.trim()).filter(Boolean);
  if (to.length === 0) {
    if (log) log("[mailer] no recipients configured; skipping");
    return false;
  }
  const transport = getTransport(opts.credentials, log);
  if (!transport) return false;

  const subject = `\uD83C\uDF38 New Order ${payload.orderId} \u2014 ${payload.customerName}`;
  const html = renderHtml(payload, businessName);
  const text = renderText(payload, businessName);
  const from = `"${businessName}" <${_transportUser}>`;

  try {
    const info = await transport.sendMail({
      from,
      to: to.join(", "),
      subject,
      html,
      text,
      replyTo: payload.customerEmail || undefined,
    });
    if (log) log("[mailer] order notification sent", { orderId: payload.orderId, messageId: info.messageId, accepted: info.accepted });
    return true;
  } catch (err) {
    if (errorLog) errorLog("[mailer] order notification failed", { orderId: payload.orderId, err: String(err) });
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Customer order-confirmation email                                 */
/* ------------------------------------------------------------------ */

export interface BankDetail {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branch?: string;
}

export interface CustomerConfirmationOpts {
  customerEmail: string;
  businessName?: string;
  payload: OrderEmailPayload;
  shippingCost?: number;
  discountAmount?: number;
  bankDetails?: BankDetail[];
  trackingUrl?: string;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
  errorLog?: (msg: string, extra?: Record<string, unknown>) => void;
}

function renderCustomerHtml(p: OrderEmailPayload, businessName: string, shippingCost: number, discountAmount: number, bankDetails: BankDetail[], trackingUrl: string): string {
  const itemsRows = (p.items || []).map(it => {
    const name = esc(it.name || "Item");
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    const line = unit * qty;
    const sizeLabel = it.size ? ` <span style="color:#9ca3af;font-size:12px">(${esc(it.size)})</span>` : "";
    const descLabel = it.description && it.description !== it.name
      ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${esc(it.description)}</div>`
      : "";
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#111827;font-size:14px">${name}${sizeLabel}${descLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#374151;font-size:14px">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#374151;font-size:14px">${rs(unit)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#111827;font-weight:600;font-size:14px">${rs(line)}</td>
      </tr>`;
  }).join("");

  const shippingLabel = p.shippingMethod === "courier" ? "Courier Service"
                      : p.shippingMethod === "sl_post" ? "Sri Lanka Post"
                      : p.shippingMethod || "\u2014";

  const itemTotal = p.totalAmount ?? (p.items || []).reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    return s + (qty * unit);
  }, 0);

  const grandTotal = Math.max(0, itemTotal + shippingCost - discountAmount);

  const summaryRows: string[] = [];
  summaryRows.push(`<tr><td style="padding:6px 12px;color:#374151;font-size:14px">Subtotal</td><td style="padding:6px 12px;text-align:right;color:#374151;font-size:14px">${rs(itemTotal)}</td></tr>`);
  if (shippingCost > 0) {
    summaryRows.push(`<tr><td style="padding:6px 12px;color:#374151;font-size:14px">Shipping (${esc(shippingLabel)})</td><td style="padding:6px 12px;text-align:right;color:#374151;font-size:14px">${rs(shippingCost)}</td></tr>`);
  }
  if (discountAmount > 0) {
    summaryRows.push(`<tr><td style="padding:6px 12px;color:#16a34a;font-size:14px">Discount</td><td style="padding:6px 12px;text-align:right;color:#16a34a;font-size:14px">\u2212 ${rs(discountAmount)}</td></tr>`);
  }

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:0">
  <div style="background:linear-gradient(135deg,#a87842,#5c4938);padding:28px 28px;color:#ffffff;text-align:center">
    <div style="font-size:28px;font-weight:700">Thank You!</div>
    <div style="font-size:14px;opacity:0.9;margin-top:6px">Your order has been received</div>
  </div>

  <div style="padding:24px 28px">
    <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
      <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Order ID</div>
      <div style="font-size:22px;font-weight:700;color:#db2777;margin-top:4px">${esc(p.orderId)}</div>
    </div>

    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">
      Hi <strong>${esc(p.customerName)}</strong>, we\u2019ve received your order and it\u2019s being processed. Here\u2019s a summary of what you ordered:
    </p>

    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Unit</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Line</th>
        </tr>
      </thead>
      <tbody>${itemsRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px">No line items</td></tr>`}</tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      ${summaryRows.join("")}
      <tr style="border-top:2px solid #e5e7eb">
        <td style="padding:14px 12px;font-weight:700;color:#111827;font-size:16px">Total</td>
        <td style="padding:14px 12px;text-align:right;font-weight:800;color:#db2777;font-size:18px">${rs(grandTotal)}</td>
      </tr>
    </table>

    <div style="margin-top:20px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
      <h3 style="margin:0 0 8px;font-size:14px;color:#166534">Delivery Details</h3>
      <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse">
        <tr><td style="padding:3px 0;color:#6b7280;width:80px">Shipping</td><td style="padding:3px 0">${esc(shippingLabel)}</td></tr>
        ${p.customerAddress ? `<tr><td style="padding:3px 0;color:#6b7280;vertical-align:top">Address</td><td style="padding:3px 0;white-space:pre-line">${esc(p.customerAddress)}</td></tr>` : ""}
      </table>
    </div>

    ${p.notes ? `<div style="margin-top:16px;padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#78350f"><strong>Notes:</strong> ${esc(p.notes)}</div>` : ""}

    ${bankDetails.length > 0 ? `
    <div style="margin-top:20px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px">
      <h3 style="margin:0 0 10px;font-size:14px;color:#1e40af">\uD83C\uDFE6 Payment Details</h3>
      <p style="color:#374151;font-size:13px;margin:0 0 12px">Please transfer the total amount to one of the following bank accounts:</p>
      ${bankDetails.map(b => `
        <div style="background:#ffffff;border:1px solid #dbeafe;border-radius:6px;padding:12px;margin-bottom:8px">
          <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse">
            ${b.bankName ? `<tr><td style="padding:2px 0;color:#6b7280;width:110px">Bank</td><td style="padding:2px 0;font-weight:600">${esc(b.bankName)}</td></tr>` : ""}
            ${b.accountHolder ? `<tr><td style="padding:2px 0;color:#6b7280">Account Holder</td><td style="padding:2px 0">${esc(b.accountHolder)}</td></tr>` : ""}
            ${b.accountNumber ? `<tr><td style="padding:2px 0;color:#6b7280">Account Number</td><td style="padding:2px 0;font-weight:600;font-family:monospace">${esc(b.accountNumber)}</td></tr>` : ""}
            ${b.branch ? `<tr><td style="padding:2px 0;color:#6b7280">Branch</td><td style="padding:2px 0">${esc(b.branch)}</td></tr>` : ""}
          </table>
        </div>
      `).join("")}
      <p style="color:#6b7280;font-size:12px;margin:8px 0 0;font-style:italic">Please use your Order ID <strong>${esc(p.orderId)}</strong> as the payment reference.</p>
    </div>` : ""}

    ${trackingUrl ? `
    <div style="margin-top:20px;text-align:center">
      <a href="${esc(trackingUrl)}" style="display:inline-block;background:linear-gradient(135deg,#a87842,#5c4938);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">\uD83D\uDCE6 Track Your Order</a>
    </div>` : ""}

    <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:20px 0 0;text-align:center">
      We\u2019ll update you when your order status changes. If you have any questions, just reply to this email.
    </p>
  </div>

  <div style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    ${esc(businessName)} \u2014 ${new Date().toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
  </div>
</div></body></html>`;
}

function renderCustomerText(p: OrderEmailPayload, businessName: string, shippingCost: number, discountAmount: number, bankDetails: BankDetail[], trackingUrl: string): string {
  const lines: string[] = [];
  lines.push(`Thank you for your order, ${p.customerName}!`);
  lines.push(`Order ID: ${p.orderId}`);
  lines.push("");
  lines.push("Items:");
  for (const it of p.items || []) {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    const descSuffix = it.description && it.description !== it.name ? ` [${it.description}]` : "";
    lines.push(`  - ${it.name || "Item"}${descSuffix}  x${qty}  @ ${rs(unit)}  = ${rs(unit * qty)}`);
  }
  const itemTotal = p.totalAmount ?? (p.items || []).reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    return s + (qty * unit);
  }, 0);
  lines.push("");
  lines.push(`Subtotal: ${rs(itemTotal)}`);
  if (shippingCost > 0) lines.push(`Shipping: ${rs(shippingCost)}`);
  if (discountAmount > 0) lines.push(`Discount: -${rs(discountAmount)}`);
  const grandTotal = Math.max(0, itemTotal + shippingCost - discountAmount);
  lines.push(`TOTAL: ${rs(grandTotal)}`);
  if (p.notes) { lines.push(""); lines.push(`Notes: ${p.notes}`); }
  if (bankDetails.length > 0) {
    lines.push("");
    lines.push("PAYMENT DETAILS:");
    for (const b of bankDetails) {
      const parts: string[] = [];
      if (b.bankName) parts.push(`Bank: ${b.bankName}`);
      if (b.accountHolder) parts.push(`Account Holder: ${b.accountHolder}`);
      if (b.accountNumber) parts.push(`Account Number: ${b.accountNumber}`);
      if (b.branch) parts.push(`Branch: ${b.branch}`);
      lines.push(`  ${parts.join(" | ")}`);
    }
    lines.push(`Reference: ${p.orderId}`);
  }
  if (trackingUrl) { lines.push(""); lines.push(`Track your order: ${trackingUrl}`); }
  lines.push("");
  lines.push("We'll update you when your order status changes.");
  lines.push(`\u2014 ${businessName}`);
  return lines.join("\n");
}

export async function sendCustomerConfirmationEmail(opts: CustomerConfirmationOpts): Promise<boolean> {
  const { customerEmail, payload, log, errorLog } = opts;
  const businessName = opts.businessName || "HAVESTORY";
  const shippingCost = opts.shippingCost ?? 0;
  const discountAmount = opts.discountAmount ?? 0;
  const to = (customerEmail || "").trim();
  if (!to) {
    if (log) log("[mailer] no customer email; skipping confirmation");
    return false;
  }
  const transport = getTransport(undefined, log ? (msg) => log(msg) : undefined);
  if (!transport) return false;

  const bankDetails = opts.bankDetails ?? [];
  const trackingUrl = opts.trackingUrl ?? "";

  const subject = `Order Confirmed \u2014 ${payload.orderId} | ${businessName}`;
  const html = renderCustomerHtml(payload, businessName, shippingCost, discountAmount, bankDetails, trackingUrl);
  const text = renderCustomerText(payload, businessName, shippingCost, discountAmount, bankDetails, trackingUrl);
  const from = `"${businessName}" <${process.env.GMAIL_USER || ""}>`;

  try {
    const info = await transport.sendMail({ from, to, subject, html, text });
    if (log) log("[mailer] customer confirmation sent", { orderId: payload.orderId, messageId: info.messageId, to });
    return true;
  } catch (err) {
    if (errorLog) errorLog("[mailer] customer confirmation failed", { orderId: payload.orderId, err: String(err) });
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Order completion email (sent to customer when status → completed) */
/* ------------------------------------------------------------------ */

export interface OrderCompletionOpts {
  customerEmail: string;
  businessName?: string;
  payload: OrderEmailPayload;
  trackingUrl?: string;
  credentials?: MailerCredentials;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
  errorLog?: (msg: string, extra?: Record<string, unknown>) => void;
}

function renderCompletionHtml(p: OrderEmailPayload, businessName: string, trackingUrl: string): string {
  const itemsRows = (p.items || []).map(it => {
    const name = esc(it.name || "Item");
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    const line = unit * qty;
    const sizeLabel = it.size ? ` <span style="color:#9ca3af;font-size:12px">(${esc(it.size)})</span>` : "";
    const descLabel = it.description && it.description !== it.name
      ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${esc(it.description)}</div>`
      : "";
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#111827;font-size:14px">${name}${sizeLabel}${descLabel}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#374151;font-size:14px">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#374151;font-size:14px">${rs(unit)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#111827;font-weight:600;font-size:14px">${rs(line)}</td>
      </tr>`;
  }).join("");

  const total = p.totalAmount ?? (p.items || []).reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    return s + qty * unit;
  }, 0);

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:0">
  <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:28px 28px;color:#ffffff;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">✅</div>
    <div style="font-size:24px;font-weight:700">Order Completed!</div>
    <div style="font-size:14px;opacity:0.9;margin-top:6px">Your order is ready</div>
  </div>

  <div style="padding:24px 28px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center">
      <div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Order ID</div>
      <div style="font-size:22px;font-weight:700;color:#16a34a;margin-top:4px">${esc(p.orderId)}</div>
    </div>

    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">
      Hi <strong>${esc(p.customerName)}</strong>, great news — your order has been completed! Here is a full summary of what was prepared for you:
    </p>

    <h2 style="margin:0 0 12px;font-size:16px;color:#111827">Order Details</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Unit</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Line</th>
        </tr>
      </thead>
      <tbody>${itemsRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px">No line items</td></tr>`}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:14px 12px;text-align:right;font-weight:700;color:#111827;background:#f0fdf4">TOTAL</td>
            <td style="padding:14px 12px;text-align:right;font-weight:800;color:#16a34a;background:#f0fdf4;font-size:16px">${rs(total)}</td></tr>
      </tfoot>
    </table>

    ${p.notes ? `<div style="margin-top:16px;padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#78350f"><strong>Notes:</strong> ${esc(p.notes)}</div>` : ""}

    ${trackingUrl ? `
    <div style="margin-top:24px;text-align:center">
      <a href="${esc(trackingUrl)}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">📦 View Order Details</a>
    </div>` : ""}

    <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:20px 0 0;text-align:center">
      Thank you for choosing <strong>${esc(businessName)}</strong>. We hope you love your order! Feel free to reply to this email if you have any questions.
    </p>
  </div>

  <div style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    ${esc(businessName)} — ${new Date().toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
  </div>
</div></body></html>`;
}

function renderCompletionText(p: OrderEmailPayload, businessName: string, trackingUrl: string): string {
  const lines: string[] = [];
  lines.push(`✅ Order Completed — ${p.orderId}`);
  lines.push(`${businessName} — ${new Date().toLocaleString("en-LK")}`);
  lines.push("");
  lines.push(`Hi ${p.customerName}, your order has been completed!`);
  lines.push("");
  lines.push("Order Details:");
  for (const it of p.items || []) {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    const descSuffix = it.description && it.description !== it.name ? ` [${it.description}]` : "";
    lines.push(`  - ${it.name || "Item"}${descSuffix}  x${qty}  @ ${rs(unit)}  = ${rs(unit * qty)}`);
  }
  const total = p.totalAmount ?? (p.items || []).reduce((s, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const unit = parseFloat(String(it.price ?? it.unitPrice ?? 0)) || 0;
    return s + qty * unit;
  }, 0);
  lines.push(`TOTAL: ${rs(total)}`);
  if (p.notes) { lines.push(""); lines.push(`Notes: ${p.notes}`); }
  if (trackingUrl) { lines.push(""); lines.push(`View your order: ${trackingUrl}`); }
  lines.push("");
  lines.push(`Thank you for choosing ${businessName}!`);
  return lines.join("\n");
}

/**
 * Send an order completion email to the customer when their order status
 * transitions to "completed". Never throws — callers can safely fire-and-forget.
 */
export async function sendOrderCompletionEmail(opts: OrderCompletionOpts): Promise<boolean> {
  const { customerEmail, payload, log, errorLog } = opts;
  const businessName = opts.businessName || "HAVESTORY";
  const trackingUrl = opts.trackingUrl ?? "";
  const to = (customerEmail || "").trim();
  if (!to) {
    if (log) log("[mailer] no customer email; skipping completion notification");
    return false;
  }
  const transport = getTransport(opts.credentials, log);
  if (!transport) return false;

  const subject = `✅ Your Order is Complete — ${payload.orderId} | ${businessName}`;
  const html = renderCompletionHtml(payload, businessName, trackingUrl);
  const text = renderCompletionText(payload, businessName, trackingUrl);
  const from = `"${businessName}" <${_transportUser}>`;

  try {
    const info = await transport.sendMail({ from, to, subject, html, text });
    if (log) log("[mailer] order completion email sent", { orderId: payload.orderId, messageId: info.messageId, to });
    return true;
  } catch (err) {
    if (errorLog) errorLog("[mailer] order completion email failed", { orderId: payload.orderId, err: String(err) });
    return false;
  }
}

/**
 * Send a one-shot test email so the admin can verify SMTP is configured.
 */
export async function sendTestEmail(opts: { recipients: string[]; businessName?: string; credentials?: MailerCredentials; log?: (msg: string, extra?: Record<string, unknown>) => void; errorLog?: (msg: string, extra?: Record<string, unknown>) => void }): Promise<{ ok: boolean; reason?: string }> {
  const businessName = opts.businessName || "HAVESTORY";
  const to = (opts.recipients || []).map(s => s.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false, reason: "no_recipients" };
  const transport = getTransport(opts.credentials, opts.log);
  if (!transport) return { ok: false, reason: "smtp_not_configured" };
  const from = `"${businessName}" <${_transportUser}>`;
  try {
    await transport.sendMail({
      from,
      to: to.join(", "),
      subject: `\u2705 ${businessName} test email`,
      text: `This is a test email from ${businessName}. If you can read this, order notifications are working.`,
      html: `<div style="font-family:-apple-system,sans-serif;padding:24px;text-align:center"><h2 style="color:#a87842;margin:0 0 8px">\u2705 SMTP test successful</h2><p style="color:#374151">Order notifications from <strong>${escapeHtml(businessName)}</strong> are working. You can close this email.</p></div>`,
    });
    return { ok: true };
  } catch (err) {
    if (opts.errorLog) opts.errorLog("[mailer] test email failed", { err: String(err) });
    return { ok: false, reason: String(err) };
  }
}
