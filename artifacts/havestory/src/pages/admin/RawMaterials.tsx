import { useState } from "react";
import { useListInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Edit2, Trash2, FlaskConical, RefreshCw, X, AlertTriangle, PlusCircle, MinusCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function rs(v: any) { return `Rs. ${Number(v || 0).toLocaleString("en-IN")}`; }

const EMPTY = { name: "", description: "", quantity: "0", unit: "units", lowStockThreshold: "10", cost: "", supplier: "" };
const CATEGORIES_LIST = ["Frame Moulding", "Glass", "Mount Board", "Backing Board", "Paper", "Ink", "Finishing", "Packaging", "Other"];

type AdjustItem = { id: number; name: string; quantity: number; unit: string };

export default function RawMaterials() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const [adjustItem, setAdjustItem] = useState<AdjustItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "deduct">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState("");

  const { data: items, refetch } = useListInventory();
  const queryClient = useQueryClient();
  const inv = { queryKey: ["/api/inventory"] };
  const { mutate: createItem, isPending: creating } = useCreateInventoryItem({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); setShowForm(false); setForm(EMPTY); } } });
  const { mutate: updateItem, isPending: updating } = useUpdateInventoryItem({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); setEditing(null); setShowForm(false); setForm(EMPTY); } } });
  const { mutate: adjustStock, isPending: adjusting } = useUpdateInventoryItem({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); closeAdjust(); } } });
  const { mutate: deleteItem } = useDeleteInventoryItem({ mutation: { onSuccess: () => queryClient.invalidateQueries(inv) } });

  const lowStock = (items ?? []).filter(i => i.quantity <= i.lowStockThreshold).length;
  const totalValue = (items ?? []).reduce((sum, i) => sum + (Number(i.cost || 0) * i.quantity), 0);
  const uniqueCategories = [...new Set((items ?? []).map(i => i.supplier || "Other"))];

  const filtered = (items ?? []).filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openEdit = (i: any) => {
    setEditing(i);
    setForm({ name: i.name, description: i.description || "", quantity: String(i.quantity), unit: i.unit, lowStockThreshold: String(i.lowStockThreshold), cost: i.cost || "", supplier: i.supplier || "" });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, quantity: Number(form.quantity), lowStockThreshold: Number(form.lowStockThreshold) };
    if (editing) updateItem({ id: editing.id, data });
    else createItem({ data });
  };

  const openAdjust = (item: any, mode: "add" | "deduct") => {
    setAdjustItem({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit });
    setAdjustMode(mode);
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustError("");
  };

  const closeAdjust = () => {
    setAdjustItem(null);
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustError("");
  };

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    const amt = Number(adjustAmount);
    if (!amt || amt <= 0) { setAdjustError("Enter a valid positive amount"); return; }
    const newQty = adjustMode === "add"
      ? adjustItem.quantity + amt
      : adjustItem.quantity - amt;
    if (newQty < 0) { setAdjustError(`Cannot deduct more than current stock (${adjustItem.quantity} ${adjustItem.unit})`); return; }
    adjustStock({ id: adjustItem.id, data: { quantity: newQty } as any });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical size={22} className="text-admin-warning" />
            <h1 className="text-xl sm:text-2xl font-bold text-admin-ink">Raw Materials</h1>
          </div>
          <p className="text-xs sm:text-sm text-admin-muted">Track paper, ink, lamination rolls, and other consumables</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refetch()} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-admin-border text-sm text-admin-muted hover:bg-admin-surface">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-admin-brand text-white text-sm font-semibold shadow-sm">
            <Plus size={14} /> <span className="hidden sm:inline">Add Material</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Materials", val: items?.length ?? 0 },
          { label: "Low Stock Alerts", val: lowStock, warn: lowStock > 0 },
          { label: "Categories", val: uniqueCategories.length },
          { label: "Total Stock Value", val: rs(totalValue) },
        ].map(c => (
          <div key={c.label} className={`bg-admin-surface border rounded-xl px-3 sm:px-5 py-3 sm:py-4 shadow-sm ${c.warn ? "border-admin-warning-line bg-admin-warning-soft/30" : "border-admin-border"}`}>
            <div className={`text-lg sm:text-2xl font-bold ${c.warn ? "text-admin-warning" : "text-admin-ink"} truncate`}>{c.val}</div>
            <div className="text-xs sm:text-sm text-admin-muted mt-0.5 flex items-center gap-1">
              {c.warn && <AlertTriangle size={12} className="text-admin-warning" />}
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-admin-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search size={16} className="text-admin-muted shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials..." className="flex-1 min-w-0 text-sm outline-none placeholder:text-admin-muted" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-xs sm:text-sm border border-admin-border rounded-lg px-2 sm:px-3 py-1.5 bg-admin-surface outline-none shrink-0">
            <option>All Categories</option>
            {CATEGORIES_LIST.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center text-admin-muted">
            <FlaskConical size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium text-admin-muted">No Materials Found</p>
            <p className="text-sm text-admin-muted mt-1">Add your first raw material to start tracking stock.</p>
            <button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="mt-5 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-admin-brand text-white text-sm font-semibold mx-auto">
              <Plus size={14} /> Add First Material
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-admin-surface text-admin-muted text-[10px] sm:text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">MATERIAL</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">QUANTITY</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">UNIT</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">LOW STOCK AT</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">COST/UNIT</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">SUPPLIER</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">STATUS</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {filtered.map(item => {
                const isLow = item.quantity <= item.lowStockThreshold;
                return (
                  <tr key={item.id} className="hover:bg-admin-surface/50">
                    <td className="px-3 sm:px-5 py-3">
                      <div className="font-semibold text-admin-ink text-xs sm:text-sm">{item.name}</div>
                      {item.description && <div className="text-[10px] sm:text-xs text-admin-muted">{item.description}</div>}
                    </td>
                    <td className="px-3 sm:px-5 py-3 font-bold text-admin-ink text-xs sm:text-sm">{item.quantity}</td>
                    <td className="px-3 sm:px-5 py-3 text-admin-muted text-xs sm:text-sm">{item.unit}</td>
                    <td className="px-3 sm:px-5 py-3 text-admin-muted text-xs sm:text-sm">{item.lowStockThreshold}</td>
                    <td className="px-3 sm:px-5 py-3 font-medium text-admin-ink text-xs sm:text-sm whitespace-nowrap">{item.cost ? rs(item.cost) : "—"}</td>
                    <td className="px-3 sm:px-5 py-3 text-admin-muted text-xs sm:text-sm">{item.supplier || "—"}</td>
                    <td className="px-3 sm:px-5 py-3">
                      <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${isLow ? "bg-admin-danger-soft text-admin-danger" : "bg-admin-success-soft text-admin-success"}`}>
                        {isLow ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openAdjust(item, "add")}
                          title="Add Stock"
                          className="inline-flex items-center justify-center p-1.5 text-admin-muted hover:text-admin-success hover:bg-admin-success-soft rounded-lg"
                        >
                          <PlusCircle size={15} />
                        </button>
                        <button
                          onClick={() => openAdjust(item, "deduct")}
                          title="Deduct Stock"
                          className="inline-flex items-center justify-center p-1.5 text-admin-muted hover:text-admin-warning hover:bg-admin-warning-soft rounded-lg"
                        >
                          <MinusCircle size={15} />
                        </button>
                        <button onClick={() => openEdit(item)} className="inline-flex items-center justify-center p-1.5 text-admin-muted hover:text-admin-brand-ink hover:bg-admin-brand-soft rounded-lg"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteConfirm({ id: item.id, name: item.name })} className="inline-flex items-center justify-center p-1.5 text-admin-muted hover:text-admin-danger hover:bg-admin-danger-soft rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add/Deduct Stock Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-admin-inverse/50 backdrop-blur-sm p-4" onClick={closeAdjust}>
          <div className="bg-admin-surface rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-admin-border">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${adjustMode === "add" ? "bg-admin-success-soft" : "bg-admin-warning-soft"}`}>
                  {adjustMode === "add"
                    ? <PlusCircle size={18} className="text-admin-success" />
                    : <MinusCircle size={18} className="text-admin-warning" />}
                </div>
                <div>
                  <h2 className="font-bold text-admin-ink">{adjustMode === "add" ? "Add Stock" : "Deduct Stock"}</h2>
                  <p className="text-xs text-admin-muted">{adjustItem.name} · current: {adjustItem.quantity} {adjustItem.unit}</p>
                </div>
              </div>
              <button onClick={closeAdjust} className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-admin-subtle text-admin-muted"><X size={16} /></button>
            </div>

            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div className="flex gap-2">
                {(["add", "deduct"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setAdjustMode(m); setAdjustError(""); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      adjustMode === m
                        ? m === "add"
                          ? "bg-admin-success-solid text-white border-admin-success-line"
                          : "bg-admin-warning-solid text-white border-admin-warning-line"
                        : "bg-admin-surface text-admin-muted border-admin-border hover:bg-admin-surface"
                    }`}
                  >
                    {m === "add" ? "Add Stock" : "Deduct Stock"}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-admin-muted block mb-1">Amount ({adjustItem.unit})</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustAmount}
                  onChange={e => { setAdjustAmount(e.target.value); setAdjustError(""); }}
                  className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning"
                  placeholder={`How many ${adjustItem.unit}?`}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-admin-muted block mb-1">Reason <span className="text-admin-muted">(optional)</span></label>
                <input
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning"
                  placeholder={adjustMode === "add" ? "e.g. New delivery from supplier" : "e.g. Used in production"}
                />
              </div>

              {adjustAmount && !adjustError && (
                <div className={`rounded-xl px-4 py-3 text-sm ${adjustMode === "add" ? "bg-admin-success-soft text-admin-success" : "bg-admin-warning-soft text-admin-warning"}`}>
                  New quantity will be: <strong>
                    {adjustMode === "add"
                      ? adjustItem.quantity + Number(adjustAmount)
                      : adjustItem.quantity - Number(adjustAmount)
                    } {adjustItem.unit}
                  </strong>
                </div>
              )}

              {adjustError && (
                <div className="bg-admin-danger-soft text-admin-danger text-sm rounded-xl px-4 py-3">{adjustError}</div>
              )}

              <button
                type="submit"
                disabled={adjusting}
                className={`w-full py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-60 ${
                  adjustMode === "add"
                    ? "bg-admin-brand"
                    : "bg-admin-brand"
                }`}
              >
                {adjusting ? "Saving..." : adjustMode === "add" ? "Add Stock" : "Deduct Stock"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-admin-inverse/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="bg-admin-surface rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-admin-border">
              <h2 className="font-bold text-admin-ink">{editing ? "Edit Material" : "Add Material"}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-admin-muted" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-admin-muted block mb-1">Material Name *</label>
                <input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="A4 Bond Paper 80gsm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-admin-muted block mb-1">Quantity</label>
                  <input type="number" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: e.target.value }))} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" />
                </div>
                <div>
                  <label className="text-xs text-admin-muted block mb-1">Unit</label>
                  <input value={form.unit} onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="reams, rolls, liters" />
                </div>
                <div>
                  <label className="text-xs text-admin-muted block mb-1">Low Stock Alert At</label>
                  <input type="number" value={form.lowStockThreshold} onChange={e => setForm((f: any) => ({ ...f, lowStockThreshold: e.target.value }))} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" />
                </div>
                <div>
                  <label className="text-xs text-admin-muted block mb-1">Cost per Unit (Rs.)</label>
                  <input type="number" value={form.cost} onChange={e => setForm((f: any) => ({ ...f, cost: e.target.value }))} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs text-admin-muted block mb-1">Supplier</label>
                <input value={form.supplier} onChange={e => setForm((f: any) => ({ ...f, supplier: e.target.value }))} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="Supplier name" />
              </div>
              <div>
                <label className="text-xs text-admin-muted block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none resize-none" placeholder="Optional description..." />
              </div>
              <button type="submit" disabled={creating || updating} className="w-full py-2.5 bg-admin-brand text-white text-sm font-bold rounded-xl disabled:opacity-60">
                {(creating || updating) ? "Saving..." : editing ? "Update Material" : "Add Material"}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Material"
        message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"?` : ""}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteConfirm) deleteItem({ id: deleteConfirm.id }); }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
