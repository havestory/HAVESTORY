import { Link } from 'wouter';
import { useGetSettings, useListProducts, useListServices } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, PenTool, Layout, Star } from 'lucide-react';

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: featuredProducts } = useListProducts({ featured: true });
  const { data: featuredServices } = useListServices({ featured: true });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden py-24 lg:py-32">
        {settings?.heroBgImage && (
          <div 
            className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-overlay"
            style={{ backgroundImage: `url(${settings.heroBgImage})` }}
          />
        )}
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            {settings?.heroBadgeText && (
              <span className="inline-block py-1 px-3 border border-secondary text-secondary text-[10px] uppercase tracking-widest mb-6 font-semibold">
                {settings.heroBadgeText}
              </span>
            )}
            <h1 className="text-5xl lg:text-7xl font-serif font-light leading-[1.1] mb-6">
              {settings?.heroTitle || 'Precision Printing.'}
            </h1>
            <p className="text-lg lg:text-xl text-primary-foreground/80 mb-10 leading-relaxed max-w-lg font-light">
              {settings?.heroSubtitle || 'Bespoke graphic design and premium printing services for brands that care about details.'}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="rounded-none bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-8 text-sm tracking-wide">
                <Link href={settings?.heroCtaLink || '/store'}>{settings?.heroCtaText || 'Explore Products'}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-none border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 hover:text-white h-14 px-8 text-sm tracking-wide bg-transparent">
                <Link href="/contact">Get a Quote</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / Trust */}
      <section className="bg-secondary text-secondary-foreground py-12 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-secondary-foreground/10">
          <div className="text-center px-4">
            <h3 className="text-4xl font-serif mb-2">{settings?.ordersCompletedCount || 1200}+</h3>
            <p className="text-xs uppercase tracking-widest font-semibold opacity-80">Projects Completed</p>
          </div>
          <div className="text-center px-4">
            <h3 className="text-4xl font-serif mb-2">{settings?.happyClientsPercent || 99}%</h3>
            <p className="text-xs uppercase tracking-widest font-semibold opacity-80">Happy Clients</p>
          </div>
          <div className="text-center px-4">
            <h3 className="text-4xl font-serif mb-2 flex items-center justify-center gap-1">
              {settings?.starRating?.toFixed(1) || '5.0'}
              <Star className="w-6 h-6 fill-current" />
            </h3>
            <p className="text-xs uppercase tracking-widest font-semibold opacity-80">Average Rating</p>
          </div>
          <div className="text-center px-4">
            <h3 className="text-4xl font-serif mb-2">{settings?.aboutFoundedYear || '2020'}</h3>
            <p className="text-xs uppercase tracking-widest font-semibold opacity-80">Established</p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6 text-center max-w-3xl mb-16">
          <h2 className="text-4xl font-serif text-foreground mb-4">Craftsmanship in every detail.</h2>
          <p className="text-muted-foreground text-lg">From premium business cards to large format banners, our workshop handles your project with master-level precision.</p>
        </div>
      </section>
    </div>
  );
}