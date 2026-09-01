import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Download, Printer, ShoppingCart,
  Users, Box, CreditCard, ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useGetSettings } from '@workspace/api-client-react';
import { A4PrintPortal, useA4Print } from '@/components/A4PrintPortal';
import './admin-insights.css';

// ─── helpers ────────────────────────────────────────────────────────────────

function thisMonthRange() {
  const now = new Date();
  const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = localDate(now);
  return { from, to };
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── status badge ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-red-50 text-red-500 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  new: 'bg-purple-50 text-purple-700 border-purple-200',
  returning: 'bg-blue-50 text-blue-700 border-blue-200',
};

function Badge({ label }: { label: string }) {
  const cls = STATUS_COLORS[label.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-widest border ${cls}`}>
      {label}
    </span>
  );
}

// ─── tab types ───────────────────────────────────────────────────────────────

type ReportTab = 'orders' | 'invoices' | 'clients' | 'inventory';

const TABS: { id: ReportTab; label: string; icon: any }[] = [
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'invoices', label: 'Invoices', icon: CreditCard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Box },
];

// ─── main component ─────────────────────────────────────────────────────────

export default function Reports() {
  const printRef = useRef<HTMLDivElement>(null);
  const { active: printActive, print: handlePrint } = useA4Print();
  const defaultRange = thisMonthRange();
  const [tab, setTab] = useState<ReportTab>('orders');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [statusFilter, setStatusFilter] = useState('all');

  // Per-tab offsets for load-more pagination
  const [ordersOffset, setOrdersOffset] = useState(0);
  const [invoicesOffset, setInvoicesOffset] = useState(0);
  const [clientsOffset, setClientsOffset] = useState(0);

  // Accumulated rows across pages
  const [ordersRows, setOrdersRows] = useState<any[]>([]);
  const [invoicesRows, setInvoicesRows] = useState<any[]>([]);
  const [clientsRows, setClientsRows] = useState<any[]>([]);

  // Summaries are only returned by the API on the first page (offset=0).
  // We store them in state so they remain visible while the user loads more rows.
  const [ordersSummary, setOrdersSummary] = useState<any>(null);
  const [invoicesSummary, setInvoicesSummary] = useState<any>(null);
  const [clientsSummary, setClientsSummary] = useState<any>(null);

  // hasMore flags from the latest page response
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [invoicesHasMore, setInvoicesHasMore] = useState(false);
  const [clientsHasMore, setClientsHasMore] = useState(false);

  const { data: settings } = useGetSettings();

  // Reset pagination when filters change
  const resetPagination = () => {
    setOrdersOffset(0);
    setInvoicesOffset(0);
    setClientsOffset(0);
    setOrdersRows([]);
    setInvoicesRows([]);
    setClientsRows([]);
    setOrdersSummary(null);
    setInvoicesSummary(null);
    setClientsSummary(null);
    setOrdersHasMore(false);
    setInvoicesHasMore(false);
    setClientsHasMore(false);
  };

  // ── Orders report ──────────────────────────────────────────────────
  const { isLoading: ordersLoading } = useQuery({
    queryKey: ['report-orders', from, to, statusFilter, ordersOffset],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, offset: String(ordersOffset) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await apiFetch<any>(`/api/reports/orders?${params}`);
      if (ordersOffset === 0) {
        setOrdersRows(data.rows ?? []);
      } else {
        setOrdersRows(prev => [...prev, ...(data.rows ?? [])]);
      }
      if (data.summary != null) setOrdersSummary(data.summary);
      setOrdersHasMore(!!data.hasMore);
      return data;
    },
    enabled: tab === 'orders',
  });

  // ── Invoices report ────────────────────────────────────────────────
  const { isLoading: invoicesLoading } = useQuery({
    queryKey: ['report-invoices', from, to, statusFilter, invoicesOffset],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, offset: String(invoicesOffset) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await apiFetch<any>(`/api/reports/invoices?${params}`);
      if (invoicesOffset === 0) {
        setInvoicesRows(data.rows ?? []);
      } else {
        setInvoicesRows(prev => [...prev, ...(data.rows ?? [])]);
      }
      if (data.summary != null) setInvoicesSummary(data.summary);
      setInvoicesHasMore(!!data.hasMore);
      return data;
    },
    enabled: tab === 'invoices',
  });

  // ── Clients report ─────────────────────────────────────────────────
  const { isLoading: clientsLoading } = useQuery({
    queryKey: ['report-clients', from, to, clientsOffset],
    queryFn: async () => {
      const data = await apiFetch<any>(`/api/reports/clients?from=${from}&to=${to}&offset=${clientsOffset}`);
      if (clientsOffset === 0) {
        setClientsRows(data.rows ?? []);
      } else {
        setClientsRows(prev => [...prev, ...(data.rows ?? [])]);
      }
      if (data.summary != null) setClientsSummary(data.summary);
      setClientsHasMore(!!data.hasMore);
      return data;
    },
    enabled: tab === 'clients',
  });

  // ── Inventory report ───────────────────────────────────────────────
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['report-inventory', from, to],
    queryFn: () => apiFetch<any>(`/api/reports/inventory?from=${from}&to=${to}`),
    enabled: tab === 'inventory',
  });

  const isLoading = ordersLoading || invoicesLoading || clientsLoading || inventoryLoading;

  // ── CSV Export — uses accumulated rows so all loaded pages are included ──
  const handleExport = () => {
    if (tab === 'orders' && ordersRows.length) {
      exportCSV(`orders-${from}-${to}.csv`,
        ['Order #', 'Customer', 'Phone', 'Date', 'Type', 'Status', 'Amount (LKR)', 'Advance (LKR)'],
        ordersRows.map((r: any) => [
          r.order_id, r.customer_name, r.customer_phone ?? '',
          fmtDate(r.created_at), r.order_type ?? 'order', r.status,
          String(r.amount ?? 0), String(r.advance_paid ?? 0),
        ])
      );
    } else if (tab === 'invoices' && invoicesRows.length) {
      exportCSV(`invoices-${from}-${to}.csv`,
        ['Invoice #', 'Client', 'Phone', 'Date', 'Due Date', 'Status', 'Amount (LKR)'],
        invoicesRows.map((r: any) => [
          r.invoice_number, r.client_name, r.client_phone ?? '',
          fmtDate(r.created_at), r.due_date ?? '', r.status, String(r.amount ?? 0),
        ])
      );
    } else if (tab === 'clients' && clientsRows.length) {
      exportCSV(`clients-${from}-${to}.csv`,
        ['Name', 'Phone', 'Email', 'Joined', 'Type', 'Orders', 'Invoices', 'Revenue (LKR)'],
        clientsRows.map((r: any) => [
          r.name, r.phone ?? '', r.email ?? '', fmtDate(r.created_at),
          r.client_type, String(r.order_count), String(r.invoice_count), String(r.total_revenue ?? 0),
        ])
      );
    } else if (tab === 'inventory' && inventoryData?.usageRows) {
      exportCSV(`inventory-usage-${from}-${to}.csv`,
        ['Material', 'Unit', 'Current Stock', 'Used', 'Waste (Invoice)', 'Total Consumed'],
        inventoryData.usageRows.map((r: any) => [
          r.name, r.unit, String(r.current_stock), String(r.used_quantity),
          String(r.waste_quantity), String(r.total_consumed),
        ])
      );
    }
  };

  const businessName = settings?.businessName ?? 'HAVESTORY';

  // ── Summary stats for current tab ─────────────────────────────────
  const renderSummary = () => {
    if (tab === 'orders' && ordersSummary) {
      const s = ordersSummary;
      return (
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground"><span className="font-semibold text-foreground">{s.count}</span> orders</span>
          <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">LKR {fmtAmount(s.totalAmount)}</span></span>
          <span className="text-muted-foreground">Advance: <span className="font-semibold text-foreground">LKR {fmtAmount(s.totalAdvance)}</span></span>
        </div>
      );
    }
    if (tab === 'invoices' && invoicesSummary) {
      const s = invoicesSummary;
      return (
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground"><span className="font-semibold text-foreground">{s.count}</span> invoices</span>
          <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">LKR {fmtAmount(s.totalAmount)}</span></span>
          <span className="text-muted-foreground">Paid: <span className="font-semibold text-emerald-600">LKR {fmtAmount(s.totalPaid)}</span> ({s.paidCount})</span>
        </div>
      );
    }
    if (tab === 'clients' && clientsSummary) {
      const s = clientsSummary;
      return (
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground"><span className="font-semibold text-foreground">{s.totalCount}</span> clients</span>
          <span className="text-muted-foreground">New: <span className="font-semibold text-purple-600">{s.newCount}</span></span>
          <span className="text-muted-foreground">Returning: <span className="font-semibold text-blue-600">{s.returningCount}</span></span>
        </div>
      );
    }
    if (tab === 'inventory' && inventoryData?.summary) {
      const s = inventoryData.summary;
      return (
        <div className="flex gap-6 text-sm">
          <span className="text-muted-foreground"><span className="font-semibold text-foreground">{s.itemCount}</span> materials used</span>
          <span className="text-muted-foreground">Total used: <span className="font-semibold text-foreground">{s.totalUsed}</span> units</span>
          <span className="text-muted-foreground">Total waste: <span className="font-semibold text-red-600">{s.totalWaste}</span> units</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div data-admin-insights="reports" className="admin-insights-page space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* ── Print Header (hidden on screen) ─────────────────────────── */}
      <div ref={printRef} className="hidden print:block pb-report-document">
      <div className="pb-report-letterhead mb-6 border-b border-black pb-4 text-center">
        {settings?.logoUrl && <img src={settings.logoUrl} alt="Logo" className="h-10 mx-auto mb-2" />}
        <h1 className="text-xl font-bold">{businessName}</h1>
        <h2 className="text-base font-semibold mt-1">
          {TABS.find(t => t.id === tab)?.label} Report — {fmtDate(from + 'T00:00:00')} to {fmtDate(to + 'T00:00:00')}
        </h2>
      </div>

      {/* ── Screen UI ─────────────────────────────────────────────────── */}
      <div className="admin-insights-screen print:hidden">
        {/* Page header */}
        <div className="admin-insights-hero flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="admin-insights-kicker">Business intelligence</span>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">Generate and export data reports.</p>
          </div>
          <div className="admin-insights-actions flex items-center gap-2">
            <Button variant="outline" className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-insights-tabs flex border-b border-border gap-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setStatusFilter('all'); resetPagination(); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-widest font-semibold border-b-2 transition-colors ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card className="admin-insights-filter border border-border shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs uppercase tracking-widest font-semibold">From</Label>
                <Input type="date" className="rounded-none mt-1 h-9 w-36" value={from} onChange={e => { setFrom(e.target.value); resetPagination(); }} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-semibold">To</Label>
                <Input type="date" className="rounded-none mt-1 h-9 w-36" value={to} onChange={e => { setTo(e.target.value); resetPagination(); }} />
              </div>
              {(tab === 'orders' || tab === 'invoices') && (
                <div>
                  <Label className="text-xs uppercase tracking-widest font-semibold">Status</Label>
                  <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); resetPagination(); }}>
                    <SelectTrigger className="rounded-none mt-1 h-9 w-36">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {tab === 'orders' && (
                        <>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </>
                      )}
                      {tab === 'invoices' && (
                        <>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="issued">Issued</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="ml-auto">{renderSummary()}</div>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card className="admin-insights-table border border-border shadow-sm bg-card">
          <CardContent className="p-0">
            {tab === 'orders' && (
              <OrdersTable rows={ordersRows} isLoading={ordersLoading} />
            )}
            {tab === 'invoices' && (
              <InvoicesTable rows={invoicesRows} isLoading={invoicesLoading} />
            )}
            {tab === 'clients' && (
              <ClientsTable rows={clientsRows} isLoading={clientsLoading} />
            )}
            {tab === 'inventory' && (
              <InventoryTable rows={inventoryData?.usageRows ?? []} isLoading={inventoryLoading} />
            )}
          </CardContent>
        </Card>

        {/* Load more */}
        {tab === 'orders' && ordersHasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold"
              onClick={() => setOrdersOffset(ordersRows.length)}
              disabled={ordersLoading}
            >
              <ChevronDown className="w-4 h-4 mr-2" />
              {ordersLoading ? 'Loading…' : `Load more (showing ${ordersRows.length} of ${ordersSummary?.count ?? '…'})`}
            </Button>
          </div>
        )}
        {tab === 'invoices' && invoicesHasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold"
              onClick={() => setInvoicesOffset(invoicesRows.length)}
              disabled={invoicesLoading}
            >
              <ChevronDown className="w-4 h-4 mr-2" />
              {invoicesLoading ? 'Loading…' : `Load more (showing ${invoicesRows.length} of ${invoicesSummary?.count ?? '…'})`}
            </Button>
          </div>
        )}
        {tab === 'clients' && clientsHasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold"
              onClick={() => setClientsOffset(clientsRows.length)}
              disabled={clientsLoading}
            >
              <ChevronDown className="w-4 h-4 mr-2" />
              {clientsLoading ? 'Loading…' : `Load more (showing ${clientsRows.length} of ${clientsSummary?.totalCount ?? '…'})`}
            </Button>
          </div>
        )}
      </div>

      {/* ── Print table (always rendered, screen: hidden) ─────────────── */}
      <div>
        {tab === 'orders' && <OrdersTable rows={ordersRows} isLoading={false} />}
        {tab === 'invoices' && <InvoicesTable rows={invoicesRows} isLoading={false} />}
        {tab === 'clients' && <ClientsTable rows={clientsRows} isLoading={false} />}
        {tab === 'inventory' && <InventoryTable rows={inventoryData?.usageRows ?? []} isLoading={false} />}
        <p className="text-xs text-gray-400 mt-6 text-center">
          Printed {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · {businessName}
        </p>
      </div>
      </div>
      <A4PrintPortal active={printActive}>
        <div dangerouslySetInnerHTML={{ __html: printRef.current?.innerHTML ?? '' }} />
      </A4PrintPortal>
    </div>
  );
}

// ─── sub-tables ──────────────────────────────────────────────────────────────

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-12">
        <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">{label}</p>
      </TableCell>
    </TableRow>
  );
}

function OrdersTable({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <Table className="admin-table">
      <TableHeader className="bg-muted/50 border-b border-border">
        <TableRow className="hover:bg-muted/50">
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Order #</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Customer</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Advance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
        ) : !rows.length ? (
          <EmptyRow cols={7} label="No orders found for this date range." />
        ) : rows.map(r => (
          <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
            <TableCell className="font-mono text-sm">{r.order_id}</TableCell>
            <TableCell>
              <div className="font-medium text-sm">{r.customer_name}</div>
              {r.customer_phone && <div className="text-xs text-muted-foreground">{r.customer_phone}</div>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
            <TableCell className="text-sm capitalize text-muted-foreground">{r.service_type_name ?? r.order_type ?? 'Order'}</TableCell>
            <TableCell><Badge label={r.status} /></TableCell>
            <TableCell className="text-right font-mono text-sm">LKR {fmtAmount(r.amount)}</TableCell>
            <TableCell className="text-right font-mono text-sm text-muted-foreground">
              {Number(r.advance_paid) > 0 ? `LKR ${fmtAmount(r.advance_paid)}` : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InvoicesTable({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <Table className="admin-table">
      <TableHeader className="bg-muted/50 border-b border-border">
        <TableRow className="hover:bg-muted/50">
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Invoice #</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
        ) : !rows.length ? (
          <EmptyRow cols={6} label="No invoices found for this date range." />
        ) : rows.map(r => (
          <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
            <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
            <TableCell>
              <div className="font-medium text-sm">{r.client_name}</div>
              {r.client_phone && <div className="text-xs text-muted-foreground">{r.client_phone}</div>}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.due_date ? fmtDate(r.due_date + 'T00:00:00') : '—'}</TableCell>
            <TableCell><Badge label={r.status} /></TableCell>
            <TableCell className="text-right font-mono text-sm">LKR {fmtAmount(r.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClientsTable({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <Table className="admin-table">
      <TableHeader className="bg-muted/50 border-b border-border">
        <TableRow className="hover:bg-muted/50">
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Joined</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Orders</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Invoices</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
        ) : !rows.length ? (
          <EmptyRow cols={6} label="No clients found for this date range." />
        ) : rows.map(r => (
          <TableRow key={`${r.client_type}-${r.id}`} className="hover:bg-muted/40 transition-colors">
            <TableCell>
              <div className="font-medium text-sm">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.phone ?? r.email ?? ''}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
            <TableCell><Badge label={r.client_type} /></TableCell>
            <TableCell className="text-right font-mono text-sm">{r.order_count}</TableCell>
            <TableCell className="text-right font-mono text-sm">{r.invoice_count}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {Number(r.total_revenue) > 0 ? `LKR ${fmtAmount(r.total_revenue)}` : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InventoryTable({ rows, isLoading }: { rows: any[]; isLoading: boolean }) {
  return (
    <Table className="admin-table">
      <TableHeader className="bg-muted/50 border-b border-border">
        <TableRow className="hover:bg-muted/50">
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Material</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Unit</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Current Stock</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Used</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Waste</TableHead>
          <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Total Consumed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
        ) : !rows.length ? (
          <EmptyRow cols={6} label="No inventory items found." />
        ) : rows.map(r => (
          <TableRow key={r.id} className={`hover:bg-muted/40 transition-colors ${Number(r.total_consumed) === 0 ? 'opacity-50' : ''}`}>
            <TableCell className="font-medium text-sm">{r.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.unit}</TableCell>
            <TableCell className={`text-right font-mono text-sm ${Number(r.current_stock) <= Number(r.low_stock_threshold) ? 'text-red-600 font-bold' : 'text-foreground'}`}>
              {r.current_stock}
            </TableCell>
            <TableCell className="text-right font-mono text-sm text-foreground">{r.used_quantity}</TableCell>
            <TableCell className={`text-right font-mono text-sm ${Number(r.waste_quantity) > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {r.waste_quantity}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-semibold">{r.total_consumed}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
