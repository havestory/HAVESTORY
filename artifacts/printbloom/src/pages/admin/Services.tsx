import { useState, useEffect } from "react";
import { useListServices, useCreateService, useUpdateService, useDeleteService } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { broadcastAdminSave } from "@/lib/home-cache";
import { Plus, Edit2, Trash2, Wrench, X, Star, Tag, Check, GripVertical } from "lucide-react";
import { DescriptionEditor } from "@/components/admin/DescriptionEditor";
import { parseDescriptionLines } from "@/lib/description-utils";

function rs(v: any) { return v ? `Rs. ${Number(v).toLocaleString("en-IN")}` : "Custom Quote"; }

const EMPTY_FORM = { name: "", description: "", price: "", priceType: "per_item", packageDetails: "", highlights: "", imageUrl: "", featured: false, active: true, sortOrder: 0, categoryId: "" };

const PRICE_TYPES = [
  { value: "per_item", label: "per item" },
  { value: "per_unit", label: "per unit" },
  { value: "per_design", label: "per design" },
  { value: "per_page", label: "per page" },
  { value: "per_sqft", label: "per sq.ft" },
  { value: "per_set", label: "per set" },
  { value: "per_logo", label: "per logo" },
  { value: "per_1000", label: "per 1000" },
  { value: "custom_quote", label: "custom quote" },
];

