import { useState } from 'react';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function Store() {
  const { data: categories } = useListCategories();
  const { data: products, isLoading } = useListProducts();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { toast } = useToast();
  
  // Local Cart State
  const [cart, setCart] = useState<Array<{product: any, quantity: number}>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products?.filter(p => p.categoryId?.toString() === activeCategory);

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
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((total, item) => total + (parseFloat(item.product.price) * item.quantity), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Store Header */}
      <div className="bg-primary text-primary-foreground py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl lg:text-5xl font-serif mb-4">Print Store</h1>
          <p className="text-lg text-primary-foreground/70 max-w-2xl font-light">
            Browse our standard print products. Need something custom? <a href="/contact" className="text-secondary underline underline-offset-4">Get a bespoke quote</a>.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">
        {/* Categories Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-24">
            <h3 className="font-sans uppercase tracking-widest text-xs font-semibold mb-6 text-muted-foreground">Categories</h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setActiveCategory('all')}
                className={`text-left px-4 py-2 rounded-none transition-colors text-sm ${activeCategory === 'all' ? 'bg-secondary text-secondary-foreground font-medium' : 'hover:bg-muted text-foreground'}`}
              >
                All Products
              </button>
              {categories?.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className={`text-left px-4 py-2 rounded-none transition-colors text-sm ${activeCategory === cat.id.toString() ? 'bg-secondary text-secondary-foreground font-medium' : 'hover:bg-muted text-foreground'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <main className="flex-1">
          <div className="flex justify-between items-center mb-8">
            <p className="text-sm text-muted-foreground">Showing {filteredProducts?.length || 0} products</p>
            
            <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2 relative">
                  <ShoppingCart className="w-4 h-4" />
                  Inquiry Cart
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center text-[10px] font-bold">
                      {cart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-none border-border">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Your Inquiry</DialogTitle>
                </DialogHeader>
                <div className="mt-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Your cart is empty.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4">
                        {cart.map(item => (
                          <div key={item.product.id} className="flex gap-4 border-b border-border pb-4">
                            <div className="w-20 h-20 bg-muted shrink-0">
                              {item.product.imageUrl && <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{item.product.name}</h4>
                              <p className="text-sm text-muted-foreground mb-2">Rs. {item.product.price} / {item.product.priceType}</p>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center border border-border">
                                  <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-muted"><Minus className="w-3 h-3" /></button>
                                  <span className="w-8 text-center text-xs">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-muted"><Plus className="w-3 h-3" /></button>
                                </div>
                                <button onClick={() => removeFromCart(item.product.id)} className="text-destructive text-xs hover:underline flex items-center gap-1">
                                  <Trash2 className="w-3 h-3" /> Remove
                                </button>
                              </div>
                            </div>
                            <div className="text-right font-medium">
                              Rs. {(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t-2 border-primary font-serif text-xl">
                        <span>Total (Est.)</span>
                        <span>Rs. {cartTotal.toFixed(2)}</span>
                      </div>
                      <Button className="w-full rounded-none h-12 text-sm tracking-wide gap-2">
                        Submit Inquiry <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-80 bg-muted animate-pulse"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts?.map(product => (
                <Card key={product.id} className="rounded-none border-border overflow-hidden hover-elevate flex flex-col group">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">No Image</div>
                    )}
                    {product.featured && (
                      <Badge className="absolute top-3 right-3 rounded-none bg-secondary text-secondary-foreground border-none">Featured</Badge>
                    )}
                  </div>
                  <CardContent className="p-5 flex flex-col flex-1">
                    <h3 className="font-serif text-lg font-medium mb-1 line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Rs. {product.price}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">per {product.priceType}</p>
                      </div>
                      <Button onClick={() => addToCart(product)} variant="ghost" size="icon" className="rounded-none hover:bg-secondary hover:text-secondary-foreground h-10 w-10 border border-border">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}