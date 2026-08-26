import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  PackageCheck,
  Palette,
  Quote,
  Ruler,
  Sparkles,
  Truck,
  X,
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
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1800&q=88",
  "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1200&q=86",
  "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1200&q=86",
];

function Heading({ eyebrow, title, copy, href, link }: { eyebrow: string; title: string; copy?: string; href?: string; link?: string }) {
  return (
    <div className="hs-new-heading">
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
  const [dismissedNotices, setDismissedNotices] = useState<number[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [favouriteIndex, setFavouriteIndex] = useState(0);

  const allProducts = Array.isArray(products) ? products : [];
  const featuredProducts = allProducts.filter((item) => item.featured);
  const favouritePool = featuredProducts.length ? featuredProducts : allProducts;
  const portfolioList = (Array.isArray(portfolio) ? portfolio : []).slice(0, 6);
  const serviceList = (Array.isArray(services) ? services : []).slice(0, 4);
  const reviewList = (Array.isArray(reviews) ? reviews : []).filter((item) => item.approved).slice(0, 3);
  const activeNotices = (Array.isArray(notices) ? notices : []).filter((item) => item.enabled && !dismissedNotices.includes(item.id));
  const cfg = settings as any;

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
  ];
  const categories = categoryFallbacks.map((fallback, index) => ({ ...fallback, ...(featureCards[index] || {}), image: featureCards[index]?.image || fallback.image }));
  const favouriteWindow = Math.min(4, favouritePool.length);
  const favouriteProducts = favouriteWindow ? Array.from({ length: favouriteWindow }, (_, index) => favouritePool[(favouriteIndex * favouriteWindow + index) % favouritePool.length]) : [];
  const benefits = [
    { label: "Colour checked", Icon: Palette },
    { label: "Made to measure", Icon: Ruler },
    { label: "Securely packed", Icon: PackageCheck },
    { label: "Island-wide delivery", Icon: Truck },
  ];
  const process = [
    ["01", "Share your idea", "Upload the photo and tell us where it will live."],
    ["02", "Choose together", "We help select size, paper, finish and frame."],
    ["03", "Approve the details", "Receive a clear quote before production begins."],
    ["04", "Receive it safely", "We finish, check, pack and deliver your piece."],
  ];
  const heroTitle = cfg?.heroTitle || "Frame the Moments That Stay";
  const heroSubtitle = cfg?.heroSubtitle || "Thoughtfully made photo frames that turn everyday moments into a gallery of your own.";

  useEffect(() => setHeroIndex(0), [heroKey]);
  useEffect(() => {
    if (heroSlides.length < 2) return;
    const timer = window.setInterval(() => setHeroIndex((value) => (value + 1) % heroSlides.length), 4600);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, heroKey]);
  useEffect(() => setFavouriteIndex(0), [favouritePool.map((item) => item.id).join("|")]);
  useEffect(() => {
    if (favouritePool.length <= 1) return;
    const timer = window.setInterval(() => setFavouriteIndex((value) => value + 1), 5600);
    return () => window.clearInterval(timer);
  }, [favouritePool.length, favouritePool.map((item) => item.id).join("|")]);

  return (
    <main className="hs-new-home">
      <AnimatePresence>
        {activeNotices.map((notice) => (
          <motion.div key={notice.id} className="hs-new-notice" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <span>{notice.message}</span>
            <button type="button" onClick={() => setDismissedNotices((items) => [...items, notice.id])} aria-label="Dismiss notice"><X size={15} /></button>
          </motion.div>
        ))}
      </AnimatePresence>

      <section className="hs-new-hero">
        <div className="hs-new-hero-photo">
          <AnimatePresence initial={false} mode="wait">
            <motion.img key={`${safeHeroIndex}-${heroImage}`} src={heroImage} alt="HAVESTORY framed studio collection" initial={{ opacity: 0, scale: 1.06, x: 28 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 1.02, x: -28 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          </AnimatePresence>
          <div className="hs-new-hero-wash" />
          <div className="hs-new-hero-index"><strong>{String(safeHeroIndex + 1).padStart(2, "0")}</strong><span>/ {String(heroSlides.length).padStart(2, "0")}</span></div>
          {heroSlides.length > 1 && <div className="hs-new-hero-dots">{heroSlides.map((_, index) => <button key={index} type="button" aria-label={`Show hero image ${index + 1}`} aria-current={index === safeHeroIndex} onClick={() => setHeroIndex(index)} />)}</div>}
        </div>
        <motion.div className="hs-new-hero-card" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.12 }}>
          <span className="hs-new-kicker"><Sparkles size={15} /> {cfg?.heroBadgeText || "Photo studio · Print lab · Frame shop"}</span>
          <h1 className="hs-hero-title-animated">{heroTitle}</h1>
          <p>{heroSubtitle}</p>
          <div className="hs-new-hero-actions">
            <Link href={cfg?.heroCtaLink || "/store"} className="hs-new-button hs-new-button-dark">{cfg?.heroCtaText || "Find your frame"}<ArrowRight size={17} /></Link>
            <Link href="/custom-project" className="hs-new-button hs-new-button-light">Create something custom</Link>
          </div>
        </motion.div>
      </section>

      <section className="hs-new-benefits" aria-label="HAVESTORY service benefits">
        <div className="hs-new-benefits-track">
          {[0, 1].map((group) => (
            <div key={group} className="hs-new-benefits-group" aria-hidden={group === 1}>
              {benefits.map(({ label, Icon }) => <span key={`${group}-${label}`}><Icon size={18} />{label}</span>)}
            </div>
          ))}
        </div>
      </section>

      <section className="hs-new-section hs-new-category-section">
        <Heading eyebrow="01 / Choose your story" title="Find the right way to frame it." copy="Start with the feeling. We will help with every material, crop and finish after that." />
        <div className="hs-new-category-grid">
          {categories.map((item, index) => <motion.article key={`${item.title}-${index}`} className={`hs-new-category hs-new-category-${item.tone}`} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ delay: index * 0.08 }}>
            <Link href={item.href || "/store"}><div className="hs-new-category-copy"><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p><b>Explore <ArrowRight size={15} /></b></div><img src={item.image} alt={item.title} loading="lazy" /></Link>
          </motion.article>)}
        </div>
      </section>

      <section className="hs-new-section hs-new-favourites">
        <Heading eyebrow="02 / Studio favourites" title="Pieces people keep coming back to." copy="A rotating edit of ready-to-order editions for gifting, home and everyday memories." href="/store" link="Shop the collection" />
        {favouriteProducts.length ? <div className="hs-new-favourite-stage"><button type="button" className="hs-new-carousel-button" onClick={() => setFavouriteIndex((value) => Math.max(0, value - 1))} aria-label="Previous favourites"><ChevronLeft /></button><div className="hs-new-favourite-grid"><AnimatePresence initial={false} mode="popLayout">{favouriteProducts.map((product, index) => <motion.article key={product.id} className="hs-new-favourite-card" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ delay: index * 0.06 }}><Link href={`/store/${product.slug || product.id}`}><div className="hs-new-favourite-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <ImageIcon />}<span>Studio edit</span></div><div className="hs-new-favourite-info"><small>{product.category?.name || "HAVESTORY edition"}</small><h3>{product.name}</h3><strong>{product.price ? `Rs. ${Number(product.price).toLocaleString()}` : "Quote on request"}</strong><span>View edition <ArrowRight size={14} /></span></div></Link></motion.article>)}</AnimatePresence></div><button type="button" className="hs-new-carousel-button" onClick={() => setFavouriteIndex((value) => value + 1)} aria-label="Next favourites"><ChevronRight /></button></div> : <ComingSoon eyebrow="Collection in progress" title="New pieces are on the way." description="The shop is being prepared, but custom orders are open now." href="/custom-project" cta="Start a custom order" />}
      </section>

      <section className="hs-new-process"><div className="hs-new-process-intro"><span>03 / The studio process</span><h2>Your photo.<br /><em>Our craft.</em></h2><p>No confusing specifications. Send the memory and we will guide the material, crop, finish and size.</p><Link href="/custom-project" className="hs-new-button hs-new-button-gold">Start with an idea <ArrowRight size={17} /></Link></div><div className="hs-new-process-list">{process.map(([number, title, copy]) => <div key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><ArrowRight size={18} /></div>)}</div></section>

      {portfolioList.length > 0 && <section className="hs-new-section hs-new-work"><Heading eyebrow="04 / Created at HAVESTORY" title="Recent studio work." copy="Frames, prints and personal pieces made for real homes and real stories." href="/gallery" link="Open gallery" /><div className="hs-new-work-grid">{portfolioList.map((item, index) => <motion.div key={item.id} className={`hs-new-work-item hs-new-work-${index + 1}`} whileHover={{ y: -7 }}><Link href="/gallery">{item.imageUrl ? <img src={item.imageUrl} alt={item.title || "HAVESTORY studio work"} loading="lazy" /> : <ImageIcon />}<span><b>{item.title || `Studio story ${index + 1}`}</b><i>View project <ArrowRight size={14} /></i></span></Link></motion.div>)}</div></section>}

      {serviceList.length > 0 && <section className="hs-new-section hs-new-services"><Heading eyebrow="05 / More ways to make it yours" title="Studio services." href="/services" link="View all services" /><div>{serviceList.map((service, index) => <Link href="/services" key={service.id}><span>0{index + 1}</span><div><h3>{service.name}</h3><p>{service.description || "Designed and finished with the HAVESTORY studio."}</p></div><ArrowRight /></Link>)}</div></section>}

      {reviewList.length > 0 && <section className="hs-new-section hs-new-reviews"><Heading eyebrow="06 / Loved by our clients" title="Stories from happy walls." /><div>{reviewList.map((review) => <blockquote key={review.id}><Quote size={24} /><p>“{review.comment}”</p><footer><strong>{review.customerName}</strong><span>{"★".repeat(Math.min(5, review.rating || 5))}</span></footer></blockquote>)}</div></section>}

      <section className="hs-new-final"><div><span>Have a photograph in mind?</span><h2>Make something<br /><em>worth keeping.</em></h2><p>Tell us the idea. We will help with the rest.</p></div><Link href="/custom-project" className="hs-new-button hs-new-button-gold">Start a custom project <ArrowRight size={17} /></Link></section>
    </main>
  );
}
