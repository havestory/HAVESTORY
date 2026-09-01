import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet,
  Plus, Trash2, Printer, Download, ChevronLeft, ChevronRight,
  AlertCircle, Lock, Edit2, BarChart2, ShoppingBag
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useGetSettings } from '@workspace/api-client-react';
import { A4PrintPortal, useA4Print } from '@/components/A4PrintPortal';
import './admin-insights.css';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayYYYYMM() {
  return new Date().toISOString().slice(0, 7);
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}


// ─── types ──────────────────────────────────────────────────────────────────

interface RevenueBreakdown {
  month: string;
  categories: Array<{ category: string; total: number; count: number }>;
  products: Array<{ name: string; revenue: number; qty: number }>;
}

interface FinanceSummary {
  month: string;
  initialBalance: number;
  currentBalance: number;
  income: number;
  expenses: number;
  netProfit: number;
  inventoryValue: number;
  lowStockItems: number;
}

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: string;
  transaction_date: string;
  source: string | null;
  source_ref: string | null;
  invoice_id: string | null;
  created_at: string;
}

const INCOME_CATEGORIES = ['sales', 'service', 'other_income'];
const EXPENSE_CATEGORIES = ['materials', 'rent', 'labour', 'marketing', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Sales',
  service: 'Service',
  other_income: 'Other Revenue',
  materials: 'Materials',
  rent: 'Rent',
  labour: 'Labour',
  marketing: 'Marketing',
  other: 'Other',
  material_purchase: 'Material Purchase',
  project_cost: 'Project Cost',
};

