import { useEffect, useState } from 'react';
import { useTrackOrder } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle, CheckCircle2, Clock, CreditCard, Download, ExternalLink, Eye, FileCheck, LockKeyhole, Package, Phone, Search, ShieldCheck, Truck, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';

export default function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentType, setPaymentType] = useState<'advance' | 'full' | 'custom'>('advance');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Allow the order link from checkout/admin to open this page already populated.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedOrder = (params.get('id') || params.get('order') || '').trim();
    if (linkedOrder) setOrderId(linkedOrder);
  }, []);

  const { data: tracking, isLoading, isError, error, refetch } = useTrackOrder(searchId, {
    query: {
      enabled: !!searchId && !!searchPhone,
      retry: false,
      queryKey: ['track-order', searchId, searchPhone],
    } as any,
    request: { headers: { 'x-order-phone': searchPhone } },
  });

  useEffect(() => {
    if (searchId) setOrderId(searchId);
  }, [searchId]);

  useEffect(() => {
    if (isError) {
      setSearchError('We could not find that order. Check the order ID and the phone number used at checkout, then try again.');
    }
  }, [isError]);

  useEffect(() => {
    const current = tracking as any;
    if (!current) return;
    const submittedType = ['advance', 'full', 'custom'].includes(String(current.paymentType)) ? current.paymentType : 'advance';
    const submittedAmount = Number(current.paymentSubmittedAmount ?? 0) || 0;
    setPaymentType(submittedType);
    if (submittedAmount > 0) setPaymentAmount(String(submittedAmount));
  }, [tracking]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const nextId = orderId.trim();
    const nextPhone = phone.trim();
    if (!nextId || !nextPhone) {
      setSearchError('Please enter both your order ID and the phone number used at checkout.');
      return;
    }
    if (nextId.length < 3) {
      setSearchError('Your order ID looks a little short. Please check the confirmation message and try again.');
      return;
    }
    if (nextPhone.replace(/\D/g, '').length < 9) {
      setSearchError('Please enter a valid checkout phone number so we can securely find your order.');
      return;
    }
    setSearchError(null);
    setPaymentMessage(null);
    setPreviewMessage(null);
    setSearchId(nextId);
    setSearchPhone(nextPhone);
  };

  const uploadPaymentProof = async () => {
    if (!tracking || !proofFile) return;
    const amount = Number(paymentAmount);
    if (!['advance', 'full', 'custom'].includes(paymentType) || !Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage('Choose a payment type and enter the exact amount paid before uploading proof.');
      return;
    }
    setPaymentActionLoading(true);
    setPaymentMessage(null);
    try {
      const body = new FormData();
      body.append('file', proofFile);
      body.append('paymentType', paymentType);
      body.append('paymentAmount', String(amount));
      const response = await fetch(`/api/orders/track/${encodeURIComponent(tracking.orderId)}/payment-proof`, { method: 'POST', headers: { 'x-order-phone': searchPhone }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not upload payment proof');
      setProofFile(null);
      setPaymentMessage('Payment proof uploaded. The studio will review it shortly.');
      await refetch();
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Could not upload payment proof');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!tracking) return;
    const amount = Number(paymentAmount);
    if (!['advance', 'full', 'custom'].includes(paymentType) || !Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage('Choose a payment type and enter the exact amount paid.');
      return;
    }
    setPaymentActionLoading(true);
    setPaymentMessage(null);
    try {
      const response = await fetch(`/api/orders/track/${encodeURIComponent(tracking.orderId)}/payment-confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-order-phone': searchPhone }, body: JSON.stringify({ paymentType, paymentAmount: amount }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not confirm payment');
      setPaymentMessage('Payment confirmation sent. Your order will move forward after studio approval.');
      await refetch();
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Could not confirm payment');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  const showPaymentReminder = () => {
    setPreviewMessage('Download access is protected. Please complete payment and ask the studio to approve it before downloading the final design.');
  };

  const designPreviews = Array.isArray((tracking as any)?.designPreviews) ? (tracking as any).designPreviews : [];

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
            Enter your private order ID and checkout phone number to see real-time updates.
          </p>
          
          <form onSubmit={handleSearch} className="hs-track-form">
            <label className="hs-track-field" htmlFor="public-order-id">
              <Search aria-hidden="true" />
              <span className="sr-only">Order ID or tracking number</span>
              <Input id="public-order-id" value={orderId} onChange={(e) => { setOrderId(e.target.value); setSearchError(null); }} placeholder="Order ID or tracking number" aria-label="Order ID or tracking number" className="hs-track-input" />
            </label>
            <label className="hs-track-field" htmlFor="public-order-phone">
              <Phone aria-hidden="true" />
              <span className="sr-only">Checkout phone number</span>
              <Input id="public-order-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSearchError(null); }} placeholder="Checkout phone number" aria-label="Checkout phone number" className="hs-track-input" required />
            </label>
            <Button type="submit" className="hs-track-submit">
              Track
            </Button>
          </form>
          {searchError && (
            <div role="alert" className="hs-track-search-error mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 shadow-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{searchError}</span>
            </div>
          )}
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
            <p className="font-medium mb-2">Let’s try that again</p>
            <p className="text-sm">We couldn’t find an order matching those details. Please check the order ID and checkout phone number, then search again.</p>
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

                {String(tracking.status).toLowerCase() === 'delivered' && (
                  <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 sm:p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-bold">Your order has been delivered.</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-800">Thank you for choosing HAVESTORY. The delivery update is recorded in your order timeline below.</p>
                      </div>
                    </div>
                  </div>
                )}

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
                          <a href={tracking.courierTrackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary transition hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground"><ExternalLink className="h-3 w-3" /> Track shipment</a>
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

            {designPreviews.length > 0 && <Card className="hs-track-card mb-6 overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b border-border px-6 py-5 sm:px-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><Eye className="h-4 w-4 text-primary" /> Design preview</p>
                      <h3 className="font-serif text-xl">Review your design.</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">This preview is for viewing only. The light HAVESTORY watermark protects the artwork until the order payment is approved.</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                </div>
                <div className="space-y-5 p-6 sm:p-8">
                  {designPreviews.map((preview: any) => <div key={preview.id} className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                    <div
                      className="relative select-none overflow-hidden bg-slate-900"
                      tabIndex={0}
                      onContextMenu={(event) => { event.preventDefault(); showPaymentReminder(); }}
                      onDragStart={(event) => { event.preventDefault(); showPaymentReminder(); }}
                      onCopy={(event) => { event.preventDefault(); showPaymentReminder(); }}
                      onKeyDown={(event) => {
                        if (event.key === 'PrintScreen' || ((event.ctrlKey || event.metaKey) && ['c', 's', 'p'].includes(event.key.toLowerCase()))) {
                          event.preventDefault();
                          showPaymentReminder();
                        }
                      }}
                    >
                      <img src={preview.previewUrl} alt={`${preview.name} preview`} className="block max-h-[620px] w-full object-contain" draggable={false} />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,transparent_20%,rgba(15,23,42,0.05)_100%)]">
                        <span className="rotate-[-18deg] text-4xl font-black tracking-[0.35em] text-white sm:text-6xl" style={{ opacity: Number(preview.watermarkOpacity) || 0.18 }}>{preview.watermarkText || 'HAVESTORY'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{preview.name}</p><p className="mt-1 text-xs text-muted-foreground">Right-click and save actions are disabled for this preview.</p></div>
                      {preview.downloadEnabled && (preview.downloadUrl ? <Button type="button" asChild className="h-11 shrink-0 rounded-xl"><a href={preview.downloadUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" /> Download final file</a></Button> : <Button type="button" variant="outline" onClick={showPaymentReminder} className="h-11 shrink-0 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50"><LockKeyhole className="mr-2 h-4 w-4" /> {preview.downloadLocked ? 'Payment required' : 'Download pending'}</Button>)}
                    </div>
                  </div>)}
                  {previewMessage && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"><div className="flex gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><span>{previewMessage}</span></div></div>}
                </div>
              </CardContent>
            </Card>}

            {(() => {
              const payment = tracking as any;
              const method = String(payment.paymentMethod || 'bank_transfer');
              const requiresPayment = method !== 'cod';
              const proofStatus = String(payment.paymentProofStatus || 'pending');
              const paymentStatus = String(payment.paymentStatus || 'pending');
              const invoiceTotal = Number(String(payment.invoice?.amount ?? payment.paymentAmount ?? 0).replace(/[^0-9.-]/g, '')) || 0;
              const paidAmount = Number(payment.paymentSubmittedAmount ?? 0) || 0;
              const balanceDue = Math.max(0, invoiceTotal - paidAmount);
              return requiresPayment ? (
                <Card className="hs-track-card mb-6">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Payment confirmation</p>
                        <h3 className="font-serif text-xl">{method === 'full_payment' ? 'Full payment' : 'Bank transfer / deposit'}</h3>
                      </div>
                      <CreditCard className="h-5 w-5 text-primary shrink-0" />
                    </div>
                    <div className="grid gap-2 text-sm mb-5">
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Invoice total</span><strong>Rs. {invoiceTotal.toLocaleString('en-LK')}</strong></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Amount paid</span><strong className="text-emerald-700">Rs. {paidAmount.toLocaleString('en-LK')}</strong></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Balance due</span><strong className={balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}>Rs. {balanceDue.toLocaleString('en-LK')}</strong></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Payment status</span><strong className="capitalize">{paymentStatus.replaceAll('_', ' ')}</strong></div>
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Proof status</span><strong className="capitalize">{proofStatus.replaceAll('_', ' ')}</strong></div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-5">
                      <div className="flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><p>After payment, upload a JPG, PNG, or PDF proof and press confirm payment. Uploaded proof is retained for 14 days and then permanently deleted.</p></div>
                    </div>
                    <div className="mb-4 rounded-2xl border border-primary/10 bg-primary/5 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">What are you paying?</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">Payment type<select value={paymentType} onChange={(event) => { const next = event.target.value as typeof paymentType; setPaymentType(next); if (next === 'full') setPaymentAmount(String(invoiceTotal)); }} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground"><option value="advance">Advance payment</option><option value="full">Full payment</option><option value="custom">Custom amount</option></select></label>
                        <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">Amount paid (Rs.)<Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Enter exact amount" className="mt-1 h-11 rounded-xl bg-background text-sm font-semibold" /></label>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted/40">
                        <UploadCloud className="h-4 w-4 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{proofFile?.name || 'Choose payment proof'}</span>
                        <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
                      </label>
                      <Button type="button" onClick={uploadPaymentProof} disabled={!proofFile || paymentActionLoading} className="h-12 rounded-xl">
                        <FileCheck className="h-4 w-4 mr-2" /> Upload proof
                      </Button>
                    </div>
                    <Button type="button" variant="outline" onClick={confirmPayment} disabled={paymentActionLoading || paymentStatus === 'customer_confirmed' || paymentStatus === 'approved'} className="mt-3 w-full h-12 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> {paymentStatus === 'customer_confirmed' || paymentStatus === 'approved' ? 'Payment confirmation sent' : 'I have paid — confirm payment'}
                    </Button>
                    {paymentMessage && <p className="mt-3 text-sm text-muted-foreground">{paymentMessage}</p>}
                    {payment.expiresAt && <p className="mt-3 text-xs text-muted-foreground">Proof expiry: {format(new Date(payment.expiresAt), 'MMMM d, yyyy')}</p>}
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {(tracking.onlineDeliveryLinks?.length > 0 || tracking.invoice) && (
              <div className="grid sm:grid-cols-2 gap-6">
                {tracking.onlineDeliveryLinks?.length > 0 && (
                  <Card className="hs-track-card">
                    <CardContent className="p-6">
                      <h3 className="font-serif text-lg mb-4">Digital Files</h3>
                      <div className="space-y-3">
                        {tracking.onlineDeliveryLinks.map((link, i) => (
                          <Button key={i} variant="outline" asChild className="hs-track-file-link w-full justify-start">
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
