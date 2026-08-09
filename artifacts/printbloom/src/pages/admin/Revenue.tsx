import { useListInvoices, useListOrders, useGetSettings } from "@workspace/api-client-react";
import { format } from "date-fns";
import { TrendingUp, ArrowLeft, Receipt, CheckCircle, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { getInvoicePaidAmount, getInvoiceAdvance, isUnpaidInvoiceStatus } from "@/lib/invoiceTypes";

function rs(v: number | string | undefined) {
  const n = Number(v ?? 0);
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

function invoiceStatusBadge(status: string) {
  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    partial: "bg-amber-100 text-amber-700",
    pending: "bg-orange-100 text-orange-700",
    issued: "bg-blue-100 text-blue-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

const POLL = { query: { refetchInterval: 30000 } };

export default function AdminRevenue() {
  const { data: invoices } = useListInvoices({}, POLL);
  const { data: orders } = useListOrders({}, POLL);
  const { data: settings } = useGetSettings();

  const now = new Date();
  const overdueDays = Math.max(0, Number((settings as any)?.overdueDays ?? 30));

  function isInvoiceOverdue(inv: any): boolean {
    if (inv.status === "overdue") return true;
    if (inv.status === "paid" || inv.status === "cancelled") return false;
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    const daysPast = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return daysPast >= overdueDays;
  }

  function getRemainingBalance(inv: any): number {
    const total = Math.max(0, Number(inv.amount ?? 0));
    const advance = getInvoiceAdvance(inv);
    return Math.max(0, total - advance);
  }

  const allInvoices = invoices ?? [];
  // Treat both fully-paid invoices and partials with an advance as
  // realised revenue — partials contribute only the advance amount.
  const realisedInvoices = allInvoices.filter(
    inv => inv.status === "paid" || inv.status === "partial",
  );
  const totalRevenue = realisedInvoices.reduce(
    (s, inv) => s + getInvoicePaidAmount(inv),
    0,
  );
  const avgInvoice = realisedInvoices.length > 0 ? Math.round(totalRevenue / realisedInvoices.length) : 0;
  const partialOutstanding = realisedInvoices
    .filter(inv => inv.status === "partial")
    .reduce((s, inv) => s + Math.max(0, Number(inv.amount ?? 0) - getInvoicePaidAmount(inv)), 0);

  // Pending = remaining balance on pending/issued/partial invoices NOT yet overdue.
  // `issued` is included so an invoice marked as issued (sent to client but not
  // yet paid) still surfaces here as money awaiting payment.
  const pendingTotal = allInvoices
    .filter(inv => (isUnpaidInvoiceStatus(inv.status) || inv.status === "partial") && !isInvoiceOverdue(inv))
    .reduce((s, inv) => s + getRemainingBalance(inv), 0);

  // Overdue = remaining balance on any non-paid invoice that is overdue
  const overdueTotal = allInvoices
    .filter(inv => inv.status !== "paid" && inv.status !== "cancelled" && isInvoiceOverdue(inv))
    .reduce((s, inv) => s + getRemainingBalance(inv), 0);

  const orderMap = new Map<string, any>();
  (orders ?? []).forEach(o => { if (o.orderId) orderMap.set(o.orderId, o); });

  const sortedPaid = [...realisedInvoices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
            <TrendingUp size={20} className="text-pink-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All-Time Revenue</h1>
            <p className="text-xs sm:text-sm text-gray-400">Full breakdown of all paid invoices</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Total Received", value: rs(totalRevenue), sub: partialOutstanding > 0 ? `${rs(partialOutstanding)} balance still owed on ${realisedInvoices.filter(i => i.status === "partial").length} partial invoice(s)` : "All invoices fully settled", icon: TrendingUp, color: "text-pink-500", bg: "bg-pink-50" },
          { label: "Paid + Partial", value: realisedInvoices.length, sub: `Out of ${allInvoices.length} total`, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
          { label: "Avg Invoice Value", value: rs(avgInvoice), sub: "Per paid / partial invoice", icon: BarChart3, color: "text-purple-500", bg: "bg-purple-50" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
              <card.icon size={20} className={card.color} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[clamp(0.9rem,4.5vw,1.5rem)] sm:text-2xl font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{card.value}</div>
              <div className="text-xs sm:text-sm font-semibold text-gray-600 mt-0.5">{card.label}</div>
              <div className="text-[10px] sm:text-xs text-gray-400 line-clamp-2">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <Receipt size={16} className="text-pink-500" />
          <h2 className="font-bold text-gray-900 text-sm sm:text-base">Paid &amp; Partially Paid Invoices</h2>
          <span className="text-[10px] bg-pink-50 text-pink-600 font-bold px-2 py-0.5 rounded-full ml-1">Live</span>
          <span className="ml-auto text-xs text-gray-400">{realisedInvoices.length} invoice{realisedInvoices.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="overflow-x-auto">
        {sortedPaid.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
            <p>No paid or partial invoices yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">Invoice #</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">Client</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">Order ID</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">Order Items</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">Date</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-left">Status</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 text-right">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedPaid.map(inv => {
                const order = inv.orderId ? orderMap.get(inv.orderId) : null;
                const items = order?.items ?? [];
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50">
                    <td className="px-3 sm:px-6 py-3">
                      <div className="font-mono font-bold text-gray-900 text-xs">{inv.invoiceNumber}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-gray-700 font-medium text-xs sm:text-sm">{inv.clientName || "—"}</td>
                    <td className="px-3 sm:px-6 py-3">
                      <span className="text-pink-500 font-mono text-xs">{inv.orderId || "—"}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-gray-500 text-xs max-w-[140px] sm:max-w-[200px]">
                      {items.length > 0
                        ? items.map((it: any) => `${it.name || it.productName || "Item"} ×${it.quantity ?? 1}`).join(", ")
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {format(new Date(inv.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-semibold ${invoiceStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-right font-bold text-green-600 text-xs sm:text-sm whitespace-nowrap">
                      {rs(getInvoicePaidAmount(inv))}
                      {inv.status === "partial" && (
                        <div className="text-[10px] font-normal text-gray-400">
                          of {rs(inv.amount)} total
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={6} className="px-6 py-4 text-sm font-bold text-gray-700">Total Received (Paid in full + advances on partials)</td>
                <td className="px-6 py-4 text-right font-bold text-pink-600 text-base">{rs(totalRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        </div>
      </div>
    </div>
  );
}
