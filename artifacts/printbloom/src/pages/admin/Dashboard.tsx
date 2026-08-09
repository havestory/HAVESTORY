import { useGetSiteStats, useListOrders, useListProducts, useListServices, useListInvoices } from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  TrendingUp, Package, Clock, CheckCircle, Sparkles, XCircle, BarChart3,
  ShoppingCart, Star, Receipt, AlertCircle, X, ChevronRight, DollarSign
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { getInvoicePaidAmount, isUnpaidInvoiceStatus } from "@/lib/invoiceTypes";

const POLL = { query: { refetchInterval: 10000, refetchOnWindowFocus: true } };

const STATUS_COLORS: Record<string, string> = {
  pending: "#f97316", confirmed: "#3b82f6", processing: "#8b5cf6",
  completed: "#22c55e", cancelled: "#ef4444", submitted: "#f97316",
};

function rs(v: number | string | undefined) {
  const n = Number(v ?? 0);
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-orange-100 text-orange-700", confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-purple-100 text-purple-700", completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700", submitted: "bg-orange-100 text-orange-700",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

function paymentDateKey(inv: any): string {
  try {
    const meta = typeof inv?.metadata === "string" ? JSON.parse(inv.metadata) : (inv?.metadata || {});
    const paidOn = String(meta?.paymentReceivedDate || "");
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(paidOn)) return paidOn;
  } catch {}
  // Legacy invoices created before payment-date tracking keep their previous
  // created-date behaviour rather than being moved by a later edit.
  return inv?.createdAt ? format(new Date(inv.createdAt), "yyyy-MM-dd") : "";
}

function invoiceStatusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-orange-100 text-orange-700",
    issued: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

