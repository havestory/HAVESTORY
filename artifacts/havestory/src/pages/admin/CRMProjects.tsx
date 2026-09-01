import { Fragment, useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Plus, FolderKanban, X, Check, Trash2, Edit2, ChevronDown, ChevronUp, Tag, Loader2 } from "lucide-react";
import { useListClients } from "@workspace/api-client-react";
import {
  ClientPicker,
  ensureClientFromPicker,
  type ClientPickerValue,
  type ClientLite,
} from "@/components/ClientPicker";
import {
  DateFilterSelect,
  dateMatchesFilter,
  type DateFilterValue,
} from "@/components/admin/DateFilter";

type Project = {
  id: number;
  projectId: string;
  title: string;
  clientName: string;
  clientId?: number | null;
  serviceTypeId?: number | null;
  status: string;
  description?: string | null;
  totalValue: number;
  amountPaid: number;
  startDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

type ServiceType = {
  id: number;
  name: string;
  sortOrder: number;
};

const STATUS_OPTIONS = ["planning", "in_progress", "review", "completed", "on_hold"];

const statusStyle: Record<string, string> = {
  planning: "bg-blue-100 text-blue-600",
  in_progress: "bg-purple-100 text-purple-600",
  review: "bg-yellow-100 text-yellow-600",
  completed: "bg-green-100 text-green-600",
  on_hold: "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = String(status || "planning");
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusStyle[normalizedStatus] || "bg-gray-100 text-gray-600"}`}>
      {normalizedStatus.replace("_", " ")}
    </span>
  );
}

function rs(v: number | null | undefined) { return `Rs. ${Number(v || 0).toLocaleString("en-IN")}`; }

const EMPTY_FORM = {
  title: "", clientName: "", clientId: null as number | null,
  clientPhone: "", clientEmail: "", clientBusinessName: "", clientAddress: "",
  serviceTypeId: "", status: "planning", description: "",
  totalValue: "", amountPaid: "", startDate: "", dueDate: "", notes: "",
};

export default function CRMProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Client picker state — when manually entering a new client, opt-in to also
  // save them to the Clients DB. Off by default — the project still records
  // the client name either way; this only controls whether a permanent
  // client record is created and the project linked to it.
  const [saveManualAsClient, setSaveManualAsClient] = useState(false);
  const queryClient = useQueryClient();
  // Used by openEdit to hydrate the picker with the linked client's contact
  // details. The ClientPicker also calls useListClients internally; React
  // Query dedupes the request by query key.
  const { data: crmClientsRaw } = useListClients();
  const crmClients: ClientLite[] = Array.isArray(crmClientsRaw)
    ? (crmClientsRaw as ClientLite[])
    : [];

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeEditing, setTypeEditing] = useState<ServiceType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", sortOrder: 0 });
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeDeletingId, setTypeDeletingId] = useState<number | null>(null);
  const [typeFormError, setTypeFormError] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/crm-projects", { credentials: "include", cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Could not load CRM projects.");
      const nextProjects = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.projects)
          ? payload.projects
          : null;
      if (!nextProjects) throw new Error("The CRM projects response was not valid.");
      setProjects(nextProjects as Project[]);
    } catch (error) {
      setProjects([]);
      setLoadError(error instanceof Error ? error.message : "Could not load CRM projects.");
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceTypes = async () => {
    try {
      const res = await fetch("/api/project-service-types", { credentials: "include", cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok) {
        const nextTypes = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.serviceTypes)
            ? payload.serviceTypes
            : [];
        setServiceTypes(nextTypes as ServiceType[]);
      }
    } catch {
      setServiceTypes([]);
    }
  };

  useEffect(() => { void fetchProjects(); void fetchServiceTypes(); }, []);

  // Deeplink: open the edit modal for ?edit=<id> (e.g. coming from /admin/clients).
  // Fires once after projects load and the matching project is in state.
  const consumedEditParam = useRef(false);
  useEffect(() => {
    if (consumedEditParam.current) return;
    if (projects.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) { consumedEditParam.current = true; return; }
    const target = projects.find(p => String(p.id) === editId);
    if (target) {
      openEdit(target);
      consumedEditParam.current = true;
      // Clean the URL so the modal doesn't reopen on refresh.
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [projects]);

  const typeMap: Record<number, string> = Object.fromEntries(serviceTypes.map(t => [t.id, t.name]));

  const cancelTypeEdit = () => {
    setTypeEditing(null);
    setTypeForm({ name: "", sortOrder: serviceTypes.length * 10 });
    setTypeFormError("");
  };

  const openTypeModal = () => {
    cancelTypeEdit();
    setShowTypeModal(true);
  };

  const startTypeEdit = (t: ServiceType) => {
    setTypeEditing(t);
    setTypeForm({ name: t.name, sortOrder: t.sortOrder });
    setTypeFormError("");
  };

  const saveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name.trim()) { setTypeFormError("Name is required."); return; }
    setTypeSaving(true);
    setTypeFormError("");
    try {
      const url = typeEditing ? `/api/project-service-types/${typeEditing.id}` : "/api/project-service-types";
      const method = typeEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: typeForm.name.trim(), sortOrder: Number(typeForm.sortOrder) || 0 }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchServiceTypes();
      setTypeEditing(null);
      setTypeForm({ name: "", sortOrder: 0 });
    } catch {
      setTypeFormError(typeEditing ? "Failed to update service type." : "Failed to create service type.");
    } finally {
      setTypeSaving(false);
    }
  };

  const deleteType = async (t: ServiceType) => {
    const usedCount = projects.filter(p => p.serviceTypeId === t.id).length;
    const msg = usedCount > 0
      ? `Delete "${t.name}"? ${usedCount} project${usedCount === 1 ? "" : "s"} use this type and will become uncategorized.`
      : `Delete "${t.name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    setTypeDeletingId(t.id);
    try {
      const res = await fetch(`/api/project-service-types/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await fetchServiceTypes();
      await fetchProjects();
      if (typeEditing?.id === t.id) cancelTypeEdit();
    } catch {
      alert("Failed to delete service type.");
    } finally {
      setTypeDeletingId(null);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaveManualAsClient(false);
    setSaveError("");
    setShowModal(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    const linkedClient = p.clientId ? crmClients.find(c => c.id === p.clientId) : undefined;
    setForm({
      title: p.title,
      clientName: linkedClient?.name || p.clientName,
      clientId: p.clientId ?? null,
      clientPhone: linkedClient?.phone || "",
      clientEmail: linkedClient?.email || "",
      clientBusinessName: linkedClient?.businessName || "",
      clientAddress: linkedClient?.address || "",
      serviceTypeId: p.serviceTypeId ? String(p.serviceTypeId) : "",
      status: p.status,
      description: p.description || "",
      totalValue: p.totalValue ? String(p.totalValue) : "",
      amountPaid: p.amountPaid ? String(p.amountPaid) : "",
      startDate: p.startDate || "",
      dueDate: p.dueDate || "",
      notes: p.notes || "",
    });
    setSaveManualAsClient(false);
    setSaveError("");
    setShowModal(true);
  };

  // Adapter — the form keeps client fields flat (legacy shape used elsewhere)
  // but the picker takes a structured value. Convert in both directions.
  const clientValue: ClientPickerValue = {
    clientId: form.clientId,
    name: form.clientName,
    phone: form.clientPhone,
    email: form.clientEmail,
    businessName: form.clientBusinessName,
    address: form.clientAddress,
  };
  const setClientValue = (v: ClientPickerValue) =>
    setForm(f => ({
      ...f,
      clientId: v.clientId,
      clientName: v.name,
      clientPhone: v.phone,
      clientEmail: v.email,
      clientBusinessName: v.businessName,
      clientAddress: v.address,
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) {
      setSaveError("Please select a client or enter a new client name.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      let clientIdToUse: number | null;
      try {
        clientIdToUse = await ensureClientFromPicker(clientValue, saveManualAsClient);
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to save client.");
      }
      if (clientIdToUse !== form.clientId && saveManualAsClient) {
        // A new client was just created — refresh the dropdown source.
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      }
      // Preserve legacy behavior: if the user didn't opt in to save the
      // manual entry, don't link the project to anything.
      if (clientIdToUse == null) clientIdToUse = form.clientId;

      const body = {
        title: form.title,
        clientName: form.clientName,
        clientId: clientIdToUse,
        serviceTypeId: form.serviceTypeId ? parseInt(form.serviceTypeId) : null,
        status: form.status,
        description: form.description || null,
        totalValue: form.totalValue ? parseInt(form.totalValue) : 0,
        amountPaid: form.amountPaid ? parseInt(form.amountPaid) : 0,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      };
      const url = editing ? `/api/crm-projects/${editing.id}` : "/api/crm-projects";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed");
      await fetchProjects();
      setShowModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save project. Please try again.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/crm-projects/${id}`, { method: "DELETE" });
    setDeleteId(null);
    setProjects(ps => ps.filter(p => p.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const filtered = projects.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!dateMatchesFilter(p.createdAt, dateFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return String(p.title || "").toLowerCase().includes(q) || String(p.clientName || "").toLowerCase().includes(q) || String(p.projectId || "").toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "in_progress").length,
    totalValue: projects.reduce((s, p) => s + (p.totalValue || 0), 0),
    amountPaid: projects.reduce((s, p) => s + (p.amountPaid || 0), 0),
  };

  const inp = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors placeholder:text-gray-400";

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban size={22} className="text-pink-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">CRM Projects</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">Track your printing projects from start to finish</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchProjects} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={openTypeModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-pink-200 bg-pink-50 text-pink-700 text-sm font-semibold hover:bg-pink-100 transition-colors"
            title="Add, edit or delete service types"
          >
            <Tag size={13} /> <span className="hidden sm:inline">Service Types</span><span className="sm:hidden">Types</span>
          </button>
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "Total Projects", val: stats.total },
          { label: "Active", val: stats.active },
          { label: "Total Value", val: rs(stats.totalValue) },
          { label: "Amount Paid", val: rs(stats.amountPaid) },
          { label: "Balance", val: rs(stats.totalValue - stats.amountPaid) },
        ].map((c, i, arr) => (
          <div key={c.label} className={`bg-white border border-gray-100 rounded-xl px-4 py-3.5 shadow-sm${i === arr.length - 1 ? " col-span-2 sm:col-span-1" : ""}`}>
            <div className="font-bold text-foreground whitespace-nowrap" style={{ fontSize: "clamp(0.9rem,4.5vw,1.5rem)" }}>{c.val}</div>
            <div className="text-xs sm:text-sm text-gray-400 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 sm:flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex gap-1 flex-wrap flex-1">
            <button onClick={() => setStatusFilter("all")} className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-lg border transition-all ${statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-gray-200 text-gray-600 hover:border-primary/40"}`}>All</button>
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-lg border capitalize transition-all ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-gray-200 text-gray-600 hover:border-primary/40"}`}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <DateFilterSelect value={dateFilter} onChange={setDateFilter} />
        </div>
      </div>

      {/* Project List */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : loadError ? (
          <div className="py-20 px-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">!</div>
            <p className="text-base font-semibold text-gray-700">CRM projects could not be loaded</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">{loadError}</p>
            <button type="button" onClick={() => void fetchProjects()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-300">
            <FolderKanban size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium text-gray-400">{search || statusFilter !== "all" ? "No projects match your filter" : "No projects yet"}</p>
            {!search && statusFilter === "all" && <p className="text-sm text-gray-300 mt-1">Click "New Project" to create your first project</p>}
          </div>
        ) : (
          <>
            {/* Mobile: compact card rows */}
            <div className="sm:hidden divide-y divide-gray-50">
              {filtered.map(p => {
                const balance = (p.totalValue || 0) - (p.amountPaid || 0);
                const isExpanded = expanded === p.id;
                return (
                  <div key={p.id}>
                    <div
                      className="px-4 py-3.5 cursor-pointer active:bg-gray-50"
                      onClick={() => setExpanded(isExpanded ? null : p.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm leading-tight">{p.title}</span>
                            {isExpanded ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-pink-500 font-mono">{p.projectId}</span>
                            <span className="text-xs text-gray-500">{p.clientName}</span>
                            {p.serviceTypeId && typeMap[p.serviceTypeId] && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100">{typeMap[p.serviceTypeId]}</span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
                        <span className="text-gray-500">Val: <span className="font-semibold text-gray-900">{rs(p.totalValue)}</span></span>
                        <span className="text-gray-500">Paid: <span className="font-semibold text-green-600">{rs(p.amountPaid)}</span></span>
                        {balance > 0 && <span className="text-gray-500">Bal: <span className="font-semibold text-red-500">{rs(balance)}</span></span>}
                        {p.dueDate && <span className="text-gray-400 ml-auto">Due: {p.dueDate}</span>}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-gray-50 px-4 py-3 space-y-2 border-t border-gray-100">
                        {p.description && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Description</span>
                            <p className="text-gray-700 text-xs">{p.description}</p>
                          </div>
                        )}
                        {p.notes && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Notes</span>
                            <p className="text-gray-600 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">{p.notes}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-3 pt-0.5">
                          {p.startDate && <span className="text-[10px] text-gray-500">Start: {p.startDate}</span>}
                          {p.dueDate && <span className="text-[10px] text-gray-500">Due: {p.dueDate}</span>}
                          <div className="text-[10px] text-gray-500">
                            Bal: <span className={`font-semibold ${balance > 0 ? "text-red-500" : "text-green-600"}`}>{rs(balance)}</span>
                          </div>
                          <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(p)} className="p-2 hover:bg-pink-50 text-gray-400 hover:text-pink-600 rounded-lg"><Edit2 size={14} /></button>
                            <button onClick={() => setDeleteId(p.id)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">PROJECT</th>
                  <th className="px-5 py-3 text-left">CLIENT</th>
                  <th className="px-5 py-3 text-left">STATUS</th>
                  <th className="px-5 py-3 text-left">VALUE</th>
                  <th className="px-5 py-3 text-left">PAID</th>
                  <th className="px-5 py-3 text-left">DUE DATE</th>
                  <th className="px-5 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => {
                  const balance = (p.totalValue || 0) - (p.amountPaid || 0);
                  const isExpanded = expanded === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(isExpanded ? null : p.id)}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900">{p.title}</span>
                            {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                            {p.serviceTypeId && typeMap[p.serviceTypeId] && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100">{typeMap[p.serviceTypeId]}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-pink-500 font-mono mt-0.5">{p.projectId}</div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">{p.clientName}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{rs(p.totalValue)}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-green-600">{rs(p.amountPaid)}</div>
                          {balance > 0 && <div className="text-[10px] text-red-400">Bal: {rs(balance)}</div>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{p.dueDate || "—"}</td>
                        <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-pink-50 text-gray-400 hover:text-pink-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => setDeleteId(p.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${p.id}-exp`} className="bg-gray-50/50">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              {p.description && (
                                <div className="col-span-3">
                                  <span className="text-xs text-gray-400 font-semibold block mb-1">DESCRIPTION</span>
                                  <p className="text-gray-700">{p.description}</p>
                                </div>
                              )}
                              {p.startDate && <div><span className="text-xs text-gray-400 font-semibold block mb-0.5">START DATE</span><span className="text-gray-700">{p.startDate}</span></div>}
                              {p.dueDate && <div><span className="text-xs text-gray-400 font-semibold block mb-0.5">DUE DATE</span><span className="text-gray-700">{p.dueDate}</span></div>}
                              <div><span className="text-xs text-gray-400 font-semibold block mb-0.5">BALANCE</span><span className={`font-semibold ${balance > 0 ? "text-red-500" : "text-green-600"}`}>{rs(balance)}</span></div>
                              {p.notes && (
                                <div className="col-span-3">
                                  <span className="text-xs text-gray-400 font-semibold block mb-1">NOTES</span>
                                  <p className="text-gray-600 bg-white rounded-xl px-3 py-2 border border-gray-100">{p.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ maxHeight: "calc(100vh - 48px)" }}>
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-lg text-gray-900">{editing ? "Edit Project" : "New Project"}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{editing ? `Editing ${editing.projectId}` : "Create a new CRM project"}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">PROJECT TITLE *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Enter project title" className={inp} />
                </div>
                <ClientPicker
                  label="CLIENT"
                  value={clientValue}
                  onChange={setClientValue}
                  saveToClients={saveManualAsClient}
                  onSaveToClientsChange={setSaveManualAsClient}
                />

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">STATUS</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-400 font-semibold">SERVICE TYPE</label>
                    <button type="button" onClick={openTypeModal} className="text-[11px] text-pink-600 hover:text-pink-700 font-semibold">+ Manage</button>
                  </div>
                  <select value={form.serviceTypeId} onChange={e => setForm(f => ({ ...f, serviceTypeId: e.target.value }))} className={inp}>
                    <option value="">— None —</option>
                    {serviceTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">DESCRIPTION</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Enter a brief project description" rows={2} className={`${inp} resize-none`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1.5">TOTAL VALUE (Rs.)</label>
                    <input type="number" min="0" value={form.totalValue} onChange={e => setForm(f => ({ ...f, totalValue: e.target.value }))} placeholder="0" className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1.5">AMOUNT PAID (Rs.)</label>
                    <input type="number" min="0" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} placeholder="0" className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1.5">START DATE</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1.5">DUE DATE</label>
                    <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inp} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1.5">NOTES</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes, requirements, client preferences..." rows={2} className={`${inp} resize-none`} />
                </div>

                {saveError && <div className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{saveError}</div>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving ? "Saving..." : <><Check size={14} /> {editing ? "Save Changes" : "Create Project"}</>}
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
                {/* Add / Edit form */}
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
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs sm:text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-60"
                    >
                      {typeSaving ? <Loader2 size={13} className="animate-spin" /> : typeEditing ? <Edit2 size={13} /> : <Plus size={13} />}
                      {typeSaving ? "Saving..." : typeEditing ? "Update" : "Add Service Type"}
                    </button>
                    {typeEditing && (
                      <button type="button" onClick={cancelTypeEdit} className="px-3 py-2 text-xs sm:text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
                    )}
                  </div>
                </form>

                {/* Service type list */}
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
                        const count = projects.filter(p => p.serviceTypeId === t.id).length;
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
                                <Edit2 size={14} />
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

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-500" /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Project?</h3>
              <p className="text-sm text-gray-500 mb-6">This project will be permanently deleted and cannot be recovered.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
