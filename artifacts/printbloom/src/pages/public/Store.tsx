import { useState } from 'react';
import { useListProducts, useListCategories, useCreateOrder } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, Search, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-form';

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
      // Remove items with quantity <= 0
      return updated.filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((total, item) => total + (parseFloat(item.product.price) * item.quantity), 0);

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

    const desc = orderDescription 
      ? `Custom request: ${orderDescription}\n\nItems:\n${cart.map(c => `${c.quantity}x ${c.product.name}`).join('\n')}`
      : `Items:\n${cart.map(c => `${c.quantity}x ${c.product.name}`).join('\n')}`;

    createOrder.mutate({
      data: {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress: customerAddress,
        status: 'pending',
        totalAmount: cartTotal.toString(),
        description: desc,
        items: orderItems as any // The backend might have a different type, but API expects body
      }
    }, {
      onSuccess: () => {
        setCart([]);
        setIsCheckoutOpen(false);
        setIsSuccessOpen(true);
        // Reset form
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerAddress('');
        setOrderDescription('');
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to submit order. Please try again.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Store Header */}
      <div className="bg-primary text-primary-foreground py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl lg:text-5xl font-serif font-bold mb-4">Print Store</h1>
          <p className="text-lg text-primary-foreground/80 max-w-2xl font-light leading-relaxed">
            Browse our standard print products and premium frames. Need something custom? <a href="/contact" className="text-secondary font-semibold hover:underline underline-offset-4">Get a bespoke quote</a>.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">
        {/* Categories Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-28">
            <h3 className="font-sans uppercase tracking-widest text-xs font-bold mb-6 text-foreground/50">Categories</h3>
            
            {/* Mobile Chips */}
            <div className="flex overflow-x-auto pb-4 gap-2 lg:hidden mb-6 no-scrollbar">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`whitespace-nowrap px-5 py-2 rounded-full border text-sm font-semibold transition-colors ${activeCategory === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border hover:bg-muted text-foreground'}`}
              >
                All Products
              </button>
              {categories?.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`whitespace-nowrap px-5 py-2 rounded-full border text-sm font-semibold transition-colors ${activeCategory === cat.id.toString() ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border hover:bg-muted text-foreground'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Desktop List */}
            <div className="hidden lg:flex flex-col gap-1 border-l-2 border-border/50">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`text-left px-4 py-3 transition-colors text-sm font-semibold -ml-[2px] border-l-2 ${activeCategory === 'all' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
              >
                All Products
              </button>
              {categories?.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`text-left px-4 py-3 transition-colors text-sm font-semibold -ml-[2px] border-l-2 ${activeCategory === cat.id.toString() ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Area */}
        <main className="flex-1">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search frames..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-border rounded-none h-11 bg-card focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <p className="text-sm text-muted-foreground font-medium">Showing {filteredProducts?.length || 0} items</p>
              
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="default" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 gap-2 relative h-11 px-6 shadow-sm">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="font-semibold">Cart</span>
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md bg-background border-l-border flex flex-col p-0">
                  <div className="p-6 border-b border-border bg-muted/30">
                    <SheetHeader>
                      <SheetTitle className="font-serif text-2xl">Your Inquiry Cart</SheetTitle>
                    </SheetHeader>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                          <ShoppingCart className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="font-medium text-lg text-foreground">Your cart is empty.</p>
                        <p className="text-sm">Add some beautiful frames to your cart to begin.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {cart.map(item => (
                          <div key={item.product.id} className="flex gap-4 p-4 border border-border bg-card shadow-sm group">
                            <div className="w-24 h-24 bg-muted shrink-0 overflow-hidden">
                              <img 
                                src={item.product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&q=80'} 
                                alt={item.product.name} 
                                className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                              />
                            </div>
                            <div className="flex-1 flex flex-col">
                              <h4 className="font-serif font-bold text-lg leading-tight mb-1">{item.product.name}</h4>
                              <p className="text-sm text-primary font-semibold mb-auto">Rs. {item.product.price}</p>
                              
                              <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center border border-border bg-background">
                                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <button onClick={() => removeFromCart(item.product.id)} className="w-8 h-8 flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors">
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
                        className="w-full rounded-none h-14 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold text-base tracking-wide shadow-sm"
                      >
                        Proceed to Checkout
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
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between mt-4">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="text-center py-32 border-2 border-dashed border-border bg-muted/20">
              <h3 className="font-serif text-2xl font-bold text-foreground mb-2">No frames found</h3>
              <p className="text-muted-foreground">Try adjusting your category or search filters.</p>
              <Button 
                variant="outline" 
                className="mt-6 border-primary text-primary hover:bg-primary/5"
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts?.map(product => (
                <Card key={product.id} className="rounded-none border-border overflow-hidden hover-lift flex flex-col group bg-card">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    <img 
                      src={product.imageUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&q=80'} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                    {product.category && (
                      <Badge className="absolute top-4 right-4 rounded-none bg-background/95 text-foreground backdrop-blur-md border border-border/50 shadow-sm font-semibold">
                        {product.category.name}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-6 flex flex-col flex-1">
                    <h3 className="font-serif text-xl font-bold mb-2 line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed">{product.description}</p>
                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                      <div>
                        <p className="font-bold text-lg text-foreground">Rs. {product.price}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">per {product.priceType}</p>
                      </div>
                      <Button 
                        onClick={() => addToCart(product)} 
                        className="rounded-none bg-amber-500 text-black hover:bg-amber-600 gap-2 h-10 px-4 shadow-sm font-semibold"
                      >
                        <ShoppingCart className="w-4 h-4" /> Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-none border-border p-0 overflow-hidden bg-background">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold">Complete Your Inquiry</DialogTitle>
              <DialogDescription className="text-primary-foreground/80">
                Please provide your details. We will contact you shortly to confirm the order.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">Full Name *</label>
                <Input 
                  required 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="John Doe"
                  className="rounded-none border-border focus-visible:ring-primary h-11 bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Phone Number *</label>
                <Input 
                  required 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value)} 
                  placeholder="077 123 4567"
                  className="rounded-none border-border focus-visible:ring-primary h-11 bg-muted/30"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold">Email Address</label>
              <Input 
                type="email" 
                value={customerEmail} 
                onChange={(e) => setCustomerEmail(e.target.value)} 
                placeholder="john@example.com"
                className="rounded-none border-border focus-visible:ring-primary h-11 bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Shipping Address *</label>
              <Input 
                required 
                value={customerAddress} 
                onChange={(e) => setCustomerAddress(e.target.value)} 
                placeholder="123 Main St, Colombo"
                className="rounded-none border-border focus-visible:ring-primary h-11 bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">Order Notes / Custom Requests</label>
              <textarea 
                value={orderDescription} 
                onChange={(e) => setOrderDescription(e.target.value)}
                className="flex w-full rounded-none border border-border bg-muted/30 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[100px] resize-y"
                placeholder="Any special instructions for framing?"
              />
            </div>

            <div className="bg-muted p-4 border border-border flex justify-between items-center">
              <span className="font-semibold text-muted-foreground">Order Total:</span>
              <span className="font-serif text-2xl font-bold text-foreground">Rs. {cartTotal.toFixed(2)}</span>
            </div>

            <div className="flex gap-4 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)} className="flex-1 rounded-none border-border h-12 font-semibold">
                Cancel
              </Button>
              <Button type="submit" disabled={createOrder.isPending} className="flex-1 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-bold shadow-sm">
                {createOrder.isPending ? 'Submitting...' : 'Submit Inquiry'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-none border-border text-center p-10 bg-background">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="font-serif text-3xl font-bold mb-4">Inquiry Received!</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Thank you for your interest. Our team will review your order and contact you shortly with confirmation.
          </p>
          <Button onClick={() => setIsSuccessOpen(false)} className="w-full rounded-none bg-primary text-primary-foreground h-12 font-bold text-base">
            Continue Shopping
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
