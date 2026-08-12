import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Truck, Search, Printer, AlertTriangle, Zap, Package2, ChevronDown, User, Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGetSettings } from '@workspace/api-client-react';

interface LabelSettings {
  senderName: string;
  senderPhone: string;
  senderWhatsapp: string;
  senderAddress: string;
  footerText: string;
  defaultSize: 'standard' | 'a5';
}

interface LabelForm {
  recipientName: string;
  phone: string;
  alternatePhone: string;
  address: string;
  city: string;
  district: string;
  postalCode: string;
  deliveryNotes: string;
  invoiceNumber: string;
  urgent: boolean;
  fragile: boolean;
  handleWithCare: boolean;
  thisSideUp: boolean;
  keepDry: boolean;
  labelSize: 'standard' | 'a5';
}

const EMPTY_FORM: LabelForm = {
  recipientName: '', phone: '', alternatePhone: '',
  address: '', city: '', district: '', postalCode: '',
  deliveryNotes: '', invoiceNumber: '',
  urgent: false, fragile: false, handleWithCare: false, thisSideUp: false, keepDry: false,
  labelSize: 'standard',
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function QRCode({ url, size = 100 }: { url: string; size?: number }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=4`}
      alt="QR Code"
      width={size}
      height={size}
      className="block"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function ShippingLabelPreview({
  form,
  senderName,
  senderPhone,
  senderAddress,
  footerText,
  qrUrl,
}: {
  form: LabelForm;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  footerText: string;
  qrUrl: string;
}) {
  // standard: 10x14.8cm at 96dpi ≈ 378x560px, a5: 14.8x21cm ≈ 559x794px
  const isA5 = form.labelSize === 'a5';
  const w = isA5 ? 559 : 378;
  const h = isA5 ? 794 : 560;

  return (
    <div
      className="label-print-target bg-white text-black border border-border shadow-lg overflow-hidden"
      style={{ width: w, minHeight: h, fontFamily: 'sans-serif', fontSize: 12 }}
    >
      {/* Header: sender info */}
      <div style={{ background: '#111', color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: isA5 ? 18 : 14, fontWeight: 800, letterSpacing: 2 }}>{senderName || 'HAVESTORY'}</div>
          {senderPhone && <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{senderPhone}</div>}
          {senderAddress && <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{senderAddress}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Shipping Label</div>
          {form.labelSize && <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>{form.labelSize.toUpperCase()}</div>}
        </div>
      </div>

      {/* Warning badges */}
      {(form.urgent || form.fragile || form.handleWithCare || form.thisSideUp || form.keepDry) && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 14px', background: '#fffbea', borderBottom: '1px solid #f0e68c', flexWrap: 'wrap' }}>
          {form.urgent && (
            <span style={{ background: '#dc2626', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>
              ⚡ URGENT
            </span>
          )}
          {form.fragile && (
            <span style={{ background: '#f59e0b', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>
              ⚠ FRAGILE
            </span>
          )}
          {form.handleWithCare && (
            <span style={{ background: '#6366f1', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>
              HANDLE WITH CARE
            </span>
          )}
          {form.thisSideUp && (
            <span style={{ background: '#0ea5e9', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>
              ↑ THIS SIDE UP
            </span>
          )}
          {form.keepDry && (
            <span style={{ background: '#10b981', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>
              KEEP DRY
            </span>
          )}
        </div>
      )}

      {/* Invoice number */}
      {form.invoiceNumber && (
        <div style={{ padding: '6px 14px', background: '#f8f8f8', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Invoice / Order</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 1 }}>{form.invoiceNumber}</span>
        </div>
      )}

      {/* Recipient */}
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Deliver To</div>
          <div style={{ fontSize: isA5 ? 22 : 18, fontWeight: 800, lineHeight: 1.2, color: '#111' }}>
            {form.recipientName || 'Recipient Name'}
          </div>
          {form.phone && (
            <div style={{ fontSize: isA5 ? 14 : 12, fontWeight: 600, marginTop: 4, color: '#333' }}>
              📞 {form.phone}
              {form.alternatePhone && <span style={{ marginLeft: 8, opacity: 0.7 }}>/ {form.alternatePhone}</span>}
            </div>
          )}
          {form.address && (
            <div style={{ fontSize: isA5 ? 13 : 11, marginTop: 8, lineHeight: 1.5, color: '#444' }}>
              {form.address}
              {form.city && <span>,<br />{form.city}</span>}
              {form.district && <span>, {form.district}</span>}
              {form.postalCode && <span> {form.postalCode}</span>}
            </div>
          )}
          {form.deliveryNotes && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#fef9c3', border: '1px solid #fef08a', fontSize: 9, color: '#78350f', lineHeight: 1.4 }}>
              <strong>Note:</strong> {form.deliveryNotes}
            </div>
          )}
        </div>

        {/* QR Code */}
        {qrUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 4 }}>
            <QRCode url={qrUrl} size={isA5 ? 110 : 88} />
            <div style={{ fontSize: 7, color: '#aaa', textAlign: 'center', maxWidth: 90 }}>Scan to verify</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#111', color: '#fff', padding: '6px 14px', textAlign: 'center', fontSize: 8, letterSpacing: 1, opacity: 0.9, marginTop: 'auto' }}>
        {footerText || 'Thank you for choosing HAVESTORY'}
      </div>
    </div>
  );
}

export default function ShippingLabels() {
  const { toast } = useToast();
  const { data: siteSettings } = useGetSettings();
  const [form, setForm] = useState<LabelForm>(EMPTY_FORM);
  const [lookupPhone, setLookupPhone] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({
    senderName: '', senderPhone: '', senderWhatsapp: '', senderAddress: '',
    footerText: 'Thank you for choosing HAVESTORY', defaultSize: 'standard',
  });

  const { data: settings } = useQuery<LabelSettings>({
    queryKey: ['shipping-label-settings'],
    queryFn: () => apiFetch('/api/shipping-labels/settings'),
  });

  useEffect(() => {
    if (settings) {
      setLabelSettings(s => ({ ...s, ...settings }));
      setForm(f => ({ ...f, labelSize: settings.defaultSize || 'standard' }));
    }
  }, [settings]);

  // Pre-fill sender from site settings if label settings are empty
  const senderName = labelSettings.senderName || (siteSettings as any)?.businessName || 'HAVESTORY';
  const senderPhone = labelSettings.senderPhone || (siteSettings as any)?.phone || '';
  const senderAddress = labelSettings.senderAddress || '';
  const footerText = labelSettings.footerText || 'Thank you for choosing HAVESTORY';

  const lookupMut = useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ clientId: number; details: any } | null>(`/api/shipping-labels/client-details?phone=${encodeURIComponent(phone)}`),
    onSuccess: (data) => {
      if (!data) {
        toast({ title: 'Not found', description: 'No client found with this phone number.' });
        setClientId(null);
        return;
      }
      setClientId(data.clientId);
      setDetailsSaved(false);
      setForm(f => ({
        ...f,
        recipientName: data.details.recipientName || '',
        phone: data.details.phone || '',
        alternatePhone: data.details.alternatePhone || '',
        address: data.details.address || '',
        city: data.details.city || '',
        district: data.details.district || '',
        postalCode: data.details.postalCode || '',
        deliveryNotes: data.details.deliveryNotes || '',
      }));
      toast({ title: 'Client found', description: 'Shipping details pre-filled.' });
    },
    onError: () => toast({ title: 'Lookup failed', variant: 'destructive' }),
  });

  const saveDetailsMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/shipping-labels/client-details/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: form.recipientName,
          phone: form.phone,
          alternatePhone: form.alternatePhone,
          address: form.address,
          city: form.city,
          district: form.district,
          postalCode: form.postalCode,
          deliveryNotes: form.deliveryNotes,
        }),
      }),
    onSuccess: () => {
      setDetailsSaved(true);
      toast({ title: 'Details saved', description: 'Shipping details saved to client record.' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const tokenMut = useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<{ token: string }>('/api/shipping-labels/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      }),
    onSuccess: (data) => {
      const base = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      setQrUrl(`${base}/verify-shipping/${data.token}`);
      toast({ title: 'QR code generated' });
    },
    onError: (e: any) => toast({ title: 'Could not generate QR', description: e.message, variant: 'destructive' }),
  });

  function handlePrint() {
    // Auto-save details to the client record when a client is linked
    if (clientId !== null) {
      saveDetailsMut.mutate(clientId);
    }
    const labelEl = document.querySelector('.label-print-target');
    if (!labelEl) {
      window.print();
      return;
    }
    // Capture the label's rendered HTML and open it in a fresh window so
    // nothing from the React root can interfere with the print output.
    const isA5 = form.labelSize === 'a5';
    const pageW = isA5 ? '148mm' : '100mm';
    const pageH = isA5 ? '210mm' : '148mm';
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Shipping Label</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: sans-serif; background: #fff; }
  @page { size: ${pageW} ${pageH}; margin: 0; }
  @media print {
    html, body { width: ${pageW}; height: ${pageH}; }
  }
</style>
</head>
<body>${labelEl.outerHTML}</body>
</html>`;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) {
      toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for this site to print labels.', variant: 'destructive' });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Give images (QR code) time to load before triggering print
    win.onload = () => { win.print(); win.close(); };
    // Fallback if onload already fired
    setTimeout(() => { try { win.print(); win.close(); } catch {} }, 1200);
  }

  function handleClear() {
    setForm(f => ({ ...EMPTY_FORM, labelSize: f.labelSize }));
    setQrUrl('');
    setLookupPhone('');
    setClientId(null);
    setDetailsSaved(false);
  }

  async function handleDownload() {
    const labelEl = document.querySelector<HTMLElement>('.label-print-target');
    if (!labelEl) {
      toast({ title: 'Nothing to download', variant: 'destructive' });
      return;
    }
    try {
      const canvas = await html2canvas(labelEl, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // 2× for crisp output on high-dpi screens / WhatsApp
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const slug = (form.recipientName || 'label').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const date = new Date().toISOString().slice(0, 10);
      a.download = `label-${slug}-${date}.png`;
      a.href = dataUrl;
      a.click();
      toast({ title: 'Label downloaded', description: `${a.download}` });
    } catch (err: any) {
      toast({ title: 'Download failed', description: err?.message ?? 'Unknown error', variant: 'destructive' });
    }
  }

  const inputClass = 'rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-sm shadow-none h-9';
  const labelClass = 'text-[9px] uppercase tracking-widest font-semibold text-muted-foreground';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Shipping Labels</h1>
          <p className="text-muted-foreground mt-1">Generate and print professional shipping labels for your orders.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClear} className="rounded-none border-border h-9 font-bold uppercase tracking-widest text-xs">
            Clear
          </Button>
          <Button variant="outline" onClick={handleDownload} className="rounded-none border-border h-9 font-bold uppercase tracking-widest text-xs gap-2">
            <Download className="w-4 h-4" /> Download Image
          </Button>
          <Button onClick={handlePrint} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold gap-2">
            <Printer className="w-4 h-4" /> Print Label
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Form Panel */}
        <div className="space-y-5">
          {/* Lookup by phone */}
          <Card className="rounded-none border border-border shadow-sm bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Look Up Client</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={lookupPhone}
                  onChange={e => setLookupPhone(e.target.value)}
                  placeholder="Enter phone number..."
                  className={inputClass + ' flex-1'}
                  onKeyDown={e => e.key === 'Enter' && lookupPhone && lookupMut.mutate(lookupPhone)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => lookupPhone && lookupMut.mutate(lookupPhone)}
                  disabled={!lookupPhone || lookupMut.isPending}
                  className="rounded-none border-border h-9 font-bold uppercase tracking-widest text-xs gap-2 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  {lookupMut.isPending ? 'Searching...' : 'Find'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Details */}
          <Card className="rounded-none border border-border shadow-sm bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recipient Details</span>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Full Name *</Label>
                <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="John Silva" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Phone *</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="077 123 4567" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Alt. Phone</Label>
                  <Input value={form.alternatePhone} onChange={e => setForm(f => ({ ...f, alternatePhone: e.target.value }))} placeholder="011 234 5678" className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Address *</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main Street" className={inputClass} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className={labelClass}>City</Label>
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Colombo" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>District</Label>
                  <Input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="Western" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Postal Code</Label>
                  <Input value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="10100" className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Delivery Notes</Label>
                <Input value={form.deliveryNotes} onChange={e => setForm(f => ({ ...f, deliveryNotes: e.target.value }))} placeholder="Leave at gate..." className={inputClass} />
              </div>

              {/* Save to client record */}
              {clientId !== null && (
                <div className="flex items-center justify-between pt-1">
                  {detailsSaved ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Details saved to client record
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Client linked — save details to their record</span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveDetailsMut.mutate(clientId)}
                    disabled={saveDetailsMut.isPending}
                    className="rounded-none border-border h-8 font-bold uppercase tracking-widest text-xs gap-1.5 shrink-0"
                  >
                    {saveDetailsMut.isPending ? 'Saving…' : 'Save Details'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Label Options */}
          <Card className="rounded-none border border-border shadow-sm bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Package2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Label Options</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Label Size</Label>
                  <Select value={form.labelSize} onValueChange={(v: any) => setForm(f => ({ ...f, labelSize: v }))}>
                    <SelectTrigger className="rounded-none border-0 border-b-2 border-border focus:ring-0 h-9 px-0 bg-transparent shadow-none text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="standard">Standard (10×14.8 cm)</SelectItem>
                      <SelectItem value="a5">Large A5 (14.8×21 cm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Invoice / Order No.</Label>
                  <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="INV-2024-001" className={inputClass} />
                </div>
              </div>

              {/* Warning Toggles */}
              <div className="space-y-3 pt-2">
                <Label className={labelClass}>Handling Instructions</Label>
                {([
                  { key: 'urgent', label: 'Urgent', icon: Zap, color: 'text-red-500' },
                  { key: 'fragile', label: 'Fragile', icon: AlertTriangle, color: 'text-amber-500' },
                  { key: 'handleWithCare', label: 'Handle With Care', icon: Package2, color: 'text-indigo-500' },
                  { key: 'thisSideUp', label: 'This Side Up', icon: ChevronDown, color: 'text-sky-500' },
                  { key: 'keepDry', label: 'Keep Dry', icon: Package2, color: 'text-emerald-500' },
                ] as const).map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-sm text-foreground">{label}</span>
                    </div>
                    <Switch
                      checked={form[key]}
                      onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))}
                    />
                  </div>
                ))}
              </div>

              {/* QR Code Section */}
              <div className="pt-2 space-y-2">
                <Label className={labelClass}>QR Verification (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.invoiceNumber}
                    onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                    placeholder="Enter order ID to generate QR..."
                    className={inputClass + ' flex-1'}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.invoiceNumber && tokenMut.mutate(form.invoiceNumber)}
                    disabled={!form.invoiceNumber || tokenMut.isPending}
                    className="rounded-none border-border h-9 font-bold uppercase tracking-widest text-xs shrink-0"
                  >
                    {tokenMut.isPending ? '...' : 'Generate QR'}
                  </Button>
                </div>
                {qrUrl && (
                  <p className="text-[10px] text-muted-foreground break-all">{qrUrl}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Label Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Label Preview</span>
            <span className="text-[10px] text-muted-foreground">{form.labelSize === 'a5' ? 'A5 — 14.8 × 21 cm' : 'Standard — 10 × 14.8 cm'}</span>
          </div>
          <div className="label-print-wrapper overflow-auto">
            <ShippingLabelPreview
              form={form}
              senderName={senderName}
              senderPhone={senderPhone}
              senderAddress={senderAddress}
              footerText={footerText}
              qrUrl={qrUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