export default function AdminDashboard() {
  const { data: stats } = useGetSiteStats();
  const { data: orders } = useListOrders({}, POLL);
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: invoices } = useListInvoices({}, POLL);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  // Invoice map: orderId string → invoice (source of truth for amounts)
  const invoiceByOrderId = new Map<string, any>();
  (invoices ?? []).forEach(inv => { if (inv.orderId) invoiceByOrderId.set(inv.orderId, inv); });

  function orderAmount(o: any): number {
    const inv = invoiceByOrderId.get(o.orderId);
    if (inv) return Number(inv.amount ?? 0);
    return (o.items ?? []).reduce((s: number, it: any) => s + (Number(it.price ?? 0) * (it.quantity ?? 1)), 0);
  }

  // Invoice aggregates — MUST come before revenue calculations
  const allInvoices = invoices ?? [];
  // "Pending" here means money not yet received — both `pending` (created,
  // awaiting payment) and `issued` (sent to client, still awaiting payment)
  // count, so an issued invoice doesn't silently disappear from the
  // Pending Payments tile until it's marked paid/partial.
  const pendingInvoices = allInvoices.filter(inv => isUnpaidInvoiceStatus(inv.status));
  const paidInvoices = allInvoices.filter(inv => inv.status === "paid");
  const partialInvoices = allInvoices.filter(inv => inv.status === "partial");
  const overdueInvoices = allInvoices.filter(inv => inv.status === "overdue");
  const pendingTotal = pendingInvoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0);
  const paidTotal = paidInvoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0);
  const overdueTotal = overdueInvoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0);
  // How much has actually been received from partial invoices (advance portion only)
  const partialAdvanceTotal = partialInvoices.reduce((s, inv) => s + getInvoicePaidAmount(inv), 0);
  // How much is still outstanding from partial invoices (total - advance)
  const partialOutstanding = partialInvoices.reduce((s, inv) => s + Math.max(0, Number(inv.amount ?? 0) - getInvoicePaidAmount(inv)), 0);
  // Total money actually received = full paid + advances on partials
  const totalReceived = paidTotal + partialAdvanceTotal;
  // Revenue counts both fully-paid invoices and the advance portion of
  // partially-paid ones, so the dashboard reflects money actually received.
  const realisedRevenueInvoices = [...paidInvoices, ...partialInvoices];
  // Sort newest-first by createdAt so the Invoice Summary list (and the
  // side modal) read top-down from the most recent invoice — the API
  // already returns desc(createdAt) but we sort explicitly here so the
  // order is stable regardless of upstream changes.
  const sortedInvoicesNewestFirst = [...allInvoices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const recentInvoices = sortedInvoicesNewestFirst.slice(0, 5);

  // Revenue is driven by realised payments — full amount on "paid"
  // invoices plus the advance portion on "partial" ones.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayRevenue = realisedRevenueInvoices
    .filter(inv => paymentDateKey(inv) === todayKey)
    .reduce((sum, inv) => sum + getInvoicePaidAmount(inv), 0);

  const totalRevenue = realisedRevenueInvoices.reduce(
    (s, inv) => s + getInvoicePaidAmount(inv),
    0,
  );

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const key = format(d, "yyyy-MM-dd");
    const dayPaid = realisedRevenueInvoices.filter(inv => paymentDateKey(inv) === key);
    const rev = dayPaid.reduce((s, inv) => s + getInvoicePaidAmount(inv), 0);
    return { date: format(d, "MMM d"), rev };
  });

  const completedOrders = orders?.filter(o => o.status === "completed") ?? [];
  const pendingCount = orders?.filter(o => o.status === "pending" || o.status === "submitted").length ?? 0;
  const confirmedCount = orders?.filter(o => o.status === "confirmed").length ?? 0;
  const completedCount = orders?.filter(o => o.status === "completed").length ?? 0;
  const cancelledCount = orders?.filter(o => o.status === "cancelled").length ?? 0;

  const pieData = [
    { name: "Pending", value: pendingCount, color: "#f97316" },
    { name: "Confirmed", value: confirmedCount, color: "#3b82f6" },
    { name: "Completed", value: completedCount, color: "#22c55e" },
  ].filter(d => d.value > 0);

  const customProjectsCount = orders?.filter(o => o.orderType === "custom").length ?? 0;
  const avgOrderValue = realisedRevenueInvoices.length > 0 ? Math.round(totalRevenue / realisedRevenueInvoices.length) : 0;

  // Top products from orders linked to invoices that have realised revenue
  // (full "paid" or "partial" with an advance).
  const paidOrderIds = new Set(realisedRevenueInvoices.map(inv => inv.orderId).filter(Boolean));
  const revenueOrders = (orders ?? []).filter(o => paidOrderIds.has(o.orderId));
  const productRevenue: Record<string, number> = {};
  revenueOrders.forEach(o => {
    const invAmt = orderAmount(o);
    const itemsTotal = (o.items ?? []).reduce((s: number, it: any) => s + Number(it.price ?? 0) * (it.quantity ?? 1), 0);
    const scale = itemsTotal > 0 ? invAmt / itemsTotal : 1;
    (o.items ?? []).forEach((it: any) => {
      const name = it.name || it.productName || "Unknown";
      productRevenue[name] = (productRevenue[name] || 0) + (Number(it.price ?? 0) * (it.quantity ?? 1) * scale);
    });
  });
  const topProducts = Object.entries(productRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, rev]) => ({ name, rev }));

  const recentOrders = [...(orders ?? [])].reverse().slice(0, 7);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <div className="bg-green-500 text-white rounded-xl px-3 sm:px-5 py-2 sm:py-3 text-right shadow-lg shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Today's Earnings</div>
          <div className="text-sm sm:text-xl font-bold whitespace-nowrap">{rs(todayRevenue)}</div>
          <div className="text-[10px] opacity-70">Payments received today</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link href="/admin/revenue" className="block">
          <StatCard title="All-Time Revenue" value={rs(totalRevenue)} sub="Click to view full details" icon={TrendingUp} color="pink" clickable />
        </Link>
        <Link href="/admin/orders?filter=All" className="block">
          <StatCard title="Total Orders" value={orders?.length ?? 0} sub="Click to view all orders" icon={ShoppingCart} color="purple" clickable />
        </Link>
        <Link href="/admin/orders?filter=Pending" className="block">
          <StatCard title="Pending" value={pendingCount} sub="Click to view pending orders" icon={Clock} color="orange" clickable />
        </Link>
        <Link href="/admin/orders?filter=Completed" className="block">
          <StatCard title="Completed" value={completedCount} sub={`${cancelledCount} cancelled • Click to view`} icon={CheckCircle} color="green" clickable />
        </Link>
      </div>

      {/* Invoice Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-purple-500" />
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Invoice Summary</h2>
            <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full">Live</span>
          </div>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="flex items-center gap-1 text-xs text-pink-500 font-semibold hover:underline"
          >
            View All <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
          {[
            { label: "Pending Payments", value: rs(pendingTotal + partialOutstanding), count: pendingInvoices.length + partialInvoices.length, icon: AlertCircle, color: "orange", bg: "bg-orange-50", tc: "text-orange-600" },
            { label: "Total Received", value: rs(totalReceived), count: realisedRevenueInvoices.length, icon: CheckCircle, color: "green", bg: "bg-green-50", tc: "text-green-600" },
            { label: "Overdue", value: rs(overdueTotal), count: overdueInvoices.length, icon: XCircle, color: "red", bg: "bg-red-50", tc: "text-red-600" },
          ].map(card => (
            <div key={card.label} className={`rounded-xl p-4 ${card.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <card.icon size={16} className={card.tc} />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${card.tc}`}>{card.count} invoice{card.count !== 1 ? "s" : ""}</span>
              </div>
              <div className={`text-base sm:text-lg font-bold ${card.tc} truncate`}>{card.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>
        {recentInvoices.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                <th className="text-left pb-2">Invoice #</th>
                <th className="text-left pb-2">Client</th>
                <th className="text-left pb-2">Order ID</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-right pb-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/50">
                  <td className="py-2 font-mono text-gray-700 font-semibold">{inv.invoiceNumber}</td>
                  <td className="py-2 text-gray-600">{inv.clientName || "—"}</td>
                  <td className="py-2 text-pink-500 font-mono">{inv.orderId || "—"}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${invoiceStatusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-2 text-right font-bold text-gray-900">{rs(inv.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {allInvoices.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-4">No invoices yet</div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">Revenue (Last 30 Days)</h2>
            <span className="text-[10px] sm:text-xs text-gray-400 shrink-0">Payments by received date</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={last30Days} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString()}`, "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Line type="monotone" dataKey="rev" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Order Status</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-bold text-gray-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">No orders yet</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Top Products by Revenue</h2>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} width={120} />
                <Tooltip formatter={(v: number) => [`Rs. ${v.toLocaleString()}`, "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                <Bar dataKey="rev" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">No revenue data yet</div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5">
          <h2 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Business Overview</h2>
          <div className="space-y-3">
            {[
              { icon: Package, color: "text-blue-500", label: "Total Products in Store", val: products?.length ?? 0 },
              { icon: BarChart3, color: "text-purple-500", label: "Services & Pricing Items", val: services?.length ?? 0 },
              { icon: Sparkles, color: "text-pink-500", label: "Custom Project Requests", val: customProjectsCount },
              { icon: XCircle, color: "text-red-400", label: "Orders Cancelled", val: cancelledCount },
              { icon: TrendingUp, color: "text-green-500", label: "Avg Order Value", val: rs(avgOrderValue) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-gray-600"><row.icon size={16} className={row.color} />{row.label}</span>
                <span className="text-sm font-bold text-gray-900">{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-sm sm:text-base">Recent Orders</h2>
          <Link href="/admin/orders" className="text-xs text-pink-500 font-semibold hover:underline flex items-center gap-1">View All ↗</Link>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">ORDER</th>
              <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">CUSTOMER</th>
              <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">PRODUCT</th>
              <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">STATUS</th>
              <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentOrders.map(order => {
              const amount = orderAmount(order);
              const product = order.items[0]?.name || order.items[0]?.productName || (order.orderType === "custom" ? "Custom Project" : "—");
              return (
                <tr key={order.id} className="hover:bg-gray-50/50">
                  <td className="px-3 sm:px-6 py-2.5 sm:py-3">
                    <div className="font-bold text-gray-900 text-xs sm:text-sm">#{order.id}</div>
                    <div className="text-[10px] text-pink-500 font-mono">{order.orderId}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-2.5 sm:py-3"><div className="font-medium text-gray-800 text-xs sm:text-sm">{order.customerName}</div></td>
                  <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-gray-600 max-w-[120px] sm:max-w-[160px] truncate text-xs sm:text-sm">{product}</td>
                  <td className="px-3 sm:px-6 py-2.5 sm:py-3">
                    <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${statusBadge(order.status)}`}>{order.status}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-right font-bold text-gray-900 text-xs sm:text-sm whitespace-nowrap">{rs(amount)}</td>
                </tr>
              );
            })}
            {recentOrders.length === 0 && (
              <tr><td colSpan={5} className="px-3 sm:px-6 py-8 text-center text-gray-400">No orders yet</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* All Invoices Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvoiceModal(false)} />
          <div className="relative ml-auto w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Receipt size={18} className="text-purple-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base">All Invoices</h2>
                  <p className="text-[10px] sm:text-xs text-gray-400">{allInvoices.length} invoices</p>
                </div>
              </div>
              <button onClick={() => setShowInvoiceModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-100">
              <div className="rounded-xl bg-orange-50 p-2 sm:p-3 text-center">
                <div className="text-xs sm:text-sm font-bold text-orange-600 whitespace-nowrap overflow-hidden text-ellipsis">{rs(pendingTotal + partialOutstanding)}</div>
                <div className="text-[9px] sm:text-[10px] text-orange-500">{pendingInvoices.length + partialInvoices.length} Pending</div>
              </div>
              <div className="rounded-xl bg-green-50 p-2 sm:p-3 text-center">
                <div className="text-xs sm:text-sm font-bold text-green-600 whitespace-nowrap overflow-hidden text-ellipsis">{rs(totalReceived)}</div>
                <div className="text-[9px] sm:text-[10px] text-green-500">{realisedRevenueInvoices.length} Paid</div>
              </div>
              <div className="rounded-xl bg-red-50 p-2 sm:p-3 text-center">
                <div className="text-xs sm:text-sm font-bold text-red-600 whitespace-nowrap overflow-hidden text-ellipsis">{rs(overdueTotal)}</div>
                <div className="text-[9px] sm:text-[10px] text-red-500">{overdueInvoices.length} Overdue</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {allInvoices.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400">No invoices yet</div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[440px]">
                  <thead className="bg-gray-50 text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide sticky top-0">
                    <tr>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">Invoice #</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">Client</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">Order</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">Status</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedInvoicesNewestFirst.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50/50">
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-mono text-[10px] sm:text-xs font-semibold text-gray-700">{inv.invoiceNumber}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs text-gray-600">{inv.clientName || "—"}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs text-pink-500 font-mono">{inv.orderId || "—"}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-semibold ${invoiceStatusBadge(inv.status)}`}>{inv.status}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right font-bold text-gray-900 text-xs sm:text-sm whitespace-nowrap">{rs(inv.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 px-3 sm:px-6 py-3 flex justify-end">
              <Link href="/admin/invoices" className="text-xs text-pink-500 font-semibold hover:underline flex items-center gap-1">
                Manage Invoices ↗
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color, clickable }: {
  title: string; value: any; sub: string; icon: any; color: string; clickable?: boolean;
}) {
  const colorMap: Record<string, string> = {
    pink: "bg-pink-50 text-pink-500", purple: "bg-purple-50 text-purple-500",
    orange: "bg-orange-50 text-orange-500", green: "bg-green-50 text-green-500",
  };
  const borderMap: Record<string, string> = {
    pink: "border-pink-100", purple: "border-purple-100",
    orange: "border-orange-100", green: "border-green-100",
  };
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-3 sm:p-5 ${borderMap[color]} ${clickable ? "hover:shadow-md hover:border-pink-200 transition-all cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
        {clickable && <ChevronRight size={14} className="text-gray-300" />}
      </div>
      <div className="text-[clamp(0.9rem,4.5vw,1.5rem)] sm:text-2xl font-bold text-gray-900 mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{value}</div>
      <div className="text-xs text-gray-400 font-medium">{title}</div>
      <div className="text-[10px] text-gray-400 mt-1">{sub}</div>
    </div>
  );
}
