import { SiteNotices } from "@/components/public/SiteNotices";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  Image as ImageIcon,
  PackageCheck,
  Palette,
  Quote,
  Ruler,
  ShoppingCart,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  useGetNotices,
  useGetSettings,
  useListPortfolio,
  useListProducts,
  useListReviews,
  useListServices,
} from "@workspace/api-client-react";
import { ComingSoon } from "@/components/public/ComingSoon";
import { Reveal, Stagger, StaggerItem } from "@/components/public/Reveal";

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=76",
  "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1100&q=76",
  "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1100&q=76",
];

function safeSiteHref(value: unknown, fallback: string): string {
  const href = String(value || "").trim();
  return href.startsWith("/") && !href.startsWith("//") ? href : fallback;
}

const BENEFIT_ICONS = {
  "shopping-cart": ShoppingCart, "badge-check": BadgeCheck, truck: Truck,
  headphones: Headphones, palette: Palette, ruler: Ruler,
  package: PackageCheck, sparkles: Sparkles,
} as const;
type BenefitIconName = keyof typeof BENEFIT_ICONS;
type HomeBenefit = { title: string; copy: string; icon: BenefitIconName; color: string; enabled: boolean };
const DEFAULT_HOME_BENEFITS: HomeBenefit[] = [
  { title: "Easy Online Ordering", copy: "Simple steps from photo to checkout.", icon: "shopping-cart", color: "rose", enabled: true },
  { title: "Print-Ready Quality", copy: "Colour-checked prints with premium materials.", icon: "badge-check", color: "blue", enabled: true },
  { title: "Islandwide Delivery", copy: "Carefully packed and delivered across Sri Lanka.", icon: "truck", color: "rose", enabled: true },
  { title: "Friendly Studio Support", copy: "Real guidance from idea to finished frame.", icon: "headphones", color: "blue", enabled: true },
];
function readHomeBenefits(value: unknown): HomeBenefit[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_HOME_BENEFITS;
    return DEFAULT_HOME_BENEFITS.map((fallback, index) => {
      const item = parsed[index];
      if (!item || typeof item !== "object") return fallback;
      const candidate = item as Partial<HomeBenefit>;
      return { ...fallback, ...candidate, icon: candidate.icon && candidate.icon in BENEFIT_ICONS ? candidate.icon : fallback.icon, enabled: candidate.enabled !== false };
    });
  } catch { return DEFAULT_HOME_BENEFITS; }
}

