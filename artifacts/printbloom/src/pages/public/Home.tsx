import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon, Layers,
  Layout, Mail, Package, PenTool, Play, Pause, Printer, Quote,
  Shield, Star, Truck, X, Zap,
} from 'lucide-react';
import {
  useGetNotices, useGetSettings, useListPortfolio, useListProducts,
  useListReviews, useListServices,
} from '@workspace/api-client-react';
import { ComingSoon } from '@/components/public/ComingSoon';

const DEFAULT_HERO_SLIDES = [
  { img: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1920&q=85', label: 'Gallery Walls', headline: 'Where\nmemories\nbecome art', sub: 'Premium photo frames crafted for Sri Lankan homes and studios.' },
  { img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=85', label: 'Colour Lab', headline: 'Colour\nperfected\nprinted', sub: 'State-of-the-art colour lab with archival-grade print finishes.' },
  { img: 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?auto=format&fit=crop&w=1920&q=85', label: 'Studio Photography', headline: 'Every\nframe\ntells a story', sub: 'Professional studio photography for portraits, products and events.' },
  { img: 'https://images.unsplash.com/photo-1541535650810-10d26f5c2ab3?auto=format&fit=crop&w=1920&q=85', label: 'Custom Frames', headline: 'Crafted\nwith\nprecision', sub: 'Bespoke frame sizes, materials and finishes — your vision, our craft.' },
  { img: 'https://images.unsplash.com/photo-1490750967868-88df5691892e?auto=format&fit=crop&w=1920&q=85', label: 'Fine Art Prints', headline: 'Art that\nlasts\nforever', sub: 'Museum-grade prints that preserve your moments for generations.' },
  { img: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1920&q=85', label: 'The Edit', headline: 'Your story,\nbeautifully\nframed', sub: 'A considered edit of materials, tones and proportions for your space.' },
  { img: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1920&q=85', label: 'Print Studio', headline: 'Bring light\ninto the\nroom', sub: 'Rich, dimensional prints made to live with you every day.' },
  { img: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1920&q=85', label: 'Material Stories', headline: 'Made by\nhand, made\nto keep', sub: 'Thoughtful details and honest materials that age with grace.' },
  { img: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1920&q=85', label: 'Gallery Finish', headline: 'Make space\nfor what\nmatters', sub: 'Design-led framing for milestones, people and places worth remembering.' },
  { img: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1920&q=85', label: 'The Archive', headline: 'Keep the\nmoment\nclose', sub: 'From the first photograph to the final frame, we take care of the story.' },
];

type HeroSlide = typeof DEFAULT_HERO_SLIDES[number];

type AnimatedCounterProps = { end: number; suffix?: string; decimals?: number; duration?: number };
function AnimatedCounter({ end, suffix = '', decimals = 0, duration = 1600 }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    let frame = 0;
    const step = (time: number) => {
      if (start === null) start = time;
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(end * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else setCount(end);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, end, inView]);

  return <span ref={ref}>{count.toFixed(decimals)}{suffix}</span>;
}

function SectionIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: ReactNode; copy?: string; action?: ReactNode }) {
  return (
    <div className="premium-section-intro">
      <div>
        <p className="premium-eyebrow">{eyebrow}</p>
        <h2 className="premium-section-title">{title}</h2>
      </div>
      {copy && <p className="premium-section-copy">{copy}</p>}
      {action}
    </div>
  );
}

function HeroShowcase({ slides, settings }: { slides: HeroSlide[]; settings?: any }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[active] || slides[0];
  const headline = current.headline.split('\n');
  const highlight = active === 0 ? settings?.heroHighlightWord?.trim() : '';

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => setActive(value => (value + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <section className="premium-hero" aria-label="HAVESTORY featured stories" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="premium-hero-backdrop" aria-hidden="true">
        <AnimatePresence mode="wait">
          <motion.img
            key={current.img}
            src={current.img}
            alt=""
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          />
        </AnimatePresence>
      </div>
      <div className="premium-hero-wash" aria-hidden="true" />
      <div className="premium-hero-grid" aria-hidden="true" />

      <div className="premium-container premium-hero-inner">
        <div className="premium-hero-copy">
          <motion.div key={`copy-${active}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="premium-hero-kicker"><span />{current.label}</div>
            <h1>
              {headline.map((line, index) => {
                const match = highlight ? line.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
                const content = match >= 0 ? <>{line.slice(0, match)}<em>{line.slice(match, match + highlight.length)}</em>{line.slice(match + highlight.length)}</> : line;
                return <span key={`${active}-${index}`} className={index > 0 ? 'is-accent' : ''}>{content}</span>;
              })}
            </h1>
            <p>{current.sub}</p>
            <div className="premium-hero-actions">
              <Link href={settings?.heroCtaLink || '/store'} className="premium-button premium-button-primary">{settings?.heroCtaText || 'Find your frame'} <ArrowRight size={16} /></Link>
              <Link href="/custom-project" className="premium-button premium-button-ghost">Start a custom story</Link>
            </div>
          </motion.div>
        </div>

          <div className="premium-hero-side" aria-label="Hero story controls">
            <div className="premium-hero-progress" aria-hidden="true">
              <span style={{ width: `${((active + 1) / slides.length) * 100}%` }} />
            </div>
            <div className="premium-hero-controls">
              <button type="button" aria-label="Previous story" onClick={() => setActive(value => (value - 1 + slides.length) % slides.length)}><ChevronLeft size={17} /></button>
              <button type="button" aria-label={paused ? 'Play story rotation' : 'Pause story rotation'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
              <button type="button" aria-label="Next story" onClick={() => setActive(value => (value + 1) % slides.length)}><ChevronRight size={17} /></button>
            </div>
          </div>
      </div>

    </section>
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

  const heroSlideImages = [
    settings?.heroSlideImage1, settings?.heroSlideImage2, settings?.heroSlideImage3, settings?.heroSlideImage4, settings?.heroSlideImage5,
    (settings as any)?.heroSlideImage6, (settings as any)?.heroSlideImage7, (settings as any)?.heroSlideImage8, (settings as any)?.heroSlideImage9, (settings as any)?.heroSlideImage10,
  ];
  const heroSlides: HeroSlide[] = DEFAULT_HERO_SLIDES.map((slide, index) => ({
    ...slide,
    img: heroSlideImages[index] || (index === 0 ? settings?.heroBgImage : undefined) || slide.img,
    label: index === 0 && settings?.heroBadgeText ? settings.heroBadgeText : slide.label,
    headline: index === 0 && settings?.heroTitle ? settings.heroTitle : slide.headline,
    sub: index === 0 && settings?.heroSubtitle ? settings.heroSubtitle : slide.sub,
  }));

  const activeNotices = (Array.isArray(notices) ? notices : []).filter(notice => notice.enabled && !dismissedNotices.includes(notice.id));
  const productList = Array.isArray(products) ? products : [];
  const serviceList = Array.isArray(services) ? services : [];
  const portfolioList = Array.isArray(portfolio) ? portfolio : [];
  const reviewList = Array.isArray(reviews) ? reviews : [];
  const featuredProducts = productList.filter(product => product.featured).slice(0, 6);
  const displayServices = serviceList.slice(0, 6);
  const displayPortfolio = portfolioList.slice(0, 8);
  const displayReviews = reviewList.filter(review => review.approved).slice(0, 3);

  const serviceIcons = [Printer, PenTool, Layout, Package, Layers, ImageIcon];
  const reasons = [
    { icon: Shield, title: 'Premium materials', desc: 'Museum-grade mounting, archival mats and solid wood frames.' },
    { icon: Truck, title: 'Island-wide delivery', desc: 'Securely packaged and tracked to your doorstep.' },
    { icon: Star, title: '5-star rated', desc: 'Loved and recommended by hundreds of happy clients.' },
    { icon: Zap, title: '48hr express', desc: 'Fast-track framing for urgent needs — just ask.' },
  ];
  const marqueeItems = ['5-star rated', '1,200+ frames', 'Sri Lankan made', 'Island-wide delivery', 'Custom designs', '48hr express'];
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
    <div className="premium-home">
      <AnimatePresence>
        {activeNotices.map(notice => (
          <motion.div key={notice.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="premium-notice">
            <span>{notice.message}</span>
            <button type="button" onClick={() => setDismissedNotices(current => [...current, notice.id])} aria-label="Dismiss notice"><X size={16} /></button>
          </motion.div>
        ))}
      </AnimatePresence>

      <HeroShowcase slides={heroSlides} settings={settings} />

      <section className="premium-proof-rail" aria-label="HAVESTORY highlights">
        <div className="premium-container premium-proof-track">
          {marqueeItems.map(item => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="premium-feature-section">
        <div className="premium-container">
          <SectionIntro eyebrow="Begin with a feeling" title={<>A more considered<br /><em>way to keep.</em></>} copy="From the first image to the final hanging point, HAVESTORY brings a design eye to the memories you want to live with." />
          <div className="premium-feature-grid">
            {featureCards.map((card, index) => (
              <Link key={`${card.title}-${index}`} href={card.href || '/store'} className={`premium-feature-card premium-feature-card-${index + 1}`}>
                <span className="premium-card-number">0{index + 1}</span>
                <div><h3>{card.title}</h3><p>{card.copy}</p></div>
                <ArrowRight size={17} className="premium-card-arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="premium-studio-section">
        <div className="premium-container premium-studio-layout">
          <motion.div className="premium-studio-copy" initial={{ opacity: 0, x: -22 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65 }}>
            <p className="premium-eyebrow">The Studio Edit</p>
            <h2 className="premium-section-title">Quiet details.<br /><em>Lasting feeling.</em></h2>
            <p className="premium-section-copy">The best frame does not compete with a memory. It gives it room to breathe — with honest materials, balanced proportions and a finish made for your space.</p>
            <div className="premium-step-list">
              {['Choose the moment', 'Shape the feeling', 'Make it yours'].map((step, index) => <div key={step}><span>0{index + 1}</span><strong>{step}</strong></div>)}
            </div>
            <div className="premium-inline-actions"><Link href="/custom-project" className="premium-button premium-button-primary">Start a custom story <ArrowRight size={15} /></Link><Link href="/about" className="premium-text-link">Meet the studio</Link></div>
          </motion.div>
          <motion.div className="premium-studio-visual" initial={{ opacity: 0, x: 22 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8 }}>
            <div className="premium-studio-main-image"><img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1000&q=85" alt="Framed art in a considered interior" /></div>
            <div className="premium-studio-side-stack"><div className="premium-studio-small-image"><img src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&q=85" alt="Gallery wall detail" /></div><div className="premium-studio-note"><span>Made to keep.</span><small>Frames · Prints · Stories</small></div></div>
            <div className="premium-studio-caption">A considered edit / 01</div>
          </motion.div>
        </div>
      </section>

      <section className="premium-stats-section">
        <div className="premium-container premium-stats-grid">
          {[{ end: 1200, suffix: '+', label: 'Frames made' }, { end: 8, suffix: '+', label: 'Years of craft' }, { end: 98, suffix: '%', label: 'Happy clients' }, { end: 48, suffix: 'h', label: 'Express service' }].map(stat => <div key={stat.label}><strong><AnimatedCounter end={stat.end} suffix={stat.suffix} /></strong><span>{stat.label}</span></div>)}
        </div>
      </section>

      {featuredProducts.length > 0 ? (
        <section className="premium-collection-section">
          <div className="premium-container">
            <SectionIntro eyebrow="The collection" title={<>Frames &<br /><em>prints.</em></>} action={<Link href="/store" className="premium-text-link">View all <ArrowRight size={15} /></Link>} />
            <div className="premium-product-grid">
              {featuredProducts.map((product, index) => (
                <motion.article key={product.id} className="premium-product-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ delay: index * 0.06 }}>
                  <Link href="/store" className="premium-product-media">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageIcon size={30} />}
                    <span>View piece <ArrowRight size={14} /></span>
                  </Link>
                  <div className="premium-product-body"><div><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}</div>{product.price && <strong>LKR {Number(product.price).toLocaleString()}</strong>}</div>
                </motion.article>
              ))}
            </div>
            <Link href="/store" className="premium-button premium-button-ghost premium-centered-button">View all frames & prints <ArrowRight size={15} /></Link>
          </div>
        </section>
      ) : (
        <section className="premium-empty-section"><div className="premium-container"><ComingSoon eyebrow="The collection is being curated" title="Frames & prints are coming soon." description="Our first light-filled collection is being selected now. If you already have a story in mind, we can start a custom piece today." href="/custom-project" cta="Start a custom story" /></div></section>
      )}

      {displayServices.length > 0 ? (
        <section className="premium-services-section">
          <div className="premium-container">
            <SectionIntro eyebrow="What we offer" title={<>Studio<br /><em>services.</em></>} copy="A small, focused menu of print, framing and studio work — delivered with a sharp eye for detail." action={<Link href="/services" className="premium-text-link">All services <ArrowRight size={15} /></Link>} />
            <div className="premium-service-grid">
              {displayServices.map((service, index) => {
                const Icon = serviceIcons[index % serviceIcons.length];
                return <motion.article key={service.id} className="premium-service-card" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.05 }}><span className="premium-service-index">0{index + 1}</span><Icon size={22} /><h3>{service.name}</h3>{service.description && <p>{service.description}</p>}{service.price && <strong>from LKR {Number(service.price).toLocaleString()}</strong>}</motion.article>;
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="premium-empty-section"><div className="premium-container"><ComingSoon eyebrow="The studio is preparing its next edit" title="Services are coming soon." description="We are shaping a focused menu of print, framing and studio services. Tell us what you need and we will help you plan it personally." href="/contact" cta="Talk to the studio" compact /></div></section>
      )}

      <section className="premium-why-section">
        <div className="premium-container premium-why-layout">
          <div><p className="premium-eyebrow">Why HAVESTORY</p><h2 className="premium-section-title">Built for the<br /><em>feeling after.</em></h2><p className="premium-section-copy">Traditional Sri Lankan craftsmanship, modern precision and a calm design eye — every frame is built to last, every print calibrated for colour accuracy.</p><div className="premium-reason-grid">{reasons.map(reason => <div key={reason.title} className="premium-reason-card"><reason.icon size={18} /><div><h3>{reason.title}</h3><p>{reason.desc}</p></div></div>)}</div></div>
          <div className="premium-photo-mosaic"><div className="premium-mosaic-tall"><img src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=700&q=80" alt="Framed art on a wall" /></div><div><img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&q=80" alt="Print and colour detail" /><img src="https://images.unsplash.com/photo-1490750967868-88df5691892e?w=700&q=80" alt="Botanical print detail" /></div></div>
        </div>
      </section>

      {displayPortfolio.length > 0 ? (
        <section className="premium-archive-section"><div className="premium-container"><SectionIntro eyebrow="The archive" title={<>A few stories<br /><em>we've framed.</em></>} action={<Link href="/gallery" className="premium-text-link">Full gallery <ArrowRight size={15} /></Link>} /><div className="premium-archive-grid">{displayPortfolio.map((item, index) => <Link key={item.id} href="/gallery" className={`premium-archive-tile premium-archive-tile-${index % 4}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title || ''} /> : <ImageIcon size={28} />}<span>{item.title || 'View the archive'} <ArrowRight size={14} /></span></Link>)}</div></div></section>
      ) : (
        <section className="premium-empty-section"><div className="premium-container"><ComingSoon eyebrow="The gallery is still developing" title="Our work is coming soon." description="We are preparing a considered gallery of frames, prints and client stories. Explore a custom project while the collection is being curated." href="/custom-project" cta="Create your project" compact /></div></section>
      )}

      {displayReviews.length > 0 ? (
        <section className="premium-reviews-section"><div className="premium-container"><SectionIntro eyebrow="Client notes" title={<>Good work leaves<br /><em>a feeling.</em></>} /><div className="premium-review-grid">{displayReviews.map(review => <article key={review.id} className="premium-review-card"><Quote size={24} /><div className="premium-stars">{Array.from({ length: Math.min(5, review.rating || 5) }).map((_, index) => <Star key={index} size={14} fill="currentColor" />)}</div><p>“{review.comment}”</p><footer><span>{(review.customerName || '?')[0].toUpperCase()}</span><strong>{review.customerName}</strong></footer></article>)}</div></div></section>
      ) : (
        <section className="premium-empty-section"><div className="premium-container"><ComingSoon eyebrow="Client notes are on the way" title="Reviews are coming soon." description="As more HAVESTORY stories are completed, this space will fill with honest notes from the people who trusted us with their moments." href="/contact" cta="Begin a conversation" compact /></div></section>
      )}

      <section className="premium-closing-section"><div className="premium-container premium-closing-inner"><div><p className="premium-eyebrow">Make room for what matters</p><h2>Ready to frame<br /><em>your story?</em></h2></div><div><p>Visit our studio, browse the collection or submit a custom order — we'll handle the rest.</p><div className="premium-inline-actions"><Link href="/store" className="premium-button premium-button-primary">Browse frames <ArrowRight size={15} /></Link><Link href="/contact" className="premium-button premium-button-ghost">Contact studio</Link></div></div></div></section>
    </div>
  );
}
