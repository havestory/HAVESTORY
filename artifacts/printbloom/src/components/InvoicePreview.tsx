import { useState, useRef, useEffect } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import { format, addDays } from "date-fns";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { FileText, Printer, ImageDown, X, Lock, TrendingUp } from "lucide-react";
import { type LineItem, type ShippingOption, num, rs } from "@/lib/invoiceTypes";
import { captureElement } from "@/lib/html2canvas-capture";
import { getBusinessName } from "@/lib/brand-settings";

/** Reliable cross-browser download: appends anchor to DOM, clicks, then cleans up. */
function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ─── A4 constants (96 dpi) ─── */
const A4_W = 794;   // 210mm @ 96dpi
const A4_H = 1123;  // 297mm @ 96dpi
const PAD  = 40;    // horizontal + top padding
const FOOT = 50;    // footer bar height
const ITEMS_PER_PAGE = 10;

const PINK   = "#9a6b3f";
const PURPLE = "#292524";
const GRAD   = "linear-gradient(90deg,#9a6b3f,#292524)";

/* ─── Rough height estimates (px) used for pagination decisions ─── */
const H_FULL_HEADER  = 78;   // logo + address block
const H_DIVIDER      = 30;   // gradient rule + margins
const H_BILL_TO      = 112;  // 2-column bill-to / order-details grid
const H_SMALL_HEADER = 50;
const H_CONTINUED    = 28;
const H_TBL_HEADER   = 32;
const H_ITEM_ROW     = 38;   // avg per line item (no notes)
const H_SUMMARY      = 160;  // notes + summary box

/* Available content height per page (pixels) */
const PAGE_CONTENT_H = A4_H - PAD - FOOT - PAD; // top pad + bottom pad + footer

/* Page 1 content height after FullHeader + BillTo */
const P1_AFTER_HEADER = PAGE_CONTENT_H - H_FULL_HEADER - H_DIVIDER - H_BILL_TO;
/* Subsequent item page content height after SmallHeader */
const PN_AFTER_HEADER = PAGE_CONTENT_H - H_SMALL_HEADER - H_DIVIDER;

function itemsHeight(count: number) { return H_TBL_HEADER + count * H_ITEM_ROW; }

const STATUS_BADGE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending:   { bg: "#fffbeb", border: "#d6b98c", color: "#9a6b3f", label: "PENDING" },
  partial:   { bg: "#fffbeb", border: "#fcd34d", color: "#b45309", label: "ADVANCE PAID" },
  paid:      { bg: "#f0fdf4", border: "#86efac", color: "#16a34a", label: "PAID" },
  overdue:   { bg: "#fff7ed", border: "#fdba74", color: "#c2410c", label: "OVERDUE" },
  cancelled: { bg: "#fef2f2", border: "#fca5a5", color: "#b91c1c", label: "CANCELLED" },
  draft:     { bg: "#f9fafb", border: "#d1d5db", color: "#6b7280", label: "DRAFT" },
  issued:    { bg: "#dbeafe", border: "#7dd3fc", color: "#1d4ed8", label: "ISSUED" },
};

/* ─── Sub-components ─── */
function InvLogo({ biz, logoUrl, tagline }: { biz: string; logoUrl?: string; tagline?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {logoUrl ? (
        <img src={logoUrl} alt={biz} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "contain", flexShrink: 0, background: "#f9f9f9" }} />
      ) : (
        <div style={{ width: 36, height: 36, borderRadius: 10, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{biz.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("")}</div>
      )}
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#111", lineHeight: 1.1 }}>{biz}</div>
        {tagline && <div style={{ fontSize: 11, color: "#888" }}>{tagline}</div>}
      </div>
    </div>
  );
}

