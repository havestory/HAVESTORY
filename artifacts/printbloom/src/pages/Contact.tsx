import { useRef, useState } from "react";
import { useSubmitMessage, useGetSettings } from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";
import { Mail, Phone, MapPin, Send, CheckCircle2, Star, ImagePlus, X, Upload, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

/* ── Canvas-based center-crop then upload ── */
async function cropAndUpload(file: File, sizePx = 400): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d")!;

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, sizePx, sizePx);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas toBlob failed")), "image/jpeg", 0.9)
  );

  const fd = new FormData();
  fd.append("file", blob, "review-photo.jpg");
  const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const { url } = await res.json();
  return url;
}

function ReviewSubmitForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ customerName: "", rating: 0, comment: "", photoUrl: "" });
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await cropAndUpload(file, 400);
      setPreviewUrl(url);
      setForm(f => ({ ...f, photoUrl: url }));
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = () => {
    setPreviewUrl("");
    setForm(f => ({ ...f, photoUrl: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.rating === 0) { setError("Please select a star rating."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
        <p className="text-gray-500 text-sm">Your review has been submitted and is pending approval. We appreciate your feedback!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-semibold text-[var(--lux-text-primary)] block mb-1.5 ml-1">Your Name *</label>
        <input
          required
          value={form.customerName}
          onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
          placeholder="Enter your name"
          className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)]"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-[var(--lux-text-primary)] block mb-2 ml-1">Rating *</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setForm(f => ({ ...f, rating: star }))}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={32}
                className={star <= (hover || form.rating) ? "text-[var(--lux-gold-primary)] fill-[var(--lux-gold-primary)]" : "text-gray-600 fill-transparent"}
              />
            </button>
          ))}
          {form.rating > 0 && (
            <span className="ml-2 text-sm font-semibold text-[var(--lux-text-secondary)] self-center">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][form.rating]}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-[var(--lux-text-primary)] block mb-1.5 ml-1">Your Review *</label>
        <textarea
          required
          rows={4}
          value={form.comment}
          onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
          placeholder="Write your review here"
          className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)] resize-none"
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="text-sm font-semibold text-[var(--lux-text-primary)] block mb-1.5 ml-1 flex items-center gap-1.5">
          <ImagePlus size={14} /> Add a Photo <span className="font-normal text-[var(--lux-text-muted)]">(optional)</span>
        </label>

        {previewUrl ? (
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="Your review photo"
              className="w-24 h-24 rounded-xl object-cover border-2 border-white shadow-md"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border-2 border-dashed border-[var(--lux-border-subtle)] hover:border-[var(--lux-gold-primary)] hover:bg-white/10 transition-all text-sm text-[var(--lux-text-muted)] hover:text-[var(--lux-gold-primary)] w-full justify-center"
          >
            {uploading ? (
              <><Loader2 size={16} className="animate-spin text-[var(--lux-gold-primary)]" /> Uploading & cropping…</>
            ) : (
              <><Upload size={16} /> Click to upload a photo</>
            )}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {!previewUrl && !uploading && (
          <p className="text-[11px] text-gray-400 mt-1.5 ml-1">JPG, PNG, WebP · Auto-cropped to a square</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          <X size={14} /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || uploading}
        className="w-full hs-button hs-button-primary rounded-xl text-base font-bold flex items-center justify-center gap-2"
      >
        {submitting ? "Submitting..." : "Submit Review"} <Star size={16} fill="currentColor" />
      </button>
      <p className="text-center text-xs text-gray-400">Reviews are reviewed by our team before appearing on the website.</p>
    </form>
  );
}

export default function Contact() {
  const { data: settings } = useGetSettings();
  const searchParams = new URLSearchParams(window.location.search);
  const initialSubject = searchParams.get('service') ? `Inquiry about ${searchParams.get('service')}` : "";

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    subject: initialSubject,
    message: ""
  });

  const { mutate: submitMsg, isPending, isSuccess } = useSubmitMessage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMsg({ data: formData });
  };

  return (
    <div className="min-h-screen pb-24 hs-contact bg-[var(--lux-bg-main)]">
      <PageHeader 
        title="Get in Touch" 
        subtitle="Have a project in mind? We'd love to hear from you."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid lg:grid-cols-5 gap-12">
          
          {/* Info Side */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-panel bg-[var(--lux-surface-dark)] border border-[var(--lux-border-subtle)] p-8 rounded-3xl">
              <h3 className="text-2xl font-display font-bold text-[var(--lux-text-primary)] mb-6">Contact Information</h3>
              
              {!settings?.address && !settings?.email && !settings?.phone ? (
                <div className="text-center py-6 text-gray-400">
                  <Mail size={36} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium">Contact details coming soon</p>
                  <p className="text-xs mt-1 text-gray-400">Use the form to get in touch for now.</p>
                </div>
              ) : (
              <div className="space-y-6">
                {settings?.address && (
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full hs-service-icon-bg flex items-center justify-center text-[var(--lux-gold-primary)] shrink-0">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--lux-text-primary)] mb-1">Our Studio</h4>
                      <p className="text-[var(--lux-text-secondary)] text-sm leading-relaxed">{settings.address}</p>
                    </div>
                  </div>
                )}
                
                {settings?.email && (
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full hs-service-icon-bg flex items-center justify-center text-[var(--lux-gold-primary)] shrink-0">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--lux-text-primary)] mb-1">Email Us</h4>
                      <a href={`mailto:${settings.email}`} className="text-[var(--lux-text-secondary)] text-sm hover:text-[var(--lux-gold-primary)] transition-colors">{settings.email}</a>
                    </div>
                  </div>
                )}

                {settings?.phone && (
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full hs-service-icon-bg flex items-center justify-center text-[var(--lux-gold-primary)] shrink-0">
                      <Phone size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--lux-text-primary)] mb-1">Call Us</h4>
                      <a href={`tel:${settings.phone}`} className="text-[var(--lux-text-secondary)] text-sm hover:text-[var(--lux-gold-primary)] transition-colors">{settings.phone}</a>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Form Side */}
          <div className="lg:col-span-3">
            <div className="glass-panel bg-[var(--lux-surface-dark)] border border-[var(--lux-border-subtle)] p-8 md:p-10 rounded-3xl shadow-xl shadow-black/50">
              {isSuccess ? (
                <div className="py-16 text-center">
                  <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-3xl font-display font-bold text-gray-900 mb-4">Message Sent!</h3>
                  <p className="text-gray-600 mb-8 max-w-sm mx-auto">
                    Thank you for reaching out. Our team will get back to you as soon as possible.
                  </p>
                  <button 
                    onClick={() => {
                      setFormData({fullName: "", phone: "", email: "", subject: "", message: ""});
                      window.location.reload();
                    }}
                    className="hs-button hs-button-outline px-8 py-3 rounded-xl"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--lux-text-primary)] ml-1">Full Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.fullName}
                        onChange={e => setFormData({...formData, fullName: e.target.value})}
                        className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)]"
                        placeholder="Enter your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--lux-text-primary)] ml-1">Phone Number</label>
                      <input 
                        required
                        type="tel" 
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)]"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--lux-text-primary)] ml-1">Email Address (Optional)</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)]"
                        placeholder="Enter your email address"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-[var(--lux-text-primary)] ml-1">Subject</label>
                      <input 
                        required
                        type="text" 
                        value={formData.subject}
                        onChange={e => setFormData({...formData, subject: e.target.value})}
                        className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)]"
                        placeholder="Enter the subject"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[var(--lux-text-primary)] ml-1">Message</label>
                    <textarea 
                      required
                      rows={5}
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                      className="w-full px-5 py-3.5 rounded-xl transition-all placeholder:text-[var(--lux-text-muted)] resize-none"
                      placeholder="Write your message here"
                    ></textarea>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isPending}
                    className="w-full hs-button hs-button-primary rounded-xl text-lg flex items-center justify-center gap-2 mt-4"
                  >
                    {isPending ? "Sending..." : "Send Message"} <Send size={20} />
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Review Submission Section */}
      <div className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              <Star size={14} fill="currentColor" /> Share Your Experience
            </div>
            <h2 className="text-3xl font-display font-bold text-[var(--lux-text-primary)] mb-2">Leave Us a Review</h2>
            <p className="text-[var(--lux-text-secondary)]">Loved our service? Let others know! Your review helps us grow and helps customers find us.</p>
          </div>
          <div className="glass-panel bg-[var(--lux-surface-dark)] border border-[var(--lux-border-subtle)] p-8 rounded-3xl shadow-xl shadow-black/50">
            <ReviewSubmitForm />
          </div>
        </div>
      </div>
    </div>
  );
}
