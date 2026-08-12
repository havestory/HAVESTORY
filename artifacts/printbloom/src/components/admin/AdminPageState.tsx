import { AlertTriangle, RefreshCw } from "lucide-react";

export function AdminPageSkeleton({ cards = 4, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard data">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5 h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, index) => <div key={index} className="h-10 animate-pulse rounded bg-muted/70" />)}
        </div>
      </div>
    </div>
  );
}

export function AdminErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-red-200 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={20} /></div>
        <h2 className="mt-4 font-serif text-2xl font-bold text-foreground">Could not load this section</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message || "The server did not return the expected data. Please try again."}</p>
        <button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </div>
  );
}

export function AdminTableLoading({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-b border-border/60 last:border-0" aria-hidden="true">
          <td colSpan={columns} className="px-4 py-3.5">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${Math.max(34, 82 - row * 8)}%` }} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function AdminTableError({ columns, onRetry }: { columns: number; onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={columns} className="px-5 py-12 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-red-500" />
        <p className="mt-3 text-sm font-bold text-foreground">This data could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">Check the connection and try the request again.</p>
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted">
          <RefreshCw size={13} /> Retry
        </button>
      </td>
    </tr>
  );
}
