import { useState } from "react";
import { useListOrders, useUpdateOrder, useDeleteOrder, useGetSettings } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Search, ChevronRight, Plus, Trash2, AlertTriangle, MessageSquare, Check as CheckIcon, Tag, Pencil, Loader2, Upload, Calendar, Flag } from "lucide-react";
import { ManageOrderModal } from "./ManageOrderModal";
import {
  ClientPicker,
  ensureClientFromPicker,
  EMPTY_CLIENT_VALUE,
  type ClientPickerValue,
} from "@/components/ClientPicker";
import { getBusinessName } from "@/lib/brand-settings";
import {
  DateFilterSelect,
  dateMatchesFilter,
  type DateFilterValue,
} from "@/components/admin/DateFilter";

type ServiceType = { id: number; name: string; sortOrder: number };

function rs(v: any) { return `Rs. ${Number(v || 0).toLocaleString("en-IN")}`; }

const STATUS_TABS = ["All", "Pending", "Confirmed", "Processing", "Completed", "Cancelled"];

const statusBg: Record<string, string> = {
  pending: "bg-orange-100 text-orange-600",
  submitted: "bg-orange-100 text-orange-600",
  confirmed: "bg-blue-100 text-blue-600",
  processing: "bg-purple-100 text-purple-600",
  completed: "bg-green-100 text-green-600",
  cancelled: "bg-red-100 text-red-600",
  reviewing: "bg-yellow-100 text-yellow-600",
  ready: "bg-teal-100 text-teal-600",
};

