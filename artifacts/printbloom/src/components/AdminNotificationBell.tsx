import { useEffect, useRef, useState } from "react";
import { useListOrders, useListMessages, useListReviews, useListInvoices } from "@workspace/api-client-react";
import { Bell, ShoppingBag, Mail, Star, X, ExternalLink, CalendarCheck, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

const STORAGE_KEY = "pb_admin_notif_seen";
const POLL_MS = 60000;

interface NewItem {
  type: "order" | "message" | "review" | "attendance" | "deletion";
  id: number;
  label: string;
  sub: string;
  href: string;
  ts: string;
}

function getSeenIds(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveSeenIds(ids: Record<string, number[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function money(value: unknown): number {
  return parseFloat(String(value ?? "0").replace(/[^0-9.-]/g, "")) || 0;
}

function linkedInvoiceTotal(invoice: any): number {
  if (!invoice) return 0;
  const stored = money(invoice.amount);
  if (stored > 0) return stored;
  let meta: any = {};
  try { meta = JSON.parse(invoice.metadata || "{}"); } catch { meta = {}; }
  const explicit = money(meta.grandTotal ?? meta.totalAmount ?? meta.total);
  if (explicit > 0) return explicit;
  const subtotal = (Array.isArray(meta.items) ? meta.items : []).reduce((sum: number, item: any) => {
    const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
    return sum + qty * money(item.unitPrice ?? item.price);
  }, 0);
  let shipping = 0;
  if (meta.shipping === "custom") shipping = money(meta.shippingCustom);
  else if (meta.shipping === "standard") shipping = money(meta.standardRate ?? 350);
  else if (meta.shipping === "express") shipping = money(meta.expressRate ?? 530);
  else if (meta.shipping === "weight") {
    const kg = money(meta.weightKg);
    if (kg > 0) shipping = money(meta.firstKgRate ?? meta.ratePerKg) + Math.ceil(Math.max(0, kg - 1)) * money(meta.addKgRate ?? meta.ratePerKg);
  }
  return subtotal + shipping;
}

export default function AdminNotificationBell() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [toasts, setToasts] = useState<(NewItem & { toastId: number })[]>([]);
  const [attendanceRequests, setAttendanceRequests] = useState<any[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const toastCounter = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { data: orders } = useListOrders({}, { query: { refetchInterval: POLL_MS } });
  const { data: messages } = useListMessages({}, { query: { refetchInterval: POLL_MS } });
  const { data: reviews } = useListReviews({}, { query: { refetchInterval: POLL_MS } });
  const { data: invoices } = useListInvoices({ query: { refetchInterval: POLL_MS } });

  useEffect(() => {
    let active = true;
    const loadDeletionRequests = () => fetch("/api/admin/deletion-requests", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(rows => { if (active) setDeletionRequests((Array.isArray(rows) ? rows : []).filter((row: any) => row.status === "pending")); })
      .catch(() => { if (active) setDeletionRequests([]); });
    loadDeletionRequests();
    const deletionTimer = setInterval(loadDeletionRequests, POLL_MS);
    return () => { active = false; clearInterval(deletionTimer); };
  }, []);

  useEffect(() => {
    let active = true;
    const loadAttendance = () => fetch("/api/admin/attendance-pending", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(rows => { if (active) setAttendanceRequests(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (active) setAttendanceRequests([]); });
    loadAttendance();
    const timer = setInterval(loadAttendance, POLL_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!orders || !messages || !reviews || !invoices) return;

    const seen = getSeenIds();
    const seenOrders = new Set(seen.orders ?? []);
    const seenMessages = new Set(seen.messages ?? []);
    const seenReviews = new Set(seen.reviews ?? []);
    const seenAttendance = new Set(seen.attendance ?? []);
    const seenDeletion = new Set(seen.deletion ?? []);

    const items: NewItem[] = [];

    orders.forEach((o: any) => {
      if (!seenOrders.has(o.id)) {
        const itemAmount = (o.items ?? []).reduce((sum: number, item: any) => {
          const qty = Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1);
          return sum + money(item.price ?? item.unitPrice) * qty;
        }, 0);
        const linkedInvoice = (invoices as any[]).find((invoice: any) => invoice.orderId === o.orderId);
        const amt = itemAmount > 0 ? itemAmount : linkedInvoiceTotal(linkedInvoice);
        items.push({
          type: "order", id: o.id,
          label: `New Order: ${o.orderId}`,
          sub: `${o.customerName} — Rs. ${amt.toLocaleString("en-IN")}`,
          href: "/admin/orders",
          ts: o.createdAt,
        });
      }
    });

    messages.forEach((m: any) => {
      if (!seenMessages.has(m.id)) {
        items.push({
          type: "message", id: m.id,
          label: `New Message from ${m.name || "Customer"}`,
          sub: (m.message || "").slice(0, 60) + ((m.message || "").length > 60 ? "…" : ""),
          href: "/admin/messages",
          ts: m.createdAt,
        });
      }
    });

    reviews.forEach((r: any) => {
      if (!seenReviews.has(r.id)) {
        items.push({
          type: "review", id: r.id,
          label: `New Review — ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}`,
          sub: `${r.name || "Customer"}: ${(r.review || r.comment || "").slice(0, 50)}`,
          href: "/admin/reviews",
          ts: r.createdAt,
        });
      }
    });

    attendanceRequests.forEach((a: any) => {
      if (!seenAttendance.has(a.id)) items.push({
        type: "attendance", id: a.id,
        label: `Attendance Request: ${a.staff_name}`,
        sub: `${String(a.attendance_date).slice(0,10)} · Check-in ${new Date(a.check_in_at).toLocaleTimeString("en-LK",{hour:"2-digit",minute:"2-digit"})}`,
        href: "/admin/attendance", ts: a.check_in_at,
      });
    });
    deletionRequests.forEach((request: any) => {
      if (!seenDeletion.has(Number(request.id))) items.push({
        type: "deletion", id: Number(request.id),
        label: `Delete approval: ${request.target_label}`,
        sub: `${request.requested_by_name || request.requested_by_username || "Staff"} requested deletion · Owner decision required`,
        href: "/admin/team-access", ts: request.created_at,
      });
    });

        items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    if (initialized.current && items.length > newItems.length) {
      const brandNew = items.filter(it => !newItems.some(n => n.type === it.type && n.id === it.id));
      brandNew.forEach(it => {
        const toastId = ++toastCounter.current;
        setToasts(prev => [...prev, { ...it, toastId }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.toastId !== toastId)), 5000);
      });
    }

    setNewItems(items);
    if (!initialized.current) initialized.current = true;
  }, [orders, messages, reviews, invoices, attendanceRequests, deletionRequests]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllSeen = () => {
    const seen = getSeenIds();
    seen.orders = (orders ?? []).map((o: any) => o.id);
    seen.messages = (messages ?? []).map((m: any) => m.id);
    seen.reviews = (reviews ?? []).map((r: any) => r.id);
    seen.attendance = attendanceRequests.map((a: any) => a.id);
    seen.deletion = deletionRequests.map((a: any) => Number(a.id));
    saveSeenIds(seen);
    setNewItems([]);
    setOpen(false);
  };

  const markOneSeen = (item: NewItem) => {
    const seen = getSeenIds();
    const key = (item.type === "attendance" ? "attendance" : item.type === "deletion" ? "deletion" : `${item.type}s`) as "orders" | "messages" | "reviews" | "attendance" | "deletion";
    seen[key] = [...new Set([...(seen[key] ?? []), item.id])];
    saveSeenIds(seen);
    setNewItems(prev => prev.filter(i => !(i.type === item.type && i.id === item.id)));
    setLocation(item.href);
    setOpen(false);
  };

  const handleToastClick = (t: NewItem & { toastId: number }) => {
    const seen = getSeenIds();
    const key = (t.type === "attendance" ? "attendance" : t.type === "deletion" ? "deletion" : `${t.type}s`) as "orders" | "messages" | "reviews" | "attendance" | "deletion";
    seen[key] = [...new Set([...(seen[key] ?? []), t.id])];
    saveSeenIds(seen);
    setNewItems(prev => prev.filter(i => !(i.type === t.type && i.id === t.id)));
    setToasts(prev => prev.filter(x => x.toastId !== t.toastId));
    setLocation(t.href);
    setOpen(false);
  };

  const iconMap = { order: ShoppingBag, message: Mail, review: Star, attendance: CalendarCheck, deletion: ShieldAlert };
  const colorMap = {
    order: "bg-pink-100 text-pink-600",
    message: "bg-blue-100 text-blue-600",
    review: "bg-yellow-100 text-yellow-600",
    attendance: "bg-emerald-100 text-emerald-600",
    deletion: "bg-red-100 text-red-600",
  };

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = iconMap[t.type];
          return (
            <div key={t.toastId}
              onClick={() => handleToastClick(t)}
              className="pointer-events-auto bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 min-w-[280px] max-w-[320px] cursor-pointer hover:shadow-xl hover:border-pink-200 transition-all"
              style={{ animation: "slideInRight 0.3s ease" }}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorMap[t.type]}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate">{t.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{t.sub}</div>
                <div className="text-[9px] text-pink-400 mt-1 font-medium">Click to view →</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bell button + dropdown */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="relative w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200 transition-all"
        >
          <Bell size={17} />
          {newItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">
              {newItems.length > 9 ? "9+" : newItems.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-pink-500" />
                <span className="text-sm font-bold text-gray-900">Notifications</span>
                {newItems.length > 0 && (
                  <span className="bg-pink-100 text-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {newItems.length} new
                  </span>
                )}
              </div>
              {newItems.length > 0 && (
                <button onClick={markAllSeen} className="text-[10px] text-gray-400 hover:text-gray-600 font-medium">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {newItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  <Bell size={24} className="mx-auto mb-2 opacity-30" />
                  All caught up!
                </div>
              ) : (
                newItems.map(item => {
                  const Icon = iconMap[item.type];
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => markOneSeen(item)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorMap[item.type]}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-900 truncate">{item.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{item.sub}</div>
                        <div className="text-[9px] text-gray-300 mt-1">
                          {item.ts ? new Date(item.ts).toLocaleString() : ""}
                        </div>
                      </div>
                      <ExternalLink size={11} className="text-gray-300 mt-1 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
