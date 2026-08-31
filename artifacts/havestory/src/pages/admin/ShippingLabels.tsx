import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { captureElement } from '@/lib/html2canvas-capture';
import { CalendarDays, CheckCircle2, Download, FileImage, FileText, Package2, Printer, RotateCcw, Save, Search, ShieldCheck, Truck, Upload, User, X, Zap } from 'lucide-react';
import { useGetSettings, useListOrders } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

type LabelSize = 'standard' | 'a5';
type LabelForm = {
  recipientName: string; phone: string; alternatePhone: string; address: string;
  city: string; district: string; postalCode: string; deliveryNotes: string;
  orderNumber: string; courierService: string; deliveryDate: string; deliveryTime: string;
  urgent: boolean; handlingArtwork: boolean;
  labelSize: LabelSize;
};
type LabelSettings = {
  senderName: string; senderPhone: string; senderWhatsapp: string; senderAddress: string;
  footerText: string; defaultSize: LabelSize; showQr?: boolean; showBarcode?: boolean;
  handlingArtworkImageUrl?: string;
};

const EMPTY_FORM: LabelForm = {
  recipientName: '', phone: '', alternatePhone: '', address: '', city: '', district: '', postalCode: '',
  deliveryNotes: '', orderNumber: '', courierService: '', deliveryDate: '', deliveryTime: '',
  urgent: false, handlingArtwork: false, labelSize: 'standard',
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
    <div style={{ width: size, minHeight: size, display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 3, border: '1px solid #cdbbd4', borderRadius: 8, background: '#fff', padding: 5, textAlign: 'center' }}>
      <QRCodeSVG value={url} size={Math.round(size * .72)} level="M" marginSize={0} bgColor="#ffffff" fgColor="#26152f" />
      <span style={{ color: '#4c2370', fontFamily: 'monospace', fontSize: Math.max(5.5, size * .075), fontWeight: 900, letterSpacing: .5, overflowWrap: 'anywhere' }}>{code}</span>
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

function deliverySchedule(dateValue: string, timeValue: string) {
  if (!dateValue && !timeValue) return null;
  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : null;
  const sinhalaDate = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    : dateValue;
  const englishDate = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
    : dateValue;
  const [hoursText = '0', minutes = '00'] = timeValue.split(':');
  const hours = Number(hoursText);
  const englishTime = timeValue ? `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}` : '';
  return { sinhalaDate, englishDate, time24: timeValue, englishTime };
}

function LabelPreview({ form, sender, qrUrl, showQr, showBarcode, handlingArtworkImage }: {
  form: LabelForm;
  sender: { name: string; phone: string; whatsapp: string; address: string; website: string; logo: string; footer: string };
  qrUrl: string; showQr: boolean; showBarcode: boolean;
  handlingArtworkImage: string;
}) {
  const isA5 = form.labelSize === 'a5';
  const width = isA5 ? 559 : 378;
  const height = isA5 ? 794 : 560;
  const schedule = deliverySchedule(form.deliveryDate, form.deliveryTime);
  const detailFont = isA5 ? 17 : 14;
  return (
    <div className="label-print-target" style={{ width, height, minHeight: height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #d9d0dc', background: '#fff', color: '#151019', fontFamily: 'Arial,sans-serif', fontSize: 12, boxShadow: '0 26px 70px rgba(35,20,43,.2)' }}>
      <div style={{ height: isA5 ? 9 : 7, flex: '0 0 auto', background: 'linear-gradient(90deg,#4c2370 0%,#8c4ba7 55%,#c49a4a 100%)' }} />
      <header style={{ padding: isA5 ? '18px 20px 15px' : '13px 15px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flex: '0 0 auto', borderBottom: '1px solid #ddd5df' }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: isA5 ? 48 : 38, height: isA5 ? 48 : 38, flex: '0 0 auto', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '1px solid #d8c2e1', borderRadius: 12, background: '#f7f0fb', color: '#4c2370', fontFamily: 'Georgia,serif', fontWeight: 900 }}>{sender.logo ? <img crossOrigin="anonymous" src={sender.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : 'HS'}</div>
          <div style={{ minWidth: 0 }}><div style={{ overflowWrap: 'anywhere', fontSize: isA5 ? 20 : 15, fontWeight: 900, letterSpacing: .5 }}>{sender.name}</div>{sender.phone && <div style={{ marginTop: 3, fontSize: isA5 ? 11 : 9, fontWeight: 700 }}>☎ {sender.phone}</div>}</div>
        </div>
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}><div style={{ color: '#7e6b84', fontSize: 7, fontWeight: 900, letterSpacing: 1.2 }}>INVOICE NUMBER</div><div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: isA5 ? 13 : 10, fontWeight: 900 }}>{form.orderNumber || 'NOT LINKED'}</div></div>
      </header>
      {form.urgent && <div style={{ padding: isA5 ? '8px 20px' : '6px 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: '0 0 auto', background: '#e21f2f', color: '#fff', fontSize: isA5 ? 15 : 11, fontWeight: 950, letterSpacing: 1.4, textAlign: 'center' }}><span style={{ fontSize: isA5 ? 19 : 14 }}>⚡</span> URGENT DELIVERY</div>}
      {form.handlingArtwork && handlingArtworkImage && <div style={{ height: isA5 ? 86 : 60, padding: isA5 ? '8px 20px' : '6px 15px', flex: '0 0 auto', overflow: 'hidden', borderBottom: '1px solid #eadff0', background: '#fff' }}><img crossOrigin="anonymous" src={handlingArtworkImage} alt="Handling instructions" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} /></div>}
      <main style={{ padding: isA5 ? '18px 20px 14px' : '13px 15px 10px', flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ padding: isA5 ? '13px 14px 16px' : '10px 11px 12px', border: '2px solid #4c2370', borderRadius: 10, background: '#fcf8fd' }}>
          <div style={{ color: '#8a768f', fontSize: 8, fontWeight: 900, lineHeight: 1.25, letterSpacing: 1.4 }}>DELIVER TO</div>
          <div style={{ marginTop: 6, overflowWrap: 'anywhere', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isA5 ? 25 : 18, fontWeight: 800, lineHeight: 1.2 }}>{form.recipientName || 'Recipient name'}</div>
          {form.phone && <div style={{ marginTop: 9, overflowWrap: 'anywhere', color: '#4c2370', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isA5 ? 17 : 13, fontWeight: 800, lineHeight: 1.3 }}>☎ {form.phone}{form.alternatePhone ? `  /  ${form.alternatePhone}` : ''}</div>}
          <div style={{ marginTop: 8, overflowWrap: 'anywhere', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: detailFont, fontWeight: 700, lineHeight: 1.45 }}>{form.address || 'Delivery address'}{(form.city || form.district || form.postalCode) && <><br />{[form.city, form.district, form.postalCode].filter(Boolean).join(', ')}</>}</div>
        </div>
        {form.courierService && <div style={{ marginTop: 9, color: '#4c3d52', fontSize: isA5 ? 9 : 7, fontWeight: 800 }}>COURIER · {form.courierService}</div>}
        {schedule && <div style={{ marginTop: 9, padding: isA5 ? '9px 12px' : '7px 8px', border: '2px solid #171217', background: '#fff', color: '#111', textAlign: 'center', lineHeight: 1.4 }}><div style={{ fontFamily: 'Arial, sans-serif', fontSize: isA5 ? 14 : 10, fontWeight: 700 }}>මෙම පාර්සලය {schedule.sinhalaDate && <b>{schedule.sinhalaDate}</b>}{schedule.time24 && <> දින <b>{schedule.time24}</b> ට පෙර බාර දෙන්න.</>}</div><div style={{ fontSize: isA5 ? 12 : 9, fontWeight: 700 }}>Please deliver this parcel before {schedule.englishDate}{schedule.englishTime ? ` at ${schedule.englishTime}.` : '.'}</div></div>}
        {form.deliveryNotes && <div style={{ marginTop: 9, padding: '8px 10px', borderLeft: '3px solid #c49a4a', background: '#fff8e7', color: '#5b4216', fontSize: isA5 ? 10 : 8, fontWeight: 700, lineHeight: 1.45, overflowWrap: 'anywhere' }}><b>DELIVERY NOTE:</b> {form.deliveryNotes}</div>}
      </main>
      {showBarcode && form.orderNumber && <div style={{ padding: isA5 ? '0 20px 13px' : '0 15px 9px', flex: '0 0 auto' }}><Barcode value={form.orderNumber} /></div>}
      <footer style={{ padding: isA5 ? '10px 20px 14px' : '7px 15px 10px', display: 'grid', gridTemplateColumns: qrUrl && showQr ? '1fr auto' : '1fr', alignItems: 'center', gap: 13, flex: '0 0 auto', borderTop: '1px solid #1e1722' }}>
        <div style={{ minWidth: 0, alignSelf: 'start' }}><div style={{ overflowWrap: 'anywhere', fontSize: isA5 ? 13 : 9.5, fontWeight: 700, letterSpacing: .45 }}>{sender.footer}</div>{sender.whatsapp && <div style={{ marginTop: 3, fontSize: isA5 ? 10.5 : 8.2, fontWeight: 700 }}>WhatsApp {sender.whatsapp}</div>}{sender.website && <div style={{ marginTop: 3, color: '#5e3d6c', fontSize: isA5 ? 11 : 8.2, fontWeight: 700 }}>{sender.website}</div>}{sender.address && <div style={{ marginTop: 3, color: '#625866', fontSize: isA5 ? 10 : 7.5, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{sender.address}</div>}</div>
        {qrUrl && showQr && <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}><VerificationCode url={qrUrl} size={isA5 ? 88 : 64} /><span style={{ color: '#5f4c64', fontSize: isA5 ? 7 : 6, fontWeight: 800 }}>SECURE VERIFICATION</span></div>}
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
  const [uploadingMark, setUploadingMark] = useState<string | null>(null);
  const autoLoaded = useRef(false);
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({ senderName: '', senderPhone: '', senderWhatsapp: '', senderAddress: '', footerText: 'Thank you for choosing HAVESTORY', defaultSize: 'standard', showQr: true, showBarcode: true });
  const { data: settings } = useQuery<LabelSettings>({ queryKey: ['shipping-label-settings'], queryFn: () => apiFetch('/api/shipping-labels/settings') });
  const saveLabelSettingsMut = useMutation({
    mutationFn: (next: LabelSettings) => apiFetch<LabelSettings>('/api/shipping-labels/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }),
    onSuccess: (saved) => { setLabelSettings((current) => ({ ...current, ...saved })); toast({ title: 'Handling artwork saved', description: 'Ticking a handling option now uses its saved image.' }); },
    onError: (error: any) => toast({ title: 'Artwork settings could not be saved', description: error.message, variant: 'destructive' }),
  });

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
    setForm((current) => ({ ...current, recipientName: order.customerName || '', phone, alternatePhone: '', address: order.customerAddress || '', orderNumber: String(order.invoiceNumber || ''), courierService: order.courierName || String(order.deliveryMethod || order.shippingMethod || '').replaceAll('_', ' '), deliveryNotes: '' }));
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
  async function uploadHandlingImage(file: File) {
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      toast({ title: 'PNG or JPG required', description: 'Please choose a PNG, JPG or JPEG image.', variant: 'destructive' });
      return;
    }
    setUploadingMark('handlingArtworkImageUrl');
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch('/api/settings/upload-image', { method: 'POST', credentials: 'include', body });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setLabelSettings((current) => ({ ...current, handlingArtworkImageUrl: data.url }));
      toast({ title: 'Artwork uploaded', description: 'Click Save artwork to keep this image.' });
    } catch (error: any) {
      toast({ title: 'Artwork upload failed', description: error.message, variant: 'destructive' });
    } finally { setUploadingMark(null); }
  }

  const inputClass = 'h-11 rounded-xl border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm focus-visible:border-violet-300 focus-visible:ring-violet-100';
  const handling = [
    { key: 'urgent', label: 'Urgent', Icon: Zap, disabled: false },
    { key: 'handlingArtwork', label: 'Handling artwork', Icon: FileImage, disabled: !labelSettings.handlingArtworkImageUrl },
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
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Invoice number"><Input value={form.orderNumber} onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))} placeholder="HS-INV-..." className={inputClass} /></Field><div className="flex items-end"><Button type="button" variant="outline" onClick={() => { const linked = orderList.find(order => Number(order.id) === selectedOrderId); if (linked?.orderId) tokenMut.mutate(String(linked.orderId)); }} disabled={!selectedOrderId || tokenMut.isPending} className="h-11 w-full rounded-xl border-violet-200 bg-violet-50 text-violet-700"><ShieldCheck className="mr-2 h-4 w-4" /> {qrUrl ? 'Refresh verification QR' : 'Create secure verification QR'}</Button></div></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">{handling.map(({ key, label, Icon, disabled }) => <button key={key} type="button" disabled={disabled} onClick={() => setForm((current) => ({ ...current, [key]: !current[key] }))} aria-pressed={form[key]} className={`flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${form[key] ? 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200'}`}><Icon className="h-4 w-4" /> <span>{label}{disabled && <small className="mt-0.5 block text-[9px] font-semibold">Upload and save artwork first</small>}</span><span className={`ml-auto h-4 w-4 rounded-full border ${form[key] ? 'border-violet-600 bg-violet-600 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300'}`} /></button>)}</div>
            <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-black text-slate-800"><FileImage className="h-4 w-4 text-violet-600" /> Combined handling artwork</div><p className="mt-1 text-xs text-slate-500">Upload one image containing Fragile, Handle with Care, This Side Up and Keep Dry. Urgent keeps its current red design.</p><p className="mt-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-violet-700"><b>Recommended size:</b> 1200 × 300 px (4:1 ratio) · PNG/JPG · white or transparent background · keep a small safe margin around the artwork.</p></div><Button type="button" size="sm" onClick={() => saveLabelSettingsMut.mutate(labelSettings)} disabled={saveLabelSettingsMut.isPending || !!uploadingMark} className="rounded-xl bg-violet-700 text-white"><Save className="mr-1.5 h-3.5 w-3.5" /> Save artwork</Button></div>
              <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-3"><div className="mb-2 flex items-center justify-between gap-2"><span><span className="block text-xs font-black text-slate-700">Fragile & handling marks</span><span className="mt-0.5 block text-[9px] font-bold text-slate-400">1200 × 300 px</span></span>{labelSettings.handlingArtworkImageUrl && <button type="button" aria-label="Remove handling artwork" onClick={() => { setLabelSettings((current) => ({ ...current, handlingArtworkImageUrl: '' })); setForm((current) => ({ ...current, handlingArtwork: false })); }} className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}</div><label className="grid min-h-28 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-violet-200 bg-violet-50/40 text-center transition hover:border-violet-400">{labelSettings.handlingArtworkImageUrl ? <img crossOrigin="anonymous" src={labelSettings.handlingArtworkImageUrl} alt="Combined handling artwork" className="h-28 w-full object-contain p-2" /> : <span className="grid justify-items-center gap-1 p-3 text-[10px] font-bold text-violet-600"><Upload className="h-5 w-5" />{uploadingMark ? 'Uploading…' : 'Upload combined PNG / JPG'}<small className="font-semibold text-slate-400">1200 × 300 px</small></span>}<input type="file" accept="image/png,image/jpeg" className="hidden" disabled={!!uploadingMark} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadHandlingImage(file); event.currentTarget.value = ''; }} /></label></div>
            </div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-violet-50/50 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><CalendarDays className="h-4 w-4 text-blue-600" /> Delivery schedule</div><div className="grid gap-3 sm:grid-cols-2"><Field label="Delivery date"><Input type="date" value={form.deliveryDate} onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))} className={inputClass} /></Field><Field label="Delivery time"><Input type="time" value={form.deliveryTime} onChange={(event) => setForm((current) => ({ ...current, deliveryTime: event.target.value }))} className={inputClass} /></Field></div></div>
            <Field label="Other delivery notes" className="mt-4"><textarea value={form.deliveryNotes} onChange={(event) => setForm((current) => ({ ...current, deliveryNotes: event.target.value }))} rows={3} placeholder="Gate, landmark or courier instruction" className="resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" /></Field>
          </section>
        </div>

        <section aria-label="Live print preview" className="space-y-4 2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Live print preview</div><div className="mt-1 text-xs text-slate-500">{form.labelSize === 'a5' ? 'A5 · 14.8 × 21 cm' : 'Standard · 10 × 14.8 cm'}</div></div>{selectedOrderId && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">ORDER LINKED</span>}</div>
            <div className="mt-4 overflow-auto rounded-2xl border border-slate-200 bg-[#f7f7f8] p-4 shadow-inner sm:p-7"><div className="mx-auto w-max"><LabelPreview form={form} sender={sender} qrUrl={qrUrl} showQr={labelSettings.showQr !== false} showBarcode={labelSettings.showBarcode !== false} handlingArtworkImage={labelSettings.handlingArtworkImageUrl || ''} /></div></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => void handleDownload()} disabled={missingRequired} className="h-12 rounded-2xl border-violet-200 bg-white font-black text-violet-700"><Download className="mr-2 h-4 w-4" /> Download JPG</Button><Button type="button" onClick={handlePrint} disabled={missingRequired} className="h-12 rounded-2xl bg-gradient-to-r from-violet-700 to-fuchsia-700 font-black text-white"><Printer className="mr-2 h-4 w-4" /> Print Label</Button></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500"><div className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /><span>For exact printing, disable browser headers and footers and keep scale at 100%. JPG uses the same preview without browser-added date, title or URL.</span></div></div>
        </section>
      </div>
    </div>
  );
}
