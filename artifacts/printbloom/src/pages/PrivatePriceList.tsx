import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { Clock, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";

type Section = { id: string; title: string; columns: string[]; rows: Array<{ id: string; cells: string[] }> };
type PriceList = { title: string; subtitle: string; note: string; sections: Section[]; expiresAt: string | null; updatedAt: string };

export default function PrivatePriceList() {
  const { publicId } = useParams<{ publicId: string }>();
  const { data: settings } = useGetSettings();
  const [data, setData] = useState<PriceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/price-lists/public/${encodeURIComponent(publicId || "")}`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "This price list is not available");
        return body;
      })
      .then(body => { if (active) setData(body); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [publicId]);

  useEffect(() => {
    if (data?.title) document.title = `${data.title} | ${(settings as any)?.businessName || "PrintBloom"}`;
  }, [data?.title, settings]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7fb]"><Loader2 size={32} className="animate-spin text-pink-500" /></div>;
  if (error || !data) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7fb] p-6">
      <div className="max-w-md rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-xl"><FileSpreadsheet size={42} className="mx-auto text-gray-300" /><h1 className="mt-4 text-xl font-bold text-gray-900">Price list unavailable</h1><p className="mt-2 text-sm leading-relaxed text-gray-500">{error || "This private link may be inactive, expired, or replaced."}</p></div>
    </div>
  );

  const businessName = (settings as any)?.businessName || "PrintBloom";
  const logoUrl = (settings as any)?.logoUrl;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(139,92,246,0.12),_transparent_32%),#f8f7fb] px-3 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-2xl shadow-purple-900/10 backdrop-blur-xl">
        <header className="border-b border-gray-100 bg-white/70 px-5 py-6 sm:px-9 sm:py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? <img src={logoUrl} alt={businessName} className="h-12 w-12 rounded-xl bg-white object-contain shadow-sm" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 font-black text-white">PB</div>}
              <div><div className="font-bold text-gray-900">{businessName}</div><div className="text-xs text-gray-400">Private Customer Price List</div></div>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><ShieldCheck size={14} /> Secure share link</div>
          </div>
          <div className="mt-8 max-w-3xl"><h1 className="text-3xl font-black tracking-tight text-gray-950 sm:text-5xl">{data.title}</h1>{data.subtitle && <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">{data.subtitle}</p>}{data.expiresAt && <div className="mt-4 flex items-center gap-2 text-xs text-gray-400"><Clock size={13} /> Valid until {new Date(data.expiresAt).toLocaleDateString("en-LK")}</div>}</div>
        </header>

        <div className="space-y-7 p-4 sm:p-8">
          {data.sections.map(section => (
            <section key={section.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-gray-950 via-purple-950 to-gray-950 px-5 py-4"><h2 className="text-lg font-bold !text-white sm:text-xl" style={{ color: "#ffffff" }}>{section.title}</h2></div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full border-collapse text-left">
                  <thead><tr className="bg-gradient-to-r from-pink-50 to-purple-50">{section.columns.map((column, index) => <th key={index} className="border-b border-gray-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">{column}</th>)}</tr></thead>
                  <tbody>{section.rows.map((row, rowIndex) => <tr key={row.id} className={rowIndex % 2 ? "bg-gray-50/60" : "bg-white"}>{section.columns.map((_, cellIndex) => <td key={cellIndex} className={`border-b border-gray-50 px-5 py-3.5 text-sm ${cellIndex === 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>{row.cells[cellIndex] || "—"}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="divide-y divide-gray-100 sm:hidden">{section.rows.map(row => <div key={row.id} className="p-4">{section.columns.map((column, cellIndex) => <div key={cellIndex} className="flex items-start justify-between gap-4 py-1.5"><span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{column}</span><span className={`text-right text-sm ${cellIndex === 0 ? "font-bold text-gray-950" : "font-semibold text-gray-700"}`}>{row.cells[cellIndex] || "—"}</span></div>)}</div>)}</div>
            </section>
          ))}
          {data.note && <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900"><strong>Please note:</strong> {data.note}</div>}
        </div>
        <footer className="border-t border-gray-100 bg-gray-50/80 px-5 py-5 text-center text-xs text-gray-400">Prepared by {businessName} · Prices are valid only for the conditions shown above.</footer>
      </div>
    </main>
  );
}
