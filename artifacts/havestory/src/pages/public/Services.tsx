import { useListServices } from '@workspace/api-client-react';
import { ArrowRight, Check, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { Reveal, Stagger, StaggerItem } from '@/components/public/Reveal';

const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Consult',
    text: 'Share your photographs, artwork or idea. We help you choose the size, material and finish that suits the piece.',
  },
  {
    num: '02',
    title: 'Craft',
    text: 'Our framers and printers make every piece by hand — mounted, finished and checked inside the studio.',
  },
  {
    num: '03',
    title: 'Deliver',
    text: 'Collect in store or have it delivered, packed with care and ready to hang or gift.',
  },
];

export default function Services() {
  const { data: services, isLoading, isError, refetch } = useListServices();
  const serviceList = Array.isArray(services) ? services : [];

  return (
    <div className="hv-page">
      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="hv-page-hero">
        <div className="hv-container">
          <Reveal>
            <span className="hv-kicker">Studio services</span>
            <h1 className="hv-display hv-display-lg">
              Frames, prints &amp;<br />
              <em>personal projects.</em>
            </h1>
            <p className="hv-lede">
              Tell us what you would like to make. We will help choose the size, material and finish.
            </p>
          </Reveal>
          {serviceList.length > 0 && (
            <Reveal delay={0.12}>
              <div className="mt-7">
                <Link href="/custom-project" className="hv-text-link">
                  Request a quote <ArrowRight />
                </Link>
              </div>
            </Reveal>
          )}
          <div className="hv-hero-ornament" aria-hidden="true" />
        </div>
      </header>

      {/* ── Services ─────────────────────────────────────── */}
      <main className="hv-section">
        <div className="hv-container">
          {isLoading ? (
            <div className="grid gap-10 md:grid-cols-2" role="status" aria-live="polite">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="hv-skeleton" style={{ aspectRatio: '4/3' }} aria-hidden="true" />
              ))}
            </div>
          ) : isError ? (
            <div className="hv-empty">
              <div className="hv-empty-icon">
                <RefreshCw />
              </div>
              <span className="hv-kicker hv-kicker-center">Something went wrong</span>
              <h2 className="hv-display hv-display-sm" style={{ marginTop: 16 }}>
                Services could not be loaded.
              </h2>
              <p className="hv-lede" style={{ margin: '14px auto 0', textAlign: 'center' }}>
                Please try this section again.
              </p>
              <div style={{ marginTop: 28 }}>
                <button type="button" className="hv-btn hv-btn-solid" onClick={() => void refetch()}>
                  Try again <RefreshCw />
                </button>
              </div>
            </div>
          ) : serviceList.length === 0 ? (
            <div className="hv-empty">
              <div className="hv-empty-icon">
                <ImageIcon />
              </div>
              <span className="hv-kicker hv-kicker-center">Studio services</span>
              <h2 className="hv-display hv-display-sm" style={{ marginTop: 16 }}>
                Tell us about your project.
              </h2>
              <p className="hv-lede" style={{ margin: '14px auto 0', textAlign: 'center' }}>
                We can discuss a custom frame or print and prepare a quote for your size and finish.
              </p>
              <div style={{ marginTop: 28 }}>
                <Link href="/custom-project" className="hv-btn hv-btn-bronze">
                  Request a quote <ArrowRight />
                </Link>
              </div>
            </div>
          ) : (
            <Stagger className="flex flex-col gap-16 md:gap-24">
              {serviceList.map((service, index) => (
                <StaggerItem key={service.id}>
                  <article className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                    <div
                      className={`hv-img-frame hv-frame-double relative ${index % 2 === 1 ? 'md:order-2' : ''}`}
                      style={{ aspectRatio: '4/3' }}
                    >
                      {service.imageUrl ? (
                        <img src={service.imageUrl} alt={service.name} loading="lazy" decoding="async" />
                      ) : (
                        <div className="grid h-full w-full place-items-center" style={{ color: 'var(--hv-faint)' }}>
                          <ImageIcon style={{ width: 48, height: 48 }} />
                        </div>
                      )}
                      <span
                        aria-hidden="true"
                        className="absolute left-6 top-5"
                        style={{
                          fontFamily: '"Fraunces", Georgia, serif',
                          fontSize: 30,
                          fontWeight: 700,
                          color: '#fffdf6',
                          textShadow: '0 2px 14px rgba(0,0,0,0.45)',
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <div className={index % 2 === 1 ? 'md:order-1' : ''}>
                      <span className="hv-badge hv-badge-bronze">Studio service</span>
                      <h2 className="hv-display hv-display-sm" style={{ marginTop: 16 }}>
                        {service.name}
                      </h2>
                      {service.description && (
                        <p className="hv-lede" style={{ marginTop: 14 }}>
                          {service.description}
                        </p>
                      )}
                      {Array.isArray(service.highlights) && service.highlights.length > 0 && (
                        <ul className="flex flex-col gap-3" style={{ marginTop: 20 }}>
                          {service.highlights.map((item: string, itemIndex: number) => (
                            <li
                              key={itemIndex}
                              className="flex items-start gap-3"
                              style={{ color: 'var(--hv-muted)', fontSize: 15, lineHeight: 1.6 }}
                            >
                              <span style={{ color: 'var(--hv-bronze-deep)', flexShrink: 0, marginTop: 3 }}>
                                <Check style={{ width: 16, height: 16 }} />
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div
                        className="flex flex-wrap items-center justify-between gap-6"
                        style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--hv-line-soft)' }}
                      >
                        {service.price ? (
                          <div>
                            <span className="hv-stat-label">Starting from</span>
                            <p className="hv-display hv-display-sm" style={{ marginTop: 6 }}>
                              Rs. {Number(service.price).toLocaleString()}
                              <span style={{ fontSize: 16, color: 'var(--hv-muted)', fontWeight: 500 }}>
                                {' '}
                                / {service.priceType}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <span className="hv-badge hv-badge-ghost">Quote prepared for your project</span>
                        )}
                        <div className="flex flex-wrap items-center gap-5">
                          <Link href="/custom-project" className="hv-btn hv-btn-solid hv-btn-sm">
                            Request this service <ArrowRight />
                          </Link>
                          <Link href={`/contact?subject=Inquiry for ${service.name}`} className="hv-text-link">
                            Enquire <ArrowRight />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </main>

      {serviceList.length > 0 && (
        <>
          {/* ── Process band ─────────────────────────────────── */}
          <section className="hv-dark hv-grain hv-section">
            <div className="hv-container">
              <Reveal>
                <span className="hv-kicker">How it works</span>
                <h2 className="hv-display hv-display-md" style={{ marginTop: 14 }}>
                  From idea to <em>your wall.</em>
                </h2>
                <p className="hv-lede" style={{ marginTop: 14 }}>
                  Every commission moves through the same careful hands — from first conversation to final delivery.
                </p>
              </Reveal>
              <Stagger className="grid gap-10 md:grid-cols-3 mt-12">
                {PROCESS_STEPS.map((step) => (
                  <StaggerItem key={step.num}>
                    <div
                      className="hv-display hv-display-lg"
                      style={{ color: 'var(--hv-gold)', opacity: 0.9 }}
                      aria-hidden="true"
                    >
                      {step.num}
                    </div>
                    <h3 className="hv-display hv-display-sm" style={{ marginTop: 14 }}>
                      {step.title}
                    </h3>
                    <p style={{ color: 'var(--hv-on-dark-muted)', marginTop: 10, lineHeight: 1.75, fontSize: 15 }}>
                      {step.text}
                    </p>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </section>

          {/* ── Closing CTA ──────────────────────────────────── */}
          <section className="hv-section">
            <div className="hv-container">
              <Reveal>
                <div className="hv-card hv-card-hover" style={{ padding: 'clamp(40px, 6vw, 72px)' }}>
                  <span className="hv-kicker">Custom request</span>
                  <h2 className="hv-display hv-display-md" style={{ marginTop: 14 }}>
                    Need a different size<br />
                    or finish?
                  </h2>
                  <p className="hv-lede" style={{ marginTop: 14 }}>
                    Send the details and we will prepare a quote.
                  </p>
                  <div className="flex flex-wrap items-center gap-5" style={{ marginTop: 30 }}>
                    <Link href="/custom-project" className="hv-btn hv-btn-bronze">
                      Request a quote <ArrowRight />
                    </Link>
                    <Link href="/contact" className="hv-text-link">
                      Talk to the studio <ArrowRight />
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
