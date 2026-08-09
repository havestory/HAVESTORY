import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, BadgeCheck, Box, BriefcaseBusiness, Headphones,
  ShoppingCart, Sparkles, Sticker, Truck, UploadCloud
} from "lucide-react";

type Props = {
  settings: any;
  publicStats?: any;
};

const defaultCategories = [
  { title: "Stickers & Labels", copy: "Custom shapes, any size, any finish.", href: "/store" },
  { title: "Business Cards", copy: "Premium cards that leave an impression.", href: "/store" },
  { title: "Packaging", copy: "Custom boxes and labels that stand out.", href: "/store" },
  { title: "Marketing Prints", copy: "Flyers, posters and more for your brand.", href: "/store" },
];
const categoryIcons = [Sticker, BriefcaseBusiness, Box, Sparkles];

function configuredCategories(settings: any) {
  try {
    const parsed = typeof settings?.homeFeatureCards === "string"
      ? JSON.parse(settings.homeFeatureCards)
      : settings?.homeFeatureCards;
    if (!Array.isArray(parsed) || !parsed.length) return defaultCategories;
    return defaultCategories.map((fallback, index) => ({
      title: String(parsed[index]?.title || fallback.title),
      copy: String(parsed[index]?.copy || fallback.copy),
      href: String(parsed[index]?.href || fallback.href),
    }));
  } catch {
    return defaultCategories;
  }
}

export function PremiumHero({ settings, publicStats }: Props) {
  const slides = useMemo(() => [
    settings?.heroSlideImage1,
    settings?.heroSlideImage2,
    settings?.heroSlideImage3,
    settings?.heroSlideImage4,
    settings?.heroSlideImage5,
  ].filter(Boolean) as string[], [settings]);

  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setSlide(v => (v + 1) % slides.length), 3800);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const visual = slides[slide] || "";
  const heroTitle = settings?.heroTitle || "Your ideas. Beautifully printed.";
  const categories = configuredCategories(settings);

  return (
    <section className="pb-premium-home">
      <div className="pb-hero-grid">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .55 }}
          className="pb-hero-copy"
        >
          <span className="pb-eyebrow">{settings?.heroBadgeText || "Custom printing, made simple"}</span>
          <motion.h1 className="pb-animated-title" initial="hidden" animate="show" variants={{ hidden:{}, show:{ transition:{ staggerChildren:.085, delayChildren:.12 } } }}>
            {heroTitle.split(/\s+/).map((word: string, index: number) => (
              <motion.span key={`${word}-${index}`} variants={{ hidden:{ opacity:0, y:24, filter:"blur(8px)" }, show:{ opacity:1, y:0, filter:"blur(0px)", transition:{ duration:.65, ease:[.22,1,.36,1] } } }}>{word}&nbsp;</motion.span>
            ))}
          </motion.h1>
          <p>{settings?.heroSubtitle || "Order custom stickers, labels, business cards, packaging and more — all in a few easy steps."}</p>

          <div className="pb-hero-actions">
            <Link href={settings?.heroCtaLink || "/custom-project"} className="pb-primary-cta">
              {settings?.heroCtaText || "Start Your Order"} <ArrowRight size={20} />
            </Link>
            <Link href="/store" className="pb-secondary-cta">
              Browse Products <ArrowRight size={20} />
            </Link>
          </div>

          <div className="pb-upload-note"><UploadCloud size={20} /> Upload your design or let us help.</div>
        </motion.div>

        <div className="pb-hero-visual">
          {visual && (
            <AnimatePresence mode="sync" initial={false}>
              <motion.img
                key={visual}
                src={visual}
                alt="PrintBloom custom printing samples"
                initial={{ opacity: 0, scale: 1.08, x: 28, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 1.035, x: -22, filter: "blur(4px)" }}
                transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          )}
          {slides.length > 1 && (
            <div className="pb-slide-dots">
              {slides.map((_, i) => <button key={i} onClick={() => setSlide(i)} className={i === slide ? "active" : ""} aria-label={`Show slide ${i + 1}`} />)}
            </div>
          )}
        </div>
      </div>

      <div className="pb-category-grid">
        {categories.map(({ title, copy, href }, i) => {
          const Icon = categoryIcons[i];
          return (
          <Link href={href} className="pb-category-card" key={`${i}-${title}`}>
            <span className={i % 2 ? "blue" : "pink"}><Icon size={30} /></span>
            <div><strong>{title}</strong><p>{copy}</p></div>
            <ArrowRight size={19} />
          </Link>
          );
        })}
      </div>

      <div className="pb-trust-strip">
        <div><ShoppingCart /><span><strong>Easy Online Ordering</strong><small>Simple steps from upload to checkout.</small></span></div>
        <div><BadgeCheck /><span><strong>Print-Ready Quality</strong><small>Crisp prints with premium materials.</small></span></div>
        <div><Truck /><span><strong>Islandwide Delivery</strong><small>{publicStats?.ordersDelivered ? `${publicStats.ordersDelivered}+ orders delivered.` : "Reliable delivery across Sri Lanka."}</small></span></div>
        <div><Headphones /><span><strong>Friendly Design Support</strong><small>Real people ready to help you.</small></span></div>
      </div>
    </section>
  );
}
