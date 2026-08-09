import { useState, useRef } from "react";
import { useListServices } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plus, X, Upload, CheckCircle2, Send, FileText, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

const BUDGET_OPTIONS = [
  "Under LKR 5,000",
  "LKR 5,000 – 15,000",
  "LKR 15,000 – 30,000",
  "LKR 30,000 – 60,000",
  "LKR 60,000 – 100,000",
  "Over LKR 100,000",
];

export default function CustomProject() {
  const { data: services } = useListServices();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    projectTitle: "",
    serviceType: "",
    description: "",
    quantity: "1",
    budget: "",
    requiredBy: "",
  });

  const [refUrls, setRefUrls] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{ orderId: string; customerName: string } | null>(null);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addUrl = () => setRefUrls(u => [...u, ""]);
  const removeUrl = (i: number) => setRefUrls(u => u.filter((_, idx) => idx !== i));
  const setUrl = (i: number, v: string) => setRefUrls(u => u.map((x, idx) => idx === i ? v : x));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).slice(0, 10);
    setFiles(f => [...f, ...dropped].slice(0, 10));
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).slice(0, 10);
    setFiles(f => [...f, ...picked].slice(0, 10));
  };

  const removeFile = (i: number) => setFiles(f => f.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const urls = refUrls.filter(Boolean);
    const notesParts = [
      form.serviceType && `Service Type: ${form.serviceType}`,
      form.budget && `Budget Range: ${form.budget}`,
      form.requiredBy && `Required By: ${form.requiredBy}`,
      form.description && `Project Description:\n${form.description}`,
      files.length > 0 && `Attached Files: ${files.map(f => f.name).join(", ")}`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.fullName,
          customerPhone: form.phone,
          customerEmail: form.email || undefined,
          customerAddress: "",
          orderType: "custom",
          items: [{
            name: form.projectTitle || "Custom Project",
            serviceType: form.serviceType,
            description: form.description,
            quantity: parseInt(form.quantity) || 1,
            budget: form.budget,
            requiredBy: form.requiredBy,
          }],
          designLinks: urls,
          notes: notesParts || undefined,
        }),
      });

      if (!res.ok) throw new Error("Submission failed");
      const order = await res.json();
      setSubmittedOrder({ orderId: order.orderId, customerName: form.fullName });
    } catch {
      setError("Something went wrong. Please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const trackingUrl = submittedOrder ? `${window.location.origin}/track-order?id=${submittedOrder.orderId}` : "";

  if (submittedOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg w-full"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} className="text-primary" />
          </div>
          <h2 className="text-3xl font-display font-extrabold text-gray-900 mb-2">Brief Submitted!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Thank you, <span className="font-semibold text-primary">{submittedOrder.customerName}</span>! We've received your custom project brief and will get back to you within 24 hours.
          </p>

          {/* Order ID & Tracking */}
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-purple-100 rounded-2xl p-6 mb-6 text-left">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Your Order Details</div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Order ID</div>
                  <div className="font-mono font-bold text-pink-600 text-lg">{submittedOrder.orderId}</div>
                </div>
                <CopyButton text={submittedOrder.orderId} label="ID" />
              </div>

              <div className="h-px bg-purple-100" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">Tracking Link</div>
                  <div className="text-xs text-gray-600 truncate font-mono">{trackingUrl}</div>
                </div>
                <CopyButton text={trackingUrl} label="Link" />
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              Save your Order ID — use it to track your project status anytime on our Track Order page.
            </p>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/" className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold text-white">
              Back to Home
            </a>
            <a
              href={`/track-order?id=${submittedOrder.orderId}`}
              className="flex items-center gap-1.5 glass border border-purple-200 px-6 py-3 rounded-xl text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
            >
              <ExternalLink size={14} /> Track Order
            </a>
            <button
              onClick={() => {
                setSubmittedOrder(null);
                setForm({ fullName: "", phone: "", email: "", projectTitle: "", serviceType: "", description: "", quantity: "1", budget: "", requiredBy: "" });
                setRefUrls([""]);
                setFiles([]);
              }}
              className="glass border border-white/60 px-6 py-3 rounded-xl text-sm font-semibold text-gray-600"
            >
              Submit Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600" />
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        />
        <div className="relative text-center py-16 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-5">
              <Sparkles size={32} className="text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-white mb-3">
              Custom Project Request
            </h1>
            <p className="text-white/80 text-lg max-w-xl mx-auto">
              Have a unique printing project in mind? Tell us about it and we'll bring it to life.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-2xl shadow-purple-900/10 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-b border-purple-100 px-4 sm:px-8 py-5">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-primary" />
              <div>
                <h2 className="font-bold text-purple-900 text-lg">Project Brief</h2>
                <p className="text-xs text-gray-400">Fill out the details below and we'll prepare a custom quote for you.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-8">
            {/* Your Details */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Your Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Full Name <span className="text-pink-500">*</span></label>
                  <input required type="text" value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder="Enter your full name" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Phone Number <span className="text-pink-500">*</span></label>
                  <input required type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Enter your phone number" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50" />
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                <label className="text-xs font-semibold text-gray-600">Email Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="Enter your email address" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50" />
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-pink-100 via-purple-100 to-transparent" />

            {/* Project Details */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Project Details</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Project Title <span className="text-pink-500">*</span></label>
                  <input required type="text" value={form.projectTitle} onChange={e => set("projectTitle", e.target.value)} placeholder="Enter your project title" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Service Type</label>
                  <div className="relative">
                    <select value={form.serviceType} onChange={e => set("serviceType", e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50 appearance-none cursor-pointer">
                      <option value="">Select a service...</option>
                      {services?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      <option value="Other">Other / Not Listed</option>
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">▼</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Project Description <span className="text-pink-500">*</span></label>
                  <textarea required rows={4} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe your project — dimensions, quantities, materials, colors, design preferences, special requirements" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50 resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Estimated Quantity</label>
                    <input type="number" min="1" value={form.quantity} onChange={e => set("quantity", e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Budget Range</label>
                    <div className="relative">
                      <select value={form.budget} onChange={e => set("budget", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50 appearance-none cursor-pointer">
                        <option value="">Select...</option>
                        {BUDGET_OPTIONS.map(b => <option key={b}>{b}</option>)}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Required By (Date)</label>
                    <input type="date" value={form.requiredBy} onChange={e => set("requiredBy", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all bg-gray-50/50" />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-pink-100 via-purple-100 to-transparent" />

            {/* Reference Files */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2 uppercase tracking-wider">
                <Upload size={14} className="text-primary" />
                Reference Files & Links
                <span className="text-gray-400 font-normal normal-case tracking-normal text-xs">(Optional)</span>
              </h3>
              <p className="text-xs text-gray-400 mb-4">Share inspiration images, logos, or design files to help us understand your vision.</p>

              <div className="space-y-2 mb-4">
                <label className="text-xs font-semibold text-gray-600">Reference URLs</label>
                {refUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="url" value={url} onChange={e => setUrl(i, e.target.value)} placeholder="Paste your file link here (Google Drive, Dropbox, WeTransfer)" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all bg-gray-50/50" />
                    {refUrls.length > 1 && (
                      <button type="button" onClick={() => removeUrl(i)} className="w-9 h-9 mt-0.5 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-200 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addUrl} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/70 transition-colors mt-1">
                  <Plus size={13} /> Add another URL
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Upload Files Directly</label>
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${isDragging ? "border-primary bg-pink-50/50 scale-[1.01]" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50/50"}`}
                >
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.ai,.eps,.psd,.png,.jpg,.svg,.zip" className="hidden" onChange={handleFiles} />
                  <Upload size={28} className={`mx-auto mb-2 transition-colors ${isDragging ? "text-primary" : "text-gray-300"}`} />
                  <p className="text-sm font-medium text-gray-500">{isDragging ? "Drop files here" : "Click to select files"}</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, AI, EPS, PSD, PNG, JPG, SVG, ZIP — up to 10 MB each, max 10 files</p>
                </div>

                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5 mt-2">
                      {files.map((file, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center justify-between bg-gradient-to-r from-pink-50 to-purple-50 border border-purple-100 rounded-xl px-4 py-2">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-primary shrink-0" />
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{file.name}</span>
                            <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                          </div>
                          <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-400 transition-colors ml-2 shrink-0"><X size={13} /></button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>}

            <button type="submit" disabled={isSubmitting} className="w-full btn-gradient py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all disabled:opacity-70">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2"><Send size={18} /> Submit Project Request</span>
              )}
            </button>
            <p className="text-center text-xs text-gray-400">We'll respond within 24 hours with a custom quote tailored to your project.</p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
