import { useState, useRef } from "react";
import {
  useGetNotices,
  useCreateNotice,
  useUpdateNoticeById,
  useDeleteNoticeById,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2, Check, Edit3, X, Megaphone, MessageSquare, Image, Type, Upload, Link } from "lucide-react";
import type { Notice } from "@workspace/api-client-react";

const STYLES = [
  { val: "info",    label: "Info",    hex: "#3b82f6", gradient: "linear-gradient(90deg,#2563eb,#3b82f6)" },
  { val: "success", label: "Promo",   hex: "#22c55e", gradient: "linear-gradient(90deg,#16a34a,#10b981)" },
  { val: "warning", label: "Warning", hex: "#f97316", gradient: "linear-gradient(90deg,#f97316,#ec4899)" },
  { val: "error",   label: "Urgent",  hex: "#ef4444", gradient: "linear-gradient(90deg,#dc2626,#ef4444)" },
];

const PLACEMENTS = [
  { val: "banner", label: "Banner Ticker", icon: Megaphone,     desc: "Auto-slides at top of every page" },
  { val: "popup",  label: "Popup Modal",   icon: MessageSquare, desc: "Shown on every page load" },
];

const EMPTY_FORM = { message: "", style: "info", placement: "banner", enabled: true, sortOrder: 0, topic: "", imageUrl: "" };

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd, credentials: "include" });
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  return json.url as string;
}

function ImageInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [tab, setTab] = useState<"url" | "upload">("upload");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch {
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
        <button type="button"
          onClick={() => setTab("upload")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${tab === "upload" ? "bg-purple-50 text-purple-700" : "text-gray-500 hover:bg-gray-50"}`}>
          <Upload size={11} /> Upload file
        </button>
        <button type="button"
          onClick={() => setTab("url")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 border-l border-gray-200 transition-colors ${tab === "url" ? "bg-purple-50 text-purple-700" : "text-gray-500 hover:bg-gray-50"}`}>
          <Link size={11} /> Image URL
        </button>
      </div>

      {tab === "upload" ? (
        <div>
          <button type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors disabled:opacity-60 flex flex-col items-center gap-1">
            {uploading ? <><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /><span>Uploading…</span></> : <><Upload size={18} /><span>Click to upload image</span><span className="text-xs">JPG, PNG, WebP — up to 10 MB</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      ) : (
        <div className="relative">
          <Image size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder="Paste image URL here"
            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200" />
        </div>
      )}

      {value.trim() && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <img src={value.trim()} alt="preview"
            className="w-full object-cover" style={{ height: 180 }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <button type="button" onClick={() => onChange("")}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── NoticeCard is defined OUTSIDE the parent so React never remounts it on re-render ── */
interface NoticeCardProps {
  n: Notice;
  editingId: number | null;
  editForm: Partial<typeof EMPTY_FORM>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<typeof EMPTY_FORM>>>;
  startEdit: (n: Notice) => void;
  saveEdit: (id: number) => void;
  setEditingId: (id: number | null) => void;
  toggleEnabled: (n: Notice) => void;
  deleteNotice: (args: { id: number }) => void;
}

function NoticeCard({ n, editingId, editForm, setEditForm, startEdit, saveEdit, setEditingId, toggleEnabled, deleteNotice }: NoticeCardProps) {
  const isEditing = editingId === n.id;
  const curStyle = isEditing ? (editForm.style ?? n.style) : n.style;
  const styleInfo = STYLES.find(s => s.val === curStyle) ?? STYLES[0];
  const curPlacement = isEditing ? (editForm.placement ?? n.placement) : n.placement;
  const isPopup = curPlacement === "popup";

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${n.enabled ? "border-gray-200 shadow-sm" : "border-dashed border-gray-200 opacity-60"}`}>
      <div style={{ height: 6, background: styleInfo.gradient }} />
      <div className="p-4 space-y-3">
        {isEditing ? (
          <>
            <textarea rows={2} value={editForm.message}
              onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200 resize-none" />
            {isPopup && (
              <div className="space-y-2 p-3 bg-purple-50 rounded-xl">
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Popup extras</p>
                <div className="relative">
                  <Type size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={editForm.topic ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                    placeholder="Title (optional)"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200" />
                </div>
                <ImageInput value={editForm.imageUrl ?? ""} onChange={url => setEditForm(f => ({ ...f, imageUrl: url }))} />
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {STYLES.map(s => {
                const selected = editForm.style === s.val;
                return (
                  <button key={s.val} onClick={() => setEditForm(f => ({ ...f, style: s.val }))}
                    style={selected ? { background: s.hex, color: "#fff" } : undefined}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${selected ? "" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              {PLACEMENTS.map(p => (
                <button key={p.val} onClick={() => setEditForm(f => ({ ...f, placement: p.val }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${editForm.placement === p.val ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-500 hover:border-pink-200"}`}>
                  <p.icon size={12} /> {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={editForm.sortOrder ?? 0}
                onChange={e => setEditForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none" />
              <span className="text-xs text-gray-400">sort order</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveEdit(n.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-semibold hover:bg-pink-600 transition-colors">
                <Check size={14} /> Save
              </button>
              <button onClick={() => setEditingId(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {n.placement === "popup" && n.imageUrl && (
              <img src={n.imageUrl} alt="notice"
                className="w-full object-cover rounded-xl border border-gray-100" style={{ height: 120 }} />
            )}
            {n.placement === "popup" && n.topic && (
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{n.topic}</p>
            )}
            <p className="text-sm text-gray-700 leading-relaxed">{n.message}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ background: styleInfo.hex, color: "#fff" }} className="px-2 py-0.5 rounded-full text-xs font-medium">{styleInfo.label}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">{n.placement}</span>
              <span className="text-xs text-gray-400">order: {n.sortOrder}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => toggleEnabled(n)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${n.enabled ? "bg-green-500" : "bg-gray-200"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${n.enabled ? "translate-x-4" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-gray-500">{n.enabled ? "Active" : "Disabled"}</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => startEdit(n)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => deleteNotice({ id: n.id })} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminNotices() {
  const qc = useQueryClient();
  const { data: notices = [], isLoading } = useGetNotices();
  const { mutate: createNotice, isPending: creating } = useCreateNotice({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notices"] }) }
  });
  const { mutate: updateNotice } = useUpdateNoticeById({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notices"] }) }
  });
  const { mutate: deleteNotice } = useDeleteNoticeById({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notices"] }) }
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<typeof EMPTY_FORM>>({});

  const banners = notices.filter((n: Notice) => n.placement === "banner");
  const popups  = notices.filter((n: Notice) => n.placement === "popup");

  const handleCreate = () => {
    if (!form.message.trim()) return;
    createNotice({ data: {
      message: form.message,
      style: form.style,
      placement: form.placement,
      enabled: form.enabled,
      sortOrder: form.sortOrder,
      topic: form.topic?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
    }}, {
      onSuccess: () => { setForm(EMPTY_FORM); setShowForm(false); }
    });
  };

  const startEdit = (n: Notice) => {
    setEditingId(n.id);
    setEditForm({
      message: n.message, style: n.style, placement: n.placement,
      enabled: n.enabled, sortOrder: n.sortOrder,
      topic: n.topic ?? "", imageUrl: n.imageUrl ?? "",
    });
  };

  const saveEdit = (id: number) => {
    updateNotice({ id, data: {
      message: editForm.message ?? "",
      style: editForm.style ?? "info",
      placement: editForm.placement ?? "banner",
      enabled: editForm.enabled ?? true,
      sortOrder: editForm.sortOrder ?? 0,
      topic: (editForm.topic ?? "").trim() || undefined,
      imageUrl: (editForm.imageUrl ?? "").trim() || undefined,
    }}, { onSuccess: () => setEditingId(null) });
  };

  const toggleEnabled = (n: Notice) => {
    updateNotice({ id: n.id, data: {
      message: n.message, style: n.style, placement: n.placement,
      enabled: !n.enabled, sortOrder: n.sortOrder,
    }});
  };

  const isPopupForm = form.placement === "popup";

  const cardProps = { editingId, editForm, setEditForm, startEdit, saveEdit, setEditingId, toggleEnabled, deleteNotice };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bell size={22} className="text-pink-500 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notices</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Manage banner tickers and popup announcements</p>
          </div>
        </div>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all shrink-0">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Add Notice"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
          <h2 className="font-bold text-gray-900 text-sm sm:text-base">New Notice</h2>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Message</label>
            <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Enter your notice message"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200 resize-none" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Placement</label>
            <div className="grid grid-cols-2 gap-3">
              {PLACEMENTS.map(p => (
                <button key={p.val} onClick={() => setForm(f => ({ ...f, placement: p.val }))}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${form.placement === p.val ? "border-pink-400 bg-pink-50" : "border-gray-200 hover:border-pink-200"}`}>
                  <p.icon size={16} className={`mt-0.5 ${form.placement === p.val ? "text-pink-500" : "text-gray-400"}`} />
                  <div>
                    <div className={`text-sm font-semibold ${form.placement === p.val ? "text-pink-700" : "text-gray-700"}`}>{p.label}</div>
                    <div className="text-xs text-gray-400">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isPopupForm && (
            <div className="space-y-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare size={12} /> Popup extras
              </p>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Title <span className="text-gray-300">(optional)</span></label>
                <div className="relative">
                  <Type size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                    placeholder="Enter a title"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Image <span className="text-gray-300">(optional · 16:9, shown at 180 px height)</span></label>
                <ImageInput value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Style</label>
            <div className="flex gap-2 flex-wrap">
              {STYLES.map(s => {
                const selected = form.style === s.val;
                return (
                  <button key={s.val} onClick={() => setForm(f => ({ ...f, style: s.val }))}
                    style={selected ? { background: s.hex, color: "#fff" } : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm ${selected ? "" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200" />
            </div>
            <div className="flex items-center gap-2 sm:pb-2">
              <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${form.enabled ? "bg-green-500" : "bg-gray-200"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-4" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-gray-600">Active on creation</span>
            </div>
          </div>

          {form.message && (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <div className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-b border-gray-100">Preview</div>
              <div style={{ background: (STYLES.find(s => s.val === form.style) ?? STYLES[0]).gradient }}
                className="text-white py-2 px-4 text-sm font-medium text-center">
                {form.message}
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={creating || !form.message.trim()}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 hover:shadow-lg transition-all">
            {creating ? "Creating…" : "Create Notice"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading notices…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                <Megaphone size={18} className="text-pink-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900">Banner Ticker</h2>
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{banners.length}</span>
                </div>
                <p className="text-xs text-gray-400">Auto-slides between active banners every 5 s</p>
              </div>
            </div>
            {banners.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
                No banner notices yet. Add one above.
              </div>
            ) : (
              <div className="space-y-3">
                {banners.map((n: Notice) => <NoticeCard key={n.id} n={n} {...cardProps} />)}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <MessageSquare size={18} className="text-purple-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900">Popup Modals</h2>
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{popups.length}</span>
                </div>
                <p className="text-xs text-gray-400">Shown on every page load · supports title + image</p>
              </div>
            </div>
            {popups.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
                No popup notices yet. Add one above.
              </div>
            ) : (
              <div className="space-y-3">
                {popups.map((n: Notice) => <NoticeCard key={n.id} n={n} {...cardProps} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
