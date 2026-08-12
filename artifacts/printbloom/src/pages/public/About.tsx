import { useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useState, useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';

function AnimatedCounter({ end, duration = 1800, suffix = '' }: { end: number, duration?: number, suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!inView) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(easeProgress * end);
      if (progress < 1) animationFrameId = requestAnimationFrame(step);
      else setCount(end);
    };
    
    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [inView, end, duration]);
  
  return <span ref={ref}>{Math.floor(count)}{suffix}</span>;
}

export default function About() {
  const { data: settings } = useGetSettings();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="bg-primary py-32 noise relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <span className="section-label text-secondary block mb-4">OUR STORY</span>
          <h1 className="text-5xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight">
            Crafting memories <br/><span className="text-secondary italic">since {settings?.aboutFoundedYear || '2020'}.</span>
          </h1>
        </div>
      </div>

      {/* Story Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            {settings?.aboutImage && (
              <img src={settings.aboutImage} alt={`${settings.businessName || 'HAVESTORY'} studio`} className="w-full aspect-[4/3] object-cover mb-8 border border-border" />
            )}
            <blockquote className="text-3xl lg:text-4xl font-serif italic text-primary leading-relaxed border-l-4 border-secondary pl-8">
              "We believe that every picture holds a story, and every story deserves to be framed beautifully."
            </blockquote>
          </div>
          <div className="prose prose-lg prose-p:text-muted-foreground prose-p:leading-relaxed">
            <p className="text-foreground text-xl font-medium mb-6">
              {settings?.aboutStory || 'Founded by a team of passionate designers and print specialists, HAVESTORY was born out of a desire to bring true craftsmanship back to the printing industry in Sri Lanka.'}
            </p>
            <p>
              We combine traditional woodworking techniques with modern archival practices to deliver stunning results for our clients. Whether you're an artist looking to mount your first exhibition or a family preserving a wedding photo, we approach every project with the same level of dedication and care.
            </p>
          </div>
        </div>
      </div>

      {/* Mission / Vision Cards */}
      <div className="bg-muted py-24 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10">
          <div className="bg-card p-10 border-t-4 border-secondary shadow-sm rounded-[0.25rem]">
            <span className="section-label mb-4 block">OUR MISSION</span>
            <h3 className="font-serif text-2xl font-bold mb-4">Preserving Moments</h3>
            <p className="text-muted-foreground leading-relaxed">
              {settings?.aboutMission || 'To provide museum-quality framing services that elevate and protect our clients most cherished artworks and memories.'}
            </p>
          </div>
          <div className="bg-card p-10 border-t-4 border-accent shadow-sm rounded-[0.25rem]">
            <span className="section-label mb-4 block">OUR VISION</span>
            <h3 className="font-serif text-2xl font-bold mb-4">A Legacy of Craft</h3>
            <p className="text-muted-foreground leading-relaxed">
              {settings?.aboutVision || 'To be the premier destination for custom framing in Sri Lanka, recognized for uncompromising quality, sustainable practices, and artistic integrity.'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          <div>
            <h4 className="text-5xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.aboutFoundedYear ? parseInt(settings.aboutFoundedYear) : 2019} />
            </h4>
            <p className="section-label mt-3">Founded</p>
          </div>
          <div>
            <h4 className="text-5xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.ordersCompletedCount || 1200} suffix="+" />
            </h4>
            <p className="section-label mt-3">Frames Crafted</p>
          </div>
          <div>
            <h4 className="text-5xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.happyClientsPercent || 98} suffix="%" />
            </h4>
            <p className="section-label mt-3">Happy Clients</p>
          </div>
          <div>
            <h4 className="text-5xl font-serif font-bold text-primary mb-2">
              <AnimatedCounter end={settings?.starRating || 5} />
            </h4>
            <p className="section-label mt-3">Star Rating</p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-primary text-primary-foreground py-24 noise text-center">
        <div className="relative z-10 max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-serif font-bold mb-8 text-white">Join our story.</h2>
          <Button asChild size="lg" className="rounded-[0.25rem] bg-secondary text-secondary-foreground hover:bg-secondary/90 h-14 px-10 text-sm font-semibold uppercase tracking-widest btn-glow border-none">
            <Link href="/contact">Get in Touch</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
