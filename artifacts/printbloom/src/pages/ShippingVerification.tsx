import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { CheckCircle2, Loader2, LockKeyhole, PackageCheck } from "lucide-react";
import { getBusinessInitials, getBusinessName } from "@/lib/brand-settings";

export default function ShippingVerification() {
  const { token } = useParams<{ token: string }>();
  const { data: settings } = useGetSettings();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/shipping-labels/verify/${encodeURIComponent(token || "")}`)
      .then(async response => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Invalid label"); return body; })
      .then(setData).catch(err => setError(err.message));
  }, [token]);

  const name = getBusinessName(settings as any);
  const initials = getBusinessInitials(settings as any);
  const logo = (settings as any)?.logoUrl;
  if (!data && !error) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-pink-500" /></div>;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.12),_transparent_40%),#f8f7fb] p-5">
      <div className="w-full max-w-md rounded-3xl border border-white bg-white/90 p-7 text-center shadow-2xl backdrop-blur-xl">
        {logo ? <img src={logo} alt={name} className="mx-auto h-14 w-14 rounded-xl object-contain" /> : <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 font-black text-white">{initials}</div>}
        <h1 className="mt-4 text-xl font-black text-gray-950">{name} Shipping Verification</h1>
        {error ? <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div> : <>
          <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={30} /></div>
          <div className="mt-3 text-xs font-bold uppercase tracking-widest text-emerald-600">Valid shipping label</div>
          <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-5"><div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Invoice Number</div><div className="mt-1 break-all font-mono text-lg font-black text-gray-950">{data.invoiceNumber||"Invoice not linked"}</div><div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold capitalize text-purple-700"><PackageCheck size={13} /> {data.status}</div></div>
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs leading-relaxed text-blue-800"><LockKeyhole size={15} className="mt-0.5 shrink-0" />Customer name, phone number and delivery address are intentionally protected and never shown on this verification page.</div>
        </>}
      </div>
    </main>
  );
}
