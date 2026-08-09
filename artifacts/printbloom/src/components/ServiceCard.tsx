import { ArrowRight, CheckCircle2 } from "lucide-react";
import { DescriptionDisplay } from "@/components/DescriptionDisplay";
type Service = {
  id: number;
  name: string;
  description: string;
  price?: string | null;
  priceType: string;
  highlights: string[];
  imageUrl?: string | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
};
import { Link } from "wouter";
import { formatPrice } from "@/lib/utils";

export function ServiceCard({ service }: { service: Service }) {
  return (
    <div className="hs-service-card group">
      <div className="h-full flex flex-col">
        
        <div className="w-14 h-14 rounded-2xl hs-service-icon-bg flex items-center justify-center mb-6 shadow-inner">
           {service.imageUrl ? (
             <img src={service.imageUrl} alt="" loading="lazy" decoding="async" className="w-8 h-8 object-contain" />
           ) : (
             <img src={`${import.meta.env.BASE_URL}images/placeholder-service.png`} alt="" loading="lazy" decoding="async" className="w-8 h-8 object-contain opacity-60" />
           )}
        </div>

        <h3 className="text-2xl font-display font-bold text-white mb-3">{service.name}</h3>
        <DescriptionDisplay
          value={service.description}
          className="text-[var(--lux-text-secondary)] mb-6"
          iconSize={18}
        />
        
        {service.price && (
          <div className="mb-8">
            <span className="text-3xl font-extrabold hs-price-gradient">
              {formatPrice(service.price)}
            </span>
            <span className="text-[var(--lux-text-muted)] font-medium ml-1">/ {service.priceType}</span>
          </div>
        )}

        <div className="space-y-3 mb-8 flex-grow">
          {service.highlights.map((highlight, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-[var(--lux-gold-primary)] shrink-0 mt-0.5" />
              <span className="text-[var(--lux-text-secondary)] text-sm font-medium">{highlight}</span>
            </div>
          ))}
        </div>

        <Link 
          href={`/contact?service=${encodeURIComponent(service.name)}`}
          className="hs-button hs-button-outline w-full flex items-center justify-center gap-2 mt-auto"
        >
          Discuss Project <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
