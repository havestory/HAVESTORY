import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PenTool, Upload, CheckCircle, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65 } },
};

export default function CustomProject() {
  const { data: settings } = useGetSettings();
  const { toast } = useToast();

  const [submitted, setSubmitted] = useState(false);
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
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
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-secondary" />
          </div>
          <h2 className="font-serif text-4xl font-bold text-foreground mb-3">Request Received!</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Thank you for reaching out. Our studio team will review your custom project request and get back to you shortly.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-6">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild variant="outline" className="uppercase text-xs tracking-widest px-6">
              <Link href="/track-order">Track Order</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-24 relative overflow-hidden noise">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(30_42%_46%/0.15),transparent_60%)]" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="flex items-center gap-2 text-primary-foreground/50 text-xs tracking-widest uppercase mb-6">
            <Link href="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-secondary">Custom Project</span>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
            <motion.p variants={fadeUp} className="section-label mb-3">Custom Studio Work</motion.p>
            <motion.h1 variants={fadeUp} className="font-serif text-5xl md:text-7xl font-bold leading-none mb-6">
              Something<br />
              <span className="text-gradient italic">Unique.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-primary-foreground/75 text-lg max-w-xl leading-relaxed">
              Tell us about your vision. Whether it's a custom frame size, a multi-panel collage, a special print finish — our studio team will bring it to life.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Form */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>

            <motion.div variants={fadeUp} className="mb-10">
              <p className="section-label mb-2">Project Details</p>
              <h2 className="font-serif text-3xl font-bold text-foreground .heading-underline">Tell us about your project</h2>
              <p className="text-muted-foreground mt-3">Fields marked <span className="text-destructive">*</span> are required.</p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-0">
              {/* Contact info */}
              <motion.div variants={fadeUp} className="bg-card border border-border p-6 mb-6">
                <h3 className="font-serif text-xl font-semibold mb-5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-secondary/10 text-secondary text-xs flex items-center justify-center font-bold font-sans">1</span>
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label className="section-label mb-2 block">Full Name <span className="text-destructive">*</span></Label>
                    <Input value={form.customerName} onChange={set('customerName')} placeholder="Your full name" className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" required />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Phone <span className="text-destructive">*</span></Label>
                    <Input value={form.phone} onChange={set('phone')} placeholder="+94 77 000 0000" className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" required />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Email</Label>
                    <Input type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Business Name</Label>
                    <Input value={form.businessName} onChange={set('businessName')} placeholder="Optional" className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" />
                  </div>
                </div>
              </motion.div>

              {/* Project details */}
              <motion.div variants={fadeUp} className="bg-card border border-border p-6 mb-6">
                <h3 className="font-serif text-xl font-semibold mb-5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-secondary/10 text-secondary text-xs flex items-center justify-center font-bold font-sans">2</span>
                  Project Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label className="section-label mb-2 block">Project Type <span className="text-destructive">*</span></Label>
                    <select
                      value={form.projectType} onChange={set('projectType')}
                      required
                      className="w-full border-0 border-b border-border bg-transparent text-foreground text-sm py-2 focus:outline-none focus:border-secondary transition-colors"
                    >
                      <option value="">Select type...</option>
                      <option>Custom Photo Frame</option>
                      <option>Collage / Multi-Panel</option>
                      <option>Large Format Print</option>
                      <option>Canvas Print</option>
                      <option>Story Collage</option>
                      <option>Studio Photography</option>
                      <option>Colour Lab Services</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Required Size</Label>
                    <Input value={form.requiredSize} onChange={set('requiredSize')} placeholder='e.g. 20" × 24" or A3' className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Quantity</Label>
                    <Input type="number" min="1" value={form.quantity} onChange={set('quantity')} placeholder="1" className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Budget (LKR)</Label>
                    <Input value={form.budget} onChange={set('budget')} placeholder="Your estimated budget" className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="section-label mb-2 block">Deadline</Label>
                    <Input type="date" value={form.deadline} onChange={set('deadline')} className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0" />
                  </div>
                </div>
                <div className="mt-5">
                  <Label className="section-label mb-2 block">Project Description <span className="text-destructive">*</span></Label>
                  <Textarea value={form.description} onChange={set('description')} placeholder="Describe your project in detail — what you need, any special requirements, inspiration..." rows={5} className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0 resize-none" required />
                </div>
              </motion.div>

              {/* Delivery + file */}
              <motion.div variants={fadeUp} className="bg-card border border-border p-6 mb-8">
                <h3 className="font-serif text-xl font-semibold mb-5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-secondary/10 text-secondary text-xs flex items-center justify-center font-bold font-sans">3</span>
                  Reference & Delivery
                </h3>
                <div className="space-y-5">
                  <div>
                    <Label className="section-label mb-2 block">Delivery Address</Label>
                    <Textarea value={form.deliveryAddress} onChange={set('deliveryAddress')} placeholder="Full delivery address" rows={3} className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0 resize-none" />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Additional Notes</Label>
                    <Textarea value={form.additionalNotes} onChange={set('additionalNotes')} placeholder="Anything else we should know..." rows={3} className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-secondary px-0 resize-none" />
                  </div>
                  <div>
                    <Label className="section-label mb-2 block">Reference Image / File</Label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-secondary transition-colors cursor-pointer py-8 px-4 text-center gap-2">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {referenceFile ? referenceFile.name : 'Click to upload a reference image or file'}
                      </span>
                      <span className="text-xs text-muted-foreground/60">PNG, JPG, PDF up to 10MB</span>
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setReferenceFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase tracking-widest text-sm font-semibold"
                >
                  {loading ? 'Submitting your request...' : 'Submit Custom Project Request'}
                  {!loading && <PenTool className="w-4 h-4 ml-3" />}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Our studio team will review your request and contact you within 24 hours.
                </p>
              </motion.div>
            </form>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
