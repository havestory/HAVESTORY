import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileDown,
  Loader2,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  AlertTriangle,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { useGetAdminMe, useGetSettings } from "@workspace/api-client-react";

type Product = {
  id: string;
  code: string;
  name: string;
  price: number;
  imageUrl?: string;
};
type CartItem = Product & { qty: number };
type Invoice = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  balance: number;
  status: string;
};
type Sale = {
  id: number;
  receipt_number: string;
  invoice_number?: string;
  customer_name: string;
  items: CartItem[];
  total: string;
  amount_tendered: string;
  change_due: string;
  payment_method: string;
  sold_by: string;
  sold_at: string;
};
type DayData = {
  date: string;
  session: any;
  reopenRequest?: { id: number; reason: string; status: string; requested_by_username: string; created_at: string } | null;
  sales: Sale[];
  summary: {
    count: number;
    sales: number;
    cashSales: number;
    expectedCash: number;
  };
};
type MonthData = {
  month: string;
  sales: Sale[];
  daily: Array<{ date: string; bills: number; total: number }>;
  summary: { count: number; total: number; cash: number; card: number; transfer: number };
};
const rs = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ReceiptBrand = {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

function printReceipt(sale: Sale, width: "58" | "80", brand: ReceiptBrand) {
  const win = window.open("", "_blank", "popup=yes,width=500,height=760");
  if (!win) {
    window.alert("Please allow pop-ups to print the POS bill.");
    return;
  }
  const mm = width === "58" ? 58 : 80;
  const items = Array.isArray(sale.items) ? sale.items : [];
  const businessName = brand.businessName || "HAVESTORY";
  const contactLines = [brand.address, brand.phone, brand.email, brand.website]
    .filter(Boolean)
    .map(esc)
    .join("<br>");
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.receipt_number)}</title><style>@page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}html,body{width:${mm}mm;min-width:${mm}mm;margin:0;padding:0;background:#fff;color:#000}body{font-family:Arial,Helvetica,sans-serif;font-size:${width === "58" ? 10 : 11}px;line-height:1.35;font-variant-numeric:tabular-nums}.r{width:${mm}mm;padding:${width === "58" ? 3 : 4}mm;overflow:hidden}.c,.center{text-align:center}.brand{font-size:${width === "58" ? 16 : 19}px;font-weight:900;letter-spacing:.5px;overflow-wrap:anywhere}.tagline{margin-top:1mm;font-size:.92em}.meta{margin-top:2mm;overflow-wrap:anywhere}.rule{border-top:1px dashed #000;margin:2.5mm 0}.row{display:flex;justify-content:space-between;gap:2mm;padding:1mm 0}.item{border-bottom:1px dotted #aaa}.item span:first-child{max-width:68%;overflow-wrap:anywhere}.total{font-size:1.2em;font-weight:900;border-top:1px solid #000;margin-top:1mm;padding-top:1.5mm}.change{border:1.5px solid #000;padding:1.5mm;font-size:1.15em}.small{font-size:.88em}.bold{font-weight:800}.footer{margin-top:3mm;font-size:.9em}@media print{html,body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><main class="r"><header class="center"><div class="brand">${esc(businessName)}</div><div class="tagline">THE COLOUR &amp; FRAME STUDIO</div><div class="meta small">${contactLines}</div></header><div class="rule"></div><div class="center bold">POS RECEIPT</div><div class="center">${esc(sale.receipt_number)}</div>${sale.invoice_number ? `<div class="center small">Invoice: ${esc(sale.invoice_number)}</div>` : ""}<div class="center small">${esc(new Date(sale.sold_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo" }))}</div><div class="rule"></div><div class="bold">${esc(sale.customer_name || "Walk-in customer")}</div><div class="rule"></div>${items.map((i) => `<div class="row item"><span><b>${esc(i.name)}</b><br><span class="small">${i.qty} × ${rs(Number(i.price))}${i.code ? ` · ${esc(i.code)}` : ""}</span></span><b>${rs(Number(i.price) * Number(i.qty))}</b></div>`).join("")}<div class="row total"><span>Total</span><span>${rs(Number(sale.total))}</span></div><div class="row"><span>Received</span><b>${rs(Number(sale.amount_tendered))}</b></div><div class="row change"><span>Balance / Change</span><b>${rs(Number(sale.change_due))}</b></div><div class="row small"><span>Payment</span><b>${esc(sale.payment_method.toUpperCase())}</b></div><footer class="footer center"><div class="rule"></div>Issued by ${esc(sale.sold_by)}<br>Thank you for choosing ${esc(businessName)}.</footer></main></body></html>`,
  );
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    if (!win.closed) {
      win.print();
      win.close();
    }
  }, 250);
}

