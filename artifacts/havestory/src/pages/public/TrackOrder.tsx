import { useEffect, useState } from 'react';
import { useGetSettings, useTrackOrder } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, CheckCircle2, Clock, Copy, CreditCard, Download, ExternalLink, Eye, FileCheck, LockKeyhole, Package, Search, ShieldCheck, Truck, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { InvoicePreview } from '@/components/InvoicePreview';
import { num } from '@/lib/invoiceTypes';
import { visibleBanks } from '@workspace/api-zod';
import { FadeIn, Reveal, Stagger, StaggerItem } from '@/components/public/Reveal';

export default function TrackOrder() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const websiteBanks = visibleBanks(settings, 'website');
  const [orderId, setOrderId] = useState('');
  const [searchId, setSearchId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentType, setPaymentType] = useState<'advance' | 'full' | 'custom'>('advance');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  // Allow the order link from checkout/admin to open this page already populated.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedOrder = (params.get('id') || params.get('order') || '').trim();
    if (linkedOrder) {
      const normalizedOrderId = linkedOrder.toUpperCase();
      setOrderId(normalizedOrderId);
      setSearchId(normalizedOrderId);
    }
  }, []);

  const { data: tracking, isLoading, isError, error, refetch } = useTrackOrder(searchId, {
    query: {
      enabled: !!searchId,
      retry: false,
      queryKey: ['track-order', searchId],
    } as any,
  });

  useEffect(() => {
    if (searchId) setOrderId(searchId);
  }, [searchId]);

  useEffect(() => {
    if (isError) {
      const message = 'We could not find that order. Check the Order ID and try again.';
      setSearchError(message);
      toast({ title: 'Order not found', description: message, variant: 'destructive' });
    }
  }, [isError, toast]);

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
    if (!nextId) {
      const message = 'Please enter your Order ID.';
      setSearchError(message);
      toast({ title: 'Almost there', description: message, variant: 'destructive' });
      return;
    }
    if (nextId.length < 3) {
      const message = 'Your order ID looks a little short. Please check the confirmation message and try again.';
      setSearchError(message);
      toast({ title: 'Check your order ID', description: message, variant: 'destructive' });
      return;
    }
    setSearchError(null);
    setPaymentMessage(null);
    setPreviewMessage(null);
    setSearchId(nextId);
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
      const response = await fetch(`/api/orders/track/${encodeURIComponent((tracking as any).orderId || searchId)}/payment-proof`, { method: 'POST', body });
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
      const response = await fetch(`/api/orders/track/${encodeURIComponent((tracking as any).orderId || searchId)}/payment-confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentType, paymentAmount: amount }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not confirm payment');
      setPaymentMessage('Payment reported. The studio will verify the transfer manually before marking it paid. You can upload a proof if available.');
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
  const trackItems = Array.isArray((tracking as any)?.items) ? (tracking as any).items : [];

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

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'hv-badge-ghost';
      case 'processing':
      case 'shipped': return 'hv-badge-bronze';
      case 'delivered':
      case 'completed': return 'hv-badge-ink';
      case 'cancelled': return 'hv-badge-ghost';
      default: return 'hv-badge-bronze';
    }
  };

  return (
    <div className="hv-page">
      {/* Hero */}
      <header className="hv-page-hero">
        <div className="hv-container">
          <Reveal>
            <span className="hv-kicker">Order journey</span>
            <h1 className="hv-display hv-display-lg">
              Track your <em>order.</em>
            </h1>
            <p className="hv-lede">
              Enter the Order ID from your confirmation message and follow your piece from our studio to your wall.
            </p>
            <form onSubmit={handleSearch} className="hv-search mt-8 max-w-xl">
              <Search aria-hidden="true" />
              <input
                id="public-order-id"
                value={orderId}
                onChange={(e) => { setOrderId(e.target.value.toUpperCase()); setSearchError(null); }}
                placeholder="HS-XXXXXXXXXXXX"
                aria-label="Order ID"
              />
              <button type="submit" className="hv-btn hv-btn-solid hv-btn-sm">
                Track
              </button>
            </form>
            {searchError && (
              <div role="alert" className="mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-[#b07c3a]/40 bg-[#b07c3a]/10 px-5 py-4 text-left text-sm leading-6 text-[#6b4a1e]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b07c3a]" />
                <span>{searchError}</span>
              </div>
            )}
          </Reveal>
        </div>
        <div className="hv-hero-ornament" aria-hidden="true" />
      </header>

      {/* Results */}
      <section className="hv-section-tight">
        <div className="hv-container">
          {isLoading && (
            <div className="mx-auto max-w-md py-16 text-center">
              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-[#b07c3a] border-t-transparent" />
              <p className="hv-lede text-center">Locating your order…</p>
            </div>
          )}

          {isError && (
            <div className="hv-empty mx-auto max-w-md">
              <div className="hv-empty-icon"><AlertCircle /></div>
              <h2 className="hv-display hv-display-sm mt-2">Let’s try that again.</h2>
              <p className="hv-lede mx-auto mt-4">We couldn’t find an order matching that Order ID. Check your confirmation message and search once more.</p>
            </div>
          )}

          {tracking && (
            <FadeIn key={tracking.orderId}>
              {/* Order summary card */}
              <div className="hv-card p-6 sm:p-10">
                <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[rgba(23,19,16,0.08)] pb-7 sm:flex-row sm:items-center">
                  <div>
                    <p className="hv-kicker mb-2">Order ID</p>
                    <h2 className="hv-display hv-display-sm">{tracking.orderId}</h2>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="hv-kicker mb-2">Current status</p>
                    <div>
                      <span className={`hv-badge ${getStatusBadge(tracking.status)}`}>
                        {tracking.status}
                      </span>
                    </div>
                  </div>
                </div>

                {String(tracking.status).toLowerCase() === 'delivered' && (
                  <div className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-950">Your order has been delivered.</p>
                      <p className="mt-1 text-sm leading-6 text-emerald-800">Thank you for choosing HAVESTORY. The delivery update is recorded in your order timeline below.</p>
                    </div>
                  </div>
                )}

                <div className="mb-10 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6f6259]">Customer</p>
                    <p className="font-semibold">{tracking.customerName}</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6f6259]">Expected delivery handover</p>
                    <p className="font-semibold">{tracking.estimatedCompletion ? format(new Date(tracking.estimatedCompletion), 'MMMM d, yyyy') : 'TBD'}</p>
                  </div>
                  {tracking.courierName && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6f6259]">Courier</p>
                      <p className="font-semibold">{tracking.courierName}</p>
                    </div>
                  )}
                  {tracking.courierTrackingNumber && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#6f6259]">Tracking number</p>
                      <p className="flex flex-wrap items-center gap-3 font-semibold">
                        {tracking.courierTrackingNumber}
                        {tracking.courierTrackingUrl && (
                          <a href={tracking.courierTrackingUrl} target="_blank" rel="noreferrer" className="hv-text-link">
                            <ExternalLink /> Track shipment
                          </a>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {trackItems.length > 0 && (
                  <div className="mb-10">
                    <h3 className="hv-display hv-display-sm mb-5">Order items</h3>
                    <div className="overflow-hidden rounded-2xl border border-[rgba(23,19,16,0.08)]">
                      {trackItems.map((item: any, i: number) => (
                        <div key={item?.id ?? i} className="flex items-center justify-between gap-4 border-b border-[rgba(23,19,16,0.06)] bg-white/60 px-5 py-4 last:border-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{item?.productName || item?.name || 'HAVESTORY item'}</p>
                            <p className="mt-0.5 text-xs text-[#6f6259]">Qty {item?.quantity ?? 1}</p>
                          </div>
                          <span className="shrink-0 text-sm font-extrabold">Rs. {Number(item?.unitPrice ?? 0).toLocaleString('en-LK')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="hv-eyebrow-row mb-7">
                    <h3 className="hv-display hv-display-sm">Order timeline</h3>
                    <span className="hv-badge hv-badge-bronze">{tracking.statusHistory?.length || 0} updates</span>
                  </div>
                  {tracking.statusHistory?.length ? (
                    <Stagger className="hv-timeline">
                      {tracking.statusHistory.map((history, idx) => {
                        const Icon = getStatusIcon(history.status);
                        const isCurrent = idx === 0; // Assuming newest first
                        return (
                          <StaggerItem key={idx} className={`hv-timeline-step ${isCurrent ? 'is-current' : 'is-done'}`}>
                            <span className="hv-timeline-dot">
                              <Icon />
                            </span>
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                              <h4 className={`font-bold capitalize tracking-wide ${isCurrent ? 'text-[#171310]' : 'text-[#6f6259]'}`}>
                                {history.status}
                              </h4>
                              <span className="text-xs text-[#a89a8c]">
                                {format(new Date(history.timestamp), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            {history.note && (
                              <p className="mt-2 rounded-r-xl border-l-2 border-[#b07c3a] bg-[#f1e9da]/70 p-3 text-sm leading-6 text-[#2b241e]">
                                {history.note}
                              </p>
                            )}
                          </StaggerItem>
                        );
                      })}
                    </Stagger>
                  ) : (
                    <p className="text-sm text-[#6f6259]">Your order timeline will appear here as the studio moves your piece along.</p>
                  )}
                </div>
              </div>

              {/* Design previews */}
              {designPreviews.length > 0 && (
                <Reveal className="hv-card mt-8 overflow-hidden">
                  <div className="border-b border-[rgba(23,19,16,0.08)] px-6 py-5 sm:px-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="hv-kicker mb-2"><Eye className="h-4 w-4 text-[#b07c3a]" /> Design preview</p>
                        <h3 className="hv-display hv-display-sm">Review your design.</h3>
                        <p className="hv-lede mt-3 text-[15px]">This preview is for viewing only. The light HAVESTORY watermark protects the artwork until the order payment is approved.</p>
                      </div>
                      <ShieldCheck className="h-5 w-5 shrink-0 text-[#b07c3a]" />
                    </div>
                  </div>
                  <div className="space-y-5 p-6 sm:p-8">
                    {designPreviews.map((preview: any) => (
                      <div key={preview.id} className="overflow-hidden rounded-2xl border border-[rgba(23,19,16,0.1)]">
                        <div
                          className="relative select-none overflow-hidden bg-[#171310]"
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
                          <img src={preview.previewUrl} alt={`${preview.name} preview`} className="mx-auto block max-h-[620px] w-full object-contain" draggable={false} />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,transparent_20%,rgba(15,23,42,0.05)_100%)]">
                            <span className="rotate-[-18deg] text-4xl font-black tracking-[0.35em] text-white sm:text-6xl" style={{ opacity: Number(preview.watermarkOpacity) || 0.18 }}>{preview.watermarkText || 'HAVESTORY'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-[rgba(23,19,16,0.08)] bg-[#fffdf9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{preview.name}</p>
                            <p className="mt-1 text-xs text-[#6f6259]">Right-click and save actions are disabled for this preview.</p>
                          </div>
                          {preview.downloadEnabled && (preview.downloadUrl ? (
                            <a href={preview.downloadUrl} target="_blank" rel="noreferrer" className="hv-btn hv-btn-bronze hv-btn-sm shrink-0">
                              <Download /> Download final file
                            </a>
                          ) : (
                            <button type="button" onClick={showPaymentReminder} className="hv-btn hv-btn-ghost hv-btn-sm shrink-0">
                              <LockKeyhole /> {preview.downloadLocked ? 'Payment required' : 'Download pending'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {previewMessage && (
                      <div role="status" className="rounded-xl border border-[#b07c3a]/40 bg-[#b07c3a]/10 p-3 text-sm leading-6 text-[#6b4a1e]">
                        <div className="flex gap-2">
                          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{previewMessage}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              )}

              {/* Payment */}
              {(() => {
                const payment = tracking as any;
                const method = String(payment.paymentMethod || 'bank_transfer');
                const requiresPayment = method !== 'cod';
                const proofStatus = String(payment.paymentProofStatus || 'pending');
                const paymentStatus = String(payment.paymentStatus || 'pending');
                const invoiceTotal = Number(String(payment.invoice?.amount ?? payment.paymentAmount ?? 0).replace(/[^0-9.-]/g, '')) || 0;
                const reportedAmount = Number(payment.paymentSubmittedAmount ?? 0) || 0;
                const verifiedAmount = ['paid', 'partial', 'approved'].includes(paymentStatus) ? reportedAmount : 0;
                const balanceDue = Math.max(0, invoiceTotal - verifiedAmount);
                const invoice = payment.invoice;
                const bankRemark = /^INV-\d{6}-(\d{4})$/.exec(String(invoice?.invoiceNumber || ''))?.[1];
                const showPaymentInstructions = balanceDue > 0 && invoice?.status !== 'paid' && paymentStatus !== 'approved';
                return requiresPayment ? (
                  <Reveal className="hv-card mt-8 p-6 sm:p-10">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <p className="hv-kicker mb-2">Payment confirmation</p>
                        <h3 className="hv-display hv-display-sm">{method === 'full_payment' ? 'Full payment' : 'Bank transfer / deposit'}</h3>
                      </div>
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f1e9da] text-[#8a5f28]">
                        <CreditCard size={22} />
                      </span>
                    </div>

                    <dl className="mb-6 grid gap-3 text-sm">
                      <div className="flex justify-between gap-4 border-b border-[rgba(23,19,16,0.06)] pb-3">
                        <dt className="text-[#6f6259]">Invoice total</dt>
                        <dd className="font-extrabold">Rs. {invoiceTotal.toLocaleString('en-LK')}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[rgba(23,19,16,0.06)] pb-3">
                        <dt className="text-[#6f6259]">{verifiedAmount > 0 ? 'Amount verified' : 'Amount reported'}</dt>
                        <dd className={`font-extrabold ${verifiedAmount > 0 ? 'text-emerald-700' : 'text-[#8a5f28]'}`}>Rs. {reportedAmount.toLocaleString('en-LK')}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[rgba(23,19,16,0.06)] pb-3">
                        <dt className="text-[#6f6259]">Balance due</dt>
                        <dd className={`font-extrabold ${balanceDue > 0 ? 'text-[#8a5f28]' : 'text-emerald-700'}`}>Rs. {balanceDue.toLocaleString('en-LK')}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[rgba(23,19,16,0.06)] pb-3">
                        <dt className="text-[#6f6259]">Payment status</dt>
                        <dd className="font-extrabold capitalize">{paymentStatus.replaceAll('_', ' ')}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-[#6f6259]">Proof status</dt>
                        <dd className="font-extrabold capitalize">{proofStatus.replaceAll('_', ' ')}</dd>
                      </div>
                    </dl>

                    {showPaymentInstructions && (
                      <div className="mb-6 space-y-4">
                        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 sm:p-5">
                          <p className="text-xs font-bold uppercase tracking-wider text-red-700">Required bank remark / payment reference</p>
                          {bankRemark ? (
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <strong className="font-mono text-2xl tracking-[0.18em] text-red-700">{bankRemark}</strong>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(bankRemark);
                                    toast({ title: 'Bank remark copied' });
                                  } catch {
                                    toast({ title: 'Could not copy remark', description: 'Please enter the four digits shown.', variant: 'destructive' });
                                  }
                                }}
                                className="hv-btn hv-btn-ghost hv-btn-sm"
                              >
                                <Copy /> Copy
                              </button>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm font-semibold text-amber-900">Bank remark will appear when an invoice with a four-digit reference is attached. Contact the studio before transferring.</p>
                          )}
                          {bankRemark && (
                            <>
                              <p className="mt-3 text-sm font-semibold text-red-800">බැංකු ගෙවීමේ Remark / Reference ලෙස {bankRemark} පමණක් ඇතුළත් කරන්න.</p>
                              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">මෙම අංකය Remark එකට ඇතුළත් නොකළහොත් ගෙවීම තහවුරු කිරීමට පැය 1 සිට පැය 24 දක්වා ගත විය හැක.</p>
                            </>
                          )}
                        </div>
                        {websiteBanks.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {websiteBanks.map((bank, index) => (
                              <div key={`${bank.bankName}-${bank.accountNumber}-${index}`} className="hv-card p-4 text-sm">
                                <strong className="block">{bank.bankName}</strong>
                                <p className="mt-1 text-[#6f6259]">{bank.accountHolder}</p>
                                <p className="mt-1 font-extrabold">A/C {bank.accountNumber}</p>
                                {bank.branch && <p className="text-[#6f6259]">{bank.branch}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        {typeof (settings as any)?.paymentQrUrl === 'string' && /^(https:\/\/|\/)/.test((settings as any).paymentQrUrl) && (
                          <img src={(settings as any).paymentQrUrl} alt="Bank payment QR code" loading="lazy" className="h-40 w-40 rounded-xl border border-[rgba(23,19,16,0.12)] bg-white object-contain p-2" />
                        )}
                      </div>
                    )}

                    <div className="mb-6 rounded-2xl border border-[#b07c3a]/40 bg-[#b07c3a]/10 p-4 text-sm leading-6 text-[#6b4a1e]">
                      <div className="flex gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b07c3a]" />
                        <p>After payment, enter the amount and press confirm payment. A JPG, PNG, or PDF proof is optional; without one, the studio verifies your transfer manually. Uploaded proof is retained for 14 days.</p>
                      </div>
                    </div>

                    <div className="mb-5 rounded-2xl border border-[rgba(176,124,58,0.35)] bg-[#b07c3a]/[.06] p-4">
                      <p className="hv-kicker mb-4">What are you paying?</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="hv-field">
                          <label htmlFor="pay-type">Payment type</label>
                          <select
                            id="pay-type"
                            value={paymentType}
                            onChange={(event) => { const next = event.target.value as typeof paymentType; setPaymentType(next); if (next === 'full') setPaymentAmount(String(invoiceTotal)); }}
                            className="hv-select"
                          >
                            <option value="advance">Advance payment</option>
                            <option value="full">Full payment</option>
                            <option value="custom">Custom amount</option>
                          </select>
                        </div>
                        <div className="hv-field">
                          <label htmlFor="pay-amount">Amount paid (Rs.)</label>
                          <input
                            id="pay-amount"
                            type="number"
                            min="1"
                            step="1"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value)}
                            placeholder="Enter whole rupee amount"
                            className="hv-input"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[rgba(176,124,58,0.55)] bg-[#faf7f1] px-5 py-3 text-sm font-semibold text-[#2b241e] transition hover:border-[#b07c3a] hover:bg-[#f1e9da]">
                        <UploadCloud className="h-5 w-5 shrink-0 text-[#b07c3a]" />
                        <span className="min-w-0 flex-1 truncate">{proofFile?.name || 'Choose payment proof'}</span>
                        <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
                      </label>
                      <button type="button" onClick={uploadPaymentProof} disabled={!proofFile || paymentActionLoading} className="hv-btn hv-btn-bronze">
                        <FileCheck /> {paymentActionLoading ? 'Uploading…' : 'Upload proof'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={confirmPayment}
                      disabled={paymentActionLoading || paymentStatus === 'customer_confirmed' || paymentStatus === 'approved'}
                      className="hv-btn hv-btn-ghost mt-3 w-full"
                    >
                      <CheckCircle2 /> {paymentStatus === 'customer_confirmed' || paymentStatus === 'approved' ? 'Payment confirmation sent' : 'I have paid — confirm payment'}
                    </button>
                    {paymentMessage && <p className="mt-3 text-sm text-[#6f6259]">{paymentMessage}</p>}
                    {payment.expiresAt && <p className="mt-3 text-xs text-[#a89a8c]">Proof expiry: {format(new Date(payment.expiresAt), 'MMMM d, yyyy')}</p>}
                  </Reveal>
                ) : null;
              })()}

              {/* Digital files + invoice */}
              {(tracking.onlineDeliveryLinks?.length > 0 || tracking.invoice) && (
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  {tracking.onlineDeliveryLinks?.length > 0 && (
                    <Reveal className="hv-card p-6">
                      <h3 className="hv-display hv-display-sm mb-5">Digital files</h3>
                      <div className="space-y-3">
                        {tracking.onlineDeliveryLinks.map((link, i) => (
                          <a key={i} href={link} target="_blank" rel="noreferrer" className="hv-btn hv-btn-ghost hv-btn-sm w-full">
                            <Download /> File link {i + 1}
                          </a>
                        ))}
                      </div>
                    </Reveal>
                  )}
                  {tracking.invoice && (
                    <Reveal className="hv-card p-6" delay={0.08}>
                      <h3 className="hv-display hv-display-sm mb-5">Invoice summary</h3>
                      <div className="mb-5 space-y-2.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#6f6259]">Invoice No:</span>
                          <span className="font-bold">{tracking.invoice.invoiceNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#6f6259]">Amount:</span>
                          <span className="font-bold">Rs. {tracking.invoice.amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#6f6259]">Status:</span>
                          <span className={`font-bold capitalize ${tracking.invoice.status === 'paid' ? 'text-emerald-700' : 'text-[#8a5f28]'}`}>
                            {tracking.invoice.status}
                          </span>
                        </div>
                      </div>
                      <button type="button" className="hv-btn hv-btn-solid w-full" onClick={() => setShowInvoice(true)}>
                        <Eye /> View / Download PDF
                      </button>
                    </Reveal>
                  )}
                </div>
              )}
            </FadeIn>
          )}
        </div>
      </section>

      {showInvoice && tracking?.invoice && (() => {
        const invoice = tracking.invoice as any;
        const meta = invoice.metadata || {};
        const items = Array.isArray(meta.items) ? meta.items : [{ id: 'total', description: 'Invoice total', qty: 1, unitPrice: String(invoice.amount), notes: '' }];
        const subtotal = items.reduce((sum: number, item: any) => sum + num(item.qty) * num(item.unitPrice), 0);
        const grandTotal = num(invoice.amount);
        const shippingAmt = Math.max(0, grandTotal - subtotal);
        return <InvoicePreview
          form={meta.form || { clientName: (tracking as any).customerName, address: '', phone: '', email: '', projectTitle: '' }}
          items={items}
          shipping={(meta.shipping || 'none') as any}
          shippingCustom={meta.shippingCustom || ''}
          shippingLabelOverride={meta.shippingLabel || ''}
          courierName={meta.courierName || ''}
          advance={String(meta.advance || '0')}
          subtotal={subtotal}
          shippingAmt={shippingAmt}
          grandTotal={grandTotal}
          invoiceNumberOverride={invoice.invoiceNumber}
          createdAtOverride={invoice.createdAt ? new Date(invoice.createdAt) : undefined}
          status={invoice.status}
          linkedOrderId={(tracking as any).orderId}
          onClose={() => setShowInvoice(false)}
        />;
      })()}
    </div>
  );
}
