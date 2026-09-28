import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PenTool, Upload, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Reveal, Stagger, StaggerItem, FadeIn } from '@/components/public/Reveal';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const PROJECT_TYPES = [
  'Custom Photo Frame',
  'Collage / Multi-Panel',
  'Large Format Print',
  'Canvas Print',
  'Story Collage',
  'Studio Photography',
  'Colour Lab Services',
  'Other',
];

const STEP_BADGE =
  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold bg-[rgba(176,124,58,0.12)] text-[#8a5f28]';

export default function CustomProject() {
  const { toast } = useToast();

  const [submitted, setSubmitted] = useState(false);
  const [projectReference, setProjectReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    businessName: '',
    projectType: '',
    requiredSize: '',
    quantity: '',
    budget: '',
    deadline: '',
    description: '',
    deliveryAddress: '',
    additionalNotes: '',
  });
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.phone || !form.projectType || !form.description) {
      toast({ title: 'Missing fields', description: 'Please fill in the required fields.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (referenceFile) body.append('referenceImage', referenceFile);

      const res = await fetch(`${API_BASE}/api/custom-projects`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && (data.id || data.success)) {
        setProjectReference(data.projectId || '');
        setSubmitted(true);
      } else {
        throw new Error(data?.error || 'Submission failed');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not submit your request.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="hv-page">
        <section className="hv-section">
          <div className="hv-container max-w-2xl text-center">
            <FadeIn>
              <div className="hv-card mx-auto max-w-xl p-10 md:p-14">
                <span className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-full bg-[rgba(176,124,58,0.12)] text-[#8a5f28]">
                  <CheckCircle className="h-10 w-10" aria-hidden="true" />
                </span>
                <h2 className="hv-display hv-display-md">Request received!</h2>
                <p className="hv-lede mx-auto mt-4 text-center">
                  Thank you for reaching out. Our studio team will review your custom
                  project request and get back to you shortly.
                </p>
                {projectReference && (
                  <div className="hv-badge hv-badge-bronze mx-auto mt-8 w-fit">
                    Reference · {projectReference}
                  </div>
                )}
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <Link href="/" className="hv-btn hv-btn-solid">
                    Back to Home
                  </Link>
                  <Link href="/track-order" className="hv-btn hv-btn-ghost">
                    Track Order <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="hv-page">
      {/* Hero */}
      <header className="hv-page-hero">
        <div className="hv-container">
          <span className="hv-kicker">Custom studio work</span>
          <h1 className="hv-display hv-display-lg">
            Request a <em>custom frame.</em>
          </h1>
          <p className="hv-lede">
            Share your photo, preferred size and finish. We will review the details
            and prepare a quote.
          </p>
        </div>
        <div className="hv-hero-ornament" aria-hidden="true" />
      </header>

      {/* Form */}
      <section className="hv-section">
        <div className="hv-container max-w-4xl">
          <Reveal className="mb-10">
            <span className="hv-kicker">Project details</span>
            <h2 className="hv-display hv-display-md mt-4">Tell us about your project</h2>
            <p className="mt-3 text-[#6f6259]">
              Fields marked <span className="font-bold text-[#a63d2f]">*</span> are required.
            </p>
          </Reveal>

          <form onSubmit={handleSubmit}>
            <Stagger className="space-y-8">
              {/* 1 — Contact */}
              <StaggerItem>
                <div className="hv-card p-8 md:p-10">
                  <h3 className="hv-display hv-display-sm flex items-center gap-3">
                    <span className={STEP_BADGE}>1</span>
                    Contact information
                  </h3>
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <div className="hv-field">
                      <label htmlFor="cp-name">Full Name *</label>
                      <input id="cp-name" value={form.customerName} onChange={set('customerName')} placeholder="Your full name" className="hv-input" required />
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-phone">Phone *</label>
                      <input id="cp-phone" value={form.phone} onChange={set('phone')} placeholder="+94 77 000 0000" className="hv-input" required />
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-email">Email</label>
                      <input id="cp-email" type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" className="hv-input" />
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-business">Business Name</label>
                      <input id="cp-business" value={form.businessName} onChange={set('businessName')} placeholder="Optional" className="hv-input" />
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* 2 — Specifications */}
              <StaggerItem>
                <div className="hv-card p-8 md:p-10">
                  <h3 className="hv-display hv-display-sm flex items-center gap-3">
                    <span className={STEP_BADGE}>2</span>
                    Project specifications
                  </h3>
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <div className="hv-field">
                      <label htmlFor="cp-type">Project Type *</label>
                      <select id="cp-type" value={form.projectType} onChange={set('projectType')} required className="hv-select">
                        <option value="">Select type…</option>
                        {PROJECT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-size">Required Size</label>
                      <input id="cp-size" value={form.requiredSize} onChange={set('requiredSize')} placeholder='e.g. 20" × 24" or A3' className="hv-input" />
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-qty">Quantity</label>
                      <input id="cp-qty" type="number" min="1" value={form.quantity} onChange={set('quantity')} placeholder="1" className="hv-input" />
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-budget">Budget (LKR)</label>
                      <input id="cp-budget" value={form.budget} onChange={set('budget')} placeholder="Your estimated budget" className="hv-input" />
                    </div>
                    <div className="hv-field sm:col-span-2">
                      <label htmlFor="cp-deadline">Deadline</label>
                      <input id="cp-deadline" type="date" value={form.deadline} onChange={set('deadline')} className="hv-input" />
                    </div>
                    <div className="hv-field sm:col-span-2">
                      <label htmlFor="cp-description">Project Description *</label>
                      <textarea
                        id="cp-description"
                        value={form.description}
                        onChange={set('description')}
                        placeholder="Describe your project in detail — what you need, any special requirements, inspiration…"
                        rows={5}
                        className="hv-textarea"
                        required
                      />
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* 3 — Reference & delivery */}
              <StaggerItem>
                <div className="hv-card p-8 md:p-10">
                  <h3 className="hv-display hv-display-sm flex items-center gap-3">
                    <span className={STEP_BADGE}>3</span>
                    Reference &amp; delivery
                  </h3>
                  <div className="mt-8 space-y-5">
                    <div className="hv-field">
                      <label htmlFor="cp-address">Delivery Address</label>
                      <textarea id="cp-address" value={form.deliveryAddress} onChange={set('deliveryAddress')} placeholder="Full delivery address" rows={3} className="hv-textarea" />
                    </div>
                    <div className="hv-field">
                      <label htmlFor="cp-notes">Additional Notes</label>
                      <textarea id="cp-notes" value={form.additionalNotes} onChange={set('additionalNotes')} placeholder="Anything else we should know…" rows={3} className="hv-textarea" />
                    </div>
                    <div className="hv-field">
                      <label>Reference Image / File</label>
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[rgba(23,19,16,0.18)] bg-[#fffdf9] px-4 py-10 text-center transition-colors hover:border-[#b07c3a]">
                        <Upload className="h-6 w-6 text-[#a89a8c]" aria-hidden="true" />
                        <span className="text-[15px] font-medium text-[#171310]">
                          {referenceFile ? referenceFile.name : 'Click to upload a reference image or file'}
                        </span>
                        <span className="text-xs text-[#a89a8c]">PNG, JPG, PDF up to 10MB</span>
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setReferenceFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>
                </div>
              </StaggerItem>

              {/* Submit */}
              <StaggerItem>
                <div className="pt-2 text-center">
                  <button type="submit" disabled={loading} className="hv-btn hv-btn-bronze w-full sm:w-auto sm:min-w-[320px]">
                    {loading ? 'Submitting your request…' : 'Submit custom project request'}
                    {!loading && <PenTool aria-hidden="true" />}
                  </button>
                  <p className="mt-4 text-sm text-[#6f6259]">
                    Our studio team will review your request and contact you within 24 hours.
                  </p>
                </div>
              </StaggerItem>
            </Stagger>
          </form>
        </div>
      </section>
    </div>
  );
}
