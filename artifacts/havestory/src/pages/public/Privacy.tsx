import { useGetSettings } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';

export default function Privacy() {
  const { data: settings } = useGetSettings();
  const biz = settings?.businessName || 'HAVESTORY';
  const email = settings?.email || 'hello@havestory.lk';
  const whatsapp = settings?.whatsappNumber || '';

  return (
    <div className="hsc-legal-page min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-20 relative overflow-hidden noise">
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <div className="flex items-center gap-2 text-primary-foreground/50 text-xs tracking-widest uppercase mb-6">
            <Link href="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-secondary">Privacy Policy</span>
          </div>
          <p className="section-label mb-3">Legal</p>
          <h1 className="font-serif text-5xl font-bold leading-none">Privacy Policy</h1>
          <p className="text-primary-foreground/60 mt-4">Last updated: {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="prose prose-stone max-w-none">
          {settings?.privacyPolicy ? (
            <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{settings.privacyPolicy}</div>
          ) : <>
          <p className="lead text-muted-foreground text-lg">
            This Privacy Policy explains how <strong>{biz}</strong> collects, uses and protects your personal information when you use our website or services.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">1. Information We Collect</h2>
          <p className="text-muted-foreground">We may collect the following types of information:</p>
          <ul className="text-muted-foreground space-y-1 mt-2">
            <li>Your name, phone number, email address and delivery address when you place an order or submit an enquiry</li>
            <li>Order details including product selections, uploaded images and custom requirements</li>
            <li>Communications you send us through our contact form or WhatsApp</li>
            <li>Technical data such as browser type and pages visited (no personally identifiable tracking)</li>
          </ul>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">2. How We Use Your Information</h2>
          <ul className="text-muted-foreground space-y-1">
            <li>To process and fulfil your orders</li>
            <li>To contact you regarding your order or enquiry</li>
            <li>To improve our services and website experience</li>
            <li>To send relevant updates (you may opt out at any time)</li>
          </ul>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">3. Photographs and Uploaded Files</h2>
          <p className="text-muted-foreground">
            Any photographs or files you upload for printing or framing are used solely for the purpose of fulfilling your order. We do not share, sell or use your images for any other purpose. Images are stored securely and may be retained for a reasonable period for quality and reprint purposes.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">4. Sharing Your Information</h2>
          <p className="text-muted-foreground">
            We do not sell or rent your personal information to third parties. We may share your delivery address with our logistics partners solely for order delivery. All partners are required to maintain the confidentiality of your information.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">5. Data Security</h2>
          <p className="text-muted-foreground">
            We take reasonable precautions to protect your personal information. Our systems use secure encrypted connections and access controls. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">6. Your Rights</h2>
          <p className="text-muted-foreground">You have the right to:</p>
          <ul className="text-muted-foreground space-y-1 mt-2">
            <li>Request access to the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your information (subject to legal and operational requirements)</li>
            <li>Opt out of any non-essential communications</li>
          </ul>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">7. Cookies</h2>
          <p className="text-muted-foreground">
            Our website uses minimal cookies required for session management and site functionality. We do not use advertising or tracking cookies.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">8. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about this Privacy Policy or how we handle your information, please contact us:
          </p>
          <div className="mt-4 p-5 bg-muted/50 border border-border text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{biz}</p>
            {email && <p>Email: <a href={`mailto:${email}`} className="text-secondary hover:underline">{email}</a></p>}
            {whatsapp && <p>WhatsApp: <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-secondary hover:underline">{whatsapp}</a></p>}
          </div>
          </>}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4">
          <Link href="/" className="text-sm text-secondary hover:underline">← Back to Home</Link>
          <Link href="/terms" className="text-sm text-secondary hover:underline">Terms of Service →</Link>
        </div>
      </div>
    </div>
  );
}
