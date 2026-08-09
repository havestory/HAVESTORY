import { useState, useEffect, useRef } from "react";
import { useTrackOrder, useGetSettings } from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";
import {
  Search, Package, Clock, CheckCircle2, Truck, AlertCircle,
  Copy, Check, ExternalLink, Receipt, Download, Upload,
  ChevronDown, ChevronUp, Phone, User, FileText, Paperclip,
  Landmark, QrCode
} from "lucide-react";
import { format } from "date-fns";
import { InvoicePreview } from "@/components/InvoicePreview";
import { parseInvoiceMeta, calcShipping, num } from "@/lib/invoiceTypes";


function STATUS_INFO(status: string): { label: string; color: string; bg: string; icon: React.ReactNode } {
  switch (status?.toLowerCase()) {
    case "completed":
      return { label: "Completed — Ready for delivery/pickup", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 size={16} className="text-green-600" /> };
    case "ready":
      return { label: "Ready — Your order is ready for pickup/delivery", color: "text-teal-700", bg: "bg-teal-50 border-teal-200", icon: <CheckCircle2 size={16} className="text-teal-600" /> };
    case "processing":
      return { label: "In Production — Your order is being created", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: <Package size={16} className="text-purple-600" /> };
    case "confirmed":
      return { label: "Order Confirmed — Preparing to process", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <CheckCircle2 size={16} className="text-blue-600" /> };
    case "reviewing":
      return { label: "Under Review — Checking quality", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <Clock size={16} className="text-amber-600" /> };
    case "cancelled":
      return { label: "Cancelled — Please contact us for details", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: <AlertCircle size={16} className="text-red-600" /> };
    default:
      return { label: "Order Received — We'll review it soon", color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: <Clock size={16} className="text-gray-500" /> };
  }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-all"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PaymentProofSection({ orderId, existingUrl }: { orderId: string; existingUrl?: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl || null);
  const [error, setError] = useState("");

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/orders/track/${orderId}/payment-proof`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedUrl(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (uploadedUrl) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-green-800">Payment proof uploaded</div>
            <div className="text-xs text-green-600">Your payment proof has been submitted successfully.</div>
          </div>
        </div>
        <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-300 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
          <Download size={12} /> View
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center">
          <Upload size={11} className="text-green-600" />
        </div>
        <span className="text-sm font-bold text-gray-800">Upload Payment Proof</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">Upload a screenshot or PDF of your payment/transaction</p>
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 flex flex-col items-center gap-2 text-sm text-gray-400 hover:border-primary/40 hover:text-primary/60 transition-all cursor-pointer disabled:opacity-60"
      >
        {uploading ? (
          <><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /><span>Uploading...</span></>
        ) : (
          <><Upload size={20} /><span>Click to upload payment screenshot/PDF</span></>
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

function getFileName(item: any): string {
  if (typeof item === "string") return item.split("/").pop() || item;
  return item.name || item.url?.split("/").pop() || "file";
}

function getFileUrl(item: any): string {
  return typeof item === "string" ? item : item.url ?? item;
}

function DesignFilesSection({ orderId, existingFiles }: { orderId: string; existingFiles?: any[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sessionFiles, setSessionFiles] = useState<{ url: string; name: string }[]>([]);
  const [error, setError] = useState("");

  const storedFiles = (existingFiles ?? []).filter(f => {
    const url = getFileUrl(f);
    return url && !sessionFiles.find(s => s.url === url);
  });

  const handleFiles = async (selected: FileList) => {
    if (!selected.length) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    Array.from(selected).forEach(f => formData.append("files", f));
    try {
      const res = await fetch(`/api/orders/track/${orderId}/design-files`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setSessionFiles(prev => [...prev, ...(data.files ?? [])]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const allFiles = [...storedFiles, ...sessionFiles];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded bg-purple-500/10 flex items-center justify-center">
          <Paperclip size={11} className="text-purple-600" />
        </div>
        <span className="text-sm font-bold text-gray-800">Upload Design Files</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Attach your design files, reference images, or any supporting materials (PNG, JPG, PDF, AI, PSD, ZIP — up to 10 at a time)
      </p>

      {allFiles.length > 0 && (
        <div className="space-y-2 mb-3">
          {allFiles.map((f, i) => {
            const url = getFileUrl(f);
            const name = getFileName(f);
            const isNew = sessionFiles.find(s => s.url === url);
            return (
              <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${isNew ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={13} className={isNew ? "text-purple-500 shrink-0" : "text-gray-400 shrink-0"} />
                  <span className="truncate font-medium text-gray-700">{name}</span>
                  {isNew && <span className="text-purple-500 font-semibold shrink-0">✓ uploaded</span>}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={name}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shrink-0"
                >
                  <Download size={11} /> View
                </a>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.pdf,.ai,.psd,.zip,.rar,.eps,.svg,.indd"
        className="hidden"
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 flex flex-col items-center gap-2 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-all cursor-pointer disabled:opacity-60"
      >
        {uploading ? (
          <><div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /><span>Uploading...</span></>
        ) : (
          <><Upload size={20} /><span>Click to attach design files</span><span className="text-xs">Multiple files supported</span></>
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

export default function TrackOrder() {
  const params = new URLSearchParams(window.location.search);
  const initialId = params.get("id") || "";

  const [orderId, setOrderId] = useState(initialId);
  const [searchId, setSearchId] = useState(initialId.trim().toUpperCase());
  const [showTimeline, setShowTimeline] = useState(false);
  const [viewingInv, setViewingInv] = useState<any>(null);

  const openInvoicePreview = (inv: any) => {
    const meta = parseInvoiceMeta(inv);
    const sub = meta.items.reduce((s: number, it: any) => s + it.qty * num(it.unitPrice), 0);
    const sa = calcShipping(meta.shipping, meta.shippingCustom, meta.weightKg, meta.ratePerKg, meta.firstKgRate, meta.addKgRate, meta.standardRate, meta.expressRate);
    setViewingInv({ inv, meta, sub, sa, gt: sub + sa });
  };

  useEffect(() => {
    if (initialId) setSearchId(initialId.trim().toUpperCase());
  }, []);

  const { data: tracking, error, isLoading, isError } = useTrackOrder(searchId, {
    query: { enabled: !!searchId, retry: false }
  });

  const { data: settings } = useGetSettings();
  const trackQrUrl: string = (settings as any)?.paymentQrUrl || "";
  const trackBankAccounts: any[] = (() => {
    try {
      const raw = (settings as any)?.bankDetails;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const fallback: any = {};
    if ((settings as any)?.bankName) fallback.bankName = (settings as any).bankName;
    if ((settings as any)?.bankAccountHolder) fallback.accountHolder = (settings as any).bankAccountHolder;
    if ((settings as any)?.bankAccountNumber) fallback.accountNumber = (settings as any).bankAccountNumber;
    if ((settings as any)?.bankBranch) fallback.branch = (settings as any).bankBranch;
    return Object.keys(fallback).length > 0 ? [fallback] : [];
  })();
  const hasPayLater = trackBankAccounts.length > 0 || !!trackQrUrl;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim()) setSearchId(orderId.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader
        title="Track Your Order"
        subtitle="Enter your unique Order ID to check the current status and details."
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-8">

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            type="text"
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            placeholder="e.g. PB-MAR-0001-K7X"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 text-sm outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
          />
          <button
            type="submit"
            disabled={!orderId.trim()}
            className="btn-gradient px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            <Search size={16} /> Track
          </button>
        </form>

        {isLoading && (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500 text-sm">Searching for order...</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
            <h3 className="text-lg font-bold text-red-900 mb-1">Order Not Found</h3>
            <p className="text-red-600 text-sm">We couldn't find an order with ID "{searchId}". Please check and try again.</p>
          </div>
        )}

        {tracking && (() => {
          const info = STATUS_INFO(tracking.status);
          const courierTrackUrl = tracking.courierTrackingUrl ?? null;

          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-100 overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-mono font-bold text-gray-900 text-base sm:text-lg break-all">{tracking.orderId}</div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold capitalize border ${info.bg} ${info.color}`}>
                    {tracking.status}
                  </span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${info.bg} ${info.color}`}>
                  {info.icon}
                  <span className="leading-tight">{info.label}</span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Customer */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-1">
                  <div className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                    <User size={15} className="text-gray-400 shrink-0" />
                    <span className="truncate">{tracking.customerName}</span>
                  </div>
                  {tracking.customerPhone && (
                    <a href={`tel:${tracking.customerPhone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-purple-600 transition-colors">
                      <Phone size={15} className="text-gray-400 shrink-0" />
                      <span>{tracking.customerPhone}</span>
                    </a>
                  )}
                </div>

                {/* Online delivery — also shown when delivery method is "both" */}
                {(tracking.deliveryMethod === "online" || tracking.deliveryMethod === "both") && (tracking.onlineDeliveryFiles?.length > 0 || tracking.onlineDeliveryLinks?.length > 0) && (
                  <div className="border border-purple-100 bg-purple-50/40 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <Download size={13} className="text-purple-600" />
                      </div>
                      <div className="text-sm font-bold text-purple-900">Your Order is Ready — Download Below</div>
                    </div>
                    {tracking.onlineDeliveryFiles?.length > 0 && (
                      <div className="space-y-1.5">
                        {tracking.onlineDeliveryFiles.map((f: any, i: number) => (
                          <a key={i} href={f.url} download={f.name}
                            className="flex items-center justify-between bg-white border border-purple-100 rounded-xl px-3 py-2.5 hover:bg-purple-50 transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText size={14} className="text-purple-500 shrink-0" />
                              <span className="text-xs font-semibold text-purple-800 truncate">{f.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-purple-600 text-xs font-bold shrink-0 ml-2 group-hover:text-purple-800">
                              <Download size={13} /> Download
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    {tracking.onlineDeliveryLinks?.length > 0 && (
                      <div className="space-y-1.5">
                        {tracking.onlineDeliveryLinks.map((link: string, i: number) => (
                          <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-between bg-white border border-blue-100 rounded-xl px-3 py-2.5 hover:bg-blue-50 transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                              <ExternalLink size={14} className="text-blue-500 shrink-0" />
                              <span className="text-xs text-blue-700 truncate">{link}</span>
                            </div>
                            <span className="text-blue-600 text-xs font-bold shrink-0 ml-2 flex items-center gap-1 group-hover:text-blue-800"><ExternalLink size={13} /> Open</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Physical — Courier — also shown when delivery method is "both" */}
                {(tracking.deliveryMethod === "physical" || tracking.deliveryMethod === "both") && tracking.courierName && tracking.courierTrackingNumber && (
                  <div className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                          <Truck size={15} className="text-orange-500" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Courier: <span className="font-bold text-gray-700">{tracking.courierName}</span></div>
                          <div className="text-xs text-gray-400 mt-0.5">Tracking Number</div>
                          <div className="font-bold text-gray-900">{tracking.courierTrackingNumber}</div>
                        </div>
                      </div>
                      <CopyBtn text={tracking.courierTrackingNumber} />
                    </div>
                    {courierTrackUrl && (
                      <a
                        href={courierTrackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-orange-200 bg-orange-50 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
                      >
                        <ExternalLink size={14} /> Track on {tracking.courierName}
                      </a>
                    )}
                  </div>
                )}

                {/* Invoice */}
                {tracking.invoice && (
                  <div className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                        <Receipt size={15} className="text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400">Invoice</div>
                        <div className="font-bold text-gray-900 truncate">Invoice attached</div>
                        <div className="text-xs text-gray-500 truncate">{tracking.invoice.invoiceNumber} · Rs. {Number(tracking.invoice.amount || 0).toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => openInvoicePreview(tracking.invoice)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-green-200 bg-green-50 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors">
                      <ExternalLink size={14} /> View &amp; Download Invoice
                    </button>
                  </div>
                )}

                {/* Design Proof from Admin */}
                {tracking.proofFileUrl && (
                  <div className="border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-purple-500 tracking-widest uppercase mb-0.5">From PrintBloom Team</div>
                        <div className="font-bold text-gray-900 text-sm truncate">{tracking.proofFileName || "Design proof attached"}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Your design proof is ready — please review and download</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <a
                        href={tracking.proofFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        <ExternalLink size={12} /> View
                      </a>
                      <a
                        href={tracking.proofFileUrl}
                        download={tracking.proofFileName || "proof"}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-purple-400 bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
                      >
                        <Download size={12} /> Download
                      </a>
                    </div>
                  </div>
                )}

                {/* Order Description */}
                {tracking.orderDescription && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Order Description</div>
                    <div className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-line">{tracking.orderDescription}</div>
                  </div>
                )}

                {/* Pay Later — Bank Transfer & QR */}
                {hasPayLater && !tracking.paymentProofUrl && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded bg-pink-500/10 flex items-center justify-center">
                        <Landmark size={11} className="text-pink-600" />
                      </div>
                      <span className="text-sm font-bold text-gray-800">Pay for Your Order</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Use the bank details below or scan the QR to complete payment. Then upload your receipt as payment proof.
                    </p>

                    {trackBankAccounts.length > 0 && (
                      <div className="space-y-3 mb-3">
                        {trackBankAccounts.map((bank: any, idx: number) => (
                          <div key={idx} className="bg-gradient-to-br from-pink-50 to-purple-50 border border-purple-100 rounded-2xl p-4 space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Landmark size={14} className="text-purple-500" />
                              <div className="font-bold text-gray-900 text-sm">{bank.bankName || bank.bank || "Bank"}</div>
                              {bank.branch && <div className="text-xs text-gray-400">· {bank.branch}</div>}
                            </div>
                            {bank.accountHolder && (
                              <div className="flex items-center justify-between gap-2 bg-white/70 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Account Holder</div>
                                  <div className="text-xs font-bold text-gray-800 truncate">{bank.accountHolder}</div>
                                </div>
                                <CopyBtn text={bank.accountHolder} />
                              </div>
                            )}
                            {bank.accountNumber && (
                              <div className="flex items-center justify-between gap-2 bg-white/70 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Account Number</div>
                                  <div className="text-xs font-bold text-gray-800 font-mono truncate">{bank.accountNumber}</div>
                                </div>
                                <CopyBtn text={bank.accountNumber} />
                              </div>
                            )}
                            {(bank.swiftBic || bank.swift) && (
                              <div className="flex items-center justify-between gap-2 bg-white/70 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">SWIFT / BIC</div>
                                  <div className="text-xs font-bold text-gray-800 font-mono truncate">{bank.swiftBic || bank.swift}</div>
                                </div>
                                <CopyBtn text={bank.swiftBic || bank.swift} />
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                          <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-700">Use your Order ID <span className="font-bold font-mono">{tracking.orderId}</span> as the payment reference.</p>
                        </div>
                      </div>
                    )}

                    {trackQrUrl && (
                      <div className={`flex flex-col items-center gap-2 ${trackBankAccounts.length > 0 ? "border-t border-gray-100 pt-3 mt-1" : ""}`}>
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          <QrCode size={12} className="text-emerald-500" /> Or Scan to Pay
                        </div>
                        <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-sm">
                          <img src={trackQrUrl} alt="Payment QR Code" className="w-36 h-36 object-contain" />
                        </div>
                        <p className="text-[11px] text-gray-400">Scan with your mobile banking or payment app</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Payment Proof */}
                <div className="border-t border-gray-100 pt-4">
                  <PaymentProofSection orderId={tracking.orderId} existingUrl={tracking.paymentProofUrl} />
                </div>

                {/* Upload Design Files */}
                <div className="border-t border-gray-100 pt-4">
                  <DesignFilesSection orderId={tracking.orderId} existingFiles={tracking.attachments} />
                </div>

                {/* Date + est. completion */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    Ordered on {tracking.createdAt ? format(new Date(tracking.createdAt), "dd MMM yyyy, hh:mm a") : "—"}
                  </span>
                  {tracking.estimatedCompletion && (
                    <span>Est. completion: <span className="font-semibold text-gray-600">{format(new Date(tracking.estimatedCompletion), "dd MMM yyyy")}</span></span>
                  )}
                </div>

                {/* Status Timeline toggle */}
                {tracking.statusHistory?.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <button
                      onClick={() => setShowTimeline(v => !v)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <span>Order Timeline ({tracking.statusHistory.length} updates)</span>
                      {showTimeline ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showTimeline && (
                      <div className="mt-4 space-y-3">
                        {[...tracking.statusHistory].reverse().map((h: any, i: number) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${i === 0 ? "bg-primary" : "bg-gray-200"}`} />
                              {i < tracking.statusHistory.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                            </div>
                            <div className="pb-3">
                              <div className="text-sm font-semibold text-gray-800 capitalize">{h.status}</div>
                              <div className="text-xs text-gray-400">{h.timestamp ? format(new Date(h.timestamp), "dd MMM yyyy, hh:mm a") : ""}</div>
                              {h.note && <div className="text-xs text-gray-500 mt-0.5">{h.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
      {viewingInv && (
        <InvoicePreview
          form={viewingInv.meta.form}
          items={viewingInv.meta.items}
          shipping={viewingInv.meta.shipping || "none"}
          shippingCustom={viewingInv.meta.shippingCustom || ""}
          shippingLabelOverride={viewingInv.meta.shippingLabel || ""}
          courierName={viewingInv.meta.courierName || ""}
          advance={viewingInv.meta.advance || "0"}
          subtotal={viewingInv.sub}
          shippingAmt={viewingInv.sa}
          grandTotal={viewingInv.gt}
          invoiceNumberOverride={viewingInv.inv.invoiceNumber}
          createdAtOverride={new Date(viewingInv.inv.createdAt)}
          status={viewingInv.inv.status}
          linkedOrderId={viewingInv.inv.orderId || null}
          onClose={() => setViewingInv(null)}
        />
      )}
    </div>
  );
}
