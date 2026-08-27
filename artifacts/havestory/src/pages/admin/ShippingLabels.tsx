import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { captureElement } from '@/lib/html2canvas-capture';
import { AlertTriangle, ArrowUp, CalendarDays, CheckCircle2, Download, Droplets, FileText, Package2, Printer, RotateCcw, Save, Search, ShieldCheck, Truck, User, Zap } from 'lucide-react';
import { useGetSettings, useListOrders } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type LabelSize = 'standard' | 'a5';
type LabelForm = {
  recipientName: string; phone: string; alternatePhone: string; address: string;
  city: string; district: string; postalCode: string; deliveryNotes: string;
  orderNumber: string; courierService: string; deliveryDate: string; deliveryTime: string;
  urgent: boolean; fragile: boolean; handleWithCare: boolean; thisSideUp: boolean; keepDry: boolean;
  labelSize: LabelSize;
};
type LabelSettings = {
  senderName: string; senderPhone: string; senderWhatsapp: string; senderAddress: string;
  footerText: string; defaultSize: LabelSize; showQr?: boolean; showBarcode?: boolean;
};

const EMPTY_FORM: LabelForm = {
  recipientName: '', phone: '', alternatePhone: '', address: '', city: '', district: '', postalCode: '',
  deliveryNotes: '', orderNumber: '', courierService: '', deliveryDate: '', deliveryTime: '',
  urgent: false, fragile: false, handleWithCare: false, thisSideUp: false, keepDry: false, labelSize: 'standard',
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error ?? message; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function VerificationCode({ url, size }: { url: string; size: number }) {
  const token = url.split('/').filter(Boolean).pop() || '';
  const code = token.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase() || 'PENDING';
  return (
    <div style={{ width: size, minHeight: size, display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 4, border: '1px solid #cdbbd4', borderRadius: 8, background: '#faf6fc', padding: 6, textAlign: 'center' }}>
      <ShieldCheck aria-hidden="true" style={{ width: size * .28, height: size * .28, color: '#4c2370' }} />
      <span style={{ color: '#4c2370', fontFamily: 'monospace', fontSize: Math.max(6, size * .09), fontWeight: 900, letterSpacing: .7, overflowWrap: 'anywhere' }}>{code}</span>
    </div>
  );
}

function Barcode({ value }: { value: string }) {
  const seed = Array.from(value || 'HAVESTORY').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const stops = Array.from({ length: 64 }, (_, index) => {
    const left = index * 1.58;
    const width = ((seed + index * 13) % 3) * .38 + .32;
    return `#111 ${left}% ${Math.min(100, left + width)}%,transparent ${Math.min(100, left + width)}% ${Math.min(100, left + 1.2)}%`;
  }).join(',');
  return <div style={{ width: '100%' }}><div aria-hidden="true" style={{ height: 38, background: `linear-gradient(90deg,${stops})` }} /><div style={{ marginTop: 3, textAlign: 'center', fontFamily: 'monospace', fontSize: 7, fontWeight: 800, letterSpacing: 1.2 }}>{value}</div></div>;
}

function LabelPreview({ form, sender, qrUrl, showQr, showBarcode }: {
  form: LabelForm;
  sender: { name: string; phone: string; whatsapp: string; address: string; website: string; logo: string; footer: string };
  qrUrl: string; showQr: boolean; showBarcode: boolean;
}) {
  const isA5 = form.labelSize === 'a5';
  const marks = [
    form.urgent && ['⚡', 'URGENT'], form.fragile && ['◇', 'FRAGILE'],
    form.handleWithCare && ['✋', 'HANDLE WITH CARE'], form.thisSideUp && ['↑', 'THIS SIDE UP'],
    form.keepDry && ['☂', 'KEEP DRY'],
  ].filter(Boolean) as string[][];
  return (
    <div className="label-print-target" style={{ width: isA5 ? 559 : 378, minHeight: isA5 ? 794 : 560, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #ddd5df', background: '#fff', color: '#151019', fontFamily: 'Arial,sans-serif', fontSize: 12, boxShadow: '0 26px 70px rgba(35,20,43,.2)' }}>
      <div style={{ height: 7, background: 'linear-gradient(90deg,#4c2370,#8c4ba7,#c49a4a)' }} />
      <header style={{ padding: isA5 ? '18px 20px 15px' : '13px 15px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottom: '1px solid #ddd5df' }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: isA5 ? 48 : 38, height: isA5 ? 48 : 38, flex: '0 0 auto', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '1px solid #d8c2e1', borderRadius: 12, background: '#f7f0fb', color: '#4c2370', fontFamily: 'Georgia,serif', fontWeight: 900 }}>{sender.logo ? <img crossOrigin="anonymous" src={sender.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : 'HS'}</div>
          <div><div style={{ fontSize: isA5 ? 20 : 15, fontWeight: 900, letterSpacing: .5 }}>{sender.name}</div>{sender.phone && <div style={{ marginTop: 3, fontSize: isA5 ? 11 : 9, fontWeight: 700 }}>☎ {sender.phone}</div>}</div>
        </div>
        <div style={{ textAlign: 'right' }}><div style={{ color: '#7e6b84', fontSize: 7, fontWeight: 900, letterSpacing: 1.2 }}>ORDER NUMBER</div><div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: isA5 ? 13 : 10, fontWeight: 900 }}>{form.orderNumber || 'NOT LINKED'}</div></div>
      </header>
      {marks.length > 0 && <div style={{ padding: isA5 ? '10px 20px' : '7px 15px', display: 'flex', flexWrap: 'wrap', gap: 5, borderBottom: '1px solid #eadff0', background: '#fbf7fd' }}>{marks.map(([icon, label]) => <span key={label} style={{ padding: '4px 7px', display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #cfaadd', borderRadius: 999, background: '#fff', color: '#4c2370', fontSize: 7, fontWeight: 900, letterSpacing: .65 }}>{icon} {label}</span>)}</div>}
      <main style={{ padding: isA5 ? '24px 20px 14px' : '17px 15px 10px', flex: 1 }}>
        <div style={{ color: '#8a768f', fontSize: 8, fontWeight: 900, letterSpacing: 1.4 }}>DELIVER TO</div>
        <div style={{ marginTop: 7, fontSize: isA5 ? 29 : 21, fontWeight: 950, lineHeight: 1.08 }}>{form.recipientName || 'Recipient name'}</div>
        <div style={{ marginTop: 10, display: 'grid', gap: 5 }}>{form.phone && <div style={{ fontSize: isA5 ? 15 : 12, fontWeight: 900 }}>☎ {form.phone}{form.alternatePhone ? ` / ${form.alternatePhone}` : ''}</div>}<div style={{ maxWidth: isA5 ? 440 : 300, fontSize: isA5 ? 15 : 12, fontWeight: 700, lineHeight: 1.48 }}>{form.address || 'Delivery address'}{(form.city || form.district || form.postalCode) && <><br />{[form.city, form.district, form.postalCode].filter(Boolean).join(', ')}</>}</div></div>
        {(form.courierService || form.deliveryDate || form.deliveryTime) && <div style={{ marginTop: 15, padding: '9px 10px', display: 'flex', flexWrap: 'wrap', gap: 8, border: '1px solid #e5d7eb', borderRadius: 8, background: '#faf6fc', color: '#4c3d52', fontSize: isA5 ? 10 : 8, fontWeight: 800 }}>{form.courierService && <span>COURIER · {form.courierService}</span>}{form.deliveryDate && <span>DATE · {form.deliveryDate}</span>}{form.deliveryTime && <span>TIME · {form.deliveryTime}</span>}</div>}
        {form.deliveryNotes && <div style={{ marginTop: 10, padding: '8px 10px', borderLeft: '3px solid #c49a4a', background: '#fff8e7', color: '#5b4216', fontSize: isA5 ? 10 : 8, fontWeight: 700, lineHeight: 1.45 }}><b>DELIVERY NOTE:</b> {form.deliveryNotes}</div>}
      </main>
      {showBarcode && form.orderNumber && <div style={{ padding: isA5 ? '0 20px 13px' : '0 15px 9px' }}><Barcode value={form.orderNumber} /></div>}
      <footer style={{ padding: isA5 ? '13px 20px' : '9px 15px', display: 'grid', gridTemplateColumns: qrUrl && showQr ? '1fr auto' : '1fr', alignItems: 'end', gap: 13, borderTop: '1px solid #1e1722' }}>
        <div><div style={{ fontSize: isA5 ? 10 : 8, fontWeight: 950, letterSpacing: .8 }}>{sender.footer}</div>{sender.whatsapp && <div style={{ marginTop: 4, fontSize: isA5 ? 10 : 8, fontWeight: 700 }}>WhatsApp {sender.whatsapp}</div>}{sender.website && <div style={{ marginTop: 3, color: '#72577d', fontSize: isA5 ? 9 : 7 }}>{sender.website}</div>}{sender.address && <div style={{ marginTop: 3, color: '#8a7e8d', fontSize: isA5 ? 8 : 6.5 }}>{sender.address}</div>}</div>
        {qrUrl && showQr && <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}><VerificationCode url={qrUrl} size={isA5 ? 88 : 64} /><span style={{ color: '#786b7d', fontSize: 6, fontWeight: 800 }}>SECURE VERIFICATION</span></div>}
      </footer>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 ${className}`}><span className="text-[10px] font-black uppercase tracking-[.13em] text-slate-500">{label}</span>{children}</label>;
}

export default function ShippingLabels() {
  const { toast } = useToast();
  const { data: siteSettings } = useGetSettings();
  const { data: orders = [], isLoading: ordersLoading } = useListOrders({}, { query: { staleTime: 15_000, refetchOnWindowFocus: false } as any });
  const [form, setForm] = useState<LabelForm>(EMPTY_FORM);
  const [lookupPhone, setLookupPhone] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderMenuOpen, setOrderMenuOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const autoLoaded = useRef(false);
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({ senderName: '', senderPhone: '', senderWhatsapp: '', senderAddress: '', footerText: 'Thank you for choosing HAVESTORY', defaultSize: 'standard', showQr: true, showBarcode: true });
  const { data: settings } = useQuery<LabelSettings>({ queryKey: ['shipping-label-settings'], queryFn: () => apiFetch('/api/shipping-labels/settings') });

  useEffect(() => { if (settings) { setLabelSettings((current) => ({ ...current, ...settings })); setForm((current) => ({ ...current, labelSize: settings.defaultSize || 'standard' })); } }, [settings]);
  const orderList = Array.isArray(orders) ? orders as any[] : [];
  const filteredOrders = useMemo(() => { const query = orderQuery.trim().toLowerCase(); return orderList.filter((order) => !query || [order.orderId, order.customerName, order.customerPhone].some((value) => String(value || '').toLowerCase().includes(query))).slice(0, 8); }, [orderList, orderQuery]);
  const sender = {
    name: labelSettings.senderName || (siteSettings as any)?.businessName || 'HAVESTORY',
    phone: labelSettings.senderPhone || (siteSettings as any)?.phone || '',
    whatsapp: labelSettings.senderWhatsapp || (siteSettings as any)?.whatsapp || '',
    address: labelSettings.senderAddress || (siteSettings as any)?.address || '',
    website: String((siteSettings as any)?.website || window.location.host).replace(/^https?:\/\//, '').replace(/\/$/, ''),
    logo: (siteSettings as any)?.logoUrl || '',
    footer: labelSettings.footerText || 'Thank you for choosing HAVESTORY',
  };

  const lookupMut = useMutation({
    mutationFn: (phone: string) => apiFetch<{ clientId: number; details: any } | null>(`/api/shipping-labels/client-details?phone=${encodeURIComponent(phone)}`),
    onSuccess: (data) => {
      if (!data) { setClientId(null); toast({ title: 'Customer profile not found', description: 'Order details are still ready to use.' }); return; }
      setClientId(data.clientId); setDetailsSaved(false);
      setForm((current) => ({ ...current, recipientName: data.details.recipientName || current.recipientName, phone: data.details.phone || current.phone, alternatePhone: data.details.alternatePhone || current.alternatePhone, address: data.details.address || current.address, city: data.details.city || current.city, district: data.details.district || current.district, postalCode: data.details.postalCode || current.postalCode, deliveryNotes: data.details.deliveryNotes || current.deliveryNotes }));
    },
    onError: () => toast({ title: 'Customer lookup failed', variant: 'destructive' }),
  });
  const saveDetailsMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/shipping-labels/client-details/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientName: form.recipientName, phone: form.phone, alternatePhone: form.alternatePhone, address: form.address, city: form.city, district: form.district, postalCode: form.postalCode, deliveryNotes: form.deliveryNotes }) }),
    onSuccess: () => { setDetailsSaved(true); toast({ title: 'Customer shipping details saved' }); },
    onError: (error: any) => toast({ title: 'Save failed', description: error.message, variant: 'destructive' }),
  });
  const tokenMut = useMutation({
    mutationFn: (orderId: string) => apiFetch<{ token: string }>('/api/shipping-labels/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) }),
    onSuccess: (data) => { const base = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, ''); setQrUrl(`${base}/verify-shipping/${data.token}`); },
    onError: (error: any) => toast({ title: 'Verification code unavailable', description: error.message, variant: 'destructive' }),
  });

  const applyOrder = (order: any) => {
    const orderId = String(order.orderId || order.id || '');
    const phone = String(order.customerPhone || '');
    setSelectedOrderId(Number(order.id) || null); setOrderQuery(orderId); setOrderMenuOpen(false); setLookupPhone(phone); setClientId(null); setDetailsSaved(false);
    setForm((current) => ({ ...current, recipientName: order.customerName || '', phone, alternatePhone: '', address: order.customerAddress || '', orderNumber: orderId, courierService: order.courierName || String(order.deliveryMethod || order.shippingMethod || '').replaceAll('_', ' '), deliveryNotes: '' }));
    if (phone) lookupMut.mutate(phone);
    if (orderId) tokenMut.mutate(orderId);
    toast({ title: 'Order linked', description: `${orderId} details loaded into the label.` });
  };
  useEffect(() => {
    if (autoLoaded.current || !orderList.length) return;
    const requested = new URLSearchParams(window.location.search).get('orderId');
    if (!requested) return;
    const order = orderList.find((item) => String(item.orderId) === requested || String(item.id) === requested);
    if (order) { autoLoaded.current = true; applyOrder(order); }
  }, [orderList.length]);

  const missingRequired = !form.recipientName.trim() || !form.phone.trim() || !form.address.trim();
  const ensureReady = () => { if (!missingRequired) return true; toast({ title: 'Complete delivery details', description: 'Recipient name, phone number and address are required.', variant: 'destructive' }); return false; };
  function handlePrint() {
    if (!ensureReady()) return;
    if (clientId !== null) saveDetailsMut.mutate(clientId);
    const label = document.querySelector('.label-print-target');
    if (!label) return;
    const isA5 = form.labelSize === 'a5';
    const pageWidth = isA5 ? '148mm' : '100mm'; const pageHeight = isA5 ? '210mm' : '148mm';
    const win = window.open('', '_blank', 'width=820,height=720');
    if (!win) { toast({ title: 'Pop-up blocked', description: 'Allow pop-ups to print the shipping label.', variant: 'destructive' }); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>HAVESTORY Shipping Label</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#fff;font-family:Arial,sans-serif}@page{size:${pageWidth} ${pageHeight};margin:0}@media print{html,body{width:${pageWidth};height:${pageHeight}}.label-print-target{width:100%!important;min-height:100%!important;box-shadow:none!important;border:0!important}</style></head><body>${label.outerHTML}</body></html>`);
    win.document.close(); let printed = false;
    const printOnce = () => { if (printed) return; printed = true; win.focus(); win.print(); window.setTimeout(() => win.close(), 400); };
    win.onload = printOnce; window.setTimeout(printOnce, 1000);
  }
  async function handleDownload() {
    if (!ensureReady()) return;
    const label = document.querySelector<HTMLElement>('.label-print-target');
    if (!label) return;
    try {
      const isA5 = form.labelSize === 'a5';
      const width = isA5 ? 559 : 378;
      const height = isA5 ? 794 : 560;
      const canvas = await captureElement(label, {
        width,
        height,
        scale: 2,
        backgroundColor: '#ffffff',
        overflowVisible: false,
      });
      const link = document.createElement('a');
      link.download = `HAVESTORY-${form.orderNumber || form.recipientName || 'shipping-label'}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '-');
      link.href = canvas.toDataURL('image/jpeg', 0.96);
      link.click();
      toast({ title: 'Shipping label downloaded', description: link.download });
    } catch (error: any) {
      toast({ title: 'Download failed', description: error.message || 'Could not create the JPG.', variant: 'destructive' });
    }
  }
  function handleClear() { setForm({ ...EMPTY_FORM, labelSize: labelSettings.defaultSize || 'standard' }); setOrderQuery(''); setLookupPhone(''); setSelectedOrderId(null); setClientId(null); setDetailsSaved(false); setQrUrl(''); autoLoaded.current = true; }

  const inputClass = 'h-11 rounded-xl border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm focus-visible:border-violet-300 focus-visible:ring-violet-100';
  const handling = [
    { key: 'urgent', label: 'Urgent', Icon: Zap }, { key: 'fragile', label: 'Fragile', Icon: AlertTriangle },
    { key: 'handleWithCare', label: 'Handle with care', Icon: ShieldCheck }, { key: 'thisSideUp', label: 'This side up', Icon: ArrowUp },
    { key: 'keepDry', label: 'Keep dry', Icon: Droplets },
  ] as const;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3">
      <header className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/60 to-amber-50/60 p-6 shadow-[0_20px_60px_rgba(76,35,112,.08)] sm:p-8">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-amber-700"><Truck className="h-4 w-4" /> Dispatch studio</div><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Shipping Labels</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Link an order, confirm delivery details and produce a clean HAVESTORY courier label without retyping customer information.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={handleClear} className="h-11 rounded-xl border-slate-200 bg-white px-5 font-bold text-slate-600"><RotateCcw className="mr-2 h-4 w-4" /> Clear</Button><Button type="button" variant="outline" onClick={() => void handleDownload()} disabled={missingRequired} className="h-11 rounded-xl border-violet-200 bg-white px-5 font-bold text-violet-700"><Download className="mr-2 h-4 w-4" /> Download JPG</Button><Button type="button" onClick={handlePrint} disabled={missingRequired} className="h-11 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-700 px-6 font-black text-white shadow-lg shadow-violet-200"><Printer className="mr-2 h-4 w-4" /> Print Label</Button></div></div>
      </header>

      <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Search className="h-4 w-4" /></div><div><h2 className="font-black text-slate-900">Start from an order</h2><p className="mt-1 text-xs leading-5 text-slate-500">Search by order ID, customer or phone. Orders opened from Manage Order load here automatically.</p></div></div>
        <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-violet-500" /><Input value={orderQuery} onFocus={() => setOrderMenuOpen(true)} onChange={(event) => { setOrderQuery(event.target.value); setOrderMenuOpen(true); }} placeholder={ordersLoading ? 'Loading orders…' : 'Search order ID, customer or phone'} className="h-12 rounded-2xl border-violet-100 bg-violet-50/40 pl-11 pr-4 text-sm font-bold" />{orderMenuOpen && <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-80 overflow-y-auto rounded-2xl border border-violet-100 bg-white p-2 shadow-2xl shadow-violet-200/50">{filteredOrders.length ? filteredOrders.map((order) => <button key={order.id} type="button" onClick={() => applyOrder(order)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-violet-50 ${selectedOrderId === Number(order.id) ? 'bg-violet-50 ring-1 ring-violet-200' : ''}`}><div className="min-w-0"><div className="font-mono text-xs font-black text-violet-700">{order.orderId}</div><div className="mt-1 truncate text-sm font-bold text-slate-800">{order.customerName || 'Unnamed customer'}</div></div><div className="text-right text-xs text-slate-500"><div>{order.customerPhone || 'No phone'}</div><div className="mt-1 capitalize">{String(order.status || 'pending')}</div></div></button>) : <div className="px-4 py-8 text-center text-sm text-slate-400">No matching orders</div>}</div>}</div>
      </section>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,.92fr)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700"><User className="h-4 w-4" /></div><div><h2 className="font-black text-slate-900">Recipient details</h2><p className="text-xs text-slate-500">Confirm the information that will appear on the printed label.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Recipient name" className="sm:col-span-2"><Input value={form.recipientName} onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))} placeholder="Full name" className={inputClass} /></Field><Field label="Phone"><Input value={form.phone} onChange={(event) => { setForm((current) => ({ ...current, phone: event.target.value })); setLookupPhone(event.target.value); }} placeholder="07X XXX XXXX" className={inputClass} /></Field><Field label="Alternative phone"><Input value={form.alternatePhone} onChange={(event) => setForm((current) => ({ ...current, alternatePhone: event.target.value }))} placeholder="Optional" className={inputClass} /></Field><Field label="Shipping address" className="sm:col-span-2"><textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={3} placeholder="House number, street and area" className="min-h-24 resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" /></Field><Field label="City"><Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className={inputClass} /></Field><Field label="District"><Input value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} className={inputClass} /></Field><Field label="Postal code"><Input value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className={inputClass} /></Field><Field label="Courier service"><Input value={form.courierService} onChange={(event) => setForm((current) => ({ ...current, courierService: event.target.value }))} placeholder="Courier or pickup" className={inputClass} /></Field></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-violet-700">{detailsSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Save className="h-4 w-4" />}{clientId ? (detailsSaved ? 'Saved to customer profile' : 'Customer profile linked') : 'Find a saved customer using the phone'}</div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => lookupPhone && lookupMut.mutate(lookupPhone)} disabled={!lookupPhone || lookupMut.isPending} className="rounded-xl border-violet-200 bg-white text-violet-700"><Search className="mr-1.5 h-3.5 w-3.5" /> Find</Button><Button type="button" size="sm" onClick={() => clientId && saveDetailsMut.mutate(clientId)} disabled={!clientId || saveDetailsMut.isPending} className="rounded-xl bg-violet-700 text-white"><Save className="mr-1.5 h-3.5 w-3.5" /> Save to Customer</Button></div></div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Package2 className="h-4 w-4" /></div><div><h2 className="font-black text-slate-900">Label and handling</h2><p className="text-xs text-slate-500">Choose paper size, courier marks and delivery schedule.</p></div></div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1.5"><button type="button" onClick={() => setForm((current) => ({ ...current, labelSize: 'standard' }))} className={`rounded-xl px-3 py-3 text-xs font-black ${form.labelSize === 'standard' ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-100' : 'text-slate-500'}`}>Standard · 10×14.8 cm</button><button type="button" onClick={() => setForm((current) => ({ ...current, labelSize: 'a5' }))} className={`rounded-xl px-3 py-3 text-xs font-black ${form.labelSize === 'a5' ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-100' : 'text-slate-500'}`}>Large · A5</button></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Order / invoice number"><Input value={form.orderNumber} onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))} placeholder="ORD-12345" className={inputClass} /></Field><div className="flex items-end"><Button type="button" variant="outline" onClick={() => form.orderNumber && tokenMut.mutate(form.orderNumber)} disabled={!form.orderNumber || tokenMut.isPending} className="h-11 w-full rounded-xl border-violet-200 bg-violet-50 text-violet-700"><ShieldCheck className="mr-2 h-4 w-4" /> {qrUrl ? 'Refresh verification code' : 'Create secure verification'}</Button></div></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{handling.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => setForm((current) => ({ ...current, [key]: !current[key] }))} aria-pressed={form[key]} className={`flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-left text-xs font-black transition ${form[key] ? 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200'}`}><Icon className="h-4 w-4" /> {label}<span className={`ml-auto h-4 w-4 rounded-full border ${form[key] ? 'border-violet-600 bg-violet-600 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300'}`} /></button>)}</div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-violet-50/50 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><CalendarDays className="h-4 w-4 text-blue-600" /> Delivery schedule</div><div className="grid gap-3 sm:grid-cols-2"><Field label="Delivery date"><Input type="date" value={form.deliveryDate} onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))} className={inputClass} /></Field><Field label="Delivery time"><Input type="time" value={form.deliveryTime} onChange={(event) => setForm((current) => ({ ...current, deliveryTime: event.target.value }))} className={inputClass} /></Field></div></div>
            <Field label="Other delivery notes" className="mt-4"><textarea value={form.deliveryNotes} onChange={(event) => setForm((current) => ({ ...current, deliveryNotes: event.target.value }))} rows={3} placeholder="Gate, landmark or courier instruction" className="resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" /></Field>
          </section>
        </div>

        <aside className="space-y-4 2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Live print preview</div><div className="mt-1 text-xs text-slate-500">{form.labelSize === 'a5' ? 'A5 · 14.8 × 21 cm' : 'Standard · 10 × 14.8 cm'}</div></div>{selectedOrderId && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">ORDER LINKED</span>}</div>
          <div className="overflow-auto rounded-3xl border border-violet-100 bg-gradient-to-br from-slate-100 via-violet-50 to-amber-50 p-5 shadow-inner sm:p-8"><div className="mx-auto w-max"><LabelPreview form={form} sender={sender} qrUrl={qrUrl} showQr={labelSettings.showQr !== false} showBarcode={labelSettings.showBarcode !== false} /></div></div>
          <div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => void handleDownload()} disabled={missingRequired} className="h-12 rounded-2xl border-violet-200 bg-white font-black text-violet-700"><Download className="mr-2 h-4 w-4" /> Download JPG</Button><Button type="button" onClick={handlePrint} disabled={missingRequired} className="h-12 rounded-2xl bg-gradient-to-r from-violet-700 to-fuchsia-700 font-black text-white"><Printer className="mr-2 h-4 w-4" /> Print Label</Button></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500"><div className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /><span>For exact printing, disable browser headers and footers and keep scale at 100%. JPG uses the same preview without browser-added date, title or URL.</span></div></div>
        </aside>
      </div>
    </div>
  );
}
