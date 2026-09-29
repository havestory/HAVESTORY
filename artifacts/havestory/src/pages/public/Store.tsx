import { useState } from 'react';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Search, ArrowRight, ArrowUpRight, ShoppingCart, SlidersHorizontal, Check, X, Frame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useShopCart } from '@/lib/shop-cart';
import { ComingSoon } from '@/components/public/ComingSoon';
import { Reveal, Stagger, StaggerItem } from '@/components/public/Reveal';

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

const SIZE_FILTERS = ['A4', 'A3', '12×18'];
const MATERIAL_FILTERS = ['Wood', 'Metal', 'Acrylic'];

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

  const hasActiveFilters =
    selectedSizes.length > 0 || selectedMaterials.length > 0 || minPrice || maxPrice || activeCategory !== 'all' || searchQuery;

  return (
    <div className="hv-page flex min-h-screen flex-col">
      {/* ── Page hero ─────────────────────────────────────────── */}
      <section className="hv-page-hero" aria-labelledby="store-heading">
        <div className="hv-container">
          <Reveal>
            <span className="hv-kicker">Frames &amp; Prints</span>
            <h1 id="store-heading" className="hv-display hv-display-lg">
              Frames &amp; <em>prints.</em>
            </h1>
            <p className="hv-lede">Browse available products or search by name, size, and material.</p>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="hv-search mt-8 max-w-xl" role="search">
              <Search aria-hidden="true" />
              <input
                aria-label="Search frames and prints"
                placeholder="Search frames and prints"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </Reveal>
        </div>
        <div className="hv-hero-ornament" aria-hidden="true" />
      </section>

      {/* ── Collection ────────────────────────────────────────── */}
      <section className="hv-section" id="collection">
        <div className="hv-container">
          <div className="grid gap-12 lg:grid-cols-[272px_minmax(0,1fr)]">
            {/* Sidebar */}
            <aside aria-label="Browse products by category" className="self-start lg:sticky lg:top-24">
              <Reveal>
                <p className="hv-kicker">Browse by category</p>
                <h2 className="hv-display hv-display-sm mt-3">Categories</h2>
              </Reveal>

              <button
                type="button"
                className="hv-btn hv-btn-ghost hv-btn-sm mt-6 w-full lg:hidden"
                onClick={() => setFiltersOpen(value => !value)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal /> Filters
                <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
              </button>

              <Reveal delay={0.06}>
                <nav className="mt-6" aria-label="Categories">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('all')}
                    aria-pressed={activeCategory === 'all'}
                    className={`flex w-full items-center justify-between py-3.5 text-left transition-colors ${
                      activeCategory === 'all' ? 'text-[#171310]' : 'text-[#6f6259] hover:text-[#171310]'
                    }`}
                    style={{ borderBottom: '1px solid var(--hv-line-soft)' }}
                  >
                    <span className={`text-[15px] ${activeCategory === 'all' ? 'font-bold' : 'font-medium'}`}>
                      All products
                    </span>
                    <span className={`hv-badge ${activeCategory === 'all' ? 'hv-badge-ink' : 'hv-badge-ghost'}`}>
                      {productList.length.toString().padStart(2, '0')}
                    </span>
                  </button>
                  {categoryList.map((category) => {
                    const count = productList.filter((product) => product.categoryId?.toString() === category.id.toString()).length;
                    const isActive = activeCategory === category.id.toString();
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => setActiveCategory(category.id.toString())}
                        aria-pressed={isActive}
                        className={`flex w-full items-center justify-between py-3.5 text-left transition-colors ${
                          isActive ? 'text-[#171310]' : 'text-[#6f6259] hover:text-[#171310]'
                        }`}
                        style={{ borderBottom: '1px solid var(--hv-line-soft)' }}
                      >
                        <span className={`text-[15px] ${isActive ? 'font-bold' : 'font-medium'}`}>{category.name}</span>
                        <span className={`hv-badge ${isActive ? 'hv-badge-ink' : 'hv-badge-ghost'}`}>
                          {count.toString().padStart(2, '0')}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </Reveal>

              <div className={`${filtersOpen ? 'block' : 'hidden'} mt-8 lg:block`}>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6f6259]">Size</p>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {SIZE_FILTERS.map(size => (
                      <label key={size} className="flex cursor-pointer items-center gap-3 text-[14px] font-medium text-[#2b241e]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[#b07c3a]"
                          checked={selectedSizes.includes(size)}
                          onChange={() => toggleFilter(size, selectedSizes, setSelectedSizes)}
                        />
                        {size}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-7">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6f6259]">Material</p>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {MATERIAL_FILTERS.map(material => (
                      <label key={material} className="flex cursor-pointer items-center gap-3 text-[14px] font-medium text-[#2b241e]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[#b07c3a]"
                          checked={selectedMaterials.includes(material)}
                          onChange={() => toggleFilter(material, selectedMaterials, setSelectedMaterials)}
                        />
                        {material}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-7">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#6f6259]">Price range</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      aria-label="Minimum price"
                      inputMode="numeric"
                      placeholder="Min"
                      value={minPrice}
                      onChange={event => setMinPrice(event.target.value.replace(/[^0-9]/g, ''))}
                      className="hv-input"
                    />
                    <input
                      aria-label="Maximum price"
                      inputMode="numeric"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={event => setMaxPrice(event.target.value.replace(/[^0-9]/g, ''))}
                      className="hv-input"
                    />
                  </div>
                </div>
                {hasActiveFilters && (
                  <button type="button" className="hv-text-link mt-7" onClick={clearFilters}>
                    <X /> Clear filters
                  </button>
                )}
              </div>
            </aside>

            {/* Results */}
            <main>
              <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-[#6f6259]">
                  {isLoading ? 'Loading the collection…' : (
                    <><strong className="font-bold text-[#171310]">{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'piece' : 'pieces'}</>
                  )}
                </p>
                <div className="hv-chip-row" role="group" aria-label="Sort products">
                  {([
                    ['featured', 'Featured'],
                    ['price-low', 'Price · low to high'],
                    ['price-high', 'Price · high to low'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSortMode(mode)}
                      aria-pressed={sortMode === mode}
                      className={`hv-chip ${sortMode === mode ? 'is-active' : ''}`}
                    >
                      {sortMode === mode && <Check size={13} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="hv-card flex flex-col overflow-hidden">
                      <div className="hv-skeleton aspect-[4/3]" style={{ borderRadius: 0 }} />
                      <div className="flex flex-col gap-3 p-6">
                        <div className="hv-skeleton h-5 w-1/3" />
                        <div className="hv-skeleton h-7 w-3/4" />
                        <div className="hv-skeleton h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : productList.length === 0 ? (
                <div className="flex flex-col items-center">
                  <ComingSoon
                    eyebrow="Made to measure"
                    title="Start with your story."
                    description="Our ready-to-order collection is being refreshed. You can still send a custom frame inquiry today and our studio will confirm the design, size, finish, and price with you."
                    href="/custom-project"
                    cta="Explore custom orders"
                  />
                  <button
                    type="button"
                    className="hv-btn hv-btn-bronze mt-8"
                    onClick={() => { addToCart(CUSTOM_INQUIRY_PRODUCT); navigate('/checkout'); }}
                  >
                    Start custom inquiry <ArrowRight />
                  </button>
                </div>
              ) : filteredProducts?.length === 0 ? (
                <div className="hv-empty">
                  <div className="hv-empty-icon"><Frame /></div>
                  <span className="hv-kicker">Nothing matched</span>
                  <h3 className="hv-display hv-display-sm mt-4">No frames found</h3>
                  <p className="hv-lede mt-4 mx-auto">Try adjusting your category or search filters.</p>
                  <button type="button" className="hv-btn hv-btn-ghost mt-8" onClick={clearFilters}>
                    Clear filters <X />
                  </button>
                </div>
              ) : (
                <Stagger
                  key={`${activeCategory}-${sortMode}`}
                  className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {sortedProducts.map((product, i) => (
                    <StaggerItem key={product.id} className="h-full">
                      <Link
                        href={`/store/${product.slug || product.id}`}
                        aria-label={`View ${product.name}`}
                        className="hv-card hv-card-hover group flex h-full flex-col overflow-hidden"
                      >
                        <div className="hv-img-frame aspect-[4/3]" style={{ borderRadius: 0 }}>
                          <img
                            src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=75'}
                            alt={product.name || 'HAVESTORY frame'}
                            loading={i === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                          />
                        </div>
                        <div className="flex flex-1 flex-col p-6">
                          <span className="hv-badge hv-badge-ghost self-start">
                            {product.category?.name || 'Handcrafted edit'}
                          </span>
                          <h3 className="hv-display mt-4 line-clamp-1 text-[24px] leading-tight">{product.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#6f6259]">
                            {product.description || ''}
                          </p>
                          <div className="mt-auto flex items-end justify-between pt-6">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#a89a8c]">From</p>
                              <p className="hv-display mt-1 text-[22px]">Rs. {product.price}</p>
                            </div>
                            <span className="hv-text-link">View details <ArrowUpRight /></span>
                          </div>
                        </div>
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </main>
          </div>
        </div>
      </section>

      {/* ── Floating cart ─────────────────────────────────────── */}
      {cart.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-5 z-40 px-4"
        >
          <div className="hv-card mx-auto flex max-w-xl items-center justify-between gap-4 rounded-full py-3 pl-4 pr-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
                style={{ background: 'var(--hv-accent)' }}
              >
                <ShoppingCart size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#171310]">
                  {cartCount} {cartCount === 1 ? 'piece' : 'pieces'} in your cart
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a89a8c]">
                  Subtotal · {estimatedTotalLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="hv-btn hv-btn-bronze hv-btn-sm shrink-0"
            >
              Checkout <ArrowRight />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
