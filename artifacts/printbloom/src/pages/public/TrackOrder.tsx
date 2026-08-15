import { useState } from 'react';
import { useTrackOrder } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [searchId, setSearchId] = useState('');
  
  // Use enabled: false initially, trigger refetch manually or use queryKey based on searchId
  const { data: tracking, isLoading, isError, error } = useTrackOrder(searchId, {
    query: {
      enabled: !!searchId,
      retry: false
    } as any
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim()) {
      setSearchId(orderId.trim());
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return Clock;
      case 'processing': return Package;
      case 'shipped': return Truck;
      case 'delivered': 
      case 'completed': return CheckCircle;
      default: return Package;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'text-amber-500 bg-amber-50';
      case 'processing': return 'text-blue-500 bg-blue-50';
      case 'shipped': return 'text-indigo-500 bg-indigo-50';
      case 'delivered': 
      case 'completed': return 'text-green-500 bg-green-50';
      case 'cancelled': return 'text-red-500 bg-red-50';
      default: return 'text-primary bg-primary/10';
    }
  };

  return (
    <div className="hs-track-page">
      <section className="hs-track-hero">
        <div className="hs-track-hero-inner">
          <span>ORDER JOURNEY</span>
          <h1>Track your order.</h1>
          <p>
            Enter your order ID below to see real-time updates on your project's progress.
          </p>
          
          <form onSubmit={handleSearch} className="hs-track-form">
            <div className="hs-track-field">
              <Search aria-hidden="true" />
              <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="e.g. ORD-12345" aria-label="Order ID" className="hs-track-input" />
            </div>
            <Button type="submit" className="hs-track-submit">
              Track
            </Button>
          </form>
        </div>
      </section>

      <div className="hs-track-results">
        {isLoading && (
          <div className="hs-track-state">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Locating your order...</p>
          </div>
        )}

        {isError && (
          <div className="hs-track-state hs-track-error">
            <p className="font-medium mb-2">Order Not Found</p>
            <p className="text-sm">We couldn't find an order matching "{searchId}". Please check your order ID and try again.</p>
          </div>
        )}

        {tracking && (
          <div className="hs-track-details animate-in fade-in slide-in-from-bottom-4">
            <Card className="hs-track-card">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Order ID</p>
                    <h2 className="text-2xl font-serif font-medium">{tracking.orderId}</h2>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Current Status</p>
                    <span className={`inline-flex px-3 py-1 text-xs font-bold uppercase tracking-wider ${getStatusColor(tracking.status)}`}>
                      {tracking.status}
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 mb-8">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Customer</p>
                    <p className="font-medium">{tracking.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Estimated Completion</p>
                    <p className="font-medium">{tracking.estimatedCompletion ? format(new Date(tracking.estimatedCompletion), 'MMMM d, yyyy') : 'TBD'}</p>
                  </div>
                  {tracking.courierName && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Courier</p>
                      <p className="font-medium">{tracking.courierName}</p>
                    </div>
                  )}
                  {tracking.courierTrackingNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tracking Number</p>
                      <p className="font-medium flex items-center gap-2">
                        {tracking.courierTrackingNumber}
                        {tracking.courierTrackingUrl && (
                          <a href={tracking.courierTrackingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Track &rarr;</a>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-serif text-xl mb-6">Order Timeline</h3>
                  <div className="relative border-l-2 border-border ml-3 sm:ml-4 space-y-8">
                    {tracking.statusHistory?.map((history, idx) => {
                      const Icon = getStatusIcon(history.status);
                      const isLast = idx === 0; // Assuming newest first
                      return (
                        <div key={idx} className="relative pl-8 sm:pl-10">
                          <div className={`absolute -left-[17px] top-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 ${isLast ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                              <h4 className={`font-semibold capitalize tracking-wide ${isLast ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {history.status}
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(history.timestamp), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            {history.note && (
                              <p className="text-sm text-muted-foreground mt-2 bg-muted/30 p-3 border-l-2 border-primary/20">
                                {history.note}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {(tracking.onlineDeliveryLinks?.length > 0 || tracking.invoice) && (
              <div className="grid sm:grid-cols-2 gap-6">
                {tracking.onlineDeliveryLinks?.length > 0 && (
                  <Card className="hs-track-card">
                    <CardContent className="p-6">
                      <h3 className="font-serif text-lg mb-4">Digital Files</h3>
                      <div className="space-y-3">
                        {tracking.onlineDeliveryLinks.map((link, i) => (
                          <Button key={i} variant="outline" asChild className="w-full justify-start rounded-none">
                            <a href={link} target="_blank" rel="noreferrer">
                              File Link {i + 1}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {tracking.invoice && (
                  <Card className="hs-track-card">
                    <CardContent className="p-6">
                      <h3 className="font-serif text-lg mb-4">Invoice Summary</h3>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Invoice No:</span>
                          <span className="font-medium">{tracking.invoice.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">Rs. {tracking.invoice.amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Status:</span>
                          <span className={`font-medium capitalize ${tracking.invoice.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                            {tracking.invoice.status}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
