import { useState, useRef, useCallback } from "react";
import { useListOrders, useListInvoices, useGetSettings } from "@workspace/api-client-react";
import { format, startOfWeek, startOfMonth, startOfYear, subDays, parseISO, endOfDay } from "date-fns";
import { Download, BarChart2, Loader2, Calendar, FileText, Truck } from "lucide-react";
import { jsPDF } from "jspdf";
import { captureElement } from "@/lib/html2canvas-capture";
import {
  getInvoicePaidAmount,
  getInvoiceAdvance,
  getInvoiceShipping,
  getInvoiceShippingLabel,
  isUnpaidInvoiceStatus,
} from "@/lib/invoiceTypes";

const A4_W = 794;
const A4_H = 1123;
const FOOT_H = 38;
const CONTENT_H = A4_H - FOOT_H;

const POLL = { query: { refetchInterval: 30000 } };

function rs(v: any) {
  const n = Number(v || 0);
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const PERIODS = ["This Week", "This Month", "This Year", "Custom Range"] as const;
type Period = (typeof PERIODS)[number];

const STATUS_STYLE: Record<string, string> = {
  completed:  "background:#dcfce7;color:#166534",
  confirmed:  "background:#dbeafe;color:#1d4ed8",
  pending:    "background:#ffedd5;color:#c2410c",
  submitted:  "background:#f3e8ff;color:#6d28d9",
  cancelled:  "background:#fee2e2;color:#b91c1c",
  processing: "background:#fef9c3;color:#854d0e",
};

const INV_STATUS_STYLE: Record<string, string> = {
  paid:      "background:#dcfce7;color:#166534",
  partial:   "background:#fef3c7;color:#b45309",
  pending:   "background:#ffedd5;color:#c2410c",
  issued:    "background:#dbeafe;color:#1d4ed8",
  overdue:   "background:#fee2e2;color:#b91c1c",
  cancelled: "background:#f3f4f6;color:#6b7280",
};

function parseBadge(s: string): React.CSSProperties {
  return Object.fromEntries(
    s.split(";").filter(Boolean).map(p => {
      const [k, v] = p.split(":");
      return [k.trim(), v.trim()];
    })
  ) as React.CSSProperties;
}

export default function AdminReports() {
  const [period, setPeriod] = useState<Period>("This Month");
  const [generating, setGenerating] = useState(false);
  const [generatingFull, setGeneratingFull] = useState(false);
  const now = new Date();
  const [customFrom, setCustomFrom] = useState(format(subDays(now, 30), "yyyy-MM-dd"));
  const [customTo, setCustomTo]     = useState(format(now, "yyyy-MM-dd"));

  const summaryRef = useRef<HTMLDivElement>(null);
  const fullRef    = useRef<HTMLDivElement>(null);

  const { data: orders }   = useListOrders({}, POLL);
  const { data: invoices } = useListInvoices({}, POLL);
  const { data: settings } = useGetSettings();

  const invoiceByOrderId = new Map<string, any>();
  (invoices ?? []).forEach(inv => { if (inv.orderId) invoiceByOrderId.set(inv.orderId, inv); });

  function orderAmount(o: any): number {
    const inv = invoiceByOrderId.get(o.orderId);
    if (inv) return Number(inv.amount ?? 0);
    return (o.items ?? []).reduce((s: number, it: any) => s + Number(it.price ?? 0) * (it.quantity ?? 1), 0);
  }

  const getFromDate = useCallback(() => {
    if (period === "This Week")    return startOfWeek(now, { weekStartsOn: 1 });
    if (period === "This Month")   return startOfMonth(now);
    if (period === "This Year")    return startOfYear(now);
    if (period === "Custom Range") return parseISO(customFrom);
    return subDays(now, 30);
  }, [period, customFrom]);

  const getToDate = useCallback(() => {
    if (period === "Custom Range") return endOfDay(parseISO(customTo));
    return endOfDay(now);
  }, [period, customTo]);

  const fromDate = getFromDate();
  const toDate   = getToDate();

  const periodLabel = period === "Custom Range"
    ? `${format(parseISO(customFrom), "dd MMM yyyy")} – ${format(parseISO(customTo), "dd MMM yyyy")}`
    : period;

  const periodOrders = (orders ?? []).filter(o => {
    const d = new Date(o.createdAt);
    return d >= fromDate && d <= toDate;
  });

  const completedPeriod = periodOrders.filter(o => o.status === "completed");
  // "Pending / Active" = every order in the period that isn't completed or
  // cancelled. Previously this only counted pending/submitted/processing,
  // so confirmed orders fell out of this tile and the count dropped to 0
  // even though the orders were still active.
  const pendingPeriod   = periodOrders.filter(
    o => o.status !== "completed" && o.status !== "cancelled",
  );
  const cancelledPeriod = periodOrders.filter(o => o.status === "cancelled");

  const periodInvoices       = (invoices ?? []).filter(inv => {
    if (!inv.createdAt) return false;
    const d = new Date(inv.createdAt);
    return d >= fromDate && d <= toDate;
  });
  // Overdue period from admin settings (default 30 days after due date)
  const overdueDays = Math.max(0, Number((settings as any)?.overdueDays ?? 30));

  // An invoice is overdue if explicitly marked OR past its due date by overdueDays
  function isInvoiceOverdue(inv: any): boolean {
    if (inv.status === "overdue") return true;
    if (inv.status === "paid" || inv.status === "cancelled") return false;
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    const daysPast = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return daysPast >= overdueDays;
  }

  // Remaining unpaid balance on an invoice (total minus any advance already received)
  function getRemainingBalance(inv: any): number {
    const total = Math.max(0, Number(inv.amount ?? 0));
    const advance = getInvoiceAdvance(inv);
    return Math.max(0, total - advance);
  }

  // PAID = fully paid invoices + advance amounts from partial invoices
  const paidPeriodInvoices   = periodInvoices.filter(i => i.status === "paid" || i.status === "partial");
  const paidInvoicesTotal    = paidPeriodInvoices.reduce((s, i) => s + getInvoicePaidAmount(i), 0);

  // OVERDUE = remaining balance on any non-paid invoice that is overdue
  const overdueInvoicesTotal = periodInvoices
    .filter(i => i.status !== "paid" && i.status !== "cancelled" && isInvoiceOverdue(i))
    .reduce((s, i) => s + getRemainingBalance(i), 0);

  // PENDING = full invoice amounts for pending/issued invoices that are NOT yet
  // overdue. `issued` is bucketed with `pending` so an invoice marked issued
  // (sent to the client, payment not yet received) still surfaces in the
  // Pending column rather than disappearing from the report.
  const pendingPeriodInvoices = periodInvoices.filter(
    i => isUnpaidInvoiceStatus(i.status) && !isInvoiceOverdue(i),
  );
  const pendingInvoicesTotal = pendingPeriodInvoices
    .reduce((s, i) => s + Math.max(0, Number(i.amount ?? 0)), 0);

  // PARTIAL = remaining outstanding (full invoice amount − advance already
  // received) for partial invoices that are NOT yet overdue. This is what
  // is still owed by the client on partial invoices.
  const partialPeriodInvoices = periodInvoices.filter(
    i => i.status === "partial" && !isInvoiceOverdue(i),
  );
  const partialInvoicesTotal = partialPeriodInvoices
    .reduce((s, i) => s + getRemainingBalance(i), 0);

  // Counts (separate from Rs. totals)
  const paidInvoicesCount    = paidPeriodInvoices.length;
  const pendingInvoicesCount = pendingPeriodInvoices.length;
  const partialInvoicesCount = partialPeriodInvoices.length;
  const overdueInvoicesCount = periodInvoices.filter(
    i => i.status !== "paid" && i.status !== "cancelled" && isInvoiceOverdue(i),
  ).length;

  const totalRevenue  = paidInvoicesTotal;
  const avgOrderValue = paidPeriodInvoices.length > 0 ? Math.round(totalRevenue / paidPeriodInvoices.length) : 0;

  // ── Shipping charges in this period ──────────────────────────────────────
  // Sum the shipping fee from every invoice that has been paid (fully or
  // partially) in the period. This is the actual money the business has
  // collected for shipping.
  const shippingCollected = paidPeriodInvoices.reduce(
    (s, inv) => s + getInvoiceShipping(inv),
    0,
  );
  // Pending shipping = shipping charges on still-unpaid invoices
  // (pending / issued / partial) so the admin can see what's still owed
  // for shipping.
  const shippingPending = periodInvoices
    .filter(i => (isUnpaidInvoiceStatus(i.status) || i.status === "partial") && !isInvoiceOverdue(i))
    .reduce((s, inv) => s + getInvoiceShipping(inv), 0);
  // Breakdown by shipping method label
  const shippingByMethod: Record<string, { count: number; amount: number }> = {};
  paidPeriodInvoices.forEach(inv => {
    const fee = getInvoiceShipping(inv);
    if (fee <= 0) return;
    const label = getInvoiceShippingLabel(inv) || "Other";
    if (!shippingByMethod[label]) shippingByMethod[label] = { count: 0, amount: 0 };
    shippingByMethod[label].count += 1;
    shippingByMethod[label].amount += fee;
  });
  const shippingMethodRows = Object.entries(shippingByMethod).sort((a, b) => b[1].amount - a[1].amount);
  const shippingOrdersCount = paidPeriodInvoices.filter(i => getInvoiceShipping(i) > 0).length;
  const avgShipping = shippingOrdersCount > 0 ? Math.round(shippingCollected / shippingOrdersCount) : 0;

  const paidPeriodOrderIds = new Set(paidPeriodInvoices.map(i => i.orderId).filter(Boolean));
  const revenueOrders = periodOrders.filter(o => paidPeriodOrderIds.has(o.orderId));
  const productRevenue: Record<string, { qty: number; rev: number }> = {};
  revenueOrders.forEach(o => {
    const invAmt     = orderAmount(o);
    const itemsTotal = (o.items ?? []).reduce((s: number, it: any) => s + Number(it.price ?? 0) * (it.quantity ?? 1), 0);
    const scale      = itemsTotal > 0 ? invAmt / itemsTotal : 1;
    (o.items ?? []).forEach((it: any) => {
      const name = it.name || it.productName || "Unknown";
      if (!productRevenue[name]) productRevenue[name] = { qty: 0, rev: 0 };
      productRevenue[name].qty += it.quantity ?? 1;
      productRevenue[name].rev += Number(it.price ?? 0) * (it.quantity ?? 1) * scale;
    });
  });
  const topProducts = Object.entries(productRevenue).sort((a, b) => b[1].rev - a[1].rev);
  const maxRev      = topProducts[0]?.[1].rev || 1;

  const sortedOrders   = [...periodOrders].reverse();
  const latest5        = sortedOrders.slice(0, 5);
  const restOrders     = sortedOrders.slice(5);
  const restPages: any[][] = [];
  for (let i = 0; i < restOrders.length; i += 15) restPages.push(restOrders.slice(i, i + 15));
  const totalPagesFull = 1 + restPages.length;

  const savePDF = (pdf: jsPDF, name: string) => {
    const blob = pdf.output("blob");
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadSummaryPDF = async () => {
    if (!summaryRef.current) return;
    setGenerating(true);
    try {
      const canvas = await captureElement(summaryRef.current, { width: A4_W, height: A4_H, scale: 2, overflowVisible: false });
      const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" as any, compress: true });
      const pdfW   = pdf.internal.pageSize.getWidth();
      const pdfH   = pdf.internal.pageSize.getHeight();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pdfW, pdfH);
      savePDF(pdf, `PrintBloom-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { setGenerating(false); }
  };

  const downloadFullPDF = async () => {
    if (!fullRef.current) return;
    setGeneratingFull(true);
    try {
      const pageDivs = Array.from(fullRef.current.querySelectorAll("[data-report-page]")) as HTMLElement[];
      const pdf      = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" as any, compress: true });
      const pdfW     = pdf.internal.pageSize.getWidth();
      const pdfH     = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pageDivs.length; i++) {
        const canvas = await captureElement(pageDivs[i], { width: A4_W, height: A4_H, scale: 2, overflowVisible: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pdfW, pdfH);
      }
      savePDF(pdf, `PrintBloom-Full-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { setGeneratingFull(false); }
  };

  const pageFooter = (page: number, total: number) => (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: FOOT_H, boxSizing: "border-box",
      background: "linear-gradient(135deg, #be185d 0%, #7c3aed 100%)",
      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 36px",
    }}>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px" }}>
        © {now.getFullYear()} PrintBloom · Revenue figures reflect invoice amounts · Sri Lanka
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px", letterSpacing: "1px" }}>
        CONFIDENTIAL · Page {page} of {total}
      </div>
    </div>
  );

  const orderRow = (o: any, i: number) => {
    const inv    = invoiceByOrderId.get(o.orderId);
    const amt    = orderAmount(o);
    const sStyle = STATUS_STYLE[o.status] || "background:#f3f4f6;color:#374151";
    return (
      <tr key={o.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
        <td style={{ padding: "6px 8px", fontWeight: 700, color: "#db2777", fontFamily: "monospace", fontSize: "9px" }}>{o.orderId}</td>
        <td style={{ padding: "6px 8px", color: "#6b7280", fontSize: "10px" }}>{format(new Date(o.createdAt), "MMM dd, yyyy")}</td>
        <td style={{ padding: "6px 8px", color: "#374151", fontWeight: 500 }}>{o.customerName}</td>
        <td style={{ padding: "6px 8px", color: "#6b7280", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {(o.items ?? [])[0]?.name || (o.items ?? [])[0]?.productName || "—"}
        </td>
        <td style={{ padding: "6px 8px", color: "#7c3aed", fontFamily: "monospace", fontSize: "9px" }}>{inv?.invoiceNumber || "—"}</td>
        <td style={{ padding: "6px 8px", fontWeight: 700, color: "#111827" }}>{rs(amt)}</td>
        <td style={{ padding: "6px 8px" }}>
          <span style={{ ...parseBadge(sStyle), padding: "2px 7px", borderRadius: "9999px", fontSize: "8px", fontWeight: 700, textTransform: "capitalize" }}>
            {o.status}
          </span>
        </td>
      </tr>
    );
  };

  const orderTableHead = (
    <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
      {["ORDER ID", "DATE", "CUSTOMER", "PRODUCT", "INVOICE #", "AMOUNT", "STATUS"].map(h => (
        <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "#6b7280", fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>{h}</th>
      ))}
    </tr>
  );

  const page1Content = (
    <>
      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #be185d 0%, #7c3aed 100%)",
        padding: "26px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.businessName || "Logo"} style={{ width: "36px", height: "36px", borderRadius: "9px", objectFit: "contain", background: "rgba(255,255,255,0.2)" }} />
            ) : (
              <div style={{
                width: "36px", height: "36px", borderRadius: "9px",
                background: "rgba(255,255,255,0.2)", display: "flex",
                alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "13px",
              }}>PB</div>
            )}
            <div>
              <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "17px" }}>{settings?.businessName || "PrintBloom"}</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px" }}>Professional Printing Services · Sri Lanka</div>
            </div>
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", lineHeight: "1.8" }}>
            {settings?.address && <div>📍 {settings.address}</div>}
            {settings?.phone   && <div>📞 {settings.phone}</div>}
            {settings?.email   && <div>✉ {settings.email}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "4px", color: "#fbbf24", textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            BUSINESS REPORT
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", marginTop: "6px" }}>Period: {periodLabel}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "10px" }}>
            Generated: {format(now, "MMMM dd, yyyy 'at' hh:mm aa")}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px", marginTop: "3px" }}>Revenue figures based on invoice values</div>
          <div style={{
            marginTop: "8px", display: "inline-block",
            border: "1px solid rgba(255,255,255,0.25)", borderRadius: "4px",
            padding: "2px 10px", fontSize: "9px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", textTransform: "uppercase",
          }}>CONFIDENTIAL BUSINESS DOCUMENT</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ padding: "14px 36px 0" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "9px" }}>
          KEY PERFORMANCE INDICATORS — BASED ON INVOICE VALUES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "9px", marginBottom: "9px" }}>
          {[
            { label: "TOTAL REVENUE",     val: rs(totalRevenue),  sub: "From paid invoices in period", color: "#db2777" },
            { label: "TOTAL ORDERS",      val: String(periodOrders.length), sub: periodLabel,         color: "#6d28d9" },
            { label: "AVG INVOICE VALUE", val: rs(avgOrderValue), sub: "Per paid invoice",             color: "#2563eb" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f9fafb", borderRadius: "9px", padding: "11px 13px", border: "1px solid #f3f4f6", borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: "8px", color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "3px" }}>{k.label}</div>
              <div style={{ fontSize: "19px", fontWeight: 800, color: "#111827" }}>{k.val}</div>
              <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "1px" }}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "9px", marginBottom: "13px" }}>
          {[
            { label: "COMPLETED",      val: String(completedPeriod.length), sub: `${periodOrders.length ? Math.round((completedPeriod.length / periodOrders.length) * 100) : 0}% success rate`, color: "#16a34a" },
            { label: "PENDING/ACTIVE", val: String(pendingPeriod.length),   sub: "Needs attention",  color: "#ea580c" },
            { label: "CANCELLED",      val: String(cancelledPeriod.length), sub: `${periodOrders.length ? Math.round((cancelledPeriod.length / periodOrders.length) * 100) : 0}% cancel rate`,  color: "#dc2626" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f9fafb", borderRadius: "9px", padding: "11px 13px", border: "1px solid #f3f4f6", borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: "8px", color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "3px" }}>{k.label}</div>
              <div style={{ fontSize: "19px", fontWeight: 800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "1px" }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SHIPPING CHARGES */}
      {(shippingCollected > 0 || shippingPending > 0) && (
        <div style={{ padding: "0 36px 12px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "7px" }}>
            SHIPPING CHARGES — {periodLabel.toUpperCase()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: shippingMethodRows.length > 0 ? "9px" : "0" }}>
            {[
              { label: "COLLECTED",   val: rs(shippingCollected), sub: `${shippingOrdersCount} order${shippingOrdersCount === 1 ? "" : "s"}`, color: "#d97706", bg: "#fffbeb" },
              { label: "PENDING",     val: rs(shippingPending),    sub: "on unpaid invoices",                                                  color: "#ea580c", bg: "#fff7ed" },
              { label: "AVG / ORDER", val: rs(avgShipping),        sub: "paid invoices only",                                                  color: "#2563eb", bg: "#eff6ff" },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, borderRadius: "7px", padding: "7px 11px" }}>
                <div style={{ fontSize: "8px", color: k.color, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "2px", fontWeight: 700 }}>{k.label}</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: "9px", color: k.color, marginTop: "1px", opacity: 0.85 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          {shippingMethodRows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "linear-gradient(90deg, #d97706, #f59e0b)" }}>
                  {["SHIPPING METHOD", "ORDERS", "TOTAL COLLECTED"].map(h => (
                    <th key={h} style={{ padding: "5px 9px", textAlign: "left", color: "#fff", fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shippingMethodRows.map(([label, { count, amount }], i) => (
                  <tr key={label} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "5px 9px", fontWeight: 600, color: "#111827" }}>{label}</td>
                    <td style={{ padding: "5px 9px", color: "#6b7280" }}>{count}</td>
                    <td style={{ padding: "5px 9px", fontWeight: 700, color: "#d97706" }}>{rs(amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* INVOICE SUMMARY */}
      {periodInvoices.length > 0 && (
        <div style={{ padding: "0 36px 12px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "7px" }}>
            INVOICE SUMMARY — {periodInvoices.length} INVOICES IN PERIOD
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "9px" }}>
            {[
              { label: "PAID",    count: paidInvoicesCount,    val: rs(paidInvoicesTotal),    color: "#16a34a", bg: "#f0fdf4" },
              { label: "PENDING", count: pendingInvoicesCount, val: rs(pendingInvoicesTotal), color: "#ea580c", bg: "#fff7ed" },
              { label: "PARTIAL", count: partialInvoicesCount, val: rs(partialInvoicesTotal), color: "#d97706", bg: "#fffbeb" },
              { label: "OVERDUE", count: overdueInvoicesCount, val: rs(overdueInvoicesTotal), color: "#dc2626", bg: "#fef2f2" },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, borderRadius: "7px", padding: "7px 11px" }}>
                <div style={{ fontSize: "8px", color: k.color, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "2px", fontWeight: 700 }}>{k.label}</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: k.color }}>{k.count}</div>
                {k.val ? <div style={{ fontSize: "9px", color: k.color, marginTop: "1px", opacity: 0.85 }}>{k.val}</div> : null}
              </div>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "linear-gradient(90deg, #db2777, #7c3aed)" }}>
                {["INVOICE #", "CLIENT", "ORDER ID", "AMOUNT", "STATUS", "DATE"].map(h => (
                  <th key={h} style={{ padding: "5px 9px", textAlign: "left", color: "#fff", fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...periodInvoices].reverse().slice(0, 5).map((inv, i) => {
                const sStyle = INV_STATUS_STYLE[inv.status] || "background:#f3f4f6;color:#374151";
                return (
                  <tr key={inv.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "5px 9px", fontWeight: 700, color: "#db2777", fontFamily: "monospace", fontSize: "10px" }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: "5px 9px", color: "#374151", fontWeight: 500 }}>{inv.clientName || "—"}</td>
                    <td style={{ padding: "5px 9px", color: "#6b7280", fontFamily: "monospace", fontSize: "10px" }}>{inv.orderId || "—"}</td>
                    <td style={{ padding: "5px 9px", fontWeight: 700, color: "#111827" }}>{rs(inv.amount)}</td>
                    <td style={{ padding: "5px 9px" }}>
                      <span style={{ ...parseBadge(sStyle), padding: "2px 7px", borderRadius: "9999px", fontSize: "8px", fontWeight: 700, textTransform: "capitalize" }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: "5px 9px", color: "#6b7280", fontSize: "10px" }}>
                      {inv.createdAt ? format(new Date(inv.createdAt), "MMM dd, yyyy") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TOP PRODUCTS */}
      {topProducts.length > 0 && (
        <div style={{ padding: "0 36px 12px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "7px" }}>
            TOP PRODUCTS BY REVENUE (INVOICE-ADJUSTED)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "linear-gradient(90deg, #db2777, #7c3aed)" }}>
                {["RANK", "PRODUCT / SERVICE", "QTY SOLD", "REVENUE", "SHARE"].map(h => (
                  <th key={h} style={{ padding: "6px 11px", textAlign: "left", color: "#fff", fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topProducts.slice(0, 6).map(([name, d], i) => (
                <tr key={name} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "7px 11px", fontWeight: 700, color: "#9ca3af", fontSize: "10px" }}>#{i + 1}</td>
                  <td style={{ padding: "7px 11px", fontWeight: 600, color: "#111827" }}>{name}</td>
                  <td style={{ padding: "7px 11px", color: "#4b5563" }}>{d.qty}</td>
                  <td style={{ padding: "7px 11px", fontWeight: 700, color: "#111827" }}>{rs(d.rev)}</td>
                  <td style={{ padding: "7px 11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <div style={{ flex: 1, height: "5px", background: "#e5e7eb", borderRadius: "9999px", overflow: "hidden", maxWidth: "65px" }}>
                        <div style={{ height: "100%", borderRadius: "9999px", background: "linear-gradient(90deg, #f472b6, #a855f7)", width: `${(d.rev / maxRev) * 100}%` }} />
                      </div>
                      <span style={{ fontSize: "9px", color: "#6b7280" }}>{totalRevenue > 0 ? Math.round((d.rev / totalRevenue) * 100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ORDER DETAILS — latest 5 */}
      {periodOrders.length > 0 && (
        <div style={{ padding: "0 36px 12px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "7px" }}>
            ORDER DETAILS — LATEST {Math.min(5, periodOrders.length)} OF {periodOrders.length} ORDER{periodOrders.length !== 1 ? "S" : ""} IN PERIOD
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>{orderTableHead}</thead>
            <tbody>
              {latest5.map((o, i) => orderRow(o, i))}
              <tr style={{ background: "#fdf2f8", borderTop: "2px solid #f9a8d4" }}>
                <td colSpan={5} style={{ padding: "7px 8px", fontWeight: 700, color: "#374151", fontSize: "10px" }}>
                  Total Revenue (Paid Invoices · Period)
                </td>
                <td style={{ padding: "7px 8px", fontWeight: 800, color: "#db2777", fontSize: "12px" }}>{rs(totalRevenue)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          {periodOrders.length > 5 && (
            <div style={{ textAlign: "center", marginTop: "7px", fontSize: "9px", color: "#9ca3af", fontStyle: "italic" }}>
              + {periodOrders.length - 5} more order{periodOrders.length - 5 !== 1 ? "s" : ""} — download Full Report PDF for complete details
            </div>
          )}
        </div>
      )}
    </>
  );

  const continuationPageContent = (pageOrders: any[], isLastPage: boolean) => (
    <>
      {/* Mini header */}
      <div style={{
        padding: "16px 36px 12px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "2px solid #f3f4f6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "linear-gradient(135deg, #be185d 0%, #7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: "10px",
          }}>PB</div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#111827" }}>PrintBloom</div>
            <div style={{ fontSize: "9px", color: "#9ca3af" }}>Business Report — Full Order Details</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "#6b7280" }}>Period: {periodLabel}</div>
          <div style={{ fontSize: "9px", color: "#9ca3af" }}>Generated: {format(now, "MMM dd, yyyy")}</div>
        </div>
      </div>

      {/* Order table */}
      <div style={{ padding: "14px 36px" }}>
        <div style={{ fontSize: "9px", fontWeight: 700, color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
          ORDER DETAILS — CONTINUED
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>{orderTableHead}</thead>
          <tbody>
            {pageOrders.map((o, i) => orderRow(o, i))}
            {isLastPage && (
              <tr style={{ background: "#fdf2f8", borderTop: "2px solid #f9a8d4" }}>
                <td colSpan={5} style={{ padding: "7px 8px", fontWeight: 700, color: "#374151", fontSize: "10px" }}>
                  Total Revenue (Paid Invoices · Period)
                </td>
                <td style={{ padding: "7px 8px", fontWeight: 800, color: "#db2777", fontSize: "12px" }}>{rs(totalRevenue)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const pageBox = (style?: React.CSSProperties): React.CSSProperties => ({
    width: A4_W, height: A4_H, position: "relative", overflow: "hidden",
    background: "#ffffff", fontFamily: "'Inter', 'Segoe UI', sans-serif",
    ...style,
  });

  // Mobile summary helpers
  const completionRate = periodOrders.length ? Math.round((completedPeriod.length / periodOrders.length) * 100) : 0;
  const cancelRate     = periodOrders.length ? Math.round((cancelledPeriod.length / periodOrders.length) * 100) : 0;
  const recentInvoices = [...periodInvoices].reverse().slice(0, 5);

  const invStatusBadge: Record<string, string> = {
    paid:      "bg-green-100 text-green-700",
    pending:   "bg-orange-100 text-orange-700",
    overdue:   "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
    issued:    "bg-blue-100 text-blue-700",
  };
  const orderStatusBadge: Record<string, string> = {
    completed:  "bg-green-100 text-green-700",
    confirmed:  "bg-blue-100 text-blue-700",
    pending:    "bg-orange-100 text-orange-700",
    submitted:  "bg-purple-100 text-purple-700",
    processing: "bg-yellow-100 text-yellow-700",
    cancelled:  "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 size={22} className="text-pink-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Based on invoice values · updates live every 30s</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
          <button
            onClick={downloadSummaryPDF}
            disabled={generating || generatingFull}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/25 hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {generating ? "Generating…" : "Download PDF"}
          </button>
          <button
            onClick={downloadFullPDF}
            disabled={generating || generatingFull}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl border-2 border-purple-300 bg-purple-50 text-purple-700 text-xs sm:text-sm font-bold hover:bg-purple-100 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {generatingFull ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {generatingFull ? "Generating…" : "Full Report PDF"}
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white border border-gray-100 rounded-xl px-3 sm:px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-500 font-medium mr-1">Period:</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${
                period === p ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white" : "text-gray-500 border border-gray-200 hover:border-pink-200"
              }`}>{p}</button>
          ))}
        </div>
        {period === "Custom Range" && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <Calendar size={13} className="text-pink-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium">From</label>
              <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 text-gray-700 cursor-pointer" />
            </div>
            <span className="text-gray-300">–</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium">To</label>
              <input type="date" value={customTo} min={customFrom} max={format(now, "yyyy-MM-dd")} onChange={e => setCustomTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 text-gray-700 cursor-pointer" />
            </div>
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
              {periodOrders.length} order{periodOrders.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ─── MOBILE-FRIENDLY SUMMARY (visible only on small screens) ─── */}
      <div className="md:hidden space-y-4">
        {/* Branding header card */}
        <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: "linear-gradient(135deg, #be185d 0%, #7c3aed 100%)" }}>
          <div className="flex items-center gap-3">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.businessName || "Logo"} className="w-10 h-10 rounded-lg object-contain bg-white/20 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-extrabold text-sm shrink-0">PB</div>
            )}
            <div className="min-w-0">
              <div className="font-extrabold text-base truncate">{settings?.businessName || "PrintBloom"}</div>
              <div className="text-[11px] text-white/70 truncate">Professional Printing Services · Sri Lanka</div>
            </div>
          </div>
          {(settings?.address || settings?.phone || settings?.email) && (
            <div className="mt-3 space-y-1 text-[11px] text-white/80">
              {settings?.address && <div className="truncate">📍 {settings.address}</div>}
              {settings?.phone   && <div className="truncate">📞 {settings.phone}</div>}
              {settings?.email   && <div className="truncate">✉ {settings.email}</div>}
            </div>
          )}
          <div className="mt-3 inline-block bg-white/15 rounded-md px-2 py-1 text-[10px] tracking-wider uppercase font-semibold">
            Period: {periodLabel}
          </div>
        </div>

        {/* KPI grid */}
        <div>
          <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2 px-1">Key Performance Indicators</div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Total Revenue",     val: rs(totalRevenue),                 sub: "From paid invoices",      bar: "#db2777" },
              { label: "Total Orders",      val: String(periodOrders.length),      sub: periodLabel,               bar: "#6d28d9" },
              { label: "Avg Invoice",       val: rs(avgOrderValue),                sub: "Per paid invoice",        bar: "#2563eb" },
              { label: "Completed",         val: String(completedPeriod.length),   sub: `${completionRate}% success rate`, bar: "#16a34a" },
              { label: "Pending / Active",  val: String(pendingPeriod.length),     sub: "Needs attention",         bar: "#ea580c" },
              { label: "Cancelled",         val: String(cancelledPeriod.length),   sub: `${cancelRate}% cancel rate`,      bar: "#dc2626" },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm" style={{ borderLeft: `4px solid ${k.bar}` }}>
                <div className="text-[9px] font-bold text-gray-400 tracking-widest uppercase truncate">{k.label}</div>
                <div className="text-[clamp(0.8rem,3.5vw,1.1rem)] font-extrabold mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: k.bar }}>{k.val}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{k.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Charges summary */}
        {(shippingCollected > 0 || shippingPending > 0) && (
          <div>
            <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2 px-1 flex items-center gap-1.5">
              <Truck size={12} className="text-amber-500" />
              Shipping Charges — {periodLabel}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <div className="bg-amber-50 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-amber-700 uppercase tracking-wider truncate">Collected</div>
                <div className="text-base sm:text-lg font-extrabold text-amber-700 mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{rs(shippingCollected)}</div>
                <div className="text-[10px] text-amber-700/80 mt-0.5 truncate">{shippingOrdersCount} order{shippingOrdersCount === 1 ? "" : "s"}</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-orange-700 uppercase tracking-wider truncate">Pending</div>
                <div className="text-base sm:text-lg font-extrabold text-orange-700 mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{rs(shippingPending)}</div>
                <div className="text-[10px] text-orange-700/80 mt-0.5 truncate">on unpaid invoices</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-2.5">
                <div className="text-[9px] font-bold text-blue-700 uppercase tracking-wider truncate">Avg / Order</div>
                <div className="text-base sm:text-lg font-extrabold text-blue-700 mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{rs(avgShipping)}</div>
                <div className="text-[10px] text-blue-700/80 mt-0.5 truncate">paid invoices only</div>
              </div>
            </div>
            {shippingMethodRows.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-sm">
                {shippingMethodRows.map(([label, { count, amount }]) => (
                  <div key={label} className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Truck size={13} className="text-amber-500 shrink-0" />
                      <span className="text-sm font-semibold text-gray-700 truncate">{label}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{count} order{count === 1 ? "" : "s"}</span>
                    </div>
                    <span className="font-bold text-gray-900 text-sm whitespace-nowrap shrink-0">{rs(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invoice summary */}
        {periodInvoices.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2 px-1">
              Invoice Summary — {periodInvoices.length} in period
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { label: "Paid",    count: paidInvoicesCount,    val: rs(paidInvoicesTotal),    color: "text-green-700",  bg: "bg-green-50" },
                { label: "Pending", count: pendingInvoicesCount, val: rs(pendingInvoicesTotal), color: "text-orange-700", bg: "bg-orange-50" },
                { label: "Partial", count: partialInvoicesCount, val: rs(partialInvoicesTotal), color: "text-amber-700",  bg: "bg-amber-50" },
                { label: "Overdue", count: overdueInvoicesCount, val: rs(overdueInvoicesTotal), color: "text-red-700",    bg: "bg-red-50" },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-xl p-2.5`}>
                  <div className={`text-[9px] font-bold ${k.color} uppercase tracking-wider truncate`}>{k.label}</div>
                  <div className={`text-base sm:text-lg font-extrabold ${k.color} mt-0.5 leading-tight`}>{k.count}</div>
                  {k.val ? (
                    <div className={`text-[10px] ${k.color} opacity-80 mt-0.5 truncate`}>{k.val}</div>
                  ) : null}
                </div>
              ))}
            </div>
            {recentInvoices.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-sm">
                {recentInvoices.map(inv => (
                  <div key={inv.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] font-bold text-pink-500 truncate">{inv.invoiceNumber}</div>
                        <div className="font-semibold text-gray-900 text-sm mt-0.5 truncate">{inv.clientName || "—"}</div>
                        {inv.orderId && <div className="font-mono text-[10px] text-gray-400 mt-0.5 truncate">{inv.orderId}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-gray-900 text-sm whitespace-nowrap">{rs(inv.amount)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{inv.createdAt ? format(new Date(inv.createdAt), "MMM dd") : "—"}</div>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${invStatusBadge[inv.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top products */}
        {topProducts.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2 px-1">
              Top Products by Revenue
            </div>
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-sm">
              {topProducts.slice(0, 6).map(([name, d], i) => (
                <div key={name} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-gray-400 shrink-0">#{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-900 truncate">{name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-900 text-sm whitespace-nowrap">{rs(d.rev)}</div>
                      <div className="text-[10px] text-gray-400">{d.qty} sold</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(d.rev / maxRev) * 100}%`, background: "linear-gradient(90deg, #f472b6, #a855f7)" }} />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{totalRevenue > 0 ? Math.round((d.rev / totalRevenue) * 100) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders */}
        {periodOrders.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2 px-1">
              Order Details — Latest {Math.min(5, periodOrders.length)} of {periodOrders.length}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-sm">
              {latest5.map(o => {
                const inv = invoiceByOrderId.get(o.orderId);
                const amt = orderAmount(o);
                return (
                  <div key={o.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] font-bold text-pink-500 truncate">{o.orderId}</div>
                        <div className="font-semibold text-gray-900 text-sm mt-0.5 truncate">{o.customerName}</div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {(o.items ?? [])[0]?.name || (o.items ?? [])[0]?.productName || "—"}
                        </div>
                        {inv?.invoiceNumber && (
                          <div className="font-mono text-[10px] text-purple-500 mt-0.5 truncate">{inv.invoiceNumber}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-gray-900 text-sm whitespace-nowrap">{rs(amt)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{format(new Date(o.createdAt), "MMM dd")}</div>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${orderStatusBadge[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="p-3 bg-pink-50/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700">Total Revenue (Paid · Period)</span>
                <span className="text-sm font-extrabold text-pink-600">{rs(totalRevenue)}</span>
              </div>
            </div>
            {periodOrders.length > 5 && (
              <div className="text-center mt-2 text-[10px] text-gray-400 italic">
                + {periodOrders.length - 5} more — download Full Report PDF for complete details
              </div>
            )}
          </div>
        )}

        {periodOrders.length === 0 && periodInvoices.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-16 text-center">
            <BarChart2 size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">No data for this period</p>
            <p className="text-xs text-gray-300 mt-1">Try a wider date range</p>
          </div>
        )}
      </div>

      {/* ─── DESKTOP A4 SUMMARY PREVIEW (md+) — purely visual ─── */}
      <div className="hidden md:block" style={{ overflowX: "auto", width: "100%" }}>
        <div
          style={{
            ...pageBox({
              border: "1px solid #e5e7eb", borderRadius: "12px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)", margin: "0 auto",
            }),
          }}
        >
          <div style={{ height: CONTENT_H, overflow: "hidden", boxSizing: "border-box" }}>
            {page1Content}
          </div>
          {pageFooter(1, 1)}
        </div>
      </div>

      {/* ─── HIDDEN A4 PAGES (off-screen, always rendered at all sizes for html2canvas) ─── */}
      <div
        style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -100, pointerEvents: "none" }}
      >
        {/* Summary capture target — used for "Download PDF" */}
        <div ref={summaryRef} style={pageBox()}>
          <div style={{ height: CONTENT_H, overflow: "hidden", boxSizing: "border-box" }}>
            {page1Content}
          </div>
          {pageFooter(1, 1)}
        </div>

        {/* Full report capture target — used for "Full Report PDF" */}
        <div ref={fullRef}>
          <div data-report-page style={pageBox()}>
            <div style={{ height: CONTENT_H, overflow: "hidden", boxSizing: "border-box" }}>
              {page1Content}
            </div>
            {pageFooter(1, totalPagesFull)}
          </div>
          {restPages.map((pageOrders, idx) => (
            <div key={idx} data-report-page style={pageBox()}>
              <div style={{ height: CONTENT_H, overflow: "hidden", boxSizing: "border-box" }}>
                {continuationPageContent(pageOrders, idx === restPages.length - 1)}
              </div>
              {pageFooter(idx + 2, totalPagesFull)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
