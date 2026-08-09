import { useEffect, useRef, useState } from "react";
import { useListServices } from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Star, CheckCircle2, ImageIcon, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { formatPrice } from "@/lib/utils";
import { DescriptionDisplay } from "@/components/DescriptionDisplay";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function ServiceCard({ service }: { service: any }) {
  const price = service.price ? formatPrice(service.price) : null;
  const priceUnit = service.priceType?.replace(/_/g, " ");
  const highlights: string[] = Array.isArray(service.highlights) ? service.highlights : [];

  return (
    <div className="hs-service-card group h-full">
      <div className="h-full flex flex-col">
        {/* Icon / Image */}
        <div className="w-10 h-10 rounded-xl hs-service-icon-bg flex items-center justify-center mb-4 shrink-0 overflow-hidden">
          {service.imageUrl
            ? <img src={service.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <ImageIcon size={18} className="text-[var(--lux-gold-primary)]" />
          }
        </div>

        {/* Name */}
        <div className="flex items-start gap-2 mb-2">
          <h3 className="font-display font-bold text-[var(--lux-text-primary)] text-base leading-snug flex-1">{service.name}</h3>
          {service.featured && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--lux-gold-primary)]/10 text-[var(--lux-gold-primary)] text-[9px] font-bold rounded-full border border-[var(--lux-gold-primary)]/20 shrink-0 mt-0.5">
              <Star size={8} fill="currentColor" /> Popular
            </span>
          )}
        </div>

        {/* Description */}
        <DescriptionDisplay
          value={service.description}
          className="text-sm text-[var(--lux-text-secondary)] mb-4 leading-relaxed"
          iconClassName="text-[var(--lux-gold-primary)]"
          iconSize={14}
        />

        {/* Price */}
        {price ? (
          <div className="mb-4">
            <span className="text-xl font-bold hs-price-gradient">{price}</span>
            {priceUnit && <span className="text-sm text-[var(--lux-text-muted)] ml-1 capitalize">/ {priceUnit}</span>}
          </div>
        ) : (
          <div className="text-base font-semibold text-[var(--lux-text-muted)] mb-4">Custom Quote</div>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <ul className="space-y-1.5 mb-4 flex-1">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-[var(--lux-text-secondary)]">
                <CheckCircle2 size={15} className="text-[var(--lux-gold-primary)] shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        )}

        {/* Discuss Project Button */}
        <div className="pt-4 mt-auto border-t border-[var(--lux-border-subtle)]">
          <Link href={`/contact?service=${encodeURIComponent(service.name)}`}>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-[var(--lux-gold-primary)] hover:text-[var(--lux-text-primary)] transition-colors group-btn">
              Discuss Project
              <ArrowRight size={15} className="group-btn-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Services() {
  const { data: services, isLoading } = useListServices();
  const [activeSection, setActiveSection] = useState<string>("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeServices = ((services ?? []) as any[]).filter(s => s.active !== false);

  const grouped = activeServices.reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.categoryName || "Our Services";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute("data-cat") || "");
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [categories.join(",")]);

  const scrollTo = (cat: string) => {
    const el = sectionRefs.current[cat];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen pb-24 hs-services bg-[var(--lux-bg-main)]">
      <PageHeader
        title="Our Services"
        subtitle="From concept to physical print, we offer comprehensive design and production services tailored to your needs."
        badge="Premium Quality"
      />

      {/* Sticky Category Nav */}
      {!isLoading && categories.length > 1 && (
        <div className="sticky top-16 z-30 bg-[var(--lux-surface-dark)]/90 backdrop-blur-md border-b border-[var(--lux-border-subtle)] shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 justify-center">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => scrollTo(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                    activeSection === cat
                      ? "bg-[var(--lux-gold-primary)] text-[var(--lux-bg-main)] border-transparent"
                      : "border-[var(--lux-border-subtle)] text-[var(--lux-text-secondary)] hover:border-[var(--lux-gold-primary)] hover:text-[var(--lux-gold-primary)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : activeServices.length === 0 ? (
          <div className="text-center py-24 text-[var(--lux-text-secondary)]">
            <div className="text-6xl mb-4">🎨</div>
            <p className="font-medium text-lg text-[var(--lux-text-primary)]">Services coming soon</p>
            <p className="text-sm mt-2">Check back soon for our service offerings.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {categories.map((cat, idx) => (
              <div key={cat}>
                {/* Category Break Divider (between categories only) */}
                {idx > 0 && (
                  <div className="flex items-center gap-4 my-12">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--lux-border-subtle)] to-transparent" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--lux-surface-dark)] border border-[var(--lux-border-subtle)] rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--lux-gold-muted)]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--lux-gold-primary)]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--lux-gold-muted)]" />
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--lux-border-subtle)] to-transparent" />
                  </div>
                )}

                {/* Category Section */}
                <div
                  ref={el => { sectionRefs.current[cat] = el; }}
                  data-cat={cat}
                  id={slugify(cat)}
                >
                  {/* Large Centered Category Heading */}
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-display font-bold text-[var(--lux-text-primary)]">{cat}</h2>
                  </div>

                  {/* 3-Column Card Grid */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {grouped[cat].map(service => (
                      <ServiceCard key={service.id} service={service} />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* CTA */}
            <div className="mt-16 hs-service-icon-bg border border-[var(--lux-border-subtle)] rounded-2xl p-8 text-center">
              <h3 className="font-bold text-xl mb-2 text-[var(--lux-text-primary)]">Need a Custom Quote?</h3>
              <p className="text-[var(--lux-text-secondary)] text-sm mb-5">Can't find what you're looking for? We handle custom projects of any scale.</p>
              <Link href="/custom-project">
                <button className="hs-button hs-button-primary shadow-lg">
                  Get a Custom Quote
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
