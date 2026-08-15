import { useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, Image as ImageIcon, Layout, Layers, Package, PenTool, Printer, Quote, ShieldCheck, Sparkles, Star, Truck, X } from 'lucide-react';
import { useGetNotices, useGetSettings, useListPortfolio, useListProducts, useListReviews, useListServices } from '@workspace/api-client-react';
import { ComingSoon } from '@/components/public/ComingSoon';

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=88',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1000&q=86',
  'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=86',
];

function EditorialHeading({ label, title, copy }: { label: string; title: string; copy?: string }) {
  return <header className="hs26-heading"><p>{label}</p><div><h2>{title}</h2>{copy && <span>{copy}</span>}</div></header>;
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: notices } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews } = useListReviews();
  const [dismissedNotices, setDismissedNotices] = useState<number[]>([]);

  const activeNotices = (Array.isArray(notices) ? notices : []).filter(notice => notice.enabled && !dismissedNotices.includes(notice.id));
  const productsList = Array.isArray(products) ? products : [];
  const servicesList = Array.isArray(services) ? services : [];
  const portfolioList = Array.isArray(portfolio) ? portfolio : [];
  const reviewsList = Array.isArray(reviews) ? reviews : [];
  const featuredProducts = productsList.filter(product => product.featured).slice(0, 5);
  const displayServices = servicesList.slice(0, 5);
  const displayPortfolio = portfolioList.slice(0, 7);
  const displayReviews = reviewsList.filter(review => review.approved).slice(0, 3);
  const heroImages = [settings?.heroBgImage, settings?.heroSlideImage2, settings?.heroSlideImage3].map((image, index) => image || DEFAULT_IMAGES[index]);
  const heroTitle = settings?.heroTitle || 'Stories deserve a place in your everyday.';
  const heroSubtitle = settings?.heroSubtitle || 'Archival colour, considered framing and studio craft for photographs worth living with.';
  const serviceIcons = [Printer, PenTool, Layout, Package, Layers];
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
  } catch { featureCards = defaultFeatureCards; }

  return (
    <div className="hs26-home">
      <AnimatePresence>{activeNotices.map(notice => <motion.div key={notice.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="hs26-notice"><span>{notice.message}</span><button type="button" onClick={() => setDismissedNotices(current => [...current, notice.id])} aria-label="Dismiss notice"><X size={16} /></button></motion.div>)}</AnimatePresence>

      <section className="hs26-hero">
        <div className="hs26-hero-copy">
          <div className="hs26-hero-index"><span>01</span><i /><span>THE COLOUR & FRAME STUDIO</span></div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
            <p className="hs26-kicker"><Sparkles size={14} /> {settings?.heroBadgeText || 'Made in Sri Lanka'}</p>
            <h1>{heroTitle}</h1>
            <p className="hs26-hero-lede">{heroSubtitle}</p>
            <div className="hs26-actions"><Link href={settings?.heroCtaLink || '/store'} className="hs26-button hs26-button-dark">{settings?.heroCtaText || 'Explore the collection'} <ArrowRight size={16} /></Link><Link href="/custom-project" className="hs26-button hs26-button-line">Create a custom piece</Link></div>
          </motion.div>
          <div className="hs26-hero-foot"><div><strong>Archival</strong><span>colour-managed prints</span></div><div><strong>Bespoke</strong><span>frames made to measure</span></div></div>
        </div>
        <div className="hs26-hero-gallery" aria-label="HAVESTORY studio work">
          <motion.figure className="hs26-hero-main" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .85 }}><img src={heroImages[0]} alt="A considered framed artwork interior" /><figcaption><span>Featured story</span><strong>Made to live with you.</strong></figcaption></motion.figure>
          <figure className="hs26-hero-small hs26-hero-small-a"><img src={heroImages[1]} alt="Frame material detail" /></figure>
          <figure className="hs26-hero-small hs26-hero-small-b"><img src={heroImages[2]} alt="Gallery wall detail" /></figure>
          <div className="hs26-hero-seal"><span>HS</span><small>FRAME · PRINT · KEEP</small></div>
        </div>
      </section>

      <section className="hs26-trust" aria-label="Studio qualities"><span><ShieldCheck size={17} /> Museum-grade materials</span><span><Star size={17} /> Colour checked by hand</span><span><Truck size={17} /> Island-wide delivery</span></section>

      <section className="hs26-section hs26-paths">
        <EditorialHeading label="Choose your starting point" title="One studio. Four ways to tell it." copy="Begin with a print, a frame, a collection of moments or a complete studio session." />
        <div className="hs26-bento">{featureCards.map((card, index) => <Link key={`${card.title}-${index}`} href={card.href || '/store'} className={`hs26-path-card hs26-path-${index + 1}`}><span>0{index + 1}</span><div><h3>{card.title}</h3><p>{card.copy}</p></div><ArrowDownRight size={22} /></Link>)}</div>
      </section>

      {featuredProducts.length ? <section className="hs26-section hs26-collection">
        <EditorialHeading label="Curated collection" title="Objects for the memories you keep." copy="A changing edit of frames, paper, finishes and ready-to-order pieces." />
        <div className="hs26-product-wall">{featuredProducts.map((product, index) => <motion.article key={product.id} className={`hs26-product hs26-product-${index + 1}`} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }}><Link href="/store" className="hs26-product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageIcon size={32} />}</Link><div><span>Edition {String(index + 1).padStart(2, '0')}</span><h3>{product.name}</h3>{product.price && <strong>LKR {Number(product.price).toLocaleString()}</strong>}</div></motion.article>)}</div>
        <Link href="/store" className="hs26-round-link">See the full collection <ArrowRight size={16} /></Link>
      </section> : <section className="hs26-section"><ComingSoon eyebrow="The collection is being curated" title="Frames & prints are coming soon." description="Our first collection is being selected now. We can still start your custom piece today." href="/custom-project" cta="Start a custom story" /></section>}

      <section className="hs26-process">
        <div className="hs26-process-intro"><p>THE HAVESTORY METHOD</p><h2>From image file<br />to finished wall.</h2><Link href="/custom-project">Start your project <ArrowRight size={16} /></Link></div>
        <ol>{[['01', 'Share the story', 'Upload the photograph, dimensions and the feeling you want.'], ['02', 'Shape the piece', 'We balance colour, crop, paper, mat and frame proportions.'], ['03', 'Made & delivered', 'Your finished work is checked, protected and delivered safely.']].map(step => <li key={step[0]}><span>{step[0]}</span><div><h3>{step[1]}</h3><p>{step[2]}</p></div></li>)}</ol>
      </section>

      {displayServices.length ? <section className="hs26-section hs26-services">
        <EditorialHeading label="Inside the studio" title="Specialist work, quietly precise." copy="Choose a service or bring us an idea. Each project is handled as its own piece." />
        <div className="hs26-service-list">{displayServices.map((service, index) => { const Icon = serviceIcons[index % serviceIcons.length]; return <Link href="/services" key={service.id} className="hs26-service-row"><span>0{index + 1}</span><Icon size={21} /><h3>{service.name}</h3><p>{service.description || 'Designed and finished by the HAVESTORY studio.'}</p>{service.price ? <strong>From LKR {Number(service.price).toLocaleString()}</strong> : <ArrowRight size={18} />}</Link>; })}</div>
      </section> : null}

      {displayPortfolio.length ? <section className="hs26-archive"><div className="hs26-archive-title"><p>RECENT WORK / THE ARCHIVE</p><h2>Stories, in their final form.</h2><Link href="/gallery">Open gallery <ArrowRight size={16} /></Link></div><div className="hs26-archive-grid">{displayPortfolio.map((item, index) => <Link key={item.id} href="/gallery" className={`hs26-archive-item hs26-archive-${index + 1}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title || 'HAVESTORY gallery work'} /> : <ImageIcon size={28} />}<span>{item.title || `Studio story ${index + 1}`}</span></Link>)}</div></section> : null}

      {displayReviews.length ? <section className="hs26-notes"><p>NOTES FROM OUR CLIENTS</p><div className="hs26-notes-grid">{displayReviews.map(review => <blockquote key={review.id}><Quote size={24} /><p>“{review.comment}”</p><footer><span>{review.customerName}</span><small>{'★'.repeat(Math.min(5, review.rating || 5))}</small></footer></blockquote>)}</div></section> : null}

      <section className="hs26-final"><span>YOUR STORY / OUR STUDIO</span><h2>Make space for<br /><em>what matters.</em></h2><div><p>Browse the collection or tell us what you want to create. We will guide the material, format and finish.</p><Link href="/custom-project" className="hs26-button hs26-button-dark">Begin a custom piece <ArrowRight size={16} /></Link></div></section>
    </div>
  );
}
