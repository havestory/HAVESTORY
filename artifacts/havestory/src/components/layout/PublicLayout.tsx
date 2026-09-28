import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetSettings } from '@workspace/api-client-react';
import { Menu, X, Phone, Mail, MapPin, Instagram, Facebook, ArrowRight, ArrowUpRight, ShoppingBag, Sparkles, MessageCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { applyThemeVars } from '@/lib/theme-utils';
import { useShopCart } from '@/lib/shop-cart';
import { ShopCartDrawer } from '@/components/shop/ShopCartDrawer';
import { StudioLoader } from '@/components/StudioLoader';

function safeExternalUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

const WHATSAPP_FAQS = [
  { question: 'What can HAVESTORY make for me?', answer: 'We create custom photo frames, archival prints, collages and studio pieces for homes, gifts, events and businesses.' },
  { question: 'How do I place a custom order?', answer: 'Send us your photo, preferred size and any style ideas. Our team will guide you through the materials, layout and final quote.' },
  { question: 'How long does an order take?', answer: 'Most standard orders are ready within 48 hours. Custom or larger pieces may need a little more time, and we will confirm the timeline before starting.' },
  { question: 'Do you deliver across Sri Lanka?', answer: 'Yes. We offer secure island-wide delivery, with the delivery fee and estimated arrival shared with your quote.' },
  { question: 'Can I ask for the price first?', answer: 'Absolutely. Send the size, quantity and a reference image if you have one. We will reply with a clear estimate before you commit.' },
] as const;

function SpecialEventOverlay({ enabled, type, message }: { enabled?: boolean; type?: string | null; message?: string | null }) {
  if (!enabled) return null;
  const eventType = type || 'custom';
  const labels: Record<string, string> = {
    'new-year': 'A bright new chapter begins',
    valentine: 'Made with love, shared with heart',
    christmas: 'Seasonal wishes from HAVESTORY',
    eid: 'A season of light and togetherness',
    custom: 'A special moment is here',
  };
  const label = message || labels[eventType] || labels.custom;
  return (
    <div className={`special-event-overlay special-event-${eventType}`} aria-hidden="true">
      <div className="special-event-banner"><Sparkles size={14} /> <span>{label}</span></div>
      <div className="special-event-particles">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className="special-event-particle"
            style={{
              left: `${(index * 37) % 101}%`,
              animationDelay: `${(index % 9) * -0.8}s`,
              animationDuration: `${6 + (index % 5)}s`,
            }}
          />
        ))}
      </div>
      {eventType === 'new-year' && (
        <div className="special-event-bursts">
          {Array.from({ length: 4 }, (_, index) => <span key={index} style={{ animationDelay: `${index * -1.1}s` }} />)}
        </div>
      )}
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location]   = useLocation();
  const { data: settings, isLoading: settingsLoading, isError: settingsError, refetch: refetchSettings } = useGetSettings();
  const { count: cartCount } = useShopCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [waFaqOpen, setWaFaqOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(available > 0 ? Math.min(100, (window.scrollY / available) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setWaFaqOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 1020px)');
    const syncNavigationMode = (event: MediaQueryListEvent | MediaQueryList) => {
      setMobileNav(event.matches);
      if (!event.matches) {
        setMenuOpen(false);
        document.body.style.overflow = '';
      }
    };
    syncNavigationMode(mobile);
    mobile.addEventListener('change', syncNavigationMode);
    return () => mobile.removeEventListener('change', syncNavigationMode);
  }, []);

  useEffect(() => {
    if (!waFaqOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWaFaqOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [waFaqOpen]);

  useEffect(() => {
    const refreshSettings = () => { void refetchSettings(); };
    const onAdminSave = () => refreshSettings();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'hs_admin_saved_at') refreshSettings();
    };
    window.addEventListener('hs:admin-saved', onAdminSave);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('hs:admin-saved', onAdminSave);
      window.removeEventListener('storage', onStorage);
    };
  }, [refetchSettings]);

  const publicThemePreset = 'atelier-light';

  useEffect(() => {
    document.documentElement.dataset.hsPublicTheme = 'heritage';
    return () => { delete document.documentElement.dataset.hsPublicTheme; };
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyThemeVars(publicThemePreset);
    document.title = settings.seoTitle || `${settings.businessName || 'HAVESTORY'} — Premium Photo Frames`;

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content?: string | null) => {
      if (!content) return;
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };
    setMeta('meta[name="description"]', 'name', 'description', settings.seoDescription);
    setMeta('meta[name="keywords"]', 'name', 'keywords', settings.seoKeywords);
    setMeta('meta[property="og:image"]', 'property', 'og:image', settings.seoOgImage);

    if (settings.faviconUrl) {
      let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement('link');
        icon.rel = 'icon';
        document.head.appendChild(icon);
      }
      icon.href = settings.faviconUrl;
    }
  }, [settings, publicThemePreset]);

  if (!settings && settingsLoading) {
    return (
      <div data-public-site="" className="hv-page min-h-[100dvh]">
        <div className="grid min-h-[100dvh] place-items-center"><StudioLoader label="Loading HAVESTORY" /></div>
      </div>
    );
  }

  if (!settings && settingsError) {
    return (
      <main data-public-site="" className="hv-page min-h-[100dvh] flex items-center justify-center px-6">
        <div className="hv-card max-w-md p-8 text-center">
          <p className="hv-kicker hv-kicker-center justify-center">HAVESTORY</p>
          <h1 className="hv-display hv-display-sm mt-4">The studio is taking a moment.</h1>
          <p className="hv-lede mt-3 text-sm">Please refresh to load the latest studio details.</p>
          <button type="button" onClick={() => void refetchSettings()} className="hv-btn hv-btn-solid hv-btn-sm mt-6">Try again</button>
        </div>
      </main>
    );
  }

  if (settings?.siteClosedEnabled) {
    return (
      <main data-public-site="" className="hv-page hv-dark min-h-[100dvh] flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <div className="hv-ornament mb-8"><Sparkles size={16} /></div>
          <p className="hv-kicker hv-kicker-center justify-center">Studio Notice</p>
          <h1 className="hv-display hv-display-lg mt-4">{settings.businessName || 'HAVESTORY'}</h1>
          <p className="hv-lede mx-auto mt-6 text-center">{settings.siteClosedMessage || 'Our website is temporarily unavailable. Please check back soon.'}</p>
          {settings.whatsappNumber && (
            <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} className="hv-btn hv-btn-bronze mt-8">Contact on WhatsApp</a>
          )}
        </div>
      </main>
    );
  }

  const whatsappDigits = settings?.whatsappNumber?.replace(/[^0-9]/g, '') || '';
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : '';

  const navLinks = [
    { href: '/',             label: 'Home' },
    { href: '/store',        label: 'Frames & Prints' },
    { href: '/services',     label: 'Studio Services' },
    { href: '/gallery',      label: 'Gallery' },
    { href: '/track-order',  label: 'Track Order' },
    { href: '/about',        label: 'Our Story' },
    { href: '/contact',      label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    if (href === '/gallery')  return location === '/gallery'  || location === '/portfolio';
    if (href === '/store')    return location === '/store'    || location === '/frames-and-prints';
    if (href === '/services') return location === '/services' || location === '/studio-services';
    return location.startsWith(href);
  };

  const brandName = settings?.businessName || 'HAVESTORY';

  return (
    <div data-public-site="" className="hv-page min-h-[100dvh] flex flex-col relative overflow-x-clip">

      <div className="hv-scroll-progress" aria-hidden="true"><span style={{ transform: `scaleX(${scrollProgress / 100})` }} /></div>

      <header className={`hv-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="hv-header-inner">
          <Link href="/" className="hv-brand" aria-label={`${brandName} home`}>
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt={brandName} />
              : <span className="hv-brand-monogram">H</span>
            }
            {settings?.showNameWithLogo !== false && (
              <span className="hv-brand-copy">
                <strong>{brandName}</strong>
                {settings?.taglineEnabled !== false && settings?.tagline && <small>{settings.tagline}</small>}
              </span>
            )}
          </Link>
          <nav className="hv-nav" aria-label="Primary">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? 'is-active' : ''}>{l.label}</Link>
            ))}
          </nav>
          <div className="hv-header-actions">
            <Link href="/custom-project" className="hv-btn hv-btn-ghost hv-btn-sm hidden lg:inline-flex">Get a quote</Link>
            {mobileNav && (
              <button
                type="button"
                className="hv-menu-btn"
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                aria-controls="public-mobile-drawer"
                onClick={() => setMenuOpen(open => !open)}
              >
                {menuOpen ? <X /> : <Menu />}
              </button>
            )}
            <ShopCartDrawer trigger={
              <button type="button" className="hv-cart-btn" aria-label={`Open shopping cart with ${cartCount} items`}>
                <ShoppingBag />
                {cartCount > 0 && <span className="hv-cart-count">{cartCount}</span>}
              </button>
            } />
          </div>
        </div>
      </header>

      <SpecialEventOverlay
        enabled={settings?.specialEventEnabled}
        type={settings?.specialEventType}
        message={settings?.specialEventMessage}
      />

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileNav && menuOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="hv-drawer-overlay"
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              id="public-mobile-drawer"
              className="hv-drawer"
              aria-label="Mobile navigation"
            >
              <div className="hv-drawer-head">
                <span className="hv-brand-copy"><strong>{brandName}</strong></span>
                <button type="button" onClick={() => setMenuOpen(false)} className="hv-drawer-close" aria-label="Close menu"><X /></button>
              </div>
              <nav>
                {navLinks.map((l, i) => (
                  <motion.div
                    key={l.href}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link href={l.href} className={isActive(l.href) ? 'is-active' : ''}>
                      {l.label}<ArrowUpRight />
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + navLinks.length * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href="/custom-project">Custom Project<ArrowUpRight /></Link>
                </motion.div>
              </nav>
              <div className="hv-drawer-foot">
                {settings?.phone && (
                  <a href={`tel:${settings.phone}`} className="hv-text-link"><Phone size={15} /> {settings.phone}</a>
                )}
                <Link href="/custom-project" className="hv-btn hv-btn-bronze w-full">Get a quote <ArrowRight /></Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Page content ── */}
      <div className="flex-1">
        {children}
      </div>

      <footer className="hv-footer hv-grain" aria-label="HAVESTORY studio footer">
        <div className="hv-container">
          <div className="hv-footer-cta">
            <div>
              <p className="hv-kicker">Begin your story</p>
              <h2 className="hv-display hv-display-md mt-4" style={{ color: 'var(--hv-on-dark)' }}>
                Let's frame what <em>matters.</em>
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/store" className="hv-btn hv-btn-bronze">Browse frames <ArrowRight /></Link>
              <Link href="/custom-project" className="hv-btn hv-btn-outline-light">Custom project</Link>
            </div>
          </div>
          <div className="hv-footer-grid">
            <div className="hv-footer-brand">
              <Link href="/" className="hv-brand" aria-label={`${brandName} home`}>
                {settings?.logoUrl
                  ? <img src={settings.logoUrl} alt={brandName} />
                  : <span className="hv-brand-monogram">H</span>
                }
                <span className="hv-brand-copy">
                  <strong style={{ color: 'var(--hv-on-dark)' }}>{brandName}</strong>
                  {settings?.taglineEnabled !== false && settings?.tagline && <small>{settings.tagline}</small>}
                </span>
              </Link>
              <p>{(settings as any)?.footerAboutText || 'A Sri Lankan creative studio crafting premium photo frames, fine-art prints and story galleries — made to keep your moments beautifully.'}</p>
            </div>
            <div>
              <h4>Studio</h4>
              {settings?.address && <span className="hv-footer-contact"><MapPin aria-hidden="true" />{settings.address}</span>}
              {settings?.phone && <a className="hv-footer-contact" href={`tel:${settings.phone}`}><Phone aria-hidden="true" />{settings.phone}</a>}
              {settings?.email && <a className="hv-footer-contact" href={`mailto:${settings.email}`}><Mail aria-hidden="true" />{settings.email}</a>}
            </div>
            <div>
              <h4>Explore</h4>
              {[
                { href: '/store', label: 'Frames & Prints' },
                { href: '/services', label: 'Studio Services' },
                { href: '/gallery', label: 'Gallery' },
                { href: '/custom-project', label: 'Custom Project' },
                { href: '/track-order', label: 'Track Order' },
              ].map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            </div>
            <div>
              <h4>Connect</h4>
              {safeExternalUrl(settings?.instagramUrl) && <a href={safeExternalUrl(settings?.instagramUrl)!} target="_blank" rel="noopener noreferrer"><Instagram /> Instagram</a>}
              {safeExternalUrl(settings?.facebookUrl) && <a href={safeExternalUrl(settings?.facebookUrl)!} target="_blank" rel="noopener noreferrer"><Facebook /> Facebook</a>}
              {settings?.whatsappNumber && <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}
              <Link href="/contact"><Mail /> Contact us</Link>
              <Link href="/about"><Sparkles /> Our story</Link>
            </div>
          </div>
          <div className="hv-footer-word" aria-hidden="true">{brandName}</div>
          <div className="hv-footer-base">
            <span>{(settings as any)?.footerCopyrightText || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}</span>
            <span className="flex gap-5">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              {(settings as any)?.footerDeveloperCredit && (
                safeExternalUrl((settings as any)?.footerDeveloperUrl)
                  ? <a href={safeExternalUrl((settings as any).footerDeveloperUrl)!} target="_blank" rel="noopener noreferrer">{(settings as any).footerDeveloperCredit}</a>
                  : <span>{(settings as any).footerDeveloperCredit}</span>
              )}
            </span>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp FAB + FAQ ── */}
      {whatsappHref && (
        <div className="hv-wa-float">
          <AnimatePresence>
            {waFaqOpen && (
              <motion.div
                key="whatsapp-faq"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                role="dialog"
                aria-label="Frequently asked questions"
                className="hv-card w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-3xl!"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[rgba(23,19,16,0.08)] bg-[rgba(37,211,102,0.07)] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#168c45]">HAVESTORY support</p>
                    <h3 className="hv-display text-xl mt-1">How can we help?</h3>
                  </div>
                  <button type="button" onClick={() => setWaFaqOpen(false)} aria-label="Close WhatsApp FAQs" className="hv-drawer-close w-9! h-9!"><X className="h-4 w-4" /></button>
                </div>
                <div className="max-h-[min(54vh,20rem)] overflow-y-auto px-5 py-2">
                  {WHATSAPP_FAQS.map((faq, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div key={faq.question} className="border-b border-[rgba(23,19,16,0.07)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-3 py-3 text-left text-[12.5px] font-bold leading-snug transition-colors hover:text-[#168c45]"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-[#25D366] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-3 pr-5 text-[12px] leading-relaxed text-[#6f6259]">
                              {faq.answer}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3">
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="hv-btn hv-btn-sm hv-btn-wa w-full">
                    <MessageCircle /> Chat with the studio
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setWaFaqOpen(open => !open)}
            aria-label={waFaqOpen ? 'Close WhatsApp FAQs' : 'Open WhatsApp FAQs'}
            aria-expanded={waFaqOpen}
            className="hv-wa-btn"
          >
            {waFaqOpen ? <X /> : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.334.101.154.453.721.969 1.18.665.59 1.221.77 1.378.857.156.087.248.072.338-.029.091-.101.393-.457.497-.614.104-.157.208-.13.346-.079l2.179 1.031c.144.072.239.116.275.18.036.065.036.375-.108.78z"/>
              </svg>
            )}
            <span className="sr-only">WhatsApp FAQs and chat</span>
          </button>
        </div>
      )}

    </div>
  );
}
