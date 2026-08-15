import { useState } from 'react';
import { useListProducts, useListCategories, useCreateOrder, useListPortfolio } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle2, ArrowRight, Tag, X, Sparkles, ShieldCheck, Ruler, Heart, MessageCircle, Eye, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';

interface CouponResult {
  valid: boolean;
  id?: number;
  discount?: number;
  type?: 'percentage' | 'fixed';
  value?: number;
  code?: string;
  message?: string;
}

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
  const createOrder = useCreateOrder();
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'featured' | 'price-low' | 'price-high'>('featured');
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);
  const [savedProducts, setSavedProducts] = useState<number[]>([]);
  const { toast } = useToast();
  
  // Local Cart State
  const [cart, setCart] = useState<Array<{product: any, quantity: number}>>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // Form State for Checkout
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderDescription, setOrderDescription] = useState('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

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

  const toggleSaved = (productId: number) => {
    setSavedProducts(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    // Cart changed — discard any applied coupon so it gets re-validated
    setCouponResult(null);
    setCouponCode('');
    toast({ title: 'Added to cart', description: `${product.name} added to your inquiry.` });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.product.id === productId) {
          return { ...item, quantity: item.quantity + delta };
        }
        return item;
      });
      return updated.filter(item => item.quantity > 0);
    });
    // Cart changed — discard applied coupon to force re-validation
    setCouponResult(null);
    setCouponCode('');
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    setCouponResult(null);
    setCouponCode('');
  };

  const cartTotal = cart.reduce((total, item) => total + (parseFloat(String(item.product.price || 0)) * item.quantity), 0);
  const hasQuotedItem = cart.some(item => item.product?.isCustomInquiry || item.product?.priceType === 'custom_quote');
  const estimatedTotalLabel = hasQuotedItem
    ? (cartTotal > 0 ? `Rs. ${cartTotal.toFixed(2)} + quote` : 'Quote on request')
    : `Rs. ${cartTotal.toFixed(2)}`;
  const couponDiscount = couponResult?.valid && couponResult.discount ? couponResult.discount : 0;
  const finalTotal = Math.max(0, cartTotal - couponDiscount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), orderTotal: cartTotal }),
      });
      const data: CouponResult = await res.json();
      setCouponResult(data);
      if (data.valid) {
        toast({ title: 'Coupon applied!', description: `You save Rs. ${data.discount?.toLocaleString('en-IN')}` });
      } else {
        toast({ title: 'Invalid coupon', description: data.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Could not validate coupon', variant: 'destructive' });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponResult(null);
    setCouponCode('');
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone || !customerAddress) {
      toast({ title: 'Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    const inquiryCart = cart.length > 0
      ? cart
      : [{ product: CUSTOM_INQUIRY_PRODUCT, quantity: 1 }];

    const orderItems = inquiryCart.map(item => ({
      productId: typeof item.product.id === 'number' ? item.product.id : null,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      notes: item.product.description || null,
    }));

    const couponNote = couponResult?.valid ? `\nCoupon: ${couponResult.code} (-Rs. ${couponDiscount.toLocaleString('en-IN')})` : '';
    const notesText = [
      orderDescription ? `Custom request: ${orderDescription}` : '',
      `Items:\n${inquiryCart.map(c => `${c.quantity}x ${c.product.name}`).join('\n')}`,
      couponNote,
    ].filter(Boolean).join('\n\n');

    createOrder.mutate({
      data: {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        orderType: "standard",
        designLinks: [],
        attachments: [],
        shippingAddress: customerAddress,
        notes: notesText,
        description: notesText,
        // couponCode is validated server-side; the backend derives the
        // discount from trusted product prices and increments usedCount.
        couponCode: couponResult?.valid && couponResult.code ? couponResult.code : undefined,
        items: orderItems as any 
      } as any
    }, {
      onSuccess: () => {
        setCart([]);
        setIsCheckoutOpen(false);
        setIsSuccessOpen(true);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerAddress('');
        setOrderDescription('');
        setCouponCode('');
        setCouponResult(null);
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to submit order. Please try again.', variant: 'destructive' });
      }
    });
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
              
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="default" className="hs-store-cart-trigger">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Inquiry Cart</span>
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border-2 border-background">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="hs-store-cart-sheet">
                  <div className="hs-store-cart-head">
                    <SheetHeader>
                      <SheetTitle className="font-serif text-2xl text-white">Your Inquiry Cart</SheetTitle>
                    </SheetHeader>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                          <ShoppingCart className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="font-medium text-lg text-foreground">Your cart is empty.</p>
                        <p className="text-sm">Add a frame from the collection, or start with a custom consultation.</p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { addToCart(CUSTOM_INQUIRY_PRODUCT); setIsCheckoutOpen(true); }}
                          className="rounded-full border-secondary px-5 text-xs font-bold uppercase tracking-[0.14em] text-secondary"
                        >
                          Start custom inquiry
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map(item => (
                          <div key={item.product.id} className="hs-store-cart-item">
                            <div className="w-20 h-20 bg-muted shrink-0 overflow-hidden rounded-[0.25rem]">
                              <img 
                                src={item.product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&q=80'} 
                                alt={item.product.name} 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            <div className="flex-1 flex flex-col">
                              <h4 className="font-serif font-bold text-base leading-tight mb-1">{item.product.name}</h4>
                              <p className="text-sm text-secondary font-semibold mb-auto">{item.product.isCustomInquiry ? 'Studio quote' : `Rs. ${item.product.price}`}</p>
                              
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center border border-border bg-background rounded-[0.25rem] overflow-hidden">
                                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="hs-store-cart-footer">
                      <div className="flex justify-between items-end mb-6">
                        <span className="text-muted-foreground font-medium text-sm">Estimated Total</span>
                        <span className="font-serif text-2xl font-bold text-foreground text-right">{estimatedTotalLabel}</span>
                      </div>
                      <Button 
                        onClick={() => setIsCheckoutOpen(true)}
                        className="w-full rounded-[0.25rem] h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest text-sm shadow-sm"
                      >
                        Proceed to Inquiry
                      </Button>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
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
            <div className="overflow-hidden rounded-2xl border border-secondary/25 bg-primary px-6 py-16 text-center text-primary-foreground shadow-[0_18px_60px_rgba(0,0,0,0.12)] sm:px-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Sparkles size={24} /></div>
              <span className="editorial-kicker mt-7 block text-secondary">Made to measure</span>
              <h3 className="editorial-display mt-4 text-4xl text-white sm:text-5xl">Start with your story.</h3>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-primary-foreground/70 sm:text-base">Our ready-to-order collection is being refreshed. You can still send a custom frame inquiry today and our studio will confirm the design, size, finish, and price with you.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => { addToCart(CUSTOM_INQUIRY_PRODUCT); setIsCheckoutOpen(true); }}
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
            <div className="hs-store-grid">
              {sortedProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity:0, y:32 }}
                  whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }}
                  transition={{ duration:0.7, delay: (i % 6) * 0.1 }}
                  className="hs-store-product-wrap"
                >
                  <div className="hs-store-product store-product-card group flex h-full flex-col">
                    <div className="store-product-image aspect-[4/3]">
                      <img
                        src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=85'}
                        alt={product.name || 'HAVESTORY frame'}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between">
                        <span className="store-number rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md">{String(i + 1).padStart(2, '0')} / EDIT</span>
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label={`Preview ${product.name}`} onClick={() => setQuickViewProduct(product)} className="store-icon-button"><Eye size={15} /></button>
                          <button type="button" aria-label={`Save ${product.name}`} onClick={() => toggleSaved(product.id)} className={`store-icon-button ${savedProducts.includes(product.id) ? 'is-active' : ''}`}><Heart size={15} fill={savedProducts.includes(product.id) ? 'currentColor' : 'none'} /></button>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); addToCart(product); }}
                        className="hs-store-add"
                      >
                        <span>Add to inquiry</span>
                        <Plus className="h-4 w-4" />
                      </button>
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
                        <button type="button" onClick={() => setQuickViewProduct(product)} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-secondary transition-colors hover:text-foreground">Details <ArrowUpRight size={13} /></button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>

      {cart.length > 0 && (
        <div className="hs-store-floating-cart animate-in slide-in-from-bottom-4">
          <div>
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><ShoppingCart size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-bold">{cart.reduce((a, b) => a + b.quantity, 0)} {cart.reduce((a, b) => a + b.quantity, 0) === 1 ? 'piece' : 'pieces'} selected</div><div className="text-[10px] uppercase tracking-[0.16em] text-primary-foreground/55">Estimated {estimatedTotalLabel}</div></div></div>
            <Button onClick={() => setIsCheckoutOpen(true)} className="shrink-0 rounded-xl bg-secondary px-4 text-xs font-bold uppercase tracking-wider text-secondary-foreground hover:bg-secondary/90">Start order <ArrowRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* Quick view dialog */}
      <Dialog open={Boolean(quickViewProduct)} onOpenChange={(open) => !open && setQuickViewProduct(null)}>
        <DialogContent className="hs-store-quickview">
          {quickViewProduct && (
            <div className="grid md:grid-cols-[0.95fr_1.05fr]">
              <div className="store-product-image min-h-[280px] md:min-h-full"><img src={quickViewProduct.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=900&q=85'} alt={quickViewProduct.name || 'HAVESTORY frame'} className="h-full w-full object-cover" /></div>
              <div className="flex flex-col justify-center p-7 sm:p-10">
                <span className="editorial-kicker">A closer look</span>
                <h2 className="editorial-display mt-4 text-4xl leading-none text-foreground">{quickViewProduct.name}</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{quickViewProduct.description || 'A considered piece, finished by hand in our studio.'}</p>
                <div className="my-7 flex items-end justify-between border-y border-border py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Studio price</p><p className="mt-1 text-2xl font-black text-foreground">Rs. {quickViewProduct.price}</p></div><span className="store-number">PER {String(quickViewProduct.priceType || 'PIECE').toUpperCase()}</span></div>
                <div className="flex flex-col gap-3 sm:flex-row"><Button onClick={() => { addToCart(quickViewProduct); setQuickViewProduct(null); }} className="h-12 flex-1 rounded-full bg-secondary font-black uppercase tracking-[0.14em] text-secondary-foreground hover:bg-secondary/90">Add to inquiry <ArrowRight size={15} /></Button><Button type="button" variant="outline" onClick={() => setQuickViewProduct(null)} className="h-12 rounded-full border-border px-6 text-xs font-bold uppercase tracking-[0.14em]">Close</Button></div>
                <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-secondary" /> We will confirm sizing, finish, and delivery before production.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="hs-store-checkout">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">Complete Your Inquiry</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 mt-2">
                Provide your details. We will contact you shortly to confirm the order and discuss any custom requirements.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name *</label>
                <Input 
                  required 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="John Doe"
                  className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary h-11 bg-muted/30 px-3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone Number *</label>
                <Input 
                  required 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value)} 
                  placeholder="077 123 4567"
                  className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary h-11 bg-muted/30 px-3"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
              <Input 
                type="email" 
                value={customerEmail} 
                onChange={(e) => setCustomerEmail(e.target.value)} 
                placeholder="john@example.com"
                className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary h-11 bg-muted/30 px-3"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Shipping Address *</label>
              <Input 
                required 
                value={customerAddress} 
                onChange={(e) => setCustomerAddress(e.target.value)} 
                placeholder="123 Main St, Colombo"
                className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary h-11 bg-muted/30 px-3"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order Notes / Custom Requests</label>
              <textarea 
                value={orderDescription} 
                onChange={(e) => setOrderDescription(e.target.value)}
                className="flex w-full rounded-none border-b-2 border-t-0 border-x-0 border-border bg-muted/30 px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:border-secondary min-h-[100px] resize-y"
                placeholder="Any special instructions for framing?"
              />
            </div>

            {/* Coupon Code */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Coupon Code</label>
              {couponResult?.valid ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 p-3 rounded-[0.25rem]">
                  <Tag className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-sm font-bold text-green-700 flex-1">{couponResult.code} — Rs. {couponResult.discount?.toLocaleString('en-IN')} off</span>
                  <button type="button" onClick={removeCoupon} className="text-green-600 hover:text-green-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="rounded-none border-b-2 border-t-0 border-x-0 border-border focus-visible:ring-0 focus-visible:border-secondary h-11 bg-muted/30 px-3 flex-1"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyCoupon}
                    disabled={!couponCode.trim() || couponLoading}
                    className="rounded-[0.25rem] border-border h-11 font-bold uppercase tracking-widest text-xs px-4 shrink-0"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-muted p-4 rounded-[0.25rem] border border-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Subtotal:</span>
                <span className="text-base font-semibold text-foreground">{estimatedTotalLabel}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span className="font-bold text-xs uppercase tracking-widest">Coupon Discount:</span>
                  <span className="text-base font-semibold">− Rs. {couponDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-border pt-2">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Estimated Total:</span>
                <span className="font-serif text-2xl font-bold text-foreground text-right">{hasQuotedItem ? 'Quote on request' : `Rs. ${finalTotal.toFixed(2)}`}</span>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)} className="flex-1 rounded-[0.25rem] border-border h-12 font-bold uppercase tracking-widest text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={createOrder.isPending} className="flex-1 rounded-[0.25rem] bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 font-bold uppercase tracking-widest text-xs shadow-sm">
                {createOrder.isPending ? 'Submitting...' : 'Submit Inquiry'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[0.25rem] border-border text-center p-10 bg-background">
          <div className="w-16 h-16 bg-secondary/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="font-serif text-3xl font-bold mb-4">Inquiry Received!</h2>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
            Thank you for your interest. Our team will review your order and contact you shortly.
          </p>
          <Button onClick={() => setIsSuccessOpen(false)} className="w-full rounded-[0.25rem] bg-primary text-primary-foreground h-12 font-bold uppercase tracking-widest text-xs">
            Continue Browsing
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