export default function POS() {
  const { toast } = useToast();
  const { data: me } = useGetAdminMe();
  const { data: settings } = useGetSettings();
  const receiptSettings = settings as any;
  const receiptBrand: ReceiptBrand = {
    businessName: receiptSettings?.businessName || "HAVESTORY",
    address: receiptSettings?.address || "",
    phone: receiptSettings?.phone || "",
    email: receiptSettings?.email || "",
    website: receiptSettings?.website || "",
  };
  const codeRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [day, setDay] = useState<DayData | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [opening, setOpening] = useState("5000");
  const [tendered, setTendered] = useState("");
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("cash");
  const [width, setWidth] = useState<"58" | "80">("80");
  const [saving, setSaving] = useState(false);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [closing, setClosing] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [dayActionBusy, setDayActionBusy] = useState(false);
  const [reportMonth, setReportMonth] = useState(today().slice(0, 7));
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ code: "", name: "", price: "" });
  const load = async () => {
    try {
      const [catalog, current] = await Promise.all([
        request("/api/pos/catalog"),
        request(`/api/pos/day?date=${today()}`),
      ]);
      setProducts(catalog);
      setDay(current);
    } catch (e: any) {
      toast({
        title: "POS could not load",
        description: e.message,
        variant: "destructive",
      });
    }
  };
  useEffect(() => {
    void load();
    const invoice = new URLSearchParams(window.location.search).get("invoice");
    if (invoice) setInvoiceQuery(invoice);
  }, []);
  useEffect(() => {
    if (!invoiceQuery.trim()) {
      setInvoices([]);
      return;
    }
    const timer = setTimeout(
      () =>
        request(`/api/pos/invoices?q=${encodeURIComponent(invoiceQuery)}`)
          .then(setInvoices)
          .catch(() => setInvoices([])),
      250,
    );
    return () => clearTimeout(timer);
  }, [invoiceQuery]);
  useEffect(() => {
    request(`/api/pos/month?month=${encodeURIComponent(reportMonth)}`)
      .then(setMonthData)
      .catch(() => setMonthData(null));
  }, [reportMonth]);
  const total = selectedInvoice
    ? selectedInvoice.balance
    : cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const received = Number(tendered) || 0;
  const change = Math.max(0, received - total);
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return products
      .filter((p) => !q || `${p.code} ${p.name}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [products, query]);
  const add = (product: Product) => {
    if (selectedInvoice) return;
    setCart((old) => {
      const found = old.find((i) => i.id === product.id);
      return found
        ? old.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i))
        : [...old, { ...product, qty: 1 }];
    });
    setCode("");
    codeRef.current?.focus();
  };
  const addByCode = () => {
    const normalized = code.trim().toLowerCase();
    const product = products.find(
      (p) => p.code.toLowerCase() === normalized || String(p.id) === normalized,
    );
    if (product) add(product);
    else
      toast({
        title: "Item code not found",
        description: "Search the catalogue or check the code.",
        variant: "destructive",
      });
  };
  const savePosItem = async () => {
    try {
      await request("/api/pos/items", {
        method: "POST",
        body: JSON.stringify(newItem),
      });
      toast({
        title: "POS item saved",
        description: `${newItem.code.toUpperCase()} · ${newItem.name}`,
      });
      setNewItem({ code: "", name: "", price: "" });
      setShowNewItem(false);
      await load();
    } catch (e: any) {
      toast({
        title: "Item could not be saved",
        description: e.message,
        variant: "destructive",
      });
    }
  };
  const startDay = async () => {
    try {
      await request("/api/pos/start-day", {
        method: "POST",
        body: JSON.stringify({ openingFloat: opening }),
      });
      toast({
        title: "Counter opened",
        description: `Day-start fund ${rs(Number(opening))}`,
      });
      await load();
    } catch (e: any) {
      toast({
        title: "Could not start day",
        description: e.message,
        variant: "destructive",
      });
    }
  };
  const complete = async () => {
    if (received < total) return;
    setSaving(true);
    try {
      const sale = await request("/api/pos/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart,
          invoiceId: selectedInvoice?.id,
          customerName: customer,
          amountTendered: received,
          paymentMethod: method,
        }),
      });
      printReceipt(sale, width, receiptBrand);
      toast({
        title: "Payment collected & bill printed",
        description: `${sale.receipt_number} · Change ${rs(Number(sale.change_due))}`,
      });
      setCart([]);
      setSelectedInvoice(null);
      setCustomer("");
      setTendered("");
      setInvoiceQuery("");
      await load();
    } catch (e: any) {
      toast({
        title: "Sale could not be completed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const downloadReport = () => {
    if (!day) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const perPage = 24;
    const pages = Math.max(1, Math.ceil(day.sales.length / perPage));
    for (let page = 0; page < pages; page++) {
      if (page) pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(17);
      pdf.text("HAVESTORY — COUNTER SALES", 105, 18, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(
        `Day-end report · ${day.date} · Page ${page + 1} of ${pages}`,
        105,
        25,
        { align: "center" },
      );
      pdf.line(15, 30, 195, 30);
      let y = 39;
      pdf.setFontSize(8);
      pdf.text("TIME", 15, y);
      pdf.text("RECEIPT / INVOICE", 36, y);
      pdf.text("CUSTOMER", 82, y);
      pdf.text("METHOD", 145, y);
      pdf.text("TOTAL", 190, y, { align: "right" });
      pdf.line(15, y + 2, 195, y + 2);
      y += 8;
      for (const sale of day.sales.slice(
        page * perPage,
        (page + 1) * perPage,
      )) {
        pdf.setFont("helvetica", "normal");
        pdf.text(
          new Date(sale.sold_at).toLocaleTimeString("en-LK", {
            timeZone: "Asia/Colombo",
            hour: "2-digit",
            minute: "2-digit",
          }),
          15,
          y,
        );
        pdf.text(String(sale.receipt_number).slice(0, 22), 36, y);
        pdf.text(String(sale.customer_name || "").slice(0, 30), 82, y);
        pdf.text(String(sale.payment_method).toUpperCase(), 145, y);
        pdf.text(rs(Number(sale.total)), 190, y, { align: "right" });
        y += 9;
      }
      pdf.line(15, 270, 195, 270);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(
        `Opening float: ${rs(Number(day.session?.opening_float || 0))}   Sales: ${rs(day.summary.sales)}   Expected cash: ${rs(day.summary.expectedCash)}`,
        105,
        278,
        { align: "center" },
      );
    }
    pdf.save(`HAVESTORY-POS-${day.date}.pdf`);
  };
  const downloadMonthReport = () => {
    if (!monthData) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const perPage = 23;
    const pages = Math.max(1, Math.ceil(monthData.sales.length / perPage));
    for (let page = 0; page < pages; page++) {
      if (page) pdf.addPage();
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(17);
      pdf.text("HAVESTORY — MONTHLY COUNTER SALES", 105, 17, { align: "center" });
      pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
      pdf.text(`${monthData.month} · Page ${page + 1} of ${pages}`, 105, 24, { align: "center" });
      pdf.line(14, 29, 196, 29);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text(`Bills: ${monthData.summary.count}`, 15, 36);
      pdf.text(`Cash: ${rs(monthData.summary.cash)}`, 48, 36);
      pdf.text(`Card: ${rs(monthData.summary.card)}`, 98, 36);
      pdf.text(`Transfer: ${rs(monthData.summary.transfer)}`, 145, 36);
      pdf.setFillColor(47, 22, 56); pdf.rect(14, 41, 182, 11, "F"); pdf.setTextColor(255, 255, 255);
      pdf.text("DATE / TIME", 17, 48); pdf.text("RECEIPT / INVOICE", 48, 48); pdf.text("CUSTOMER", 101, 48); pdf.text("METHOD", 158, 48); pdf.text("TOTAL", 192, 48, { align: "right" });
      pdf.setTextColor(20, 20, 20); let y = 59;
      for (const sale of monthData.sales.slice(page * perPage, (page + 1) * perPage)) {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
        const when = new Date(sale.sold_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        pdf.text(when, 17, y); pdf.text(String(sale.receipt_number).slice(0, 24), 48, y); pdf.text(String(sale.customer_name || "").slice(0, 30), 101, y); pdf.text(String(sale.payment_method).toUpperCase(), 158, y); pdf.text(rs(Number(sale.total)), 192, y, { align: "right" });
        pdf.setDrawColor(225, 225, 225); pdf.line(14, y + 3, 196, y + 3); y += 9;
      }
      pdf.setDrawColor(20, 20, 20); pdf.line(14, 274, 196, 274); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
      pdf.text(`MONTH TOTAL  ${rs(monthData.summary.total)}`, 192, 282, { align: "right" });
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text(`Generated ${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })} · HAVESTORY`, 15, 282);
    }
    pdf.save(`HAVESTORY-POS-MONTH-${monthData.month}.pdf`);
  };
  const closeDay = async () => {
    try {
      await request("/api/pos/close-day", {
        method: "POST",
        body: JSON.stringify({ closingCash: closing }),
      });
      toast({
        title: "POS day closed",
        description: `Counted cash ${rs(Number(closing))}`,
      });
      await load();
    } catch (e: any) {
      toast({
        title: "Could not close day",
        description: e.message,
        variant: "destructive",
      });
    }
  };
  const requestReopen = async () => {
    setDayActionBusy(true);
    try {
      await request("/api/pos/request-reopen", { method: "POST", body: JSON.stringify({ reason: reopenReason }) });
      toast({ title: "Reopen request sent", description: "The owner will see a special notice on this page." });
      setReopenReason("");
      await load();
    } catch (e: any) {
      toast({ title: "Request could not be sent", description: e.message, variant: "destructive" });
    } finally { setDayActionBusy(false); }
  };
  const reopenDay = async () => {
    if (!window.confirm("Reopen today's POS day? New sales will be allowed again.")) return;
    setDayActionBusy(true);
    try {
      await request("/api/pos/reopen-day", { method: "POST" });
      toast({ title: "POS day reopened", description: "The counter can accept sales again." });
      await load();
    } catch (e: any) {
      toast({ title: "Day could not be reopened", description: e.message, variant: "destructive" });
    } finally { setDayActionBusy(false); }
  };
  const input =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100";
  if (!day)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="animate-spin text-violet-700" />
      </div>
    );
  return (
    <div className="space-y-5 pb-10">
      <header className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-950 text-white">
              <Store />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.2em] text-violet-700">
                In-store checkout
              </div>
              <h1 className="text-2xl font-black text-slate-950">
                POS / Counter Sales
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Collect payment first, then issue a 58 mm or 80 mm thermal bill.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={width}
              onChange={(e) => setWidth(e.target.value as any)}
              className={`${input} w-28`}
            >
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
            </select>
            <button
              onClick={downloadReport}
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black"
            >
              <FileDown size={16} /> Day PDF
            </button>
            <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className={`${input} w-36`} aria-label="POS report month" />
            <button onClick={downloadMonthReport} disabled={!monthData} className="flex h-11 items-center gap-2 rounded-xl bg-violet-950 px-4 text-xs font-black text-white disabled:opacity-40">
              <CalendarDays size={16} /> Month PDF
            </button>
          </div>
        </div>
      </header>
      {day.session?.closed_at && (
        <section className="rounded-[22px] border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <h2 className="font-black">This POS day is closed</h2>
              <p className="mt-1 text-sm text-amber-900">Closed by {day.session.closed_by || "an administrator"}. Sales stay locked until the owner reopens the day.</p>
              {me?.role === "owner" ? (
                <div className="mt-4">
                  {day.reopenRequest && (
                    <div className="mb-3 rounded-xl border border-amber-300 bg-white/80 p-3 text-sm">
                      <b>Reopen request from @{day.reopenRequest.requested_by_username}</b>
                      <p className="mt-1 text-amber-900">{day.reopenRequest.reason}</p>
                    </div>
                  )}
                  <button onClick={reopenDay} disabled={dayActionBusy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-900 px-5 text-xs font-black text-white disabled:opacity-50">
                    <RotateCcw size={16} /> Reopen today’s POS day
                  </button>
                </div>
              ) : day.reopenRequest?.status === "pending" ? (
                <p className="mt-3 inline-flex rounded-lg bg-amber-200 px-3 py-2 text-xs font-black">Reopen request pending owner approval</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="Why should this day be reopened?" className={`${input} sm:max-w-md`} />
                  <button onClick={requestReopen} disabled={dayActionBusy || !reopenReason.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 text-xs font-black text-white disabled:opacity-50">
                    <Send size={15} /> Request owner to reopen
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {!day.session ? (
        <section className="mx-auto max-w-xl rounded-[26px] border border-amber-200 bg-amber-50 p-6">
          <Banknote className="text-amber-700" />
          <h2 className="mt-3 text-xl font-black text-slate-950">
            Start today’s counter
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the cash placed in the drawer before the first sale.
          </p>
          <label className="mt-5 block text-xs font-black uppercase text-slate-600">
            Day-start fund
            <input
              type="number"
              min="0"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              className={`${input} mt-2`}
            />
          </label>
          <button
            onClick={startDay}
            disabled={me?.role !== "owner" && !(me?.permissions || []).includes("pos_day_start")}
            className="mt-4 h-12 w-full rounded-xl bg-violet-950 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open counter with {rs(Number(opening))}
          </button>
          {me?.role !== "owner" && !(me?.permissions || []).includes("pos_day_start") && (
            <p className="mt-2 text-center text-xs font-bold text-amber-800">Your account can use POS after an owner starts the day.</p>
          )}
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Opening float",
                rs(Number(day.session.opening_float)),
                Banknote,
              ],
              ["Bills issued", String(day.summary.count), Receipt],
              ["Counter sales", rs(day.summary.sales), ShoppingBag],
              ["Expected cash", rs(day.summary.expectedCash), CheckCircle2],
            ].map(([label, value, Icon]: any) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span>{label}</span>
                  <Icon size={16} />
                </div>
                <div className="mt-3 text-xl font-black text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </section>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search item name or code"
                    className={`${input} pl-10`}
                  />
                </label>
                <div className="flex gap-2 sm:w-60">
                  <input
                    ref={codeRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addByCode()}
                    placeholder="P0001"
                    className={input}
                  />
                  <button
                    onClick={addByCode}
                    className="h-11 rounded-xl bg-violet-950 px-4 text-xs font-black text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setShowNewItem((value) => !value)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-black text-violet-900"
                >
                  <Plus size={14} />{" "}
                  {showNewItem ? "Close item form" : "Add POS-only item"}
                </button>
              </div>
              {showNewItem && (
                <div className="mt-3 grid gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-3 sm:grid-cols-[120px_minmax(0,1fr)_130px_auto]">
                  <input
                    value={newItem.code}
                    onChange={(e) =>
                      setNewItem({ ...newItem, code: e.target.value })
                    }
                    placeholder="Code"
                    className={input}
                  />
                  <input
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    placeholder="Item name"
                    className={input}
                  />
                  <input
                    type="number"
                    min="0"
                    value={newItem.price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, price: e.target.value })
                    }
                    placeholder="Price"
                    className={input}
                  />
                  <button
                    onClick={savePosItem}
                    disabled={
                      !newItem.code.trim() ||
                      !newItem.name.trim() ||
                      newItem.price === ""
                    }
                    className="rounded-xl bg-violet-950 px-4 text-xs font-black text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => add(p)}
                    disabled={!!selectedInvoice}
                    className="rounded-2xl border border-slate-200 p-4 text-left hover:border-violet-300 disabled:opacity-40"
                  >
                    <span className="text-[10px] font-black text-violet-700">
                      {p.code}
                    </span>
                    <b className="mt-1 block text-sm text-slate-950">
                      {p.name}
                    </b>
                    <span className="mt-2 block text-sm font-black">
                      {rs(p.price)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <aside className="pos-bill-panel h-fit rounded-[26px] border border-slate-200 bg-white p-5 text-slate-950 shadow-sm xl:sticky xl:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Current bill</h2>
                {(cart.length > 0 || selectedInvoice) && (
                  <button
                    onClick={() => {
                      setCart([]);
                      setSelectedInvoice(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className="mt-4 border-b border-slate-100 pb-4">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Settle an existing invoice
                  <input
                    value={invoiceQuery}
                    onChange={(e) => setInvoiceQuery(e.target.value)}
                    placeholder="Invoice number or customer"
                    className={`${input} mt-1.5`}
                  />
                </label>
                {invoices.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-auto rounded-xl border">
                    {invoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setCart([]);
                          setCustomer(inv.clientName);
                          setInvoiceQuery(inv.invoiceNumber);
                          setInvoices([]);
                        }}
                        className="flex w-full justify-between border-b p-3 text-left text-xs last:border-0"
                      >
                        <span>
                          <b>{inv.invoiceNumber}</b>
                          <br />
                          {inv.clientName}
                        </span>
                        <b>{rs(inv.balance)}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {selectedInvoice ? (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <b className="text-violet-950">
                      {selectedInvoice.invoiceNumber}
                    </b>
                    <p className="text-xs text-violet-800">
                      {selectedInvoice.clientName}
                    </p>
                    <p className="mt-2 text-lg font-black">
                      Balance {rs(selectedInvoice.balance)}
                    </p>
                  </div>
                ) : cart.length ? (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-xs">{item.name}</b>
                        <span className="text-[10px] text-slate-500">
                          {item.code} · {rs(item.price)}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setCart((c) =>
                            c.map((i) =>
                              i.id === item.id
                                ? { ...i, qty: Math.max(1, i.qty - 1) }
                                : i,
                            ),
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <b className="w-5 text-center text-xs">{item.qty}</b>
                      <button
                        onClick={() =>
                          setCart((c) =>
                            c.map((i) =>
                              i.id === item.id ? { ...i, qty: i.qty + 1 } : i,
                            ),
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setCart((c) => c.filter((i) => i.id !== item.id))
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-slate-400">
                    Add items by code or select an invoice.
                  </div>
                )}
              </div>
              <label className="mt-4 block text-[10px] font-black uppercase text-slate-500">
                Customer (optional)
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  disabled={!!selectedInvoice}
                  placeholder="Walk-in customer"
                  className={`${input} mt-1.5`}
                />
              </label>
              <div className="mt-4 flex justify-between border-t pt-4 text-xl font-black">
                <span>Total</span>
                <span>{rs(total)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Payment
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className={`${input} mt-1.5`}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Customer gave
                  <input
                    type="number"
                    min={total}
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    className={`${input} mt-1.5`}
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-900">
                <span>Balance / Change</span>
                <span>{rs(change)}</span>
              </div>
              <button
                onClick={complete}
                disabled={saving || !!day.session.closed_at || total <= 0 || received < total}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-950 font-black text-white disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Printer size={17} />
                )}{" "}
                Collect payment &amp; print bill
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                The sale is recorded only after payment is confirmed here.
              </p>
            </aside>
          </div>
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">Today’s issued bills</h2>
                <p className="text-xs text-slate-500">
                  Counter income is separate from online/website sales.
                </p>
              </div>
              {!day.session.closed_at && (me?.role === "owner" || (me?.permissions || []).includes("pos_day_close")) && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={closing}
                    onChange={(e) => setClosing(e.target.value)}
                    placeholder="Counted cash"
                    className={`${input} w-40`}
                  />
                  <button
                    onClick={closeDay}
                    disabled={!closing}
                    className="rounded-xl border border-slate-300 px-4 text-xs font-black disabled:opacity-40"
                  >
                    Close day
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase text-slate-400">
                    {[
                      "Time",
                      "Receipt",
                      "Invoice",
                      "Customer",
                      "Payment",
                      "Total",
                      "Print",
                    ].map((h) => (
                      <th key={h} className="px-3 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {day.sales.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        {new Date(s.sold_at).toLocaleTimeString("en-LK", {
                          timeZone: "Asia/Colombo",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 font-bold">{s.receipt_number}</td>
                      <td className="px-3">{s.invoice_number || "—"}</td>
                      <td className="px-3">{s.customer_name}</td>
                      <td className="px-3 uppercase">{s.payment_method}</td>
                      <td className="px-3 font-black">{rs(Number(s.total))}</td>
                      <td className="px-3">
                        <button
                          onClick={() => printReceipt(s, width, receiptBrand)}
                          className="rounded-lg bg-slate-100 p-2"
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {day.sales.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">
                  No bills issued today.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