function SectionHead({ id, eyebrow, title, copy, href, link }: { id?: string; eyebrow: string; title: string; copy?: string; href?: string; link?: string }) {
  return (
    <Reveal className="hv-section-head">
      <div>
        <span className="hv-kicker">{eyebrow}</span>
        <h2 id={id} className="hv-display hv-display-md">{title}</h2>
        {copy && <p className="hv-lede">{copy}</p>}
      </div>
      {href && (
        <Link href={href} className="hv-text-link">
          {link || "View all"} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </Reveal>
  );
}

const MARQUEE_WORDS = ["Photo Frames", "Custom Framing", "Gifts & Keepsakes", "Personalised Designs", "Studio Services"];
const COLLECTION_SPANS = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-5", "lg:col-span-7"];

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: notices } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews } = useListReviews();
  const [heroIndex, setHeroIndex] = useState(0);
  const [previousHeroImage, setPreviousHeroImage] = useState<string | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroArchY = useTransform(heroScrollProgress, [0, 1], [0, 40]);
  const heroOrbY = useTransform(heroScrollProgress, [0, 1], [0, 90]);

  const allProducts = Array.isArray(products) ? products : [];
  const featuredProducts = allProducts.filter((item) => item.featured);
  const favouritePool = featuredProducts.length ? featuredProducts : allProducts;
  const portfolioList = (Array.isArray(portfolio) ? portfolio : []).slice(0, 6);
  const serviceList = (Array.isArray(services) ? services : []).slice(0, 4);
  const reviewList = (Array.isArray(reviews) ? reviews : []).filter((item) => item.approved).slice(0, 3);
  const cfg = settings as any;
  const benefits = readHomeBenefits(cfg?.homeBenefits).filter((item) => item.enabled);
  const benefitsVisible = cfg?.homeBenefitsEnabled !== 0 && benefits.length > 0;

  let featureCards: Array<{ title?: string; copy?: string; href?: string; image?: string }> = [];
  try {
    const parsed = typeof cfg?.homeFeatureCards === "string" ? JSON.parse(cfg.homeFeatureCards) : cfg?.homeFeatureCards;
    if (Array.isArray(parsed)) featureCards = parsed;
  } catch {
    featureCards = [];
  }

  let slideEnabled = Array(10).fill(true) as boolean[];
  try {
    const parsed = typeof cfg?.heroSlideEnabled === "string" ? JSON.parse(cfg.heroSlideEnabled) : cfg?.heroSlideEnabled;
    if (Array.isArray(parsed)) slideEnabled = Array.from({ length: 10 }, (_, index) => parsed[index] !== false);
  } catch {
    slideEnabled = Array(10).fill(true);
  }
  const heroSlots = Array.from({ length: 10 }, (_, index) => cfg?.[`heroSlideImage${index + 1}`] as string | undefined);
  const configuredSlides = [...new Set(heroSlots.filter((image, index): image is string => Boolean(image?.trim() && slideEnabled[index])))];
  const categoryFallbacks = [
    { title: "Photo Frames", copy: "Handcrafted frames for the moments you keep.", href: "/store", tone: "gold", image: DEFAULT_IMAGES[1] },
    { title: "Custom Framing", copy: "Made to your photograph and space.", href: "/custom-project", tone: "gold", image: DEFAULT_IMAGES[2] },
    { title: "Gifts & Keepsakes", copy: "Meaningful pieces for every occasion.", href: "/store", tone: "gold", image: portfolioList[0]?.imageUrl || DEFAULT_IMAGES[0] },
    { title: "Studio Services", copy: "Personalised designs and studio finishes.", href: "/services", tone: "gold", image: portfolioList[1]?.imageUrl || DEFAULT_IMAGES[1] },
  ];
  const categories = categoryFallbacks.map((fallback, index) => ({ ...fallback, ...(featureCards[index] || {}), image: featureCards[index]?.image || fallback.image }));
  // Use existing collection imagery until the studio publishes its own hero slides.
  const heroSlides = configuredSlides.length ? configuredSlides : [...new Set([cfg?.heroBgImage || DEFAULT_IMAGES[0], ...categories.map((item) => item.image).filter(Boolean)])].slice(0, 4);
  const heroKey = heroSlides.join("|");
  const safeHeroIndex = heroIndex % heroSlides.length;
  const heroImage = heroSlides[safeHeroIndex];
  const nextHeroImage = heroSlides[(safeHeroIndex + 1) % heroSlides.length];
  const orbHeroImage = heroSlides[(safeHeroIndex + 2) % heroSlides.length];
  const favouriteWindow = Math.min(4, favouritePool.length);
  const primaryHeroHref = safeSiteHref(cfg?.heroCtaLink, "/store");
  const primaryIsCustom = primaryHeroHref === "/custom-project";
  const configuredHeroCta = String(cfg?.heroCtaText || '').trim();
  const primaryHeroLabel = primaryIsCustom && /find your frame|explore frames|browse frames/i.test(configuredHeroCta)
    ? 'Request a custom frame'
    : configuredHeroCta || (primaryIsCustom ? 'Request a custom frame' : 'Browse frames');
  const favouriteProducts = favouriteWindow ? Array.from({ length: favouriteWindow }, (_, index) => favouritePool[index]) : [];
  const heroTitle = cfg?.heroTitle || "Frame the moments that become your story.";
  const heroSubtitle = cfg?.heroSubtitle || "Made with care in Sri Lanka. Thoughtful frames, beautiful prints and a studio for the memories you want to keep.";

  useEffect(() => {
    setHeroIndex(0);
    setPreviousHeroImage(null);
  }, [heroKey]);
  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);
  useEffect(() => {
    if (heroSlides.length < 2) return;
    const nextImage = new Image();
    nextImage.src = heroSlides[(safeHeroIndex + 1) % heroSlides.length];
  }, [heroKey, safeHeroIndex]);
  const showHeroSlide = (index: number) => {
    if (index === safeHeroIndex || !heroSlides[index]) return;
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPreviousHeroImage(null);
    } else {
      setPreviousHeroImage(heroImage);
      transitionTimer.current = window.setTimeout(() => setPreviousHeroImage(null), 850);
    }
    setHeroIndex(index);
  };
  useEffect(() => {
    if (heroSlides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => showHeroSlide((safeHeroIndex + 1) % heroSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, [heroKey, safeHeroIndex]);

  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 44 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <main className="hv-page">
      <SiteNotices notices={Array.isArray(notices) ? notices : []} />

      {/* ── Hero · full-viewport editorial split ─────────────────── */}
      <section aria-labelledby="studio-title" className="relative overflow-hidden" style={{ minHeight: "100svh", display: "flex", alignItems: "center", paddingTop: 96 }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(1000px 520px at 84% 6%, rgba(184,137,74,0.10), transparent 60%)",
          }}
        />
        <div className="hv-container relative w-full">
          <div className="grid items-center gap-12 lg:gap-20 lg:grid-cols-[1.02fr_0.98fr]" style={{ paddingBlock: "clamp(24px, 4vh, 56px)" }}>
            <div>
            <motion.div {...fadeUp(0.05)}>
              <span className="hv-badge hv-badge-bronze">
                <Sparkles size={13} aria-hidden="true" />
                {cfg?.heroBadgeText || "HAVESTORY · Sri Lankan creative studio"}
              </span>
            </motion.div>
            <motion.h1 id="studio-title" className="hv-display hv-display-xl" style={{ marginTop: 24 }} {...fadeUp(0.14)}>
              {heroTitle}
            </motion.h1>
            <motion.p className="hv-lede" style={{ marginTop: 24, maxWidth: "52ch" }} {...fadeUp(0.22)}>
              {heroSubtitle}
            </motion.p>
            <motion.div className="flex flex-wrap items-center" style={{ marginTop: 36, gap: "16px 36px" }} {...fadeUp(0.3)}>
              <Link href={primaryHeroHref} className="hv-btn hv-btn-bronze">
                {primaryHeroLabel} <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={primaryIsCustom ? "/store" : "/custom-project"} className="hv-text-link">
                {primaryIsCustom ? "Browse frames" : "Request a custom frame"} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </motion.div>
          </div>

            <div className="hv-hero-stage" ref={heroRef}>
              <motion.div
                className="hv-hero-panel"
                style={{ y: heroArchY }}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 64 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.1, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="hv-hero-frame">
                  <div className="hv-hero-frame-photo">
                    {previousHeroImage && (
                      <img
                        src={previousHeroImage}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        style={{ position: "absolute", inset: 0 }}
                      />
                    )}
                    <motion.img
                      key={heroImage}
                      src={heroImage}
                      alt="A framed piece from the HAVESTORY studio"
                      fetchPriority={safeHeroIndex === 0 ? "high" : "auto"}
                      decoding="async"
                      style={{ position: "absolute", inset: 0 }}
                      initial={reduceMotion || !previousHeroImage ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <div className="hv-hero-frame-bar">
                    <span className="hv-hero-frame-cap">
                      <i aria-hidden="true" /> Live studio piece
                    </span>
                    <span className="hv-hero-frame-tag">A3 · Oak · Museum glass</span>
                  </div>
                </div>
                <motion.div
                  aria-hidden="true"
                  className="hv-hero-frame-sm hv-hero-frame-sm-a"
                  style={{ y: heroOrbY }}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: 10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.9, delay: 0.62, ease: [0.22, 1, 0.36, 1] }}
                >
                  <img src={orbHeroImage} alt="" loading="lazy" decoding="async" />
                </motion.div>
                <motion.div
                  aria-hidden="true"
                  className="hv-hero-frame-sm hv-hero-frame-sm-b hv-float"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.78 }}
                >
                  <img src={nextHeroImage} alt="" loading="lazy" decoding="async" />
                </motion.div>
              </motion.div>
              {heroSlides.length > 1 && (
                <div role="group" aria-label="Studio gallery images" className="hv-hero-dots">
                  {heroSlides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Show image ${index + 1} of ${heroSlides.length}`}
                      aria-current={index === safeHeroIndex ? "true" : undefined}
                      onClick={() => showHeroSlide(index)}
                      className={`hv-hero-dot${index === safeHeroIndex ? " is-active" : ""}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────── */}
      {benefitsVisible && (
        <section className="hv-section-tight" aria-label="Studio promises">
          <div className="hv-container">
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit, index) => {
                const Icon = BENEFIT_ICONS[benefit.icon] || Sparkles;
                return (
                  <StaggerItem key={`${benefit.title}-${index}`}>
                    <article className="hv-card hv-card-hover hv-benefit-card p-8">
                      <span className="hv-benefit-icon">
                        <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <h2 className="text-[17px] font-bold tracking-tight" style={{ marginTop: 20 }}>
                        {benefit.title}
                      </h2>
                      <p className="text-[14.5px] leading-relaxed" style={{ marginTop: 8, color: "var(--hv-muted)" }}>
                        {benefit.copy}
                      </p>
                    </article>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>
      )}

      {/* ── Collections ──────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="hv-section" aria-labelledby="studio-collections-title">
          <div className="hv-container">
            <SectionHead
              id="studio-collections-title"
              eyebrow="Collections"
              title="A beautiful place for every story."
              copy="Explore the craft, materials and pieces that make a memory feel at home."
            />
            <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
              {categories.map((item, index) => (
                <StaggerItem key={`${item.title}-${index}`} className={COLLECTION_SPANS[index] || ""}>
                  <Link href={safeSiteHref(item.href, "/store")} className="group hv-collection-card">
                    <div className="hv-img-frame" style={{ aspectRatio: "16/10", boxShadow: "var(--hv-shadow-md)" }}>
                      <img src={item.image} alt="" loading="lazy" decoding="async" />
                    </div>
                    <div className="hv-collection-body">
                      <div className="flex items-start justify-between gap-6" style={{ marginTop: 22 }}>
                        <div>
                          <span className="hv-kicker">0{index + 1} · Collection</span>
                          <h3 className="hv-display hv-display-sm" style={{ marginTop: 10 }}>
                            {item.title}
                          </h3>
                          <p className="text-[15px] leading-relaxed" style={{ marginTop: 8, color: "var(--hv-muted)" }}>
                            {item.copy}
                          </p>
                        </div>
                      </div>
                      <div className="hv-collection-foot">
                        <span className="hv-text-link">
                          Explore collection <ArrowRight size={15} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ── Featured products ────────────────────────────────────── */}
      <section className="hv-section hv-band-blush" aria-labelledby="studio-products-title">
        <div className="hv-container">
          <SectionHead
            id="studio-products-title"
            eyebrow="Frames & Prints"
            title="Pieces worth keeping."
            copy="Selected from the collection for homes, gifts and everyday memories."
            href="/store"
            link="Shop all pieces"
          />
          {favouriteProducts.length ? (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {favouriteProducts.map((product) => (
                <StaggerItem key={product.id}>
                  <Link href={`/store/${product.slug || product.id}`} className="hv-card hv-card-hover block h-full p-4">
                    <div className="hv-img-frame" style={{ aspectRatio: "1/1" }}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" />
                      ) : (
                        <span className="grid place-items-center w-full h-full" style={{ color: "var(--hv-faint)" }}>
                          <ImageIcon size={40} strokeWidth={1.2} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="px-2 pt-4 pb-2">
                      <span
                        className="text-[10.5px] font-extrabold uppercase"
                        style={{ letterSpacing: "0.16em", color: "var(--hv-bronze-deep)" }}
                      >
                        {product.category?.name || "HAVESTORY edition"}
                      </span>
                      <h3 className="text-[16.5px] font-bold tracking-tight leading-snug" style={{ marginTop: 6 }}>
                        {product.name}
                      </h3>
                      <p className="hv-display text-[19px]" style={{ marginTop: 8, color: "var(--hv-bronze-deep)" }}>
                        {product.price ? `Rs. ${Number(product.price).toLocaleString()}` : "Quote on request"}
                      </p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          ) : (
            <ComingSoon
              eyebrow="Collection in progress"
              title="New pieces are on the way."
              description="The shop is being prepared, but custom orders are open now."
              href="/custom-project"
              cta="Start a custom order"
            />
          )}
        </div>
      </section>

      {/* ── Brand heritage strip · official HAVESTORY artwork ───────── */}
      <section className="hv-section-tight" aria-label="The HAVESTORY brand">
        <div className="hv-container">
          <Reveal>
            <div className="hv-img-frame" style={{ borderRadius: 20, border: "1px solid rgba(184,137,74,0.35)" }}>
              <img
                src="/brand/havestory-banner.jpg"
                alt="HAVESTORY — More than frames, a story for life. Photo frames, custom framing, gifts and keepsakes, personalised designs and studio services."
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className="hv-display text-center" style={{ marginTop: 22, fontSize: "clamp(19px, 2.4vw, 27px)", fontStyle: "italic", color: "var(--hv-ink)" }}>
              More than frames, <span style={{ color: "var(--hv-accent-deep)" }}>a story for life.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Portfolio · dark gallery band ────────────────────────── */}
      {portfolioList.length > 0 && (
        <section className="hv-dark hv-grain hv-section relative" aria-labelledby="studio-gallery-title">
          <div className="hv-container relative">
            <div className="hv-marquee" aria-hidden="true" style={{ marginBottom: "clamp(36px, 5vw, 64px)" }}>
              <div className="hv-marquee-track">
                {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, index) => (
                  <span key={index} className="hv-display hv-display-md" style={{ fontStyle: "italic", color: "var(--hv-gold)" }}>
                    {word}
                    <span style={{ marginLeft: "clamp(32px, 5vw, 72px)", opacity: 0.5 }}>✦</span>
                  </span>
                ))}
              </div>
            </div>
            <SectionHead
              id="studio-gallery-title"
              eyebrow="Recent Work"
              title="Made in our studio."
              copy="A few moments brought into focus."
              href="/gallery"
              link="Explore the gallery"
            />
            <Stagger className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {portfolioList.map((item, index) => (
                <StaggerItem key={item.id}>
                  <Link
                    href="/gallery"
                    className="hv-img-frame group relative block"
                    style={{ aspectRatio: index % 3 === 1 ? "3/4" : index % 3 === 0 ? "1/1" : "4/3" }}
                    aria-label={item.title ? `View ${item.title} in the gallery` : "View work in the gallery"}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title || "HAVESTORY studio work"} loading="lazy" decoding="async" />
                    ) : (
                      <span className="grid place-items-center w-full h-full" style={{ color: "var(--hv-on-dark-muted)" }}>
                        <ImageIcon size={36} strokeWidth={1.2} aria-hidden="true" />
                      </span>
                    )}
                    <span
                      className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 pb-4 pt-10 text-[13.5px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: "linear-gradient(transparent, rgba(18,14,10,0.82))",
                        color: "var(--hv-on-dark)",
                      }}
                    >
                      <span className="truncate">{item.title || `Studio story ${index + 1}`}</span>
                      <ArrowRight size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                    </span>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ── Services ─────────────────────────────────────────────── */}
      {serviceList.length > 0 && (
        <section className="hv-section" aria-labelledby="studio-services-title">
          <div className="hv-container">
            <SectionHead
              id="studio-services-title"
              eyebrow="Studio Services"
              title="More from the studio."
              href="/services"
              link="Explore services"
            />
            <Reveal>
              <div style={{ borderTop: "1px solid var(--hv-line)" }}>
                {serviceList.map((service, index) => (
                  <Link
                    key={service.id}
                    href="/services"
                    className="group flex items-center gap-6 md:gap-10"
                    style={{ paddingBlock: 28, borderBottom: "1px solid var(--hv-line-soft)" }}
                  >
                    <span className="hv-display hv-display-sm" style={{ color: "var(--hv-bronze)", minWidth: 56 }}>
                      0{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="hv-display hv-display-sm">{service.name}</h3>
                      <p className="text-[15px] leading-relaxed" style={{ marginTop: 6, color: "var(--hv-muted)", maxWidth: "56ch" }}>
                        {service.description || "Designed and finished with the HAVESTORY studio."}
                      </p>
                    </div>
                    <span
                      className="grid place-items-center rounded-full shrink-0 group-hover:bg-[var(--hv-ink)] group-hover:text-[#fdfaf4] group-hover:border-transparent"
                      style={{
                        width: 52,
                        height: 52,
                        border: "1px solid var(--hv-line)",
                        transition: "all 0.35s var(--hv-ease)",
                      }}
                    >
                      <ArrowRight size={20} aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── Reviews ──────────────────────────────────────────────── */}
      {reviewList.length > 0 && (
        <section className="hv-section-tight" aria-labelledby="studio-reviews-title">
          <div className="hv-container">
            <SectionHead id="studio-reviews-title" eyebrow="Client Reviews" title="Stories from our clients." />
            <Stagger className="grid gap-6 md:grid-cols-3">
              {reviewList.map((review) => (
                <StaggerItem key={review.id}>
                  <blockquote className="hv-card h-full p-8 flex flex-col">
                    <Quote size={28} aria-hidden="true" style={{ color: "var(--hv-bronze)" }} />
                    <p className="hv-display text-[19px] leading-relaxed flex-1" style={{ marginTop: 20, fontWeight: 500 }}>
                      “{review.comment}”
                    </p>
                    <footer className="flex items-center justify-between gap-4" style={{ marginTop: 24 }}>
                      <strong className="text-[14.5px] font-bold">{review.customerName}</strong>
                      <span aria-label={`${review.rating || 5} out of 5 stars`} style={{ color: "var(--hv-gold)", letterSpacing: 2 }}>
                        {"★".repeat(Math.min(5, review.rating || 5))}
                      </span>
                    </footer>
                  </blockquote>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="hv-section" aria-labelledby="studio-closing-title">
        <div className="hv-container">
          <Reveal>
            <div
              className="hv-card text-center relative overflow-hidden"
              style={{
                padding: "clamp(48px, 7vw, 96px) clamp(24px, 6vw, 80px)",
                background:
                  "radial-gradient(700px 340px at 50% 0%, rgba(184,137,74,0.10), transparent 65%), var(--hv-card)",
              }}
            >
              <span className="hv-kicker hv-kicker-center justify-center">Custom Framing</span>
              <h2 id="studio-closing-title" className="hv-display hv-display-lg" style={{ marginTop: 18 }}>
                Need a different size or finish?
              </h2>
              <p className="hv-lede" style={{ margin: "18px auto 0" }}>
                Tell us what you need and we will send a quote.
              </p>
              <div style={{ marginTop: 34 }}>
                <Link href="/custom-project" className="hv-btn hv-btn-bronze">
                  Request a custom frame <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="hv-ornament" style={{ marginTop: 40 }} aria-hidden="true">
                <Sparkles size={18} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
