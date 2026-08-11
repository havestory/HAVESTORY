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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-secondary selection:text-secondary-foreground">
      {/* Top Bar */}
      <div className="hidden md:flex bg-primary text-primary-foreground py-2 px-6 justify-between items-center text-xs tracking-wider">
        <div className="flex items-center gap-6">
          {settings?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3" />
              <span>{settings.phone}</span>
            </div>
          )}
          {settings?.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3" />
              <span>{settings.email}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {settings?.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors">
              <Instagram className="w-3.5 h-3.5" />
            </a>
          )}
          {settings?.facebookUrl && (
            <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors">
              <Facebook className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Navbar */}
      <header className={`sticky top-0 z-50 transition-all duration-300 border-b border-border ${scrolled ? 'bg-background/95 backdrop-blur-md py-3 shadow-sm' : 'bg-background py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-none flex items-center justify-center group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className="font-serif text-2xl font-semibold block leading-none">{settings?.businessName || 'HAVESTORY'}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{settings?.tagline || 'Master Printers'}</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-sm font-medium tracking-wide transition-colors hover:text-secondary relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:scale-x-0 hover:after:scale-x-100 hover:after:bg-secondary after:origin-left after:transition-transform ${location === link.href ? 'text-secondary after:scale-x-100 after:bg-secondary' : 'text-foreground'}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button asChild className="rounded-none px-6 tracking-wide">
              <Link href="/contact">Get a Quote</Link>
            </Button>
          </div>

          <button 
            className="lg:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[73px] z-40 bg-background flex flex-col lg:hidden border-t border-border overflow-y-auto">
          <nav className="flex flex-col p-6 gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-2xl font-serif ${location === link.href ? 'text-secondary' : 'text-foreground'}`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-6 border-t border-border">
              <Button asChild className="w-full rounded-none h-12 text-lg">
                <Link href="/contact">Get a Quote</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground pt-16 pb-8 border-t-[8px] border-secondary">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-secondary text-secondary-foreground rounded-none flex items-center justify-center">
                <Printer className="w-4 h-4" />
              </div>
              <span className="font-serif text-2xl">{settings?.businessName || 'HAVESTORY'}</span>
            </div>
            <p className="text-primary-foreground/70 max-w-sm mb-6 leading-relaxed">
              {settings?.aboutStory?.substring(0, 150) || 'Precision printing and bespoke graphic design for those who care about the details.'}...
            </p>
          </div>
          <div>
            <h4 className="font-sans uppercase tracking-widest text-xs font-semibold mb-6 text-secondary">Quick Links</h4>
            <ul className="space-y-3">
              {navLinks.slice(0, 5).map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-primary-foreground/70 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-sans uppercase tracking-widest text-xs font-semibold mb-6 text-secondary">Contact</h4>
            <ul className="space-y-4 text-primary-foreground/70 text-sm">
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
        <div className="max-w-7xl mx-auto px-6 border-t border-primary-foreground/10 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-primary-foreground/50">
          <p>© {new Date().getFullYear()} {settings?.businessName || 'HAVESTORY'}. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span>Designed for precision.</span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      {settings?.whatsappNumber && (
        <a 
          href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50 animate-in fade-in slide-in-from-bottom-4"
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