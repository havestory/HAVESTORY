import "./studio-home.css";
import { SiteNotices } from "@/components/public/SiteNotices";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  Image as ImageIcon,
  PackageCheck,
  Palette,
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

function Heading({ eyebrow, title, copy, href, link }: { eyebrow: string; title: string; copy?: string; href?: string; link?: string }) {
  return (
    <div className="studio-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {copy && <p>{copy}</p>}
      </div>
      {href && <Link href={href}>{link || "View all"}<ArrowRight size={16} /></Link>}
    </div>
  );
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: notices } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews } = useListReviews();
  const [heroIndex, setHeroIndex] = useState(0);

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
  const configuredSlides = heroSlots.filter((image, index): image is string => Boolean(image && slideEnabled[index]));
  const heroSlides = configuredSlides.length ? configuredSlides : [cfg?.heroBgImage || DEFAULT_IMAGES[0]];
  const heroKey = heroSlides.join("|");
  const safeHeroIndex = heroIndex % heroSlides.length;
  const heroImage = heroSlides[safeHeroIndex];
  const categoryFallbacks = [
    { title: "Custom Frames", copy: "Made to your photograph and space.", href: "/store", tone: "violet", image: DEFAULT_IMAGES[1] },
    { title: "Fine Art Prints", copy: "Colour-managed, crisp and lasting.", href: "/store", tone: "gold", image: DEFAULT_IMAGES[2] },
    { title: "Personal Gifts", copy: "Meaningful pieces for every occasion.", href: "/custom-project", tone: "rose", image: portfolioList[0]?.imageUrl || DEFAULT_IMAGES[0] },
    { title: "Studio Sessions", copy: "Portrait and product photography with a gallery finish.", href: "/services", tone: "sage", image: portfolioList[1]?.imageUrl || DEFAULT_IMAGES[1] },
  ];
  const categories = categoryFallbacks.map((fallback, index) => ({ ...fallback, ...(featureCards[index] || {}), image: featureCards[index]?.image || fallback.image }));
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

  useEffect(() => setHeroIndex(0), [heroKey]);
  useEffect(() => {
    if (heroSlides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setHeroIndex((value) => (value + 1) % heroSlides.length), 7500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, heroKey]);

  return (
    <main className="studio-home">
      <SiteNotices notices={Array.isArray(notices) ? notices : []} />
      <section className="studio-opening" aria-labelledby="studio-title">
        <div className="studio-opening-copy">
          <span className="studio-kicker"><span className="studio-kicker-line" /> {cfg?.heroBadgeText || "HAVESTORY · Sri Lankan creative studio"}</span>
          <h1 id="studio-title">{heroTitle}</h1>
          <p>{heroSubtitle}</p>
          <div className="studio-actions">
            <Link href={primaryHeroHref} className="studio-action-primary">{primaryHeroLabel}<ArrowRight size={18} /></Link>
            <Link href={primaryIsCustom ? "/store" : "/custom-project"} className="studio-action-text">{primaryIsCustom ? "Browse frames" : "Request a custom frame"} <ArrowRight size={17} /></Link>
          </div>
        </div>
        <div className="studio-opening-art">
          <img src={heroImage} alt="A framed piece from the HAVESTORY studio" fetchPriority="high" decoding="async" />

          {heroSlides.length > 1 && <div className="studio-slide-controls" aria-label="Hero images">{heroSlides.map((_, index) => <button key={index} type="button" aria-label={`Show image ${index + 1}`} aria-current={index === safeHeroIndex} onClick={() => setHeroIndex(index)} />)}</div>}
        </div>
      </section>

      {benefitsVisible && <section className="studio-assurances" aria-label="Studio promises">{benefits.map((benefit, index) => { const Icon = BENEFIT_ICONS[benefit.icon] || Sparkles; return <article key={`${benefit.title}-${index}`}><Icon size={22} strokeWidth={1.4} aria-hidden="true" /><div><h2>{benefit.title}</h2><p>{benefit.copy}</p></div></article>; })}</section>}

      {categories.length > 0 && <section className="studio-section studio-collections" aria-labelledby="studio-collections-title">
        <Heading eyebrow="COLLECTIONS" title="A beautiful place for every story." copy="Explore the craft, materials and pieces that make a memory feel at home." />
        <div className="studio-collection-grid">{categories.map((item, index) => <Link key={`${item.title}-${index}`} href={safeSiteHref(item.href, "/store")} className={`studio-collection-card studio-collection-card-${index + 1}`}><img src={item.image} alt="" loading="lazy" decoding="async" /><div><span>0{index + 1} / COLLECTION</span><h3>{item.title}</h3><p>{item.copy}</p><strong>Explore collection <ArrowRight size={17} /></strong></div></Link>)}</div>
      </section>}

      <section className="studio-section studio-products">
        <Heading eyebrow="FRAMES & PRINTS" title="Pieces worth keeping." copy="Selected from the collection for homes, gifts and everyday memories." href="/store" link="Shop all pieces" />
        {favouriteProducts.length ? <div className="studio-product-grid">{favouriteProducts.map(product => <Link href={`/store/${product.slug || product.id}`} key={product.id} className="studio-product-card"><div>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <ImageIcon />}</div><span>{product.category?.name || "HAVESTORY edition"}</span><h3>{product.name}</h3><p>{product.price ? `Rs. ${Number(product.price).toLocaleString()}` : "Quote on request"}</p></Link>)}</div> : <ComingSoon eyebrow="Collection in progress" title="New pieces are on the way." description="The shop is being prepared, but custom orders are open now." href="/custom-project" cta="Start a custom order" />}
      </section>

      {portfolioList.length > 0 && <section className="studio-section studio-gallery"><Heading eyebrow="RECENT WORK" title="Made in our studio." copy="A few moments brought into focus." href="/gallery" link="Explore the gallery" /><div className="studio-gallery-grid">{portfolioList.map((item, index) => <Link key={item.id} href="/gallery" className={`studio-gallery-item studio-gallery-item-${index + 1}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title || "HAVESTORY studio work"} loading="lazy" /> : <ImageIcon />}<span>{item.title || `Studio story ${index + 1}`} <ArrowRight size={16} /></span></Link>)}</div></section>}

      {serviceList.length > 0 && <section className="studio-section studio-services"><Heading eyebrow="STUDIO SERVICES" title="More from the studio." href="/services" link="Explore services" /><div>{serviceList.map((service, index) => <Link href="/services" key={service.id}><span>0{index + 1}</span><div><h3>{service.name}</h3><p>{service.description || "Designed and finished with the HAVESTORY studio."}</p></div><ArrowRight size={20} /></Link>)}</div></section>}

      {reviewList.length > 0 && <section className="studio-section studio-reviews"><Heading eyebrow="CLIENT REVIEWS" title="Stories from our clients." /><div>{reviewList.map(review => <blockquote key={review.id}><p>“{review.comment}”</p><footer><strong>{review.customerName}</strong><span aria-label={`${review.rating || 5} out of 5 stars`}>{"★".repeat(Math.min(5, review.rating || 5))}</span></footer></blockquote>)}</div></section>}

      <section className="studio-closing"><span className="studio-kicker">CUSTOM FRAMING</span><h2>Need a different size or finish?</h2><p>Tell us what you need and we will send a quote.</p><Link href="/custom-project" className="studio-action-primary">Request a custom frame <ArrowRight size={18} /></Link></section>
    </main>
  );
}
