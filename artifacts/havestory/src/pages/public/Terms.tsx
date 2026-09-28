import { useGetSettings } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/public/Reveal';

const TOC = [
  { id: 'terms-1', label: 'Orders & payment' },
  { id: 'terms-2', label: 'Custom orders' },
  { id: 'terms-3', label: 'Image quality' },
  { id: 'terms-4', label: 'Delivery' },
  { id: 'terms-5', label: 'Returns & refunds' },
  { id: 'terms-6', label: 'Intellectual property' },
  { id: 'terms-7', label: 'Liability' },
  { id: 'terms-8', label: 'Changes' },
  { id: 'terms-9', label: 'Contact' },
];

const LEAD = 'text-[17px] leading-8 text-[#6f6259]';
const P = 'text-[15px] leading-7 text-[#6f6259]';
const UL = 'mt-3 space-y-2.5 pl-6 text-[15px] leading-7 text-[#6f6259] list-disc marker:text-[#b07c3a]';

export default function Terms() {
  const { data: settings } = useGetSettings();
  const biz = settings?.businessName || 'HAVESTORY';
  const email = settings?.email || 'hello@havestory.lk';
  const custom = settings?.termsOfService;

  return (
    <div className="hv-page min-h-screen">
      {/* Hero */}
      <header className="hv-page-hero">
        <div className="hv-hero-ornament" aria-hidden="true" />
        <div className="hv-container relative">
          <Reveal>
            <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a89a8c]">
              <Link href="/" className="transition-colors hover:text-[#8a5f28]">Home</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#8a5f28]">Terms of Service</span>
            </nav>
            <span className="hv-kicker">Legal</span>
            <h1 className="hv-display hv-display-md">Terms of Service</h1>
            <p className="hv-lede">Last updated: {new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </Reveal>
        </div>
      </header>

      {/* Content */}
      <section className="hv-section-tight">
        <div className="hv-container max-w-3xl">
          {!custom && (
            <Reveal className="mb-8">
              <div className="hv-chip-row">
                {TOC.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="hv-chip">{t.label}</a>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal>
            <article className="hv-card p-6 sm:p-10 md:p-12">
              {custom ? (
                <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#6f6259]">{custom}</div>
              ) : (
                <>
                  <p className={LEAD}>
                    These Terms of Service govern your use of the <strong className="text-[#171310]">{biz}</strong> website and services. By placing an order or using our services, you agree to these terms.
                  </p>

                  <section id="terms-1" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">1. Orders and Payment</h2>
                    <ul className={UL}>
                      <li>All orders are subject to confirmation by our studio team</li>
                      <li>Prices are displayed in Sri Lankan Rupees (LKR) and are subject to change</li>
                      <li>Payment must be completed before production begins, unless otherwise agreed</li>
                      <li>We reserve the right to cancel an order if payment is not received within the agreed time</li>
                    </ul>
                  </section>

                  <section id="terms-2" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">2. Custom Orders</h2>
                    <p className={P}>
                      Custom orders require a deposit before work commences. Once production begins on a custom order, cancellations may not be accepted. Please review your specifications carefully before confirming.
                    </p>
                  </section>

                  <section id="terms-3" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">3. Image Quality and Artwork</h2>
                    <ul className={UL}>
                      <li>You are responsible for providing high-resolution images suitable for the print size ordered</li>
                      <li>We will notify you if your image quality may affect the final print</li>
                      <li>By uploading images, you confirm you own or have rights to use them</li>
                      <li>{biz} is not responsible for prints that appear different from digital screens due to colour calibration differences</li>
                    </ul>
                  </section>

                  <section id="terms-4" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">4. Turnaround Time and Delivery</h2>
                    <p className={P}>
                      Turnaround times are estimates and may vary based on order complexity and demand. We are not liable for delays caused by courier services, natural events or circumstances beyond our control. Delivery charges apply unless otherwise stated.
                    </p>
                  </section>

                  <section id="terms-5" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">5. Returns and Refunds</h2>
                    <ul className={UL}>
                      <li>We take great care in the quality of every order</li>
                      <li>If your order arrives damaged or with a production defect, please contact us within 48 hours with photographs</li>
                      <li>We do not accept returns for correctly produced orders where the customer has provided incorrect specifications or low-resolution images</li>
                      <li>Refunds or replacements are assessed on a case-by-case basis</li>
                    </ul>
                  </section>

                  <section id="terms-6" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">6. Intellectual Property</h2>
                    <p className={P}>
                      All content on this website — including designs, photographs and branding — is the property of {biz} and may not be reproduced without written permission. You retain ownership of the images you upload for your orders.
                    </p>
                  </section>

                  <section id="terms-7" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">7. Limitation of Liability</h2>
                    <p className={P}>
                      {biz}&apos;s liability is limited to the value of the order placed. We are not responsible for indirect or consequential losses.
                    </p>
                  </section>

                  <section id="terms-8" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">8. Changes to Terms</h2>
                    <p className={P}>
                      We reserve the right to update these terms at any time. Continued use of our services after changes constitutes acceptance of the updated terms.
                    </p>
                  </section>

                  <section id="terms-9" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">9. Contact</h2>
                    <div className="mt-5 rounded-2xl border border-[rgba(23,19,16,0.08)] bg-[#f1e9da] p-5 text-sm leading-7 text-[#6f6259]">
                      <p className="font-bold text-[#171310]">{biz}</p>
                      {email && <p>Email: <a href={`mailto:${email}`} className="font-semibold text-[#8a5f28] hover:underline">{email}</a></p>}
                    </div>
                  </section>
                </>
              )}
            </article>
          </Reveal>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="hv-text-link"><ArrowLeft /> Back to Home</Link>
            <Link href="/privacy" className="hv-text-link">Privacy Policy <ArrowRight /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
