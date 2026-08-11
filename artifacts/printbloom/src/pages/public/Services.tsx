import { useListServices } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Layers } from 'lucide-react';
import { Link } from 'wouter';

export default function Services() {
  const { data: services, isLoading } = useListServices();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-16">
        <div className="max-w-7xl mx-auto px-6 text-center max-w-3xl">
          <h1 className="text-4xl lg:text-5xl font-serif mb-6">Our Services</h1>
          <p className="text-lg text-primary-foreground/70 font-light">
            Comprehensive printing and design solutions tailored for your business needs.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3].map(i => <div key={i} className="h-96 bg-muted animate-pulse"></div>)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services?.map(service => (
              <Card key={service.id} className="rounded-none border-border overflow-hidden group hover-elevate">
                {service.imageUrl && (
                  <div className="h-48 overflow-hidden bg-muted">
                    <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="font-serif text-2xl mb-3">{service.name}</h3>
                  <p className="text-muted-foreground text-sm mb-6 leading-relaxed line-clamp-3">{service.description}</p>
                  
                  {service.price && (
                    <div className="mb-6 flex items-end gap-2">
                      <span className="text-2xl font-medium text-foreground">Rs. {service.price}</span>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">/ {service.priceType}</span>
                    </div>
                  )}

                  {service.highlights?.length > 0 && (
                    <ul className="space-y-3 mb-8">
                      {service.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                          <Check className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button asChild className="w-full rounded-none h-12 text-sm tracking-wide">
                    <Link href={`/contact?subject=Inquiry for ${service.name}`}>Inquire Now</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}