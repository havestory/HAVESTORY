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
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">
      <div className="p-6 flex-1 flex flex-col">
        {/* Icon / Image */}
        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-4 shrink-0 overflow-hidden">
          {service.imageUrl
            ? <img src={service.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <ImageIcon size={18} className="text-purple-400" />
          }
        </div>

        {/* Name */}
        <div className="flex items-start gap-2 mb-2">
          <h3 className="font-bold text-gray-900 text-base leading-snug flex-1">{service.name}</h3>
          {service.featured && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 text-orange-500 text-[9px] font-bold rounded-full border border-orange-100 shrink-0 mt-0.5">
              <Star size={8} fill="currentColor" /> Popular
            </span>
          )}
        </div>

        {/* Description */}
        <DescriptionDisplay
          value={service.description}
          className="text-sm text-gray-500 mb-4 leading-relaxed"
          iconClassName="text-pink-400"
          iconSize={14}
        />

        {/* Price */}
        {price ? (
          <div className="mb-4">
            <span className="text-xl font-bold text-pink-600">{price}</span>
            {priceUnit && <span className="text-sm text-gray-400 ml-1 capitalize">/ {priceUnit}</span>}
          </div>
        ) : (
          <div className="text-base font-semibold text-gray-400 mb-4">Custom Quote</div>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <ul className="space-y-1.5 mb-4 flex-1">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 size={15} className="text-pink-400 shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Discuss Project Button */}
      <div className="px-6 pb-5 mt-auto">
        <div className="border-t border-gray-50 pt-4">
          <Link href={`/contact?service=${encodeURIComponent(service.name)}`}>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-pink-600 transition-colors group">
              Discuss Project
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
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
    <div className="min-h-screen pb-24">
      <PageHeader
        title="Our Services"
        subtitle="From concept to physical print, we offer comprehensive design and production services tailored to your needs."
        badge="Premium Quality"
      />

      {/* Sticky Category Nav */}
      {!isLoading && categories.length > 1 && (
        <div className="sticky top-16 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 justify-center">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => scrollTo(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                    activeSection === cat
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent"
                      : "border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600"
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
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-4">🎨</div>
            <p className="font-medium text-lg">Services coming soon</p>
            <p className="text-sm mt-2">Check back soon for our service offerings.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {categories.map((cat, idx) => (
              <div key={cat}>
                {/* Category Break Divider (between categories only) */}
                {idx > 0 && (
                  <div className="flex items-center gap-4 my-12">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-full">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
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
                    <h2 className="text-3xl font-display font-bold text-gray-900">{cat}</h2>
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
            <div className="mt-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-8 text-white text-center">
              <h3 className="font-bold text-xl mb-2">Need a Custom Quote?</h3>
              <p className="text-white/80 text-sm mb-5">Can't find what you're looking for? We handle custom projects of any scale.</p>
              <Link href="/custom-project">
                <button className="bg-white text-pink-600 font-bold px-8 py-3 rounded-xl hover:bg-pink-50 transition-colors text-sm shadow-lg">
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
