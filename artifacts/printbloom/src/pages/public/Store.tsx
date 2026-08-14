import { useState } from 'react';
import { useListProducts, useListCategories, useCreateOrder } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle2, ArrowRight, Tag, X, Sparkles, ShieldCheck, Clock3, Ruler, Heart, Star, MessageCircle, Eye, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Premium collection hero */}
      <div className="editorial-hero relative overflow-hidden noise">
        <div className="editorial-orb -right-24 -top-32" />
        <div className="absolute bottom-10 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-24">
          <div>
            <div className="mb-6"><span className="editorial-kicker">The HAVESTORY Edit</span></div>
            <h1 className="editorial-display max-w-3xl text-5xl leading-[0.92] text-white sm:text-6xl lg:text-8xl">Objects made<br /><span className="text-gradient italic">to hold meaning.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-primary-foreground/70 sm:text-lg">Choose a frame, build a collection, and let our studio turn your favourite moments into something you will want to keep close.</p>
            <div className="mt-9 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75"><Sparkles size={13} className="text-secondary" /> Made to order</span><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75"><ShieldCheck size={13} className="text-secondary" /> Studio quality</span></div>
          </div>
          <div className="store-toolbar grid grid-cols-2 gap-px overflow-hidden rounded-2xl text-white/80 sm:grid-cols-4 lg:grid-cols-2">
            {[['48h', 'express options', Clock3], ['1:1', 'design guidance', Ruler], ['5.0', 'client rating', Star], ['Island-wide', 'delivery', Heart]].map(([value, label, Icon]) => <div key={label as string} className="min-w-[125px] bg-black/20 p-4 backdrop-blur">{(() => { const StatIcon = Icon as typeof ShieldCheck; return <StatIcon size={15} className="mb-5 text-secondary" />; })()}<div className="text-lg font-bold text-white">{value as string}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{label as string}</div></div>)}
          </div>
        </div>
      </div>
      <div className="border-b border-border bg-card/60"><div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border px-6 sm:grid-cols-4 lg:px-10"><div className="flex items-center gap-3 px-3 py-4 text-xs font-semibold text-muted-foreground"><ShieldCheck size={16} className="text-secondary" /> Secure packaging</div><div className="flex items-center gap-3 px-3 py-4 text-xs font-semibold text-muted-foreground"><Ruler size={16} className="text-secondary" /> Custom sizing</div><div className="hidden items-center gap-3 px-3 py-4 text-xs font-semibold text-muted-foreground sm:flex"><MessageCircle size={16} className="text-secondary" /> Friendly guidance</div><div className="hidden items-center gap-3 px-3 py-4 text-xs font-semibold text-muted-foreground sm:flex"><Heart size={16} className="text-secondary" /> Made with care</div></div></div>

      <section className="border-b border-border bg-background px-6 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="section-label mb-3">Choose your starting point</p>
              <h2 className="editorial-display max-w-2xl text-3xl text-foreground sm:text-5xl">Three ways to make a moment <span className="text-gradient italic">feel permanent.</span></h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">A considered collection for homes, gifts, studios and the stories that do not fit neatly into a catalogue.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: '01 / Ready to choose', title: 'Browse the collection', copy: 'Frames and prints with clear pricing and a simple inquiry checkout.', href: '#collection', image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=900&q=82' },
              { label: '02 / Made around you', title: 'Build a custom story', copy: 'Share your size, finish and idea. We will shape the right piece with you.', href: '/custom-project', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=900&q=82' },
              { label: '03 / For your studio', title: 'Work with HAVESTORY', copy: 'Portraits, product imagery and print-ready studio services for brands and people.', href: '/services', image: 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=900&q=82' },
            ].map((route, index) => (
              <Link key={route.label} href={route.href} className="group relative min-h-[18rem] overflow-hidden border border-border bg-card">
                <img src={route.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
                <div className="relative flex min-h-[18rem] flex-col justify-end p-6">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">{route.label}</span>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-white">{route.title}</h3>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/70">{route.copy}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Explore <ArrowUpRight size={14} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div id="collection" className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-6 py-16 lg:flex-row lg:px-10">
        <div className="editorial-rule absolute left-0 right-0" aria-hidden="true" />
        {/* Categories Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-28">
            <h3 className="section-label mb-6 text-muted-foreground">Categories</h3>
            
            <div className="flex overflow-x-auto pb-4 gap-2 lg:hidden mb-6 no-scrollbar">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-[0.25rem] border text-xs font-semibold uppercase tracking-wider transition-colors ${activeCategory === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border hover:bg-muted text-foreground'}`}
              >
                All Products
              </button>
              {categoryList.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-[0.25rem] border text-xs font-semibold uppercase tracking-wider transition-colors ${activeCategory === cat.id.toString() ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border hover:bg-muted text-foreground'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="hidden lg:flex flex-col gap-1 border-l border-border/50 pl-4">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`text-left py-2 transition-colors text-sm font-semibold uppercase tracking-wide ${activeCategory === 'all' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All Products
              </button>
              {categoryList.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`text-left py-2 transition-colors text-sm font-semibold uppercase tracking-wide ${activeCategory === cat.id.toString() ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Area */}
        <main className="flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:max-w-md">
              <div className="flex items-center justify-between gap-3"><div><span className="editorial-kicker">The collection</span><h2 className="mt-2 editorial-display text-3xl text-foreground sm:text-4xl">Find your frame.</h2></div><SlidersHorizontal size={18} className="text-secondary sm:hidden" /></div>
              <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search frames..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-border rounded-[0.25rem] h-11 bg-card focus-visible:ring-primary focus-visible:border-primary"
              />
              </div>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-3">
                <span className="store-number">{String(sortedProducts.length).padStart(2, '0')} / {String(productList.length).padStart(2, '0')} objects</span>
                <select value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)} className="h-10 rounded-full border border-border bg-card px-4 text-xs font-bold uppercase tracking-[0.12em] text-foreground outline-none transition-colors focus:border-secondary">
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low</option>
                  <option value="price-high">Price: High</option>
                </select>
              </div>
              
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="default" className="rounded-[0.25rem] bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2 relative h-11 px-6 shadow-sm font-bold uppercase tracking-wider text-xs border-none">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Inquiry Cart</span>
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm border-2 border-background">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md bg-background border-l-border flex flex-col p-0 rounded-l-[0.25rem]">
                  <div className="p-6 border-b border-border bg-primary text-primary-foreground">
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
                          <div key={item.product.id} className="flex gap-4 p-4 border border-border bg-card shadow-sm rounded-[0.25rem]">
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
                    <div className="p-6 border-t border-border bg-card mt-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {sortedProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity:0, y:32 }}
                  whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }}
                  transition={{ duration:0.7, delay: (i % 6) * 0.1 }}
                >
                  <div className="store-product-card group flex h-full flex-col rounded-2xl">
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
                      {product.category && (
                        <Badge className="absolute bottom-4 left-4 z-10 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                          {product.category.name}
                        </Badge>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); addToCart(product); }}
                        className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-full border border-secondary/50 bg-secondary px-5 py-3 text-left text-xs font-black uppercase tracking-[0.14em] text-secondary-foreground shadow-lg transition-all duration-300 ease-out md:translate-y-20 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
                      >
                        <span>Add to inquiry</span>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-1 flex-col px-5 pb-5 pt-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="store-number">{product.category?.name || 'HANDCRAFTED EDIT'}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Ready to make</span>
                      </div>
                      <h3 className="editorial-display line-clamp-1 text-2xl font-bold text-foreground">{product.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description || 'A considered piece, finished by hand in our studio.'}</p>
                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/70 pt-5">
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
        <div className="fixed inset-x-4 bottom-5 z-40 mx-auto max-w-2xl animate-in slide-in-from-bottom-4 sm:inset-x-auto">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-secondary/30 bg-primary/95 px-4 py-3 text-primary-foreground shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><ShoppingCart size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-bold">{cart.reduce((a, b) => a + b.quantity, 0)} {cart.reduce((a, b) => a + b.quantity, 0) === 1 ? 'piece' : 'pieces'} selected</div><div className="text-[10px] uppercase tracking-[0.16em] text-primary-foreground/55">Estimated {estimatedTotalLabel}</div></div></div>
            <Button onClick={() => setIsCheckoutOpen(true)} className="shrink-0 rounded-xl bg-secondary px-4 text-xs font-bold uppercase tracking-wider text-secondary-foreground hover:bg-secondary/90">Start order <ArrowRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* Quick view dialog */}
      <Dialog open={Boolean(quickViewProduct)} onOpenChange={(open) => !open && setQuickViewProduct(null)}>
        <DialogContent className="overflow-hidden rounded-2xl border-border bg-background p-0 sm:max-w-3xl">
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
        <DialogContent className="sm:max-w-[600px] rounded-[0.25rem] border-border p-0 overflow-hidden bg-background">
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
