import { Link } from "wouter";
import { Mail, MapPin, Phone } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";
import { getSettingsCache } from "@/lib/settings-cache";

function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="white" />
    </svg>
  );
}

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.01a8.16 8.16 0 004.77 1.52V7.07a4.85 4.85 0 01-1-.38z" />
    </svg>
  );
}

export function Footer() {
  const { data: settings } = useGetSettings({ query: {
    refetchInterval: 30000,
    initialData: getSettingsCache() ?? undefined,
    initialDataUpdatedAt: 0,
  } });

  return (
    <footer className="relative mt-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-50/80 -z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand */}
          <div className="flex flex-col gap-4">
            {(() => {
              const s = settings as any;
              const logoUrl = s?.logoUrl || "";
              const businessName = s?.businessName || "HAVESTORY";
              const showNameWithLogo = s?.showNameWithLogo !== 0;
              return (
                <Link href="/" className="flex items-center gap-2 group w-fit">
                  {logoUrl ? (
                    <>
                      <img
                        src={logoUrl}
                        alt={businessName}
                        className="h-8 w-auto object-contain"
                      />
                      {showNameWithLogo && (
                        <span className="font-display font-bold text-xl">
                          {businessName}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><path d="M12 8c-2.5 0-4 1.5-4 4s1.5 4 4 4 4-1.5 4-4"/>
                        </svg>
                      </div>
                      <span className="font-display font-bold text-xl">
                        {businessName.includes("HAVESTORY")
                          ? <>Print<span className="text-primary">Bloom</span></>
                          : businessName}
                      </span>
                    </>
                  )}
                </Link>
              );
            })()}
            <p className="text-gray-600 text-sm leading-relaxed">
              {settings?.tagline || "Premium printing and graphic design services crafted with passion and precision."}
            </p>
            <div className="flex items-center gap-3 mt-3">
              {settings?.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook"
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/30"
                  style={{ background: "#1877F2" }}>
                  <FacebookIcon size={20} />
                </a>
              )}
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-pink-500/30"
                  style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                  <InstagramIcon size={20} />
                </a>
              )}
              {(settings as any)?.tiktokUrl && (
                <a href={(settings as any).tiktokUrl} target="_blank" rel="noreferrer" aria-label="TikTok"
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-gray-800/30"
                  style={{ background: "#010101" }}>
                  <TikTokIcon size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display font-bold text-lg mb-4">Quick Links</h3>
            <ul className="flex flex-col gap-3 text-sm text-gray-600">
              <li><Link href="/store" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Print Store</Link></li>
              <li><Link href="/services" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Design Services</Link></li>
              <li><Link href="/portfolio" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Our Portfolio</Link></li>
              <li><Link href="/track-order" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Track Order</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-display font-bold text-lg mb-4">Company</h3>
            <ul className="flex flex-col gap-3 text-sm text-gray-600">
              <li><Link href="/about" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/contact" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link href="/privacy" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-display font-bold text-lg mb-4">Get in Touch</h3>
            <ul className="flex flex-col gap-4 text-sm text-gray-600">
              {settings?.address && (
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-primary shrink-0 mt-0.5" />
                  <span>{settings.address}</span>
                </li>
              )}
              {settings?.phone && (
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-primary shrink-0" />
                  <a href={`tel:${settings.phone}`} className="hover:text-primary">{settings.phone}</a>
                </li>
              )}
              {settings?.email && (
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-primary shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-primary">{settings.email}</a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200/50 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div><p>© {new Date().getFullYear()} {settings?.businessName || "HAVESTORY"}. All rights reserved.</p><div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 text-xs font-semibold text-indigo-700"><span>HAVESTORY</span><span className="text-indigo-300">·</span><span>Operated by <strong>CodeArtix Technologies</strong></span></div></div>
          {(settings as any)?.designerCredit && (
            <p className="flex items-center gap-1.5">
              Designed by{" "}
              <span className="font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent tracking-wide">
                {(settings as any).designerCredit}
              </span>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
