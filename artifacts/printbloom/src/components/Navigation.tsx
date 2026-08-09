import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, Frame } from "lucide-react";
import { useCart } from "@/store/use-cart";
import { CartDrawer } from "@/components/CartDrawer";
import { cn } from "@/lib/utils";
import { useGetSettings } from "@workspace/api-client-react";
import { getSettingsCache } from "@/lib/settings-cache";
import { getBusinessName } from "@/lib/brand-settings";

const links = [
  { name: "Home", href: "/" },
  { name: "Frames & Prints", href: "/store" },
  { name: "Studio Services", href: "/services" },
  { name: "Gallery", href: "/portfolio" },
  { name: "Track Order", href: "/track-order" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export function Navigation() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { items } = useCart();
  const { data: settings } = useGetSettings({ query: {
    refetchInterval: 30000,
    initialData: getSettingsCache() ?? undefined,
    initialDataUpdatedAt: 0,
  } });

  // Show the number of distinct line items in the cart (matching the
  // "Your Cart" subtitle). The cart drawer itself shows the per-line
  // piece count (e.g. "1 item • 110 pcs"), so the badge stays compact.
  const cartCount = items.length;

  const s = settings as any;
  const logoUrl          = s?.logoUrl || "";
  const businessName     = getBusinessName(s);
  const tagline          = s?.tagline || "";
  const taglineEnabled   = s?.taglineEnabled !== 0;
  const showNameWithLogo = s?.showNameWithLogo !== 0;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "hs-nav",
          "inset-x-0 transition-all duration-300",
          isScrolled ? "py-2" : "py-4"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={cn(
            "hs-nav-shell flex items-center justify-between px-6 py-3 transition-all duration-300",
            isScrolled ? "glass" : "bg-white/40 backdrop-blur-sm border border-white/20"
          )}>
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt={businessName}
                    className="h-10 w-auto object-contain group-hover:scale-105 transition-transform"
                  />
                  {showNameWithLogo && (
                    <div>
                      <span className="font-display font-bold text-xl tracking-tight text-foreground">
                        {businessName}
                      </span>
                      {taglineEnabled && tagline && (
                        <p className="text-[10px] text-gray-400 leading-none mt-0.5 font-medium tracking-wide hidden sm:block">
                          {tagline}
                        </p>
                      )}
                    </div>
                  )}
                  {!showNameWithLogo && taglineEnabled && tagline && (
                    <p className="text-[10px] text-gray-400 leading-none font-medium tracking-wide hidden sm:block">
                      {tagline}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="hs-logo-mark w-10 h-10 flex items-center justify-center text-white shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
                    <Frame size={20} />
                  </div>
                  <div>
                    <span className="font-display font-bold text-xl tracking-tight text-foreground">
                      {businessName}
                    </span>
                    {taglineEnabled && tagline && (
                      <p className="text-[10px] text-gray-400 leading-none mt-0.5 font-medium tracking-wide hidden sm:block">
                        {tagline}
                      </p>
                    )}
                  </div>
                </>
              )}
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden xl:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    location === link.href
                      ? "bg-white/80 text-purple-900 shadow-sm"
                      : "text-gray-600 hover:text-purple-900 hover:bg-white/50"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-full hover:bg-white/50 transition-colors text-gray-700"
                aria-label="Open cart"
              >
                <ShoppingBag size={20} />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full leading-none"
                    >
                      {cartCount > 99 ? "99+" : cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <Link
                href="/store"
                className="hs-nav-cta hidden xl:block px-5 py-2.5 text-sm"
              >
                Create a Frame
              </Link>

              <button
                className="xl:hidden p-2 text-gray-700"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 z-50 p-4 xl:hidden"
            >
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
              <div className="relative glass-panel rounded-3xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-bold text-xl">Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white/50 rounded-full">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {links.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "px-4 py-3 rounded-xl font-medium transition-colors",
                        location === link.href
                          ? "bg-primary text-white"
                          : "bg-white/40 text-gray-800 hover:bg-white/60"
                      )}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200/50 flex flex-col gap-3">
                  <button
                    onClick={() => { setMobileMenuOpen(false); setCartOpen(true); }}
                    className="w-full py-3 rounded-xl bg-white/60 flex items-center justify-center gap-2 font-medium text-gray-700 border border-gray-200/50"
                  >
                    <ShoppingBag size={18} />
                    View Cart {cartCount > 0 && <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>}
                  </button>
                  <Link
                    href="/store"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-gradient w-full py-3 rounded-xl flex items-center justify-center"
                  >
                    Create a Frame
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
