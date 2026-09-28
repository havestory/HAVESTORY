import { useGetSettings } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/public/Reveal';

const TOC = [
  { id: 'privacy-1', label: 'Information' },
  { id: 'privacy-2', label: 'How we use it' },
  { id: 'privacy-3', label: 'Your photographs' },
  { id: 'privacy-4', label: 'Sharing' },
  { id: 'privacy-5', label: 'Security' },
  { id: 'privacy-6', label: 'Your rights' },
  { id: 'privacy-7', label: 'Cookies' },
  { id: 'privacy-8', label: 'Contact' },
];

const LEAD = 'text-[17px] leading-8 text-[#6f6259]';
const P = 'text-[15px] leading-7 text-[#6f6259]';
const UL = 'mt-3 space-y-2.5 pl-6 text-[15px] leading-7 text-[#6f6259] list-disc marker:text-[#b07c3a]';

export default function Privacy() {
  const { data: settings } = useGetSettings();
  const biz = settings?.businessName || 'HAVESTORY';
  const email = settings?.email || 'hello@havestory.lk';
  const whatsapp = settings?.whatsappNumber || '';
  const custom = settings?.privacyPolicy;

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
              <span className="text-[#8a5f28]">Privacy Policy</span>
            </nav>
            <span className="hv-kicker">Legal</span>
            <h1 className="hv-display hv-display-md">Privacy Policy</h1>
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
                    This Privacy Policy explains how <strong className="text-[#171310]">{biz}</strong> collects, uses and protects your personal information when you use our website or services.
                  </p>

                  <section id="privacy-1" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">1. Information We Collect</h2>
                    <p className={P}>We may collect the following types of information:</p>
                    <ul className={UL}>
                      <li>Your name, phone number, email address and delivery address when you place an order or submit an enquiry</li>
                      <li>Order details including product selections, uploaded images and custom requirements</li>
                      <li>Communications you send us through our contact form or WhatsApp</li>
                      <li>Technical data such as browser type and pages visited (no personally identifiable tracking)</li>
                    </ul>
                  </section>

                  <section id="privacy-2" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">2. How We Use Your Information</h2>
                    <ul className={UL}>
                      <li>To process and fulfil your orders</li>
                      <li>To contact you regarding your order or enquiry</li>
                      <li>To improve our services and website experience</li>
                      <li>To send relevant updates (you may opt out at any time)</li>
                    </ul>
                  </section>

                  <section id="privacy-3" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">3. Photographs and Uploaded Files</h2>
                    <p className={P}>
                      Any photographs or files you upload for printing or framing are used solely for the purpose of fulfilling your order. We do not share, sell or use your images for any other purpose. Images are stored securely and may be retained for a reasonable period for quality and reprint purposes.
                    </p>
                  </section>

                  <section id="privacy-4" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">4. Sharing Your Information</h2>
                    <p className={P}>
                      We do not sell or rent your personal information to third parties. We may share your delivery address with our logistics partners solely for order delivery. All partners are required to maintain the confidentiality of your information.
                    </p>
                  </section>

                  <section id="privacy-5" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">5. Data Security</h2>
                    <p className={P}>
                      We take reasonable precautions to protect your personal information. Our systems use secure encrypted connections and access controls. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
                    </p>
                  </section>

                  <section id="privacy-6" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">6. Your Rights</h2>
                    <p className={P}>You have the right to:</p>
                    <ul className={UL}>
                      <li>Request access to the personal information we hold about you</li>
                      <li>Request correction of inaccurate information</li>
                      <li>Request deletion of your information (subject to legal and operational requirements)</li>
                      <li>Opt out of any non-essential communications</li>
                    </ul>
                  </section>

                  <section id="privacy-7" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">7. Cookies</h2>
                    <p className={P}>
                      Our website uses minimal cookies required for session management and site functionality. We do not use advertising or tracking cookies.
                    </p>
                  </section>

                  <section id="privacy-8" className="mt-10 scroll-mt-32">
                    <h2 className="hv-display hv-display-sm mb-4">8. Contact Us</h2>
                    <p className={P}>
                      If you have any questions about this Privacy Policy or how we handle your information, please contact us:
                    </p>
                    <div className="mt-5 rounded-2xl border border-[rgba(23,19,16,0.08)] bg-[#f1e9da] p-5 text-sm leading-7 text-[#6f6259]">
                      <p className="font-bold text-[#171310]">{biz}</p>
                      {email && <p>Email: <a href={`mailto:${email}`} className="font-semibold text-[#8a5f28] hover:underline">{email}</a></p>}
                      {whatsapp && <p>WhatsApp: <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="font-semibold text-[#8a5f28] hover:underline">{whatsapp}</a></p>}
                    </div>
                  </section>
                </>
              )}
            </article>
          </Reveal>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="hv-text-link"><ArrowLeft /> Back to Home</Link>
            <Link href="/terms" className="hv-text-link">Terms of Service <ArrowRight /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
