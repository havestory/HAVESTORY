import { useState } from 'react';
import { Link } from 'wouter';
import { useGetSettings, useListProducts, useListServices, useGetNotices, useListPortfolio, useListReviews } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, Printer, PenTool, Layout, Star, Package, Layers, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

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

  const fadeUpVariant = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, staggerChildren: 0.1 }
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Notices Banner */}
      {activeNotices.map((notice) => (
        <div
          key={notice.id}
          className="bg-secondary text-secondary-foreground py-3 px-6 relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-bold text-sm uppercase tracking-wider">{notice.title}</span>
              <span className="text-sm opacity-90">{notice.message}</span>
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
      <section className="relative bg-primary text-primary-foreground min-h-[85vh] flex items-center py-20 overflow-hidden">
        {settings?.heroBgImage && (
          <div 
            className="absolute inset-0 opacity-10 bg-cover bg-center mix-blend-overlay"
            style={{ backgroundImage: `url(${settings.heroBgImage})` }}
          />
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            variants={fadeUpVariant}
            className="max-w-2xl"
          >
            <motion.div variants={fadeUpVariant}>
              <span className="inline-block py-1.5 px-4 border border-secondary/50 text-secondary text-[10px] uppercase tracking-widest mb-8 font-semibold rounded-full bg-secondary/10 backdrop-blur-sm">
                {settings?.heroBadgeText || 'Premium Photo Frames · Made in Sri Lanka'}
              </span>
            </motion.div>
            
            <motion.h1 variants={fadeUpVariant} className="text-5xl lg:text-7xl xl:text-8xl font-serif font-semibold leading-[1.05] mb-6">
              {settings?.heroTitle || 'Frame Your Best Moments.'}
            </motion.h1>
            
            <motion.p variants={fadeUpVariant} className="text-lg lg:text-xl text-primary-foreground/80 mb-10 leading-relaxed max-w-lg font-light">
              {settings?.heroSubtitle || 'Bespoke photo frames and gallery walls designed to make your memories last a lifetime.'}
            </motion.p>
            
            <motion.div variants={fadeUpVariant} className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="rounded-none bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-8 text-sm tracking-wide font-semibold shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                <Link href={settings?.heroCtaLink || '/store'}>{settings?.heroCtaText || 'Find Your Frame'} <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-none border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary h-14 px-8 text-sm tracking-wide bg-transparent transition-colors">
                <Link href="/contact">Get a Quote</Link>
              </Button>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block relative h-[600px] w-full perspective-1000">
            <motion.div 
              initial={{ opacity: 0, rotateY: 20, x: 50 }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative w-full h-full"
            >
              {heroProducts.length > 0 ? (
                heroProducts.map((prod, idx) => (
                  <div 
                    key={prod.id}
                    className={`absolute rounded-sm shadow-2xl border-4 border-white overflow-hidden bg-muted`}
                    style={{
                      width: '320px',
                      height: '420px',
                      top: `${idx * 40}px`,
                      right: `${idx * 60 + 20}px`,
                      zIndex: 10 - idx,
                      transform: `rotate(${idx % 2 === 0 ? 3 : -2}deg)`
                    }}
                  >
                    <img 
                      src={prod.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80'} 
                      alt={prod.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              ) : (
                <div className="absolute top-10 right-20 w-[320px] h-[420px] rounded-sm shadow-2xl border-4 border-white overflow-hidden bg-muted rotate-3 z-10">
                  <img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80" alt="Placeholder Frame" className="w-full h-full object-cover" />
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-secondary text-secondary-foreground py-10 border-y border-border/10 shadow-inner z-20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-secondary-foreground/20"
          >
            <motion.div variants={fadeUpVariant} className="text-center px-4">
              <h3 className="text-4xl font-serif font-bold mb-1">{settings?.ordersCompletedCount || 1200}+</h3>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Frames Crafted</p>
            </motion.div>
            <motion.div variants={fadeUpVariant} className="text-center px-4">
              <h3 className="text-4xl font-serif font-bold mb-1">{settings?.happyClientsPercent || 99}%</h3>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Happy Clients</p>
            </motion.div>
            <motion.div variants={fadeUpVariant} className="text-center px-4">
              <h3 className="text-4xl font-serif font-bold mb-1 flex items-center justify-center gap-2">
                {settings?.starRating?.toFixed(1) || '5.0'}
                <Star className="w-6 h-6 fill-secondary-foreground text-secondary-foreground" />
              </h3>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Average Rating</p>
            </motion.div>
            <motion.div variants={fadeUpVariant} className="text-center px-4">
              <h3 className="text-4xl font-serif font-bold mb-1">{settings?.aboutFoundedYear || '2015'}</h3>
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Established</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
            className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6"
          >
            <div className="max-w-2xl">
              <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Our Frames</h2>
              <p className="text-muted-foreground text-lg">Curated collections of premium quality frames, hand-assembled to perfection.</p>
            </div>
            <Button asChild variant="outline" className="rounded-none border-foreground text-foreground hover:bg-foreground hover:text-background px-8">
              <Link href="/store">View All Frames</Link>
            </Button>
          </motion.div>

          <motion.div 
            initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {featuredProducts.map((product) => (
              <motion.div key={product.id} variants={fadeUpVariant} className="group bg-card border border-border overflow-hidden hover-lift flex flex-col">
                <div className="aspect-[4/3] overflow-hidden relative bg-muted">
                  <img 
                    src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80'} 
                    alt={product.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {product.category && (
                    <Badge className="absolute top-4 left-4 rounded-none bg-background/90 text-foreground backdrop-blur-sm border-none shadow-sm font-semibold">
                      {product.category.name}
                    </Badge>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-serif text-xl font-semibold mb-2">{product.name}</h3>
                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
                    <p className="font-bold text-lg text-foreground">Rs. {product.price}</p>
                    <Button asChild size="sm" variant="ghost" className="text-secondary hover:text-secondary-foreground hover:bg-secondary font-semibold uppercase tracking-wider text-xs">
                      <Link href="/store">Add to Inquiry</Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="py-24 bg-muted/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">What We Do</h2>
            <p className="text-muted-foreground text-lg">Beyond standard framing, we offer a complete suite of services for artists, brands, and homes.</p>
          </motion.div>

          <motion.div 
            initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayServices.map((service, idx) => {
              const IconComponent = icons[idx % icons.length];
              return (
                <motion.div key={service.id} variants={fadeUpVariant} className="bg-card p-8 border border-border hover:border-secondary transition-colors group">
                  <div className="w-12 h-12 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-6 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-3">{service.name}</h3>
                  <p className="text-muted-foreground line-clamp-2 mb-6 text-sm leading-relaxed">{service.description}</p>
                  <p className="text-sm font-semibold uppercase tracking-wide text-foreground">Starts from Rs. {service.basePrice}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Portfolio */}
      {displayPortfolio.length > 0 && (
        <section className="py-24 bg-background">
          <div className="max-w-[1600px] mx-auto px-6">
            <motion.div 
              initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Recent Work</h2>
              <p className="text-muted-foreground text-lg">A selection of custom frames and gallery walls we've installed.</p>
            </motion.div>

            <motion.div 
              initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {displayPortfolio.map((item) => (
                <motion.div key={item.id} variants={fadeUpVariant} className="group relative aspect-square overflow-hidden bg-muted">
                  <img 
                    src={item.imageUrl || ''} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-8">
                    <h3 className="text-white font-serif text-2xl font-bold translate-y-4 group-hover:translate-y-0 transition-transform duration-300">{item.title}</h3>
                    <p className="text-white/80 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {displayReviews.length > 0 && (
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div 
              initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-serif font-bold mb-4">What Clients Say</h2>
              <p className="text-primary-foreground/70 text-lg">Trusted by homes and businesses across Sri Lanka.</p>
            </motion.div>

            <motion.div 
              initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {displayReviews.map((review) => (
                <motion.div key={review.id} variants={fadeUpVariant} className="bg-white/5 border border-white/10 p-8 rounded-lg">
                  <div className="flex gap-1 mb-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-white/10 text-white/10'}`} />
                    ))}
                  </div>
                  <p className="text-lg font-serif italic leading-relaxed mb-6">"{review.comment}"</p>
                  <p className="font-bold uppercase tracking-widest text-xs opacity-70">— {review.customerName}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* About Teaser */}
      <section className="py-24 bg-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUpVariant} className="relative aspect-[4/5] lg:aspect-square w-full">
              <div className="absolute inset-0 bg-secondary translate-x-4 translate-y-4 rounded-sm" />
              <img 
                src={settings?.aboutImage || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80'} 
                alt="Our Studio" 
                className="absolute inset-0 w-full h-full object-cover border-4 border-background shadow-xl z-10"
              />
            </motion.div>
            
            <motion.div variants={fadeUpVariant}>
              <h2 className="text-4xl lg:text-5xl font-serif font-bold mb-6">Our Story</h2>
              <div className="prose prose-lg text-muted-foreground mb-8">
                <p>{settings?.aboutStory || 'We started with a simple belief: every great moment deserves to be framed beautifully. Based in Sri Lanka, we merge traditional craftsmanship with modern design to deliver frames that elevate your space.'}</p>
                {settings?.aboutMission && <p>{settings.aboutMission}</p>}
              </div>
              <Button asChild size="lg" className="rounded-none border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg transition-all">
                <Link href="/about">Discover More</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-32 bg-primary text-primary-foreground text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        <motion.div 
          initial="initial" whileInView="whileInView" viewport={{ once: true }} variants={fadeUpVariant}
          className="max-w-3xl mx-auto px-6 relative z-10"
        >
          <motion.h2 variants={fadeUpVariant} className="text-4xl md:text-6xl font-serif font-bold mb-8">Ready to Frame Your Story?</motion.h2>
          <motion.div variants={fadeUpVariant}>
            <Button asChild size="lg" className="rounded-none bg-secondary text-secondary-foreground hover:bg-secondary/90 h-16 px-10 text-lg font-bold shadow-[0_0_30px_rgba(245,158,11,0.4)]">
              <Link href="/contact">Get a Custom Quote</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
