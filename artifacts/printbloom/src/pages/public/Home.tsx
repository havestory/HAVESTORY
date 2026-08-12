import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  useGetSettings, useListProducts, useListServices,
  useGetNotices, useListPortfolio, useListReviews,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  X, ArrowRight, Shield, Truck, Star, Zap,
  Printer, PenTool, Layout, Package, Layers,
  Image as ImageIcon, ChevronLeft, ChevronRight,
  Quote, Play, Pause,
} from 'lucide-react';

/* ─────────────────────────── Hero slides ─────────────────────────── */
const DEFAULT_HERO_SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1920&q=85',
    label: 'Gallery Walls',
    headline: 'Where\nMemories\nBecome Art',
    sub: 'Premium photo frames crafted for Sri Lankan homes and studios.',
  },
  {
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=85',
    label: 'Colour Lab',
    headline: 'Colour\nPerfected\nPrinted',
    sub: 'State-of-the-art colour lab with archival-grade print finishes.',
  },
  {
    img: 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?auto=format&fit=crop&w=1920&q=85',
    label: 'Studio Photography',
    headline: 'Every\nFrame\nTells a Story',
    sub: 'Professional studio photography for portraits, products and events.',
  },
  {
    img: 'https://images.unsplash.com/photo-1541535650810-10d26f5c2ab3?auto=format&fit=crop&w=1920&q=85',
    label: 'Custom Frames',
    headline: 'Crafted\nWith\nPrecision',
    sub: 'Bespoke frame sizes, materials and finishes — your vision, our craft.',
  },
  {
    img: 'https://images.unsplash.com/photo-1490750967868-88df5691892e?auto=format&fit=crop&w=1920&q=85',
    label: 'Fine Art Prints',
    headline: 'Art That\nLasts\nForever',
    sub: 'Museum-grade prints that preserve your moments for generations.',
  },
];

/* ─────────────────────────── AnimatedCounter ─────────────────────── */
function AnimatedCounter({ end, suffix = '', decimals = 0, duration = 1800 }:
  { end: number; suffix?: string; decimals?: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref    = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    let id: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(e * end);
      if (p < 1) id = requestAnimationFrame(step); else setCount(end);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [inView, end, duration]);
  return <span ref={ref}>{count.toFixed(decimals)}{suffix}</span>;
}

