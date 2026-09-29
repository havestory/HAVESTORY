import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Printer, Calendar, AlertCircle } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/public/Reveal';

interface PriceListSection {
  id: string;
  title: string;
  columns: string[];
  visibleColumns?: boolean[];
  rows: Array<{ id: string; cells: string[] }>;
}

interface PriceList {
  id: number;
  publicId: string;
  title: string;
  subtitle: string;
  note: string;
  sections: PriceListSection[];
  requirements?: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) {
    let msg = `Not found`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

export default function PriceListView() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;

  const { data: pl, isLoading, error } = useQuery<PriceList>({
    queryKey: ['price-list-public', publicId],
    queryFn: () => apiFetch(`/api/price-lists/public/${publicId}`),
    enabled: !!publicId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="hv-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="hv-skeleton mx-auto mb-5 h-12 w-12 rounded-full" />
          <p className="text-sm text-[#6f6259]">Loading price list...</p>
        </div>
      </div>
    );
  }

  if (error || !pl) {
    return (
      <div className="hv-page flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="hv-empty-icon mb-6"><AlertCircle /></div>
          <h2 className="hv-display hv-display-sm mb-3">Price List Not Found</h2>
          <p className="text-sm leading-7 text-[#6f6259]">
            This price list may have expired, been deactivated, or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = pl.expiresAt && new Date(pl.expiresAt) < new Date();

  return (
    <div className="hv-page min-h-screen">
      {/* Hero */}
      <header className="hv-page-hero print:hidden">
        <div className="hv-hero-ornament" aria-hidden="true" />
        <div className="hv-container relative">
          <Reveal>
            <span className="hv-badge hv-badge-bronze mb-6">Private Price List</span>
            <h1 className="hv-display hv-display-md">{pl.title}</h1>
            {pl.subtitle && <p className="hv-lede">{pl.subtitle}</p>}
            <button
              onClick={() => window.print()}
              className="hv-btn hv-btn-ghost hv-btn-sm mt-8"
            >
              <Printer />
              Print
            </button>
          </Reveal>
        </div>
      </header>

      <main className="hv-section-tight print:py-0">
        <div className="hv-container max-w-4xl">
          {/* Validity notice */}
          {pl.expiresAt && (
            <Reveal className="mb-8 print:hidden">
              <div className={`hv-card flex items-center gap-3 p-4 ${isExpired ? 'border-[rgba(180,60,50,0.35)]' : 'border-[rgba(176,124,58,0.35)]'}`}>
                <Calendar className={`h-4 w-4 shrink-0 ${isExpired ? 'text-[#b43c32]' : 'text-[#b07c3a]'}`} />
                <p className={`text-sm font-medium ${isExpired ? 'text-[#b43c32]' : 'text-[#8a5f28]'}`}>
                  {isExpired
                    ? `This price list expired on ${fmtDate(pl.expiresAt)}.`
                    : `Valid until ${fmtDate(pl.expiresAt)}.`}
                </p>
              </div>
            </Reveal>
          )}

          {/* Section anchors */}
          {pl.sections.length > 1 && (
            <div className="hv-chip-row mb-10 print:hidden">
              {pl.sections.map((s, i) => (
                <a key={s.id} href={`#pl-section-${i}`} className="hv-chip">{s.title}</a>
              ))}
            </div>
          )}

          {/* Sections */}
          <Stagger className="space-y-10">
            {pl.sections.map((section, si) => (
              <StaggerItem key={section.id}>
                <section id={`pl-section-${si}`} className="hv-card scroll-mt-32 overflow-hidden">
                  <div className="border-b border-[rgba(23,19,16,0.08)] px-6 py-5 md:px-8">
                    <h2 className="hv-display text-[22px]">{section.title}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {section.columns.map((col, i) => section.visibleColumns?.[i] !== false && (
                            <th key={i} className="border-b border-[rgba(23,19,16,0.08)] bg-[rgba(23,19,16,0.02)] px-6 py-3.5 text-left text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6f6259] md:px-8">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => (
                          <tr key={row.id} className="border-b border-[rgba(23,19,16,0.06)] transition-colors last:border-0 hover:bg-[rgba(176,124,58,0.05)]">
                            {row.cells.map((cell, ci) => section.visibleColumns?.[ci] !== false && (
                              <td key={ci} className={`px-6 py-3.5 text-sm md:px-8 ${ci === 0 ? 'font-semibold text-[#171310]' : 'text-[#2b241e]'}`}>
                                {cell || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Requirements */}
          {pl.requirements && (
            <section aria-label="Customer requirements" className="mt-10 rounded-[20px] border border-[rgba(184,137,74,0.35)] bg-[rgba(184,137,74,0.08)] p-6 md:p-8">
              <h2 className="hv-display mb-3 text-[20px]">Requirements &amp; terms</h2>
              <p className="whitespace-pre-line text-sm leading-7 text-[#2b241e]">{pl.requirements}</p>
            </section>
          )}

          {/* Notes */}
          {pl.note && (
            <div className="mt-8 rounded-[20px] border border-[rgba(23,19,16,0.08)] bg-[#f1e9da] p-6 md:p-8">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#8a5f28]">Notes</p>
              <p className="text-sm leading-7 text-[#2b241e]">{pl.note}</p>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-12 border-t border-[rgba(23,19,16,0.08)] pt-8 text-center print:hidden">
            <p className="text-xs leading-6 text-[#a89a8c]">
              This is a private price list shared exclusively for your reference. Please do not distribute.
            </p>
            <p className="mt-1 text-xs text-[#a89a8c]">
              Generated on {new Date(pl.createdAt).toLocaleDateString('en-GB')}
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
