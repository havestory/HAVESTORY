import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetSettings } from '@workspace/api-client-react';
import { Menu, X, Printer, Phone, MapPin, Mail, Instagram, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
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
    { href: '/track-order', label: 'Track Order' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  const isHome = location === '/';
  const headerClasses = isHome && !scrolled 
    ? 'bg-transparent py-6 border-transparent shadow-none text-primary-foreground' 
    : 'bg-background/95 backdrop-blur-md py-4 border-b border-border shadow-sm text-foreground';

  const linkActiveClasses = isHome && !scrolled ? 'after:bg-secondary text-primary-foreground hover:text-white' : 'after:bg-secondary text-foreground hover:text-secondary';
  const logoBgClasses = isHome && !scrolled ? 'bg-white text-primary hover:bg-secondary hover:text-white' : 'bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-secondary selection:text-secondary-foreground relative">
      {/* Top Bar - Hidden on Mobile */}
      <div className="hidden md:flex bg-primary text-primary-foreground py-2.5 px-6 justify-between items-center text-xs tracking-wider border-b border-white/10 z-50 relative">
        <div className="flex items-center gap-6 font-medium">
          {settings?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 opacity-70" />
              <span>{settings.phone}</span>
            </div>
          )}
          {settings?.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 opacity-70" />
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
      <header className={`fixed w-full z-40 transition-all duration-300 top-0 md:top-[38px] ${headerClasses}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4 group">
            <div className={`w-11 h-11 rounded-none flex items-center justify-center transition-colors shadow-sm ${logoBgClasses}`}>
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif text-2xl lg:text-3xl font-bold block leading-none tracking-tight">{settings?.businessName || 'HAVESTORY'}</span>
              <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${isHome && !scrolled ? 'text-white/70' : 'text-muted-foreground'}`}>{settings?.tagline || 'Master Printers'}</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`text-sm font-bold tracking-wide transition-colors relative after:absolute after:bottom-[-6px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform ${linkActiveClasses} ${isActive ? 'after:scale-x-100 text-secondary' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:block">
            <Button asChild className={`rounded-none px-8 tracking-wider font-bold shadow-sm ${isHome && !scrolled ? 'bg-white text-primary hover:bg-secondary hover:text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
              <Link href="/contact">Get a Quote</Link>
            </Button>
          </div>

          <button 
            className={`lg:hidden p-2 transition-colors ${isHome && !scrolled ? 'text-white' : 'text-foreground'}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[73px] md:top-[111px] z-50 bg-background flex flex-col lg:hidden border-t border-border overflow-y-auto">
          <nav className="flex flex-col p-8 gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-2xl font-serif font-bold ${location === link.href ? 'text-secondary border-b-2 border-secondary inline-block w-max pb-1' : 'text-foreground'}`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-8 border-t border-border mt-4">
              <Button asChild className="w-full rounded-none h-14 text-lg font-bold bg-primary text-primary-foreground shadow-sm">
                <Link href="/contact">Get a Quote</Link>
              </Button>
            </div>
            
            <div className="mt-auto pt-8 flex gap-6 text-muted-foreground">
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  <Instagram className="w-6 h-6" />
                </a>
              )}
              {settings?.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  <Facebook className="w-6 h-6" />
                </a>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Spacer for fixed nav */}
      <div className={`${isHome ? 'pt-0' : 'pt-[73px] md:pt-[111px]'}`}></div>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground pt-20 pb-8 border-t-[6px] border-secondary relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 mb-16 relative z-10">
          <div className="md:col-span-5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 bg-secondary text-secondary-foreground rounded-none flex items-center justify-center shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <span className="font-serif text-3xl font-bold tracking-tight">{settings?.businessName || 'HAVESTORY'}</span>
            </div>
            <p className="text-primary-foreground/70 max-w-sm mb-8 leading-relaxed text-base font-light">
              {settings?.aboutStory?.substring(0, 160) || 'Premium photo framing and gallery wall design studio. We bring your best memories to life with unmatched craftsmanship and archival materials.'}...
            </p>
            <div className="flex items-center gap-4">
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center hover:bg-secondary hover:border-secondary hover:text-black transition-all">
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {settings?.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center hover:bg-secondary hover:border-secondary hover:text-black transition-all">
                  <Facebook className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          
          <div className="md:col-span-3">
            <h4 className="font-sans uppercase tracking-widest text-xs font-bold mb-8 text-secondary">Quick Links</h4>
            <ul className="space-y-4">
              {navLinks.slice(0, 6).map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary-foreground/80 hover:text-white transition-colors font-medium">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="md:col-span-4">
            <h4 className="font-sans uppercase tracking-widest text-xs font-bold mb-8 text-secondary">Studio Contact</h4>
            <ul className="space-y-6 text-primary-foreground/80">
              {settings?.address && (
                <li className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{settings.address}</span>
                </li>
              )}
              {settings?.phone && (
                <li className="flex items-center gap-4">
                  <Phone className="w-5 h-5 text-secondary shrink-0" />
                  <span className="font-medium">{settings.phone}</span>
                </li>
              )}
              {settings?.email && (
                <li className="flex items-center gap-4">
                  <Mail className="w-5 h-5 text-secondary shrink-0" />
                  <span className="font-medium">{settings.email}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-primary-foreground/50 font-medium tracking-wide relative z-10">
          <p>© {new Date().getFullYear()} {settings?.businessName || 'HAVESTORY'}. All rights reserved.</p>
          <p className="mt-4 md:mt-0 uppercase tracking-widest">Designed for precision.</p>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      {settings?.whatsappNumber && (
        <a 
          href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noreferrer"
          title="Chat with us"
          className="fixed bottom-6 right-6 w-16 h-16 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(37,211,102,0.4)] hover:scale-110 transition-transform z-50 animate-in fade-in slide-in-from-bottom-4 animate-pulse-ring"
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.334.101.154.453.721.969 1.18.665.59 1.221.77 1.378.857.156.087.248.072.338-.029.091-.101.393-.457.497-.614.104-.157.208-.13.346-.079l2.179 1.031c.144.072.239.116.275.18.036.065.036.375-.108.78z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
