import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Printer, Calendar, AlertCircle } from 'lucide-react';

interface PriceListSection {
  id: string;
  title: string;
  columns: string[];
  rows: Array<{ id: string; cells: string[] }>;
}

interface PriceList {
  id: number;
  publicId: string;
  title: string;
  subtitle: string;
  note: string;
  sections: PriceListSection[];
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 rounded-full bg-secondary/20 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading price list...</p>
        </div>
      </div>
    );
  }

  if (error || !pl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold mb-2">Price List Not Found</h2>
          <p className="text-muted-foreground text-sm">
            This price list may have expired, been deactivated, or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = pl.expiresAt && new Date(pl.expiresAt) < new Date();

  return (
    <div className="hsc-price-list min-h-screen bg-background">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-family: sans-serif; }
          .price-list-content { padding: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-primary py-12 text-white noise relative overflow-hidden no-print">
        <div className="relative z-10 max-w-4xl mx-auto px-6 flex items-start justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-bold text-primary-foreground/60 mb-2 block">Private Price List</span>
            <h1 className="text-3xl lg:text-4xl font-serif font-bold text-white mb-2">{pl.title}</h1>
            {pl.subtitle && <p className="text-primary-foreground/80 text-lg">{pl.subtitle}</p>}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors shrink-0 mt-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 price-list-content">
        {/* Validity notice */}
        {pl.expiresAt && (
          <div className={`flex items-center gap-3 p-4 border ${isExpired ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-secondary/30 bg-secondary/10 text-secondary'}`}>
            <Calendar className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium">
              {isExpired
                ? `This price list expired on ${new Date(pl.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.`
                : `Valid until ${new Date(pl.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}.`}
            </p>
          </div>
        )}

        {/* Sections */}
        {pl.sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-foreground border-b border-border pb-2">{section.title}</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/60 border border-border">
                    {section.columns.map((col, i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, ri) => (
                    <tr key={row.id} className={`border-b border-border ${ri % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                      {row.cells.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3 text-sm text-foreground">
                          {cell || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Notes */}
        {pl.note && (
          <div className="border border-border bg-muted/30 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
            <p className="text-sm text-foreground leading-relaxed">{pl.note}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-border text-center no-print">
          <p className="text-xs text-muted-foreground">
            This is a private price list shared exclusively for your reference. Please do not distribute.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generated on {new Date(pl.createdAt).toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
    </div>
  );
}
