import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { motion, useInView } from 'framer-motion';
import { 
  useGetSettings, 
  useListProducts, 
  useListServices, 
  useGetNotices, 
  useListPortfolio, 
  useListReviews 
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, ArrowRight, Shield, Truck, Star, Zap, Printer, PenTool, Layout, Package, Layers, Image as ImageIcon, ChevronRight, Quote
} from 'lucide-react';

function AnimatedCounter({ end, duration = 1800, suffix = '', decimals = 0 }: { end: number, duration?: number, suffix?: string, decimals?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!inView) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // cubic ease out
      
      setCount(easeProgress * end);
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    
    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [inView, end, duration]);
  
  return <span ref={ref}>{count.toFixed(decimals)}{suffix}</span>;
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: products } = useListProducts();
  const { data: services } = useListServices();
  const { data: notices } = useGetNotices();
  const { data: portfolio } = useListPortfolio();
  const { data: reviews } = useListReviews();

  const [dismissedNotices, setDismissedNotices] = useState<number[]>([]);

  const activeNotices = notices?.filter(n => n.isActive && !dismissedNotices.includes(n.id)) || [];
  const heroProducts = products?.slice(0, 3) || [];
  const featuredProducts = products?.filter(p => p.featured).slice(0, 6) || products?.slice(0, 6) || [];
  const displayServices = services?.slice(0, 6) || [];
  const displayPortfolio = portfolio?.slice(0, 6) || [];
  const displayReviews = reviews?.filter(r => r.isApproved).slice(0, 3) || [];

  const icons = [Printer, PenTool, Layout, Package, Layers, ImageIcon];
  const reasons = [
    { icon: Shield, title: 'Premium Materials', desc: 'Museum-grade mounting, archival mats, and solid wood frames.' },
    { icon: Truck, title: 'Island-wide Delivery', desc: 'Securely packaged and safely tracked to your doorstep.' },
    { icon: Star, title: '5-Star Rated', desc: 'Loved and recommended by hundreds of happy clients.' },
    { icon: Zap, title: '48hr Express', desc: 'Fast-track framing available on request for urgent needs.' }
  ];

  const marqueeItems = [
    '⭐ 5-Star Rated', 
    '🖼 1,200+ Frames', 
    '✅ Sri Lankan Made', 
    '📦 Island-wide Delivery', 
    '🎨 Custom Designs', 
    '⚡ 48hr Express'
  ];

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* SECTION A — NOTICES */}
      {activeNotices.map((notice) => (
        <div key={notice.id} className="bg-secondary text-secondary-foreground py-2 px-6 relative flex justify-center items-center overflow-hidden">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 bg-black/10 rounded-[0.25rem]">{notice.title}</span>
              <span className="text-xs font-medium">{notice.message}</span>
            </div>
            <button
              onClick={() => setDismissedNotices([...dismissedNotices, notice.id])}
              className="p-1 hover:bg-black/10 rounded-full transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* SECTION B — HERO */}
      <section className="relative bg-primary text-primary-foreground min-h-[100dvh] flex items-center py-32 overflow-hidden noise">
        {/* Decorative blur circles */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/15 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* LEFT COLUMN */}
          <div className="max-w-2xl">
            <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, delay:0.1 }} className="mb-8">
              <span className="section-label text-secondary">Premium Frame Studio · Sri Lanka</span>
            </motion.div>
            
            <motion.div variants={{ visible: { transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="visible" className="text-[clamp(3.5rem,8vw,7rem)] font-serif font-bold leading-[0.95] text-white mb-8">
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                Frame
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                Your Best
              </motion.div>
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                <span className="text-gradient italic">Story.</span>
              </motion.div>
            </motion.div>
            
            <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7, duration:1 }} className="text-lg text-primary-foreground/75 font-light mb-10 max-w-md leading-relaxed">
              {settings?.heroSubtitle || 'Bespoke photo frames and gallery walls designed to make your memories last a lifetime.'}
            </motion.p>
            
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.9, duration:0.5 }} className="flex flex-wrap gap-4 items-center mb-12">
              <Button asChild size="lg" className="rounded-[0.25rem] bg-secondary text-secondary-foreground hover:bg-secondary/90 px-8 h-12 text-xs uppercase tracking-widest font-semibold btn-glow border-none">
                <Link href="/store">Order a Frame</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-[0.25rem] border border-white/30 text-white hover:bg-white hover:text-primary px-8 h-12 text-xs uppercase tracking-widest font-semibold transition-colors">
                <Link href="/portfolio">View Work</Link>
              </Button>
            </motion.div>
            
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.1, duration:1 }} className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-[3px] border-primary bg-amber-200 flex items-center justify-center font-bold text-black text-xs z-30">AS</div>
                <div className="w-10 h-10 rounded-full border-[3px] border-primary bg-emerald-200 flex items-center justify-center font-bold text-black text-xs z-20">MK</div>
                <div className="w-10 h-10 rounded-full border-[3px] border-primary bg-blue-200 flex items-center justify-center font-bold text-black text-xs z-10">RN</div>
              </div>
              <p className="text-sm text-primary-foreground/80 font-medium">1,200+ happy clients</p>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <motion.div initial={{ opacity:0, x:50 }} animate={{ opacity:1, x:0 }} transition={{ duration:1, delay:0.3 }} className="hidden lg:block relative h-[600px] w-full perspective-[1000px]">
            {/* Front Card */}
            <div 
              className="absolute top-16 right-4 w-64 border-[6px] border-white shadow-2xl aspect-[3/4] overflow-hidden bg-muted animate-float z-30"
              style={{ '--rot': '2deg' } as React.CSSProperties}
            >
              <img src={heroProducts[0]?.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80'} alt="Frame Preview" className="w-full h-full object-cover" />
            </div>
            {/* Mid Card */}
            <div 
              className="absolute top-32 right-32 w-52 border-[6px] border-white shadow-2xl aspect-[3/4] overflow-hidden bg-muted animate-float-delay opacity-90 z-20"
              style={{ '--rot': '-3deg' } as React.CSSProperties}
            >
              <img src={heroProducts[1]?.imageUrl || 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?w=600&q=80'} alt="Frame Preview 2" className="w-full h-full object-cover" />
            </div>
            {/* Back Card */}
            <div 
              className="absolute top-48 right-56 w-44 border-[6px] border-white shadow-2xl aspect-[3/4] overflow-hidden bg-muted animate-float-delay-2 opacity-75 z-10"
              style={{ '--rot': '4deg' } as React.CSSProperties}
            >
              <img src={heroProducts[2]?.imageUrl || 'https://images.unsplash.com/photo-1577083552431-5e839e55e505?w=600&q=80'} alt="Frame Preview 3" className="w-full h-full object-cover" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION C — MARQUEE */}
      <section className="bg-secondary text-secondary-foreground py-4 overflow-hidden border-y border-black/10">
        <div className="marquee-track animate-marquee">
          {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, i) => (
            <div key={i} className="flex items-center">
              <span className="font-bold text-sm tracking-widest uppercase mx-8 whitespace-nowrap">{item}</span>
              <span className="text-secondary-foreground/40 font-black">·</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION D — ANIMATED STATS BAR */}
      <section className="bg-background border-b border-border py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center relative z-10">
          <div>
            <h3 className="text-6xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.ordersCompletedCount || 1200} />
            </h3>
            <p className="section-label">Frames Crafted</p>
            <div className="w-8 mx-auto mt-4 gold-rule" />
          </div>
          <div>
            <h3 className="text-6xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.happyClientsPercent || 98} suffix="%" />
            </h3>
            <p className="section-label">Happy Clients</p>
            <div className="w-8 mx-auto mt-4 gold-rule" />
          </div>
          <div>
            <h3 className="text-6xl font-serif font-bold text-primary mb-2 flex items-center justify-center gap-2">
              <AnimatedCounter end={settings?.starRating || 4.9} decimals={1} />
              <Star className="w-8 h-8 fill-primary text-primary" />
            </h3>
            <p className="section-label">Star Rating</p>
            <div className="w-8 mx-auto mt-4 gold-rule" />
          </div>
          <div>
            <h3 className="text-6xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.aboutFoundedYear ? parseInt(settings.aboutFoundedYear) : 2019} duration={1000} />
            </h3>
            <p className="section-label">Years Est.</p>
            <div className="w-8 mx-auto mt-4 gold-rule" />
          </div>
        </div>
      </section>

      {/* SECTION E — FEATURED FRAMES */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="section-label block mb-4">COLLECTION</span>
            <h2 className="text-5xl font-serif font-bold text-foreground mb-2"><span className="heading-underline">Our Collection</span></h2>
            <p className="text-muted-foreground mt-6">Curated pieces for every style.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProducts.map((product, i) => (
              <motion.div 
                key={product.id}
                initial={{ opacity:0, y:32 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }}
              >
                <div className="card-3d group relative overflow-hidden bg-card border border-border flex flex-col h-full cursor-pointer rounded-[0.25rem]">
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    <img src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80'} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    
                    <div className="absolute inset-x-0 bottom-0 bg-secondary/95 py-3 px-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out text-secondary-foreground text-sm font-semibold flex items-center justify-between z-10">
                      <span>Quick Order</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="pt-4 pb-4 px-4 flex flex-col flex-1">
                    <h3 className="font-serif text-xl text-foreground font-semibold">{product.name}</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-secondary font-semibold text-sm">Rs. {product.price}</p>
                      <Button asChild variant="ghost" className="h-8 px-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground">
                        <Link href="/store">Add to Inquiry</Link>
                      </Button>
                    </div>
                  </div>
                  <Link href="/store" className="absolute inset-0 z-0"><span className="sr-only">View {product.name}</span></Link>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <Button asChild variant="outline" className="rounded-[0.25rem] border-foreground text-foreground hover:bg-foreground hover:text-background px-8 h-12 text-xs uppercase tracking-widest font-semibold transition-colors">
               <Link href="/store">Explore All Frames →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION F — WHY HAVESTORY */}
      <section className="bg-primary text-primary-foreground py-20 noise relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="section-label text-secondary mb-4 block">WHY CHOOSE US</div>
            <h2 className="font-serif text-4xl text-white">The HAVESTORY Standard</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
            {reasons.map((reason, i) => {
              const Icon = reason.icon;
              return (
                <motion.div key={i} initial={{ opacity:0, y:32 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-secondary/20 text-secondary flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-serif text-xl font-bold text-white mb-3">{reason.title}</h4>
                  <p className="text-primary-foreground/70 text-sm leading-relaxed">{reason.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION G — SERVICES */}
      <section className="bg-background py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row gap-16">
          <div className="lg:w-2/5">
            <span className="section-label block mb-4">SERVICES</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">What We Craft</h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed pr-8">Beyond standard framing, we offer a complete suite of services for artists, brands, and homes designed to perfection.</p>
            <Button asChild variant="link" className="px-0 text-foreground hover:text-secondary font-bold text-sm tracking-widest uppercase">
              <Link href="/services">See All Services →</Link>
            </Button>
          </div>
          
          <div className="lg:w-3/5 grid sm:grid-cols-2 gap-6">
            {displayServices.map((service, i) => {
               const Icon = icons[i % icons.length];
               return (
                 <motion.div key={service.id} initial={{ opacity:0, y:32 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }} className="bg-card border border-border p-6 hover:border-secondary transition-colors hover-lift relative group rounded-[0.25rem]">
                   <div className="w-10 h-10 bg-primary/5 text-primary rounded-[0.25rem] flex items-center justify-center mb-5 group-hover:bg-secondary/10 group-hover:text-secondary transition-colors">
                     <Icon className="w-5 h-5" />
                   </div>
                   <h3 className="text-xl font-serif font-semibold mb-2">{service.name}</h3>
                   <p className="text-muted-foreground text-sm line-clamp-2">{service.description}</p>
                   <Link href="/services" className="absolute inset-0 z-10"><span className="sr-only">View Service</span></Link>
                 </motion.div>
               );
            })}
          </div>
        </div>
      </section>

      {/* SECTION H — PORTFOLIO GALLERY */}
      {displayPortfolio.length > 0 && (
        <section className="bg-muted/50 py-24 border-t border-border">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="section-label block mb-4">GALLERY</span>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Our Portfolio</h2>
              <p className="text-muted-foreground">A selection of recent installations and framing projects.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-[200px] gap-4">
              {displayPortfolio.map((item, i) => (
                <motion.div 
                  key={item.id} 
                  initial={{ opacity:0, scale:0.95 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }}
                  className={`relative group overflow-hidden bg-muted rounded-[0.25rem] ${i === 0 ? 'col-span-1 row-span-2' : ''}`}
                >
                  <img src={item.imageUrl || ''} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                  <div className="absolute bottom-4 left-4 right-4 translate-y-3 group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                    <h3 className="text-white font-serif text-lg font-bold drop-shadow-md">{item.title}</h3>
                    <p className="text-white/80 text-xs mt-1 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">{item.description}</p>
                  </div>
                  <Link href="/portfolio" className="absolute inset-0 z-10"><span className="sr-only">View Project</span></Link>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <Button asChild variant="link" className="text-foreground hover:text-secondary font-bold text-sm tracking-widest uppercase">
                <Link href="/portfolio">View Full Portfolio →</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* SECTION I — REVIEWS */}
      {displayReviews.length > 0 && (
        <section className="bg-primary text-primary-foreground py-24 noise relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="section-label text-secondary block mb-4">TESTIMONIALS</span>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-white">Words from our Clients</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {displayReviews.map((review, i) => (
                <motion.div key={review.id} initial={{ opacity:0, y:32 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }} className="border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors rounded-[0.25rem] flex flex-col">
                  <div className="flex gap-1 mb-6">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className={`w-4 h-4 ${idx < review.rating ? 'fill-secondary text-secondary' : 'fill-white/20 text-white/20'}`} />
                    ))}
                  </div>
                  <Quote className="w-8 h-8 text-secondary/30 mb-4" />
                  <p className="text-lg font-serif italic text-primary-foreground/90 leading-relaxed mb-8 flex-1">"{review.comment}"</p>
                  <div className="mt-auto">
                    <p className="font-semibold text-xs tracking-widest uppercase text-secondary">{review.customerName}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION J — ABOUT TEASER */}
      <section className="py-24 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div initial={{ opacity:0, x:-32 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.8 }} className="relative w-full max-w-md mx-auto lg:max-w-none">
              <div className="absolute -bottom-4 -right-4 inset-0 bg-secondary/20 rounded-[0.25rem]" />
              <img 
                src={settings?.aboutImage || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80'} 
                alt="Our Studio" 
                className="relative z-10 w-full h-[400px] object-cover rounded-[0.25rem] border border-border"
              />
            </motion.div>
            
            <motion.div initial={{ opacity:0, y:32 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.8 }}>
              <span className="section-label block mb-4">OUR STORY</span>
              <h2 className="text-4xl lg:text-5xl font-serif font-bold text-foreground mb-6">Crafting since 2019</h2>
              <div className="text-muted-foreground text-lg leading-relaxed mb-8 space-y-4">
                <p>{settings?.aboutStory || 'We started with a simple belief: every great moment deserves to be framed beautifully. Based in Sri Lanka, we merge traditional craftsmanship with modern design to deliver frames that elevate your space.'}</p>
                {settings?.aboutMission && <p>{settings.aboutMission}</p>}
              </div>
              <Button asChild variant="ghost" className="px-0 hover:bg-transparent text-foreground hover:text-secondary font-bold text-sm tracking-widest uppercase">
                <Link href="/about">About HAVESTORY →</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION K — FINAL CTA BANNER */}
      <section className="py-32 bg-primary text-primary-foreground text-center relative overflow-hidden noise">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
        
        <motion.div initial={{ opacity:0, scale:0.95 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ duration:0.8 }} className="max-w-3xl mx-auto px-6 relative z-10">
          <span className="section-label text-secondary block mb-4">READY TO START?</span>
          <h2 className="text-5xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight">Ready to Frame Your Story?</h2>
          <p className="text-lg text-primary-foreground/70 mb-10 font-light max-w-lg mx-auto">Let us help you preserve your most cherished memories with a frame that perfectly fits your space and style.</p>
          
          <Button asChild size="lg" className="rounded-[0.25rem] bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-12 text-sm font-semibold uppercase tracking-widest btn-glow mx-auto mb-8 border-none">
            <Link href="/contact">Get a Custom Quote</Link>
          </Button>
          
          <div className="flex justify-center items-center gap-6 text-xs text-primary-foreground/50 tracking-wide font-medium">
            <span>✓ No commitment</span>
            <span>✓ Reply within 2 hours</span>
            <span>✓ Free design consultation</span>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
