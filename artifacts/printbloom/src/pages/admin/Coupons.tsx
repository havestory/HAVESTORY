import { useState, useEffect } from "react";
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, X, AlertCircle, Copy, Check, Loader2, Percent, DollarSign, Edit2 } from "lucide-react";

interface Coupon {
  id: number;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: number;
  expiresAt: string | null;
  createdAt: string;
}

const API = "/api/coupons";

const EMPTY_FORM = {
  code: "",
  type: "percentage" as "percentage" | "fixed",
  value: "",
  minOrder: "",
  maxUses: "",
  expiresAt: "",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error("Failed");
      setCoupons(await r.json());
    } catch {
      setError("Could not load coupons. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minOrder: coupon.minOrder !== null && coupon.minOrder !== undefined ? String(coupon.minOrder) : "",
      maxUses: coupon.maxUses !== null && coupon.maxUses !== undefined ? String(coupon.maxUses) : "",
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 10) : "",
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.value) { setFormError("Code and value are required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        code: form.code,
        type: form.type,
        value: parseFloat(form.value),
        minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
      };
      const r = await fetch(editing ? `${API}/${editing.id}` : API, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 409) { setFormError("A coupon with this code already exists."); return; }
      if (!r.ok) throw new Error("Failed");
      const saved = await r.json();
      setCoupons(prev => editing ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved]);
      closeForm();
    } catch {
      setFormError(editing ? "Failed to update coupon. Please try again." : "Failed to create coupon. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    setTogglingId(coupon.id);
    try {
      const r = await fetch(`${API}/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: coupon.isActive ? 0 : 1 }),
      });
      if (!r.ok) throw new Error("Failed");
      const updated = await r.json();
      setCoupons(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch {}
    setTogglingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch {}
    setDeletingId(null);
  };

  const handleCopy = (coupon: Coupon) => {
    navigator.clipboard.writeText(coupon.code);
    setCopiedId(coupon.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isExpired = (coupon: Coupon) => !!coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const isMaxed = (coupon: Coupon) => coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Coupon Codes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage discount coupons for your customers</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-xl shadow-md shadow-pink-500/25 hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">{editing ? "Edit Coupon" : "New Coupon"}</h2>
            <button onClick={closeForm} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Coupon Code <span className="text-red-400">*</span></label>
                <input
                  value={form.code}
                  onChange={e => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="e.g. SAVE20"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Discount Type <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  {(["percentage", "fixed"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("type", t)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.type === t ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:border-pink-200"}`}
                    >
                      {t === "percentage" ? <><Percent size={14} /> Percentage</> : <><DollarSign size={14} /> Fixed Rs.</>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {form.type === "percentage" ? "Discount %" : "Discount Amount (Rs.)"} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={form.type === "percentage" ? "100" : undefined}
                  step="0.01"
                  value={form.value}
                  onChange={e => set("value", e.target.value)}
                  placeholder={form.type === "percentage" ? "e.g. 10" : "e.g. 500"}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Min. Order Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minOrder}
                  onChange={e => set("minOrder", e.target.value)}
                  placeholder="e.g. 2000 (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Max Uses</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={e => set("maxUses", e.target.value)}
                  placeholder="Unlimited (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={e => set("expiresAt", e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
                />
              </div>
            </div>
            {formError && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle size={12} /> {formError}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  : editing
                    ? <><Check size={14} /> Update Coupon</>
                    : <><Plus size={14} /> Create Coupon</>}
              </button>
              <button type="button" onClick={closeForm} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-5">
          <AlertCircle size={14} /> {error}
          <button onClick={load} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Coupons list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-pink-400" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Tag size={28} className="text-gray-300" />
          </div>
          <h3 className="font-bold text-gray-700 mb-1">No coupons yet</h3>
          <p className="text-sm text-gray-400">Use the <span className="font-semibold text-gray-600">Create Coupon</span> button at the top right to add your first discount code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(coupon => {
            const expired = isExpired(coupon);
            const maxed = isMaxed(coupon);
            const inactive = !coupon.isActive;
            const statusBad = expired || maxed || inactive;

            return (
              <div key={coupon.id} className={`bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-4 transition-all ${statusBad ? "border-gray-200 opacity-70" : "border-pink-100 shadow-sm"}`}>
                {/* Code + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-pink-600 text-base tracking-wider">{coupon.code}</span>
                    {expired && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-500 rounded-full border border-red-100">Expired</span>}
                    {maxed && !expired && <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-500 rounded-full border border-orange-100">Limit Reached</span>}
                    {inactive && !expired && !maxed && <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">Disabled</span>}
                    {!statusBad && <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100">Active</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">
                      {coupon.type === "percentage" ? `${coupon.value}% off` : `Rs. ${coupon.value.toLocaleString("en-IN")} off`}
                    </span>
                    {coupon.minOrder && <span>Min. Rs. {coupon.minOrder.toLocaleString("en-IN")}</span>}
                    <span>Used: {coupon.usedCount}{coupon.maxUses ? ` / ${coupon.maxUses}` : ""}</span>
                    {coupon.expiresAt && <span>Expires: {formatDate(coupon.expiresAt)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(coupon)}
                    className="p-2 hover:bg-pink-50 rounded-xl transition-colors"
                    title="Copy code"
                  >
                    {copiedId === coupon.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} className="text-gray-400" />}
                  </button>
                  <button
                    onClick={() => handleToggle(coupon)}
                    disabled={togglingId === coupon.id}
                    className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                    title={coupon.isActive ? "Disable coupon" : "Enable coupon"}
                  >
                    {togglingId === coupon.id
                      ? <Loader2 size={18} className="animate-spin text-gray-400" />
                      : coupon.isActive
                        ? <ToggleRight size={20} className="text-pink-500" />
                        : <ToggleLeft size={20} className="text-gray-300" />
                    }
                  </button>
                  <button
                    onClick={() => openEdit(coupon)}
                    className="p-2 hover:bg-blue-50 rounded-xl transition-colors"
                    title="Edit coupon"
                  >
                    <Edit2 size={15} className="text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(coupon.id)}
                    disabled={deletingId === coupon.id}
                    className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete coupon"
                  >
                    {deletingId === coupon.id
                      ? <Loader2 size={15} className="animate-spin text-red-400" />
                      : <Trash2 size={15} className="text-red-400" />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
