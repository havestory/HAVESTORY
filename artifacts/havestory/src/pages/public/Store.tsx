import { useState } from 'react';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Search, ArrowRight, Sparkles, ArrowUpRight, SlidersHorizontal, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { useShopCart } from '@/lib/shop-cart';

// Production can be deployed before the catalog is populated. Keep a real,
// orderable inquiry path available without inventing a database product row.
// The API accepts nullable productId values for custom/admin-created orders.
const CUSTOM_INQUIRY_PRODUCT = {
  id: 'custom-inquiry',
  name: 'Custom Frame Consultation',
  description: 'Tell us about the moment, size, finish, and feeling you want to create.',
  price: '0',
  priceType: 'custom_quote',
  imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=900&q=85',
  category: { name: 'Made to measure' },
  isCustomInquiry: true,
};

export default function Store() {
  const { data: products, isLoading } = useListProducts();
  const { data: categories } = useListCategories();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'featured' | 'price-low' | 'price-high'>('featured');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const { items: cart, count: cartCount, subtotal: cartTotal, addItem } = useShopCart();
  const hasUnpricedInquiry = cart.some(item => {
    const unitPrice = Number(item.unitPrice) || 0;
    return unitPrice <= 0 && (item.product?.isCustomInquiry || item.product?.priceType === 'custom_quote');
  });
  const estimatedTotalLabel = hasUnpricedInquiry ? 'Quote on request' : `Rs. ${cartTotal.toFixed(2)}`;

  const productList = Array.isArray(products) ? products : [];
  const categoryList = Array.isArray(categories) ? categories : [];
  const selectedFilterText = (p: any) => {
    const name = String(p.name || '');
    const description = String(p.description || '');
    const keywords = Array.isArray(p.keywords) ? p.keywords.join(' ') : String(p.keywords || '');
    return `${name} ${description} ${keywords}`.toLowerCase();
  };

  const filteredProducts = productList.filter(p => {
    const filterText = selectedFilterText(p);
    const matchesCategory = activeCategory === 'all' || p.categoryId?.toString() === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || filterText.includes(query);
    const matchesSize = selectedSizes.length === 0 || selectedSizes.some(size => filterText.includes(size.toLowerCase()));
    const matchesMaterial = selectedMaterials.length === 0 || selectedMaterials.some(material => filterText.includes(material.toLowerCase()));
    const numericPrice = Number.parseFloat(String(p.price || 0)) || 0;
    const matchesMin = !minPrice || numericPrice >= Number(minPrice);
    const matchesMax = !maxPrice || numericPrice <= Number(maxPrice);
    return matchesCategory && matchesSearch && matchesSize && matchesMaterial && matchesMin && matchesMax;
  });

  const toggleFilter = (value: string, selected: string[], setSelected: (next: string[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  };

  const clearFilters = () => {
    setActiveCategory('all');
    setSearchQuery('');
    setSelectedSizes([]);
    setSelectedMaterials([]);
    setMinPrice('');
    setMaxPrice('');
  };

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortMode === 'price-low') return parseFloat(String(a.price || 0)) - parseFloat(String(b.price || 0));
    if (sortMode === 'price-high') return parseFloat(String(b.price || 0)) - parseFloat(String(a.price || 0));
    return 0;
  });

  const addToCart = (product: any) => {
    addItem({ product, quantity: 1, selections: [], unitPrice: parseFloat(String(product.price || 0)) || 0, imageUrl: product.imageUrl });
    toast({ title: 'Added to cart', description: `${product.name} is ready for checkout.` });
  };


  return (
    <div className="hs-store min-h-screen flex flex-col">
      <section className="hs-store-search-stage" aria-labelledby="store-heading">
        <motion.div
          className="hs-store-search-heading"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="editorial-kicker">The collection / 2026</span>
          <h1 id="store-heading">Find your <em>frame.</em></h1>
          <p>Search the collection, then choose the finish that feels right.</p>
        </motion.div>
        <div className="hs-store-search-line" role="search">
          <label className="hs-store-search" aria-label="Search frames and prints">
            <Search aria-hidden="true" />
            <Input
              aria-label="Search frames and prints"
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="hs-store-search-input"
            />
          </label>
          <div className="hs-store-controls">
            <div className="hs-store-sort">
              <select aria-label="Sort products" value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)}>
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low</option>
                <option value="price-high">Price: High</option>
              </select>
            </div>
            <button type="button" className="hs-store-filter-toggle" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}>
              <SlidersHorizontal size={15} /> <span>Filters</span>
            </button>
          </div>
        </div>
      </section>

      <div id="collection" className="hs-store-collection hs-store-collection-with-sidebar">
        <aside className="hs-store-category-panel" aria-label="Browse products by category">
          <div className="hs-store-category-intro">
            <span>Browse by category</span>
            <h2>Choose your<br /><em>finish.</em></h2>
            <p>Start with a collection, then let the details make it yours.</p>
          </div>
          <div className="hs-store-category-list">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              aria-pressed={activeCategory === 'all'}
              className={activeCategory === 'all' ? 'is-active' : ''}
            >
              <span>All products</span><small>{productList.length.toString().padStart(2, '0')}</small>
            </button>
            {categoryList.map((category) => {
              const count = productList.filter((product) => product.categoryId?.toString() === category.id.toString()).length;
              return (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => setActiveCategory(category.id.toString())}
                  aria-pressed={activeCategory === category.id.toString()}
                  className={activeCategory === category.id.toString() ? 'is-active' : ''}
                >
                  <span>{category.name}</span><small>{count.toString().padStart(2, '0')}</small>
                </button>
              );
            })}
          </div>
          <div className={`hs-store-filter-panel ${filtersOpen ? 'is-open' : ''}`}>
            <div className="hs-store-filter-group">
              <p>Size</p>
              {['A4', 'A3', '12×18'].map(size => (
                <label key={size}><input type="checkbox" checked={selectedSizes.includes(size)} onChange={() => toggleFilter(size, selectedSizes, setSelectedSizes)} /><span className="hs-filter-check"><Check size={11} /></span>{size}</label>
              ))}
            </div>
            <div className="hs-store-filter-group">
              <p>Material</p>
              {['Wood', 'Metal', 'Acrylic'].map(material => (
                <label key={material}><input type="checkbox" checked={selectedMaterials.includes(material)} onChange={() => toggleFilter(material, selectedMaterials, setSelectedMaterials)} /><span className="hs-filter-check"><Check size={11} /></span>{material}</label>
              ))}
            </div>
            <div className="hs-store-filter-group hs-store-price-filter">
              <p>Price range</p>
              <div className="hs-store-price-inputs">
                <Input aria-label="Minimum price" inputMode="numeric" placeholder="Min" value={minPrice} onChange={event => setMinPrice(event.target.value.replace(/[^0-9]/g, ''))} />
                <Input aria-label="Maximum price" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={event => setMaxPrice(event.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            </div>
            {(selectedSizes.length > 0 || selectedMaterials.length > 0 || minPrice || maxPrice || activeCategory !== 'all' || searchQuery) && <button type="button" className="hs-store-clear-category" onClick={clearFilters}>Clear filters <ArrowRight size={13} /></button>}
          </div>
          {activeCategory !== 'all' && !filtersOpen && (
            <button type="button" className="hs-store-clear-category" onClick={() => setActiveCategory('all')}>Show all products <ArrowRight size={13} /></button>
          )}
        </aside>
        <main className="hs-store-results">

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <Skeleton className="aspect-[4/3] w-full rounded-[0.25rem]" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : productList.length === 0 ? (
            <div className="hs-store-empty overflow-hidden rounded-2xl border border-secondary/25 bg-primary px-6 py-16 text-center text-primary-foreground shadow-[0_18px_60px_rgba(0,0,0,0.12)] sm:px-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Sparkles size={24} /></div>
              <span className="editorial-kicker mt-7 block text-secondary">Made to measure</span>
              <h3 className="editorial-display mt-4 text-4xl text-white sm:text-5xl">Start with your story.</h3>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-primary-foreground/70 sm:text-base">Our ready-to-order collection is being refreshed. You can still send a custom frame inquiry today and our studio will confirm the design, size, finish, and price with you.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => { addToCart(CUSTOM_INQUIRY_PRODUCT); navigate('/checkout'); }}
                  className="h-12 rounded-full bg-secondary px-6 text-xs font-black uppercase tracking-[0.14em] text-secondary-foreground hover:bg-secondary/90"
                >
                  Start custom inquiry <ArrowRight size={15} />
                </Button>
                <Link href="/custom-project" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-xs font-bold uppercase tracking-[0.14em] text-white/80 transition-colors hover:border-secondary hover:text-secondary">
                  Explore custom orders <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="text-center py-32 border border-dashed border-border bg-muted/20 rounded-[0.25rem]">
              <h3 className="font-serif text-2xl font-bold text-foreground mb-2">No frames found</h3>
              <p className="text-muted-foreground text-sm">Try adjusting your category or search filters.</p>
              <Button 
                variant="outline" 
                className="mt-6 border-primary text-primary hover:bg-primary/5 rounded-[0.25rem] font-semibold text-xs uppercase tracking-widest"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className={`hs-store-grid ${sortedProducts.length === 1 ? 'is-single' : ''}`}>
              {sortedProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity:0, y:32 }}
                  whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }}
                  transition={{ duration:0.7, delay: (i % 6) * 0.1 }}
                  className="hs-store-product-wrap"
                >
                  <Link
                    href={`/store/${product.slug || product.id}`}
                    aria-label={`View ${product.name}`}
                    className="hs-store-product store-product-card group flex h-full flex-col"
                  >
                    <div className="store-product-image aspect-[4/3]">
                      <img
                        src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=85'}
                        alt={product.name || 'HAVESTORY frame'}
                        loading={i < 3 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="hs-store-product-body">
                      <div className="hs-store-product-meta">
                        <span className="store-number">{product.category?.name || 'HANDCRAFTED EDIT'}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Ready to make</span>
                      </div>
                      <h3 className="editorial-display line-clamp-1 text-2xl font-bold text-foreground">{product.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description || 'A considered piece, finished by hand in our studio.'}</p>
                      <div className="hs-store-product-footer">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">From</p><p className="mt-1 text-lg font-black text-foreground">Rs. {product.price}</p></div>
                        <span className="hs-store-view-details">View details <ArrowUpRight size={13} /></span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>

      {cart.length > 0 && (
        <div className="hs-store-floating-cart animate-in slide-in-from-bottom-4">
          <div>
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><ShoppingCart size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-bold">{cartCount} {cartCount === 1 ? 'piece' : 'pieces'} in your cart</div><div className="text-[10px] uppercase tracking-[0.16em] text-primary-foreground/55">Subtotal {estimatedTotalLabel}</div></div></div>
            <Button onClick={() => navigate('/checkout')} className="shrink-0 rounded-xl bg-secondary px-4 text-xs font-bold uppercase tracking-wider text-secondary-foreground hover:bg-secondary/90">Checkout <ArrowRight size={14} /></Button>
          </div>
        </div>
      )}


    </div>
  );
}
