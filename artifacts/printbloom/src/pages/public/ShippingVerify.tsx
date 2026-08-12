import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Package, AlertCircle, Clock, Lock } from 'lucide-react';

interface VerifyResult {
  valid: boolean;
  invoiceNumber: string | null;
  status: string;
  createdAt: string;
  privacy: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    let msg = 'Not found';
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'text-green-600 bg-green-50 border-green-200';
    case 'shipped': case 'in_transit': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'processing': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
    case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

function statusIcon(status: string) {
  switch (status?.toLowerCase()) {
    case 'delivered': return CheckCircle2;
    case 'shipped': case 'in_transit': return Package;
    case 'pending': case 'processing': return Clock;
    default: return Package;
  }
}

export default function ShippingVerify() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data, isLoading, error } = useQuery<VerifyResult>({
    queryKey: ['shipping-verify', token],
    queryFn: () => apiFetch(`/api/shipping-labels/verify/${token}`),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 rounded-full bg-secondary/20 mx-auto mb-4 flex items-center justify-center">
            <Package className="w-7 h-7 text-secondary/60" />
          </div>
          <p className="text-muted-foreground text-sm">Verifying shipment...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive/70" />
          </div>
          <h2 className="font-serif text-2xl font-bold mb-2 text-foreground">Label Not Found</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This shipping label could not be verified. The QR code may be invalid or the order has been removed.
          </p>
        </div>
      </div>
    );
  }

  const Icon = statusIcon(data.status);
  const colorsClass = statusColor(data.status);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/20 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Shipment Verified</h1>
          <p className="text-muted-foreground text-sm mt-1">This is an authentic HAVESTORY shipment.</p>
        </div>

        {/* Status card */}
        <div className="border border-border bg-card p-6 space-y-4">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Order Status</span>
            <span className={`flex items-center gap-1.5 px-3 py-1 border text-xs font-bold uppercase tracking-wider ${colorsClass}`}>
              <Icon className="w-3 h-3" />
              {data.status.replace(/_/g, ' ')}
            </span>
          </div>

          {data.invoiceNumber && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Invoice</span>
              <span className="font-mono font-bold text-sm text-foreground">{data.invoiceNumber}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Order Date</span>
            <span className="text-sm text-foreground">
              {new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 bg-muted/50 border border-border p-4">
          <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{data.privacy}</p>
        </div>

        {/* Branding */}
        <div className="text-center pt-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/60">HAVESTORY</span>
        </div>
      </div>
    </div>
  );
}
