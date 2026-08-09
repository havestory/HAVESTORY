import { useMemo, useState } from "react";
import { useListOrders, useUpdateOrder, useCreateOrder, useGetSettings, useListInvoices } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Plus, X, Trash2, AlertTriangle, MessageSquare, Check as CheckIcon, FileText, ExternalLink, FilePlus2, Receipt, Printer } from "lucide-react";
import { ManageOrderModal } from "./ManageOrderModal";
import { InvoiceFormModal } from "@/components/InvoiceFormModal";
import { ShippingLabelModal } from "@/components/admin/ShippingLabelModal";
import { Link, useSearch } from "wouter";
import {
  ClientPicker,
  ensureClientFromPicker,
  EMPTY_CLIENT_VALUE,
  type ClientPickerValue,
} from "@/components/ClientPicker";
import {
  DateFilterSelect,
  dateMatchesFilter,
  type DateFilterValue,
} from "@/components/admin/DateFilter";

function rs(v: any) { return `Rs. ${Number(v || 0).toLocaleString("en-IN")}`; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-orange-100 text-orange-600",
    submitted: "bg-orange-100 text-orange-600",
    confirmed: "bg-blue-100 text-blue-600",
    processing: "bg-purple-100 text-purple-600",
    completed: "bg-green-100 text-green-600",
    cancelled: "bg-red-100 text-red-600",
    reviewing: "bg-yellow-100 text-yellow-600",
    ready: "bg-teal-100 text-teal-600",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

const FILTER_TABS = ["All", "Pending", "Confirmed", "Processing", "Completed", "Cancelled"];
const EMPTY_NEW = { itemName: "", itemPrice: "", itemQty: "1", notes: "" };

export default function AdminOrders() {
  const urlSearch = useSearch();
  const urlFilter = new URLSearchParams(urlSearch).get("filter");
  const initialFilter = FILTER_TABS.includes(urlFilter ?? "") ? (urlFilter as string) : "All";
  const [filter, setFilter] = useState(initialFilter);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [shippingOrder, setShippingOrder] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [client, setClient] = useState<ClientPickerValue>(EMPTY_CLIENT_VALUE);
  const [saveToClients, setSaveToClients] = useState(false);
  const [allowDuplicateCustomer, setAllowDuplicateCustomer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  // Invoice option in the New Order modal:
  //   "none"   → create order with no invoice (admin will add one later)
  //   "link"   → link an existing unlinked invoice (search-style picker)
  //   "create" → open the Invoice form, then auto-link the newly created invoice
  const [newInvoiceMode, setNewInvoiceMode] = useState<"none" | "link" | "create">("none");
  const [newLinkInvoiceId, setNewLinkInvoiceId] = useState<string>("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedWaId, setCopiedWaId] = useState<string | null>(null);

  const { data: orders } = useListOrders({}, { query: { refetchInterval: showNew || selectedOrder ? false : 30000 } });
  const { data: invoices } = useListInvoices({}, { query: { refetchInterval: showNew || selectedOrder ? false : 30000 } });
  const { data: settings } = useGetSettings();

  // Index invoices by orderId so we can show the *true* order total (items
  // + shipping − discount) on the orders list. Without this the list only
  // showed items × qty and disagreed with the auto-generated invoice.
  const invoiceByOrderId = new Map<string, any>();
  (invoices ?? []).forEach((inv: any) => { if (inv.orderId) invoiceByOrderId.set(inv.orderId, inv); });
  const queryClient = useQueryClient();

  let courierServices: { name: string; trackingUrl: string }[] = [];
  try { courierServices = JSON.parse((settings as any)?.courierServices || "[]"); } catch {}

  const buildWhatsAppMessage = (order: any) => {
    const template = (settings as any)?.whatsappOrderTemplate ||
      "Hi {customerName}!\n\nThank you for choosing *PrintBloom*!\n\nOrder Number: *{orderNumber}*\nTrack your order: {trackingLink}";
    const website = (settings as any)?.website?.replace(/^https?:\/\//, "") || "";
    const trackingBase = website ? `https://${website}/track-order` : `${window.location.origin}/track-order`;
    const trackingLink = `${trackingBase}?id=${order.orderId}`;
    return template
      .replace(/{customerName}/g, order.customerName || "")
      .replace(/{orderNumber}/g, order.orderId || "")
      .replace(/{trackingLink}/g, trackingLink);
  };

  const copyWhatsApp = (order: any) => {
    navigator.clipboard.writeText(buildWhatsAppMessage(order)).then(() => {
      setCopiedWaId(order.orderId);
      setTimeout(() => setCopiedWaId(null), 2000);
    });
  };

  const { mutate: updateOrder, isPending } = useUpdateOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        setSaved(true);
        setTimeout(() => { setSaved(false); }, 1500);
      }
    }
  });

  const { mutate: createOrder } = useCreateOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        setShowNew(false);
        setNewForm(EMPTY_NEW);
        setClient(EMPTY_CLIENT_VALUE);
        setSaveToClients(false);
        setAllowDuplicateCustomer(false);
        setNewInvoiceMode("none");
        setNewLinkInvoiceId("");
        setInvoiceSearch("");
        setCreating(false);
      },
      onError: (err: any) => {
        const message =
          err?.response?.data?.error ||
          err?.data?.error ||
          err?.message ||
          "Failed to create order.";
        setCreateError(message);
        setCreating(false);
      }
    }
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response=await fetch(`/api/orders/${deleteTarget.orderId}`,{method:"DELETE",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"Could not process request");
      alert(body.pendingApproval ? body.message || "Deletion request sent to Owner." : "Record deleted.");
      await queryClient.invalidateQueries({queryKey:["/api/orders"]});
      setDeleteTarget(null);
    } catch(error) { alert(error instanceof Error?error.message:"Could not process request"); }
    finally { setDeleting(false); }
  };

  // The API already returns orders newest-first (orderBy desc(createdAt)),
  // so we keep that ordering and only apply the filter chain here. (The
  // previous .reverse() was inverting it to oldest-first.)
  const filtered = (orders ?? [])
    .filter(o => {
      if (filter !== "All" && o.status.toLowerCase() !== filter.toLowerCase() && !(filter === "Pending" && o.status === "submitted")) return false;
      if (!dateMatchesFilter(o.createdAt, dateFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return o.orderId?.toLowerCase().includes(q) || (o.customerName as string)?.toLowerCase().includes(q) || (o.customerPhone as string)?.includes(q);
      }
      return true;
    });

  const counts = {
    total: orders?.length ?? 0,
    pending: orders?.filter(o => o.status === "pending" || o.status === "submitted").length ?? 0,
    processing: orders?.filter(o => o.status === "processing").length ?? 0,
    completed: orders?.filter(o => o.status === "completed").length ?? 0,
  };

  const handleSave = (data: Record<string, any>) => {
    if (!selectedOrder) return;
    updateOrder({ id: selectedOrder.orderId, data: data as any });
  };

  const openCreateInvoiceForClient = async () => {
    if (!client.name.trim() || !client.phone.trim()) {
      setCreateError("Fill the new client's name and phone before creating the invoice.");
      return;
    }
    setCreateError("");
    try {
      const clientId = client.clientId ?? await ensureClientFromPicker(client, true, false);
      setClient(current => ({ ...current, clientId }));
      setSaveToClients(true);
      setShowInvoiceForm(true);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not link this client.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.name.trim()) { setCreateError("Please select a client or enter a new client name."); return; }
    if (!client.phone.trim()) { setCreateError("Customer phone is required."); return; }
    if (newInvoiceMode === "link" && !newLinkInvoiceId) {
      setCreateError("Please pick an invoice to link, or switch to 'No invoice yet'.");
      return;
    }
    if (newInvoiceMode === "create" && !newLinkInvoiceId) {
      setCreateError("Click 'Create invoice now' to build the invoice before saving the order.");
      return;
    }
    setCreating(true); setCreateError("");
    try {
      // A manual order always resolves to one saved client profile. This also
      // ensures orders created without an invoice can never leave a duplicate,
      // transient customer behind.
      const resolvedClientId = client.clientId ?? await ensureClientFromPicker(client, true, false);
      if (!client.clientId && resolvedClientId) setClient(current => ({ ...current, clientId: resolvedClientId }));
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to save client.");
      setCreating(false);
      return;
    }
    // Build the line item from whatever the admin typed. Items are now
    // optional — if no invoice is being linked the admin can record the
    // job line here for reference, or leave it blank and add details on
    // the order later.
    const itemName = newForm.itemName.trim();
    const itemPrice = Number(newForm.itemPrice) || 0;
    const itemQty = Number(newForm.itemQty) || 1;
    const items = (itemName || itemPrice > 0)
      ? [{ name: itemName || "Order Item", price: itemPrice, quantity: itemQty }]
      : [];
    createOrder({
      data: {
        customerName: client.name.trim(),
        customerPhone: client.phone.trim(),
        customerEmail: client.email.trim() || undefined,
        customerAddress: client.address.trim(),
        customerBusinessName: client.businessName.trim() || undefined,
        orderType: "standard",
        items,
        notes: newForm.notes || undefined,
        // New: admin always chooses the invoice path explicitly. No more
        // surprise empty invoices from this screen.
        autoInvoice: false,
        linkInvoiceId: (newInvoiceMode === "link" || newInvoiceMode === "create") && newLinkInvoiceId
          ? Number(newLinkInvoiceId)
          : undefined,
      } as any,
    });
  };

  const inp = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors placeholder:text-gray-400";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Orders</h1>
          <p className="text-xs sm:text-sm text-gray-400">{counts.total} orders total</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setShowNew(true); setNewForm(EMPTY_NEW); setClient(EMPTY_CLIENT_VALUE); setSaveToClients(false); setAllowDuplicateCustomer(false); setCreateError(""); setNewInvoiceMode("none"); setNewLinkInvoiceId(""); setInvoiceSearch(""); }} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs sm:text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity">
            <Plus size={14} /> <span className="hidden sm:inline">New Order</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Orders", val: counts.total, color: "from-pink-500 to-purple-600" },
          { label: "Pending", val: counts.pending, color: "from-orange-400 to-orange-500" },
          { label: "Processing", val: counts.processing, color: "from-purple-500 to-purple-600" },
          { label: "Completed", val: counts.completed, color: "from-green-500 to-green-600" },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-xl px-3 sm:px-5 py-3 sm:py-4 shadow-sm">
            <div className={`text-lg sm:text-2xl font-bold bg-gradient-to-r ${c.color} bg-clip-text text-transparent`}>{c.val}</div>
            <div className="text-[11px] sm:text-sm text-gray-400 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="flex-1 min-w-0 text-sm outline-none text-gray-700 placeholder:text-gray-400" />
          </div>
          <DateFilterSelect value={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="overflow-x-auto border-b border-gray-100 bg-gray-50/50">
          <div className="flex gap-1 px-4 py-2 min-w-max">
            {FILTER_TABS.map(tab => (
              <button key={tab} onClick={() => setFilter(tab)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${filter === tab ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        {/* Mobile card list — phones (< sm) get a stacked card per order so
            long order codes / product names don't get squeezed into a tiny
            7-column table. The table below renders unchanged on sm+. */}
        <div className="sm:hidden divide-y divide-gray-100">
          {filtered.map(order => {
            const linkedInv = invoiceByOrderId.get(order.orderId);
            const itemsTotal = order.items.reduce((s: number, it: any) => s + (Number(it.price ?? 0) * (it.quantity ?? 1)), 0);
            const total = linkedInv ? Number(linkedInv.amount ?? 0) : itemsTotal;
            const product = order.items[0]?.name || order.items[0]?.productName || (order.orderType === "custom" ? "Custom Project" : "—");
            return (
              <div key={order.id} className="px-3 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">#{order.id}</span>
                      {order.orderType === "custom" && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[9px] font-bold rounded uppercase">Custom</span>}
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-[10px] text-pink-500 font-mono mt-0.5 truncate">{order.orderId}</div>
                  </div>
                  <div className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 pt-0.5">{order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy") : "—"}</div>
                </div>

                <div className="text-xs">
                  <span className="text-gray-700 font-medium">{order.customerName}</span>
                  {order.customerPhone && <span className="text-gray-400"> · {order.customerPhone}</span>}
                </div>

                <div className="text-xs text-gray-700 break-words">
                  {product}
                  {order.items.length > 1 && <span className="text-gray-400"> · +{order.items.length - 1} more</span>}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="font-bold text-gray-900 text-sm whitespace-nowrap">{rs(total)}</div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setShippingOrder(order)} title="Print shipping label" className="p-1.5 rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors"><Printer size={13} /></button>
                    <button
                      onClick={() => copyWhatsApp(order)}
                      title="Copy WhatsApp message"
                      className={`p-1.5 rounded-lg border transition-colors ${copiedWaId === order.orderId ? "border-green-200 bg-green-50 text-green-600" : "border-gray-200 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200"}`}
                    >
                      {copiedWaId === order.orderId ? <CheckIcon size={13} /> : <MessageSquare size={13} />}
                    </button>
                    <button onClick={() => { setSaved(false); setSelectedOrder(order); }} className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                      Manage
                    </button>
                    <button onClick={() => setDeleteTarget(order)} className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors" title="Delete order">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="py-12 text-center text-gray-400 text-sm">{orders?.length === 0 ? "No orders yet" : "No orders match your filter"}</div>}
        </div>

        {/* Tablet/desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">ORDER</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">DATE</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">CUSTOMER</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">PRODUCT</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">TOTAL</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">STATUS</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(order => {
                // Prefer the auto-generated invoice's amount (items + shipping
                // − discount), so the order list matches the invoice. Fall
                // back to items × qty for orders without an invoice yet.
                const linkedInv = invoiceByOrderId.get(order.orderId);
                const itemsTotal = order.items.reduce((s: number, it: any) => s + (Number(it.price ?? 0) * (it.quantity ?? 1)), 0);
                const total = linkedInv ? Number(linkedInv.amount ?? 0) : itemsTotal;
                const product = order.items[0]?.name || order.items[0]?.productName || (order.orderType === "custom" ? "Custom Project" : "—");
                return (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 sm:px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-xs sm:text-sm">#{order.id}</span>
                        {order.orderType === "custom" && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[9px] font-bold rounded uppercase">Custom</span>}
                      </div>
                      <div className="text-[10px] text-pink-500 font-mono mt-0.5">{order.orderId}</div>
                    </td>
                    <td className="px-3 sm:px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy") : "—"}</td>
                    <td className="px-3 sm:px-5 py-3">
                      <div className="font-medium text-gray-800 text-xs sm:text-sm">{order.customerName}</div>
                      <div className="text-[10px] sm:text-xs text-gray-400">{order.customerPhone}</div>
                    </td>
                    <td className="px-3 sm:px-5 py-3">
                      <div className="text-gray-700 max-w-[120px] sm:max-w-[180px] truncate text-xs sm:text-sm">{product}</div>
                      {order.items.length > 1 && <div className="text-[10px] sm:text-xs text-gray-400">+{order.items.length - 1} more</div>}
                    </td>
                    <td className="px-3 sm:px-5 py-3 font-bold text-gray-900 text-xs sm:text-sm whitespace-nowrap">{rs(total)}</td>
                    <td className="px-3 sm:px-5 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-3 sm:px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setShippingOrder(order)} title="Print shipping label" className="p-1.5 rounded-lg border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors"><Printer size={13} /></button>
                        <button
                          onClick={() => copyWhatsApp(order)}
                          title="Copy WhatsApp message"
                          className={`p-1.5 rounded-lg border transition-colors ${copiedWaId === order.orderId ? "border-green-200 bg-green-50 text-green-600" : "border-gray-200 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200"}`}
                        >
                          {copiedWaId === order.orderId ? <CheckIcon size={13} /> : <MessageSquare size={13} />}
                        </button>
                        <button onClick={() => { setSaved(false); setSelectedOrder(order); }} className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                          Manage
                        </button>
                        <button onClick={() => setDeleteTarget(order)} className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors" title="Delete order">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-gray-400">{orders?.length === 0 ? "No orders yet" : "No orders match your filter"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Order Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ maxHeight: "calc(100vh - 48px)" }}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div><h2 className="font-bold text-lg text-gray-900">New Order</h2><p className="text-xs text-gray-400 mt-0.5">Create a manual order</p></div>
                <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                <ClientPicker
                  label="CUSTOMER"
                  value={client}
                  onChange={setClient}
                  saveToClients={saveToClients}
                  onSaveToClientsChange={setSaveToClients}
                  allowDuplicatePhone={allowDuplicateCustomer}
                  onAllowDuplicatePhoneChange={setAllowDuplicateCustomer}
                  showBusinessName
                  requirePhone
                />
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400 font-semibold mb-3">ORDER ITEM (optional)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><input value={newForm.itemName} onChange={e => setNewForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Item / service name" className={inp} /></div>
                    <div><input type="number" min="0" value={newForm.itemPrice} onChange={e => setNewForm(f => ({ ...f, itemPrice: e.target.value }))} placeholder="Price (Rs.)" className={inp} /></div>
                    <div><input type="number" min="1" value={newForm.itemQty} onChange={e => setNewForm(f => ({ ...f, itemQty: e.target.value }))} placeholder="Qty" className={inp} /></div>
                  </div>
                </div>
                <InvoicePickerSection
                  invoices={invoices ?? []}
                  mode={newInvoiceMode}
                  setMode={setNewInvoiceMode}
                  linkInvoiceId={newLinkInvoiceId}
                  setLinkInvoiceId={setNewLinkInvoiceId}
                  search={invoiceSearch}
                  setSearch={setInvoiceSearch}
                  onOpenCreate={() => { void openCreateInvoiceForClient(); }}
                />
                {showInvoiceForm && (
                  <InvoiceFormModal
                    onClose={() => setShowInvoiceForm(false)}
                    prefilledClient={{
                      id: client.clientId || undefined,
                      name: client.name,
                      phone: client.phone || undefined,
                      email: client.email || undefined,
                      address: client.address || undefined,
                      businessName: client.businessName || undefined,
                    }}
                    onSuccess={(created) => {
                      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                      if (created?.id) {
                        setNewInvoiceMode("create");
                        setNewLinkInvoiceId(String(created.id));
                      }
                    }}
                  />
                )}
                <div><label className="text-xs text-gray-400 font-semibold block mb-1.5">NOTES</label><textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." rows={2} className={`${inp} resize-none`} /></div>
                {createError && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{createError}</div>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowNew(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating} className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60">{creating ? "Creating..." : "Create Order"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {shippingOrder && <ShippingLabelModal order={{...shippingOrder, invoiceNumber: invoiceByOrderId.get(shippingOrder.orderId)?.invoiceNumber || ""}} onClose={() => setShippingOrder(null)} />}

      {/* Manage Order Modal */}
      {selectedOrder && (
        <ManageOrderModal
          order={(orders ?? []).find((o: any) => o.id === selectedOrder.id) ?? selectedOrder}
          courierServices={courierServices}
          onClose={() => { setSelectedOrder(null); setSaved(false); }}
          onSave={handleSave}
          isPending={isPending}
          saved={saved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center gap-3 p-6 border-b border-red-50 bg-red-50">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Delete Order</h2>
                <p className="text-xs text-red-500 font-medium mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                You are about to permanently delete order <span className="font-bold text-pink-600 font-mono">{deleteTarget.orderId}</span> for customer <span className="font-bold text-gray-900">{deleteTarget.customerName}</span>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 space-y-1">
                <div className="font-semibold">⚠️ Warning — the following will be permanently deleted:</div>
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li>Order record and all order details</li>
                  <li>Any linked invoice for this order</li>
                  <li>All uploaded files and attachments (from Cloudinary)</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete Order</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type InvoicePickerProps = {
  invoices: any[];
  mode: "none" | "link" | "create";
  setMode: (m: "none" | "link" | "create") => void;
  linkInvoiceId: string;
  setLinkInvoiceId: (id: string) => void;
  search: string;
  setSearch: (s: string) => void;
  onOpenCreate: () => void;
};

function InvoicePickerSection({
  invoices, mode, setMode, linkInvoiceId, setLinkInvoiceId,
  search, setSearch, onOpenCreate,
}: InvoicePickerProps) {
  const unlinked = useMemo(
    () => (invoices ?? [])
      .filter((inv: any) => !inv.orderId && !inv.deletedAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [invoices],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unlinked.slice(0, 50);
    return unlinked.filter((inv: any) => {
      const num = String(inv.invoiceNumber || "").toLowerCase();
      const name = String(inv.clientName || "").toLowerCase();
      const amt = String(inv.amount || "").toLowerCase();
      const phone = String(inv.clientPhone || "").toLowerCase();
      return num.includes(q) || name.includes(q) || amt.includes(q) || phone.includes(q);
    }).slice(0, 50);
  }, [unlinked, search]);

  const selected = useMemo(
    () => unlinked.find((inv: any) => String(inv.id) === linkInvoiceId) ?? null,
    [unlinked, linkInvoiceId],
  );

  const radioRow = (key: typeof mode, title: string, body: React.ReactNode, children?: React.ReactNode) => (
    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${mode === key ? "border-pink-300 bg-pink-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
      <input
        type="radio"
        name="newInvoiceMode"
        value={key}
        checked={mode === key}
        onChange={() => setMode(key)}
        className="mt-0.5 accent-pink-500"
      />
      <div className="text-sm leading-snug flex-1 min-w-0">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{body}</div>
        {mode === key && children}
      </div>
    </label>
  );

  const inp = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors placeholder:text-gray-400";

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="text-xs text-gray-400 font-semibold mb-2.5 flex items-center gap-1.5">
        <FileText size={12} /> INVOICE
      </div>
      <div className="space-y-2">
        {radioRow(
          "none",
          "No invoice yet",
          <>Create the order on its own. You can attach an invoice later from <Link href="/admin/invoices" className="text-pink-500 hover:underline">Invoices</Link>.</>,
        )}

        {radioRow(
          "link",
          "Link to an existing invoice",
          <>Search by invoice number, client name, phone, or amount. Picking one sets it as the order's invoice.</>,
          <div className="mt-2.5 space-y-2">
            {selected ? (
              <div className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-pink-200">
                <div className="text-xs leading-tight min-w-0">
                  <div className="font-bold text-pink-600 truncate">{selected.invoiceNumber}</div>
                  <div className="text-gray-700 truncate">{selected.clientName}</div>
                  <div className="text-gray-400">Rs. {Number(selected.amount || 0).toLocaleString("en-IN")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setLinkInvoiceId(""); setSearch(""); }}
                  className="text-[11px] font-semibold text-gray-500 hover:text-pink-600 shrink-0"
                >
                  Change
                </button>
              </div>
            ) : unlinked.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  No unlinked invoices yet. Create one in{" "}
                  <Link href="/admin/invoices" className="font-semibold underline">Admin → Invoices</Link>
                  , or use "Create a new invoice now" below.
                </span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search invoice # / client / phone / amount…"
                    className={inp + " pl-9"}
                  />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-100 bg-white">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">No matching invoices.</div>
                  ) : filtered.map((inv: any) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => setLinkInvoiceId(String(inv.id))}
                      className="w-full text-left px-3 py-2 hover:bg-pink-50 transition-colors flex items-center gap-3"
                    >
                      <Receipt size={15} className="text-pink-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-gray-500 truncate">{inv.clientName || "Unknown"}{inv.clientPhone ? ` · ${inv.clientPhone}` : ""}</div>
                      </div>
                      <div className="text-xs font-semibold text-gray-700 shrink-0">Rs. {Number(inv.amount || 0).toLocaleString("en-IN")}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-gray-400 flex items-center justify-between">
                  <span>{filtered.length} of {unlinked.length} unlinked</span>
                  <Link href="/admin/invoices" className="text-pink-500 hover:underline inline-flex items-center gap-1">
                    <ExternalLink size={11} /> Manage all
                  </Link>
                </div>
              </>
            )}
          </div>,
        )}

        {radioRow(
          "create",
          "Create a new invoice now",
          <>Build the invoice in the standard editor — it'll be auto-linked to this order on save.</>,
          <div className="mt-2.5">
            {selected ? (
              <div className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-pink-200">
                <div className="text-xs leading-tight min-w-0">
                  <div className="font-bold text-pink-600 truncate">{selected.invoiceNumber}</div>
                  <div className="text-gray-700 truncate">{selected.clientName}</div>
                  <div className="text-gray-400">Rs. {Number(selected.amount || 0).toLocaleString("en-IN")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setLinkInvoiceId(""); }}
                  className="text-[11px] font-semibold text-gray-500 hover:text-pink-600 shrink-0"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-50 border border-pink-200 text-pink-600 text-xs font-bold hover:bg-pink-100 transition-colors"
              >
                <FilePlus2 size={13} /> Create invoice now
              </button>
            )}
          </div>,
        )}
      </div>
    </div>
  );
}
