import { useEffect, useState } from "react";
import { Copy, ExternalLink, FileSpreadsheet, Link2, Loader2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Row = { id: string; cells: string[] };
type Section = { id: string; title: string; columns: string[]; rows: Row[] };
type PriceList = {
  id: number;
  publicId: string;
  title: string;
  subtitle: string;
  note: string;
  sections: Section[];
  active: boolean;
  staffVisible: boolean;
  expiresAt: string | null;
  updatedAt: string;
};

type Draft = Omit<PriceList, "id" | "publicId" | "updatedAt"> & { id?: number; publicId?: string };

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const emptySection = (): Section => ({
  id: uid(),
  title: "New Price Table",
  columns: ["Size", "Price"],
  rows: [{ id: uid(), cells: ["", ""] }],
});
const emptyDraft = (): Draft => ({ title: "", subtitle: "", note: "", active: true, staffVisible: true, expiresAt: null, sections: [emptySection()] });

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/price-lists${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return response.status === 204 ? null : response.json();
}

function shareUrl(publicId?: string) {
  return publicId ? `${window.location.origin}/price-list/${publicId}` : "";
}

export default function AdminPriceLists() {
  const { toast } = useToast();
  const [lists, setLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [readOnly, setReadOnly] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setLists(await api("/")); }
    catch (error: any) { toast({ title: "Could not load price lists", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    fetch("/api/admin/me", { credentials: "include", cache: "no-store" })
      .then(response => response.json())
      .then(session => setReadOnly(session?.role === "staff"))
      .catch(() => setReadOnly(true));
  }, []);

  const updateSection = (index: number, next: Section) => {
    if (!draft) return;
    setDraft({ ...draft, sections: draft.sections.map((section, i) => i === index ? next : section) });
  };

  const addColumn = (sectionIndex: number) => {
    if (!draft) return;
    const section = draft.sections[sectionIndex];
    updateSection(sectionIndex, {
      ...section,
      columns: [...section.columns, `Price ${section.columns.length}`],
      rows: section.rows.map(row => ({ ...row, cells: [...row.cells, ""] })),
    });
  };

  const removeColumn = (sectionIndex: number, columnIndex: number) => {
    if (!draft) return;
    const section = draft.sections[sectionIndex];
    if (section.columns.length <= 1) return;
    updateSection(sectionIndex, {
      ...section,
      columns: section.columns.filter((_, i) => i !== columnIndex),
      rows: section.rows.map(row => ({ ...row, cells: row.cells.filter((_, i) => i !== columnIndex) })),
    });
  };

  const save = async () => {
    if (!draft || !draft.title.trim()) {
      toast({ title: "Price list title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...draft, expiresAt: draft.expiresAt || null };
      const saved = draft.id
        ? await api(`/${draft.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api("/", { method: "POST", body: JSON.stringify(payload) });
      toast({ title: draft.id ? "Price list updated" : "Private price list created", description: "The share link is ready to send." });
      await load();
      setDraft(saved);
    } catch (error: any) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const copy = async (publicId?: string) => {
    if (!publicId) return;
    await navigator.clipboard.writeText(shareUrl(publicId));
    toast({ title: "Private link copied" });
  };

  const regenerate = async (list: Draft) => {
    if (!list.id || !confirm("Generate a new link? The old customer link will stop working immediately.")) return;
    try {
      const updated = await api(`/${list.id}/regenerate-link`, { method: "POST", body: "{}" });
      setDraft(updated);
      await load();
      toast({ title: "New private link generated" });
    } catch (error: any) { toast({ title: "Could not regenerate link", description: error.message, variant: "destructive" }); }
  };

  const remove = async (list: PriceList) => {
    if (!confirm(`Delete “${list.title}”? This cannot be undone.`)) return;
    try {
      await api(`/${list.id}`, { method: "DELETE" });
      setLists(current => current.filter(item => item.id !== list.id));
      if (draft?.id === list.id) setDraft(null);
      toast({ title: "Price list deleted" });
    } catch (error: any) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); }
  };

  if (draft) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button onClick={() => setDraft(null)} className="mb-2 text-xs font-semibold text-gray-500 hover:text-pink-600">← Back to price lists</button>
            <h1 className="text-2xl font-bold text-gray-900">{draft.id ? "Edit Private Price List" : "Create Private Price List"}</h1>
            <p className="mt-1 text-sm text-gray-500">Only customers with the private link can view this page.</p>
          </div>
          <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Price List
          </button>
        </div>

        {draft.publicId && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Customer Share Link</div>
            <div className="mt-2 flex flex-col gap-2 lg:flex-row">
              <input readOnly value={shareUrl(draft.publicId)} className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-gray-600" />
              <button onClick={() => copy(draft.publicId)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"><Copy size={14} /> Copy Link</button>
              <a href={shareUrl(draft.publicId)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700"><ExternalLink size={14} /> Preview</a>
              <button onClick={() => regenerate(draft)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-700"><RefreshCw size={14} /> New Link</button>
            </div>
          </div>
        )}

        <div className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">Title *<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Photo Frame Price List" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-200" /></label>
          <label className="text-xs font-semibold text-gray-600">Subtitle<input value={draft.subtitle} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} placeholder="e.g. Valid for July 2026" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-200" /></label>
          <label className="sm:col-span-2 text-xs font-semibold text-gray-600">Customer note<textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} rows={2} placeholder="Prices may change depending on artwork and finishing requirements." className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-200" /></label>
          <label className="text-xs font-semibold text-gray-600">Expiry date (optional)<input type="datetime-local" value={draft.expiresAt ? draft.expiresAt.slice(0, 16) : ""} onChange={e => setDraft({ ...draft, expiresAt: e.target.value || null })} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <div className="grid gap-2 self-end">
            <label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-pink-500" /> Customer share link is active</label>
            <label className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-800"><input type="checkbox" checked={draft.staffVisible} onChange={e => setDraft({ ...draft, staffVisible: e.target.checked })} className="h-4 w-4 accent-blue-600" /> Show this price list to staff users</label>
            <p className="px-1 text-[10px] text-gray-400">{draft.staffVisible ? "Staff with Private Price List permission can view/copy this list. Editing stays Owner-only." : "Admin only: staff users will not see this price list."}</p>
          </div>
        </div>

        {draft.sections.map((section, sectionIndex) => (
          <section key={section.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-purple-50 p-4 sm:flex-row sm:items-center">
              <input value={section.title} onChange={e => updateSection(sectionIndex, { ...section, title: e.target.value })} className="min-w-0 flex-1 rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm font-bold" />
              <button onClick={() => addColumn(sectionIndex)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-600"><Plus size={13} /> Column</button>
              <button onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== sectionIndex) })} disabled={draft.sections.length <= 1} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-30"><Trash2 size={13} /> Section</button>
            </div>
            <div className="overflow-x-auto p-3 sm:p-4">
              <div className="min-w-[640px] space-y-2">
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(130px, 1fr)) 36px` }}>
                  {section.columns.map((column, columnIndex) => (
                    <div key={columnIndex} className="relative">
                      <input value={column} onChange={e => updateSection(sectionIndex, { ...section, columns: section.columns.map((value, i) => i === columnIndex ? e.target.value : value) })} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 pr-7 text-xs font-bold" />
                      {section.columns.length > 1 && <button onClick={() => removeColumn(sectionIndex, columnIndex)} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500"><X size={13} /></button>}
                    </div>
                  ))}<span />
                </div>
                {section.rows.map((row, rowIndex) => (
                  <div key={row.id} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${section.columns.length}, minmax(130px, 1fr)) 36px` }}>
                    {section.columns.map((_, cellIndex) => <input key={cellIndex} value={row.cells[cellIndex] || ""} onChange={e => updateSection(sectionIndex, { ...section, rows: section.rows.map((item, i) => i === rowIndex ? { ...item, cells: item.cells.map((cell, c) => c === cellIndex ? e.target.value : cell) } : item) })} placeholder={cellIndex === 0 ? "e.g. 4R" : "e.g. Rs. 100/-"} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />)}
                    <button onClick={() => updateSection(sectionIndex, { ...section, rows: section.rows.filter((_, i) => i !== rowIndex) })} className="flex items-center justify-center text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button onClick={() => updateSection(sectionIndex, { ...section, rows: [...section.rows, { id: uid(), cells: section.columns.map(() => "") }] })} className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-pink-50 hover:text-pink-600"><Plus size={13} /> Add Row</button>
              </div>
            </div>
          </section>
        ))}

        <button onClick={() => setDraft({ ...draft, sections: [...draft.sections, emptySection()] })} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-pink-200 py-4 text-sm font-bold text-pink-500 hover:bg-pink-50"><Plus size={16} /> Add Another Price Table</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Private Price Lists</h1><p className="mt-1 text-sm text-gray-500">Create price charts that are hidden from the website and share them by private link.</p></div>
{!readOnly && <button onClick={() => setDraft(emptyDraft())} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20"><Plus size={16} /> New Price List</button>}
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><Link2 size={17} className="mr-2 inline" />{readOnly ? "View-only access: open a list or copy its private customer link. Editing is restricted to the Owner." : "These lists do not appear in the store or navigation. A customer needs the exact private link to open one."}</div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-pink-500" /></div> : lists.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center"><FileSpreadsheet size={42} className="mx-auto mb-3 text-gray-300" /><h2 className="font-bold text-gray-700">No private price lists yet</h2><p className="mt-1 text-sm text-gray-400">Create your first customer price chart.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lists.map(list => (
          <article key={list.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${list.active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{list.active ? "ACTIVE" : "INACTIVE"}</span><h2 className="mt-3 truncate font-bold text-gray-900">{list.title}</h2><p className="mt-1 line-clamp-2 text-xs text-gray-500">{list.subtitle || `${list.sections.length} price table(s)`}</p><p className="mt-2 text-[10px] font-medium text-gray-400">Updated {new Date(list.updatedAt).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" })}</p></div><FileSpreadsheet className="shrink-0 text-pink-400" /></div>
            <div className="mt-4 flex flex-wrap gap-2">{!readOnly && <button onClick={() => setDraft(list)} className="rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">Edit</button>}<button onClick={() => copy(list.publicId)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><Copy size={12} /> Copy Link</button><a href={shareUrl(list.publicId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><ExternalLink size={12} /> View</a>{!readOnly && <button onClick={() => remove(list)} className="ml-auto rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>}</div>
          </article>
        ))}</div>
      )}
    </div>
  );
}
