import { useState } from 'react';
import { useListProducts, useListCategories, useCreateOrder } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle2, ArrowRight, Tag, X } from 'lucide-react';
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

export default function Store() {
  const { data: categories } = useListCategories();
  const { data: products, isLoading } = useListProducts();
  const createOrder = useCreateOrder();
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredProducts = products?.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.categoryId?.toString() === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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

  const cartTotal = cart.reduce((total, item) => total + (parseFloat(item.product.price) * item.quantity), 0);
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

    if (cart.length === 0) return;

    const orderItems = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price
    }));

    const couponNote = couponResult?.valid ? `\nCoupon: ${couponResult.code} (-Rs. ${couponDiscount.toLocaleString('en-IN')})` : '';
    const notesText = [
      orderDescription ? `Custom request: ${orderDescription}` : '',
      `Items:\n${cart.map(c => `${c.quantity}x ${c.product.name}`).join('\n')}`,
      couponNote,
    ].filter(Boolean).join('\n\n');

    createOrder.mutate({
      data: {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
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
      {/* Page Header */}
      <div className="bg-primary py-24 text-center noise relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <span className="section-label text-secondary block mb-4">OUR COLLECTION</span>
          <h1 className="text-4xl lg:text-5xl font-serif font-bold text-white mb-6">
            <span className="heading-underline">Browse Frames</span>
          </h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto font-light text-lg">
            Find the perfect frame or print product. Add items to your inquiry cart to request a customized quote.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col lg:flex-row gap-12 w-full flex-1">
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
              {categories?.map(cat => (
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
              {categories?.map(cat => (
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
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search frames..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-border rounded-[0.25rem] h-11 bg-card focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <p className="text-sm text-muted-foreground font-medium">Showing {filteredProducts?.length || 0} items</p>
              
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
                        <p className="text-sm">Add some beautiful frames to begin.</p>
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
                              <p className="text-sm text-secondary font-semibold mb-auto">Rs. {item.product.price}</p>
                              
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
                        <span className="font-serif text-3xl font-bold text-foreground">Rs. {cartTotal.toFixed(2)}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts?.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity:0, y:32 }}
                  whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }}
                  transition={{ duration:0.7, delay: (i % 6) * 0.1 }}
                >
                  <div className="card-3d group relative overflow-hidden bg-card border border-border flex flex-col h-full rounded-[0.25rem]">
                    <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                      <img 
                        src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&q=80'} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      {product.category && (
                        <Badge className="absolute top-4 right-4 rounded-none bg-background/95 text-foreground backdrop-blur-md shadow-sm font-semibold uppercase tracking-wider text-[10px] border-none">
                          {product.category.name}
                        </Badge>
                      )}
                      
                      <button 
                        onClick={(e) => { e.preventDefault(); addToCart(product); }}
                        className="absolute inset-x-0 bottom-0 bg-secondary/95 py-3 px-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out text-secondary-foreground text-sm font-bold flex items-center justify-between z-20 cursor-pointer w-full text-left border-none"
                      >
                        <span>Add to Inquiry</span>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="pt-4 pb-4 px-4 flex flex-col flex-1">
                      <h3 className="font-serif text-xl font-bold mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{product.description}</p>
                      <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                        <p className="font-bold text-foreground">Rs. {product.price}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">per {product.priceType}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>

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
                <span className="text-base font-semibold text-foreground">Rs. {cartTotal.toFixed(2)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span className="font-bold text-xs uppercase tracking-widest">Coupon Discount:</span>
                  <span className="text-base font-semibold">− Rs. {couponDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-border pt-2">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Estimated Total:</span>
                <span className="font-serif text-2xl font-bold text-foreground">Rs. {finalTotal.toFixed(2)}</span>
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