export default function CustomProjectsAdmin() {
  const [tab, setTab] = useState("All");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("all");
  const [search, setSearch] = useState("");
  const [managing, setManaging] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    projectTitle: "",
    budget: "",
    notes: "",
    serviceTypeId: "",
    quantity: "1",
    startDate: "",
    dueDate: "",
    priority: "",
    discountValue: "",
    discountType: "fixed" as "fixed" | "percent",
    advancePaid: "",
  });
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [client, setClient] = useState<ClientPickerValue>(EMPTY_CLIENT_VALUE);
  const [saveToClients, setSaveToClients] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const resetNewForm = () => {
    setNewForm({
      projectTitle: "", budget: "", notes: "", serviceTypeId: "",
      quantity: "1", startDate: "", dueDate: "", priority: "",
      discountValue: "", discountType: "fixed", advancePaid: "",
    });
    setRefFiles([]);
    setTags([]);
    setTagInput("");
  };

  const addTag = (raw: string) => {
    const v = raw.trim().replace(/^#/, "").slice(0, 32);
    if (!v) return;
    setTags(prev => prev.includes(v) ? prev : [...prev, v].slice(0, 12));
    setTagInput("");
  };

  const handleFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
    setRefFiles(prev => [...prev, ...list].slice(0, 10));
  };
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedWaId, setCopiedWaId] = useState<string | null>(null);

  // Service types — cached via react-query so they load instantly on
  // re-mount (and after add/edit we splice the cache directly instead of
  // re-fetching, which is what was causing the "slight delay" the admin
  // saw when adding a new service type).
  const SERVICE_TYPES_KEY = ["/api/project-service-types"] as const;
  const queryClient = useQueryClient();
  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: SERVICE_TYPES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/project-service-types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load service types");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const sortServiceTypes = (a: ServiceType, b: ServiceType) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeEditing, setTypeEditing] = useState<ServiceType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", sortOrder: 0 });
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeDeletingId, setTypeDeletingId] = useState<number | null>(null);
  const [typeFormError, setTypeFormError] = useState("");

  const openTypeModal = () => { setShowTypeModal(true); setTypeEditing(null); setTypeForm({ name: "", sortOrder: 0 }); setTypeFormError(""); };
  const startTypeEdit = (t: ServiceType) => { setTypeEditing(t); setTypeForm({ name: t.name, sortOrder: t.sortOrder }); setTypeFormError(""); };
  const cancelTypeEdit = () => { setTypeEditing(null); setTypeForm({ name: "", sortOrder: 0 }); setTypeFormError(""); };

  const saveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name.trim()) { setTypeFormError("Name is required"); return; }
    setTypeSaving(true); setTypeFormError("");
    try {
      const url = typeEditing ? `/api/project-service-types/${typeEditing.id}` : "/api/project-service-types";
      const method = typeEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: typeForm.name.trim(), sortOrder: typeForm.sortOrder || 0 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTypeFormError(err.error || "Failed to save");
      } else {
        // Splice the new/updated row directly into the cache so the list
        // updates without waiting for a second GET round-trip.
        const saved = (await res.json()) as ServiceType;
        queryClient.setQueryData<ServiceType[]>(SERVICE_TYPES_KEY, prev => {
          const list = prev ?? [];
          const next = typeEditing
            ? list.map(t => (t.id === saved.id ? saved : t))
            : [...list, saved];
          return next.slice().sort(sortServiceTypes);
        });
        cancelTypeEdit();
      }
    } catch {
      setTypeFormError("Network error");
    } finally {
      setTypeSaving(false);
    }
  };

  const deleteType = async (t: ServiceType) => {
    const inUse = ((orders ?? []) as any[]).filter(o => o.orderType === "custom" && o.serviceTypeId === t.id).length;
    const msg = inUse > 0
      ? `Delete service type "${t.name}"? It is currently assigned to ${inUse} project${inUse === 1 ? "" : "s"} (they will be unset).`
      : `Delete service type "${t.name}"?`;
    if (!window.confirm(msg)) return;
    setTypeDeletingId(t.id);
    try {
      const res = await fetch(`/api/project-service-types/${t.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        queryClient.setQueryData<ServiceType[]>(SERVICE_TYPES_KEY, prev =>
          (prev ?? []).filter(x => x.id !== t.id)
        );
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        if (typeEditing?.id === t.id) cancelTypeEdit();
      }
    } finally {
      setTypeDeletingId(null);
    }
  };

  const { data: orders } = useListOrders({}, { query: { refetchInterval: showNew || managing ? false : 30000 } });
  const { data: settings } = useGetSettings();

  let courierServices: { name: string; trackingUrl: string }[] = [];
  try { courierServices = JSON.parse((settings as any)?.courierServices || "[]"); } catch {}

  const buildWhatsAppMessage = (order: any) => {
    const template = (settings as any)?.whatsappOrderTemplate ||
      `Hi {customerName}!\n\nThank you for choosing *${getBusinessName(settings as any)}*!\n\nOrder Number: *{orderNumber}*\nTrack your order: {trackingLink}`;
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

  // Note: we POST /api/orders directly (not via useCreateOrder) so we can chain
  // the reference-file upload to the new orderId before invalidating queries.
  const { mutate: updateOrder, isPending } = useUpdateOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        setSaved(true);
        setTimeout(() => { setSaved(false); }, 1500);
      }
    }
  });

  const { mutate: deleteOrder } = useDeleteOrder({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/orders"] }); setDeleteTarget(null); setDeleting(false); },
      onError: () => { setDeleting(false); }
    }
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    deleteOrder({ id: deleteTarget.orderId });
  };

  // The API already returns orders newest-first, so we just filter — the
  // previous .reverse() was inverting that to oldest-first.
  const customOrders = (orders ?? []).filter(o => o.orderType === "custom");

  const filtered = customOrders.filter(o => {
    const status = o.status.toLowerCase();
    const tabLower = tab.toLowerCase();
    if (tab !== "All" && status !== tabLower && !(tab === "Pending" && (status === "submitted" || status === "pending"))) return false;
    if (!dateMatchesFilter(o.createdAt, dateFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.customerName as string)?.toLowerCase().includes(q)
        || (o.customerPhone as string)?.includes(q)
        || o.orderId?.toLowerCase().includes(q)
        || o.items?.[0]?.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    total: customOrders.length,
    pending: customOrders.filter(o => o.status === "pending" || o.status === "submitted").length,
    inProgress: customOrders.filter(o => o.status === "processing" || o.status === "confirmed").length,
    completed: customOrders.filter(o => o.status === "completed").length,
  };

  const getProjectTitle = (o: any) => o.items?.[0]?.name || o.items?.[0]?.productName || "Custom Project";
  const getBudget = (o: any) => o.items?.[0]?.budget || null;

  const openManage = (o: any) => {
    setSaved(false);
    setManaging(o);
  };

  const handleSave = (data: Record<string, any>) => {
    if (!managing) return;
    updateOrder({ id: managing.orderId, data: data as any });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl">✦</span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Custom Projects</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">Manage custom printing project requests from clients</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openTypeModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pink-200 bg-pink-50 text-pink-700 text-sm font-semibold hover:bg-pink-100 transition-colors"
            title="Add, edit or delete service types"
          >
            <Tag size={13} /> <span className="hidden sm:inline">Service Types</span><span className="sm:hidden">Types</span>
          </button>
          <button
            onClick={() => { setShowNew(true); resetNewForm(); setClient(EMPTY_CLIENT_VALUE); setSaveToClients(false); setCreateError(""); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Custom Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Projects", val: counts.total, color: "from-pink-500 to-purple-600" },
          { label: "Pending Review", val: counts.pending, color: "from-orange-400 to-orange-500" },
          { label: "In Progress", val: counts.inProgress, color: "from-blue-500 to-purple-500" },
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
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="flex-1 min-w-0 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <DateFilterSelect value={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="overflow-x-auto border-b border-gray-100 bg-gray-50/50">
          <div className="flex gap-1 px-4 py-2 min-w-max">
            {STATUS_TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {filtered.map(order => {
            const title = getProjectTitle(order);
            const budget = getBudget(order);
            const initial = (order.customerName as string)?.charAt(0).toUpperCase() || "?";
            const desc = order.adminNotes || order.items?.[0]?.description || "";
            const total = order.items.reduce((s: number, it: any) => s + (Number(it.price ?? 0) * (it.quantity ?? 1)), 0);

            return (
              <div key={order.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm hover:border-pink-100 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold shrink-0 text-sm">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-gray-900 truncate">{title}</h3>
                          {order.serviceTypeId && serviceTypes.find(t => t.id === order.serviceTypeId) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100 whitespace-nowrap">
                              {serviceTypes.find(t => t.id === order.serviceTypeId)!.name}
                            </span>
                          )}
                          {(order as any).priority && (() => {
                            const p = (order as any).priority as string;
                            const cls = p === "urgent" ? "bg-red-50 text-red-600 border-red-100"
                              : p === "high" ? "bg-orange-50 text-orange-600 border-orange-100"
                              : p === "medium" ? "bg-blue-50 text-blue-600 border-blue-100"
                              : "bg-gray-50 text-gray-600 border-gray-200";
                            return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap capitalize ${cls}`}>{p}</span>;
                          })()}
                        </div>
                        <div className="text-xs text-gray-400">{order.customerName} · {order.customerPhone}</div>
                        {order.customerEmail && <div className="text-xs text-gray-400 truncate">{order.customerEmail}</div>}
                        {Array.isArray((order as any).tags) && (order as any).tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((order as any).tags as string[]).slice(0, 5).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-600 rounded-full border border-pink-100">#{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBg[order.status] || "bg-gray-100 text-gray-600"}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {order.createdAt ? format(new Date(order.createdAt), "MMM dd, yyyy") : "—"}
                      </span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => copyWhatsApp(order)}
                          title="Copy WhatsApp message"
                          className={`p-1.5 rounded-lg border transition-colors ${copiedWaId === order.orderId ? "border-green-200 bg-green-50 text-green-600" : "border-gray-200 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-200"}`}
                        >
                          {copiedWaId === order.orderId ? <CheckIcon size={13} /> : <MessageSquare size={13} />}
                        </button>
                        <button
                          onClick={() => openManage(order)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Manage <ChevronRight size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(order)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                          title="Delete project"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-xs bg-gray-50 rounded-xl p-3">
                  {budget && (
                    <div>
                      <div className="text-gray-400 mb-0.5">Budget</div>
                      <div className="font-semibold text-gray-700">{budget}</div>
                    </div>
                  )}
                  {total > 0 && (
                    <div>
                      <div className="text-gray-400 mb-0.5">Quote</div>
                      <div className="font-semibold text-gray-700">{rs(total)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-400 mb-0.5">Tracking</div>
                    <div className="font-mono text-pink-500 font-semibold text-[10px]">{order.orderId}</div>
                  </div>
                  {(order as any).dueDate && (() => {
                    const due = new Date((order as any).dueDate as string);
                    if (isNaN(due.getTime())) return null;
                    const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
                    const isCompleted = (order.status || "").toLowerCase() === "completed";
                    const overdue = days < 0 && !isCompleted;
                    const soon = days >= 0 && days <= 3 && !isCompleted;
                    return (
                      <div>
                        <div className="text-gray-400 mb-0.5">Deadline</div>
                        <div className={`font-semibold ${overdue ? "text-red-600" : soon ? "text-orange-600" : "text-gray-700"}`}>
                          {format(due, "MMM dd")}{isCompleted ? " ✓" : overdue ? ` (${-days}d late)` : days === 0 ? " (today)" : days <= 7 ? ` (${days}d)` : ""}
                        </div>
                      </div>
                    );
                  })()}
                  {Number((order as any).advancePaid || 0) > 0 && (
                    <div>
                      <div className="text-gray-400 mb-0.5">Advance</div>
                      <div className="font-semibold text-green-600">{rs((order as any).advancePaid)}</div>
                    </div>
                  )}
                  {Number((order as any).discountAmount || 0) > 0 && (
                    <div>
                      <div className="text-gray-400 mb-0.5">Discount</div>
                      <div className="font-semibold text-red-500">−{rs((order as any).discountAmount)}</div>
                    </div>
                  )}
                </div>

                {desc && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-gray-400 font-semibold block mb-0.5">Description / Notes</span>
                    {desc.slice(0, 200)}{desc.length > 200 ? "..." : ""}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-medium">
                {customOrders.length === 0 ? "No custom projects yet" : "No projects match your filter"}
              </p>
              {customOrders.length === 0 && (
                <p className="text-xs mt-1">Custom project requests submitted through the website will appear here</p>
              )}
            </div>
          )}
        </div>
      </div>

      {managing && (
        <ManageOrderModal
          order={managing}
          courierServices={courierServices}
          onClose={() => { setManaging(null); setSaved(false); }}
          onSave={handleSave}
          isPending={isPending}
          saved={saved}
        />
      )}

      {/* New Custom Project Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ maxHeight: "calc(100vh - 48px)" }}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-lg text-gray-900">New Custom Project</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Log a new custom project request</p>
                </div>
                <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  if (!client.name.trim()) { setCreateError("Please select a client or enter a new client name."); return; }
                  if (!client.phone.trim()) { setCreateError("Client phone is required."); return; }
                  if (!client.address.trim()) { setCreateError("Client address is required."); return; }
                  if (newForm.startDate && newForm.dueDate && newForm.dueDate < newForm.startDate) {
                    setCreateError("Deadline cannot be before the start date."); return;
                  }
                  setCreating(true);
                  setCreateError("");
                  try {
                    await ensureClientFromPicker(client, saveToClients);
                  } catch (err) {
                    setCreateError(err instanceof Error ? err.message : "Failed to save client.");
                    setCreating(false);
                    return;
                  }
                  const qty = Math.max(1, Math.floor(Number(newForm.quantity) || 1));
                  const unit = Math.max(0, Number(newForm.budget) || 0);
                  const subtotal = unit * qty;
                  const discountAmount = newForm.discountType === "percent"
                    ? Math.floor(subtotal * (Math.max(0, Math.min(100, Number(newForm.discountValue) || 0))) / 100)
                    : Math.max(0, Math.floor(Number(newForm.discountValue) || 0));
                  const advancePaid = Math.max(0, Math.floor(Number(newForm.advancePaid) || 0));
                  // Build the line item even when the project title was left
                  // blank — the unit budget the admin entered must always
                  // reach the auto-generated invoice. Fall back to a generic
                  // name so the invoice has a meaningful row instead of Rs. 0.
                  const projTitle = newForm.projectTitle.trim();
                  const items = (projTitle || unit > 0)
                    ? [{ name: projTitle || "Custom Project", price: unit, quantity: qty }]
                    : [];
                  // Capture the chosen tag input even if the user didn't press
                  // Enter. Apply the same normalization rules as addTag().
                  const pendingTag = tagInput.trim().replace(/^#/, "").slice(0, 32);
                  const finalTags = (pendingTag && !tags.includes(pendingTag)
                    ? [...tags, pendingTag]
                    : tags
                  ).slice(0, 12);
                  // Stash discount type in notes so percent-vs-fixed is recoverable.
                  const notesWithMeta = [
                    newForm.notes || "",
                    newForm.discountValue && newForm.discountType === "percent"
                      ? `\n[Discount: ${newForm.discountValue}% = Rs. ${discountAmount.toLocaleString("en-IN")}]`
                      : "",
                  ].join("").trim();
                  const payload = {
                    customerName: client.name.trim(),
                    customerPhone: client.phone.trim(),
                    customerEmail: client.email.trim() || undefined,
                    customerAddress: client.address.trim(),
                    orderType: "custom",
                    items,
                    designLinks: [],
                    attachments: [],
                    notes: notesWithMeta || undefined,
                    serviceTypeId: newForm.serviceTypeId ? Number(newForm.serviceTypeId) : undefined,
                    dueDate: newForm.dueDate || undefined,
                    startDate: newForm.startDate || undefined,
                    priority: newForm.priority || undefined,
                    discountAmount,
                    advancePaid,
                    tags: finalTags,
                  };
                  try {
                    const res = await fetch("/api/orders", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error("Create failed");
                    const created = await res.json();
                    let uploadFailed = false;
                    if (refFiles.length > 0 && created?.orderId) {
                      try {
                        const fd = new FormData();
                        refFiles.forEach(f => fd.append("files", f));
                        const upRes = await fetch(`/api/orders/track/${encodeURIComponent(created.orderId)}/design-files`, {
                          method: "POST", body: fd, credentials: "include",
                        });
                        if (!upRes.ok) uploadFailed = true;
                      } catch {
                        uploadFailed = true;
                      }
                    }
                    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                    if (uploadFailed) {
                      // Keep modal open so the admin sees the warning and can retry.
                      setCreateError(`Project ${created.orderId} created, but reference files could not be uploaded. You can add them later from the Manage screen, or click Cancel to dismiss.`);
                      return;
                    }
                    setShowNew(false);
                    resetNewForm();
                    setClient(EMPTY_CLIENT_VALUE);
                    setSaveToClients(false);
                  } catch (err) {
                    setCreateError("Failed to create project. Please try again.");
                  } finally {
                    setCreating(false);
                  }
                }}
                className="p-6 space-y-4 overflow-y-auto"
                style={{ maxHeight: "calc(100vh - 200px)" }}
              >
                <ClientPicker
                  label="CLIENT"
                  value={client}
                  onChange={setClient}
                  saveToClients={saveToClients}
                  onSaveToClientsChange={setSaveToClients}
                  showBusinessName={false}
                  requirePhone
                />
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400 font-semibold mb-3">PROJECT DETAILS</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1.5">Project Title / Description</label>
                      <input value={newForm.projectTitle} onChange={e => setNewForm(f => ({ ...f, projectTitle: e.target.value }))} placeholder="e.g. Wedding Invitation Cards, Custom Banner..." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Quantity</label>
                      <input type="number" min="1" inputMode="numeric" value={newForm.quantity} onChange={e => setNewForm(f => ({ ...f, quantity: e.target.value }))} placeholder="1" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Unit Budget (Rs.)</label>
                      <input type="number" min="0" inputMode="numeric" value={newForm.budget} onChange={e => setNewForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400" />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-gray-400">Service Type</label>
                        <button type="button" onClick={openTypeModal} className="text-[11px] text-pink-600 hover:text-pink-700 font-semibold">+ Manage</button>
                      </div>
                      <select
                        value={newForm.serviceTypeId}
                        onChange={e => setNewForm(f => ({ ...f, serviceTypeId: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400"
                      >
                        <option value="">— None —</option>
                        {serviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400 font-semibold mb-3 flex items-center gap-1.5"><Calendar size={12} /> SCHEDULE & PRIORITY</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Start Date</label>
                      <input type="date" value={newForm.startDate} onChange={e => setNewForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Deadline</label>
                      <input type="date" value={newForm.dueDate} onChange={e => setNewForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1"><Flag size={11} /> Priority</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { val: "low", lbl: "Low", cls: "bg-gray-50 text-gray-600 border-gray-200", on: "bg-gray-200 text-gray-800 border-gray-400" },
                          { val: "medium", lbl: "Medium", cls: "bg-blue-50 text-blue-600 border-blue-100", on: "bg-blue-500 text-white border-blue-500" },
                          { val: "high", lbl: "High", cls: "bg-orange-50 text-orange-600 border-orange-100", on: "bg-orange-500 text-white border-orange-500" },
                          { val: "urgent", lbl: "Urgent", cls: "bg-red-50 text-red-600 border-red-100", on: "bg-red-500 text-white border-red-500" },
                        ].map(p => {
                          const active = newForm.priority === p.val;
                          return (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => setNewForm(f => ({ ...f, priority: active ? "" : p.val }))}
                              className={`px-2 py-2 text-xs font-bold rounded-lg border transition-colors ${active ? p.on : p.cls + " hover:opacity-80"}`}
                            >
                              {p.lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400 font-semibold mb-3">PAYMENT</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Discount</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={newForm.discountValue}
                          onChange={e => setNewForm(f => ({ ...f, discountValue: e.target.value }))}
                          placeholder="0"
                          className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400"
                        />
                        <select
                          value={newForm.discountType}
                          onChange={e => setNewForm(f => ({ ...f, discountType: e.target.value as "fixed" | "percent" }))}
                          className="px-2 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 bg-white shrink-0"
                        >
                          <option value="fixed">Rs.</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Initial Advance (Rs.)</label>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={newForm.advancePaid}
                        onChange={e => setNewForm(f => ({ ...f, advancePaid: e.target.value }))}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                  {(() => {
                    const qty = Math.max(1, Math.floor(Number(newForm.quantity) || 1));
                    const unit = Math.max(0, Number(newForm.budget) || 0);
                    const subtotal = unit * qty;
                    const disc = newForm.discountType === "percent"
                      ? Math.floor(subtotal * (Math.max(0, Math.min(100, Number(newForm.discountValue) || 0))) / 100)
                      : Math.max(0, Math.floor(Number(newForm.discountValue) || 0));
                    const adv = Math.max(0, Math.floor(Number(newForm.advancePaid) || 0));
                    const total = Math.max(0, subtotal - disc);
                    const balance = Math.max(0, total - adv);
                    if (subtotal === 0 && disc === 0 && adv === 0) return null;
                    return (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-50 rounded-xl p-2.5">
                        <div><div className="text-gray-400">Subtotal</div><div className="font-semibold text-gray-700">{rs(subtotal)}</div></div>
                        <div><div className="text-gray-400">Discount</div><div className="font-semibold text-red-500">−{rs(disc)}</div></div>
                        <div><div className="text-gray-400">Advance</div><div className="font-semibold text-green-600">{rs(adv)}</div></div>
                        <div><div className="text-gray-400">Balance</div><div className="font-bold text-gray-900">{rs(balance)}</div></div>
                      </div>
                    );
                  })()}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5"><Upload size={12} /> REFERENCE FILES / IMAGES</div>
                  <label className="flex items-center justify-center gap-2 w-full px-3 py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-500 cursor-pointer hover:border-pink-300 hover:bg-pink-50/50 transition-colors">
                    <Upload size={14} className="text-gray-400" />
                    <span>Choose files (max 10 · 10MB each)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => { handleFilesPicked(e.target.files); e.target.value = ""; }}
                    />
                  </label>
                  {refFiles.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {refFiles.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg text-xs">
                          <span className="truncate flex-1 text-gray-700">{f.name}</span>
                          <span className="text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                          <button type="button" onClick={() => setRefFiles(prev => prev.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5"><Tag size={12} /> TAGS / LABELS</div>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagInput);
                      } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                        setTags(prev => prev.slice(0, -1));
                      }
                    }}
                    onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                    placeholder="Type a tag and press Enter (e.g. rush, vip, repeat)"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400"
                  />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 text-pink-600 rounded-full text-[11px] font-semibold border border-pink-100">
                          #{t}
                          <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-pink-800">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">NOTES</label>
                  <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Requirements, special instructions, additional info..." rows={2} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 placeholder:text-gray-400 resize-none" />
                </div>
                {createError && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{createError}</div>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowNew(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating} className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60">
                    {creating ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manage Service Types Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-start sm:items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4 sm:my-0" style={{ maxHeight: "calc(100vh - 32px)" }}>
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900 flex items-center gap-2"><Tag size={18} className="text-pink-500" /> Service Types</h2>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Add, edit or delete project service types</p>
                </div>
                <button onClick={() => { setShowTypeModal(false); cancelTypeEdit(); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
                <form onSubmit={saveType} className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{typeEditing ? `Editing: ${typeEditing.name}` : "New Service Type"}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-medium text-gray-500 block mb-1">Name *</label>
                      <input
                        value={typeForm.name}
                        onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Wedding Card Design"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block mb-1">Sort Order</label>
                      <input
                        type="number"
                        value={typeForm.sortOrder}
                        onChange={e => setTypeForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    </div>
                  </div>
                  {typeFormError && <p className="text-xs text-red-500 mt-2">{typeFormError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={typeSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-60"
                    >
                      {typeSaving ? <Loader2 size={13} className="animate-spin" /> : typeEditing ? <Pencil size={13} /> : <Plus size={13} />}
                      {typeSaving ? "Saving..." : typeEditing ? "Update" : "Add Service Type"}
                    </button>
                    {typeEditing && (
                      <button type="button" onClick={cancelTypeEdit} className="px-3 py-2 text-xs sm:text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
                    )}
                  </div>
                </form>

                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {serviceTypes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Tag size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No service types yet</p>
                      <p className="text-xs mt-1 text-gray-300">Add one above to start categorizing projects</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {serviceTypes.map(t => {
                        const count = ((orders ?? []) as any[]).filter(o => o.orderType === "custom" && o.serviceTypeId === t.id).length;
                        const isEditing = typeEditing?.id === t.id;
                        return (
                          <li key={t.id} className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 ${isEditing ? "bg-pink-50" : "hover:bg-gray-50"}`}>
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm truncate">{t.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100 shrink-0">{count} project{count === 1 ? "" : "s"}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => startTypeEdit(t)}
                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => deleteType(t)}
                                disabled={typeDeletingId === t.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                {typeDeletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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
                <h2 className="font-bold text-gray-900">Delete Custom Project</h2>
                <p className="text-xs text-red-500 font-medium mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                You are about to permanently delete project <span className="font-bold text-pink-600 font-mono">{deleteTarget.orderId}</span> for client <span className="font-bold text-gray-900">{deleteTarget.customerName}</span>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 space-y-1">
                <div className="font-semibold">⚠️ Warning — the following will be permanently deleted:</div>
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li>Project record and all project details</li>
                  <li>Any linked invoice for this project</li>
                  <li>All uploaded design files and attachments</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete Project</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
