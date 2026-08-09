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
    <div className="glass-panel rounded-3xl p-1 overflow-hidden group">
      <div className="bg-white/40 rounded-[22px] h-full p-6 md:p-8 flex flex-col transition-colors group-hover:bg-white/60">
        
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mb-6 shadow-inner">
           {service.imageUrl ? (
             <img src={service.imageUrl} alt="" loading="lazy" decoding="async" className="w-8 h-8 object-contain" />
           ) : (
             <img src={`${import.meta.env.BASE_URL}images/placeholder-service.png`} alt="" loading="lazy" decoding="async" className="w-8 h-8 object-contain opacity-60 mix-blend-multiply" />
           )}
        </div>

        <h3 className="text-2xl font-display font-bold text-foreground mb-3">{service.name}</h3>
        <DescriptionDisplay
          value={service.description}
          className="text-gray-600 mb-6"
          iconSize={18}
        />
        
        {service.price && (
          <div className="mb-8">
            <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-800 to-pink-600">
              {formatPrice(service.price)}
            </span>
            <span className="text-gray-500 font-medium ml-1">/ {service.priceType}</span>
          </div>
        )}

        <div className="space-y-3 mb-8 flex-grow">
          {service.highlights.map((highlight, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-pink-500 shrink-0 mt-0.5" />
              <span className="text-gray-700 text-sm font-medium">{highlight}</span>
            </div>
          ))}
        </div>

        <Link 
          href={`/contact?service=${encodeURIComponent(service.name)}`}
          className="w-full py-4 rounded-xl btn-glass flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-white group-hover:border-primary mt-auto"
        >
          Discuss Project <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
