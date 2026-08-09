import { useGetSettings } from "@workspace/api-client-react";
import { PageHeader } from "@/components/PageHeader";

export default function About() {
  const { data: settings } = useGetSettings();

  return (
    <div className="min-h-screen pb-24">
      <PageHeader 
        title="About PrintBloom" 
        subtitle="Passionate creators dedicated to making your brand stand out."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="relative">
            {/* Abstract visual container */}
            <div className="aspect-[4/5] rounded-3xl overflow-hidden glass-panel p-2 shadow-2xl shadow-purple-900/10 transform -rotate-2">
              <img 
                src={settings?.aboutImage || `${import.meta.env.BASE_URL}images/about-vision.png`}
                alt="Our Studio" 
                className="w-full h-full object-cover rounded-[1.2rem]"
              />
            </div>
            {/* Floating decoration */}
            <div className="absolute -bottom-8 -right-8 glass p-6 rounded-2xl shadow-xl w-64 transform rotate-3">
              <h4 className="font-display font-bold text-4xl text-primary mb-1">
                {settings?.ordersCompletedCount || "1000"}+
              </h4>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Projects Completed</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold tracking-widest text-primary uppercase mb-3">Our Story</h2>
            <div className="prose prose-lg prose-purple prose-headings:font-display mb-12">
              <h3 className="text-3xl font-display font-bold text-foreground mt-0 mb-6 leading-tight">
                Crafting visual excellence since day one.
              </h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {settings?.aboutStory || "PrintBloom started with a simple vision: to bridge the gap between creative design and high-quality physical production. We believe that every business, regardless of size, deserves access to premium branding materials.\n\nOur team of dedicated designers and print specialists work tirelessly to ensure every color pops, every cut is precise, and every client is thrilled with the result."}
              </p>
            </div>

            <div className="glass bg-purple-50/50 p-8 rounded-3xl border border-purple-100">
              <h3 className="text-xl font-bold font-display text-purple-900 mb-4">Our Mission</h3>
              <p className="text-purple-800/80 italic leading-relaxed">
                "{settings?.aboutMission || "To empower brands through innovative design and impeccable print quality, delivering excellence in every pixel and every drop of ink."}"
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
