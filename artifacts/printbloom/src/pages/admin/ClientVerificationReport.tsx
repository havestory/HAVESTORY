import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Download, Printer, ShieldCheck, XCircle } from "lucide-react";
import { getInvoicePaidAmount } from "@/lib/invoiceTypes";
import { A4PrintPortal,useA4Print } from "@/components/A4PrintPortal";
import { useGetSettings } from "@workspace/api-client-react";
import { getBusinessName } from "@/lib/brand-settings";

type Verification = {
  exists: boolean;
  status?: "pending" | "submitted" | "approved" | "rejected";
  profile?: { fullName: string; nicNumber: string; dateOfBirth: string; phone: string; email: string; address: string } | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  ownerNote?: string | null;
  hasSelfie?: boolean;
  hasIdFront?: boolean;
  hasIdBack?: boolean;
};

export default function ClientVerificationReport() {
  const { active: printActive, print: printA4 } = useA4Print();
  const { data: settings } = useGetSettings();
  const businessName = getBusinessName(settings as any);
  const { clientId } = useParams<{ clientId: string }>();
  const [, setLocation] = useLocation();
  const id = Number(clientId);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [vr, cr, ir] = await Promise.all([
        fetch(`/api/admin/clients/${id}/verification`, { credentials: "include", cache: "no-store" }),
        fetch("/api/clients", { credentials: "include", cache: "no-store" }),
        fetch("/api/invoices", { credentials: "include", cache: "no-store" }),
      ]);
      if (!vr.ok) throw new Error("Could not load verification report");
      const v = await vr.json();
      const cs = cr.ok ? await cr.json() : [];
      const inv = ir.ok ? await ir.json() : [];
      setVerification(v);
      setClient((Array.isArray(cs) ? cs : []).find((c: any) => c.id === id) || null);
      setInvoices((Array.isArray(inv) ? inv : []).filter((i: any) => i.clientId === id));
      setNote(v.ownerNote || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load verification report");
    }
  };

  useEffect(() => { void load(); }, [id]);

  const totals = useMemo(() => invoices.reduce((acc, invoice) => {
    acc.invoiced += Number(invoice.amount || 0);
    acc.paid += getInvoicePaidAmount(invoice);
    return acc;
  }, { invoiced: 0, paid: 0 }), [invoices]);

  const decide = async (decision: "approved" | "rejected") => {
    setSaving(true); setError("");
    try {
      const r = await fetch(`/api/admin/clients/${id}/verification-decision`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || "Could not save review");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save review"); }
    finally { setSaving(false); }
  };

  const money = (n: number) => `LKR ${Math.round(n).toLocaleString("en-IN")}`;
  const image = (kind: string) => `/api/admin/clients/${id}/verification/image/${kind}?v=${verification?.submittedAt || ""}`;

  if (error && !verification) return <div className="p-8 text-red-600">{error}</div>;
  if (!verification || !client) return <div className="p-8 text-slate-500">Loading secure report...</div>;

  const report = <article id="client-verification-report" className="verification-a4 pb-print-flow mx-auto max-w-[900px] rounded-3xl bg-white p-6 shadow-xl sm:p-9">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
        <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-pink-600"><ShieldCheck size={18} /> {businessName} · Owner Confidential</div><h1 className="mt-2 text-3xl font-black text-slate-950">Client Verification Report</h1><p className="mt-1 text-sm text-slate-500">Profile {String(client.id).padStart(4, "0")} · Generated {new Date().toLocaleString("en-LK")}</p></div>
        <span className={`rounded-full px-4 py-2 text-xs font-black uppercase ${verification.status === "approved" ? "bg-emerald-100 text-emerald-700" : verification.status === "rejected" ? "bg-red-100 text-red-700" : verification.status === "submitted" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{verification.status || "not started"}</span>
      </header>

      <section className="avoid-break grid gap-5 border-b border-slate-200 py-6 sm:grid-cols-2">
        <ReportBlock title="Saved client profile" rows={[
          ["Name", client.name], ["Business", client.businessName || "—"], ["Phone", client.phone || "—"],
          ["Email", client.email || "—"], ["Address", client.address || "—"],
        ]} />
        <ReportBlock title="Submitted identity details" rows={[
          ["Legal name", verification.profile?.fullName || "—"], ["NIC / ID", verification.profile?.nicNumber || "—"],
          ["Date of birth", verification.profile?.dateOfBirth || "—"], ["Phone", verification.profile?.phone || "—"],
          ["Email", verification.profile?.email || "—"], ["Address", verification.profile?.address || "—"],
        ]} />
      </section>

      <section className="avoid-break grid grid-cols-3 gap-3 border-b border-slate-200 py-6 text-center">
        <Metric label="Invoices" value={String(invoices.length)} />
        <Metric label="Invoiced" value={money(totals.invoiced)} />
        <Metric label="Received incl. partial" value={money(totals.paid)} />
      </section>

      {verification.profile && <section className="avoid-break border-b border-slate-200 py-6">
        <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-700">Live identity captures</h2>
        <div className="grid grid-cols-3 gap-3">
          {([["selfie","Live selfie",verification.hasSelfie],["id-front","ID front",verification.hasIdFront],["id-back","ID back",verification.hasIdBack]] as const).map(([kind,label,has]) =>
            <div key={kind} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{has ? <img src={image(kind)} alt={label} className="aspect-[4/3] w-full bg-slate-100 object-contain" /> : <div className="grid aspect-[4/3] place-items-center text-xs text-slate-400">Not captured</div>}<div className="p-2 text-center text-xs font-bold">{label}</div>{has && <a className="no-print mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2 py-2 text-[11px] font-bold text-white" href={`${image(kind)}&download=1`}><Download size={13}/> Download full image</a>}</div>
          )}
        </div>
      </section>}

      <section className="avoid-break py-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Owner review</h2>
        <p className="mt-2 text-xs text-slate-500">Submitted: {verification.submittedAt ? new Date(verification.submittedAt).toLocaleString("en-LK") : "—"} · Reviewed: {verification.reviewedAt ? new Date(verification.reviewedAt).toLocaleString("en-LK") : "—"}</p>
        <textarea className="no-print mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm" rows={3} placeholder="Owner review note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700 print:block">{verification.ownerNote || ""}</div>
        {error && <p className="no-print mt-3 text-sm font-bold text-red-600">{error}</p>}
        {verification.status === "submitted" && <div className="no-print mt-4 flex gap-3">
          <button disabled={saving} onClick={() => void decide("approved")} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white"><CheckCircle2 size={17} /> Approve</button>
          <button disabled={saving} onClick={() => void decide("rejected")} className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white"><XCircle size={17} /> Reject</button>
        </div>}
      </section>

      <footer className="mt-4 border-t border-slate-200 pt-3 text-[10px] text-slate-400">CONFIDENTIAL — contains encrypted identity data. Owner access only. Do not share this report publicly.</footer>
    </article>;

  return <div className="min-h-screen bg-slate-100 p-3 sm:p-6">


    <div className="no-print mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-3">
      <button onClick={() => setLocation("/admin/clients")} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow"><ArrowLeft size={16} /> Clients</button>
      <button onClick={printA4} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"><Printer size={16} /> Export / Print A4</button>
    </div>

    {report}<A4PrintPortal active={printActive}>{report}</A4PrintPortal>
  </div>;
}

function ReportBlock({ title, rows }: { title: string; rows: Array<[string, any]> }) {
  return <div><h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">{title}</h2><dl className="space-y-2">{rows.map(([label,value]) => <div key={label}><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{String(value ?? "—")}</dd></div>)}</dl></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-base font-black text-slate-900">{value}</div></div>;
}
