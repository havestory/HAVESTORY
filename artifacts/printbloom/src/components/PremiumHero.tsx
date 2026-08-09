import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Aperture, ArrowDownRight, ArrowRight, BadgeCheck, Frame,
  Headphones, Images, Palette, ScanLine, Truck, UploadCloud
} from "lucide-react";
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

const categoryIcons = [Frame, Palette, Images, Aperture];

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
    const timer = window.setInterval(() => setSlide(value => (value + 1) % slides.length), 4600);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const visual = slides[slide] || "";
  const businessName = getBusinessName(settings);
  const heroTitle = settings?.heroTitle || "Make the moment visible.";
  const categories = configuredCategories(settings);

  return (
    <section className="hs-hero">
      <div className="hs-hero-stage">
        <div className="hs-hero-rail" aria-hidden="true">
          <span>{businessName}</span>
          <span>STUDIO / COLOUR LAB</span>
          <span>EST. SRI LANKA</span>
        </div>

        <motion.div
          className="hs-hero-copy"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="hs-kicker">
            <ScanLine size={15} /> {settings?.heroBadgeText || "Portraits · Prints · Frames"}
          </span>
          <h1>
            {heroTitle.split(/\s+/).map((word: string, index: number) => (
              <motion.span
                key={`${word}-${index}`}
                initial={{ opacity: 0, y: 34 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: .6, delay: .08 + index * .055, ease: [0.22, 1, 0.36, 1] }}
              >
                {word}&nbsp;
              </motion.span>
            ))}
          </h1>
          <p>
            {settings?.heroSubtitle || "A modern portrait studio and colour lab for photographs that deserve more than a camera roll."}
          </p>

          <div className="hs-hero-actions">
            <Link href={settings?.heroCtaLink || "/custom-project"} className="hs-button hs-button-signal">
              {settings?.heroCtaText || "Start a project"} <ArrowRight size={18} />
            </Link>
            <Link href="/store" className="hs-button hs-button-ghost">
              Shop frames <ArrowDownRight size={18} />
            </Link>
          </div>

          <div className="hs-upload-line">
            <UploadCloud size={17} />
            <span>Upload a photograph, choose a finish, and approve before production.</span>
          </div>
        </motion.div>

        <div className="hs-hero-media">
          <div className="hs-media-index">
            <span>FRAME</span>
            <strong>{String(slide + 1).padStart(2, "0")}</strong>
            <span>/ {String(Math.max(slides.length, 1)).padStart(2, "0")}</span>
          </div>

          <div className="hs-photo-window">
            {visual ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={visual}
                  src={visual}
                  alt={`${businessName} portrait, colour print and frame collection`}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: .985 }}
                  transition={{ duration: .85, ease: [0.22, 1, 0.36, 1] }}
                />
              </AnimatePresence>
            ) : (
              <div className="hs-photo-placeholder">
                <Frame size={74} strokeWidth={1.2} />
                <span>Your studio image appears here</span>
              </div>
            )}
            <div className="hs-focus-mark hs-focus-mark-a" />
            <div className="hs-focus-mark hs-focus-mark-b" />
          </div>

          {slides.length > 1 && (
            <div className="hs-slide-controls">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSlide(index)}
                  className={index === slide ? "active" : ""}
                  aria-label={`Show studio image ${index + 1}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hs-service-index">
        {categories.map(({ title, copy, href }, index) => {
          const Icon = categoryIcons[index];
          return (
            <Link href={href} className="hs-service-card" key={`${index}-${title}`}>
              <span className="hs-service-number">0{index + 1}</span>
              <Icon size={23} />
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
              <ArrowRight size={17} />
            </Link>
          );
        })}
      </div>

      <div className="hs-proof-strip">
        <div><BadgeCheck /><span><strong>Colour checked</strong><small>Balanced before production</small></span></div>
        <div><Frame /><span><strong>Made to fit</strong><small>Frames finished by hand</small></span></div>
        <div><Truck /><span><strong>Islandwide delivery</strong><small>{publicStats?.ordersDelivered ? `${publicStats.ordersDelivered}+ completed orders` : "Securely packed and tracked"}</small></span></div>
        <div><Headphones /><span><strong>Human guidance</strong><small>Real help from the studio</small></span></div>
      </div>
    </section>
  );
}