function InvFooter({ page, total, website, biz }: { page: number; total: number; website: string; biz: string }) {
  return (
    <div style={{ height: FOOT, borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${PAD}px`, fontFamily: "Inter,sans-serif", boxSizing: "border-box" }}>
      <div style={{ fontSize: 9.5, color: "#666" }}>{biz}{website ? ` · ${website}` : ""}</div>
      <div style={{ fontSize: 10, color: "#bbb" }}>Page {page} of {total}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 2, background: GRAD, borderRadius: 2, margin: "12px 0" }} />;
}

function ItemsTable({ chunk, startIdx }: { chunk: LineItem[]; startIdx: number }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: GRAD }}>
          {["#", "DESCRIPTION", "QTY", "UNIT PRICE", "AMOUNT"].map((h, i) => (
            <th key={h} style={{ padding: "8px 12px", textAlign: i < 2 ? "left" : "right", color: "#fff", fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chunk.map((it, i) => {
          const total = it.qty * num(it.unitPrice);
          const bg = (startIdx + i) % 2 === 0 ? "#fff" : "#fffbeb";
          const desc = it.description.length > 35 ? it.description.slice(0, 35) : it.description;
          return (
            <tr key={it.id} style={{ borderBottom: "1px solid #f3e8ff", background: bg }}>
              <td style={{ padding: "8px 12px", fontSize: 12, color: "#888", width: 26, textAlign: "left" }}>{startIdx + i + 1}</td>
              <td style={{ padding: "8px 12px", fontSize: 13, color: "#111", maxWidth: 260 }}>
                <div style={{ fontWeight: 600 }}>{desc}</div>
                {it.notes && <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{it.notes}</div>}
              </td>
              <td style={{ padding: "8px 12px", fontSize: 13, color: "#555", textAlign: "right", whiteSpace: "nowrap" }}>{it.qty}</td>
              <td style={{ padding: "8px 12px", fontSize: 13, color: "#555", textAlign: "right", whiteSpace: "nowrap" }}>{rs(num(it.unitPrice))}</td>
              <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#111", textAlign: "right", whiteSpace: "nowrap" }}>{rs(total)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SummaryBlock({ subtotal, shippingAmt, advance, grandTotal, shippingLabel, notes, status }: {
  subtotal: number; shippingAmt: number; advance: string; grandTotal: number; shippingLabel: string; notes?: string; status?: string;
}) {
  // If fully paid, balance is always 0. For partial, balance = total - advance.
  const isPaid = (status || "").toLowerCase() === "paid";
  const balance = isPaid ? 0 : Math.max(0, grandTotal - num(advance));
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 16 }}>
      <div style={{ flex: 1 }}>
        {notes && (
          <div style={{ background: "#f9fafb", borderRadius: 8, border: "1px solid #f0f0f0", padding: "10px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>NOTES</div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, whiteSpace: "pre-line" }}>{notes}</div>
          </div>
        )}
      </div>
      <div style={{ minWidth: 230, flexShrink: 0 }}>
        <div style={{ borderRadius: 10, border: "1px solid #f3e8ff", overflow: "hidden" }}>
          <div style={{ background: GRAD, padding: "6px 14px" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", letterSpacing: 1.5 }}>SUMMARY</span>
          </div>
          <div style={{ padding: "9px 14px 0", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", paddingBottom: 6, borderBottom: "1px solid #f3e8ff" }}>
              <span>Subtotal</span><span style={{ fontWeight: 600 }}>{rs(subtotal)}</span>
            </div>
            {shippingAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", padding: "6px 0", borderBottom: "1px solid #f3e8ff" }}>
                <span>Shipping ({shippingLabel})</span><span>{rs(shippingAmt)}</span>
              </div>
            )}
            {num(advance) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#16a34a", padding: "6px 0", borderBottom: "1px solid #f3e8ff" }}>
                <span>Advance Paid</span><span>−{rs(num(advance))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555", padding: "6px 0", borderBottom: "1px solid #f3e8ff" }}>
              <span>Grand Total</span><span style={{ fontWeight: 600 }}>{rs(grandTotal)}</span>
            </div>
          </div>
          <div style={{ background: isPaid ? "linear-gradient(90deg,#16a34a,#15803d)" : GRAD, padding: "9px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{isPaid ? "✓ FULLY PAID" : "BALANCE DUE"}</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{isPaid ? "Rs. 0" : rs(balance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Props ─── */
export interface InvoicePreviewProps {
  form: any;
  items: LineItem[];
  shipping: ShippingOption;
  shippingCustom: string;
  shippingLabelOverride?: string;
  courierName?: string;
  advance: string;
  subtotal: number;
  shippingAmt: number;
  grandTotal: number;
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  invoiceNumberOverride?: string;
  createdAtOverride?: Date;
  status?: string;
  linkedOrderId?: string | null;
  /** Must be explicitly enabled by an authenticated admin surface. */
  showPrivateFinancials?: boolean;
}

/* ─── Main Component ─── */
export function InvoicePreview({
  form, items, shipping, shippingCustom, shippingLabelOverride, courierName, advance, subtotal, shippingAmt, grandTotal,
  onClose, onSave, isSaving, invoiceNumberOverride, createdAtOverride, status, linkedOrderId, showPrivateFinancials = false,
}: InvoicePreviewProps) {
  const { data: settings } = useGetSettings();
  const s = settings as any;
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  /* ─── Auto-fit A4 page to mobile/tablet viewport ───
   * Measures the canvas container width and computes a CSS scale so the
   * full A4 page (794 px wide) fits within the available area without
   * horizontal scrolling. The transform is applied to a wrapper, not the
   * page element itself, so html2canvas captures (which clone the page
   * into an offscreen wrap at fixed A4 dimensions) are unaffected.
   */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [pageScale, setPageScale] = useState(1);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const compute = () => {
      const padding = 16; // matches p-2 on the canvas (8px each side) plus a tiny safety
      const avail = el.clientWidth - padding;
      if (avail <= 0) return;
      setPageScale(Math.min(1, avail / A4_W));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("orientationchange", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  const now  = (createdAtOverride instanceof Date && !isNaN(createdAtOverride.getTime()))
    ? createdAtOverride
    : new Date();
  const genNo = useRef(`INV-${format(now, "yyyyMMdd")}-${Math.floor(Math.random() * 900 + 100)}`);
  const invoiceNo = invoiceNumberOverride || genNo.current;

  const dueDays  = Number(s?.paymentDueDays ?? 7);
  const dueDate  = addDays(now, dueDays);
  const biz      = getBusinessName(s);
  const bizAddr  = s?.address      || "";
  const bizPhone = s?.phone        || "";
  const bizEmail = s?.email        || "";
  const bizLogo  = s?.logoUrl      || "";
  const website  = s?.website      || "";
  const tagline  = s?.tagline      || "";

  /* Bank details — prefer bankDetails JSON array, fall back to legacy single fields */
  let banks: { bankName: string; accountHolder: string; accountNumber: string; branch: string; swiftBic: string }[] = [];
  try {
    const raw = JSON.parse(s?.bankDetails || "[]");
    if (Array.isArray(raw) && raw.length > 0) banks = raw;
  } catch {}
  if (banks.length === 0 && (s?.bankName || s?.bankAccountNumber)) {
    banks = [{ bankName: s?.bankName || "", accountHolder: s?.bankAccountHolder || "", accountNumber: s?.bankAccountNumber || "", branch: s?.bankBranch || "", swiftBic: s?.bankSwiftBic || "" }];
  }

  const tcsRaw: string = s?.termsConditions || `Payment is due within 7 days of invoice date.\nAll prices are in Sri Lankan Rupees (LKR).\n${biz || "The business"} is not liable for delays beyond our control.`;
  const tcs = tcsRaw.split("\n").filter(Boolean);

  const shippingLabels: Record<ShippingOption, string> = {
    none: "Pickup", standard: "Standard", express: "Express",
    weight: "Weight-Based",
    courier_service: courierName || "Courier",
    custom: shippingLabelOverride || shippingCustom || "Custom",
  };

  /* ─── Pagination logic ───────────────────────────────────────────
   * Rules:
   *  1. Max ITEMS_PER_PAGE (10) line items per page.
   *  2. Invoice Summary is placed on the LAST item page (never a separate page).
   *  3. Bank Details + Terms & Conditions are ALWAYS on a dedicated final page.
   *
   * Page structure:
   *   Page 1       : FullHeader + BillTo + items[0..9] + (Summary if ≤10 items)
   *   Page 2..N    : SmallHeader + items[10..] + (Summary on last item page)
   *   Page N+1     : SmallHeader + BankDetails + T&C  ← always separate
   * ─────────────────────────────────────────────────────────────── */
  const validItems = items.filter(it => it.description.trim());

  /* Build item page chunks */
  const chunks: LineItem[][] = [];
  for (let i = 0; i < Math.max(validItems.length, 1); i += ITEMS_PER_PAGE) {
    chunks.push(validItems.slice(i, i + ITEMS_PER_PAGE));
  }
  const itemPageCount = chunks.length;
  const totalPages    = itemPageCount + 1; // +1 for the always-separate legal/banking page

  /* Verify summary fits on last item page; if not, warn via overflow-x indicator */
  const lastChunkCount = chunks[chunks.length - 1]?.length ?? 0;
  const lastPageIsFirst = itemPageCount === 1;
  const availableOnLastPage = lastPageIsFirst
    ? P1_AFTER_HEADER - itemsHeight(lastChunkCount)
    : PN_AFTER_HEADER - H_CONTINUED - itemsHeight(lastChunkCount);
  const summaryFitsOnLastPage = availableOnLastPage >= H_SUMMARY;
  // If it doesn't fit, we still render it there — the container uses overflow: hidden
  // and the PDF captures the visible region. 10 items + summary should always fit
  // (estimated usage < 700px out of ~850px available on page 1 after header).

  const badgeKey = (status || "pending").toLowerCase();
  const badge    = STATUS_BADGE[badgeKey] || STATUS_BADGE.pending;

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  pageRefs.current = new Array(totalPages).fill(null);

  /* ─── PDF/ZIP/PNG export ─── */

  /**
   * Capture a single invoice page in isolation.
   *
   * Key fixes:
   * 1. document.fonts.ready ensures Inter (Google Fonts) is loaded before
   *    html2canvas renders — prevents text-alignment drift from font fallback.
   * 2. We do NOT pass windowWidth/windowHeight — those shrink html2canvas's
   *    simulated viewport to 794 px which can reflow content and make the
   *    captured element taller than one A4 page.
   * 3. After capturing, we hard-crop the canvas to exactly A4_W×2 × A4_H×2
   *    so the PDF always maps 1 canvas → 1 PDF page with no leftover blank slice.
   * 4. allowTaint: true lets html2canvas access cross-origin resources
   *    (Google Fonts CSS, Cloudinary images) without tainting the canvas.
   */
  const capturePageIsolated = async (el: HTMLElement): Promise<HTMLCanvasElement> => {
    const raw = await captureElement(el, { width: A4_W, height: A4_H, scale: 2 });
    // Hard-crop to exact A4×2 dimensions so 1 canvas always maps to 1 PDF page.
    const OUT_W = A4_W * 2;
    const OUT_H = A4_H * 2;
    const exact = document.createElement("canvas");
    exact.width  = OUT_W;
    exact.height = OUT_H;
    const ctx = exact.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(raw, 0, 0, Math.min(raw.width, OUT_W), Math.min(raw.height, OUT_H), 0, 0, Math.min(raw.width, OUT_W), Math.min(raw.height, OUT_H));
    return exact;
  };

  /**
   * PDF export: captures each invoice page with html2canvas, builds a jsPDF
   * document, then opens the resulting PDF as a blob URL in a new browser tab.
   * No print dialog — the tab shows the PDF directly and the user can save it.
   */
  const printInvoice = async () => {
    setGeneratingPDF(true);
    try {
      const pages = pageRefs.current.filter(Boolean) as HTMLElement[];
      if (pages.length === 0) return;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        const canvas = await capturePageIsolated(pages[i]);
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      }

      const blob = pdf.output("blob");
      triggerDownload(URL.createObjectURL(blob), `Invoice-${invoiceNo}.pdf`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const downloadJPGZip = async () => {
    // Snapshot all page elements BEFORE setDownloadingZip triggers a re-render.
    // Accessing pageRefs.current[i] after an await is unsafe: the re-render
    // resets pageRefs.current to a fresh null-filled array, leaving later
    // indices null and causing those pages to be skipped in the zip.
    const pages = pageRefs.current.slice(0, totalPages).filter(Boolean) as HTMLElement[];
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        const canvas = await capturePageIsolated(pages[i]);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), "image/jpeg", 0.95));
        zip.file(`${invoiceNo}-page-${i + 1}.jpg`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(URL.createObjectURL(content), `Invoice-${invoiceNo}.zip`);
    } finally { setDownloadingZip(false); }
  };

  /* ─── Shared page shell styles ─── */
  const pageShell: React.CSSProperties = {
    width: A4_W, height: A4_H, background: "#fff",
    fontFamily: "Inter, Arial, sans-serif", overflow: "hidden",
    boxSizing: "border-box", flexShrink: 0,
    boxShadow: "0 4px 32px rgba(0,0,0,0.13)",
  };
  const contentArea: React.CSSProperties = {
    height: A4_H - FOOT, overflow: "hidden", boxSizing: "border-box",
    padding: `${PAD}px`,
  };

  /* ─── Header sub-components ─── */
  const FullHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <InvLogo biz={biz} logoUrl={bizLogo} tagline={tagline} />
        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.8, marginTop: 6 }}>
          <div>{bizAddr}</div>
          {bizPhone && <div>{bizPhone}{bizEmail ? ` · ${bizEmail}` : ""}</div>}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: PINK, letterSpacing: 3 }}>INVOICE</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>No: <strong style={{ color: "#333" }}>{invoiceNo}</strong></div>
        <div style={{ fontSize: 11, color: "#888" }}>Date: {format(now, "MMMM dd, yyyy")}</div>
        <div style={{ fontSize: 11, color: "#888" }}>Due: {format(dueDate, "MMMM dd, yyyy")}</div>
        <div style={{ marginTop: 6, display: "inline-block", background: badge.bg, border: `1px solid ${badge.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, color: badge.color, fontWeight: 700 }}>{badge.label}</div>
      </div>
    </div>
  );

  const SmallHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <InvLogo biz={biz} logoUrl={bizLogo} tagline={tagline} />
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, color: PINK, fontWeight: 800, letterSpacing: 1.5 }}>INVOICE</div>
        <div style={{ fontSize: 10, color: "#888" }}>{invoiceNo} · {format(now, "MMM dd, yyyy")}</div>
      </div>
    </div>
  );

  const BillToBlock = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "12px 0" }}>
      <div style={{ background: "#fffbeb", borderRadius: 10, padding: "12px 14px", border: `1px solid #d6b98c` }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: PINK, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>BILL TO</div>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: "#111" }}>{form.clientName || "—"}</div>
        {form.businessName && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{form.businessName}</div>}
        {form.address && <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{form.address}</div>}
        {form.phone && <div style={{ fontSize: 12, color: "#777" }}>{form.phone}</div>}
        {form.email && <div style={{ fontSize: 12, color: "#777" }}>{form.email}</div>}
      </div>
      <div style={{ background: "#f5f3ff", borderRadius: 10, padding: "12px 14px", border: "1px solid #ddd6fe" }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: PURPLE, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>ORDER DETAILS</div>
        <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.9 }}>
          <div><span style={{ color: "#999" }}>Invoice No: </span><strong style={{ color: "#333" }}>{invoiceNo}</strong></div>
          {linkedOrderId && <div><span style={{ color: "#999" }}>Order ID: </span><strong style={{ color: "#333" }}>{linkedOrderId}</strong></div>}
          <div><span style={{ color: "#999" }}>Date: </span>{format(now, "dd MMM yyyy")}</div>
          <div><span style={{ color: "#999" }}>Due: </span>{format(dueDate, "dd MMM yyyy")}</div>
          <div><span style={{ color: "#999" }}>Items: </span>{validItems.length}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[860px] flex flex-col" style={{ maxHeight: "calc(100vh - 32px)" }}>

          {/* ── Toolbar ── */}
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
            {/* Row 1: title + close */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-amber-500 shrink-0" />
                <span className="font-bold text-gray-900 text-sm">Invoice Preview</span>
                <span className="text-xs text-gray-400 truncate hidden sm:inline">· {invoiceNo} · {totalPages} page{totalPages > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!summaryFitsOnLastPage && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-semibold hidden sm:inline">Clipped</span>
                )}
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
              </div>
            </div>
            {/* Row 2: action buttons — scroll horizontally on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
              {onSave && (
                <button onClick={onSave} disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 border-2 border-amber-200 text-amber-600 text-xs font-bold rounded-xl hover:bg-amber-50 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0">
                  {isSaving ? "Saving…" : "Save Invoice"}
                </button>
              )}
              <button onClick={printInvoice} disabled={generatingPDF || downloadingZip}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-stone-600 text-white text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-60 whitespace-nowrap shrink-0">
                <Printer size={13} /> {generatingPDF ? "Generating…" : "PDF"}
              </button>
              <button onClick={downloadJPGZip} disabled={downloadingZip}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-xl disabled:opacity-60 hover:opacity-90 whitespace-nowrap shrink-0">
                <ImageDown size={13} /> {downloadingZip ? "Zipping…" : "JPG ZIP"}
              </button>
            </div>
          </div>

          {/* ── Private profit panel (admin-only, never captured/printed) ── */}
          {showPrivateFinancials && (() => {
            const validItems = items.filter(it => it.description?.trim());
            const hasCost = validItems.some(it => num((it as any).costPrice || "0") > 0);
            const totalCost = validItems.reduce((s, it) => s + it.qty * num((it as any).costPrice || "0"), 0);
            const totalRevenue = subtotal;
            const totalProfit = totalRevenue - totalCost;
            const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
            return (
              <div className="mx-3 mb-1 mt-0.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">Profit Summary</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-white border border-emerald-200 rounded-full px-2 py-0.5 uppercase tracking-wide">
                    <Lock size={8} /> Private · not printed
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Total Cost",  val: hasCost ? `Rs. ${totalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—", color: hasCost ? "text-red-500" : "text-gray-300" },
                    { label: "Revenue",     val: `Rs. ${totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, color: "text-gray-700" },
                    { label: "Net Profit",  val: hasCost ? `Rs. ${totalProfit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—", color: hasCost ? (totalProfit >= 0 ? "text-emerald-700" : "text-red-500") : "text-gray-300" },
                    { label: "Margin",      val: hasCost ? `${margin.toFixed(1)}%` : "—", color: hasCost ? (margin >= 30 ? "text-emerald-700" : margin >= 10 ? "text-amber-600" : "text-red-500") : "text-gray-300" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</div>
                      <div className={`text-sm font-bold mt-0.5 ${color}`}>{val}</div>
                    </div>
                  ))}
                </div>
                {!hasCost && (
                  <p className="text-[10px] text-emerald-600/70 italic mt-2">Enter cost prices in the editor to see profit & margin.</p>
                )}
              </div>
            );
          })()}

          {/* ── Page canvas ── */}
          <div ref={canvasRef} className="overflow-y-auto overflow-x-hidden flex-1 bg-gray-100 p-2 sm:p-6">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 * pageScale, alignItems: "center" }}>

              {/* ── ITEM PAGES ──
                  Rule: max 10 items per page.
                  Summary always appended to the LAST item page (no separate page for summary).
              */}
              {chunks.map((chunk, pageIdx) => {
                const isFirst       = pageIdx === 0;
                const isLastItems   = pageIdx === chunks.length - 1;
                const pageNum       = pageIdx + 1;
                const chunkStart    = pageIdx * ITEMS_PER_PAGE;

                return (
                  <div key={pageIdx} style={{ width: A4_W * pageScale, height: A4_H * pageScale, flexShrink: 0 }}>
                    <div ref={el => { pageRefs.current[pageIdx] = el; }} style={{ ...pageShell, transform: `scale(${pageScale})`, transformOrigin: "top left" }} className="inv-page">
                    <div style={contentArea}>
                      {/* Header */}
                      {isFirst ? (
                        <><FullHeader /><Divider /><BillToBlock /></>
                      ) : (
                        <>
                          <SmallHeader />
                          <Divider />
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                            Continued · Items {chunkStart + 1}–{Math.min(chunkStart + ITEMS_PER_PAGE, validItems.length)} of {validItems.length}
                          </div>
                        </>
                      )}

                      {/* Items table */}
                      <ItemsTable chunk={chunk} startIdx={chunkStart} />

                      {/* Invoice Summary — ONLY on the last item page, never on the legal page */}
                      {isLastItems && (
                        <SummaryBlock
                          subtotal={subtotal}
                          shippingAmt={shippingAmt}
                          advance={advance}
                          grandTotal={grandTotal}
                          shippingLabel={shippingLabels[shipping]}
                          notes={form.additionalNotes}
                          status={status}
                        />
                      )}
                    </div>
                    <InvFooter page={pageNum} total={totalPages} website={website} biz={biz} />
                    </div>
                  </div>
                );
              })}

              {/* ── LEGAL / BANKING PAGE ──
                  Rule: Bank Details + Terms & Conditions ALWAYS on a brand-new separate last page.
                  This page NEVER contains any item rows or the Invoice Summary.
              */}
              <div style={{ width: A4_W * pageScale, height: A4_H * pageScale, flexShrink: 0 }}>
              <div ref={el => { pageRefs.current[itemPageCount] = el; }} style={{ ...pageShell, transform: `scale(${pageScale})`, transformOrigin: "top left" }} className="inv-page">
                <div style={contentArea}>
                  <SmallHeader />
                  <Divider />

                  {/* Section title */}
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 16, letterSpacing: 0.3 }}>Payment Details</div>

                  {/* Bank accounts */}
                  {banks.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
                      {banks.map((bank, bi) => (
                        <div key={bi} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #f3e8ff" }}>
                          <div style={{ background: GRAD, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>BANK TRANSFER{banks.length > 1 ? ` — ACCOUNT ${bi + 1}` : ""}</span>
                          </div>
                          <div style={{ padding: "14px 16px", background: "#fff" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 28px" }}>
                              {([["Bank Name", bank.bankName], ["Account Holder", bank.accountHolder], ["Account Number", bank.accountNumber], ["Branch", bank.branch], ["Swift / BIC", bank.swiftBic]] as [string, string][])
                                .filter(([, v]) => v)
                                .map(([label, val]) => (
                                  <div key={label}>
                                    <div style={{ fontSize: 9, color: "#aaa", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{val}</div>
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div style={{ background: "#fffbeb", padding: "8px 16px", borderTop: "1px solid #d6b98c" }}>
                            <span style={{ fontSize: 11, color: PINK, fontWeight: 600 }}>Please include invoice number <strong>{invoiceNo}</strong> as the payment reference.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: "#fffbeb", borderRadius: 10, padding: "14px 16px", marginBottom: 22, border: "1px solid #d6b98c" }}>
                      <div style={{ fontSize: 12, color: PINK }}>Please contact us for payment details.</div>
                      {bizPhone && <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{bizPhone}</div>}
                    </div>
                  )}

                  {/* Terms & Conditions */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 10 }}>Terms & Conditions</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {tcs.map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ width: 17, height: 17, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9.5, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{t}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Thank-you banner */}
                  <div style={{ borderRadius: 12, background: GRAD, padding: "18px 22px", textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>Thank You for Your Business!</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 5 }}>We appreciate your trust in {biz}. We look forward to serving you again.</div>
                    {(bizPhone || bizEmail) && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 6 }}>
                        {bizPhone}{bizPhone && bizEmail ? " · " : ""}{bizEmail}
                      </div>
                    )}
                  </div>
                </div>
                <InvFooter page={totalPages} total={totalPages} website={website} biz={biz} />
              </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