function useCats() {
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    fetch("/api/service-categories").then(r => r.json()).then(d => { setCats(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return { cats, loading, reload: load };
}

export default function AdminServices() {
  const [tab, setTab] = useState<"services" | "categories">("services");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const [catForm, setCatForm] = useState({ name: "", sortOrder: 0 });
  const [editingCat, setEditingCat] = useState<any>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<number | null>(null);

  const { data: services } = useListServices();
  const { cats, reload: reloadCats } = useCats();
  const queryClient = useQueryClient();
  const inv = { queryKey: ["/api/services"] };

  const { mutate: createService, isPending: creating } = useCreateService({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); broadcastAdminSave(); setShowForm(false); setForm(EMPTY_FORM); } } });
  const { mutate: updateService, isPending: updating } = useUpdateService({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); broadcastAdminSave(); setEditing(null); setShowForm(false); setForm(EMPTY_FORM); } } });
  const { mutate: deleteService } = useDeleteService({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); broadcastAdminSave(); } } });

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name, description: s.description, price: s.price || "", priceType: s.priceType,
      packageDetails: s.packageDetails || "",
      highlights: Array.isArray(s.highlights) ? s.highlights.join(", ") : s.highlights,
      imageUrl: s.imageUrl || "", featured: s.featured, active: s.active, sortOrder: s.sortOrder,
      categoryId: s.categoryId ? String(s.categoryId) : "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      highlights: form.highlights ? form.highlights.split(",").map((h: string) => h.trim()) : [],
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    };
    if (editing) updateService({ id: editing.id, data });
    else createService({ data });
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return;
    setSavingCat(true);
    try {
      if (editingCat) {
        await fetch(`/api/service-categories/${editingCat.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catForm) });
      } else {
        await fetch("/api/service-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catForm) });
      }
      reloadCats();
      setShowCatForm(false);
      setCatForm({ name: "", sortOrder: 0 });
      setEditingCat(null);
    } finally {
      setSavingCat(false);
    }
  };

  const deleteCat = async (id: number) => {
    setDeletingCatId(id);
    await fetch(`/api/service-categories/${id}`, { method: "DELETE" });
    reloadCats();
    setDeletingCatId(null);
  };

  const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));

  const grouped: Record<string, any[]> = { "Uncategorized": [] };
  cats.forEach(c => { grouped[c.name] = []; });
  (services ?? []).filter(s => s.active).forEach(s => {
    const catName = s.categoryId ? (catMap[s.categoryId] || "Uncategorized") : "Uncategorized";
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(s);
  });
  const allGrouped = (services ?? []).reduce((acc: Record<string, any[]>, s) => {
    const catName = s.categoryId ? (catMap[s.categoryId] || "Uncategorized") : "Uncategorized";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Services & Pricing</h1>
          <p className="text-xs sm:text-sm text-gray-400">Manage your service offerings grouped by category</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tab === "services" && (
            <button
              onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold shadow-sm hover:opacity-90 whitespace-nowrap"
            >
              <Plus size={14} /> Add Service
            </button>
          )}
          {tab === "categories" && (
            <button
              onClick={() => { setEditingCat(null); setCatForm({ name: "", sortOrder: cats.length * 10 }); setShowCatForm(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold shadow-sm hover:opacity-90 whitespace-nowrap"
            >
              <Plus size={14} /> New Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["services", "categories"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "services" ? <span className="flex items-center gap-1.5"><Wrench size={14} /> Services</span> : <span className="flex items-center gap-1.5"><Tag size={14} /> Categories</span>}
          </button>
        ))}
      </div>

      {/* CATEGORIES TAB */}
      {tab === "categories" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {cats.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Tag size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No categories yet</p>
              <p className="text-xs mt-1">Create categories to group your services on the website</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-gray-50 text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">CATEGORY NAME</th>
                  <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">SERVICES</th>
                  <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">SORT ORDER</th>
                  <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cats.map(cat => {
                  const count = (services ?? []).filter(s => s.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 sm:px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                          <span className="font-semibold text-gray-900 text-xs sm:text-sm">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-5 py-3">
                        <span className="px-1.5 sm:px-2 py-0.5 bg-pink-50 text-pink-600 text-[10px] sm:text-xs font-bold rounded-full border border-pink-100">{count} service{count !== 1 ? "s" : ""}</span>
                      </td>
                      <td className="px-3 sm:px-5 py-3 text-gray-400 text-xs sm:text-sm">{cat.sortOrder}</td>
                      <td className="px-3 sm:px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, sortOrder: cat.sortOrder }); setShowCatForm(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => deleteCat(cat.id)}
                            disabled={deletingCatId === cat.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
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
      )}

      {/* SERVICES TAB */}
      {tab === "services" && (
        <>
          {Object.keys(allGrouped).length === 0 || Object.values(allGrouped).every(a => a.length === 0) ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-16 text-center text-gray-400">
              <Wrench size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No services yet. Add your first service.</p>
            </div>
          ) : (
            Object.entries(allGrouped).filter(([, items]) => items.length > 0).map(([category, items]) => (
              <div key={category} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                  <h2 className="font-bold text-gray-900">{category}</h2>
                  <span className="px-2 py-0.5 bg-pink-50 text-pink-600 text-xs font-bold rounded-full border border-pink-100">{items.length}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left">SERVICE NAME</th>
                      <th className="px-5 py-3 text-left">DESCRIPTION</th>
                      <th className="px-5 py-3 text-left">PRICE</th>
                      <th className="px-5 py-3 text-left">UNIT</th>
                      <th className="px-5 py-3 text-left">STATUS</th>
                      <th className="px-5 py-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{s.name}</span>
                            {s.featured && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">
                                <Star size={9} fill="currentColor" /> Popular
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{parseDescriptionLines(s.description).join(" • ")}</td>
                        <td className="px-5 py-3.5 font-bold text-pink-600">{rs(s.price)}</td>
                        <td className="px-5 py-3.5 text-gray-400 capitalize text-xs">{s.priceType?.replace(/_/g, " ")}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                            {s.active ? "Active" : "Hidden"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => setDeleteConfirm(s)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}

      {/* Category Add/Edit Modal */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">{editingCat ? "Edit Category" : "New Category"}</h2>
                <button onClick={() => { setShowCatForm(false); setEditingCat(null); }}><X size={18} className="text-gray-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Category Name *</label>
                  <input
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors"
                    placeholder="e.g. Print Services, Design Services..."
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={catForm.sortOrder}
                    onChange={e => setCatForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors"
                    placeholder="0 = first"
                  />
                  <p className="text-xs text-gray-400 mt-1">Lower numbers appear first on the website</p>
                </div>
                <button
                  onClick={saveCat}
                  disabled={savingCat || !catForm.name.trim()}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-60 transition-all"
                >
                  {savingCat ? "Saving..." : editingCat ? "Update Category" : "Create Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ maxHeight: "calc(100vh - 48px)" }}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">{editing ? "Edit Service" : "Add Service"}</h2>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Main Category *</label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={e => setForm((f: any) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none bg-white focus:border-pink-400 transition-colors"
                  >
                    <option value="">— Select a category —</option>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {cats.length === 0 && (
                    <p className="text-xs text-orange-500 mt-1">No categories yet — go to the Categories tab to create one first.</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Service Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors"
                    placeholder="e.g. Business Card Design"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1">Description</label>
                  <DescriptionEditor
                    value={form.description || ""}
                    onChange={v => setForm((f: any) => ({ ...f, description: v }))}
                    placeholder="Brief description of what's included"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1">Price (Rs.)</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={e => setForm((f: any) => ({ ...f, price: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors"
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold block mb-1">Price Unit</label>
                    <select
                      value={form.priceType}
                      onChange={e => setForm((f: any) => ({ ...f, priceType: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none bg-white focus:border-pink-400 transition-colors"
                    >
                      {PRICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold block mb-1">What's Included (comma-separated)</label>
                  <input
                    value={form.highlights}
                    onChange={e => setForm((f: any) => ({ ...f, highlights: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 transition-colors"
                    placeholder="2 revisions, Fast turnaround, High-res files"
                  />
                </div>

                <div className="flex gap-5">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.featured} onChange={e => setForm((f: any) => ({ ...f, featured: e.target.checked }))} className="rounded accent-pink-500" />
                    Mark as Popular
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.active} onChange={e => setForm((f: any) => ({ ...f, active: e.target.checked }))} className="rounded accent-pink-500" />
                    Active (visible on website)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={creating || updating}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-xl disabled:opacity-60 hover:opacity-90 transition-all"
                >
                  {(creating || updating) ? "Saving..." : editing ? "Update Service" : "Add Service"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-5">
                <div className="text-4xl mb-3">🗑️</div>
                <h3 className="font-bold text-gray-900">Delete Service?</h3>
                <p className="text-sm text-gray-500 mt-1">This will permanently remove <span className="font-semibold text-gray-700">"{deleteConfirm.name}"</span>.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button
                  onClick={() => { deleteService({ id: deleteConfirm.id }); setDeleteConfirm(null); }}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
