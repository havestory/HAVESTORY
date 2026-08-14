import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { motion, useInView, AnimatePresence, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import {
  useGetSettings, useListProducts, useListServices,
  useGetNotices, useListPortfolio, useListReviews,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ComingSoon } from '@/components/public/ComingSoon';
import {
  X, ArrowRight, Shield, Truck, Star, Zap,
  Printer, PenTool, Layout, Package, Layers,
  Image as ImageIcon, ChevronLeft, ChevronRight,
  Quote, Play, Pause,
} from 'lucide-react';

/* ─────────────────────────── Hero slides ─────────────────────────── */
const DEFAULT_HERO_SLIDES = [
  { img: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1920&q=85', label: 'Gallery Walls', headline: 'Where\nMemories\nBecome Art', sub: 'Premium photo frames crafted for Sri Lankan homes and studios.' },
  { img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=85', label: 'Colour Lab', headline: 'Colour\nPerfected\nPrinted', sub: 'State-of-the-art colour lab with archival-grade print finishes.' },
  { img: 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?auto=format&fit=crop&w=1920&q=85', label: 'Studio Photography', headline: 'Every\nFrame\nTells a Story', sub: 'Professional studio photography for portraits, products and events.' },
  { img: 'https://images.unsplash.com/photo-1541535650810-10d26f5c2ab3?auto=format&fit=crop&w=1920&q=85', label: 'Custom Frames', headline: 'Crafted\nWith\nPrecision', sub: 'Bespoke frame sizes, materials and finishes — your vision, our craft.' },
  { img: 'https://images.unsplash.com/photo-1490750967868-88df5691892e?auto=format&fit=crop&w=1920&q=85', label: 'Fine Art Prints', headline: 'Art That\nLasts\nForever', sub: 'Museum-grade prints that preserve your moments for generations.' },
  { img: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1920&q=85', label: 'The Edit', headline: 'Your Story,\nBeautifully\nFramed', sub: 'A considered edit of materials, tones and proportions for your space.' },
  { img: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1920&q=85', label: 'Print Studio', headline: 'Bring Light\nInto The\nRoom', sub: 'Rich, dimensional prints made to live with you every day.' },
  { img: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1920&q=85', label: 'Material Stories', headline: 'Made By\nHand, Made\nTo Keep', sub: 'Thoughtful details and honest materials that age with grace.' },
  { img: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1920&q=85', label: 'Gallery Finish', headline: 'Make Space\nFor What\nMatters', sub: 'Design-led framing for milestones, people and places worth remembering.' },
  { img: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1920&q=85', label: 'The Archive', headline: 'Keep The\nMoment\nClose', sub: 'From the first photograph to the final frame, we take care of the story.' },
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

type HeroSlide = { img: string; label: string; headline: string; sub: string };

function ScrollHeroSlide({ slide, index, total, progress }: { slide: HeroSlide; index: number; total: number; progress: MotionValue<number> }) {
  const start = index / total;
  const end = (index + 1) / total;
  const opacity = useTransform(progress, [Math.max(0, start - 0.045), start, Math.min(1, end - 0.045), end], [0, 1, 1, 0]);
  const scale = useTransform(progress, [start, end], [1.08, 1]);
  const y = useTransform(progress, [start, end], [index === 0 ? 0 : 42, index === total - 1 ? 0 : -42]);

  return (
    <motion.div className="absolute inset-0" style={{ opacity, scale, y }} aria-hidden="true">
      <img src={slide.img} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#071A2B]/90 via-[#071A2B]/48 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#071A2B]/82 via-transparent to-[#071A2B]/22" />
    </motion.div>
  );
}

function HeroScrollSequence({ slides, settings }: { slides: HeroSlide[]; settings?: any }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const [activeSlide, setActiveSlide] = useState(0);
  const progressPercent = useTransform(scrollYProgress, [0, 1], [0, 100]);

  useMotionValueEvent(scrollYProgress, 'change', latest => {
    const next = Math.min(slides.length - 1, Math.floor(latest * slides.length));
    setActiveSlide(current => current === next ? current : next);
  });

  const current = slides[activeSlide] || slides[0];
  const headline = current.headline.split('\n');
  const highlight = activeSlide === 0 ? settings?.heroHighlightWord?.trim() : '';

  return (
    <section ref={sectionRef} className="relative h-[1000svh] bg-[#071A2B]" aria-label="HAVESTORY story slideshow">
      <div className="sticky top-0 h-[100svh] min-h-[600px] max-h-[960px] overflow-hidden">
        {slides.map((item, index) => <ScrollHeroSlide key={`${item.label}-${index}`} slide={item} index={index} total={slides.length} progress={scrollYProgress} />)}

        <div className="absolute inset-0 z-20 mx-auto flex max-w-7xl flex-col justify-center px-8 md:px-20 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div key={`hero-copy-${activeSlide}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
              <div className="mb-7 flex items-center gap-3"><span className="h-px w-14 bg-[#E4B95F]" /><span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#E4B95F]">{current.label}</span></div>
              <div className="mb-7 overflow-hidden">
                {headline.map((line, lineIndex) => {
                  const matchIndex = highlight ? line.toLocaleLowerCase().indexOf(highlight.toLocaleLowerCase()) : -1;
                  const rendered = matchIndex >= 0
                    ? <>{line.slice(0, matchIndex)}<span className="text-gradient italic">{line.slice(matchIndex, matchIndex + highlight.length)}</span>{line.slice(matchIndex + highlight.length)}</>
                    : lineIndex === 0 ? line : <span className="text-gradient italic">{line}</span>;
                  return <motion.h1 key={`${activeSlide}-${lineIndex}`} initial={{ y: 55, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: lineIndex * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="font-serif text-5xl font-bold leading-[0.92] text-white sm:text-7xl md:text-8xl">{rendered}</motion.h1>;
                })}
              </div>
              <p className="max-w-lg text-base font-medium leading-relaxed text-white/80 md:text-xl">{current.sub}</p>
              <div className="mt-9 flex items-center gap-4">
                <Link href={settings?.heroCtaLink || '/store'} className="pointer-events-auto inline-flex items-center gap-3 bg-[#E4B95F] px-7 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-[#071A2B] btn-glow hover:bg-[#F0CA75]">{settings?.heroCtaText || 'Find Your Frame'} <ArrowRight className="h-4 w-4" /></Link>
                <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-white/45 sm:inline">Scroll to explore</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex">
          {slides.map((item, index) => <div key={item.label} className="flex items-center gap-3"><span className={`text-[9px] font-bold uppercase tracking-[0.2em] transition-colors ${index === activeSlide ? 'text-[#E4B95F]' : 'text-white/35'}`}>{String(index + 1).padStart(2, '0')}</span><span className={`h-px transition-all duration-500 ${index === activeSlide ? 'w-10 bg-[#E4B95F]' : 'w-4 bg-white/25'}`} /></div>)}
        </div>

        <div className="absolute bottom-8 left-8 right-8 z-30 flex items-end justify-between md:left-20 md:right-20">
          <div className="flex items-center gap-3 text-white/60"><span className="text-[10px] font-bold uppercase tracking-[0.25em]">Scroll story</span><div className="h-px w-24 overflow-hidden bg-white/20"><motion.div className="h-full origin-left bg-[#E4B95F]" style={{ scaleX: useTransform(progressPercent, [0, 100], [0, 1]) }} /></div></div>
          <div className="font-serif text-sm text-white/55"><span className="text-[#E4B95F]">{String(activeSlide + 1).padStart(2, '0')}</span> / {String(slides.length).padStart(2, '0')}</div>
        </div>
      </div>
    </section>
  );
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

  const heroSlideImages = [
    settings?.heroSlideImage1, settings?.heroSlideImage2, settings?.heroSlideImage3, settings?.heroSlideImage4, settings?.heroSlideImage5,
    (settings as any)?.heroSlideImage6, (settings as any)?.heroSlideImage7, (settings as any)?.heroSlideImage8, (settings as any)?.heroSlideImage9, (settings as any)?.heroSlideImage10,
  ];
  const heroSlides: HeroSlide[] = DEFAULT_HERO_SLIDES.map((item, index) => ({
    ...item,
    img: heroSlideImages[index] || (index === 0 ? settings?.heroBgImage : null) || item.img,
    label: index === 0 && settings?.heroBadgeText ? settings.heroBadgeText : item.label,
    headline: index === 0 && settings?.heroTitle ? settings.heroTitle : item.headline,
    sub: index === 0 && settings?.heroSubtitle ? settings.heroSubtitle : item.sub,
  }));

  const activeNotices = (Array.isArray(notices) ? notices : []).filter(n => n.enabled && !dismissedNotices.includes(n.id));
  const productList = Array.isArray(products) ? products : [];
  const serviceList = Array.isArray(services) ? services : [];
  const portfolioList = Array.isArray(portfolio) ? portfolio : [];
  const reviewList = Array.isArray(reviews) ? reviews : [];
  const featuredProducts = productList.filter(p => p.featured).slice(0, 6);
  const displayServices  = serviceList.slice(0, 6);
  const displayPortfolio = portfolioList.slice(0, 8);
  const displayReviews   = reviewList.filter(r => r.approved).slice(0, 3);

  const serviceIcons = [Printer, PenTool, Layout, Package, Layers, ImageIcon];

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
            className="bg-[#E4B95F]/10 border-b border-[#E4B95F]/20 text-sm text-[hsl(var(--foreground)/0.85)] px-6 py-3 flex items-center justify-between relative z-30"
          >
            <span>{n.message}</span>
            <button onClick={() => setDismissedNotices(d => [...d, n.id])} className="ml-4 text-[hsl(var(--muted-foreground))] hover:text-[#E4B95F]"><X className="w-4 h-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ══════════════════════════════════════════ SCROLL STORY HERO */}
      <HeroScrollSequence slides={heroSlides} settings={settings} />

      {/* ══════════════════════════════════════════ MARQUEE TICKER */}
      <div className="bg-[#E4B95F] py-3 overflow-hidden select-none border-y border-[#F0CA75]/30">
        <div className="marquee-track animate-marquee">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="px-8 text-[#071A2B] text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════ EDITABLE FEATURE CARDS */}
      <section className="border-b border-[#1C3A51] bg-[#071A2B]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card, index) => (
            <Link
              key={`${card.title}-${index}`}
              href={card.href || '/store'}
              className="group p-7 border-b sm:border-r border-[#1C3A51] last:border-r-0 hover:bg-[#E4B95F]/5 transition-colors"
            >
              <span className="text-[10px] text-[#E4B95F] font-bold tracking-[0.2em]">0{index + 1}</span>
              <h2 className="font-serif text-xl text-white mt-3 group-hover:text-[#E4B95F] transition-colors">{card.title}</h2>
              <p className="text-xs font-medium text-white/75 leading-relaxed mt-2">{card.copy}</p>
              <ArrowRight className="w-4 h-4 text-[#E4B95F] mt-5 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════ THE STUDIO EDIT */}
      <section className="studio-edit-section relative overflow-hidden border-b py-16 sm:py-20 md:py-28">
        <div className="studio-edit-orb studio-edit-orb-left" aria-hidden="true" />
        <div className="studio-edit-orb studio-edit-orb-right" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 sm:gap-12 sm:px-6 md:grid-cols-[0.92fr_1.08fr] md:gap-16 md:px-10">
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7 }}
            className="studio-edit-copy-panel relative overflow-hidden rounded-[26px] p-6 shadow-[0_24px_70px_var(--studio-shadow)] sm:p-8 md:p-10"
          >
            <div className="studio-edit-panel-shine" aria-hidden="true" />
            <div className="relative">
              <p className="studio-edit-kicker section-label mb-4">The Studio Edit</p>
              <h2 className="studio-edit-heading max-w-xl font-serif text-[2.35rem] font-bold leading-[0.98] sm:text-5xl md:text-6xl">
                A quieter way to keep what <span className="text-gradient italic">matters.</span>
              </h2>
              <p className="studio-edit-copy mt-6 max-w-lg text-[15px] leading-[1.8] sm:mt-7 sm:text-base md:text-lg">
                We believe the best frame does not compete with a memory. It gives it room to breathe — with honest materials, balanced proportions and a finish made for your space.
              </p>
              <div className="mt-8 grid max-w-lg grid-cols-1 gap-3 sm:mt-9 sm:grid-cols-3 sm:gap-2">
                {[['01', 'Choose the moment'], ['02', 'Shape the feeling'], ['03', 'Make it yours']].map(([number, label]) => (
                  <div key={number} className="studio-edit-step border-t pt-3">
                    <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-[#D96F52]">{number}</span>
                    <p className="studio-edit-step-label mt-2 text-xs font-bold">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
                <Link href="/custom-project" className="btn-glow inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#D96F52] px-6 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-[#B65A41] sm:px-7">
                  Start a custom story <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/about" className="studio-edit-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-7">
                  Meet the studio
                </Link>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8 }}
            className="studio-edit-gallery relative mx-auto w-full max-w-2xl"
          >
            <div className="studio-edit-gallery-shell relative rounded-[30px] p-2 shadow-[0_24px_70px_var(--studio-shadow)] sm:p-3">
              <div className="relative grid grid-cols-[1.08fr_0.92fr] gap-2.5 sm:gap-4">
                <div className="studio-edit-image aspect-[4/5] overflow-hidden rounded-[22px]">
                  <img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1000&q=85" alt="A considered interior with framed art" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                </div>
                <div className="mt-10 space-y-2.5 sm:mt-16 sm:space-y-4">
                  <div className="studio-edit-image aspect-square overflow-hidden rounded-[22px]">
                    <img src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&q=85" alt="Gallery wall detail" className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                  </div>
                  <div className="studio-edit-note rounded-[22px] p-4 sm:p-5">
                    <p className="font-serif text-2xl font-semibold text-[#D96F52] sm:text-3xl">Made to keep.</p>
                    <p className="studio-edit-note-meta mt-1 text-[9px] font-bold uppercase tracking-[0.17em] sm:text-[10px]">Frames · Prints · Stories</p>
                  </div>
                </div>
              </div>
              <div className="studio-edit-gallery-caption absolute bottom-4 left-4 rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] sm:bottom-5 sm:left-5 sm:px-4 sm:py-2">A considered edit</div>
            </div>
            <div className="absolute -bottom-3 -left-3 h-10 w-10 border-b-2 border-l-2 border-[#D96F52] sm:-bottom-4 sm:-left-4 sm:h-12 sm:w-12" aria-hidden="true" />
            <div className="absolute -right-3 -top-3 h-10 w-10 border-r-2 border-t-2 border-[#D96F52] sm:-right-4 sm:-top-4 sm:h-12 sm:w-12" aria-hidden="true" />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ STATS */}
      <section className="py-20 border-b border-[#1C3A51]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-[#1C3A51]">
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
      {featuredProducts.length > 0 ? (
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
              <Link href="/store" className="hidden md:flex items-center gap-2 text-[#E4B95F] text-xs font-bold uppercase tracking-widest hover:text-[#F0CA75] transition-colors">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-[#E4B95F]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-400">
                      <Link href="/store" className="block w-full text-center bg-[#E4B95F] text-[#071A2B] text-xs font-bold uppercase tracking-widest py-2.5">
                        Quick Order
                      </Link>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-lg font-semibold text-[hsl(var(--foreground))] mb-1 group-hover:text-[#E4B95F] transition-colors">{p.name}</h3>
                    {p.description && <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-3">{p.description}</p>}
                    <div className="flex items-center justify-between">
                      {p.price && (
                        <span className="font-serif text-xl font-semibold text-[#E4B95F]">
                          LKR {Number(p.price).toLocaleString()}
                        </span>
                      )}
                      {p.category && (
                        <span className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground))] border border-[#244257] px-2 py-1">
                          {p.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/store" className="inline-flex items-center gap-2 border border-[#244257] text-[hsl(var(--foreground)/0.65)] text-xs font-bold uppercase tracking-widest px-8 py-3 hover:border-[#E4B95F] hover:text-[#E4B95F] transition-colors">
                View All Frames & Prints <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-y border-[hsl(var(--border))] py-24">
          <div className="mx-auto max-w-7xl px-6">
            <ComingSoon
              eyebrow="The collection is being curated"
              title="Frames & prints are coming soon."
              description="Our first light-filled collection is being selected now. If you already have a story in mind, we can start a custom piece today."
              href="/custom-project"
              cta="Start a custom story"
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ SERVICES */}
      {displayServices.length > 0 ? (
        <section className="py-24 bg-[hsl(var(--muted))] border-y border-[hsl(var(--border))]">
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
                    className="group bg-[hsl(var(--card))] border border-[#1C3A51] p-7 hover:border-[#E4B95F]/40 transition-all duration-400 relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#E4B95F]/5 rounded-full transition-all duration-500 group-hover:scale-150 group-hover:bg-[#E4B95F]/8" />
                    <div className="w-11 h-11 bg-[#E4B95F]/10 border border-[#E4B95F]/20 flex items-center justify-center mb-5 group-hover:bg-[#E4B95F]/20 transition-colors">
                      <Icon className="w-5 h-5 text-[#E4B95F]" />
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-[hsl(var(--foreground))] mb-2 group-hover:text-[#E4B95F] transition-colors">{svc.name}</h3>
                    {svc.description && <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-4 line-clamp-3">{svc.description}</p>}
                    {svc.price && (
                      <p className="font-serif text-lg text-[#E4B95F] font-semibold">from LKR {Number(svc.price).toLocaleString()}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <div className="text-center mt-10">
              <Link href="/services" className="inline-flex items-center gap-2 text-[#E4B95F] text-xs font-bold uppercase tracking-widest hover:text-[#F0CA75] transition-colors">
                All Studio Services <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-24">
          <div className="mx-auto max-w-7xl px-6">
            <ComingSoon
              eyebrow="The studio is preparing its next edit"
              title="Services are coming soon."
              description="We are shaping a focused menu of print, framing and studio services. Tell us what you need and we will help you plan it personally."
              href="/contact"
              cta="Talk to the studio"
              compact
            />
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
                    className="flex items-start gap-3 p-4 border border-[#1C3A51] hover:border-[#E4B95F]/30 transition-colors"
                  >
                    <div className="w-9 h-9 bg-[#E4B95F]/10 flex items-center justify-center shrink-0">
                      <r.icon className="w-4 h-4 text-[#E4B95F]" />
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
                  <div key={i} className={`${img.cls} bg-[hsl(var(--muted))] overflow-hidden border border-[#244257]`}>
                    <img src={img.src} alt="" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-500 hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
              {/* Gold corner accent */}
              <div className="absolute -top-3 -left-3 w-10 h-10 border-t-2 border-l-2 border-[#E4B95F]" />
              <div className="absolute -bottom-3 -right-3 w-10 h-10 border-b-2 border-r-2 border-[#E4B95F]" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ PORTFOLIO */}
      {displayPortfolio.length > 0 ? (
        <section className="py-24 bg-[hsl(var(--muted))] border-y border-[hsl(var(--border))]">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-end justify-between mb-14">
              <div>
                <p className="section-label mb-3">Our Work</p>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))] heading-underline">Gallery</h2>
              </div>
              <Link href="/gallery" className="hidden md:flex items-center gap-2 text-[#E4B95F] text-xs font-bold uppercase tracking-widest hover:text-[#F0CA75] transition-colors">
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
                  className="group break-inside-avoid bg-[hsl(var(--card))] border border-[#1C3A51] overflow-hidden hover:border-[#E4B95F]/40 transition-colors"
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
      ) : (
        <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-24">
          <div className="mx-auto max-w-7xl px-6">
            <ComingSoon
              eyebrow="The gallery is still developing"
              title="Our work is coming soon."
              description="We are preparing a considered gallery of frames, prints and client stories. Explore a custom project while the collection is being curated."
              href="/custom-project"
              cta="Create your project"
              compact
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ REVIEWS */}
      {displayReviews.length > 0 ? (
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
                  className="bg-[hsl(var(--card))] border border-[#1C3A51] p-7 relative hover:border-[#E4B95F]/30 transition-colors"
                >
                  <Quote className="w-8 h-8 text-[#E4B95F]/25 absolute top-5 right-5" />
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: r.rating || 5 }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 text-[#E4B95F] fill-[#E4B95F]" />
                    ))}
                  </div>
                  <p className="text-[hsl(var(--foreground)/0.7)] text-sm leading-relaxed mb-6 italic">&ldquo;{r.comment}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#E4B95F]/10 border border-[#E4B95F]/20 flex items-center justify-center font-serif font-bold text-sm text-[#E4B95F]">
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
      ) : (
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <ComingSoon
              eyebrow="Client notes are on the way"
              title="Reviews are coming soon."
              description="As more HAVESTORY stories are completed, this space will fill with honest notes from the people who trusted us with their moments."
              href="/contact"
              cta="Begin a conversation"
              compact
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════ CTA BANNER */}
      <section className="relative overflow-hidden border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-28">
        <div className="absolute inset-0 bg-[hsl(var(--muted))]" />
        <div className="absolute inset-0 opacity-[0.08]">
          <img src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1600&q=60" className="w-full h-full object-cover" alt="" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--muted)/0.96)] via-[hsl(var(--muted)/0.82)] to-[hsl(var(--muted)/0.96)]" />
        {/* Gold line top / bottom */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E4B95F] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E4B95F] to-transparent" />

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
            <Link href="/store" className="inline-flex items-center gap-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-sm uppercase tracking-widest px-10 py-4 btn-glow hover:opacity-90 transition-colors">
              Browse Frames <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-3 border border-[hsl(var(--border))] text-[hsl(var(--foreground)/0.7)] text-sm uppercase tracking-widest px-10 py-4 hover:border-[hsl(var(--secondary))] hover:text-[hsl(var(--secondary))] transition-colors">
              Contact Studio
            </Link>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