// ─── stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent, sub,
}: {
  label: string; value: string; icon: any; accent?: string; sub?: string;
}) {
  return (
    <Card className="finance-stat-card border border-border shadow-sm bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${accent ?? 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-sm bg-muted flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main component ─────────────────────────────────────────────────────────

export default function Finance() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const { active: printActive, print: handlePrint } = useA4Print();

  const [month, setMonth] = useState(todayYYYYMM);
  const [showAdd, setShowAdd] = useState(false);
  const [showBalanceEdit, setShowBalanceEdit] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [form, setForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'sales',
    description: '',
    amount: '',
    transactionDate: new Date().toISOString().slice(0, 10),
  });

  const { data: settings } = useGetSettings();

  const { data: summary, isLoading: summaryLoading } = useQuery<FinanceSummary>({
    queryKey: ['finance-summary', month],
    queryFn: () => apiFetch(`/api/finance-inventory/summary?month=${month}`),
  });

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ['finance-transactions', month],
    queryFn: () => apiFetch(`/api/finance-inventory/transactions?month=${month}`),
  });

  const { data: breakdown } = useQuery<RevenueBreakdown>({
    queryKey: ['finance-breakdown', month],
    queryFn: () => apiFetch(`/api/finance-inventory/revenue-breakdown?month=${month}`),
  });

  const addTx = useMutation({
    mutationFn: (body: object) => apiFetch('/api/finance-inventory/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary', month] });
      qc.invalidateQueries({ queryKey: ['finance-transactions', month] });
      qc.invalidateQueries({ queryKey: ['finance-breakdown', month] });
      toast({ title: 'Entry added' });
      setShowAdd(false);
      setForm({ type: 'income', category: 'sales', description: '', amount: '', transactionDate: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTx = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/finance-inventory/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary', month] });
      qc.invalidateQueries({ queryKey: ['finance-transactions', month] });
      qc.invalidateQueries({ queryKey: ['finance-breakdown', month] });
      toast({ title: 'Entry deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const setBalance = useMutation({
    mutationFn: (amount: number) => apiFetch('/api/finance-inventory/initial-balance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-summary', month] });
      toast({ title: 'Opening balance updated' });
      setShowBalanceEdit(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Month navigation
  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const monthLabel = new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleAddSubmit = () => {
    const amt = parseFloat(form.amount);
    if (!form.description || !form.category || isNaN(amt) || amt <= 0) {
      toast({ title: 'Please fill all fields with a valid amount', variant: 'destructive' });
      return;
    }
    addTx.mutate({
      type: form.type,
      category: form.category,
      description: form.description,
      amount: amt,
      transactionDate: form.transactionDate,
    });
  };

  const handleExport = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = (transactions ?? []).map(tx => [
      fmtDate(tx.transaction_date), tx.type, CATEGORY_LABELS[tx.category] ?? tx.category,
      tx.description, String(tx.amount),
    ]);
    const csv = [['Date', 'Type', 'Category', 'Description', 'Amount (LKR)'], ...rows]
      .map(row => row.map(value => escape(String(value))).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const netColor = (summary?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600';

  return (
    <div data-admin-insights="finance" className="admin-insights-page space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* ── Print layout (A4, hidden on screen) ─────────────────────── */}
      <div ref={printRef} className="hidden print:block print-report pb-report-document">
        <div className="pb-report-letterhead text-center mb-6 border-b border-black pb-4">
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="Logo" className="h-12 mx-auto mb-2" />
          )}
          <h1 className="text-2xl font-bold">{settings?.businessName ?? 'HAVESTORY'}</h1>
          {settings?.address && <p className="text-sm text-gray-600">{settings.address}</p>}
          {settings?.phone && <p className="text-sm text-gray-600">{settings.phone}</p>}
          <h2 className="text-lg font-semibold mt-3">Monthly Finance Report — {monthLabel}</h2>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 text-center">
          <div className="border border-black p-3">
            <div className="text-xs uppercase tracking-wide text-gray-600">Opening Balance</div>
            <div className="font-bold text-lg">LKR {fmtAmount(summary?.initialBalance ?? 0)}</div>
          </div>
          <div className="border border-black p-3">
            <div className="text-xs uppercase tracking-wide text-gray-600">Revenue</div>
            <div className="font-bold text-lg text-green-700">LKR {fmtAmount(summary?.income ?? 0)}</div>
          </div>
          <div className="border border-black p-3">
            <div className="text-xs uppercase tracking-wide text-gray-600">Expenses</div>
            <div className="font-bold text-lg text-red-700">LKR {fmtAmount(summary?.expenses ?? 0)}</div>
          </div>
          <div className="border border-black p-3">
            <div className="text-xs uppercase tracking-wide text-gray-600">Net Profit</div>
            <div className={`font-bold text-lg ${(summary?.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              LKR {fmtAmount(summary?.netProfit ?? 0)}
            </div>
          </div>
        </div>

        <table className="w-full text-sm border-collapse border border-black">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1 text-left">Date</th>
              <th className="border border-black px-2 py-1 text-left">Type</th>
              <th className="border border-black px-2 py-1 text-left">Category</th>
              <th className="border border-black px-2 py-1 text-left">Description</th>
              <th className="border border-black px-2 py-1 text-right">Amount (LKR)</th>
            </tr>
          </thead>
          <tbody>
            {transactions?.map(tx => (
              <tr key={tx.id}>
                <td className="border border-black px-2 py-1">{fmtDate(tx.transaction_date)}</td>
                <td className="border border-black px-2 py-1 capitalize">{tx.type}</td>
                <td className="border border-black px-2 py-1">{CATEGORY_LABELS[tx.category] ?? tx.category}</td>
                <td className="border border-black px-2 py-1">{tx.description}</td>
                <td className={`border border-black px-2 py-1 text-right font-mono ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                  {tx.type === 'income' ? '+' : '-'}{fmtAmount(Number(tx.amount))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-100">
              <td colSpan={4} className="border border-black px-2 py-1 text-right">Net Profit</td>
              <td className="border border-black px-2 py-1 text-right font-mono">
                {(summary?.netProfit ?? 0) >= 0 ? '+' : ''}{fmtAmount(summary?.netProfit ?? 0)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Printed {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · {settings?.businessName ?? 'HAVESTORY'}
        </p>
      </div>

      <A4PrintPortal active={printActive}>
        <div dangerouslySetInnerHTML={{ __html: printRef.current?.innerHTML ?? '' }} />
      </A4PrintPortal>

      {/* ── Screen UI ─────────────────────────────────────────────────── */}
      <div className="admin-insights-screen print:hidden">
        {/* Header */}
        <div className="admin-insights-hero flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="admin-insights-kicker">Financial overview</span>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Finance</h1>
            <p className="text-muted-foreground mt-1">Track revenue, expenses and monthly profit.</p>
          </div>
          <div className="admin-insights-actions flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-none h-9 w-9" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[130px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" className="rounded-none h-9 w-9" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button variant="outline" className="rounded-none h-9 text-xs uppercase tracking-widest font-semibold" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Entry
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="finance-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-1 relative">
            <StatCard
              label="Opening Balance"
              value={summaryLoading ? '—' : `LKR ${fmtAmount(summary?.initialBalance ?? 0)}`}
              icon={Wallet}
              sub="All-time initial capital"
            />
            <button
              className="absolute top-3 right-12 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setBalanceInput(String(summary?.initialBalance ?? 0)); setShowBalanceEdit(true); }}
              title="Edit opening balance"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <StatCard
            label="Revenue"
            value={summaryLoading ? '—' : `LKR ${fmtAmount(summary?.income ?? 0)}`}
            icon={TrendingUp}
            accent="text-emerald-600"
            sub={`${monthLabel}`}
          />
          <StatCard
            label="Expenses"
            value={summaryLoading ? '—' : `LKR ${fmtAmount(summary?.expenses ?? 0)}`}
            icon={TrendingDown}
            accent="text-red-600"
            sub={`${monthLabel}`}
          />
          <StatCard
            label="Net Profit"
            value={summaryLoading ? '—' : `LKR ${fmtAmount(summary?.netProfit ?? 0)}`}
            icon={DollarSign}
            accent={netColor}
            sub={`Current balance: LKR ${fmtAmount(summary?.currentBalance ?? 0)}`}
          />
        </div>

        {/* ── Revenue Breakdown ─────────────────────────────────────── */}
        {breakdown && (breakdown.categories.length > 0 || breakdown.products.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Income by category — horizontal bar chart */}
            <Card className="finance-surface border border-border shadow-sm bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-secondary" />
                  <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">Revenue by Category</p>
                </div>
                {breakdown.categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No income recorded</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(120, breakdown.categories.length * 40)}>
                    <BarChart
                      data={breakdown.categories.map(c => ({
                        name: CATEGORY_LABELS[c.category] ?? c.category.replace(/_/g, ' '),
                        total: c.total,
                        count: c.count,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 0,
                          fontSize: 12,
                        }}
                        formatter={(value: number, _: any, props: any) => [
                          `LKR ${fmtAmount(value)}`,
                          `${props.payload.count} entr${props.payload.count === 1 ? 'y' : 'ies'}`,
                        ]}
                      />
                      <Bar dataKey="total" radius={0} maxBarSize={18}>
                        {breakdown.categories.map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0
                              ? 'hsl(var(--secondary))'
                              : `hsl(43 62% ${Math.max(30, 50 - i * 6)}%)`
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top products from orders */}
            <Card className="finance-surface border border-border shadow-sm bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-4 h-4 text-secondary" />
                  <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">Top Products &amp; Services</p>
                  <span className="ml-auto text-[9px] text-muted-foreground/60 uppercase tracking-widest">from orders</span>
                </div>
                {breakdown.products.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No orders this month</p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const maxRev = breakdown.products[0]?.revenue ?? 1;
                      return breakdown.products.map((p, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[9px] font-bold text-muted-foreground/50 w-4 shrink-0">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="truncate text-foreground font-medium">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-muted-foreground text-[10px]">
                                ×{p.qty % 1 === 0 ? p.qty : p.qty.toFixed(1)}
                              </span>
                              <span className="font-mono font-semibold text-emerald-600 text-[11px]">
                                LKR {fmtAmount(p.revenue)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1 bg-muted overflow-hidden">
                            <div
                              className="h-full bg-secondary/70 transition-all duration-500"
                              style={{ width: `${Math.round((p.revenue / maxRev) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Transaction Table */}
        <Card className="finance-surface finance-table-surface border border-border shadow-sm bg-card">
          <CardContent className="p-0">
            <Table className="admin-table">
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow className="hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Category</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Description</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : !transactions?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No entries for {monthLabel}.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map(tx => (
                    <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(tx.transaction_date)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-widest border ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {tx.type === 'income' ? 'Revenue' : 'Expense'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {CATEGORY_LABELS[tx.category] ?? tx.category}
                      </TableCell>
                      <TableCell className="text-sm text-foreground max-w-xs truncate">
                        {tx.description}
                        {tx.source === 'invoice_payment' && (
                          <span className="ml-2 text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 font-bold">
                            Auto
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}LKR {fmtAmount(Number(tx.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.source === 'invoice_payment' ? (
                          <span title="Auto-imported from invoice — delete from Invoices page">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto" />
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm('Delete this entry?')) deleteTx.mutate(tx.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Add Entry Dialog ──────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Add Finance Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest font-semibold">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setForm(f => ({ ...f, type: v as 'income' | 'expense', category: v === 'income' ? 'sales' : 'materials' }))}
                >
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Revenue</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-semibold">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="rounded-none mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest font-semibold">Description</Label>
              <Input
                className="rounded-none mt-1"
                placeholder="e.g. Client payment — January batch"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest font-semibold">Amount (LKR)</Label>
                <Input
                  className="rounded-none mt-1"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-semibold">Date</Label>
                <Input
                  className="rounded-none mt-1"
                  type="date"
                  value={form.transactionDate}
                  onChange={e => setForm(f => ({ ...f, transactionDate: e.target.value }))}
                />
              </div>
            </div>
            {form.type === 'income' && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 border border-border">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Invoice payments are auto-imported when an invoice is marked paid. Add manual revenue here only for non-invoice income.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              className="rounded-none bg-primary text-primary-foreground"
              onClick={handleAddSubmit}
              disabled={addTx.isPending}
            >
              {addTx.isPending ? 'Saving…' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Opening Balance Dialog ───────────────────────────────── */}
      <Dialog open={showBalanceEdit} onOpenChange={setShowBalanceEdit}>
        <DialogContent className="rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Set Opening Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The opening balance represents your initial capital before any transactions were recorded.
            </p>
            <div>
              <Label className="text-xs uppercase tracking-widest font-semibold">Amount (LKR)</Label>
              <Input
                className="rounded-none mt-1"
                type="number"
                step={0.01}
                value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setShowBalanceEdit(false)}>Cancel</Button>
            <Button
              className="rounded-none bg-primary text-primary-foreground"
              onClick={() => setBalance.mutate(parseFloat(balanceInput) || 0)}
              disabled={setBalance.isPending}
            >
              {setBalance.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
