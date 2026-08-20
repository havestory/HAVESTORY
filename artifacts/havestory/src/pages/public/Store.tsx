import { useState } from 'react';
import { useListProducts, useListCategories, useListPortfolio, useGetSettings } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Search, ArrowRight, Sparkles, ShieldCheck, Ruler, Heart, MessageCircle, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { useShopCart } from '@/lib/shop-cart';
import { ShopCartDrawer } from '@/components/shop/ShopCartDrawer';

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
  const { data: categories } = useListCategories();
  const { data: products, isLoading } = useListProducts();
  const { data: portfolio } = useListPortfolio();
  const { data: settings } = useGetSettings();
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'featured' | 'price-low' | 'price-high'>('featured');
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const { items: cart, count: cartCount, subtotal: cartTotal, addItem } = useShopCart();
  const estimatedTotalLabel = cartTotal > 0 ? `Rs. ${cartTotal.toFixed(2)}` : 'Quote on request';

  const productList = Array.isArray(products) ? products : [];
  const categoryList = Array.isArray(categories) ? categories : [];
  const recentWork = (Array.isArray(portfolio) ? portfolio : []).slice(0, 5);
  const filteredProducts = productList.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.categoryId?.toString() === activeCategory;
    const name = String(p.name || '');
    const description = String(p.description || '');
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = name.toLowerCase().includes(query) || description.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

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
      <section className="hs-store-hero">
        <div className="hs-store-hero-copy">
          <span>THE HAVESTORY COLLECTION / 2026</span>
          <h1>Frames & prints,<br /><em>made personal.</em></h1>
          <p>Browse ready-to-order pieces or start a custom frame with guidance from our studio. Clear choices, considered materials and no complicated calculator.</p>
          <div><a href="#collection">Shop the collection <ArrowRight size={16} /></a><Link href="/custom-project">Need a custom size?</Link></div>
        </div>
        <div className="hs-store-hero-image"><img src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=88" alt="A framed artwork in a bright interior" /><span>Made to measure · Finished by hand</span></div>
      </section>
      <div className="hs-store-trust"><span><ShieldCheck size={16} /> Secure packaging</span><span><Ruler size={16} /> Custom sizing</span><span><MessageCircle size={16} /> Studio guidance</span><span><Heart size={16} /> Made with care</span></div>

      {recentWork.length > 0 && (
        <section className="hs-store-work">
          <div className="hs-store-work-copy">
            <span>RECENT STUDIO WORK</span>
            <h2>Made here.<br /><em>Living elsewhere.</em></h2>
            <p>A small selection of finished frames, prints and client stories from our studio.</p>
            <Link href="/gallery">View the complete gallery <ArrowRight size={15} /></Link>
          </div>
          <div className="hs-store-work-grid">
            {recentWork.map((item, index) => (
              <motion.div
                key={item.id}
                className={`hs-store-work-item hs-store-work-item-${index + 1}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: .2 }}
                transition={{ duration: .55, delay: index * .07 }}
              >
                <img src={item.imageUrl || 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&q=82'} alt={item.title || 'Recent HAVESTORY studio work'} />
                <span>{item.title || `Studio story ${index + 1}`}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div id="collection" className="hs-store-collection">
        {/* Categories Sidebar */}
        <aside className="hs-store-filter">
          <div>
            <h3>Browse by category</h3>
            
            <div className="hs-store-category-mobile no-scrollbar">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`hs-store-filter-button ${activeCategory === 'all' ? 'is-active' : ''}`}
              >
                All Products
              </button>
              {categoryList.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`hs-store-filter-button ${activeCategory === cat.id.toString() ? 'is-active' : ''}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="hs-store-category-desktop">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`hs-store-filter-button ${activeCategory === 'all' ? 'is-active' : ''}`}
              >
                All Products
              </button>
              {categoryList.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`hs-store-filter-button ${activeCategory === cat.id.toString() ? 'is-active' : ''}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Area */}
        <main className="hs-store-results">
          <div className="hs-store-toolbar">
            <div className="hs-store-toolbar-heading">
              <div className="flex items-center justify-between gap-3"><div><span className="editorial-kicker">The collection</span><h2 className="mt-2 editorial-display text-3xl text-foreground sm:text-4xl">Find your frame.</h2></div><SlidersHorizontal size={18} className="text-secondary sm:hidden" /></div>
              <div className="hs-store-search">
              <Search aria-hidden="true" />
              <Input 
                placeholder="Search frames..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hs-store-search-input"
              />
              </div>
            </div>
            
            <div className="hs-store-controls">
              <div className="hs-store-sort">
                <span className="store-number">{String(sortedProducts.length).padStart(2, '0')} / {String(productList.length).padStart(2, '0')} objects</span>
                <select aria-label="Sort products" value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)}>
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low</option>
                  <option value="price-high">Price: High</option>
                </select>
              </div>
              
              <ShopCartDrawer trigger={<Button variant="default" className="hs-store-cart-trigger"><ShoppingCart className="w-4 h-4" /><span>Shopping Cart</span>{cartCount > 0 && <span className="hs-store-cart-count">{cartCount}</span>}</Button>} />
            </div>
          </div>

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
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
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
                    href={`/store/${product.id}`}
                    aria-label={`View ${product.name}`}
                    className="hs-store-product store-product-card group flex h-full flex-col"
                  >
                    <div className="store-product-image aspect-[4/3]">
                      <img
                        src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=85'}
                        alt={product.name || 'HAVESTORY frame'}
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
