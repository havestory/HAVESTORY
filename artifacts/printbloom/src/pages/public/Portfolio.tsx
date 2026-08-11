import { useState } from 'react';
import { useListPortfolio } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { Image as ImageIcon } from 'lucide-react';

export default function Portfolio() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { data: items, isLoading } = useListPortfolio();

  const categories = Array.from(new Set(items?.map(i => i.category) || []));
  const filteredItems = activeCategory === 'all' ? items : items?.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-16">
        <div className="max-w-7xl mx-auto px-6 text-center max-w-3xl">
          <h1 className="text-4xl lg:text-5xl font-serif mb-6">Our Work</h1>
          <p className="text-lg text-primary-foreground/70 font-light">
            A showcase of our finest print and design projects.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-wrap gap-2 mb-12 justify-center">
          <button 
            onClick={() => setActiveCategory('all')}
            className={`px-6 py-2 rounded-none text-sm transition-colors uppercase tracking-widest font-semibold ${activeCategory === 'all' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            All Work
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2 rounded-none text-sm transition-colors uppercase tracking-widest font-semibold ${activeCategory === cat ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
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
          <div className="text-center py-20">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No portfolio items found in this category.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems?.map(item => (
              <Card key={item.id} className="group rounded-none border-none overflow-hidden relative aspect-square bg-muted cursor-pointer hover-elevate">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">No Image</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
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