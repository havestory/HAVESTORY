import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BadgeCheck, Frame, Palette, Truck, Sparkles } from "lucide-react";
import { getBusinessName } from "@/lib/brand-settings";

type Props = {
  settings: any;
  publicStats?: any;
};

const defaultCategories = [
  { title: "Frame Editions", copy: "Gallery profiles, clean finishes and made-to-fit sizing.", href: "/store" },
  { title: "Colour Prints", copy: "Carefully balanced photographs with rich, lasting detail.", href: "/store" },
  { title: "Story Collages", copy: "A thoughtful edit of many moments in one composition.", href: "/store" },
  { title: "Studio Sessions", copy: "Portraits shaped with calm direction and considered light.", href: "/services" },
];

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
    settings?.heroBgImage,
  ].filter(Boolean) as string[], [settings]);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setSlide(value => (value + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const businessName = getBusinessName(settings);
  const heroTitle = settings?.heroTitle || "Capturing Stories, Framing Memories";
  const categories = configuredCategories(settings);
  const categoryImages = [slides[1], slides[2], slides[3], slides[4] || slides[0]];

  return (
    <section className="hs-hero">
      <div className="hs-hero-stage">
        <div className="hs-hero-backdrop">
          {slides.length ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={slides[slide]}
                src={slides[slide]}
                alt={`${businessName || "Studio"} photography studio`}
                initial={{ opacity: 0, scale: 1.035 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          ) : <div className="hs-hero-placeholder"><Frame size={74} strokeWidth={1} /><span>Add a hero image in Website Editor</span></div>}
        </div>
        <div className="hs-hero-overlay" />

        <motion.div
          className="hs-hero-copy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .75, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="hs-kicker"><Sparkles size={13} /> {settings?.heroBadgeText || "Premium Studio"}</span>
          <h1>{heroTitle}</h1>
          <p>{settings?.heroSubtitle || "Archival-quality photographs, carefully balanced colour and frames finished for the moments worth keeping."}</p>
          <div className="hs-hero-actions">
            <Link href={settings?.heroCtaLink || "/custom-project"} className="hs-button hs-button-primary">
              {settings?.heroCtaText || "Start Your Project"}
            </Link>
            <Link href="/store" className="hs-button hs-button-outline">Shop Frames</Link>
          </div>
        </motion.div>

        {slides.length > 1 && <div className="hs-slide-controls" aria-label="Hero images">
          {slides.map((_, index) => <button key={index} className={index === slide ? "active" : ""} onClick={() => setSlide(index)} aria-label={`Show image ${index + 1}`} />)}
        </div>}
      </div>

      <div className="hs-category-rail">
        {categories.map((category, index) => (
          <Link href={category.href} className="hs-category-card" key={`${category.title}-${index}`}>
            {categoryImages[index] ? <img src={categoryImages[index]} alt="" /> : <div className="hs-category-placeholder"><Frame strokeWidth={1.2} /></div>}
            <span className="hs-category-shade" />
            <div><strong>{category.title}</strong><small>{category.copy}</small></div>
          </Link>
        ))}
      </div>

      <div className="hs-proof-strip">
        <div><Palette /><span><strong>Colour Checked Production</strong><small>Balanced before every final print.</small></span></div>
        <div><Frame /><span><strong>Made-to-fit Framing</strong><small>Considered profiles and precise finishing.</small></span></div>
        <div><Truck /><span><strong>Islandwide Delivery</strong><small>{publicStats?.ordersDelivered ? `${publicStats.ordersDelivered}+ completed orders` : "Securely packed and tracked."}</small></span></div>
        <div><BadgeCheck /><span><strong>Studio Guidance</strong><small>Human support from image to frame.</small></span></div>
      </div>
    </section>
  );
}
