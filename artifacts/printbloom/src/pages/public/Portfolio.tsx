import { useState } from 'react';
import { useListPortfolio } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { ComingSoon } from '@/components/public/ComingSoon';
import { Image as ImageIcon } from 'lucide-react';

export default function Portfolio() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { data: items, isLoading } = useListPortfolio();
  const portfolioItems = Array.isArray(items) ? items : [];

  const categories = Array.from(new Set(portfolioItems.map(i => i.category)));
  const filteredItems = activeCategory === 'all' ? portfolioItems : portfolioItems.filter(i => i.category === activeCategory);

  return (
    <div className="gallery-tides-page min-h-screen bg-background">
      <div className="gallery-page-hero relative overflow-hidden bg-primary py-20 text-primary-foreground sm:py-24">
        <div className="gallery-page-hero-mark" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="editorial-kicker mb-6">The HAVESTORY archive</p>
            <h1 className="editorial-display text-5xl leading-[0.9] text-white sm:text-7xl lg:text-8xl">Images with a <span className="text-gradient italic">place.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-primary-foreground/72 sm:text-lg">
              A living showcase of frames, prints and studio stories — each one composed to be lived with.
            </p>
          </div>
          <div className="mt-10 flex items-end justify-between gap-5 border-t border-white/15 pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            <span>Selected work / 2026</span>
            <span className="hidden sm:inline">Sri Lanka · Made to keep</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
        <div className="mb-12 flex flex-wrap gap-2">
          <button 
            onClick={() => setActiveCategory('all')}
            className={`gallery-filter ${activeCategory === 'all' ? 'is-active' : ''}`}
          >
            All Work
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`gallery-filter ${activeCategory === cat ? 'is-active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-80 bg-muted animate-pulse"></div>)}
          </div>
        ) : filteredItems?.length === 0 ? (
          <ComingSoon
            eyebrow="The gallery is still developing"
            title="Our work is coming soon."
            description="We are preparing a considered gallery of frames, prints and client stories. Explore a custom project while the collection is being curated."
            href="/custom-project"
            cta="Create your project"
          />
        ) : (
          <div className="gallery-mosaic grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-7">
            {filteredItems?.map((item, index) => (
              <Card key={item.id} className={`gallery-tile group overflow-hidden relative aspect-square cursor-pointer ${index % 5 === 1 ? 'lg:translate-y-10' : ''} ${index % 5 === 3 ? 'lg:-translate-y-5' : ''}`}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/30"><ImageIcon className="h-10 w-10" /></div>
                )}
                <div className="gallery-tile-overlay absolute inset-0 flex flex-col justify-end p-6">
                  <p className="text-secondary text-xs uppercase tracking-widest font-bold mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">{item.category}</p>
                  <h3 className="text-white font-serif text-xl translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">{item.title}</h3>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}