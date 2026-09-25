import { POSHistory, POSDayEnd } from "@/components/admin/POSDayTools";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BankDepositDialog } from '@/components/admin/BankDepositDialog';
import { defaultPOSBank, type BankEntry } from '@workspace/api-zod';
import { bankPrintHTML } from '@/lib/bank-print';
import { POSItemOptions, emptyPOSConfig, type POSItemConfig } from "@/components/admin/POSItemOptions";
import { posConfig, quotePosProduct } from "@workspace/api-zod";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Pencil,
  Percent,
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
  customConfig?: string;
  posOnly?: boolean;
};
type CartItem = Product & { qty: number; cartKey: string; sizeId: string; choices: Record<string, string>; basePrice: number; unitLabel: string };
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
  subtotal?: string;
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
  bank?: BankEntry;
};

function printReceipt(sale: Sale, width: "58" | "80", brand: ReceiptBrand, prepared?: Window | null) {
  const win = prepared === undefined ? window.open("", "_blank", "popup=yes,width=500,height=760") : prepared;
  if (!win) {
    window.alert("Please allow pop-ups to print the POS bill.");
    return;
  }
  const mm = width === "58" ? 58 : 80;
  const items = Array.isArray(sale.items) ? sale.items : [];
  const discount = Math.max(0, Number(sale.subtotal ?? sale.total) - Number(sale.total));
  const businessName = brand.businessName || "HAVESTORY";
  const contactLines = [brand.address, brand.phone, brand.email, brand.website]
    .filter(Boolean)
    .map(esc)
    .join("<br>");
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.receipt_number)}</title><style>@page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}html,body{width:${mm}mm;min-width:${mm}mm;margin:0;padding:0;background:#fff;color:#000}body{font-family:Arial,Helvetica,sans-serif;font-size:${width === "58" ? 10 : 11}px;line-height:1.35;font-variant-numeric:tabular-nums}.r{width:${mm}mm;padding:${width === "58" ? 3 : 4}mm;overflow:hidden}.c,.center{text-align:center}.brand{font-size:${width === "58" ? 16 : 19}px;font-weight:900;letter-spacing:.5px;overflow-wrap:anywhere}.tagline{margin-top:1mm;font-size:.92em}.meta{margin-top:2mm;overflow-wrap:anywhere}.rule{border-top:1px dashed #000;margin:2.5mm 0}.row{display:flex;justify-content:space-between;gap:2mm;padding:1mm 0}.item{border-bottom:1px dotted #aaa}.item span:first-child{max-width:68%;overflow-wrap:anywhere}.total{font-size:1.2em;font-weight:900;border-top:1px solid #000;margin-top:1mm;padding-top:1.5mm}.change{border:1.5px solid #000;padding:1.5mm;font-size:1.15em}.small{font-size:.88em}.bold{font-weight:800}.footer{margin-top:3mm;font-size:.9em}@media print{html,body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><main class="r"><header class="center"><div class="brand">${esc(businessName)}</div><div class="tagline">THE COLOUR &amp; FRAME STUDIO</div><div class="meta small">${contactLines}</div></header><div class="rule"></div><div class="center bold">POS RECEIPT</div><div class="center">${esc(sale.receipt_number)}</div>${sale.invoice_number ? `<div class="center small">Invoice: ${esc(sale.invoice_number)}</div>` : ""}<div class="center small">${esc(new Date(sale.sold_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo" }))}</div><div class="rule"></div><div class="bold">${esc(sale.customer_name || "Walk-in customer")}</div><div class="rule"></div>${items.map((i) => `<div class="row item"><span><b>${esc(i.name)}</b><br><span class="small">${i.qty}${i.unitLabel ? ` ${esc(i.unitLabel)}` : ""} × ${rs(Number(i.price))}${i.code ? ` · ${esc(i.code)}` : ""}</span></span><b>${rs(Number(i.price) * Number(i.qty))}</b></div>`).join("")}${discount > 0 ? `<div class="row"><span>Subtotal</span><span>${rs(Number(sale.subtotal))}</span></div><div class="row"><span>Discount</span><span>−${rs(discount)}</span></div>` : ""}<div class="row total"><span>Total</span><span>${rs(Number(sale.total))}</span></div><div class="row"><span>Received</span><b>${rs(Number(sale.amount_tendered))}</b></div><div class="row change"><span>Balance / Change</span><b>${rs(Number(sale.change_due))}</b></div><div class="row small"><span>Payment</span><b>${esc(sale.payment_method.toUpperCase())}</b></div>${bankPrintHTML(brand.bank)}<footer class="footer center"><div class="rule"></div>Issued by Mr. ${esc(sale.sold_by)}<br>Thank you for choosing ${esc(businessName)}.</footer></main></body></html>`,
  );
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    if (!win.closed) {
      win.print();
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
    bank: defaultPOSBank(receiptSettings),
  };
  const codeRef = useRef<HTMLInputElement>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [configuring, setConfiguring] = useState<Product | null>(null);

  const [sizeId, setSizeId] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
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
  const saleLock = useRef(false);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [dayActionBusy, setDayActionBusy] = useState(false);
  const [reportMonth, setReportMonth] = useState(today().slice(0, 7));
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newConfig, setNewConfig] = useState<POSItemConfig>(emptyPOSConfig);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
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
    const controller = new AbortController();
    const timer = setTimeout(() => {
      request(`/api/pos/invoices?q=${encodeURIComponent(invoiceQuery)}`, { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setInvoices(result); })
        .catch(() => { if (!controller.signal.aborted) setInvoices([]); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [invoiceQuery]);
  useEffect(() => {
    request(`/api/pos/month?month=${encodeURIComponent(reportMonth)}`)
      .then(setMonthData)
      .catch(() => setMonthData(null));
  }, [reportMonth]);
  const subtotal = selectedInvoice
    ? selectedInvoice.balance
    : cart.reduce((sum, item) => sum + Math.round(item.price * item.qty * 100), 0) / 100;
  const rawDiscount = Number(discountValue || 0);
  const invalidDiscount = !selectedInvoice && (!Number.isFinite(rawDiscount) || rawDiscount < 0 || (discountType === "percent" ? rawDiscount > 100 : rawDiscount > subtotal));
  const discount = selectedInvoice || invalidDiscount ? 0 : Math.round((discountType === "percent" ? subtotal * rawDiscount / 100 : rawDiscount) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const received = Number(tendered) || 0;
  const change = Math.max(0, received - total);
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return products
      .filter((p) => !q || `${p.code} ${p.name}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [products, query]);
  const addConfigured = (product: Product, qty: number, selectedSize = '', selectedChoices: Record<string, string> = {}) => {
    try {
      const quote = quotePosProduct(product.price, product.customConfig, qty, selectedSize, selectedChoices);
      const cartKey = JSON.stringify([product.id, selectedSize, Object.entries(selectedChoices).sort()]);
      const existing = cart.find(item => item.cartKey === cartKey);
      const nextQty = existing ? existing.qty + qty : qty;
      const nextQuote = quotePosProduct(product.price, product.customConfig, nextQty, selectedSize, selectedChoices);
      const next: CartItem = { ...product, basePrice: product.price, price: nextQuote.price, qty: nextQty, cartKey, sizeId: selectedSize, choices: selectedChoices, unitLabel: quote.unitLabel, name: [product.name, quote.description].filter(Boolean).join(' · ') };
      setCart(old => existing ? old.map(item => item.cartKey === cartKey ? next : item) : [...old, next]);
      setConfiguring(null); setCode(''); codeRef.current?.focus();
    } catch (e: any) { toast({ title: 'Check product quantity and options', description: e.message, variant: 'destructive' }); }
  };
  const add = (product: Product) => {
    if (selectedInvoice) return;
    const config = posConfig(product.customConfig);
    if (config.productType === "custom_print" || config.sizes?.length || config.optionGroups?.length || config.minQuantity > 1 || config.quantityStep > 1) {
      setConfiguring(product); setSizeId(''); setChoices({}); setQuantity(Math.max(1, Number(config.minQuantity) || 1));
    } else addConfigured(product, 1);
  };
  const changeQuantity = (item: CartItem, direction: number) => {
    try {
      const current = quotePosProduct(item.basePrice, item.customConfig, item.qty, item.sizeId, item.choices);
      const qty = Math.max(current.minQty, item.qty + direction * current.step);
      const quote = quotePosProduct(item.basePrice, item.customConfig, qty, item.sizeId, item.choices);
      setCart(old => old.map(line => line.cartKey === item.cartKey ? { ...line, qty, price: quote.price } : line));
    } catch (e: any) { toast({ title: 'Quantity unavailable', description: e.message, variant: 'destructive' }); }
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
    if (itemSaving) return;
    setItemSaving(true);
    try {
      await request(editingItem ? `/api/pos/items/${editingItem.replace("pos-", "")}` : "/api/pos/items", {
        method: editingItem ? "PUT" : "POST",
        body: JSON.stringify({ ...newItem, customConfig: newConfig }),
      });
      toast({
        title: "POS item saved",
        description: `${newItem.code.toUpperCase()} · ${newItem.name}`,
      });
      setNewItem({ code: "", name: "", price: "" });
      setShowNewItem(false);
      setNewConfig(emptyPOSConfig());
      setEditingItem(null);
      await load();
    } catch (e: any) {
      toast({
        title: "Item could not be saved",
        description: e.message,
        variant: "destructive",
      });
    }
    finally { setItemSaving(false); }
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
    if (saleLock.current || saving || day?.session?.closed_at || invalidDiscount || total <= 0 || !Number.isFinite(received) || received < total) return;
    saleLock.current = true;
    setSaving(true);
    const printWindow = window.open("", "_blank", "popup=yes,width=500,height=760");
    try {
      const sale = await request("/api/pos/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart,
          invoiceId: selectedInvoice?.id,
          customerName: customer,
          amountTendered: received,
          paymentMethod: method,
          discountType,
          discountValue: selectedInvoice ? 0 : rawDiscount,
        }),
      });
      // The sale is already recorded. A print failure must never invite another charge.
      let printMessage = 'Print window opened.';
      try {
        if (printWindow && !printWindow.closed) printReceipt(sale, width, receiptBrand, printWindow);
        else printMessage = 'Use the print button in today’s issued bills to print your receipt.';
      } catch { printMessage = 'Use the print button in today’s issued bills to retry printing.'; }
      toast({
        title: "Payment collected",
        description: `${sale.receipt_number} · ${printMessage}`,
      });
      setCart([]);
      setSelectedInvoice(null); setDiscountValue("");
      setCustomer("");
      setTendered("");
      setInvoiceQuery("");
      await load();
    } catch (e: any) {
      printWindow?.close();
      toast({
        title: "Sale could not be completed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      saleLock.current = false;
      setSaving(false);
    }
  };
  const downloadReport = () => {
    if (!day) return;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 0;
    const header = () => {
      pdf.setTextColor(36, 30, 25);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
      pdf.text('HAVESTORY — COUNTER SALES', 105, 18, { align: 'center' });
      pdf.setFontSize(9); pdf.text(`Day-end report · ${day.date}`, 105, 25, { align: 'center' });
      pdf.setDrawColor(180, 170, 160); pdf.line(15, 30, 195, 30);
      pdf.setFontSize(8);
      pdf.text('TIME', 15, 38); pdf.text('RECEIPT / INVOICE', 36, 38);
      pdf.text('CUSTOMER', 82, 38); pdf.text('METHOD', 135, 38);
      pdf.text('TOTAL', 195, 38, { align: 'right' });
      pdf.line(15, 41, 195, 41);
      y = 48;
    };
    header();
    for (const sale of day.sales) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
      const receipt = pdf.splitTextToSize(String(sale.receipt_number), 44);
      const customer = pdf.splitTextToSize(String(sale.customer_name || ''), 50);
      const method = pdf.splitTextToSize(String(sale.payment_method).toUpperCase(), 27);
      const height = Math.max(9, Math.max(receipt.length, customer.length, method.length) * 3.6 + 3);
      if (y + height > 264) { pdf.addPage(); header(); }
      pdf.text(new Date(sale.sold_at).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' }), 15, y);
      pdf.text(receipt, 36, y); pdf.text(customer, 82, y);
      pdf.text(method, 135, y); pdf.text(rs(Number(sale.total)), 195, y, { align: 'right' });
      pdf.setDrawColor(235, 230, 225); pdf.line(15, y + height - 3, 195, y + height - 3);
      y += height;
    }
    const count = pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      pdf.setPage(page); pdf.setDrawColor(180, 170, 160); pdf.line(15, 270, 195, 270);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
      pdf.text(`Opening: ${rs(Number(day.session?.opening_float || 0))}  ·  Sales: ${rs(day.summary.sales)}  ·  Expected cash: ${rs(day.summary.expectedCash)}`, 15, 278);
      pdf.text(`${page} / ${count}`, 195, 278, { align: 'right' });
    }
    pdf.save(`HAVESTORY-POS-${day.date}.pdf`);
  };
  const downloadMonthReport = () => {
    if (!monthData) return;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 0;
    const header = () => {
      pdf.setTextColor(36, 30, 25);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
      pdf.text('HAVESTORY — MONTHLY COUNTER SALES', 105, 17, { align: 'center' });
      pdf.setFontSize(9); pdf.text(monthData.month, 105, 24, { align: 'center' });
      pdf.setDrawColor(180, 170, 160); pdf.line(14, 29, 196, 29);
      pdf.setFontSize(8);
      pdf.text(`Bills: ${monthData.summary.count}`, 15, 36);
      pdf.text(`Cash: ${rs(monthData.summary.cash)}`, 48, 36);
      pdf.text(`Card: ${rs(monthData.summary.card)}`, 98, 36);
      pdf.text(`Transfer: ${rs(monthData.summary.transfer)}`, 145, 36);
      pdf.setFillColor(54, 43, 34); pdf.rect(14, 41, 182, 11, 'F'); pdf.setTextColor(255, 255, 255);
      pdf.text('DATE / TIME', 17, 48); pdf.text('RECEIPT / INVOICE', 48, 48);
      pdf.text('CUSTOMER', 101, 48); pdf.text('METHOD', 147, 48);
      pdf.text('TOTAL', 192, 48, { align: 'right' });
      pdf.setTextColor(36, 30, 25); y = 59;
    };
    header();
    for (const sale of monthData.sales) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
      const receipt = pdf.splitTextToSize(String(sale.receipt_number), 50);
      const customer = pdf.splitTextToSize(String(sale.customer_name || ''), 43);
      const method = pdf.splitTextToSize(String(sale.payment_method).toUpperCase(), 22);
      const height = Math.max(9, Math.max(receipt.length, customer.length, method.length) * 3.6 + 3);
      if (y + height > 265) { pdf.addPage(); header(); }
      const when = new Date(sale.sold_at).toLocaleString('en-LK', { timeZone: 'Asia/Colombo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      pdf.text(when, 17, y); pdf.text(receipt, 48, y); pdf.text(customer, 101, y);
      pdf.text(method, 147, y); pdf.text(rs(Number(sale.total)), 192, y, { align: 'right' });
      pdf.setDrawColor(235, 230, 225); pdf.line(14, y + height - 3, 196, y + height - 3);
      y += height;
    }
    const count = pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      pdf.setPage(page); pdf.setDrawColor(180, 170, 160); pdf.line(14, 274, 196, 274);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9);
      pdf.text(`MONTH TOTAL  ${rs(monthData.summary.total)}`, 192, 282, { align: 'right' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
      pdf.text(`Generated ${new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })} · ${page} / ${count}`, 15, 282);
    }
    pdf.save(`HAVESTORY-POS-MONTH-${monthData.month}.pdf`);
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
    "h-11 w-full rounded-xl border border-admin-border bg-admin-surface px-3 text-sm font-bold text-admin-ink outline-none focus:border-admin-brand-line focus:ring-4 focus:ring-admin-brand";
  if (!day)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="animate-spin text-admin-brand-ink" />
      </div>
    );
  return (
    <div className="pos-workspace space-y-5 pb-10">
      {showDeposit && <BankDepositDialog settings={receiptSettings} width={width} date={day?.date || today()} amount={day?.session?.deposit_amount ? String(day.session.deposit_amount) : ''} remark={day?.session?.deposit_remark} onClose={() => setShowDeposit(false)} />}
      <Dialog open={!!configuring} onOpenChange={open => { if (!open) setConfiguring(null); }}>
        <DialogContent className="pos-dialog pos-config-dialog" onCloseAutoFocus={e => { e.preventDefault(); codeRef.current?.focus(); }}>
          <DialogTitle>{configuring?.name || 'Configure POS item'}</DialogTitle>
          <DialogDescription>Select the customer’s size, options and quantity before adding to the bill.</DialogDescription>
          {configuring && (() => {
            const config = posConfig(configuring.customConfig);
            const selectedSize = config.sizes?.find((s: any) => s.id === sizeId);
            const min = Math.max(1, Number(selectedSize?.minQty) || Number(config.minQuantity) || 1);
            const step = Math.max(1, Number(selectedSize?.packSize) || Number(config.quantityStep) || 1);
            let quote: ReturnType<typeof quotePosProduct> | undefined;
            let error = '';
            try { quote = quotePosProduct(configuring.price, configuring.customConfig, quantity, sizeId, choices); } catch (e) { error = e instanceof Error ? e.message : 'Check your selections'; }
            return <form onSubmit={e => { e.preventDefault(); if (quote) addConfigured(configuring, quantity, sizeId, choices); }}>
              <div className="pos-fields">
                {!!config.sizes?.length && <label className="pos-field">Size<select value={sizeId} onChange={e => { setSizeId(e.target.value); const size = config.sizes.find((s: any) => s.id === e.target.value); setQuantity(Math.max(1, Number(size?.minQty) || Number(config.minQuantity) || 1)); }}><option value="">Choose size</option>{config.sizes.map((size: any) => <option key={size.id} value={size.id}>{size.name} · {size.unitLabel || 'unit'}</option>)}</select></label>}
                <label className="pos-field">Quantity ({selectedSize?.unitLabel || 'units'})<input type="number" required min={min} step={step} value={quantity || ''} onChange={e => setQuantity(Number(e.target.value))} /><span className="pos-helper">Minimum {min} · increments of {step}</span></label>
              </div>
              {(config.optionGroups || []).filter((g: any) => g.choices?.length).map((group: any) => <fieldset className="pos-option-group" key={group.id}><legend>{group.title}</legend><div className="pos-option-list">{group.choices.map((choice: any) => {
                const override = choice.sizePrices?.find((p: any) => p.sizeId === sizeId);
                const price = Number(override ? override.price : choice.price || 0);
                return <label key={choice.id} className="pos-option"><input type="radio" name={`option-${group.id}`} checked={choices[group.id] === choice.id} onChange={() => setChoices(old => ({ ...old, [group.id]: choice.id }))} /><span>{choice.name}</span><small>{choice.chargeType === 'qty_range' ? 'Quantity pricing' : `${rs(price)} / ${choice.chargeType === 'flat' ? 'order' : 'unit'}`}</small></label>;
              })}</div></fieldset>)}
              <div className="pos-quote" aria-live="polite">{quote ? <><span>Estimated unit price<strong>{rs(quote.price)}</strong></span><span>Bill total<strong>{rs(quote.lineTotal)}</strong></span></> : <p>{error}</p>}</div>
              <div className="pos-dialog-actions"><button type="button" className="pos-secondary" onClick={() => setConfiguring(null)}>Cancel</button><button type="submit" className="pos-primary" disabled={!quote}><Plus size={16} /> Add to bill{quote ? ` · ${rs(quote.lineTotal)}` : ''}</button></div>
            </form>;
          })()}
        </DialogContent>
      </Dialog>
      <header className="rounded-[26px] border border-admin-border bg-admin-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-admin-brand text-white">
              <Store />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-admin-brand-ink">
                In-store checkout
              </div>
              <h1 className="text-2xl font-bold text-admin-ink">
                POS / Counter Sales
              </h1>
              <p className="mt-1 text-sm text-admin-muted">
                Collect payment first, then issue a 58 mm or 80 mm thermal bill.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button data-deposit-trigger type="button" onClick={() => setShowDeposit(true)} className="pos-secondary"><Printer size={16} /> Bank deposit receipt</button>
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
              className="flex h-11 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-4 text-xs font-bold"
            >
              <FileDown size={16} /> Day PDF
            </button>
            <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className={`${input} w-36`} aria-label="POS report month" />
            <button onClick={downloadMonthReport} disabled={!monthData} className="flex h-11 items-center gap-2 rounded-xl bg-admin-brand px-4 text-xs font-bold text-white disabled:opacity-40">
              <CalendarDays size={16} /> Month PDF
            </button>
          </div>
        </div>
      </header>
      {day.session?.closed_at && (
        <section className="rounded-[22px] border-2 border-admin-warning-line bg-admin-warning-soft p-5 text-admin-warning shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-admin-warning" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">This POS day is closed</h2>
              <p className="mt-1 text-sm text-admin-warning">Closed by {day.session.closed_by || "an administrator"}. Sales stay locked until the owner reopens the day.</p>
              {me?.role === "owner" ? (
                <div className="mt-4">
                  {day.reopenRequest && (
                    <div className="mb-3 rounded-xl border border-admin-warning-line bg-admin-surface/80 p-3 text-sm">
                      <b>Reopen request from @{day.reopenRequest.requested_by_username}</b>
                      <p className="mt-1 text-admin-warning">{day.reopenRequest.reason}</p>
                    </div>
                  )}
                  <button onClick={reopenDay} disabled={dayActionBusy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-admin-warning-solid px-5 text-xs font-bold text-white disabled:opacity-50">
                    <RotateCcw size={16} /> Reopen today’s POS day
                  </button>
                </div>
              ) : day.reopenRequest?.status === "pending" ? (
                <p className="mt-3 inline-flex rounded-lg bg-admin-warning-soft px-3 py-2 text-xs font-bold">Reopen request pending owner approval</p>
              ) : (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input value={reopenReason} onChange={e => setReopenReason(e.target.value)} placeholder="Why should this day be reopened?" className={`${input} sm:max-w-md`} />
                  <button onClick={requestReopen} disabled={dayActionBusy || !reopenReason.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-admin-warning-solid px-5 text-xs font-bold text-white disabled:opacity-50">
                    <Send size={15} /> Request owner to reopen
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {!day.session ? (
        <section className="mx-auto max-w-xl rounded-[26px] border border-admin-warning-line bg-admin-warning-soft p-6">
          <Banknote className="text-admin-warning" />
          <h2 className="mt-3 text-xl font-bold text-admin-ink">
            Start today’s counter
          </h2>
          <p className="mt-1 text-sm text-admin-muted">
            Enter the cash placed in the drawer before the first sale.
          </p>
          <label className="mt-5 block text-xs font-bold uppercase text-admin-muted">
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
            className="mt-4 h-12 w-full rounded-xl bg-admin-brand font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open counter with {rs(Number(opening))}
          </button>
          {me?.role !== "owner" && !(me?.permissions || []).includes("pos_day_start") && (
            <p className="mt-2 text-center text-xs font-bold text-admin-warning">Your account can use POS after an owner starts the day.</p>
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
  Pencil,
  Percent,
              ],
              ["Bills issued", String(day.summary.count), Receipt],
              ["Counter sales", rs(day.summary.sales), ShoppingBag],
              ["Expected cash", rs(day.summary.expectedCash), CheckCircle2],
            ].map(([label, value, Icon]: any) => (
              <div
                key={label}
                className="rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-sm"
              >
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-admin-muted">
                  <span>{label}</span>
                  <Icon size={16} />
                </div>
                <div className="mt-3 text-xl font-bold text-admin-ink">
                  {value}
                </div>
              </div>
            ))}
          </section>
          <div className="pos-sales-grid grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="rounded-[26px] border border-admin-border bg-admin-surface p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-3.5 text-admin-muted"
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
                    className="h-11 rounded-xl bg-admin-brand px-4 text-xs font-bold text-white"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  disabled={itemSaving}
                  onClick={() => { setShowNewItem(value => !value); setEditingItem(null); setNewItem({ code: "", name: "", price: "" }); setNewConfig(emptyPOSConfig()); }}
                  className="flex items-center gap-1.5 rounded-lg border border-admin-brand-line bg-admin-brand-soft px-3 py-2 text-[11px] font-bold text-admin-brand-ink"
                >
                  <Plus size={14} />{" "}
                  {showNewItem ? "Close item form" : "Add POS-only item"}
                </button>
              </div>
              {showNewItem && (
                <fieldset disabled={itemSaving} className="mt-3 grid min-w-0 gap-3 rounded-2xl border border-admin-brand-line bg-admin-brand-soft p-4 sm:grid-cols-3"><legend className="px-2 font-semibold">{editingItem ? "Edit POS item" : "New POS item"}</legend>
                  <input
                    value={newItem.code}
                    onChange={(e) =>
                      setNewItem({ ...newItem, code: e.target.value })
                    }
                    aria-label="Item code"
                    placeholder="Code"
                    className={input}
                  />
                  <input
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    aria-label="Item name"
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
                    aria-label="Base unit price"
                    placeholder="Base unit price"
                    className={input}
                  />
                  <POSItemOptions config={newConfig} onChange={setNewConfig} />
                  <button
                    style={{ gridColumn: "1 / -1" }}
                    onClick={savePosItem}
                    disabled={
                      itemSaving || !newItem.code.trim() ||
                      !newItem.name.trim() ||
                      newItem.price === ""
                    }
                    className="min-h-11 rounded-xl bg-admin-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {itemSaving ? "Saving…" : editingItem ? "Save item changes" : "Save POS item"}
                  </button>
                </fieldset>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <div key={p.id} className="min-w-0 rounded-2xl border border-admin-border">
                  <button
                    onClick={() => add(p)}
                    disabled={!!selectedInvoice}
                    className="w-full rounded-2xl p-4 text-left hover:bg-admin-brand-soft disabled:opacity-40"
                  >
                    <span className="text-[10px] font-bold text-admin-brand-ink">
                      {p.code}
                    </span>
                    <b className="mt-1 block text-sm text-admin-ink">
                      {p.name}
                    </b>
                    <span className="mt-2 block text-sm font-bold">
                      {posConfig(p.customConfig).sizes?.length ? "Choose size & unit price" : rs(p.price)}
                    </span>
                  </button>
                  {p.posOnly && <button type="button" disabled={itemSaving} onClick={() => { setEditingItem(p.id); setNewItem({ code: p.code, name: p.name, price: String(p.price) }); setNewConfig({ ...emptyPOSConfig(), ...posConfig(p.customConfig) }); setShowNewItem(true); }} className="flex min-h-10 w-full items-center justify-center gap-2 border-t px-3 text-sm font-semibold text-admin-brand-ink"><Pencil size={14} /> Edit item</button>}
                  </div>
                ))}
              </div>
            </section>
            <aside className="pos-bill-panel h-fit rounded-[26px] border border-admin-border bg-admin-surface p-5 text-admin-ink shadow-sm xl:sticky xl:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Current bill</h2>
                {(cart.length > 0 || selectedInvoice) && (
                  <button className="pos-quantity-button" aria-label="Clear current bill"
                    onClick={() => {
                      setCart([]);
                      setSelectedInvoice(null); setDiscountValue("");
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className="mt-4 border-b border-admin-border pb-4">
                <label className="text-[10px] font-bold uppercase text-admin-muted">
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
                          setSelectedInvoice(inv); setDiscountValue("");
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
                  <div className="rounded-xl border border-admin-brand-line bg-admin-brand-soft p-4">
                    <b className="text-admin-brand-ink">
                      {selectedInvoice.invoiceNumber}
                    </b>
                    <p className="text-xs text-admin-brand-ink">
                      {selectedInvoice.clientName}
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      Balance {rs(selectedInvoice.balance)}
                    </p>
                  </div>
                ) : cart.length ? (
                  cart.map((item) => (
                    <div
                      key={item.cartKey}
                      className="pos-cart-row"
                    >
                      <div className="min-w-0 flex-1">
                        <b className="block text-xs break-words">{item.name}</b>
                        <span className="text-[10px] text-admin-muted">
                          {item.code} · {rs(item.price)} / {item.unitLabel}
                        </span>
                      </div>
                      <button aria-label={`Decrease ${item.name}`} onClick={() => changeQuantity(item, -1)} className="pos-quantity-button"><Minus size={14} /></button>
                      <b className="min-w-6 text-center text-xs">{item.qty}</b>
                      <button aria-label={`Increase ${item.name}`} onClick={() => changeQuantity(item, 1)} className="pos-quantity-button"><Plus size={14} /></button>
                      <button className="pos-quantity-button" aria-label={`Remove ${item.name}`}
                        onClick={() =>
                          setCart((c) => c.filter((i) => i.cartKey !== item.cartKey))
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-admin-muted">
                    Add items by code or select an invoice.
                  </div>
                )}
              </div>
              <label className="mt-4 block text-[10px] font-bold uppercase text-admin-muted">
                Customer (optional)
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  disabled={!!selectedInvoice}
                  placeholder="Walk-in customer"
                  className={`${input} mt-1.5`}
                />
              </label>
              {!selectedInvoice && <div className="mt-4 space-y-3 rounded-xl border border-admin-brand-line bg-admin-brand-soft p-3">
                <div className="flex justify-between text-sm"><span>Subtotal</span><b>{rs(subtotal)}</b></div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Percent size={16} /> Bill discount</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold">Discount type<select aria-label="Discount type" className={`${input} mt-1`} value={discountType} onChange={e => { setDiscountType(e.target.value as "amount" | "percent"); setDiscountValue(""); }}><option value="amount">Amount (Rs.)</option><option value="percent">Percentage (%)</option></select></label>
                  <label className="text-xs font-semibold">{discountType === "percent" ? "Percentage" : "Amount (Rs.)"}<input aria-label="Discount value" type="number" min="0" step="0.01" max={discountType === "percent" ? 100 : subtotal} className={`${input} mt-1`} value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="0" /></label>
                </div>
                {invalidDiscount ? <p role="alert" className="text-sm text-admin-danger">Enter a valid discount within the bill amount (up to 100%).</p> : <div className="flex justify-between text-sm"><span>Discount</span><b>−{rs(discount)}</b></div>}
              </div>}
              <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">
                <span>Total</span>
                <span>{rs(total)}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold uppercase text-admin-muted">
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
                <label className="text-[10px] font-bold uppercase text-admin-muted">
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
              <div className="mt-3 flex justify-between rounded-xl border border-admin-success-line bg-admin-success-soft p-3 text-sm font-bold text-admin-success">
                <span>Balance / Change</span>
                <span>{rs(change)}</span>
              </div>
              <button
                onClick={complete}
                disabled={saving || invalidDiscount || !Number.isFinite(received) || !!day.session.closed_at || total <= 0 || received < total}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-brand font-bold text-white disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Printer size={17} />
                )}{" "}
                Collect payment &amp; print bill
              </button>
              <p className="mt-2 text-center text-[10px] text-admin-muted">
                The sale is recorded only after payment is confirmed here.
              </p>
            </aside>
          </div>
          <POSHistory date={day.date} revision={`${day.sales.length}:${day.session?.closed_at || ''}`} />
          <section className="rounded-[26px] border border-admin-border bg-admin-surface p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Today’s issued bills</h2>
                <p className="text-xs text-admin-muted">
                  Counter income is separate from online/website sales.
                </p>
              </div>
            </div>
            <POSDayEnd day={day} settings={receiptSettings} width={width} canClose={me?.role === 'owner' || (me?.permissions || []).includes('pos_day_close')} onClosed={load} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase text-admin-muted">
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
                      <td className="px-3 font-bold">{rs(Number(s.total))}</td>
                      <td className="px-3">
                        <button
                          onClick={() => printReceipt(s, width, receiptBrand)}
                          className="rounded-lg bg-admin-subtle p-2"
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {day.sales.length === 0 && (
                <div className="py-12 text-center text-sm text-admin-muted">
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
