import { useGetSettings } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';

export default function Terms() {
  const { data: settings } = useGetSettings();
  const biz = settings?.businessName || 'HAVESTORY';
  const email = settings?.email || 'hello@havestory.lk';

  return (
    <div className="hsc-legal-page min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-20 relative overflow-hidden noise">
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <div className="flex items-center gap-2 text-primary-foreground/50 text-xs tracking-widest uppercase mb-6">
            <Link href="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-secondary">Terms of Service</span>
          </div>
          <p className="section-label mb-3">Legal</p>
          <h1 className="font-serif text-5xl font-bold leading-none">Terms of Service</h1>
          <p className="text-primary-foreground/60 mt-4">Last updated: {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="prose prose-stone max-w-none">
          {settings?.termsOfService ? (
            <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{settings.termsOfService}</div>
          ) : <>
          <p className="lead text-muted-foreground text-lg">
            These Terms of Service govern your use of the <strong>{biz}</strong> website and services. By placing an order or using our services, you agree to these terms.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">1. Orders and Payment</h2>
          <ul className="text-muted-foreground space-y-1">
            <li>All orders are subject to confirmation by our studio team</li>
            <li>Prices are displayed in Sri Lankan Rupees (LKR) and are subject to change</li>
            <li>Payment must be completed before production begins, unless otherwise agreed</li>
            <li>We reserve the right to cancel an order if payment is not received within the agreed time</li>
          </ul>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">2. Custom Orders</h2>
          <p className="text-muted-foreground">
            Custom orders require a deposit before work commences. Once production begins on a custom order, cancellations may not be accepted. Please review your specifications carefully before confirming.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">3. Image Quality and Artwork</h2>
          <ul className="text-muted-foreground space-y-1">
            <li>You are responsible for providing high-resolution images suitable for the print size ordered</li>
            <li>We will notify you if your image quality may affect the final print</li>
            <li>By uploading images, you confirm you own or have rights to use them</li>
            <li>{biz} is not responsible for prints that appear different from digital screens due to colour calibration differences</li>
          </ul>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">4. Turnaround Time and Delivery</h2>
          <p className="text-muted-foreground">
            Turnaround times are estimates and may vary based on order complexity and demand. We are not liable for delays caused by courier services, natural events or circumstances beyond our control. Delivery charges apply unless otherwise stated.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">5. Returns and Refunds</h2>
          <ul className="text-muted-foreground space-y-1">
            <li>We take great care in the quality of every order</li>
            <li>If your order arrives damaged or with a production defect, please contact us within 48 hours with photographs</li>
            <li>We do not accept returns for correctly produced orders where the customer has provided incorrect specifications or low-resolution images</li>
            <li>Refunds or replacements are assessed on a case-by-case basis</li>
          </ul>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">6. Intellectual Property</h2>
          <p className="text-muted-foreground">
            All content on this website — including designs, photographs and branding — is the property of {biz} and may not be reproduced without written permission. You retain ownership of the images you upload for your orders.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">7. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            {biz}'s liability is limited to the value of the order placed. We are not responsible for indirect or consequential losses.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">8. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to update these terms at any time. Continued use of our services after changes constitutes acceptance of the updated terms.
          </p>

          <h2 className="font-serif text-2xl font-bold mt-10 mb-4 text-foreground">9. Contact</h2>
          <div className="p-5 bg-muted/50 border border-border text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{biz}</p>
            {email && <p>Email: <a href={`mailto:${email}`} className="text-secondary hover:underline">{email}</a></p>}
          </div>
          </>}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-4">
          <Link href="/" className="text-sm text-secondary hover:underline">← Back to Home</Link>
          <Link href="/privacy" className="text-sm text-secondary hover:underline">Privacy Policy →</Link>
        </div>
      </div>
    </div>
  );
}
