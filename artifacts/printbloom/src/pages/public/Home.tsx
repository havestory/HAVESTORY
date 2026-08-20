import { useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Image as ImageIcon, PackageCheck, Palette, Quote, Ruler, Sparkles, Truck, X } from 'lucide-react';
import { useGetNotices, useGetSettings, useListPortfolio, useListProducts, useListReviews, useListServices } from '@workspace/api-client-react';
import { ComingSoon } from '@/components/public/ComingSoon';

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1500&q=88',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=900&q=86',
  'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=86',
];

function SectionHead({ eyebrow, title, copy, href, link }: { eyebrow: string; title: string; copy?: string; href?: string; link?: string }) {
  return <header className="hsx-section-head"><div><span>{eyebrow}</span><h2>{title}</h2></div><div>{copy && <p>{copy}</p>}{href && <Link href={href}>{link || 'View all'} <ArrowRight /></Link>}</div></header>;
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: notices } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews } = useListReviews();
  const [dismissedNotices, setDismissedNotices] = useState<number[]>([]);

  const activeNotices = (Array.isArray(notices) ? notices : []).filter(item => item.enabled && !dismissedNotices.includes(item.id));
  const productList = (Array.isArray(products) ? products : []).filter(item => item.featured).slice(0, 4);
  const serviceList = (Array.isArray(services) ? services : []).slice(0, 4);
  const portfolioList = (Array.isArray(portfolio) ? portfolio : []).slice(0, 6);
  const reviewList = (Array.isArray(reviews) ? reviews : []).filter(item => item.approved).slice(0, 3);
  const heroImages = [settings?.heroBgImage, settings?.heroSlideImage2, settings?.heroSlideImage3].map((item, index) => item || DEFAULT_IMAGES[index]);
  const featureCards = [
    { number: '01', title: 'Frame editions', copy: 'Ready-to-order and made-to-measure timber frames.', href: '/store', image: heroImages[1] },
    { number: '02', title: 'Fine art prints', copy: 'Colour-managed prints on carefully selected papers.', href: '/store', image: heroImages[2] },
    { number: '03', title: 'Custom stories', copy: 'Collages, gifts and one-off pieces shaped with you.', href: '/custom-project', image: portfolioList[0]?.imageUrl || heroImages[0] },
  ];

  return (
    <div className="hsx-home">
      <AnimatePresence>{activeNotices.map(notice => <motion.div key={notice.id} className="hsx-notice" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><span>{notice.message}</span><button type="button" onClick={() => setDismissedNotices(items => [...items, notice.id])} aria-label="Dismiss notice"><X /></button></motion.div>)}</AnimatePresence>
      <section className="hsx-hero">
        <div className="hsx-hero-copy">
          <span className="hsx-eyebrow"><Sparkles /> {settings?.heroBadgeText || 'Colour lab & frame studio'}</span>
          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}>{settings?.heroTitle || 'Your favourite moments, made tangible.'}</motion.h1>
          <p>{settings?.heroSubtitle || 'Thoughtful prints and custom frames made for the photographs, people and places you want to keep close.'}</p>
          <div className="hsx-hero-actions"><Link href={settings?.heroCtaLink || '/store'} className="hsx-btn hsx-btn-dark">{settings?.heroCtaText || 'Shop frames & prints'} <ArrowRight /></Link><Link href="/custom-project" className="hsx-text-link">Build a custom piece <ArrowRight /></Link></div>
          <div className="hsx-hero-proof"><span><strong>Made to measure</strong> Studio-guided sizing</span><span><strong>Island-wide</strong> Protected delivery</span></div>
        </div>
        <div className="hsx-hero-visual">
          <motion.figure className="hsx-hero-main" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8 }}><img src={heroImages[0]} alt="HAVESTORY framed art collection" /><figcaption><span>Featured</span><strong>Frames that belong in your space.</strong></figcaption></motion.figure>
          <figure className="hsx-hero-detail"><img src={heroImages[1]} alt="Frame finish detail" /><figcaption>Material / finish</figcaption></figure>
        </div>
      </section>
      <div className="hsx-benefits"><span><Palette /> Colour checked</span><span><Ruler /> Custom sizing</span><span><PackageCheck /> Secure packaging</span><span><Truck /> Sri Lanka delivery</span></div>
      <section className="hsx-section hsx-categories">
        <SectionHead eyebrow="Start here" title="What would you like to make?" copy="Simple ways to begin, with studio guidance whenever you need it." />
        <div className="hsx-category-grid">{featureCards.map((item, index) => <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .07 }}><Link href={item.href}><img src={item.image} alt="" /><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.copy}</p><i>Explore <ArrowRight /></i></div></Link></motion.div>)}</div>
      </section>
      <section className="hsx-section hsx-shop-section">
        <SectionHead eyebrow="The shop" title="A small collection, made well." copy="Ready-to-order frames and prints, with clear choices and no complicated calculator." href="/store" link="Shop all" />
        {productList.length ? <div className="hsx-product-grid">{productList.map((product, index) => <article key={product.id} className="hsx-product-card"><Link href="/store" className="hsx-product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ImageIcon />}<span>0{index + 1}</span></Link><div><p>{product.category?.name || 'Studio edition'}</p><h3>{product.name}</h3><footer><strong>{product.price ? `Rs. ${Number(product.price).toLocaleString()}` : 'Quote on request'}</strong><Link href="/store" aria-label={`View ${product.name}`}><ArrowRight /></Link></footer></div></article>)}</div> : <ComingSoon eyebrow="Collection in progress" title="New pieces are on the way." description="The shop is being prepared, but custom orders are open now." href="/custom-project" cta="Start a custom order" />}
      </section>
      <section className="hsx-process">
        <div><span>How it works</span><h2>From your screen<br />to your wall.</h2><p>You do not need to know paper, frame or mat specifications. Start with the photograph and we will help shape the rest.</p><Link href="/custom-project" className="hsx-btn hsx-btn-light">Start your project <ArrowRight /></Link></div>
        <ol>{[['01','Share','Send the photo, size and the feeling you want.'],['02','Refine','We guide the crop, colour, paper and frame.'],['03','Make','Your piece is produced and checked by hand.'],['04','Deliver','Packed securely and sent to your door.']].map(item => <li key={item[0]}><span>{item[0]}</span><div><h3>{item[1]}</h3><p>{item[2]}</p></div></li>)}</ol>
      </section>
      {serviceList.length > 0 && <section className="hsx-section hsx-services-preview"><SectionHead eyebrow="Studio services" title="More than a frame shop." copy="Specialist print, photography and finishing services under one roof." href="/services" link="View services" /><div className="hsx-service-grid">{serviceList.map((service, index) => <Link href="/services" key={service.id}><span>0{index + 1}</span><div><h3>{service.name}</h3><p>{service.description || 'Designed and finished with the HAVESTORY studio.'}</p></div><ArrowRight /></Link>)}</div></section>}
      {portfolioList.length > 0 && <section className="hsx-gallery-strip"><div className="hsx-gallery-title"><span>Recent studio work</span><h2>Made here.<br />Living elsewhere.</h2><Link href="/gallery">Open gallery <ArrowRight /></Link></div><div className="hsx-gallery-grid">{portfolioList.map((item, index) => <Link href="/gallery" key={item.id} className={`item-${index + 1}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title || 'HAVESTORY project'} /> : <ImageIcon />}<span>{item.title || `Studio story ${index + 1}`}</span></Link>)}</div></section>}
      {reviewList.length > 0 && <section className="hsx-section hsx-reviews"><SectionHead eyebrow="Client notes" title="Kind words, kept close." /><div>{reviewList.map(review => <blockquote key={review.id}><Quote /><p>“{review.comment}”</p><footer><strong>{review.customerName}</strong><span>{'★'.repeat(Math.min(5, review.rating || 5))}</span></footer></blockquote>)}</div></section>}
      <section className="hsx-final"><div><span>Your story / our studio</span><h2>Make room for<br />what matters.</h2></div><div><p>Shop the collection or tell us about the piece you have in mind. We will guide you from first idea to finished frame.</p><Link href="/custom-project" className="hsx-btn hsx-btn-dark">Create something personal <ArrowRight /></Link></div></section>
    </div>
  );
}
