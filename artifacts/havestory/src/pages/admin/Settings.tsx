import { useState, useRef, useEffect } from "react";
import { useGetSettings, useUpdateSettings, updateSettings as apiUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { broadcastAdminSave } from "@/lib/home-cache";
import { AdminErrorState, AdminPageSkeleton } from "@/components/admin/AdminPageState";
import { Settings as SettingsIcon, Save, Globe, Phone, Users, Landmark, Truck, Plus, Trash2, ExternalLink, Upload, Loader2, Image as ImageIcon, X, Pencil, Check, CheckCircle2, Download, RotateCcw, AlertTriangle, HardDrive, QrCode, Link, CreditCard, Eye, EyeOff, ToggleLeft, ToggleRight, Archive, ArchiveRestore, Sparkles, Mail, Send } from "lucide-react";


const EMPTY_BANK = { bankName: "", accountHolder: "", accountNumber: "", branch: "", swiftBic: "" };

export type CourierEntry = { name: string; trackingUrl: string; firstKgRate?: string; addKgRate?: string };

function CourierServicesManager({ couriers, onChange }: {
  couriers: CourierEntry[];
  onChange: (c: CourierEntry[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newFirstKg, setNewFirstKg] = useState("450");
  const [newAddKg, setNewAddKg] = useState("200");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFirstKg, setEditFirstKg] = useState("");
  const [editAddKg, setEditAddKg] = useState("");

  const add = () => {
    const n = newName.trim(); const u = newUrl.trim();
    if (!n || !u) return;
    onChange([...couriers, { name: n, trackingUrl: u, firstKgRate: newFirstKg || "450", addKgRate: newAddKg || "200" }]);
    setNewName(""); setNewUrl(""); setNewFirstKg("450"); setNewAddKg("200");
  };

  const remove = (i: number) => {
    if (editIdx === i) { setEditIdx(null); }
    onChange(couriers.filter((_, idx) => idx !== i));
  };

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditName(couriers[i].name);
    setEditUrl(couriers[i].trackingUrl);
    setEditFirstKg(couriers[i].firstKgRate || "450");
    setEditAddKg(couriers[i].addKgRate || "200");
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const n = editName.trim(); const u = editUrl.trim();
    if (!n || !u) return;
    const updated = couriers.map((c, i) => i === editIdx ? { name: n, trackingUrl: u, firstKgRate: editFirstKg || "450", addKgRate: editAddKg || "200" } : c);
    onChange(updated);
    setEditIdx(null);
  };

  const cancelEdit = () => setEditIdx(null);

  const inp = "flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400 transition-colors placeholder:text-gray-400";
  const editInp = "flex-1 px-3 py-2 border border-orange-300 rounded-lg text-sm outline-none focus:border-orange-500 transition-colors bg-white";
  const rateInp = "w-full pl-9 pr-2.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-amber-400 text-right font-semibold transition-colors";
  const rateEditInp = "w-full pl-9 pr-2.5 py-1.5 border border-orange-300 rounded-lg text-sm outline-none focus:border-orange-500 bg-white text-right font-semibold transition-colors";

  const rsPrefix = <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-400 pointer-events-none select-none">Rs.</span>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Truck size={18} className="text-orange-400" />
        <h2 className="font-bold text-gray-900">Courier Services</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">Add courier services with weight-based charges. These will appear in invoices and the order manager.</p>

      {couriers.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400 mb-4">
          No courier services yet. Add one below.
        </div>
      )}

      {couriers.length > 0 && (
        <div className="space-y-2 mb-4">
          {couriers.map((c, i) =>
            editIdx === i ? (
              <div key={i} className="border border-orange-300 bg-orange-50/40 rounded-xl px-4 py-3 space-y-2">
                <div className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide mb-1">Editing Courier</div>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Courier name" className={editInp} />
                <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="Tracking URL" className={editInp} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">First kg (Rs.)</label>
                    <div className="relative">{rsPrefix}<input value={editFirstKg} onChange={e => setEditFirstKg(e.target.value.replace(/[^\d.]/g, ""))} placeholder="450" className={rateEditInp} /></div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Each extra kg (Rs.)</label>
                    <div className="relative">{rsPrefix}<input value={editAddKg} onChange={e => setEditAddKg(e.target.value.replace(/[^\d.]/g, ""))} placeholder="200" className={rateEditInp} /></div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={saveEdit} disabled={!editName.trim() || !editUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                    <Check size={12} /> Save
                  </button>
                  <button type="button" onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={i} className="bg-orange-50/60 border border-orange-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <Truck size={13} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-400 truncate">{c.trackingUrl}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <a href={c.trackingUrl + "TEST123"} target="_blank" rel="noopener noreferrer" title="Test link" className="p-1.5 hover:bg-orange-100 rounded-lg text-orange-500">
                      <ExternalLink size={13} />
                    </a>
                    <button type="button" onClick={() => startEdit(i)} title="Edit" className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-400">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => remove(i)} title="Delete" className="p-1.5 hover:bg-red-100 rounded-lg text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex gap-3 text-[11px] text-gray-500">
                  <span>1st kg: <strong className="text-gray-700">Rs. {c.firstKgRate || "450"}</strong></span>
                  <span>Extra kg: <strong className="text-gray-700">Rs. {c.addKgRate || "200"}</strong></span>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="border border-gray-100 rounded-xl p-4 space-y-2">
        <div className="text-xs text-gray-400 font-semibold mb-2">ADD NEW COURIER SERVICE</div>
        <div className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Courier name (e.g. Pronto Lanka)" className={inp} />
        </div>
        <div className="flex gap-2">
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Tracking URL (tracking number appended at end)" className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">First kg rate (Rs.)</label>
            <div className="relative">{rsPrefix}<input value={newFirstKg} onChange={e => setNewFirstKg(e.target.value.replace(/[^\d.]/g, ""))} placeholder="450" className={rateInp} /></div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Each extra kg (Rs.)</label>
            <div className="relative">{rsPrefix}<input value={newAddKg} onChange={e => setNewAddKg(e.target.value.replace(/[^\d.]/g, ""))} placeholder="200" className={rateInp} /></div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400">Example URL: <span className="font-mono">https://track.prontolanka.lk/tracking/</span> — the tracking number will be added at the end automatically.</p>
        <button type="button" onClick={add} disabled={!newName.trim() || !newUrl.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors">
          <Plus size={14} /> Add Courier
        </button>
      </div>
    </div>
  );
}

type BankEntry = { bankName: string; accountHolder: string; accountNumber: string; branch: string; swiftBic: string };

function BankDetailsManager({ banks, onChange }: { banks: BankEntry[]; onChange: (b: BankEntry[]) => void }) {
  const [form, setForm] = useState<BankEntry>({ ...EMPTY_BANK });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white transition-colors placeholder:text-gray-400";
  const f = (key: keyof BankEntry, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const startAdd = () => { setForm({ ...EMPTY_BANK }); setEditingIdx(null); setShowForm(true); };
  const startEdit = (i: number) => { setForm({ ...banks[i] }); setEditingIdx(i); setShowForm(true); };
  const cancel = () => { setForm({ ...EMPTY_BANK }); setEditingIdx(null); setShowForm(false); };

  const save = () => {
    if (!form.bankName.trim() || !form.accountNumber.trim()) return;
    if (editingIdx !== null) {
      onChange(banks.map((b, i) => (i === editingIdx ? { ...form } : b)));
    } else {
      onChange([...banks, { ...form }]);
    }
    cancel();
  };

  const remove = (i: number) => {
    if (editingIdx === i) cancel();
    onChange(banks.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      {/* Header — single-line on phones (icon + title + Add) with the
          "(invoices & homepage)" hint pushed down to the description so
          the title never wraps mid-word into 3 lines on narrow screens. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Landmark size={18} className="text-blue-400 shrink-0" />
          <h2 className="font-bold text-gray-900 text-sm sm:text-base truncate">Bank / Payment Details</h2>
        </div>
        {!showForm && (
          <button type="button" onClick={startAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-colors shrink-0">
            <Plus size={13} /> <span className="hidden sm:inline">Add Account</span><span className="sm:hidden">Add</span>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Add all your bank accounts (shown on invoices &amp; the homepage payment section). The first account is the primary.
      </p>

      {/* Empty state */}
      {banks.length === 0 && !showForm && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center mb-4">
          <Landmark size={28} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-gray-400 mb-3">No bank accounts yet.</p>
          <button type="button" onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">
            <Plus size={14} /> Add Bank Account
          </button>
        </div>
      )}

      {/* Bank cards */}
      {banks.length > 0 && (
        <div className="space-y-2 mb-4">
          {banks.map((b, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 border transition-all ${editingIdx === i ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" : "bg-gray-50 border-gray-100"}`}>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-0.5">
                  {i === 0 && (
                    <span className="text-[10px] font-bold bg-blue-500 text-white rounded-md px-1.5 py-0.5 leading-none">PRIMARY</span>
                  )}
                  <span className="text-sm font-bold text-gray-800">{b.bankName}</span>
                </div>
                {b.accountHolder && <div className="text-xs text-gray-500">{b.accountHolder}</div>}
                <div className="text-xs text-gray-500 font-mono">{b.accountNumber}</div>
                {(b.branch || b.swiftBic) && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {[b.branch, b.swiftBic].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <button type="button" onClick={() => editingIdx === i ? cancel() : startEdit(i)}
                  className={`p-1.5 rounded-lg transition-colors ${editingIdx === i ? "bg-blue-200 text-blue-700" : "hover:bg-blue-100 text-blue-400"}`}
                  title={editingIdx === i ? "Cancel edit" : "Edit"}>
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => remove(i)}
                  className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form — single column on phones & tablets, 2-col on desktop
          (the parent settings card is itself ~half-width on desktop, so going
          2-col any earlier squeezes inputs and clips placeholder text). */}
      {showForm && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            {editingIdx !== null ? `Editing Account ${editingIdx + 1}` : "New Bank Account"}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-3">
            <div className="min-w-0">
              <label className="text-[11px] text-gray-500 font-semibold block mb-1 whitespace-nowrap">Bank Name *</label>
              <input value={form.bankName} onChange={e => f("bankName", e.target.value)} placeholder="Bank of Ceylon" className={inp} />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] text-gray-500 font-semibold block mb-1 whitespace-nowrap">Account Holder</label>
              <input value={form.accountHolder} onChange={e => f("accountHolder", e.target.value)} placeholder="Account holder name" className={inp} />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] text-gray-500 font-semibold block mb-1 whitespace-nowrap">Account Number *</label>
              <input value={form.accountNumber} onChange={e => f("accountNumber", e.target.value)} placeholder="1234567890" className={inp} />
            </div>
            <div className="min-w-0">
              <label className="text-[11px] text-gray-500 font-semibold block mb-1 whitespace-nowrap">Branch</label>
              <input value={form.branch} onChange={e => f("branch", e.target.value)} placeholder="Colombo" className={inp} />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <label className="text-[11px] text-gray-500 font-semibold block mb-1 whitespace-nowrap">SWIFT / BIC Code</label>
              <input value={form.swiftBic} onChange={e => f("swiftBic", e.target.value)} placeholder="BCEYLKLX" className={inp} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={save} disabled={!form.bankName.trim() || !form.accountNumber.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {editingIdx !== null ? <><Check size={14} /> Save Changes</> : <><Plus size={14} /> Add Account</>}
            </button>
            <button type="button" onClick={cancel}
              className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const { data: settings, isLoading, isError, error, refetch } = useGetSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [loaded, setLoaded] = useState(false);
  const [couriers, setCouriers] = useState<CourierEntry[]>([]);
  const [banks, setBanks] = useState<BankEntry[]>([]);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [backupExporting, setBackupExporting] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ success: boolean; message: string; filesDeleted?: number } | null>(null);
  // Data Management (soft-delete / trash)
  // `custom-orders` is a subset of the orders table — only rows where
  // orderType = 'custom'. The backend SECTION_MAP handles the WHERE clause
  // so admins can clear *just* custom-project orders without touching
  // standard orders.
  type TrashSection = "orders" | "invoices" | "clients" | "projects" | "custom-orders";
  const TRASH_SECTIONS: { key: TrashSection; label: string; icon: typeof Trash2 }[] = [
    { key: "orders", label: "Orders", icon: Trash2 },
    { key: "custom-orders", label: "Custom Projects", icon: Sparkles },
    { key: "invoices", label: "Invoices", icon: Trash2 },
    { key: "clients", label: "Clients", icon: Users },
    { key: "projects", label: "Projects", icon: Trash2 },
  ];
  const [trashCounts, setTrashCounts] = useState<Record<string, number>>({});
  const [trashLoading, setTrashLoading] = useState<TrashSection | null>(null);
  const [trashResult, setTrashResult] = useState<{ section: string; success: boolean; message: string } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState<TrashSection | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ section: string; success: boolean; message: string } | null>(null);

  const fetchTrashCounts = async () => {
    try {
      const res = await fetch("/api/admin/trash-counts", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTrashCounts(data);
      }
    } catch {}
  };

  // Fetch trash counts on load
  useEffect(() => { fetchTrashCounts(); }, []);

  const handleTrashSection = async (section: TrashSection) => {
    const label = TRASH_SECTIONS.find(s => s.key === section)?.label ?? section;
    const labelLower = label.toLowerCase();
    if (!window.confirm(`This will move ALL ${labelLower} to trash. They can be restored within 30 days. Continue?`)) return;
    setTrashLoading(section);
    setTrashResult(null);
    try {
      const res = await fetch(`/api/admin/trash/${section}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      // Use the friendly section label client-side so the toast reads
      // "5 custom projects moved to trash." instead of the raw API key.
      const count = typeof data.trashedCount === "number" ? data.trashedCount : null;
      const message = data.success && count !== null
        ? `${count} ${labelLower} moved to trash.`
        : data.message;
      setTrashResult({ section, success: data.success, message });
      fetchTrashCounts();
      queryClient.invalidateQueries();
    } catch {
      setTrashResult({ section, success: false, message: `Failed to clear ${labelLower}. Please try again.` });
    } finally {
      setTrashLoading(null);
    }
  };

  const handleRestoreSection = async (section: TrashSection) => {
    const label = TRASH_SECTIONS.find(s => s.key === section)?.label ?? section;
    const labelLower = label.toLowerCase();
    if (!window.confirm(`This will restore ALL trashed ${labelLower} back to their original state. Continue?`)) return;
    setRestoreLoading(section);
    setRestoreResult(null);
    try {
      const res = await fetch(`/api/admin/restore/${section}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      const count = typeof data.restoredCount === "number" ? data.restoredCount : null;
      const message = data.success && count !== null
        ? `${count} ${labelLower} restored from trash.`
        : data.message;
      setRestoreResult({ section, success: data.success, message });
      fetchTrashCounts();
      queryClient.invalidateQueries();
    } catch {
      setRestoreResult({ section, success: false, message: `Failed to restore ${labelLower}. Please try again.` });
    } finally {
      setRestoreLoading(null);
    }
  };

  if (settings && !loaded) {
    let parsedCouriers: CourierEntry[] = [];
    let parsedBanks: BankEntry[] = [];
    try { parsedCouriers = JSON.parse((settings as any).courierServices || "[]"); } catch {}
    try {
      const raw = JSON.parse((settings as any).bankDetails || "[]");
      if (Array.isArray(raw) && raw.length > 0) {
        parsedBanks = raw;
      } else {
        // Migrate single bank fields to array
        const singleBank = {
          bankName: (settings as any).bankName || "",
          accountHolder: (settings as any).bankAccountHolder || "",
          accountNumber: (settings as any).bankAccountNumber || "",
          branch: (settings as any).bankBranch || "",
          swiftBic: (settings as any).bankSwiftBic || "",
        };
        if (singleBank.bankName || singleBank.accountNumber) parsedBanks = [singleBank];
      }
    } catch {}

    setForm({
      businessName: settings.businessName || "",
      ownerName: (settings as any).ownerName || "",
      tagline: settings.tagline || "",
      taglineEnabled: (settings as any).taglineEnabled !== 0,
      showNameWithLogo: (settings as any).showNameWithLogo !== 0,
      logoUrl: (settings as any).logoUrl || "",
      courierCharge: (settings as any).courierCharge ?? "450",
      slPostCharge: (settings as any).slPostCharge ?? "250",
      checkoutCourierEnabled: (settings as any).checkoutCourierEnabled !== 0,
      checkoutCourierLabel: (settings as any).checkoutCourierLabel || "Studio courier",
      checkoutCourierDescription: (settings as any).checkoutCourierDescription || "Carefully packed and delivered to your door.",
      checkoutSlPostEnabled: (settings as any).checkoutSlPostEnabled !== 0,
      checkoutSlPostLabel: (settings as any).checkoutSlPostLabel || "Sri Lanka Post",
      checkoutSlPostDescription: (settings as any).checkoutSlPostDescription || "A considered island-wide delivery route.",
      checkoutPickupEnabled: (settings as any).checkoutPickupEnabled === 1,
      checkoutPickupLabel: (settings as any).checkoutPickupLabel || "Studio pickup",
      checkoutPickupDescription: (settings as any).checkoutPickupDescription || "Collect your order from the HAVESTORY studio.",
      checkoutPickupAddress: (settings as any).checkoutPickupAddress || "Contact us for pickup details.",
      invoiceStandardRate: (settings as any).invoiceStandardRate ?? "350",
      invoiceExpressRate: (settings as any).invoiceExpressRate ?? "530",
      invoiceWeightFirstKg: (settings as any).invoiceWeightFirstKg ?? "450",
      invoiceWeightAddKg: (settings as any).invoiceWeightAddKg ?? "200",
      heroTitle: settings.heroTitle || "",
      heroSubtitle: settings.heroSubtitle || "",
      whatsappNumber: settings.whatsappNumber || "",
      whatsappMessage: settings.whatsappMessage || "",
      whatsappOrderTemplate: (settings as any).whatsappOrderTemplate || "",
      aboutStory: settings.aboutStory || "",
      aboutMission: settings.aboutMission || "",
      aboutImage: settings.aboutImage || "",
      ordersCompletedCount: settings.ordersCompletedCount || "500",
      happyClientsPercent: settings.happyClientsPercent || "98",
      starRating: settings.starRating || "5.0",
      facebookUrl: settings.facebookUrl || "",
      instagramUrl: settings.instagramUrl || "",
      tiktokUrl: (settings as any).tiktokUrl || "",
      address: settings.address || "",
      email: settings.email || "",
      phone: settings.phone || "",
      website: (settings as any).website || "",
      paymentDueDays: String((settings as any).paymentDueDays ?? "7"),
      overdueDays: String((settings as any).overdueDays ?? "30"),
      termsConditions: (settings as any).termsConditions || "Payment is due within 7 days of invoice date. Thank you for your business!",
      paymentQrUrl: (settings as any).paymentQrUrl || "",
      paymentButtonUrl: (settings as any).paymentButtonUrl || "",
      paymentButtonLabel: (settings as any).paymentButtonLabel || "",
      checkoutBankTransferEnabled: (settings as any).checkoutBankTransferEnabled !== 0,
      checkoutDepositAmount: String((settings as any).checkoutDepositAmount ?? "500"),
      checkoutDepositMessage: (settings as any).checkoutDepositMessage || "A Rs. 500 deposit is required to confirm this order. Upload your payment proof after paying.",
      siteClosedEnabled: (settings as any).siteClosedEnabled === 1,
      siteClosedMessage: (settings as any).siteClosedMessage || "We are currently closed for maintenance. We will be back soon!",
      ipayEnabled: (settings as any).ipayEnabled === 1,
      ipaySandbox: (settings as any).ipaySandbox !== 0,
      ipayToken: (settings as any).ipayToken || "",
      ipaySecret: (settings as any).ipaySecret || "",
      payButtonVisible: (settings as any).payButtonVisible !== 0,
      googlePayEnabled: (settings as any).googlePayEnabled === 1,
      googlePayNumber: (settings as any).googlePayNumber || "",
      googlePayQrUrl: (settings as any).googlePayQrUrl || "",
      googlePayInstructions: (settings as any).googlePayInstructions || "",
      orderEmailNotificationsEnabled: (settings as any).orderEmailNotificationsEnabled !== 0,
      orderEmailRecipients: (settings as any).orderEmailRecipients || "",
      gmailUser: (settings as any).gmailUser || "",
      gmailAppPassword: (settings as any).gmailAppPassword || "",
      financeReportEmailEnabled: (settings as any).financeReportEmailEnabled === 1 || (settings as any).financeReportEmailEnabled === true,
      financeReportEmailRecipient: (settings as any).financeReportEmailRecipient || "",
    });
    setCouriers(parsedCouriers);
    setBanks(parsedBanks);
    setLoaded(true);
  }

  const { mutate: saveSettings, isPending, isSuccess } = useUpdateSettings({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); broadcastAdminSave(); } }
  });

  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportResult, setReportResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const autoSaveField = async (field: string, value: string | null) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await apiUpdateSettings({ [field]: value } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      broadcastAdminSave();
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  };

  const savePaymentSettings = async () => {
    setPaymentSaving(true);
    setPaymentSaved(false);
    try {
      await apiUpdateSettings({
        paymentQrUrl: form.paymentQrUrl || null,
        paymentButtonUrl: form.paymentButtonUrl || null,
        paymentButtonLabel: form.paymentButtonLabel || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      broadcastAdminSave();
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 3000);
    } catch (err) {
      console.error("Payment save failed:", err);
      alert("Failed to save payment settings. Please try again.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const saveCheckoutSettings = async () => {
    setPaymentSaving(true);
    setPaymentSaved(false);
    try {
      await apiUpdateSettings({
        checkoutBankTransferEnabled: form.checkoutBankTransferEnabled ? 1 : 0,
        checkoutDepositAmount: Math.max(0, Number(form.checkoutDepositAmount) || 0),
        checkoutDepositMessage: form.checkoutDepositMessage || null,
        checkoutCourierEnabled: form.checkoutCourierEnabled ? 1 : 0,
        checkoutCourierLabel: form.checkoutCourierLabel || null,
        checkoutCourierDescription: form.checkoutCourierDescription || null,
        checkoutSlPostEnabled: form.checkoutSlPostEnabled ? 1 : 0,
        checkoutSlPostLabel: form.checkoutSlPostLabel || null,
        checkoutSlPostDescription: form.checkoutSlPostDescription || null,
        checkoutPickupEnabled: form.checkoutPickupEnabled ? 1 : 0,
        checkoutPickupLabel: form.checkoutPickupLabel || null,
        checkoutPickupDescription: form.checkoutPickupDescription || null,
        checkoutPickupAddress: form.checkoutPickupAddress || null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      broadcastAdminSave();
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 3000);
    } catch (err) {
      console.error("Checkout settings save failed:", err);
      alert("Failed to save checkout settings. Please try again.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const [ipaySaving, setIpaySaving] = useState(false);
  const [ipaySaved, setIpaySaved] = useState(false);
  const [showIpayToken, setShowIpayToken] = useState(false);
  const [showIpaySecret, setShowIpaySecret] = useState(false);

  const [gpaySaving, setGpaySaving] = useState(false);
  const [gpaySaved, setGpaySaved] = useState(false);
  const gpayQrInputRef = useRef<HTMLInputElement>(null);
  const [gpayQrUploading, setGpayQrUploading] = useState(false);

  const handleGpayQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpayQrUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setForm((f: any) => ({ ...f, googlePayQrUrl: url }));
      await autoSaveField("googlePayQrUrl", url);
    } catch (err) {
      console.error("GPay QR upload failed:", err);
      alert("Failed to upload QR code. Please try again.");
    } finally {
      setGpayQrUploading(false);
      if (gpayQrInputRef.current) gpayQrInputRef.current.value = "";
    }
  };

  const saveGooglePaySettings = async () => {
    setGpaySaving(true);
    setGpaySaved(false);
    try {
      await apiUpdateSettings({
        googlePayEnabled: form.googlePayEnabled ? 1 : 0,
        googlePayNumber: form.googlePayNumber || null,
        googlePayQrUrl: form.googlePayQrUrl || null,
        googlePayInstructions: form.googlePayInstructions || null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      broadcastAdminSave();
      setGpaySaved(true);
      setTimeout(() => setGpaySaved(false), 3000);
    } catch (err) {
      console.error("Google Pay save failed:", err);
      alert("Failed to save Google Pay settings. Please try again.");
    } finally {
      setGpaySaving(false);
    }
  };

  const saveIpaySettings = async () => {
    setIpaySaving(true);
    setIpaySaved(false);
    try {
      await apiUpdateSettings({
        ipayEnabled: form.ipayEnabled,
        ipaySandbox: form.ipaySandbox,
        ipayToken: form.ipayToken || null,
        ipaySecret: form.ipaySecret || null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      broadcastAdminSave();
      setIpaySaved(true);
      setTimeout(() => setIpaySaved(false), 3000);
    } catch (err) {
      console.error("iPay save failed:", err);
      alert("Failed to save iPay settings. Please try again.");
    } finally {
      setIpaySaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((f: any) => ({ ...f, [key]: val }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setForm((f: any) => ({ ...f, logoUrl: url }));
      await autoSaveField("logoUrl", url);
    } catch { alert("Logo upload failed. Please try again."); }
    finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setForm((f: any) => ({ ...f, paymentQrUrl: url }));
      await autoSaveField("paymentQrUrl", url);
    } catch { alert("QR upload failed. Please try again."); }
    finally {
      setQrUploading(false);
      if (qrInputRef.current) qrInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    // Also propagate first bank entry to legacy columns for invoice backward compat
    const firstBank = banks[0];
    saveSettings({
      data: {
        ...form,
        courierServices: JSON.stringify(couriers),
        bankDetails: JSON.stringify(banks),
        bankName: firstBank?.bankName || "",
        bankAccountHolder: firstBank?.accountHolder || "",
        bankAccountNumber: firstBank?.accountNumber || "",
        bankBranch: firstBank?.branch || "",
        bankSwiftBic: firstBank?.swiftBic || "",
      }
    });
  };

  const handleExportBackup = async () => {
    setBackupExporting(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `${(form.businessName || "website").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-settings-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { alert("Failed to export settings. Please try again."); }
    finally { setBackupExporting(false); }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("This will overwrite your current settings with the backup file. Are you sure?")) {
      if (restoreInputRef.current) restoreInputRef.current.value = "";
      return;
    }
    setBackupRestoring(true);
    setRestoreSuccess(false);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.settings) throw new Error("Invalid backup file");
      const res = await fetch("/api/settings/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error("Restore failed");
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setLoaded(false);
      setRestoreSuccess(true);
      setTimeout(() => setRestoreSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to restore settings. Check the file and try again.");
    } finally {
      setBackupRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm("This will permanently delete all customer-uploaded files (design files, payment proofs, delivery files) from orders older than 3 months. This cannot be undone. Continue?")) return;
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/admin/cleanup-files", { method: "POST", credentials: "include" });
      const data = await res.json();
      setCleanupResult({ success: data.success, message: data.message, filesDeleted: data.filesDeleted });
    } catch {
      setCleanupResult({ success: false, message: "Cleanup failed. Please try again." });
    } finally {
      setCleanupRunning(false);
    }
  };

  const sections = [
    {
      title: "Business Identity",
      icon: Globe,
      fields: [
        { key: "businessName", label: "Business Name", placeholder: "Enter your business name" },
        { key: "ownerName", label: "Business Owner Name", placeholder: "Enter the owner's name" },
        { key: "tagline", label: "Tagline", placeholder: "Enter your business tagline" },
        { key: "heroTitle", label: "Homepage Hero Title", placeholder: "Enter a headline for your homepage" },
        { key: "heroSubtitle", label: "Homepage Hero Subtitle", placeholder: "Enter a short description for your homepage" },
      ],
    },
    {
      title: "Contact Information",
      icon: Phone,
      fields: [
        { key: "phone", label: "Phone Number", placeholder: "Enter your phone number" },
        { key: "email", label: "Email Address", placeholder: "Enter your email address" },
        { key: "address", label: "Office / Shop Address", placeholder: "Enter your shop or office address" },
        { key: "whatsappNumber", label: "WhatsApp Number", placeholder: "Enter your WhatsApp number" },
        { key: "whatsappMessage", label: "WhatsApp Default Message", placeholder: "Enter the default message customers will send" },
        { key: "whatsappOrderTemplate", label: "WhatsApp Order Update Template", placeholder: "Hi {customerName}! Your order {orderNumber} is ready.\nTrack here: {trackingLink}" },
      ],
    },
    {
      title: "Social Media",
      icon: Globe,
      fields: [
        { key: "facebookUrl", label: "Facebook URL", placeholder: "Enter your Facebook page URL" },
        { key: "instagramUrl", label: "Instagram URL", placeholder: "Enter your Instagram profile URL" },
        { key: "tiktokUrl", label: "TikTok URL", placeholder: "Enter your TikTok profile URL" },
      ],
    },
    {
      title: "Shipping Charges (Website Orders)",
      icon: Truck,
      fields: [
        { key: "courierCharge", label: "Courier Service Charge (Rs.)", placeholder: "450" },
        { key: "slPostCharge", label: "SL Post Charge (Rs.)", placeholder: "250" },
      ],
    },
    {
      title: "Invoice Shipping Rates",
      icon: Truck,
      fields: [
        { key: "invoiceStandardRate", label: "Standard Delivery Rate (Rs.)", placeholder: "350" },
        { key: "invoiceExpressRate", label: "Express Delivery Rate (Rs.)", placeholder: "530" },
        { key: "invoiceWeightFirstKg", label: "Weight-Based: First kg Rate (Rs.)", placeholder: "450" },
        { key: "invoiceWeightAddKg", label: "Weight-Based: Each Extra kg Rate (Rs.)", placeholder: "200" },
      ],
    },
    {
      title: "Website & Invoice",
      icon: Globe,
      fields: [
        { key: "website", label: "Website URL", placeholder: "www.yourdomain.lk" },
        { key: "paymentDueDays", label: "Invoice Due Days", placeholder: "7" },
        { key: "overdueDays", label: "Overdue Period (days after due date)", placeholder: "30" },
        { key: "termsConditions", label: "Terms & Conditions (one per line)", placeholder: "Payment is due within 7 days of invoice date.\nAll sales are final." },
      ],
    },
    {
      title: "About / Stats Section",
      icon: Users,
      fields: [
        { key: "aboutStory", label: "Our Story", placeholder: "Tell your business story..." },
        { key: "aboutMission", label: "Our Mission", placeholder: "To provide Sri Lanka's best printing experience..." },
        { key: "aboutImage", label: "About Page Image URL", placeholder: "https://..." },
        { key: "ordersCompletedCount", label: "Orders Delivered (Homepage stat display)", placeholder: "500" },
        { key: "happyClientsPercent", label: "Happy Clients % (Homepage stat display)", placeholder: "98" },
        { key: "starRating", label: "Quality Rating / Star Rating (Homepage stat display)", placeholder: "5.0" },
      ],
    },
  ];

  if (isLoading && !settings) return <AdminPageSkeleton cards={2} rows={8} />;
  if (isError && !settings) {
    return <AdminErrorState message={error instanceof Error ? error.message : "Business settings could not be loaded."} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SettingsIcon size={22} className="text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">Configure your website content, contact info, and social links</p>
        </div>
        <button disabled={isPending} onClick={handleSave} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-stone-600 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-60 shrink-0">
          <Save size={14} /> {isPending ? "Saving..." : "Save All"}
        </button>
      </div>

      {isSuccess && (
        <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-5 py-3">
          Settings saved successfully!
        </div>
      )}

      {/* Site Closed Toggle */}
      <div className={`border rounded-2xl shadow-sm p-4 sm:p-6 ${form.siteClosedEnabled ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-base sm:text-lg">🔒</span>
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">Site Closed / Maintenance Mode</h2>
              {form.siteClosedEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> ACTIVE
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              When enabled, all public pages show a "site closed" message. The admin panel stays fully accessible.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={async () => {
                  // Optimistically flip the switch, but if the PUT fails
                  // (e.g. admin auth expired, server error) we revert and
                  // surface the error so the toggle never lies about the
                  // saved state — this is what previously made the
                  // toggle "auto-disable on reload" without any feedback.
                  const prev = !!form.siteClosedEnabled;
                  const next = !prev;
                  setForm((f: any) => ({ ...f, siteClosedEnabled: next }));
                  try {
                    const res = await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ siteClosedEnabled: next }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                    broadcastAdminSave();
                  } catch (err) {
                    setForm((f: any) => ({ ...f, siteClosedEnabled: prev }));
                    alert(`Failed to ${next ? "enable" : "disable"} maintenance mode. Please try again or re-login. (${(err as Error)?.message ?? "network error"})`);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${form.siteClosedEnabled ? "bg-amber-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.siteClosedEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-semibold ${form.siteClosedEnabled ? "text-amber-700" : "text-gray-500"}`}>
                {form.siteClosedEnabled ? "Site is CLOSED to visitors" : "Site is open to visitors"}
              </span>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold block mb-1.5">Closed Page Message</label>
              <textarea
                value={form.siteClosedMessage || ""}
                onChange={e => setForm((f: any) => ({ ...f, siteClosedMessage: e.target.value }))}
                onBlur={() => autoSaveField("siteClosedMessage", form.siteClosedMessage || "")}
                rows={2}
                placeholder="We are currently closed for maintenance. We will be back soon!"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">Saved automatically when you leave this field.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Email Notifications */}
      <div className={`border rounded-2xl shadow-sm p-4 sm:p-6 ${form.orderEmailNotificationsEnabled ? "bg-white border-gray-100" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Mail size={18} className="text-amber-400 shrink-0" />
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">New-Order Email Notifications</h2>
              {form.orderEmailNotificationsEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> ON
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Get an email the moment any new order is created (customer checkout or admin "New Order"). Fully free — uses Gmail SMTP under the hood.
            </p>

            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={async () => {
                  const prev = !!form.orderEmailNotificationsEnabled;
                  const next = !prev;
                  setForm((f: any) => ({ ...f, orderEmailNotificationsEnabled: next }));
                  try {
                    const res = await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ orderEmailNotificationsEnabled: next }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                  } catch (err) {
                    setForm((f: any) => ({ ...f, orderEmailNotificationsEnabled: prev }));
                    alert(`Failed to ${next ? "enable" : "disable"} email notifications. (${(err as Error)?.message ?? "network error"})`);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shadow-inner ${form.orderEmailNotificationsEnabled ? "bg-green-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.orderEmailNotificationsEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-semibold ${form.orderEmailNotificationsEnabled ? "text-green-700" : "text-gray-500"}`}>
                {form.orderEmailNotificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-semibold block">Recipient Email Address(es)</label>
              <input
                type="text"
                value={form.orderEmailRecipients || ""}
                onChange={e => setForm((f: any) => ({ ...f, orderEmailRecipients: e.target.value }))}
                onBlur={() => autoSaveField("orderEmailRecipients", form.orderEmailRecipients || "")}
                placeholder="orders@yourbusiness.com, manager@yourbusiness.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
              />
              <p className="text-[11px] text-gray-400">Multiple addresses can be comma- or space-separated. Saved automatically when you leave the field.</p>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={14} className="text-gray-400" />
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Gmail Sender Credentials</h3>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">
                One-time setup. Generate an App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-amber-500 underline">myaccount.google.com/apppasswords</a> (2-Step Verification must be ON). The password is 16 characters and only shown once on Google's side.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <label className="text-xs text-gray-400 font-semibold block">Gmail Address (sender)</label>
                  <input
                    type="email"
                    autoComplete="username"
                    value={form.gmailUser || ""}
                    onChange={e => setForm((f: any) => ({ ...f, gmailUser: e.target.value }))}
                    onBlur={() => autoSaveField("gmailUser", (form.gmailUser || "").trim())}
                    placeholder="yourbusiness@gmail.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label className="text-xs text-gray-400 font-semibold block">App Password (16 characters)</label>
                  <div className="relative">
                    <input
                      type={showGmailPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.gmailAppPassword || ""}
                      onChange={e => setForm((f: any) => ({ ...f, gmailAppPassword: e.target.value }))}
                      onBlur={() => autoSaveField("gmailAppPassword", form.gmailAppPassword || "")}
                      placeholder="abcd efgh ijkl mnop"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 font-mono tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGmailPassword(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                      aria-label={showGmailPassword ? "Hide password" : "Show password"}
                    >
                      {showGmailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">Spaces are okay — we strip them. Saved automatically when you leave the field.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={emailTesting || !form.orderEmailRecipients?.trim()}
                onClick={async () => {
                  setEmailTesting(true);
                  setEmailTestResult(null);
                  try {
                    const res = await fetch("/api/settings/test-email", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        recipients: form.orderEmailRecipients,
                        gmailUser: form.gmailUser || "",
                        gmailAppPassword: form.gmailAppPassword || "",
                      }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (res.ok && json.ok) {
                      setEmailTestResult({ ok: true, msg: `Sent to ${(json.recipients || []).join(", ")}. Check your inbox (and spam folder).` });
                    } else {
                      setEmailTestResult({ ok: false, msg: json.error || `HTTP ${res.status}` });
                    }
                  } catch (err) {
                    setEmailTestResult({ ok: false, msg: (err as Error)?.message || "Network error" });
                  } finally {
                    setEmailTesting(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {emailTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {emailTesting ? "Sending…" : "Send test email"}
              </button>
              {emailTestResult && (
                <span className={`text-xs font-medium ${emailTestResult.ok ? "text-green-600" : "text-red-600"}`}>
                  {emailTestResult.ok ? "✓ " : "✗ "}{emailTestResult.msg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Automated Monthly Finance Report */}
      <div className="border rounded-2xl shadow-sm p-4 sm:p-6 bg-white border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} className="text-amber-500" />
          <h2 className="font-bold text-gray-900 text-sm sm:text-base">Automated Monthly Finance Report</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Email the previous month's income, expenses, profit and inventory summary on the 1st of each month.</p>
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            role="switch"
            aria-checked={!!form.financeReportEmailEnabled}
            onClick={async () => {
              const previous = !!form.financeReportEmailEnabled;
              const next = !previous;
              setForm((current: any) => ({ ...current, financeReportEmailEnabled: next }));
              try {
                await apiUpdateSettings({ financeReportEmailEnabled: next } as any);
                queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
              } catch {
                setForm((current: any) => ({ ...current, financeReportEmailEnabled: previous }));
                alert("Could not update the monthly report schedule.");
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.financeReportEmailEnabled ? "bg-amber-600" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.financeReportEmailEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <span className="text-sm font-semibold text-gray-700">{form.financeReportEmailEnabled ? "Scheduled" : "Disabled"}</span>
        </div>
        <label className="text-xs text-gray-400 font-semibold block mb-1.5">Report recipient</label>
        <input
          type="email"
          value={form.financeReportEmailRecipient || ""}
          onChange={event => setForm((current: any) => ({ ...current, financeReportEmailRecipient: event.target.value }))}
          onBlur={() => autoSaveField("financeReportEmailRecipient", form.financeReportEmailRecipient || "")}
          placeholder="owner@example.com"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={reportSending || !form.financeReportEmailRecipient?.trim()}
            onClick={async () => {
              setReportSending(true);
              setReportResult(null);
              try {
                await autoSaveField("financeReportEmailRecipient", form.financeReportEmailRecipient || "");
                const response = await fetch("/api/admin/finance/send-report", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
                const result = await response.json().catch(() => ({}));
                setReportResult(response.ok && result.success
                  ? { ok: true, msg: "Prior-month report sent successfully." }
                  : { ok: false, msg: result.message || result.error || "Report could not be sent." });
              } catch {
                setReportResult({ ok: false, msg: "Network error while sending the report." });
              } finally {
                setReportSending(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
          >
            {reportSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {reportSending ? "Sending…" : "Send prior-month report now"}
          </button>
          {reportResult && <span className={`text-xs font-medium ${reportResult.ok ? "text-green-600" : "text-red-600"}`}>{reportResult.msg}</span>}
        </div>
      </div>

      {/* Business Logo */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 sm:mb-5">
          <ImageIcon size={18} className="text-amber-400" />
          <h2 className="font-bold text-gray-900 text-sm sm:text-base">Business Logo</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {/* Preview */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0 mx-auto sm:mx-0">
            {form.logoUrl
              ? <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
              : <ImageIcon size={28} className="text-gray-300" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-gray-600 mb-3">Upload your logo. Recommended: PNG, transparent background, 200×200px+.</p>
            <div className="flex gap-3 flex-wrap items-center">
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-amber-300 text-sm text-gray-500 hover:text-amber-500 transition-all">
                {logoUploading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Upload size={14} /> {form.logoUrl ? "Replace Logo" : "Upload Logo"}</>}
              </button>
              {form.logoUrl && (
                <>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Auto-saved
                  </div>
                  <button type="button" onClick={() => { setForm((f: any) => ({ ...f, logoUrl: "" })); autoSaveField("logoUrl", ""); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-50 transition-colors">
                    <X size={13} /> Remove
                  </button>
                </>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setForm((f: any) => ({ ...f, showNameWithLogo: !f.showNameWithLogo }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.showNameWithLogo ? "bg-green-500" : "bg-gray-200"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.showNameWithLogo ? "translate-x-4" : "translate-x-1"}`} />
              </button>
              <span className="text-xs sm:text-sm text-gray-600">Show business name alongside logo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map(section => (
          <div key={section.title} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5">
              <section.icon size={18} className="text-amber-400" />
              <h2 className="font-bold text-gray-900 text-sm sm:text-base">{section.title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {section.fields.map(f => {
                const isTextarea = ["aboutStory","aboutMission","heroSubtitle","whatsappMessage","termsConditions","whatsappOrderTemplate"].includes(f.key);
                return (
                  <div key={f.key} className={isTextarea ? "sm:col-span-2" : ""}>
                    <label className="text-xs text-gray-400 block mb-1.5">{f.label}</label>
                    {isTextarea ? (
                      <>
                        <textarea value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)} rows={f.key === "whatsappOrderTemplate" ? 6 : 3} placeholder={f.placeholder} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-none" />
                        {f.key === "whatsappOrderTemplate" && (
                          <p className="text-[10px] text-gray-400 mt-1.5">Available placeholders: <span className="font-mono text-amber-500">{"{customerName}"}</span> · <span className="font-mono text-amber-500">{"{orderNumber}"}</span> · <span className="font-mono text-amber-500">{"{trackingLink}"}</span></p>
                        )}
                      </>
                    ) : (
                      <input value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                    )}
                  </div>
                );
              })}
              {section.title === "Business Identity" && (
                <div className="sm:col-span-2 flex items-center gap-3 pt-1 border-t border-gray-100">
                  <button type="button" onClick={() => setForm((f: any) => ({ ...f, taglineEnabled: !f.taglineEnabled }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${form.taglineEnabled ? "bg-green-500" : "bg-gray-200"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.taglineEnabled ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                  <span className="text-xs sm:text-sm text-gray-600">Show tagline in navigation bar</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Bank Details */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <BankDetailsManager banks={banks} onChange={setBanks} />
        </div>

        {/* Payment Options — QR & Button */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <QrCode size={18} className="text-emerald-500" />
            <h2 className="font-bold text-gray-900">Payment Options</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Add a QR code for quick scanning (e.g. FriMo, mCash) and/or a payment button that links to an online payment page. Both appear in the homepage payment section.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* QR Code */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">QR Code Image</div>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                  {form.paymentQrUrl
                    ? <img src={form.paymentQrUrl} alt="QR" className="w-full h-full object-contain p-1" />
                    : <QrCode size={28} className="text-gray-300" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">Upload your payment QR code (FriMo, mCash, Dialog Pay, etc). Customers can scan this on the homepage to pay instantly.</p>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => qrInputRef.current?.click()} disabled={qrUploading}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-sm text-gray-500 hover:text-emerald-600 transition-all w-fit">
                      {qrUploading ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Upload size={13} /> {form.paymentQrUrl ? "Replace QR" : "Upload QR"}</>}
                    </button>
                    {form.paymentQrUrl && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                        <CheckCircle2 size={12} className="text-emerald-500" /> Auto-saved — visible on website
                      </div>
                    )}
                    {form.paymentQrUrl && (
                      <button type="button" onClick={() => { setForm((f: any) => ({ ...f, paymentQrUrl: "" })); autoSaveField("paymentQrUrl", ""); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-50 transition-colors w-fit">
                        <X size={11} /> Remove QR
                      </button>
                    )}
                  </div>
                  <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                </div>
              </div>
            </div>

            {/* Payment Button */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Button</div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">Add a button that links customers to an online payment portal, checkout, or external payment page.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold block mb-1">Button Label</label>
                  <input
                    value={form.paymentButtonLabel || ""}
                    onChange={e => set("paymentButtonLabel", e.target.value)}
                    onBlur={() => autoSaveField("paymentButtonLabel", form.paymentButtonLabel || "")}
                    placeholder="Pay Online"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold block mb-1 flex items-center gap-1">
                    <Link size={10} /> Payment Link URL
                  </label>
                  <input
                    value={form.paymentButtonUrl || ""}
                    onChange={e => set("paymentButtonUrl", e.target.value)}
                    onBlur={() => autoSaveField("paymentButtonUrl", form.paymentButtonUrl || "")}
                    placeholder="https://pay.example.com/your-business"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                {form.paymentButtonUrl && (
                  <a href={form.paymentButtonUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
                    <ExternalLink size={11} /> Test link
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Pay Now Button Visibility Toggle */}
          <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-800">Show Pay Now button on homepage</div>
              <div className="text-xs text-gray-400 mt-0.5">When turned off, the Pay Now button is hidden from the homepage payment section. Bank details and QR code remain visible.</div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const next = !form.payButtonVisible;
                setForm((f: any) => ({ ...f, payButtonVisible: next }));
                await autoSaveField("payButtonVisible", next as any);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.payButtonVisible ? "bg-emerald-500" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.payButtonVisible ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {/* Save Payment Settings button */}
          <div className="mt-4 flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={savePaymentSettings}
              disabled={paymentSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-60"
            >
              {paymentSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {paymentSaving ? "Saving…" : "Save Payment Settings"}
            </button>
            {paymentSaved && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 size={12} /> Saved — now visible on website
              </div>
            )}
          </div>
        </div>

        {/* Customer Checkout Payment Rules */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={18} className="text-violet-500" />
            <h2 className="font-bold text-gray-900">Store Checkout Payment Rules</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Bank-transfer and delivery defaults are managed here. Cash on Delivery and full-payment offers are configured per product in the Products editor.
          </p>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Direct Bank Transfer</div>
                  <div className="text-xs text-slate-500 mt-0.5">Show bank details and require a deposit before the order is confirmed.</div>
                </div>
                <button type="button" onClick={() => setForm((f: any) => ({ ...f, checkoutBankTransferEnabled: !f.checkoutBankTransferEnabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.checkoutBankTransferEnabled ? "bg-violet-500" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.checkoutBankTransferEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {form.checkoutBankTransferEnabled && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Deposit amount (LKR)</label>
                    <input type="number" min="0" value={form.checkoutDepositAmount || ""} onChange={e => setForm((f: any) => ({ ...f, checkoutDepositAmount: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Customer deposit message</label>
                    <input value={form.checkoutDepositMessage || ""} onChange={e => setForm((f: any) => ({ ...f, checkoutDepositMessage: e.target.value }))} placeholder="A Rs. 500 deposit is required..." className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="text-sm font-semibold text-slate-800">Product-level payment controls</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Full-payment offers and Cash on Delivery are now configured individually inside <strong>Admin → Products → Edit product → Checkout Payment Options</strong>. This keeps payment availability accurate when customers have different products in the same cart.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={saveCheckoutSettings} disabled={paymentSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-sm font-semibold hover:bg-violet-100 transition-colors disabled:opacity-60">
              {paymentSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {paymentSaving ? "Saving…" : "Save Checkout Rules"}
            </button>
            {paymentSaved && <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle2 size={12} /> Saved — checkout updated</div>}
          </div>
        </div>

        {/* Checkout Delivery Options */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={18} className="text-amber-500" />
            <h2 className="font-bold text-gray-900">Store Checkout Delivery Options</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Choose which delivery methods customers can select at checkout and set the customer-facing copy and charge.
          </p>

          <div className="space-y-4">
            {[
              {
                key: "checkoutCourierEnabled",
                labelKey: "checkoutCourierLabel",
                descKey: "checkoutCourierDescription",
                chargeKey: "courierCharge",
                title: "Studio Courier",
                fallbackLabel: "Studio courier",
                fallbackDesc: "Carefully packed and delivered to your door.",
              },
              {
                key: "checkoutSlPostEnabled",
                labelKey: "checkoutSlPostLabel",
                descKey: "checkoutSlPostDescription",
                chargeKey: "slPostCharge",
                title: "Sri Lanka Post",
                fallbackLabel: "Sri Lanka Post",
                fallbackDesc: "A considered island-wide delivery route.",
              },
            ].map((option: any) => (
              <div key={option.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{option.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Show this delivery method during checkout.</div>
                  </div>
                  <button type="button" onClick={() => setForm((f: any) => ({ ...f, [option.key]: !f[option.key] }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form[option.key] ? "bg-amber-500" : "bg-slate-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form[option.key] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                {form[option.key] && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-1">Charge (LKR)</label>
                      <input type="number" min="0" value={form[option.chargeKey] || ""} onChange={e => setForm((f: any) => ({ ...f, [option.chargeKey]: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-1">Customer-facing name</label>
                        <input value={form[option.labelKey] || option.fallbackLabel} onChange={e => setForm((f: any) => ({ ...f, [option.labelKey]: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-1">Description</label>
                        <input value={form[option.descKey] || option.fallbackDesc} onChange={e => setForm((f: any) => ({ ...f, [option.descKey]: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Studio Pickup</div>
                  <div className="text-xs text-slate-500 mt-0.5">Offer collection from your studio without a delivery charge.</div>
                </div>
                <button type="button" onClick={() => setForm((f: any) => ({ ...f, checkoutPickupEnabled: !f.checkoutPickupEnabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.checkoutPickupEnabled ? "bg-amber-500" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.checkoutPickupEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {form.checkoutPickupEnabled && (
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <input value={form.checkoutPickupLabel || "Studio pickup"} onChange={e => setForm((f: any) => ({ ...f, checkoutPickupLabel: e.target.value }))} placeholder="Customer-facing name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                  <input value={form.checkoutPickupDescription || "Collect your order from the HAVESTORY studio."} onChange={e => setForm((f: any) => ({ ...f, checkoutPickupDescription: e.target.value }))} placeholder="Short description" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                  <input value={form.checkoutPickupAddress || "Contact us for pickup details."} onChange={e => setForm((f: any) => ({ ...f, checkoutPickupAddress: e.target.value }))} placeholder="Pickup address or instructions" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={saveCheckoutSettings} disabled={paymentSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-60">
              {paymentSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {paymentSaving ? "Saving…" : "Save Delivery Options"}
            </button>
            {paymentSaved && <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"><CheckCircle2 size={12} /> Saved — checkout updated</div>}
          </div>
        </div>

        {/* iPay Online Payment Gateway */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={18} className="text-amber-500" />
            <h2 className="font-bold text-gray-900">iPay Online Payment Gateway</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Connect iPay to accept card payments, Lanka QR, and iPay wallet. Customers can pay invoices online — invoices auto-update to "Paid" when payment is confirmed.
          </p>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-5">
            <div>
              <div className="text-sm font-semibold text-gray-800">Enable iPay Payments</div>
              <div className="text-xs text-gray-400 mt-0.5">Show "Pay Online" button on invoices</div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f: any) => ({ ...f, ipayEnabled: !f.ipayEnabled }))}
              className="flex items-center gap-2 transition-colors"
            >
              {form.ipayEnabled
                ? <ToggleRight size={36} className="text-amber-500" />
                : <ToggleLeft size={36} className="text-gray-300" />}
            </button>
          </div>

          {/* Mode toggle */}
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mode</div>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit">
              <button
                type="button"
                onClick={() => setForm((f: any) => ({ ...f, ipaySandbox: true }))}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${form.ipaySandbox ? "bg-amber-100 text-amber-700" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                🧪 Sandbox (Testing)
              </button>
              <button
                type="button"
                onClick={() => setForm((f: any) => ({ ...f, ipaySandbox: false }))}
                className={`px-4 py-2 text-sm font-semibold border-l border-gray-200 transition-colors ${!form.ipaySandbox ? "bg-green-100 text-green-700" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                ✅ Live
              </button>
            </div>
            {form.ipaySandbox && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle size={11} /> Sandbox mode — no real payments processed. Switch to Live when ready.
              </p>
            )}
            {!form.ipaySandbox && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Check size={11} /> Live mode — real payments will be processed.
              </p>
            )}
          </div>

          {/* Token & Secret inputs */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-400 font-semibold block mb-1">Merchant Web Token</label>
              <div className="relative">
                <input
                  type={showIpayToken ? "text" : "password"}
                  value={form.ipayToken || ""}
                  onChange={e => setForm((f: any) => ({ ...f, ipayToken: e.target.value }))}
                  placeholder="Paste your iPay merchantWebToken here"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 font-mono"
                />
                <button type="button" onClick={() => setShowIpayToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showIpayToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Get this from iPay portal → Developer Portal → Payment Integration → IPG Payments → Generate Token</p>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold block mb-1">Secret Key</label>
              <div className="relative">
                <input
                  type={showIpaySecret ? "text" : "password"}
                  value={form.ipaySecret || ""}
                  onChange={e => setForm((f: any) => ({ ...f, ipaySecret: e.target.value }))}
                  placeholder="Enter your iPay secret (the one you set in the portal)"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 font-mono"
                />
                <button type="button" onClick={() => setShowIpaySecret(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showIpaySecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">This is the secret you chose when setting up iPay — used to verify payments are genuine.</p>
            </div>
          </div>

          {/* Status indicator */}
          {form.ipayToken && form.ipaySecret && (
            <div className={`flex items-center gap-2 mt-4 px-3 py-2 rounded-xl text-xs font-medium ${form.ipayEnabled ? "bg-green-50 border border-green-200 text-green-700" : "bg-gray-50 border border-gray-200 text-gray-500"}`}>
              <div className={`w-2 h-2 rounded-full ${form.ipayEnabled ? "bg-green-500" : "bg-gray-400"}`} />
              {form.ipayEnabled
                ? `iPay is active in ${form.ipaySandbox ? "sandbox (testing)" : "live"} mode`
                : "iPay is configured but currently disabled"}
            </div>
          )}

          {/* Save button */}
          <div className="mt-5 flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={saveIpaySettings}
              disabled={ipaySaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-60"
            >
              {ipaySaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {ipaySaving ? "Saving…" : "Save iPay Settings"}
            </button>
            {ipaySaved && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <CheckCircle2 size={12} /> Saved successfully
              </div>
            )}
          </div>
        </div>

        {/* Google Pay (manual confirmation) */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 via-green-500 to-yellow-400 flex items-center justify-center text-white font-black text-xs shadow-sm">G</div>
            <h2 className="font-bold text-gray-900">Google Pay</h2>
            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-[10px] font-semibold uppercase tracking-wider">Manual confirmation</span>
          </div>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Show <strong>Google Pay</strong> as a checkout option. Customers see your Google Pay number (and optional QR), pay from their app, then send you the payment screenshot for confirmation. No gateway/API fees — money goes straight to your bank-linked Google Pay account.
            <br />
            <span className="text-amber-600">Note: Google Pay is not officially launched in Sri Lanka — enable this only if your customers can use Google Pay (e.g. Indian/international customers, or any wallet that scans the same QR).</span>
          </p>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-5">
            <div>
              <div className="text-sm font-semibold text-gray-800">Enable Google Pay option at checkout</div>
              <div className="text-xs text-gray-400 mt-0.5">Adds a "Google Pay" choice in the cart payment-method list</div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f: any) => ({ ...f, googlePayEnabled: !f.googlePayEnabled }))}
              className="flex items-center gap-2 transition-colors"
            >
              {form.googlePayEnabled
                ? <ToggleRight size={36} className="text-amber-500" />
                : <ToggleLeft size={36} className="text-gray-300" />}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-1 flex items-center gap-1">
                  <Phone size={10} /> Google Pay Number / UPI ID
                </label>
                <input
                  value={form.googlePayNumber || ""}
                  onChange={e => setForm((f: any) => ({ ...f, googlePayNumber: e.target.value }))}
                  onBlur={() => autoSaveField("googlePayNumber", form.googlePayNumber || "")}
                  placeholder="+94 77 123 4567  or  yourname@okhdfcbank"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                />
                <p className="text-[11px] text-gray-400 mt-1">Shown to customers so they can send the payment to you.</p>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-1">Instructions for customer (optional)</label>
                <textarea
                  rows={4}
                  value={form.googlePayInstructions || ""}
                  onChange={e => setForm((f: any) => ({ ...f, googlePayInstructions: e.target.value }))}
                  onBlur={() => autoSaveField("googlePayInstructions", form.googlePayInstructions || "")}
                  placeholder="e.g. After paying, please WhatsApp us the screenshot to confirm your order."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold block mb-1 flex items-center gap-1">
                <QrCode size={10} /> Google Pay QR Code (optional)
              </label>
              <div className="flex items-start gap-3">
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {form.googlePayQrUrl
                    ? <img src={form.googlePayQrUrl} alt="Google Pay QR" className="w-full h-full object-contain p-1" />
                    : <QrCode size={28} className="text-gray-300" />}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => gpayQrInputRef.current?.click()}
                    disabled={gpayQrUploading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60 w-fit"
                  >
                    {gpayQrUploading ? <><Loader2 size={13} className="animate-spin" /> Uploading…</> : <><Upload size={13} /> {form.googlePayQrUrl ? "Replace QR" : "Upload QR"}</>}
                  </button>
                  {form.googlePayQrUrl && (
                    <a href={form.googlePayQrUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline w-fit">
                      <ExternalLink size={10} /> Open QR
                    </a>
                  )}
                  {form.googlePayQrUrl && (
                    <button type="button" onClick={() => { setForm((f: any) => ({ ...f, googlePayQrUrl: "" })); autoSaveField("googlePayQrUrl", ""); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-50 transition-colors w-fit">
                      <X size={11} /> Remove QR
                    </button>
                  )}
                </div>
                <input ref={gpayQrInputRef} type="file" accept="image/*" className="hidden" onChange={handleGpayQrUpload} />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Tip: take a screenshot of your Google Pay "Receive Money" QR and upload it here so customers can scan it.</p>
            </div>
          </div>

          {/* Save button */}
          <div className="mt-6 flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={saveGooglePaySettings}
              disabled={gpaySaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 via-green-500 to-yellow-400 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
            >
              {gpaySaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {gpaySaving ? "Saving…" : "Save Google Pay Settings"}
            </button>
            {gpaySaved && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <CheckCircle2 size={12} /> Saved — visible at checkout
              </div>
            )}
            {form.googlePayEnabled && !form.googlePayNumber && !form.googlePayQrUrl && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                <AlertTriangle size={12} /> Add a number or QR before customers can pay
              </div>
            )}
          </div>
        </div>

        {/* Courier Services */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <CourierServicesManager couriers={couriers} onChange={setCouriers} />
        </div>

        {/* Storage Cleanup */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={18} className="text-rose-400" />
            <h2 className="font-bold text-gray-900">Storage Cleanup</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Remove customer-uploaded files (design attachments, payment proofs, delivery files) from orders older than 3 months. The order records are kept — only the uploaded files are deleted from cloud storage.</p>

          {cleanupResult && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4 border ${cleanupResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
              {cleanupResult.success ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
              <span>{cleanupResult.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleanupRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100 disabled:opacity-60 transition-colors"
          >
            {cleanupRunning ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
            {cleanupRunning ? "Cleaning up..." : "Run Storage Cleanup"}
          </button>

          <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Deleted files cannot be recovered. Only files from orders older than 3 months will be removed.</p>
          </div>
        </div>

        {/* Data Management — Soft-delete / Trash */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <Archive size={18} className="text-red-400" />
            <h2 className="font-bold text-gray-900">Data Management</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">Clear data by section. Items are moved to trash and can be recovered within 30 days. After 30 days, trashed items are permanently deleted.</p>

          {trashResult && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4 border ${trashResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
              {trashResult.success ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
              <span>{trashResult.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {TRASH_SECTIONS.map(({ key, label, icon: SectionIcon }) => (
              <div key={key} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <SectionIcon size={13} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-bold text-gray-800 truncate">{label}</span>
                  </div>
                  {(trashCounts[key] ?? 0) > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full shrink-0">
                      {trashCounts[key]} in trash
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleTrashSection(key)}
                  disabled={trashLoading === key}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-60 transition-colors w-full justify-center"
                >
                  {trashLoading === key ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {trashLoading === key ? "Clearing..." : `Clear All ${label}`}
                </button>
              </div>
            ))}
          </div>

          {/* Trash Recovery */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-2">
              <ArchiveRestore size={16} className="text-green-500" />
              <h3 className="font-bold text-gray-800 text-sm">Trash Recovery</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">Restore trashed items back to their original state within 30 days.</p>

            {restoreResult && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4 border ${restoreResult.success ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                {restoreResult.success ? <Check size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
                <span>{restoreResult.message}</span>
              </div>
            )}

            {Object.values(trashCounts).every(c => c === 0) ? (
              <div className="border border-dashed border-gray-200 rounded-xl py-5 text-center text-xs text-gray-400">
                Trash is empty. No items to restore.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TRASH_SECTIONS.filter(({ key }) => (trashCounts[key] ?? 0) > 0).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleRestoreSection(key)}
                    disabled={restoreLoading === key}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 disabled:opacity-60 transition-colors"
                  >
                    {restoreLoading === key ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
                    {restoreLoading === key ? "Restoring..." : `Restore ${trashCounts[key]} ${label}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Items in trash are automatically and permanently deleted after 30 days. Restore them before the 30-day window expires.</p>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Download size={18} className="text-indigo-400" />
            <h2 className="font-bold text-gray-900">Backup & Restore</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">Export all your settings as a JSON file for safekeeping. Use the same file to restore everything in an emergency.</p>

          {restoreSuccess && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium mb-4">
              <Check size={15} /> Settings restored successfully! The page will reflect the updated values shortly.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={backupExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-60 transition-colors"
            >
              {backupExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {backupExporting ? "Exporting..." : "Export Settings Backup"}
            </button>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleRestoreBackup}
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              disabled={backupRestoring}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 disabled:opacity-60 transition-colors"
            >
              {backupRestoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              {backupRestoring ? "Restoring..." : "Restore from Backup"}
            </button>
          </div>

          <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Restoring from a backup will overwrite all current settings. This cannot be undone. Always keep a recent backup before making major changes.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button disabled={isPending} onClick={handleSave} className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-stone-600 text-white text-sm font-bold shadow-sm disabled:opacity-60">
          <Save size={14} /> {isPending ? "Saving..." : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}
