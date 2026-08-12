import { useListServices } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Layers } from 'lucide-react';
import { Link } from 'wouter';

export default function Services() {
  const { data: services, isLoading, isError, refetch } = useListServices();
  const serviceList = Array.isArray(services) ? services : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="bg-primary text-primary-foreground py-32 noise relative overflow-hidden text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <span className="section-label text-secondary mb-4 block">WHAT WE DO</span>
          <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white mb-6">Our Services</h1>
          <p className="text-lg text-primary-foreground/70 font-light max-w-2xl mx-auto">
            Comprehensive printing, framing, and design solutions crafted to perfection.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-24 flex-1 w-full">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3].map(i => <div key={i} className="h-96 bg-muted animate-pulse rounded-[0.25rem]"></div>)}
          </div>
        ) : isError ? (
          <div className="mx-auto max-w-lg border border-border bg-card p-8 text-center">
            <h2 className="font-serif text-2xl font-bold">Services are temporarily unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">Please try loading this section again.</p>
            <Button onClick={() => void refetch()} className="mt-5 rounded-[0.25rem]">Try again</Button>
          </div>
        ) : serviceList.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No services are published yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-10">
            {serviceList.map(service => (
              <Card key={service.id} className="rounded-[0.25rem] border border-border overflow-hidden hover-lift bg-card border-l-4 border-l-secondary">
                <div className="flex flex-col h-full sm:flex-row">
                  {service.imageUrl && (
                    <div className="sm:w-2/5 h-48 sm:h-auto overflow-hidden bg-muted shrink-0">
                      <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                    </div>
                  )}
                  <CardContent className="p-8 flex-1 flex flex-col">
                    <div className="w-12 h-12 bg-primary/5 text-primary rounded-full flex items-center justify-center mb-5">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h3 className="font-serif text-2xl font-bold mb-3">{service.name}</h3>
                    <p className="text-muted-foreground text-sm mb-6 leading-relaxed flex-1">{service.description}</p>
                    
                    {service.price && (
                      <div className="mb-6 flex items-end gap-2 border-t border-border pt-4">
                        <span className="text-xl font-bold text-secondary">Rs. {service.price}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">/ {service.priceType}</span>
                      </div>
                    )}

                    {Array.isArray(service.highlights) && service.highlights.length > 0 && (
                      <ul className="space-y-3 mb-8">
                        {service.highlights.map((h: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button asChild variant="ghost" className="w-full rounded-[0.25rem] h-12 text-xs font-bold uppercase tracking-widest text-primary hover:text-secondary hover:bg-transparent justify-start px-0 mt-auto">
                      <Link href={`/contact?subject=Inquiry for ${service.name}`}>Enquire Now →</Link>
                    </Button>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <section className="py-24 bg-primary text-primary-foreground text-center noise relative">
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <h2 className="text-4xl font-serif font-bold text-white mb-8">Need a custom solution?</h2>
          <Button asChild size="lg" className="rounded-[0.25rem] bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-10 text-sm font-semibold uppercase tracking-widest btn-glow border-none">
            <Link href="/contact">Get a Quote</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
