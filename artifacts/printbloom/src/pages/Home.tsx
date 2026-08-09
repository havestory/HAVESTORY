import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Star, ArrowUpRight, TrendingUp, Users, Package, Award, Landmark, CreditCard, Copy, Check, X, Expand, QrCode } from "lucide-react";
import { 
  useGetSettings, 
  useListProducts, 
  useListServices,
  useListReviews
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { ServiceCard } from "@/components/ServiceCard";
import { PremiumHero } from "@/components/PremiumHero";
import { LabelCalculator } from "@/components/LabelCalculator";
import {
  getHomeProductsCache, setHomeProductsCache,
  getHomeServicesCache, setHomeServicesCache,
} from "@/lib/home-cache";

export default function Home() {
  const queryClient = useQueryClient();
  const { data: settings } = useGetSettings();
  // Real-time public stats (products+services count, completed orders)
  const { data: publicStats } = useQuery({
    queryKey: ["/api/stats/public"],
    queryFn: () => fetch("/api/stats/public").then(r => r.json()),
    staleTime: 60_000,  // re-fetch every 60s
    refetchOnWindowFocus: true,
  });
  const _cachedProducts = getHomeProductsCache();
  const _cachedServices = getHomeServicesCache();
  const { data: products } = useListProducts({ featured: true }, {
    query: _cachedProducts
      ? { initialData: _cachedProducts, initialDataUpdatedAt: 0 }
      : {}
  });
  const { data: services } = useListServices({ featured: true }, {
    query: _cachedServices
      ? { initialData: _cachedServices, initialDataUpdatedAt: 0 }
      : {}
  });
  const { data: allApprovedReviews } = useListReviews({ approved: true });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxPhoto(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhoto]);

  // Hero slideshow
  const heroSlides = [
    settings?.heroSlideImage1,
    settings?.heroSlideImage2,
    settings?.heroSlideImage3,
    settings?.heroSlideImage4,
    settings?.heroSlideImage5,
  ].filter(Boolean) as string[];
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => setSlideIdx(i => (i + 1) % heroSlides.length), 3000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  /* Persist fresh data to localStorage so next reload is instant */
  useEffect(() => {
    if (Array.isArray(products) && products.length > 0) setHomeProductsCache(products);
  }, [products]);
  useEffect(() => {
    if (Array.isArray(services) && services.length > 0) setHomeServicesCache(services);
  }, [services]);

  /* Listen for admin saves in other tabs → refetch homepage data */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pb_admin_saved_at") {
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/services"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const paymentQrUrl: string = settings?.paymentQrUrl || "";

  const bankAccounts: any[] = (() => {
    try {
      const raw = settings?.bankDetails;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const fallback: any = {};
    if (settings?.bankName) fallback.bankName = settings.bankName;
    if (settings?.bankAccountHolder) fallback.accountHolder = settings.bankAccountHolder;
    if (settings?.bankAccountNumber) fallback.accountNumber = settings.bankAccountNumber;
    if (settings?.bankBranch) fallback.branch = settings.bankBranch;
    if (settings?.bankSwiftBic) fallback.swiftBic = settings.bankSwiftBic;
    return Object.keys(fallback).length > 0 ? [fallback] : [];
  })();
  const reviews = (() => {
    const all = Array.isArray(allApprovedReviews) ? allApprovedReviews : [];
    const featured = all.filter((r: any) => r.featured);
    if (featured.length >= 4) return featured.slice(0, 4);
    const featuredIds = new Set(featured.map((r: any) => r.id));
    const rest = all.filter((r: any) => !featuredIds.has(r.id));
    return [...featured, ...rest].slice(0, 4);
  })();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <main>
      <PremiumHero settings={settings} publicStats={publicStats} />
      <LabelCalculator />

      {/* Frame and print collections */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-primary font-bold tracking-wider uppercase text-sm mb-2 block">Curated for You</span>
              <h2 className="text-4xl font-display font-bold">Frame & Print Collections</h2>
            </div>
            <Link href="/store" className="hidden sm:flex items-center gap-2 text-purple-700 font-semibold hover:text-primary transition-colors">
              View All <ArrowUpRight size={20} />
            </Link>
          </div>

          {!Array.isArray(products) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="glass-card rounded-2xl h-[400px] animate-pulse bg-white/40" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 glass rounded-3xl">
              <Package size={48} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-xl font-bold text-gray-400 mb-2">Products Coming Soon</h3>
              <p className="text-gray-400 text-sm">Our product catalog is being set up. Check back soon!</p>
            </div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {products.slice(0, 4).map(product => (
                <motion.div key={product.id} variants={itemVariants}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          )}
          
          <div className="mt-8 text-center sm:hidden">
            <Link href="/store" className="btn-glass px-6 py-3 rounded-xl inline-flex items-center gap-2">
              View All Collections <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 bg-gradient-to-b from-transparent to-purple-50/50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-primary font-bold tracking-wider uppercase text-sm mb-2 block">Expertise</span>
            <h2 className="text-4xl font-display font-bold mb-4">Our Services</h2>
            <p className="text-gray-600">From studio portraits and colour-accurate photo printing to handcrafted framing, every service is tuned to your story.</p>
          </div>

          {!Array.isArray(services) ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-56 animate-pulse bg-white/40" />)}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-16 glass rounded-3xl">
              <ArrowUpRight size={48} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-xl font-bold text-gray-400 mb-2">Services Coming Soon</h3>
              <p className="text-gray-400 text-sm">Our services are being set up. Check back soon!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.slice(0, 3).map(service => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
      </section>
      
      {/* Payment Details */}
      {(bankAccounts.length > 0 || paymentQrUrl) && (
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-400/15 blur-[120px] rounded-full" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <div className="inline-flex items-center gap-2 bg-pink-50 border border-pink-100 rounded-full px-5 py-2 mb-5">
                <CreditCard size={15} className="text-pink-500" />
                <span className="text-pink-600 text-sm font-semibold tracking-wide">Bank Transfer</span>
              </div>
              <h2 className="text-4xl font-display font-bold mb-4">Payment Details</h2>
              <p className="text-gray-500 max-w-lg mx-auto text-lg">
                Transfer your payment to one of our bank accounts below. Use your Order ID as the reference.
              </p>
            </motion.div>

            <div className={`grid gap-6 ${bankAccounts.length === 1 ? "max-w-lg mx-auto" : bankAccounts.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-2 lg:grid-cols-3"}`}>
              {bankAccounts.map((bank: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08 }}
                  className="glass rounded-3xl p-6 flex flex-col gap-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center shrink-0">
                      <Landmark size={20} className="text-purple-500" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg leading-tight">{bank.bankName || bank.bank || "Bank"}</div>
                      {bank.branch && <div className="text-sm text-gray-400">{bank.branch}</div>}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {bank.accountHolder && (
                      <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                        <div>
                          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Account Holder</div>
                          <div className="text-sm font-bold text-gray-800">{bank.accountHolder}</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(bank.accountHolder, `${idx}-holder`)}
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition-all shrink-0"
                        >
                          {copiedField === `${idx}-holder` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                    {bank.accountNumber && (
                      <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                        <div>
                          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Account Number</div>
                          <div className="text-sm font-bold text-gray-800 font-mono tracking-wide">{bank.accountNumber}</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(bank.accountNumber, `${idx}-number`)}
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition-all shrink-0"
                        >
                          {copiedField === `${idx}-number` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                    {(bank.swiftBic || bank.swift) && (
                      <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                        <div>
                          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">SWIFT / BIC</div>
                          <div className="text-sm font-bold text-gray-800 font-mono">{bank.swiftBic || bank.swift}</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(bank.swiftBic || bank.swift, `${idx}-swift`)}
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition-all shrink-0"
                        >
                          {copiedField === `${idx}-swift` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* QR Code */}
            {paymentQrUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`mt-10 flex flex-col items-center gap-6 ${bankAccounts.length > 0 ? "border-t border-gray-100 pt-10" : ""}`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <QrCode size={13} className="text-emerald-500" /> Scan to Pay
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                    <img
                      src={paymentQrUrl}
                      alt="Payment QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Scan with your mobile banking or payment app</p>
                </div>
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center text-sm text-gray-400 mt-8 max-w-md mx-auto"
            >
              After payment, send your receipt via WhatsApp with your Order ID for quick processing.
            </motion.p>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-24 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pink-300/20 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-display font-bold text-center mb-16">What Our Clients Say</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {reviews.map((review: any) => (
              <div
                key={review.id}
                className={`glass rounded-3xl relative flex flex-col overflow-hidden ${review.photoUrl ? "cursor-pointer group" : ""}`}
                onClick={() => review.photoUrl && setLightboxPhoto(review.photoUrl)}
                role={review.photoUrl ? "button" : undefined}
                tabIndex={review.photoUrl ? 0 : undefined}
                onKeyDown={e => review.photoUrl && e.key === "Enter" && setLightboxPhoto(review.photoUrl)}
                aria-label={review.photoUrl ? `View photo from ${review.customerName}` : undefined}
              >
                {/* Photo banner — only shown when review has a photo */}
                {review.photoUrl && (
                  <div className="relative w-full h-36 overflow-hidden">
                    <img
                      src={review.photoUrl}
                      alt={`Photo by ${review.customerName}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-purple-700 shadow-md">
                      <Expand size={13} />
                    </div>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  <div className="text-5xl text-purple-200 absolute top-3 right-5 font-serif opacity-40 leading-none pointer-events-none">"</div>
                  <div className="flex gap-0.5 text-amber-400 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} fill={i < review.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <p className="text-gray-700 italic mb-4 relative z-10 leading-relaxed text-sm flex-1">
                    {review.comment}
                  </p>
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-white/40">
                    {review.photoUrl ? (
                      <img src={review.photoUrl} alt={review.customerName} loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {review.customerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="font-bold text-purple-900 text-sm">{review.customerName}</div>
                    {review.featured && <span className="ml-auto text-[9px] font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded-full border border-pink-100">Featured</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {reviews.length === 0 && (
            <div className="text-center text-gray-400 py-10">
              <Star size={32} className="mx-auto mb-2 opacity-20" />
              <p>No reviews yet — be the first to share your experience!</p>
            </div>
          )}
        </div>
      </section>

      {/* Custom Project CTA */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 -z-10" />
        <div className="absolute inset-0 opacity-10 -z-10"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        />
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            ✦ Got something special in mind?
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-extrabold text-white mb-5 leading-tight">
            Create Something Worth Keeping
          </h2>
          <p className="text-white/80 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Bring us a portrait, an old photograph or a wall-gallery idea. We will shape the colour, format and frame, then return with a thoughtful quote.
          </p>
          <a
            href="/custom-project"
            className="inline-flex items-center gap-2 bg-white text-purple-700 font-bold px-8 py-4 rounded-2xl text-base shadow-xl shadow-purple-900/20 hover:shadow-2xl hover:scale-105 transition-all duration-200"
          >
            Plan Your Project →
          </a>
        </div>
      </section>

      {/* Review Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto}
              alt="Review photo"
              className="block max-w-[90vw] max-h-[80vh] w-auto h-auto object-cover rounded-2xl"
              style={{ aspectRatio: "1 / 1", width: "min(420px, 90vw)", height: "min(420px, 80vh)" }}
            />
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </main>
  );
}

