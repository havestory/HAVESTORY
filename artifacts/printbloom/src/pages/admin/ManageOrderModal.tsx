import { useState, useRef } from "react";
import { useListInvoices, useUpdateInvoice, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X, Check, Download, ExternalLink, Upload, Truck, FileText,
  Wifi, Package, Link, Trash2, Copy, ChevronUp, ChevronDown,
  User, ClipboardList, Receipt, Shield, FolderOpen, Pencil,
  Plus, Search, Eye,
} from "lucide-react";
import { InvoiceFormModal } from "@/components/InvoiceFormModal";
import { InvoicePreview } from "@/components/InvoicePreview";
import { parseInvoiceMeta, num, calcShipping } from "@/lib/invoiceTypes";

/* ────────── helpers ────────── */
function rs(v: any) { return `Rs. ${Number(v || 0).toLocaleString("en-IN")}`; }

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "completed", "cancelled", "reviewing", "ready", "submitted"];

/* ────────── CopyChip ────────── */
export function CopyChip({ label, value, tooltip, isLink }: { label: string; value: string; tooltip: string; isLink?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button type="button" onClick={copy} title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${copied ? "border-green-300 bg-green-50 text-green-700" : isLink ? "border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-400" : "border-pink-200 bg-pink-50 text-pink-600 hover:border-pink-400"}`}>
      {copied ? <Check size={11} className="text-green-500" /> : isLink ? <ExternalLink size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

/* ────────── AccordionSection ────────── */
export function AccordionSection({ icon: Icon, title, children, defaultOpen = true, accent = "pink" }: {
  icon: React.ElementType; title: string; children: React.ReactNode; defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentMap: Record<string, string> = {
    pink: "text-pink-500 bg-pink-50", purple: "text-purple-500 bg-purple-50",
    blue: "text-blue-500 bg-blue-50", orange: "text-orange-500 bg-orange-50",
    green: "text-green-500 bg-green-50", gray: "text-gray-500 bg-gray-100",
  };
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50/60 hover:bg-gray-100/60 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accentMap[accent] || accentMap.pink}`}><Icon size={14} /></div>
          <span className="text-sm font-bold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

/* ────────── ProofFileSection ────────── */
function ProofFileSection({ orderId, existingUrl, existingName, onUploaded }: {
  orderId: string; existingUrl?: string | null; existingName?: string | null;
  onUploaded: (url: string, name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`/api/orders/${orderId}/proof-file`, { method: "POST", credentials: "include", body: fd });
      if (res.ok) { const d = await res.json(); onUploaded(d.url, d.filename || file.name); }
    } finally { setUploading(false); }
  };
  return (
    <div>
      <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">ADMIN PROOF / DESIGN FILE</label>
      {existingUrl ? (
        <div className="flex items-center justify-between bg-pink-50 border border-pink-100 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0"><FileText size={14} className="text-pink-500 shrink-0" /><span className="text-xs text-gray-700 truncate">{existingName || "Proof file"}</span></div>
          <div className="flex gap-1.5 shrink-0 ml-2">
            <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-pink-100 rounded-lg text-pink-600"><ExternalLink size={12} /></a>
            <a href={existingUrl} download className="p-1.5 hover:bg-pink-100 rounded-lg text-pink-600"><Download size={12} /></a>
            <button type="button" onClick={() => fileRef.current?.click()} className="p-1.5 hover:bg-pink-100 rounded-lg text-pink-600"><Upload size={12} /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 text-xs font-semibold text-gray-400 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50/50 transition-all">
          <Upload size={14} /> {uploading ? "Uploading..." : "Upload Proof / Design File"}
        </button>
      )}
      <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

/* ────────── PhysicalDeliverySection ────────── */
const MANUAL_KEY = "__manual__";

function PhysicalDeliverySection({ courierServices, courierName, onCourierChange, trackingNumber, onTrackingChange }: {
  courierServices: { name: string; trackingUrl: string }[];
  courierName: string; onCourierChange: (v: string) => void;
  trackingNumber: string; onTrackingChange: (v: string) => void;
}) {
  // Determine if current value matches one of the saved couriers
  const isKnown = courierServices.some(c => c.name === courierName);
  const [dropdownVal, setDropdownVal] = useState<string>(
    courierName && !isKnown ? MANUAL_KEY : (courierName || "")
  );
  const [manualVal, setManualVal] = useState<string>(
    courierName && !isKnown ? courierName : ""
  );

  const selectedService = courierServices.find(c => c.name === courierName);
  const canTrack = selectedService && trackingNumber;
  const [trackCopied, setTrackCopied] = useState(false);
  const inp = "w-full border border-orange-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 bg-white placeholder:text-gray-400";

  const handleTrackClick = () => {
    if (!selectedService) return;
    window.open(selectedService.trackingUrl, "_blank", "noopener,noreferrer");
    if (trackingNumber) {
      navigator.clipboard.writeText(trackingNumber).then(() => {
        setTrackCopied(true);
        setTimeout(() => setTrackCopied(false), 2500);
      }).catch(() => {});
    }
  };

  const handleDropdownChange = (val: string) => {
    setDropdownVal(val);
    if (val === MANUAL_KEY) {
      onCourierChange(manualVal);
    } else {
      setManualVal("");
      onCourierChange(val);
    }
  };

  const handleManualChange = (val: string) => {
    setManualVal(val);
    onCourierChange(val);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-1.5">COURIER SERVICE</label>
        {courierServices.length > 0 ? (
          <>
            <select value={dropdownVal} onChange={e => handleDropdownChange(e.target.value)} className={inp}>
              <option value="">Select courier...</option>
              {courierServices.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              <option value={MANUAL_KEY}>Other / Type manually...</option>
            </select>
            {dropdownVal === MANUAL_KEY && (
              <input
                value={manualVal}
                onChange={e => handleManualChange(e.target.value)}
                placeholder="Type courier name..."
                className={`${inp} mt-2`}
                autoFocus
              />
            )}
          </>
        ) : (
          <input value={courierName} onChange={e => onCourierChange(e.target.value)} placeholder="Courier name (e.g. DHL)" className={inp} />
        )}
      </div>
      <div>
        <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-1.5">TRACKING NUMBER</label>
        <input value={trackingNumber} onChange={e => onTrackingChange(e.target.value)} placeholder="e.g. SL123456789LK" className={inp} />
      </div>
      {canTrack && (
        <button
          type="button"
          onClick={handleTrackClick}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-colors"
        >
          {trackCopied ? (
            <><Check size={13} className="text-green-600" /><span className="text-green-700">Tracking ID copied — paste it on the website</span></>
          ) : (
            <><ExternalLink size={13} /> Open {courierName} &amp; copy tracking ID</>
          )}
        </button>
      )}
    </div>
  );
}

/* ────────── OnlineDeliverySection ────────── */
function OnlineDeliverySection({ orderId, files, links, onFilesChanged, onLinksChanged }: {
  orderId: string;
  files: { url: string; name: string }[];
  links: string[];
  onFilesChanged: (f: { url: string; name: string }[]) => void;
  onLinksChanged: (l: string[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newLink, setNewLink] = useState("");

  const handleFiles = async (fl: FileList) => {
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(fl).forEach(f => fd.append("files", f));
      const res = await fetch(`/api/orders/${orderId}/online-files`, { method: "POST", credentials: "include", body: fd });
      if (res.ok) { const d = await res.json(); onFilesChanged([...files, ...d.files]); }
    } finally { setUploading(false); }
  };

  const removeFile = async (url: string) => {
    const filename = url.split("/").pop();
    if (!filename) return;
    await fetch(`/api/orders/${orderId}/online-files/${encodeURIComponent(filename)}`, { method: "DELETE", credentials: "include" });
    onFilesChanged(files.filter(f => f.url !== url));
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    onLinksChanged([...links, newLink.trim()]);
    setNewLink("");
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">DELIVERY FILES</label>
        {files.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0"><FileText size={13} className="text-purple-500 shrink-0" /><span className="text-xs text-gray-700 truncate">{f.name}</span></div>
                <div className="flex gap-1.5 shrink-0 ml-2">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-purple-100 rounded text-purple-600"><ExternalLink size={11} /></a>
                  <a href={f.url} download className="p-1 hover:bg-purple-100 rounded text-purple-600"><Download size={11} /></a>
                  <button type="button" onClick={() => removeFile(f.url)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-purple-200 rounded-xl py-3.5 flex items-center justify-center gap-2 text-xs font-semibold text-purple-400 hover:border-purple-400 hover:bg-purple-50/50 transition-all">
          <Upload size={13} /> {uploading ? "Uploading..." : "Upload Files"}
        </button>
        <input ref={fileRef} type="file" className="hidden" multiple onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      <div>
        <label className="text-[10px] text-gray-400 font-bold tracking-widest block mb-2">SHARE LINKS</label>
        {links.filter(Boolean).map((l, i) => (
          <div key={i} className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2"><Link size={11} className="text-blue-500 shrink-0" /><span className="text-xs text-blue-700 truncate flex-1">{l}</span></div>
            <button type="button" onClick={() => onLinksChanged(links.filter((_, j) => j !== i))} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={newLink} onChange={e => setNewLink(e.target.value)} onKeyDown={e => e.key === "Enter" && addLink()} placeholder="https://drive.google.com/..." className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-400 placeholder:text-gray-400" />
          <button type="button" onClick={addLink} className="px-3 py-2 bg-purple-100 hover:bg-purple-200 rounded-xl text-purple-700 text-xs font-bold transition-colors">Add</button>
        </div>
      </div>
    </div>
  );
}

/* ────────── Main Modal ────────── */
export interface ManageOrderModalProps {
  order: any;
  courierServices: { name: string; trackingUrl: string }[];
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  isPending: boolean;
  saved: boolean;
}

export function ManageOrderModal({ order, courierServices, onClose, onSave, isPending, saved }: ManageOrderModalProps) {
  const { data: invoices } = useListInvoices();

  const [pendingStatus, setPendingStatus] = useState(order.status || "pending");
  const [adminNotes, setAdminNotes] = useState(order.adminNotes || "");
  const [deliveryMethod, setDeliveryMethod] = useState<"online" | "physical" | "both" | "">(order.deliveryMethod || "");
  const [courierName, setCourierName] = useState(order.courierName || "");
  const [courierTrackingNumber, setCourierTrackingNumber] = useState(order.courierTrackingNumber || "");
  const [onlineDeliveryFiles, setOnlineDeliveryFiles] = useState<{ url: string; name: string }[]>(order.onlineDeliveryFiles || []);
  const [onlineDeliveryLinks, setOnlineDeliveryLinks] = useState<string[]>(order.onlineDeliveryLinks || []);
  const [orderDescription, setOrderDescription] = useState(order.orderDescription || "");
  const [proofFileUrl, setProofFileUrl] = useState<string | null>(order.proofFileUrl || null);
  const [proofFileName, setProofFileName] = useState<string | null>(order.proofFileName || null);

  // Customer-detail edit state (admin can fix typos / fill missing contact info on existing orders)
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerSaved, setCustomerSaved] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [custName, setCustName] = useState(order.customerName || "");
  const [custPhone, setCustPhone] = useState(order.customerPhone || "");
  const [custEmail, setCustEmail] = useState(order.customerEmail || "");
  const [custAddress, setCustAddress] = useState(order.customerAddress || "");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);
  const { data: clientsData } = useListClients();
  const allClients = Array.isArray(clientsData) ? clientsData : [];
  const filteredClients = (() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return allClients.filter(cl =>
      cl.name?.toLowerCase().startsWith(q) ||
      cl.name?.toLowerCase().includes(q) ||
      (digits && (cl.phone || "").replace(/\D/g, "").includes(digits)) ||
      (cl.email || "").toLowerCase().includes(q) ||
      (cl.businessName || "").toLowerCase().includes(q)
    );
  })();

  const cancelCustomerEdit = () => {
    setCustName(order.customerName || "");
    setCustPhone(order.customerPhone || "");
    setCustEmail(order.customerEmail || "");
    setCustAddress(order.customerAddress || "");
    setCustomerError(null);
    setEditingCustomer(false);
    setClientSearch("");
    setShowClientSearch(false);
  };

  const saveCustomer = async () => {
    const trimmedName = custName.trim();
    if (!trimmedName) { setCustomerError("Full name is required."); return; }
    setSavingCustomer(true);
    setCustomerError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderId || order.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: trimmedName,
          customerPhone: custPhone.trim(),
          customerEmail: custEmail.trim(),
          customerAddress: custAddress.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const updated = await res.json();
      // Sync local form to whatever the server returned (handles trimming etc.)
      setCustName(updated.customerName || "");
      setCustPhone(updated.customerPhone || "");
      setCustEmail(updated.customerEmail || "");
      setCustAddress(updated.customerAddress || "");
      // Mutate the parent order object so the read-only view shows fresh values
      // immediately even before the list query refetches.
      order.customerName = updated.customerName;
      order.customerPhone = updated.customerPhone;
      order.customerEmail = updated.customerEmail;
      order.customerAddress = updated.customerAddress;
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setEditingCustomer(false);
      setCustomerSaved(true);
      setTimeout(() => setCustomerSaved(false), 1800);
    } catch (e: any) {
      setCustomerError(e?.message || "Failed to update customer.");
    } finally {
      setSavingCustomer(false);
    }
  };

  // Invoice modal state
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceFormMode, setInvoiceFormMode] = useState<"create" | "edit">("create");
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [viewingInv, setViewingInv] = useState<any>(null);
  const [invStatusEdit, setInvStatusEdit] = useState<number | null>(null);
  const [statusEditVal, setStatusEditVal] = useState("");
  const [statusSaved, setStatusSaved] = useState(false);

  const queryClient = useQueryClient();
  const { mutate: updateInvoice, isPending: invPending } = useUpdateInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        setInvStatusEdit(null);
        setStatusSaved(true);
        setTimeout(() => setStatusSaved(false), 1500);
      }
    }
  });

  const trackUrl = `${window.location.origin}/track-order?id=${order.orderId}`;

  const handleSave = () => {
    onSave({
      status: pendingStatus,
      adminNotes: adminNotes || undefined,
      deliveryMethod: deliveryMethod || undefined,
      courierName: (deliveryMethod === "physical" || deliveryMethod === "both") ? courierName || undefined : undefined,
      courierTrackingNumber: (deliveryMethod === "physical" || deliveryMethod === "both") ? courierTrackingNumber || undefined : undefined,
      onlineDeliveryLinks: (deliveryMethod === "online" || deliveryMethod === "both") ? onlineDeliveryLinks : undefined,
      orderDescription: orderDescription || undefined,
    });
  };

  // Robust invoice lookup: match by string orderId OR by numeric order id stored as string
  const inv = (invoices ?? []).find((i: any) =>
    (order.orderId && i.orderId && i.orderId.trim() === order.orderId.trim()) ||
    i.orderId === String(order.id)
  );

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "calc(100vh - 48px)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="min-w-0">
              <h2 className="font-bold text-base text-gray-900">Manage Order</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {/* Order ID chip */}
                <CopyChip label={order.orderId} value={order.orderId} tooltip="Copy Order ID" />
                {/* Copy track link */}
                <CopyChip label="Copy Track Link" value={trackUrl} tooltip="Copy tracking URL" isLink />
                {/* Track Order button — opens in new tab */}
                <a
                  href={trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:border-green-400 hover:bg-green-100 transition-all"
                >
                  <ExternalLink size={11} /> Track Order
                </a>
              </div>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 ml-3 p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-4 pb-2 space-y-2.5 flex-1">
            <div className="h-2" />

            {/* PROJECT STATUS */}
            <AccordionSection icon={ClipboardList} title="Project Status" accent="pink">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => setPendingStatus(s)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border capitalize transition-all ${pendingStatus === s ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-sm" : "border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600 bg-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </AccordionSection>

            {/* CUSTOMER DETAILS */}
            <AccordionSection icon={User} title="Customer Details" accent="blue">
              {!editingCustomer ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">FULL NAME</label>
                      <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800">{order.customerName}</div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">PHONE</label>
                      <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800">{order.customerPhone || "—"}</div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">EMAIL</label>
                      <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 truncate">{order.customerEmail || "—"}</div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">ADDRESS</label>
                      <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800">{order.customerAddress || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    {customerSaved ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
                        <Check size={12} /> Customer details updated
                      </span>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => { setCustomerError(null); setEditingCustomer(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:border-blue-400 hover:bg-blue-100 transition-all"
                    >
                      <Pencil size={11} /> Edit customer details
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Client search */}
                  {showClientSearch ? (
                    <div className="mb-3 relative">
                      <div className="flex items-center gap-2 px-3 py-2 border border-blue-300 rounded-xl bg-blue-50 focus-within:border-blue-500">
                        <Search size={14} className="text-blue-400 shrink-0" />
                        <input
                          autoFocus
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          placeholder="Search by name, phone or email..."
                          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
                        />
                        <button type="button" onClick={() => { setShowClientSearch(false); setClientSearch(""); }} className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                      {filteredClients.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {filteredClients.map(cl => (
                            <button
                              key={cl.id}
                              type="button"
                              onClick={() => {
                                setCustName(cl.name || "");
                                setCustPhone(cl.phone || "");
                                setCustEmail(cl.email || "");
                                setCustAddress(cl.address || "");
                                setClientSearch("");
                                setShowClientSearch(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                            >
                              <div className="text-sm font-semibold text-gray-800">{cl.name}{cl.businessName ? <span className="ml-1.5 text-xs font-normal text-gray-500">({cl.businessName})</span> : null}</div>
                              <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                                {cl.phone && <span>{cl.phone}</span>}
                                {cl.email && <span>{cl.email}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {clientSearch.trim().length > 0 && filteredClients.length === 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                          No clients found
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => setShowClientSearch(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 hover:border-blue-400 transition-all"
                      >
                        <Search size={11} /> Search existing client
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">FULL NAME *</label>
                      <input
                        value={custName}
                        onChange={e => setCustName(e.target.value)}
                        placeholder="e.g. Mr. Saman Perera"
                        className="w-full px-3.5 py-2.5 border border-blue-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">PHONE</label>
                      <input
                        value={custPhone}
                        onChange={e => setCustPhone(e.target.value)}
                        inputMode="tel"
                        placeholder="077 123 4567"
                        className="w-full px-3.5 py-2.5 border border-blue-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">EMAIL</label>
                      <input
                        value={custEmail}
                        onChange={e => setCustEmail(e.target.value)}
                        inputMode="email"
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 border border-blue-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-400 font-semibold block mb-1">ADDRESS</label>
                      <textarea
                        value={custAddress}
                        onChange={e => setCustAddress(e.target.value)}
                        rows={2}
                        placeholder="Delivery address (optional)"
                        className="w-full px-3.5 py-2.5 border border-blue-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400 resize-none"
                      />
                    </div>
                  </div>
                  {customerError && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs font-semibold text-red-600">
                      {customerError}
                    </div>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={cancelCustomerEdit}
                      disabled={savingCustomer}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveCustomer}
                      disabled={savingCustomer}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold shadow-sm hover:shadow disabled:opacity-50 transition-shadow"
                    >
                      {savingCustomer ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </AccordionSection>

            {/* PROJECT DETAILS */}
            <AccordionSection icon={Package} title="Project Details" accent="purple">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold block mb-1">PRODUCT / PRINT TYPE</label>
                  <input
                    value={orderDescription}
                    onChange={e => setOrderDescription(e.target.value)}
                    placeholder="e.g. Event Banners, Business Cards..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400 transition-colors placeholder:text-gray-400"
                  />
                </div>
                {order.items?.length > 0 && (
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold block mb-1">QUOTED PRICE (Rs.)</label>
                    <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900">
                      {rs(order.items.reduce((s: number, it: any) => s + (Number(it.price ?? 0) * (it.quantity ?? 1)), 0))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-gray-400 font-semibold block mb-1">PROJECT NOTES / SPECS</label>
                  <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 min-h-[60px] whitespace-pre-wrap">
                    {order.notes || <span className="text-gray-300">No notes from customer</span>}
                  </div>
                </div>
              </div>
            </AccordionSection>

            {/* DESIGN / REFERENCE FILES */}
            <AccordionSection icon={FolderOpen} title="Design / Reference Files" accent="blue">
              {/* Order-form design links */}
              {order.designLinks?.filter(Boolean).length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <div className="text-[10px] text-gray-400 font-bold tracking-widest mb-1.5">CUSTOMER DESIGN LINKS</div>
                  {order.designLinks.filter(Boolean).map((link: string, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <ExternalLink size={13} className="text-blue-500 shrink-0" />
                        <span className="text-xs text-blue-700 truncate">{link}</span>
                      </div>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 shrink-0 ml-2"><ExternalLink size={12} /></a>
                    </div>
                  ))}
                </div>
              )}

              {/* Customer-uploaded attachments (from Track Order page) */}
              {(() => {
                const attachments: any[] = Array.isArray(order.attachments) ? order.attachments : [];
                const files = attachments.map((a: any) => ({
                  url: typeof a === "string" ? a : a.url,
                  name: typeof a === "string" ? (a.split("/").pop() || a) : (a.name || a.url?.split("/").pop() || "file"),
                })).filter((f: any) => f.url);
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] text-gray-400 font-bold tracking-widest">CUSTOMER-UPLOADED FILES</div>
                      {files.length > 0 && (
                        <span className="text-[10px] text-purple-500 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                          {files.length} file{files.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {files.length > 0 ? (
                      <div className="space-y-1.5">
                        {files.map((f: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText size={13} className="text-purple-500 shrink-0" />
                              <span className="text-xs text-gray-700 truncate font-medium">{f.name}</span>
                            </div>
                            <div className="flex gap-1.5 shrink-0 ml-2">
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600"><ExternalLink size={12} /></a>
                              <a href={f.url} download={f.name} className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600"><Download size={12} /></a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-200 rounded-xl py-4 text-center">
                        <FolderOpen size={20} className="mx-auto text-gray-300 mb-1.5" />
                        <p className="text-xs text-gray-400">No files uploaded by customer yet</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="border-t border-gray-100 pt-3">
                <ProofFileSection
                  orderId={order.orderId}
                  existingUrl={proofFileUrl}
                  existingName={proofFileName}
                  onUploaded={(url, name) => { setProofFileUrl(url); setProofFileName(name); }}
                />
              </div>
            </AccordionSection>

            {/* PAYMENT PROOF */}
            <AccordionSection icon={Receipt} title="Payment Proof" accent="green">
              {order.paymentProofUrl ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-600" />
                    <div>
                      <div className="text-sm font-semibold text-green-800">Payment proof submitted</div>
                      <div className="text-xs text-green-600">Customer uploaded their payment screenshot</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-green-100 rounded-lg text-green-700"><ExternalLink size={13} /></a>
                    <a href={order.paymentProofUrl} download className="p-1.5 hover:bg-green-100 rounded-lg text-green-700"><Download size={13} /></a>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-5 text-center">
                  <Receipt size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">No payment proof yet. Waiting for customer to upload.</p>
                </div>
              )}
            </AccordionSection>

            {/* DELIVERY TYPE — 3 options: Physical, Digital, Both */}
            <AccordionSection icon={Truck} title="Delivery Type" accent="orange">
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setDeliveryMethod("physical")}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-bold text-xs transition-all ${deliveryMethod === "physical" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-400 hover:border-gray-300 bg-white"}`}>
                  <Truck size={16} /> Physical
                </button>
                <button type="button" onClick={() => setDeliveryMethod("online")}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-bold text-xs transition-all ${deliveryMethod === "online" ? "border-purple-400 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-400 hover:border-gray-300 bg-white"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                  Digital
                </button>
                <button type="button" onClick={() => setDeliveryMethod("both")}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-bold text-xs transition-all ${deliveryMethod === "both" ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-400 hover:border-gray-300 bg-white"}`}>
                  <span className="flex gap-0.5"><Truck size={13} /><span>+</span><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg></span>
                  Both
                </button>
              </div>

              {/* Physical sub-section */}
              {(deliveryMethod === "physical" || deliveryMethod === "both") && (
                <div className="mt-3 p-3 bg-orange-50/60 border border-orange-100 rounded-xl">
                  {deliveryMethod === "both" && <div className="text-[10px] text-orange-500 font-bold tracking-widest mb-2">PHYSICAL DELIVERY</div>}
                  <PhysicalDeliverySection
                    courierServices={courierServices}
                    courierName={courierName}
                    onCourierChange={setCourierName}
                    trackingNumber={courierTrackingNumber}
                    onTrackingChange={setCourierTrackingNumber}
                  />
                </div>
              )}

              {/* Online sub-section */}
              {(deliveryMethod === "online" || deliveryMethod === "both") && (
                <div className="mt-3 p-3 bg-purple-50/60 border border-purple-100 rounded-xl">
                  {deliveryMethod === "both" && <div className="text-[10px] text-purple-500 font-bold tracking-widest mb-2">DIGITAL DELIVERY</div>}
                  <OnlineDeliverySection
                    orderId={order.orderId}
                    files={onlineDeliveryFiles}
                    links={onlineDeliveryLinks}
                    onFilesChanged={setOnlineDeliveryFiles}
                    onLinksChanged={setOnlineDeliveryLinks}
                  />
                </div>
              )}
            </AccordionSection>

            {/* ADMIN NOTES */}
            <AccordionSection icon={Shield} title="Admin Notes (Internal)" accent="gray">
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Quote details, internal remarks, client communication..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-400 resize-none placeholder:text-gray-400"
              />
            </AccordionSection>

            {/* INVOICE */}
            <AccordionSection icon={Receipt} title="Invoice" accent="purple">
              {!inv ? (
                /* ── No invoice linked ── */
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 text-center py-1">No invoice linked to this order yet.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button"
                      onClick={() => { setInvoiceFormMode("create"); setShowInvoiceForm(true); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-pink-200 bg-pink-50 hover:bg-pink-100 transition-colors text-pink-700 text-xs font-bold">
                      <Plus size={16} /> Create Invoice
                    </button>
                    <button type="button"
                      onClick={() => { setShowLinkPicker(true); setLinkSearch(""); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-purple-700 text-xs font-bold">
                      <Link size={16} /> Link Existing
                    </button>
                  </div>

                  {/* Link picker */}
                  {showLinkPicker && (() => {
                    const unlinked = (invoices ?? []).filter((i: any) => !i.orderId || i.orderId === "");
                    const results = linkSearch
                      ? (invoices ?? []).filter((i: any) => (i.invoiceNumber || "").toLowerCase().includes(linkSearch.toLowerCase()) || (i.clientName || "").toLowerCase().includes(linkSearch.toLowerCase()))
                      : unlinked;
                    return (
                      <div className="border border-purple-100 rounded-xl p-3 bg-purple-50/30 space-y-2">
                        <div className="text-[10px] text-purple-500 font-bold tracking-widest">LINK EXISTING INVOICE</div>
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                            placeholder="Search by invoice # or client name..."
                            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-300 placeholder:text-gray-400" />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {results.length === 0 && <div className="text-xs text-gray-400 text-center py-3">{linkSearch ? "No invoices found" : "No unlinked invoices"}</div>}
                          {results.map((i: any) => (
                            <button key={i.id} type="button"
                              onClick={() => { updateInvoice({ id: i.id, data: { orderId: order.orderId } as any }); setShowLinkPicker(false); queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }); }}
                              className="w-full flex items-center justify-between px-3 py-2 bg-white border border-purple-100 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-left">
                              <div>
                                <div className="text-xs font-bold text-gray-800">{i.invoiceNumber}</div>
                                <div className="text-[11px] text-gray-500">{i.clientName} · {rs(i.amount)}</div>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${i.status === "paid" ? "bg-green-100 text-green-700" : i.status === "pending" ? "bg-yellow-100 text-yellow-700" : i.status === "issued" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{i.status}</span>
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setShowLinkPicker(false)} className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* ── Invoice linked ── */
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="flex items-start justify-between bg-purple-50/60 border border-purple-100 rounded-xl px-4 py-3">
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase mb-0.5">Invoice</div>
                      <div className="font-bold text-gray-900 text-sm">{inv.invoiceNumber}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{rs(inv.amount)}</div>
                    </div>
                    {/* Status badge / quick edit */}
                    {invStatusEdit === inv.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={statusEditVal} onChange={e => setStatusEditVal(e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-purple-300 bg-white">
                          {["pending","issued","paid","overdue","cancelled"].map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                        <button type="button" onClick={() => updateInvoice({ id: inv.id, data: { status: statusEditVal } as any })} disabled={invPending}
                          className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-lg font-bold disabled:opacity-60">✓</button>
                        <button type="button" onClick={() => setInvStatusEdit(null)} className="text-[10px] px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">✕</button>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => { setInvStatusEdit(inv.id); setStatusEditVal(inv.status); }}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize border border-transparent hover:border-current transition-colors ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "pending" ? "bg-yellow-100 text-yellow-700" : inv.status === "issued" ? "bg-blue-100 text-blue-700" : inv.status === "overdue" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {inv.status}
                      </button>
                    )}
                  </div>
                  {statusSaved && <div className="text-xs text-green-600 text-center font-semibold">Status updated!</div>}

                  {/* Action buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    <button type="button"
                      onClick={() => { setInvoiceFormMode("edit"); setShowInvoiceForm(true); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-purple-700 text-xs font-bold">
                      <Pencil size={15} /> Edit
                    </button>
                    <button type="button"
                      onClick={() => { const meta = parseInvoiceMeta(inv); const sub = meta.items.reduce((s: number, it: any) => s + it.qty * num(it.unitPrice), 0); const sa = calcShipping(meta.shipping, meta.shippingCustom, meta.weightKg, meta.ratePerKg, meta.firstKgRate, meta.addKgRate, meta.standardRate, meta.expressRate); setViewingInv({ inv, meta, sub, sa, gt: sub + sa }); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600 text-xs font-bold">
                      <Eye size={15} className="text-purple-500" /> View
                    </button>
                    <button type="button"
                      onClick={async () => {
                        const meta = parseInvoiceMeta(inv);
                        const sub = meta.items.reduce((s: number, it: any) => s + it.qty * num(it.unitPrice), 0);
                        const sa = calcShipping(meta.shipping, meta.shippingCustom, meta.weightKg, meta.ratePerKg, meta.firstKgRate, meta.addKgRate, meta.standardRate, meta.expressRate);
                        setViewingInv({ inv, meta, sub, sa, gt: sub + sa });
                      }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors text-blue-600 text-xs font-bold">
                      <Download size={15} /> PDF/ZIP
                    </button>
                    <button type="button"
                      onClick={() => { if (window.confirm("Unlink this invoice from the order?")) updateInvoice({ id: inv.id, data: { orderId: "" } as any }); }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors text-red-500 text-xs font-bold">
                      <X size={15} /> Unlink
                    </button>
                  </div>
                </div>
              )}
            </AccordionSection>

            <div className="h-2" />
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-4 py-4 border-t border-gray-100 bg-white rounded-b-2xl shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isPending || saved}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${saved ? "bg-green-500 text-white" : "bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 disabled:opacity-70"}`}>
              {saved ? <><Check size={15} /> Saved!</> : isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>

    {showInvoiceForm && invoiceFormMode === "create" && (
      <InvoiceFormModal
        onClose={() => setShowInvoiceForm(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/invoices"] })}
        linkedOrderId={order.orderId}
        prefilledClient={{
          name: order.customerName || "",
          phone: order.customerPhone || "",
          email: order.customerEmail || "",
          address: order.customerAddress || "",
        }}
      />
    )}
    {showInvoiceForm && invoiceFormMode === "edit" && inv && (
      <InvoiceFormModal
        onClose={() => setShowInvoiceForm(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/invoices"] })}
        invoiceId={inv.id}
        initialData={parseInvoiceMeta(inv)}
        linkedOrderId={order.orderId}
        invoiceNumberOverride={inv.invoiceNumber}
        createdAtOverride={new Date(inv.createdAt)}
        currentStatus={inv.status}
      />
    )}
    {viewingInv && (
      <InvoicePreview
        form={viewingInv.meta.form}
        items={viewingInv.meta.items}
        shipping={viewingInv.meta.shipping || "none"}
        shippingCustom={viewingInv.meta.shippingCustom || ""}
        courierName={viewingInv.meta.courierName || ""}
        advance={viewingInv.meta.advance || "0"}
        subtotal={viewingInv.sub}
        shippingAmt={viewingInv.sa}
        grandTotal={viewingInv.gt}
        invoiceNumberOverride={viewingInv.inv.invoiceNumber}
        createdAtOverride={new Date(viewingInv.inv.createdAt)}
        status={viewingInv.inv.status}
        linkedOrderId={viewingInv.inv.orderId || order.orderId || null}
        onClose={() => setViewingInv(null)}
      />
    )}
    </>
  );
}
