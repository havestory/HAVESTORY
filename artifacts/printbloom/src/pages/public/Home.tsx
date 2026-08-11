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
  X, ArrowRight, Shield, Truck, Star, Zap, Printer, PenTool, Layout, Package, Layers, Image as ImageIcon 
} from 'lucide-react';

function AnimatedCounter({ end, duration = 2000, suffix = '', decimals = 0 }: { end: number, duration?: number, suffix?: string, decimals?: number }) {
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
    { icon: Shield, title: 'Premium Quality', desc: 'Museum-grade materials and solid wood frames.' },
    { icon: Truck, title: 'Island-wide Delivery', desc: 'Safe, tracked delivery across Sri Lanka.' },
    { icon: Star, title: '5-Star Rated', desc: 'Loved by hundreds of happy clients.' },
    { icon: Zap, title: '48hr Turnaround', desc: 'Express framing available on request.' }
  ];

  const marqueeItems = [
    '⭐ Rated 5/5 by 200+ clients', 
    '🖼 1,200+ frames delivered', 
    '✅ Made in Sri Lanka', 
    '📦 Free delivery island-wide', 
    '🎨 Custom designs welcome', 
    '⚡ 48hr turnaround available'
  ];

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Notices Banner */}
      {activeNotices.map((notice) => (
        <div key={notice.id} className="bg-secondary text-secondary-foreground py-3 px-6 relative flex justify-center items-center overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xs uppercase tracking-widest px-2 py-0.5 bg-black/10 rounded-sm">{notice.title}</span>
              <span className="text-sm font-medium">{notice.message}</span>
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

      {/* Hero Section */}
      <section className="relative bg-primary text-primary-foreground min-h-[100dvh] flex items-center pt-32 pb-20 overflow-hidden noise">
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_bottom_right,hsl(var(--secondary)/0.15)_0%,transparent_60%)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.5, delay:0.2 }}>
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 rounded-full px-4 py-1.5 font-bold mb-8 uppercase tracking-widest text-xs shadow-none">
                Premium Frame Studio
              </Badge>
            </motion.div>
            
            <motion.div variants={{ visible: { transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="visible" className="text-6xl lg:text-8xl font-serif font-black leading-none mb-6">
              {['Frame', 'Your', 'Best', 'Story.'].map((word, i) => (
                <motion.span 
                  key={i} 
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
                  }}
                  className={`inline-block mr-[0.25em] ${word === 'Story.' ? 'text-gradient' : ''}`}
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
            
            <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7, duration:1 }} className="text-xl text-primary-foreground/80 mb-10 leading-relaxed max-w-lg font-light">
              {settings?.heroSubtitle || 'Bespoke photo frames and gallery walls designed to make your memories last a lifetime.'}
            </motion.p>
            
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.9, duration:0.5 }} className="flex flex-wrap gap-4 items-center">
              <Button asChild size="lg" className="rounded-none bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-8 text-sm tracking-wide font-bold btn-glow border-none">
                <Link href="/store">Order Custom Frame <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-none border-white/30 text-white hover:bg-white hover:text-primary h-14 px-8 text-sm tracking-wide font-bold transition-colors">
                <Link href="/portfolio">View Portfolio</Link>
              </Button>
            </motion.div>
            
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.1, duration:1 }} className="mt-12 flex items-center gap-4">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-2 border-primary bg-amber-200 flex items-center justify-center font-bold text-black text-xs">AS</div>
                <div className="w-10 h-10 rounded-full border-2 border-primary bg-emerald-200 flex items-center justify-center font-bold text-black text-xs">MK</div>
                <div className="w-10 h-10 rounded-full border-2 border-primary bg-blue-200 flex items-center justify-center font-bold text-black text-xs">RN</div>
              </div>
              <p className="text-sm font-medium text-white/80"><strong className="text-white">1,200+</strong> frames crafted</p>
            </motion.div>
          </div>

          <motion.div initial={{ opacity:0, x:60 }} animate={{ opacity:1, x:0 }} transition={{ duration:1, delay:0.4 }} className="hidden lg:block relative h-[650px] w-full perspective-[1000px]">
            {heroProducts.map((prod, idx) => {
               const rot = idx === 0 ? '3deg' : idx === 1 ? '-2deg' : '5deg';
               const z = idx === 0 ? 30 : idx === 1 ? 20 : 10;
               const anim = idx === 0 ? 'animate-float' : idx === 1 ? 'animate-float-delay' : 'animate-float-delay-2';
               return (
                 <div 
                   key={prod.id} 
                   className={`absolute border-4 border-white rounded-sm shadow-2xl overflow-hidden aspect-[3/4] ${anim}`}
                   style={{
                     width: '300px',
                     top: `${idx * 40 + 20}px`,
                     right: `${idx * 50 + 20}px`,
                     zIndex: z,
                     '--rot': rot
                   } as React.CSSProperties}
                 >
                   <img src={prod.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80'} alt={prod.name} className="w-full h-full object-cover bg-muted" />
                 </div>
               );
            })}
            {heroProducts.length === 0 && (
               <div 
                 className={`absolute border-4 border-white rounded-sm shadow-2xl overflow-hidden aspect-[3/4] animate-float`}
                 style={{ width: '300px', top: '20px', right: '20px', zIndex: 30, '--rot': '3deg' } as React.CSSProperties}
               >
                 <img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80" alt="Placeholder" className="w-full h-full object-cover bg-muted" />
               </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Marquee */}
      <section className="bg-secondary text-secondary-foreground py-3 overflow-hidden border-y border-black/10">
        <div className="marquee-track animate-marquee">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <div key={i} className="flex items-center">
              <span className="font-bold text-sm tracking-wider uppercase mx-6 whitespace-nowrap">{item}</span>
              <span className="text-black/30 font-black">·</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-background border-y border-border py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center relative z-10">
          <div>
            <h3 className="text-5xl md:text-6xl font-serif font-black mb-2"><AnimatedCounter end={settings?.ordersCompletedCount || 1200} />+</h3>
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Frames Crafted</p>
            <div className="w-12 h-1 bg-secondary mx-auto mt-4" />
          </div>
          <div>
            <h3 className="text-5xl md:text-6xl font-serif font-black mb-2"><AnimatedCounter end={settings?.happyClientsPercent || 99} suffix="%" /></h3>
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Happy Clients</p>
            <div className="w-12 h-1 bg-secondary mx-auto mt-4" />
          </div>
          <div>
            <h3 className="text-5xl md:text-6xl font-serif font-black mb-2 flex items-center justify-center gap-1">
              <AnimatedCounter end={settings?.starRating || 5} decimals={1} />
              <Star className="w-8 h-8 fill-secondary text-secondary -mt-1" />
            </h3>
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Star Rating</p>
            <div className="w-12 h-1 bg-secondary mx-auto mt-4" />
          </div>
          <div>
            <h3 className="text-5xl md:text-6xl font-serif font-black mb-2"><AnimatedCounter end={settings?.aboutFoundedYear ? parseInt(settings.aboutFoundedYear) : 2015} /></h3>
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Established</p>
            <div className="w-12 h-1 bg-secondary mx-auto mt-4" />
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-32 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <Badge className="bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-full px-4 py-1 mb-6 border-none font-bold uppercase tracking-widest shadow-none">Collection</Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground">Crafted for Your Story</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {featuredProducts.map((product, i) => (
              <motion.div 
                key={product.id}
                initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }}
              >
                <div className="card-3d bg-card border border-border group relative flex flex-col h-full cursor-pointer">
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    <img src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80'} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    {product.category && (
                      <Badge className="absolute top-4 right-4 rounded-none bg-background/95 text-foreground backdrop-blur-md shadow-sm font-semibold uppercase tracking-wider text-[10px] border-none">
                        {product.category.name}
                      </Badge>
                    )}
                    <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <Link href="/store" className="block w-full bg-secondary text-secondary-foreground py-4 text-center font-bold text-sm tracking-wide">
                        Quick Order →
                      </Link>
                    </div>
                  </div>
                  <div className="p-8 flex flex-col flex-1">
                    <h3 className="font-serif text-2xl font-bold mb-2">{product.name}</h3>
                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-border/50">
                      <p className="font-black text-xl text-foreground">Rs. {product.price}</p>
                      <Button asChild variant="ghost" className="hover:bg-secondary hover:text-secondary-foreground text-xs uppercase tracking-widest font-bold">
                        <Link href="/store">Add to Inquiry</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <Button asChild size="lg" variant="outline" className="rounded-none border-foreground text-foreground hover:bg-foreground hover:text-background px-10 h-14 font-bold tracking-wide">
               <Link href="/store">View All Frames →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why HAVESTORY */}
      <section className="bg-primary text-primary-foreground py-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
          {reasons.map((reason, i) => {
            const Icon = reason.icon;
            return (
              <motion.div key={i} initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }} className="text-center">
                <div className="w-16 h-16 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <Icon className="w-8 h-8" />
                </div>
                <h4 className="font-serif text-xl font-bold mb-3">{reason.title}</h4>
                <p className="text-primary-foreground/70 text-sm leading-relaxed">{reason.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Services */}
      <section className="bg-muted/30 border-y border-border py-32">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-16">
          <div className="lg:col-span-1">
            <Badge className="bg-primary/5 text-primary hover:bg-primary/10 rounded-full px-4 py-1 mb-6 border-none font-bold uppercase tracking-widest shadow-none">Services</Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">What We Do</h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">Beyond standard framing, we offer a complete suite of services for artists, brands, and homes.</p>
            <Button asChild size="lg" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-14 font-bold tracking-wide border-none">
              <Link href="/services">Explore Services</Link>
            </Button>
          </div>
          
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
            {displayServices.map((service, i) => {
               const Icon = icons[i % icons.length];
               return (
                 <motion.div key={service.id} initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }} className="bg-card border border-border p-8 hover:border-secondary hover:shadow-lg transition-all group relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Icon className="w-32 h-32 text-foreground" />
                   </div>
                   <div className="w-12 h-12 bg-primary/5 text-primary rounded-none flex items-center justify-center mb-6 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors relative z-10">
                     <Icon className="w-6 h-6" />
                   </div>
                   <h3 className="text-xl font-serif font-bold mb-3 relative z-10">{service.name}</h3>
                   <p className="text-muted-foreground text-sm line-clamp-2 mb-6 relative z-10">{service.description}</p>
                   <p className="text-xs font-black uppercase tracking-widest text-primary relative z-10">From Rs. {service.basePrice}</p>
                 </motion.div>
               );
            })}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      {displayPortfolio.length > 0 && (
        <section className="py-32 bg-background">
          <div className="max-w-[1600px] mx-auto px-6">
            <div className="text-center mb-20">
              <Badge className="bg-secondary/10 text-secondary rounded-full px-4 py-1 mb-6 border-none font-bold uppercase tracking-widest shadow-none">Recent Work</Badge>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground">A Selection of Our Craft</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[300px]">
              {displayPortfolio.map((item, i) => (
                <motion.div 
                  key={item.id} 
                  initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }}
                  className={`relative overflow-hidden group bg-muted ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''} ${i === 3 ? 'lg:row-span-2' : ''}`}
                >
                  <img src={item.imageUrl || ''} alt={item.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                    <h3 className="text-white font-serif text-3xl font-bold translate-y-4 group-hover:translate-y-0 transition-transform duration-500">{item.title}</h3>
                    <p className="text-white/80 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-75">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-16 text-center">
              <Button asChild size="lg" variant="ghost" className="hover:bg-transparent hover:text-secondary font-bold tracking-wide group">
                <Link href="/portfolio">View Full Portfolio <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {displayReviews.length > 0 && (
        <section className="bg-primary text-primary-foreground py-32 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">What Clients Say</h2>
              <p className="text-primary-foreground/60 text-lg">Trusted by homes and businesses across Sri Lanka.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {displayReviews.map((review, i) => (
                <motion.div key={review.id} initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.7, delay: i * 0.1 }} className="bg-white/5 border border-white/10 p-10 rounded-none relative">
                  <div className="absolute top-0 right-10 -translate-y-1/2 bg-primary px-2">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star key={idx} className={`w-5 h-5 ${idx < review.rating ? 'fill-secondary text-secondary' : 'fill-white/10 text-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xl font-serif italic leading-relaxed mb-8 mt-4 text-primary-foreground/90">"{review.comment}"</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-serif font-bold text-lg text-secondary">
                      {review.customerName.charAt(0)}
                    </div>
                    <p className="font-bold uppercase tracking-widest text-sm text-white">{review.customerName}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About Teaser */}
      <section className="py-32 bg-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div initial={{ opacity:0, x:-40 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:1 }} className="relative aspect-[4/5] w-full max-w-md mx-auto lg:max-w-none">
              <div className="absolute inset-0 bg-secondary translate-x-6 translate-y-6" />
              <img 
                src={settings?.aboutImage || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80'} 
                alt="Our Studio" 
                className="absolute inset-0 w-full h-full object-cover border-8 border-background z-10 grayscale hover:grayscale-0 transition-all duration-700 bg-muted"
              />
            </motion.div>
            
            <motion.div initial={{ opacity:0, y:40 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:1 }}>
              <h2 className="text-4xl lg:text-6xl font-serif font-black mb-8">Our Story</h2>
              <div className="prose prose-lg prose-p:text-muted-foreground prose-p:leading-relaxed mb-10 text-lg">
                <p>{settings?.aboutStory || 'We started with a simple belief: every great moment deserves to be framed beautifully. Based in Sri Lanka, we merge traditional craftsmanship with modern design to deliver frames that elevate your space.'}</p>
                {settings?.aboutMission && <p>{settings.aboutMission}</p>}
              </div>
              <Button asChild size="lg" className="rounded-none border-primary bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors px-10 h-14 font-bold tracking-wide">
                <Link href="/about">Discover More</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-40 bg-primary text-primary-foreground text-center relative overflow-hidden noise">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div initial={{ opacity:0, scale:0.95 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ duration:0.8 }} className="max-w-3xl mx-auto px-6 relative z-10">
          <h2 className="text-5xl md:text-7xl font-serif font-black mb-8 leading-tight">Ready to Frame Your Story?</h2>
          <p className="text-xl text-primary-foreground/70 mb-12 font-light">Let us help you preserve your most cherished memories with a frame that perfectly fits your space and style.</p>
          
          <Button asChild size="lg" className="rounded-none bg-secondary text-secondary-foreground hover:bg-secondary/90 h-16 px-12 text-lg font-black tracking-wide btn-glow mx-auto mb-8 border-none">
            <Link href="/contact">Get a Custom Quote — It's Free</Link>
          </Button>
          
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm font-bold tracking-widest uppercase text-secondary/80">
            <span>✓ No commitment</span>
            <span>✓ Reply within 2 hours</span>
            <span>✓ Free consultation</span>
          </div>
        </motion.div>
      </section>
    </div>
  );
}