import { useGetSettings } from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";
import { getBusinessName } from "@/lib/brand-settings";

export default function About() {
  const { data: settings } = useGetSettings();
  const businessName = getBusinessName(settings);

  return (
    <div className="min-h-screen pb-24 hs-about bg-[var(--lux-bg-main)]">
      <PageHeader 
        title={`About ${businessName}`} 
        subtitle="Passionate creators dedicated to making your brand stand out."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="relative">
            {/* Abstract visual container */}
            <div className="aspect-[4/5] rounded-3xl overflow-hidden glass-panel p-2 shadow-2xl shadow-black/50 transform -rotate-2 bg-[var(--lux-surface-dark)] border border-[var(--lux-border-subtle)]">
              <img 
                src={settings?.aboutImage || `${import.meta.env.BASE_URL}images/about-vision.png`}
                alt="Our Studio" 
                className="w-full h-full object-cover rounded-[1.2rem]"
              />
            </div>
            {/* Floating decoration */}
            <div className="absolute -bottom-8 -right-8 p-6 rounded-2xl shadow-xl w-64 transform rotate-3 bg-[var(--lux-surface-dark)] border border-[var(--lux-border-subtle)]">
              <h4 className="font-display font-bold text-4xl text-[var(--lux-gold-primary)] mb-1">
                {settings?.ordersCompletedCount || "1000"}+
              </h4>
              <p className="text-sm font-semibold text-[var(--lux-text-muted)] uppercase tracking-wider">Projects Completed</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold tracking-widest text-[var(--lux-gold-primary)] uppercase mb-3">Our Story</h2>
            <div className="prose prose-lg prose-headings:font-display mb-12">
              <h3 className="text-3xl font-display font-bold text-[var(--lux-text-primary)] mt-0 mb-6 leading-tight">
                Crafting visual excellence since day one.
              </h3>
              <p className="text-[var(--lux-text-secondary)] leading-relaxed whitespace-pre-line">
                {settings?.aboutStory || `${businessName || "Our studio"} began with one idea: photographs deserve to live where people can see and feel them. We bring portrait direction, careful colour work and considered framing together under one studio.\n\nEvery piece is handled with a human eye—from the first image check to the final finish—so the result feels personal, balanced and made to last.`}
              </p>
            </div>

            <div className="bg-[var(--lux-surface-dark)] p-8 rounded-3xl border border-[var(--lux-border-subtle)]">
              <h3 className="text-xl font-bold font-display text-[var(--lux-text-primary)] mb-4">Our Mission</h3>
              <p className="text-[var(--lux-text-secondary)] italic leading-relaxed">
                "{settings?.aboutMission || "To empower brands through innovative design and impeccable print quality, delivering excellence in every pixel and every drop of ink."}"
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