/* ─────────────────────────── Main ────────────────────────────────── */
export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products  } = useListProducts();
  const { data: services  } = useListServices();
  const { data: notices   } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews   } = useListReviews();

  const [dismissedNotices, setDismissedNotices] = useState<number[]>([]);
  const [slide,  setSlide]  = useState(0);
  const [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState<boolean[]>(DEFAULT_HERO_SLIDES.map(() => false));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const heroSlideImages = [
    settings?.heroSlideImage1,
    settings?.heroSlideImage2,
    settings?.heroSlideImage3,
    settings?.heroSlideImage4,
    settings?.heroSlideImage5,
  ];
  const heroSlides = DEFAULT_HERO_SLIDES.map((item, index) => ({
    ...item,
    img: heroSlideImages[index] || (index === 0 ? settings?.heroBgImage : null) || item.img,
    label: index === 0 && settings?.heroBadgeText ? settings.heroBadgeText : item.label,
    headline: index === 0 && settings?.heroTitle ? settings.heroTitle : item.headline,
    sub: index === 0 && settings?.heroSubtitle ? settings.heroSubtitle : item.sub,
  }));

  const activeNotices   = notices?.filter(n => n.enabled && !dismissedNotices.includes(n.id)) || [];
  const featuredProducts = products?.filter(p => p.featured).slice(0, 6) || products?.slice(0, 6) || [];
  const displayServices  = services?.slice(0, 6) || [];
  const displayPortfolio = portfolio?.slice(0, 8) || [];
  const displayReviews   = reviews?.filter(r => r.approved).slice(0, 3) || [];

  const serviceIcons = [Printer, PenTool, Layout, Package, Layers, ImageIcon];

  const nextSlide = useCallback(() => setSlide(s => (s + 1) % DEFAULT_HERO_SLIDES.length), []);
  const prevSlide = useCallback(() => setSlide(s => (s - 1 + DEFAULT_HERO_SLIDES.length) % DEFAULT_HERO_SLIDES.length), []);

  // Auto-advance
  useEffect(() => {
    if (paused) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(nextSlide, 5500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, nextSlide]);

  const marqueeItems = [
    '⭐ 5-Star Rated', '🖼 1,200+ Frames', '✅ Sri Lankan Made',
    '📦 Island-wide Delivery', '🎨 Custom Designs', '⚡ 48hr Express',
  ];

  const reasons = [
    { icon: Shield, title: 'Premium Materials',    desc: 'Museum-grade mounting, archival mats and solid wood frames.' },
    { icon: Truck,  title: 'Island-wide Delivery', desc: 'Securely packaged and tracked to your doorstep.' },
    { icon: Star,   title: '5-Star Rated',         desc: 'Loved and recommended by hundreds of happy clients.' },
    { icon: Zap,    title: '48hr Express',         desc: 'Fast-track framing for urgent needs — just ask.' },
  ];

  const defaultFeatureCards = [
    { title: 'Frame Editions', copy: 'Made-to-measure frames in refined timber finishes.', href: '/store' },
    { title: 'Colour Prints', copy: 'Colour-checked archival prints for lasting clarity.', href: '/store' },
    { title: 'Story Collages', copy: 'Thoughtful multi-image layouts for meaningful moments.', href: '/custom-project' },
    { title: 'Studio Sessions', copy: 'Portrait and product photography with a gallery finish.', href: '/services' },
  ];
  let featureCards = defaultFeatureCards;
  try {
    const parsed = JSON.parse(settings?.homeFeatureCards || '[]');
    if (Array.isArray(parsed) && parsed.length) featureCards = parsed.slice(0, 4);
  } catch {
    featureCards = defaultFeatureCards;
  }

  /* ── Slide helpers ── */
  const currentSlide = heroSlides[slide];
  const headlineLines = currentSlide.headline.split('\n');
  const renderHeadlineLine = (line: string, lineIndex: number) => {
    const highlight = slide === 0 ? settings?.heroHighlightWord?.trim() : '';
    const matchIndex = highlight ? line.toLocaleLowerCase().indexOf(highlight.toLocaleLowerCase()) : -1;
    if (highlight && matchIndex >= 0) {
      return <>{line.slice(0, matchIndex)}<span className="text-gradient italic">{line.slice(matchIndex, matchIndex + highlight.length)}</span>{line.slice(matchIndex + highlight.length)}</>;
    }
    return lineIndex === 0 ? line : <span className="text-gradient italic">{line}</span>;
  };

  return (
    <div className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">

      {/* ══════════════════════════════════════════ NOTICES */}
      <AnimatePresence>
        {activeNotices.map(n => (
          <motion.div
            key={n.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#C9A84C]/10 border-b border-[#C9A84C]/20 text-sm text-[hsl(var(--foreground)/0.85)] px-6 py-3 flex items-center justify-between relative z-30"
          >
            <span>{n.message}</span>
            <button onClick={() => setDismissedNotices(d => [...d, n.id])} className="ml-4 text-[hsl(var(--muted-foreground))] hover:text-[#C9A84C]"><X className="w-4 h-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ══════════════════════════════════════════ HERO SLIDER */}
      <section
        className="relative h-[100svh] min-h-[600px] max-h-[960px] overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Slides */}
        <AnimatePresence mode="sync">
          <motion.div
            key={slide}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src={currentSlide.img}
              alt={currentSlide.label}
              className="w-full h-full object-cover"
              onLoad={() => setLoaded(l => { const n = [...l]; n[slide] = true; return n; })}
            />
            {/* Dark vignette */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          </motion.div>
        </AnimatePresence>

        {/* Slide label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`label-${slide}`}
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute top-10 right-10 bg-[#C9A84C]/15 border border-[#C9A84C]/30 backdrop-blur-sm px-4 py-2 z-20"
          >
            <span className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-[0.22em]">{currentSlide.label}</span>
          </motion.div>
        </AnimatePresence>

        {/* Hero copy */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 md:px-20 max-w-7xl mx-auto left-0 right-0">
          {/* Gold accent bar */}
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="w-16 h-[2px] bg-gradient-to-r from-[#C9A84C] to-[#C9A84C]/30 origin-left mb-8"
          />

          <div className="overflow-hidden mb-6">
            <AnimatePresence mode="wait">
              <motion.div key={`headline-${slide}`}>
                {headlineLines.map((line, i) => (
                  <motion.h1
                    key={i}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ duration: 0.75, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    className="font-serif text-white leading-none font-bold"
                    style={{ fontSize: 'clamp(3.2rem, 9vw, 7.5rem)' }}
                  >
                    {renderHeadlineLine(line, i)}
                  </motion.h1>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={`sub-${slide}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.65, delay: 0.3 }}
              className="text-white/85 font-medium text-lg md:text-xl max-w-lg leading-relaxed mb-10"
            >
              {currentSlide.sub}
            </motion.p>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.45 }}
            className="flex flex-wrap items-center gap-4"
          >
            <Link href={settings?.heroCtaLink || '/store'} className="inline-flex items-center gap-3 bg-[#C9A84C] text-[#0A0907] font-bold text-sm uppercase tracking-widest px-8 py-4 btn-glow hover:bg-[#D4B55E] transition-colors">
              {settings?.heroCtaText || 'Shop Frames'} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/custom-project" className="inline-flex items-center gap-3 border border-white/30 text-white text-sm uppercase tracking-widest px-8 py-4 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors backdrop-blur-sm">
              Custom Order
            </Link>
          </motion.div>
        </div>

        {/* Prev / Next arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 border border-white/20 bg-black/30 backdrop-blur-sm text-white hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all flex items-center justify-center"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 border border-white/20 bg-black/30 backdrop-blur-sm text-white hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all flex items-center justify-center"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots + pause */}
        <div className="absolute bottom-8 left-0 right-0 z-30 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`transition-all duration-500 ${i === slide ? 'w-8 h-[2px] bg-[#C9A84C]' : 'w-2 h-[2px] bg-white/30 hover:bg-white/60'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setPaused(p => !p)}
            className="w-7 h-7 border border-white/20 flex items-center justify-center text-white/50 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-colors"
            aria-label={paused ? 'Play' : 'Pause'}
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
        </div>

        {/* Slide counter */}
        <div className="absolute bottom-8 right-10 z-30 font-serif text-white/40 text-sm">
          <span className="text-[#C9A84C]">0{slide + 1}</span> / 0{heroSlides.length}
        </div>
      </section>

      {/* ══════════════════════════════════════════ MARQUEE TICKER */}
      <div className="bg-[#C9A84C] py-3 overflow-hidden select-none border-y border-[#D4B55E]/30">
        <div className="marquee-track animate-marquee">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="px-8 text-[#0A0907] text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════ EDITABLE FEATURE CARDS */}
      <section className="border-b border-[#1E1A14] bg-[#070604]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card, index) => (
            <Link
              key={`${card.title}-${index}`}
              href={card.href || '/store'}
              className="group p-7 border-b sm:border-r border-[#1E1A14] last:border-r-0 hover:bg-[#C9A84C]/5 transition-colors"
            >
              <span className="text-[10px] text-[#C9A84C] font-bold tracking-[0.2em]">0{index + 1}</span>
              <h2 className="font-serif text-xl text-white mt-3 group-hover:text-[#C9A84C] transition-colors">{card.title}</h2>
              <p className="text-xs font-medium text-white/75 leading-relaxed mt-2">{card.copy}</p>
              <ArrowRight className="w-4 h-4 text-[#C9A84C] mt-5 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════ STATS */}
      <section className="py-20 border-b border-[#1E1A14]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-[#1E1A14]">
            {[
              { end: 1200, suffix: '+', label: 'Frames Made' },
              { end: 8,    suffix: '+', label: 'Years of Craft' },
              { end: 98,   suffix: '%', label: 'Happy Clients' },
              { end: 48,   suffix: 'h', label: 'Express Service' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center py-8 px-4"
              >
                <div className="font-serif text-5xl md:text-6xl font-bold text-gradient leading-none mb-2">
                  <AnimatedCounter end={s.end} suffix={s.suffix} />
                </div>
                <p className="section-label">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ FEATURED PRODUCTS */}
      {featuredProducts.length > 0 && (
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} className="flex items-end justify-between mb-14"
            >
              <div>
                <p className="section-label mb-3">Our Collection</p>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] heading-underline">
                  Frames & Prints
                </h2>
              </div>
              <Link href="/store" className="hidden md:flex items-center gap-2 text-[#C9A84C] text-xs font-bold uppercase tracking-widest hover:text-[#D4B55E] transition-colors">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="group card-gold-hover bg-[hsl(var(--card))] overflow-hidden card-3d"
                >
                  <div className="aspect-[4/3] bg-[hsl(var(--muted))] overflow-hidden relative">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-[hsl(var(--muted-foreground))/0.3]" /></div>
                    }
                    {/* Gold overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#C9A84C]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-400">
                      <Link href="/store" className="block w-full text-center bg-[#C9A84C] text-[#0A0907] text-xs font-bold uppercase tracking-widest py-2.5">
                        Quick Order
                      </Link>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-lg font-semibold text-[hsl(var(--foreground))] mb-1 group-hover:text-[#C9A84C] transition-colors">{p.name}</h3>
                    {p.description && <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-3">{p.description}</p>}
                    <div className="flex items-center justify-between">
                      {p.price && (
                        <span className="font-serif text-xl font-semibold text-[#C9A84C]">
                          LKR {Number(p.price).toLocaleString()}
                        </span>
                      )}
                      {p.category && (
                        <span className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground))] border border-[#2A2418] px-2 py-1">
                          {p.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/store" className="inline-flex items-center gap-2 border border-[#2A2418] text-[hsl(var(--foreground)/0.65)] text-xs font-bold uppercase tracking-widest px-8 py-3 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
                View All Frames & Prints <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ SERVICES */}
      {displayServices.length > 0 && (
        <section className="py-24 bg-[#070604] border-y border-[#1E1A14]">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} className="text-center mb-14"
            >
              <p className="section-label mb-3">What We Offer</p>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] heading-underline inline-block">
                Studio Services
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayServices.map((svc, i) => {
                const Icon = serviceIcons[i % serviceIcons.length];
                return (
                  <motion.div
                    key={svc.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="group bg-[hsl(var(--card))] border border-[#1E1A14] p-7 hover:border-[#C9A84C]/40 transition-all duration-400 relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#C9A84C]/5 rounded-full transition-all duration-500 group-hover:scale-150 group-hover:bg-[#C9A84C]/8" />
                    <div className="w-11 h-11 bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center mb-5 group-hover:bg-[#C9A84C]/20 transition-colors">
                      <Icon className="w-5 h-5 text-[#C9A84C]" />
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-[hsl(var(--foreground))] mb-2 group-hover:text-[#C9A84C] transition-colors">{svc.name}</h3>
                    {svc.description && <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-4 line-clamp-3">{svc.description}</p>}
                    {svc.price && (
                      <p className="font-serif text-lg text-[#C9A84C] font-semibold">from LKR {Number(svc.price).toLocaleString()}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <div className="text-center mt-10">
              <Link href="/services" className="inline-flex items-center gap-2 text-[#C9A84C] text-xs font-bold uppercase tracking-widest hover:text-[#D4B55E] transition-colors">
                All Studio Services <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ WHY HAVESTORY */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
              <p className="section-label mb-3">Why Choose Us</p>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] mb-6 leading-tight heading-underline">
                Crafted for<br /><span className="text-gradient italic">Perfection</span>
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] text-base leading-relaxed mb-8">
                HAVESTORY combines traditional Sri Lankan craftsmanship with modern precision — every frame is built to last, every print calibrated for colour accuracy.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reasons.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3 p-4 border border-[#1E1A14] hover:border-[#C9A84C]/30 transition-colors"
                  >
                    <div className="w-9 h-9 bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
                      <r.icon className="w-4 h-4 text-[#C9A84C]" />
                    </div>
                    <div>
                      <p className="font-serif font-semibold text-sm text-[hsl(var(--foreground))] mb-0.5">{r.title}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">{r.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Decorative frame grid */}
            <motion.div
              initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.8 }}
              className="relative hidden md:block"
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { src: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&q=80', cls: 'row-span-2 aspect-[3/4]' },
                  { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', cls: 'aspect-square' },
                  { src: 'https://images.unsplash.com/photo-1490750967868-88df5691892e?w=600&q=80', cls: 'aspect-square' },
                ].map((img, i) => (
                  <div key={i} className={`${img.cls} bg-[hsl(var(--muted))] overflow-hidden border border-[#2A2418]`}>
                    <img src={img.src} alt="" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500 hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
              {/* Gold corner accent */}
              <div className="absolute -top-3 -left-3 w-10 h-10 border-t-2 border-l-2 border-[#C9A84C]" />
              <div className="absolute -bottom-3 -right-3 w-10 h-10 border-b-2 border-r-2 border-[#C9A84C]" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ PORTFOLIO */}
      {displayPortfolio.length > 0 && (
        <section className="py-24 bg-[#070604] border-y border-[#1E1A14]">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-end justify-between mb-14">
              <div>
                <p className="section-label mb-3">Our Work</p>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] heading-underline">Gallery</h2>
              </div>
              <Link href="/gallery" className="hidden md:flex items-center gap-2 text-[#C9A84C] text-xs font-bold uppercase tracking-widest hover:text-[#D4B55E] transition-colors">
                Full Gallery <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {displayPortfolio.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="group break-inside-avoid bg-[hsl(var(--card))] border border-[#1E1A14] overflow-hidden hover:border-[#C9A84C]/40 transition-colors"
                >
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.title || ''} className="w-full object-cover transition-transform duration-600 group-hover:scale-105" />
                    : <div className="aspect-square bg-[hsl(var(--muted))] flex items-center justify-center"><ImageIcon className="w-8 h-8 text-[hsl(var(--muted-foreground))/0.3]" /></div>
                  }
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ REVIEWS */}
      {displayReviews.length > 0 && (
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <p className="section-label mb-3">Client Love</p>
              <h2 className="font-serif text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] heading-underline inline-block">What They Say</h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {displayReviews.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-[hsl(var(--card))] border border-[#1E1A14] p-7 relative hover:border-[#C9A84C]/30 transition-colors"
                >
                  <Quote className="w-8 h-8 text-[#C9A84C]/25 absolute top-5 right-5" />
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: r.rating || 5 }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 text-[#C9A84C] fill-[#C9A84C]" />
                    ))}
                  </div>
                  <p className="text-[hsl(var(--foreground)/0.7)] text-sm leading-relaxed mb-6 italic">&ldquo;{r.comment}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center font-serif font-bold text-sm text-[#C9A84C]">
                      {(r.customerName || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{r.customerName}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ CTA BANNER */}
      <section className="relative py-28 overflow-hidden border-y border-[#1E1A14]">
        <div className="absolute inset-0 bg-[#070604]" />
        <div className="absolute inset-0 opacity-10">
          <img src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1600&q=60" className="w-full h-full object-cover" alt="" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0907] via-[#0A0907]/80 to-[#0A0907]" />
        {/* Gold line top / bottom */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 text-center max-w-3xl mx-auto px-6"
        >
          <p className="section-label mb-4">Get Started Today</p>
          <h2 className="font-serif text-5xl md:text-7xl font-bold text-[hsl(var(--foreground))] mb-6 leading-none">
            Ready to Frame<br /><span className="text-gradient italic">Your Story?</span>
          </h2>
          <p className="text-[hsl(var(--foreground)/0.78)] font-medium text-lg mb-10">
            Visit our studio, browse the collection or submit a custom order — we'll handle the rest.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/store" className="inline-flex items-center gap-3 bg-[#C9A84C] text-[#0A0907] font-bold text-sm uppercase tracking-widest px-10 py-4 btn-glow hover:bg-[#D4B55E] transition-colors">
              Browse Frames <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-3 border border-[#2A2418] text-[hsl(var(--foreground)/0.7)] text-sm uppercase tracking-widest px-10 py-4 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
              Contact Studio
            </Link>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
