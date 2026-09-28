import { useState, type FormEvent } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Package, AlertCircle, Clock, Lock, Search } from 'lucide-react';
import { Reveal } from '@/components/public/Reveal';

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
    case 'delivered': return 'text-green-700 bg-green-50 border-green-200';
    case 'shipped': case 'in_transit': return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'pending': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'processing': return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    case 'cancelled': return 'text-red-700 bg-red-50 border-red-200';
    default: return 'text-[#6f6259] bg-[rgba(23,19,16,0.05)] border-[rgba(23,19,16,0.12)]';
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
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');

  const { data, isLoading, error } = useQuery<VerifyResult>({
    queryKey: ['shipping-verify', token],
    queryFn: () => apiFetch(`/api/shipping-labels/verify/${token}`),
    enabled: !!token,
    retry: false,
  });

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    const t = code.trim();
    if (t) navigate(`/verify-shipping/${encodeURIComponent(t)}`);
  };

  if (isLoading) {
    return (
      <div className="hv-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[rgba(176,124,58,0.12)]">
            <Package className="h-7 w-7 animate-pulse text-[#b07c3a]" />
          </div>
          <p className="text-sm text-[#6f6259]">Verifying shipment...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="hv-page min-h-screen">
        <header className="hv-page-hero">
          <div className="hv-hero-ornament" aria-hidden="true" />
          <div className="hv-container relative">
            <Reveal>
              <span className="hv-kicker">Order verification</span>
              <h1 className="hv-display hv-display-md">Verify your shipment</h1>
              <p className="hv-lede">Enter the verification code from your shipping label to confirm your order is an authentic HAVESTORY shipment.</p>
            </Reveal>
          </div>
        </header>
        <section className="hv-section-tight">
          <div className="hv-container max-w-xl">
            <Reveal>
              <form onSubmit={submitCode} className="hv-search mb-8">
                <Search />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter verification code…"
                  aria-label="Verification code"
                />
                <button type="submit" className="hv-btn hv-btn-solid hv-btn-sm">Verify</button>
              </form>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="hv-card p-8 text-center sm:p-10">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[rgba(180,60,50,0.1)]">
                  <AlertCircle className="h-7 w-7 text-[#b43c32]" />
                </div>
                <h2 className="hv-display hv-display-sm">Label Not Found</h2>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-[#6f6259]">
                  This shipping label could not be verified. The QR code may be invalid or the order has been removed.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </div>
    );
  }

  const Icon = statusIcon(data.status);
  const colorsClass = statusColor(data.status);

  return (
    <div className="hv-page min-h-screen">
      {/* Hero */}
      <header className="hv-page-hero">
        <div className="hv-hero-ornament" aria-hidden="true" />
        <div className="hv-container relative">
          <Reveal>
            <span className="hv-kicker">Order verification</span>
            <h1 className="hv-display hv-display-md">Verify your shipment</h1>
            <p className="hv-lede">Enter the verification code from your shipping label to confirm your order is an authentic HAVESTORY shipment.</p>
          </Reveal>
        </div>
      </header>

      <section className="hv-section-tight">
        <div className="hv-container max-w-xl">
          <Reveal>
            <form onSubmit={submitCode} className="hv-search mb-8">
              <Search />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter verification code…"
                aria-label="Verification code"
              />
              <button type="submit" className="hv-btn hv-btn-solid hv-btn-sm">Verify</button>
            </form>
          </Reveal>

          {/* Result panel */}
          <Reveal delay={0.08}>
            <div className="hv-card p-8 sm:p-10">
              <div className="text-center">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[rgba(176,124,58,0.12)]">
                  <CheckCircle2 className="h-8 w-8 text-[#b07c3a]" />
                </div>
                <h2 className="hv-display hv-display-sm">Shipment Verified</h2>
                <p className="mt-2 text-sm text-[#6f6259]">This is an authentic HAVESTORY shipment.</p>
              </div>

              <div className="mt-8 border-t border-[rgba(23,19,16,0.08)]">
                <div className="flex items-center justify-between gap-4 border-b border-[rgba(23,19,16,0.08)] py-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#a89a8c]">Order Status</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] ${colorsClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {data.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {data.invoiceNumber && (
                  <div className="flex items-center justify-between gap-4 border-b border-[rgba(23,19,16,0.08)] py-4">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#a89a8c]">Invoice</span>
                    <span className="font-mono text-sm font-bold text-[#171310]">{data.invoiceNumber}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 border-b border-[rgba(23,19,16,0.08)] py-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#a89a8c]">Order Date</span>
                  <span className="text-sm text-[#171310]">
                    {new Date(data.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Privacy notice */}
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f1e9da] p-4">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#8a5f28]" />
                <p className="text-xs leading-6 text-[#6f6259]">{data.privacy}</p>
              </div>

              <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[#a89a8c]">HAVESTORY</p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
