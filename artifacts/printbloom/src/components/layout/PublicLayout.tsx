import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetSettings } from '@workspace/api-client-react';
import { Menu, X, Phone, Mail, Instagram, Facebook, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [showWa, setShowWa]                 = useState(false);
  const [showCta, setShowCta]               = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      setShowWa(window.scrollY > 200);
      setShowCta(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [location]);

  const navLinks = [
    { href: '/',              label: 'Home' },
    { href: '/store',         label: 'Frames & Prints' },
    { href: '/services',      label: 'Studio Services' },
    { href: '/gallery',       label: 'Gallery' },
    { href: '/track-order',   label: 'Track Order' },
    { href: '/about',         label: 'About' },
    { href: '/contact',       label: 'Contact' },
  ];

  // route matching — gallery maps to /portfolio, store to /store, services to /services
  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    if (href === '/gallery')  return location === '/gallery' || location === '/portfolio';
    if (href === '/store')    return location === '/store' || location === '/frames-and-prints';
    if (href === '/services') return location === '/services' || location === '/studio-services';
    return location.startsWith(href);
  };

  const isHome        = location === '/';
  const isTransparent = isHome && !scrolled;

  const headerBase = 'fixed w-full z-40 transition-all duration-300 h-16';
  const headerTheme = isTransparent
    ? 'bg-transparent border-transparent text-white'
    : 'bg-background/96 backdrop-blur-md border-b border-border shadow-sm text-foreground';

  const linkCls = (href: string) => {
    const active = isActive(href);
    const base   = 'text-xs font-semibold uppercase tracking-widest transition-colors duration-200 pb-0.5';
    const color  = active
      ? 'text-secondary border-b border-secondary'
      : isTransparent ? 'text-white/85 hover:text-white' : 'text-foreground/70 hover:text-secondary';
    return `${base} ${color}`;
  };

  const topBarOffset = 'top-0 md:top-[34px]';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative">

      {/* ── Top info bar ── */}
      <div className="hidden md:flex bg-primary text-primary-foreground py-2 px-8 justify-between items-center text-xs tracking-wide z-50 relative border-b border-white/10">
        <div className="flex items-center gap-6">
          {settings?.phone && (
            <a href={`tel:${settings.phone}`} className="flex items-center gap-1.5 hover:text-secondary transition-colors">
              <Phone className="w-3 h-3 opacity-60" />{settings.phone}
            </a>
          )}
          {settings?.email && (
            <a href={`mailto:${settings.email}`} className="flex items-center gap-1.5 hover:text-secondary transition-colors">
              <Mail className="w-3 h-3 opacity-60" />{settings.email}
            </a>
          )}
        </div>
        <div className="flex items-center gap-4">
          {settings?.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors"><Instagram className="w-3.5 h-3.5" /></a>
          )}
          {settings?.facebookUrl && (
            <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors"><Facebook className="w-3.5 h-3.5" /></a>
          )}
        </div>
      </div>

      {/* ── Main navbar ── */}
      <header className={`${headerBase} ${headerTheme} ${topBarOffset}`}>
        <div className="max-w-7xl mx-auto px-5 h-full flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            {settings?.logo
              ? <img src={settings.logo} alt={settings.businessName || 'HAVESTORY'} className="h-8 w-auto object-contain" />
              : (
                <div className={`w-8 h-8 flex items-center justify-center font-serif font-bold text-sm border ${isTransparent ? 'bg-white/10 border-white/30 text-white' : 'bg-primary text-primary-foreground border-primary'}`}>
                  HS
                </div>
              )
            }
            <div className="hidden sm:block">
              <div className={`font-serif font-bold text-base leading-none ${isTransparent ? 'text-white' : 'text-foreground'}`}>
                {settings?.businessName || 'HAVESTORY'}
              </div>
              {settings?.tagline && (
                <div className={`text-[9px] uppercase tracking-[0.2em] leading-none mt-0.5 ${isTransparent ? 'text-white/50' : 'text-muted-foreground'}`}>
                  {settings.tagline}
                </div>
              )}
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href} className={linkCls(l.href)}>{l.label}</Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Cart icon → /store */}
            <Link href="/store" className={`relative p-2 hover:text-secondary transition-colors ${isTransparent ? 'text-white/80' : 'text-foreground/70'}`} title="Frames & Prints">
              <ShoppingBag className="w-5 h-5" />
            </Link>

            <Button asChild size="sm" className={`hidden lg:flex items-center gap-2 uppercase text-[10px] tracking-widest font-bold h-9 px-5 btn-glow rounded-none border-none ${isTransparent ? 'bg-white/15 text-white hover:bg-white hover:text-primary' : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'}`}>
              <Link href="/contact">Get a Quote</Link>
            </Button>

            {/* Hamburger */}
            <button
              className={`lg:hidden p-2 ${isTransparent ? 'text-white' : 'text-foreground'}`}
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute right-0 top-0 h-full w-72 bg-primary text-primary-foreground flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <span className="font-serif font-bold text-lg">{settings?.businessName || 'HAVESTORY'}</span>
              <button onClick={() => setMobileMenuOpen(false)}><X className="w-5 h-5 text-white/70" /></button>
            </div>
            <nav className="flex-1 px-6 py-8 flex flex-col gap-1">
              {navLinks.map(l => (
                <Link
                  key={l.href} href={l.href}
                  className={`py-3 font-serif text-2xl font-semibold transition-colors border-b border-white/8 ${isActive(l.href) ? 'text-secondary' : 'text-primary-foreground/80 hover:text-white'}`}
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/custom-project" className="py-3 font-serif text-2xl font-semibold text-primary-foreground/80 hover:text-white border-b border-white/8 transition-colors">
                Custom Project
              </Link>
            </nav>
            <div className="px-6 pb-8">
              {settings?.phone && (
                <a href={`tel:${settings.phone}`} className="flex items-center gap-2 text-sm text-primary-foreground/60 hover:text-white mb-2 transition-colors">
                  <Phone className="w-4 h-4" />{settings.phone}
                </a>
              )}
              <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 uppercase tracking-widest text-xs font-bold h-12 rounded-none mt-4">
                <Link href="/contact">Get a Quote</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 pt-16 md:pt-[calc(4rem+34px)]">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-primary text-primary-foreground pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12">

            {/* Brand */}
            <div className="md:col-span-1">
              <div className="font-serif text-2xl font-bold mb-2">{settings?.businessName || 'HAVESTORY'}</div>
              {settings?.tagline && <p className="text-primary-foreground/55 text-sm mb-4">{settings.tagline}</p>}
              <p className="text-primary-foreground/50 text-xs leading-relaxed mb-5">
                Premium photo frames, colour lab prints and custom studio work. Crafted in Sri Lanka.
              </p>
              <div className="flex items-center gap-3">
                {settings?.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="w-8 h-8 border border-white/20 flex items-center justify-center text-primary-foreground/60 hover:text-secondary hover:border-secondary transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {settings?.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="w-8 h-8 border border-white/20 flex items-center justify-center text-primary-foreground/60 hover:text-secondary hover:border-secondary transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <p className="section-label text-secondary mb-4">Quick Links</p>
              <ul className="space-y-2">
                {[
                  { href: '/',              label: 'Home' },
                  { href: '/store',         label: 'Frames & Prints' },
                  { href: '/services',      label: 'Studio Services' },
                  { href: '/gallery',       label: 'Gallery' },
                  { href: '/custom-project',label: 'Custom Project' },
                ].map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-primary-foreground/55 hover:text-secondary text-sm transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Info */}
            <div>
              <p className="section-label text-secondary mb-4">Information</p>
              <ul className="space-y-2">
                {[
                  { href: '/about',        label: 'About Us' },
                  { href: '/contact',      label: 'Contact' },
                  { href: '/track-order',  label: 'Track Your Order' },
                  { href: '/privacy',      label: 'Privacy Policy' },
                  { href: '/terms',        label: 'Terms of Service' },
                ].map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-primary-foreground/55 hover:text-secondary text-sm transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="section-label text-secondary mb-4">Contact</p>
              <ul className="space-y-3 text-sm text-primary-foreground/60">
                {settings?.phone && (
                  <li><a href={`tel:${settings.phone}`} className="hover:text-secondary transition-colors flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" />{settings.phone}</a></li>
                )}
                {settings?.email && (
                  <li><a href={`mailto:${settings.email}`} className="hover:text-secondary transition-colors flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" />{settings.email}</a></li>
                )}
                {settings?.address && (
                  <li className="leading-relaxed">{settings.address}</li>
                )}
              </ul>
              {settings?.whatsappNumber && (
                <a
                  href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 mt-5 bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] text-xs uppercase tracking-widest font-semibold px-4 py-2 hover:bg-[#25D366] hover:text-white transition-colors"
                >
                  WhatsApp Us
                </a>
              )}
            </div>
          </div>

          <div className="gold-rule mb-6" />
          <p className="text-xs text-primary-foreground/40 text-center tracking-wide">
            © {new Date().getFullYear()} {settings?.businessName || 'HAVESTORY'}. All rights reserved. · Sri Lanka
          </p>
        </div>
      </footer>

      {/* ── WhatsApp FAB ── */}
      {settings?.whatsappNumber && (
        <a
          href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
          target="_blank" rel="noreferrer"
          className={`fixed bottom-24 right-5 w-13 h-13 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg z-40 animate-pulse-ring transition-all duration-300 ${showWa ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
          style={{ width: 52, height: 52 }}
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.334.101.154.453.721.969 1.18.665.59 1.221.77 1.378.857.156.087.248.072.338-.029.091-.101.393-.457.497-.614.104-.157.208-.13.346-.079l2.179 1.031c.144.072.239.116.275.18.036.065.036.375-.108.78z"/>
          </svg>
        </a>
      )}

      {/* ── Sticky "Order a Frame" CTA ── */}
      <motion.div
        initial={false}
        animate={{ opacity: showCta ? 1 : 0, y: showCta ? 0 : 16, scale: showCta ? 1 : 0.92 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: showCta ? 'auto' : 'none' }}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 md:left-auto md:right-5 md:translate-x-0 z-50"
      >
        <Link
          href="/store"
          className="flex items-center gap-2 bg-secondary text-secondary-foreground rounded-full px-6 py-3 text-sm font-semibold shadow-xl cta-pulse border-0 whitespace-nowrap"
        >
          🖼 Order a Frame <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}
