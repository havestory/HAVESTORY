import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetSettings } from '@workspace/api-client-react';
import { Menu, X, Phone, Mail, MapPin, Instagram, Facebook, ArrowRight, ShoppingBag, Sparkles, MessageCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { applyThemeVars } from '@/lib/theme-utils';
import { useShopCart } from '@/lib/shop-cart';
import { ShopCartDrawer } from '@/components/shop/ShopCartDrawer';

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
  const [showWa,   setShowWa]   = useState(false);
  const [waFaqOpen, setWaFaqOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setShowWa(window.scrollY > 200);
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
    const mobile = window.matchMedia('(max-width: 780px)');
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
    if (!showWa) setWaFaqOpen(false);
  }, [showWa]);

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

  // HAVESTORY now has one intentionally art-directed public palette. Keeping
  // this fixed prevents an old saved preset from producing mixed page styles.
  const publicThemePreset = 'atelier-light';
  const isLightTheme = true;

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

  // Keep the first public paint stable. Previously the children, header and
  // footer mounted with hardcoded copy and swapped to settings a moment later.
  // Background refetches keep the existing settings object and therefore do
  // not interrupt an already-rendered page.
  if (!settings && settingsLoading) {
    return (
      <div data-public-site="" className="atelier-shell min-h-[100dvh] bg-[hsl(var(--background))]">
        <div className="hs-route-loader" role="status" aria-live="polite" aria-label="Loading HAVESTORY">
          <div>
            <span>HAVESTORY</span>
            <strong>Preparing your studio</strong>
            <p>Loading the latest HAVESTORY settings</p>
            <div><i /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings && settingsError) {
    return (
      <main data-public-site="" className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex items-center justify-center px-6">
        <div className="max-w-md rounded-[28px] border border-[hsl(var(--border))] bg-white/70 p-8 text-center shadow-[0_20px_60px_rgba(53,25,67,.08)] backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6d3f86]">HAVESTORY</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold">The studio is taking a moment.</h1>
          <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Please refresh to load the latest studio details.</p>
          <button type="button" onClick={() => void refetchSettings()} className="mt-6 rounded-full bg-[#29153d] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-transform active:scale-95">Try again</button>
        </div>
      </main>
    );
  }

  if (settings?.siteClosedEnabled) {
    return (
      <main data-public-site="" className="min-h-[100dvh] bg-[#0A0907] text-white flex items-center justify-center px-6">
        <div className="max-w-xl text-center border border-[#C9A84C]/25 bg-[#C9A84C]/5 p-10 sm:p-14">
          <div className="w-12 h-px bg-[#C9A84C] mx-auto mb-8" />
          <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-[0.24em] mb-4">Studio Notice</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold">{settings.businessName || 'HAVESTORY'}</h1>
          <p className="text-white/60 leading-relaxed mt-6">{settings.siteClosedMessage || 'Our website is temporarily unavailable. Please check back soon.'}</p>
          {settings.whatsappNumber && (
            <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} className="inline-flex mt-8 bg-[#C9A84C] text-[#0A0907] px-6 py-3 text-xs font-bold uppercase tracking-widest">
              Contact on WhatsApp
            </a>
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
    { href: '/about',        label: 'About' },
    { href: '/contact',      label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    if (href === '/gallery')  return location === '/gallery'  || location === '/portfolio';
    if (href === '/store')    return location === '/store'    || location === '/frames-and-prints';
    if (href === '/services') return location === '/services' || location === '/studio-services';
    return location.startsWith(href);
  };

  // The visual state is handled by the single Glass Gallery shell layer.
  // Keeping the state semantic prevents legacy Tailwind background utilities from winning in the cascade.
  const navBg = scrolled ? 'public-nav-scrolled' : 'public-nav-idle';

  return (
    <div data-public-site="" data-public-theme={publicThemePreset} className="atelier-shell glass-gallery-shell min-h-[100dvh] flex flex-col bg-[hsl(var(--background))] relative overflow-x-clip">

      <header className={`hsx-shell-header fixed inset-x-0 top-0 z-40 ${navBg}`}>
        <div className="hsx-announcement">
          <span>COLOUR LAB · FRAME STUDIO · MADE IN SRI LANKA</span>
          <span>Custom orders open <ArrowRight /></span>
        </div>
        <div className="hsx-shell-nav">
          <Link href="/" className="hsx-shell-brand">
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt={settings.businessName || 'HAVESTORY'} />
              : <span className="hsx-shell-monogram">HS</span>
            }
            {settings?.showNameWithLogo !== false && <strong>{settings?.businessName || 'HAVESTORY'}</strong>}
          </Link>
          <nav className="hsx-shell-links">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? 'is-active' : ''}>{l.label}</Link>
            ))}
          </nav>
          <div className="hsx-shell-actions">
            {mobileNav && <button
              type="button"
              className="hsx-mobile-menu-button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-drawer"
              onClick={() => setMenuOpen(open => !open)}
            >
              {menuOpen ? <X /> : <span className="hsx-liquid-menu-icon" aria-hidden="true"><i /><i /><i /></span>}
            </button>}
            <ShopCartDrawer trigger={<button type="button" className="hsx-header-cart" aria-label={`Open shopping cart with ${cartCount} items`}><ShoppingBag />{cartCount > 0 && <span>{cartCount}</span>}</button>} />
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
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm xl:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              id="public-mobile-drawer"
              className="atelier-drawer glass-gallery-drawer fixed right-0 top-0 h-[100dvh] w-[min(23rem,calc(100vw-1rem))] max-w-full overscroll-contain z-50 border-l border-[hsl(var(--border))] flex flex-col xl:hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-6 py-6 border-b ${isLightTheme ? 'border-[hsl(var(--border))]' : 'border-[#1E1A14]'}`}>
                <span className="font-serif font-bold text-xl text-[hsl(var(--foreground))]">{settings?.businessName || 'HAVESTORY'}</span>
                <button onClick={() => setMenuOpen(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[#C9A84C] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-6 py-8 flex flex-col">
                {navLinks.map((l, i) => (
                  <motion.div
                    key={l.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={l.href}
                      className={`atelier-mobile-link block py-4 font-serif text-2xl font-semibold border-b transition-colors ${
                        isActive(l.href) ? 'text-[#C9A84C]' : 'text-[hsl(var(--foreground)/0.75)] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: navLinks.length * 0.05 }}>
                  <Link href="/custom-project" className="atelier-mobile-link block py-4 font-serif text-2xl font-semibold border-b text-[hsl(var(--foreground)/0.75)] hover:text-[hsl(var(--foreground))] transition-colors">
                    Custom Project
                  </Link>
                </motion.div>
              </nav>
              <div className="px-6 pb-8 space-y-3">
                {settings?.phone && (
                  <a href={`tel:${settings.phone}`} className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[#C9A84C] transition-colors">
                    <Phone className="w-4 h-4" />{settings.phone}
                  </a>
                )}
                <Link href="/contact" className="block w-full text-center bg-[#C9A84C] text-[#0A0907] text-xs font-bold uppercase tracking-widest px-4 py-3 hover:bg-[#D4B55E] transition-colors">
                  Get a Quote
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Page content ── */}
      <main className="hsx-main flex-1">
        {children}
      </main>

      <footer className="hsx-footer" aria-label="HAVESTORY studio footer">
        <div className="hsx-footer-top">
          <div className="hsx-footer-signature">
            {settings?.logoUrl && <img src={settings.logoUrl} alt={settings.businessName || 'HAVESTORY'} />}
            <div>
              <span>THE COLOUR &amp; FRAME STUDIO</span>
              <h2>{settings?.businessName || 'HAVESTORY'}</h2>
            </div>
          </div>
          <p>{settings?.tagline || 'Photographs made tangible. Stories made to stay.'}</p>
        </div>
        <div className="hsx-footer-grid">
          <div>
            <p>Studio</p>
            {settings?.address && <span className="hsx-footer-contact"><MapPin aria-hidden="true" />{settings.address}</span>}
            {settings?.phone && <a className="hsx-footer-contact" href={`tel:${settings.phone}`}><Phone aria-hidden="true" />{settings.phone}</a>}
            {settings?.email && <a className="hsx-footer-contact" href={`mailto:${settings.email}`}><Mail aria-hidden="true" />{settings.email}</a>}
          </div>
          <div>
            <p>Shop &amp; create</p>
            {[{ href: '/store', label: 'Frames & Prints' }, { href: '/services', label: 'Studio Services' }, { href: '/gallery', label: 'Gallery' }, { href: '/custom-project', label: 'Custom Project' }].map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </div>
          <div>
            <p>Help</p>
            {[{ href: '/track-order', label: 'Track Order' }, { href: '/contact', label: 'Contact' }, { href: '/about', label: 'Our Studio' }, { href: '/privacy', label: 'Privacy' }, { href: '/terms', label: 'Terms' }].map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </div>
          <div>
            <p>Stay connected</p>
            {settings?.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer"><Instagram /> Instagram</a>}
            {settings?.facebookUrl && <a href={settings.facebookUrl} target="_blank" rel="noreferrer"><Facebook /> Facebook</a>}
            {settings?.whatsappNumber && <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}
          </div>
        </div>
        <div className="hsx-footer-base">
          <span>{(settings as any)?.footerCopyrightText || `© ${new Date().getFullYear()} ${settings?.businessName || 'HAVESTORY'}`}</span>
          {(settings as any)?.footerDeveloperCredit && (
            (settings as any)?.footerDeveloperUrl
              ? <a href={(settings as any).footerDeveloperUrl} target="_blank" rel="noreferrer">{(settings as any).footerDeveloperCredit}</a>
              : <span>{(settings as any).footerDeveloperCredit}</span>
          )}
        </div>
      </footer>

      {/* ── WhatsApp FAB + FAQ ── */}
      {whatsappHref && (
        <motion.div
          initial={false}
          animate={{ opacity: showWa ? 1 : 0, y: showWa ? 0 : 12, scale: showWa ? 1 : 0.86 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ pointerEvents: showWa ? 'auto' : 'none' }}
          className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 sm:right-5"
        >
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
                className="w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#25D366]/25 bg-[hsl(var(--popover)/0.98)] text-[hsl(var(--popover-foreground))] shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] bg-[#25D366]/[0.08] px-4 py-3.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#168c45]">HAVESTORY support</p>
                    <h3 className="mt-1 font-serif text-xl font-bold leading-tight text-[hsl(var(--popover-foreground))]">How can we help?</h3>
                  </div>
                  <button type="button" onClick={() => setWaFaqOpen(false)} aria-label="Close WhatsApp FAQs" className="rounded-full p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><X className="h-4 w-4" /></button>
                </div>
                <div className="max-h-[min(54vh,20rem)] overflow-y-auto px-3 py-2">
                  {WHATSAPP_FAQS.map((faq, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div key={faq.question} className="border-b border-[hsl(var(--border)/0.72)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-3 py-3 text-left text-[12px] font-bold leading-snug text-[hsl(var(--popover-foreground))] transition-colors hover:text-[#168c45]"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-[#25D366] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pb-3 pr-5 text-[11px] font-medium leading-relaxed text-[hsl(var(--muted-foreground))]">
                              {faq.answer}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-[hsl(var(--border))] p-3">
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#073b1d] transition-colors hover:bg-[#58e788]">
                    <MessageCircle className="h-4 w-4" /> Chat with the studio
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
            className="group flex h-14 w-14 items-center justify-center rounded-full border-4 border-white/85 bg-[#25D366] text-white shadow-[0_10px_30px_rgba(37,211,102,0.36)] transition-transform duration-200 hover:scale-105 active:scale-95 animate-wa-pulse sm:h-16 sm:w-16"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-current sm:h-8 sm:w-8">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.334.101.154.453.721.969 1.18.665.59 1.221.77 1.378.857.156.087.248.072.338-.029.091-.101.393-.457.497-.614.104-.157.208-.13.346-.079l2.179 1.031c.144.072.239.116.275.18.036.065.036.375-.108.78z"/>
            </svg>
            <span className="sr-only">WhatsApp FAQs and chat</span>
          </button>
        </motion.div>
      )}

    </div>
  );
}
