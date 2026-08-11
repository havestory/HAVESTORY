import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetSettings } from '@workspace/api-client-react';
import { Menu, X, Printer, Phone, MapPin, Mail, Instagram, Facebook, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrolledPast200, setScrolledPast200] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setScrolledPast200(window.scrollY > 200);
      setScrolledPastHero(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/services', label: 'Services' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/store', label: 'Store' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  const isHome = location === '/';
  const isTransparent = isHome && !scrolled;
  const headerClasses = isTransparent
    ? 'bg-transparent py-3 border-transparent shadow-none text-white' 
    : 'bg-background/95 backdrop-blur-sm py-3 border-b border-border shadow-sm text-foreground';

  const linkClasses = (href: string) => {
    const isActive = location === href;
    const base = 'font-sans text-sm uppercase tracking-wider transition-colors pb-0.5';
    const active = isActive ? 'text-secondary border-b border-secondary' : '';
    const inactive = isTransparent ? 'text-white/90 hover:text-secondary' : 'text-foreground/80 hover:text-secondary';
    return `${base} ${isActive ? active : inactive}`;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-secondary selection:text-secondary-foreground relative">
      {/* Top Bar - Desktop only */}
      <div className="hidden md:flex bg-primary text-primary-foreground py-2 px-8 justify-between items-center text-xs tracking-wide z-50 relative border-b border-white/10">
        <div className="flex items-center gap-6">
          {settings?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" />
              <span>{settings.phone}</span>
            </div>
          )}
          {settings?.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              <span>{settings.email}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-5">
          {settings?.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {settings?.facebookUrl && (
            <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <header className={`fixed w-full z-40 transition-all duration-300 top-0 md:top-[34px] h-16 ${headerClasses}`}>
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="flex flex-col justify-center">
              <span className="font-serif font-bold text-xl leading-none">{settings?.businessName || 'HAVESTORY'}</span>
              <span className="section-label mt-1.5 leading-none !text-[9px] !tracking-[0.2em]">{settings?.tagline || 'PREMIUM FRAMES'}</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={linkClasses(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button asChild className="bg-secondary text-secondary-foreground btn-glow text-xs uppercase tracking-widest px-5 h-9 rounded-[0.25rem] border-none font-semibold">
              <Link href="/contact">Get a Quote</Link>
            </Button>
          </div>

          <button 
            className="lg:hidden p-2 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[64px] md:top-[98px] z-50 bg-background flex flex-col lg:hidden border-t border-border overflow-y-auto">
          <nav className="flex flex-col p-8 gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`font-serif text-3xl font-bold ${location === link.href ? 'text-secondary' : 'text-foreground'}`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-8 border-t border-border mt-4">
              <Button asChild className="w-full bg-secondary text-secondary-foreground h-12 text-sm uppercase tracking-widest font-bold shadow-sm">
                <Link href="/contact">Get a Quote</Link>
              </Button>
            </div>
            
            <div className="mt-auto pt-8 flex gap-6 text-muted-foreground">
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-secondary">
                  <Instagram className="w-6 h-6" />
                </a>
              )}
              {settings?.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-secondary">
                  <Facebook className="w-6 h-6" />
                </a>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Spacer for fixed nav */}
      <div className={`${isHome ? 'pt-0' : 'pt-[64px] md:pt-[98px]'}`}></div>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground pt-20 pb-10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 mb-16 relative z-10">
          <div className="md:col-span-4">
            <h3 className="font-serif text-3xl font-bold mb-4">{settings?.businessName || 'HAVESTORY'}</h3>
            <p className="text-primary-foreground/70 max-w-sm mb-6 leading-relaxed text-sm font-light">
              {settings?.aboutStory?.substring(0, 160) || 'Premium photo framing and gallery wall design studio. We bring your best memories to life with unmatched craftsmanship and archival materials.'}...
            </p>
            <div className="flex items-center gap-4 text-secondary">
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/20 transition-all">
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {settings?.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/20 transition-all">
                  <Facebook className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          
          <div className="md:col-span-2 md:col-start-6">
            <h4 className="font-sans uppercase tracking-widest text-xs font-bold mb-6 text-secondary">Quick Links</h4>
            <ul className="space-y-3">
              {navLinks.slice(0, 4).map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary-foreground/80 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="font-sans uppercase tracking-widest text-xs font-bold mb-6 text-secondary">Services</h4>
            <ul className="space-y-3">
              <li><Link href="/services" className="text-primary-foreground/80 hover:text-white transition-colors text-sm">Custom Framing</Link></li>
              <li><Link href="/services" className="text-primary-foreground/80 hover:text-white transition-colors text-sm">Gallery Walls</Link></li>
              <li><Link href="/services" className="text-primary-foreground/80 hover:text-white transition-colors text-sm">Photo Printing</Link></li>
              <li><Link href="/services" className="text-primary-foreground/80 hover:text-white transition-colors text-sm">Bespoke Mirrors</Link></li>
            </ul>
          </div>
          
          <div className="md:col-span-3">
            <h4 className="font-sans uppercase tracking-widest text-xs font-bold mb-6 text-secondary">Contact</h4>
            <ul className="space-y-4 text-primary-foreground/80 text-sm">
              {settings?.address && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{settings.address}</span>
                </li>
              )}
              {settings?.phone && (
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-secondary shrink-0" />
                  <span>{settings.phone}</span>
                </li>
              )}
              {settings?.email && (
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-secondary shrink-0" />
                  <span>{settings.email}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="gold-rule mb-6" />
          <p className="text-xs text-primary-foreground/50 text-center tracking-wide">
            © {new Date().getFullYear()} {settings?.businessName || 'HAVESTORY'}. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      {settings?.whatsappNumber && (
        <a 
          href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noreferrer"
          title="Chat with us"
          className={`fixed bottom-24 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all duration-300 z-40 animate-pulse-ring ${scrolledPast200 ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.334.101.154.453.721.969 1.18.665.59 1.221.77 1.378.857.156.087.248.072.338-.029.091-.101.393-.457.497-.614.104-.157.208-.13.346-.079l2.179 1.031c.144.072.239.116.275.18.036.065.036.375-.108.78z"/>
          </svg>
        </a>
      )}

      {/* Floating STICKY 'Order Now' button */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ 
          opacity: scrolledPastHero ? 1 : 0, 
          y: scrolledPastHero ? 0 : 20, 
          scale: scrolledPastHero ? 1 : 0.9,
          pointerEvents: scrolledPastHero ? 'auto' : 'none'
        }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-50"
      >
        <Link href="/store" className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground rounded-full px-6 py-3 font-semibold text-sm cta-pulse shadow-xl hover:scale-105 transition-transform border-none">
          <span>🖼 Order a Frame</span> <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </motion.div>
    </div>
  );
}
