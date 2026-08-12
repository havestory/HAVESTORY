import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ChevronRight,
  CircleDollarSign, Clock3, FileText, MessageSquare, Package, Plus,
  RefreshCw, ShoppingBag, TrendingDown, TrendingUp, TriangleAlert, Users,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AdminErrorState, AdminPageSkeleton } from "@/components/admin/AdminPageState";

type DashboardData = {
  rangeDays: number;
  generatedAt: string;
  overview: {
    revenue: number; expenses: number; profit: number; orders: number; clients: number;
    pendingOrders: number; completedOrders: number; unreadMessages: number;
    lowStockItems: number; unpaidInvoices: number; averageRating: number;
  };
  changes: { revenue: number; expenses: number; profit: number; orders: number; clients: number };
  trend: Array<{ date: string; revenue: number; expenses: number; orders: number }>;
  orderStatuses: Array<{ status: string; count: number }>;
  recentOrders: Array<{ id: number; orderId: string; customerName: string; status: string; dueDate?: string; createdAt: string }>;
  recentMessages: Array<{ id: number; fullName: string; subject: string; isRead: boolean; createdAt: string }>;
  revenueCategories: Array<{ category: string; total: number }>;
};

const RANGE_OPTIONS = [
  { days: 7, label: "7 days" }, { days: 30, label: "30 days" },
  { days: 90, label: "90 days" }, { days: 365, label: "1 year" },
];
const STATUS_COLORS = ["#9a6b3f", "#d69e2e", "#2563eb", "#16a34a", "#dc2626", "#64748b"];

async function loadDashboard(days: number): Promise<DashboardData> {
  const response = await fetch(`/api/stats/dashboard?days=${days}`, { credentials: "include" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Dashboard analytics request failed");
  return body;
}

function money(value: number) {
  return `Rs. ${Math.round(value || 0).toLocaleString("en-LK")}`;
}

function shortMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `Rs. ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `Rs. ${(value / 1_000).toFixed(1)}K`;
  return `Rs. ${Math.round(value || 0).toLocaleString("en-LK")}`;
}

function dateLabel(value: string, days: number) {
  const date = new Date(value);
  return date.toLocaleDateString("en-LK", days > 90 ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" });
}

function Change({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const positive = inverse ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${positive ? "text-emerald-700" : "text-red-600"}`}>
      <Icon size={13} /> {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function MetricCard({ label, value, change, icon: Icon, tone = "bronze", inverse = false, detail }: {
  label: string; value: string; change?: number; icon: any; tone?: "bronze"|"green"|"blue"|"red"; inverse?: boolean; detail: string;
}) {
  const tones = {
    bronze: "bg-amber-50 text-amber-800 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tones[tone]}`}><Icon size={19} /></div>
        {change !== undefined && <Change value={change} inverse={inverse} />}
      </div>
      <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

const statusClass = (status: string) => {
  const key = status.toLowerCase();
  if (key === "completed" || key === "paid") return "bg-emerald-50 text-emerald-700";
  if (key === "cancelled" || key === "overdue") return "bg-red-50 text-red-700";
  if (key === "processing" || key === "in_progress") return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-800";
};

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["admin-dashboard", days],
    queryFn: () => loadDashboard(days),
    staleTime: 30_000,
    placeholderData: previous => previous,
  });

  if (isLoading && !data) return <AdminPageSkeleton cards={6} rows={6} />;
  if (isError && !data) return <AdminErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />;
  if (!data) return null;

  const period = RANGE_OPTIONS.find(option => option.days === days)?.label || "30 days";
  const trend = data.trend.map(item => ({ ...item, label: dateLabel(item.date, days) }));
  const totalStatuses = data.orderStatuses.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary">Business overview</div>
          <h1 className="mt-1 font-serif text-3xl font-bold text-foreground sm:text-4xl">HAVESTORY Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Orders, earnings, costs and studio activity in one view.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-card p-1 shadow-sm">
            {RANGE_OPTIONS.map(option => (
              <button key={option.days} onClick={() => setDays(option.days)} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${days === option.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <button onClick={() => void refetch()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground" title="Refresh dashboard">
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Revenue" value={money(data.overview.revenue)} change={data.changes.revenue} icon={TrendingUp} tone="green" detail={`Income in ${period}`} />
        <MetricCard label="Expenses" value={money(data.overview.expenses)} change={data.changes.expenses} inverse icon={TrendingDown} tone="red" detail={`Costs in ${period}`} />
        <MetricCard label="Net profit" value={money(data.overview.profit)} change={data.changes.profit} icon={CircleDollarSign} tone={data.overview.profit >= 0 ? "bronze" : "red"} detail="Revenue minus expenses" />
        <MetricCard label="New orders" value={String(data.overview.orders)} change={data.changes.orders} icon={ShoppingBag} tone="blue" detail={`${data.overview.pendingOrders} currently active`} />
        <MetricCard label="New clients" value={String(data.overview.clients)} change={data.changes.clients} icon={Users} tone="bronze" detail={`Added in ${period}`} />
        <MetricCard label="Unpaid invoices" value={String(data.overview.unpaidInvoices)} icon={FileText} tone={data.overview.unpaidInvoices ? "red" : "green"} detail={`${data.overview.unreadMessages} unread messages`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-serif text-xl font-bold text-foreground">Earnings & expenses</h2><p className="text-xs text-muted-foreground">Financial movement during the selected period</p></div>
            <Link href="/admin/finance" className="inline-flex items-center gap-1 text-xs font-bold text-secondary">Finance <ChevronRight size={14} /></Link>
          </div>
          <div className="mt-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9a6b3f" stopOpacity={0.32}/><stop offset="100%" stopColor="#9a6b3f" stopOpacity={0.02}/></linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dc2626" stopOpacity={0.18}/><stop offset="100%" stopColor="#dc2626" stopOpacity={0.01}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={22} />
                <YAxis tickFormatter={value => shortMoney(Number(value)).replace("Rs. ", "")} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#9a6b3f" strokeWidth={2.5} fill="url(#revenueFill)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#dc2626" strokeWidth={2} fill="url(#expenseFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div><h2 className="font-serif text-xl font-bold text-foreground">Order pipeline</h2><p className="text-xs text-muted-foreground">All active and completed records</p></div>
          {totalStatuses > 0 ? <>
            <div className="relative mt-4 h-[190px]">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.orderStatuses} dataKey="count" nameKey="status" innerRadius={55} outerRadius={78} paddingAngle={3}>{data.orderStatuses.map((_, index) => <Cell key={index} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><div className="text-2xl font-bold">{totalStatuses}</div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Orders</div></div>
            </div>
            <div className="grid grid-cols-2 gap-2">{data.orderStatuses.slice(0, 6).map((item, index) => <div key={item.status} className="flex items-center justify-between gap-2 rounded-lg bg-muted/55 px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2 capitalize"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[index % STATUS_COLORS.length] }} /> <span className="truncate">{item.status.replace(/_/g," ")}</span></span><b>{item.count}</b></div>)}</div>
          </> : <div className="flex h-[270px] items-center justify-center text-sm text-muted-foreground">No order data yet.</div>}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-serif text-lg font-bold">Recent orders</h2><p className="text-xs text-muted-foreground">Latest customer work entering the studio</p></div><Link href="/admin/orders" className="text-xs font-bold text-secondary">View all</Link></div>
          {data.recentOrders.length ? <div className="divide-y divide-border">{data.recentOrders.map(order => <div key={order.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3.5 hover:bg-muted/40"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[11px] font-bold text-secondary">{order.orderId}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusClass(order.status)}`}>{order.status.replace(/_/g," ")}</span></div><div className="mt-1 truncate text-sm font-bold text-foreground">{order.customerName}</div></div><div className="text-right text-[11px] text-muted-foreground"><div>{new Date(order.createdAt).toLocaleDateString("en-LK")}</div>{order.dueDate && <div className="mt-0.5 inline-flex items-center gap-1"><Clock3 size={11}/> Due {new Date(order.dueDate).toLocaleDateString("en-LK")}</div>}</div></div>)}</div> : <div className="p-10 text-center text-sm text-muted-foreground">No orders have been created yet.</div>}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-serif text-lg font-bold">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[{href:"/admin/orders",label:"New order",icon:Plus},{href:"/admin/invoices",label:"Invoice",icon:FileText},{href:"/admin/clients",label:"Client",icon:Users},{href:"/admin/finance",label:"Add expense",icon:Banknote}].map(action => <Link key={action.label} href={action.href} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-xs font-bold text-foreground hover:border-secondary hover:text-secondary"><action.icon size={15}/>{action.label}</Link>)}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="font-serif text-lg font-bold">Needs attention</h2><TriangleAlert size={17} className="text-amber-600" /></div>
            <div className="mt-3 space-y-2">
              <Link href="/admin/raw-materials" className="flex items-center justify-between rounded-lg bg-muted/55 px-3 py-2.5 text-xs"><span className="flex items-center gap-2 font-semibold"><Package size={14}/> Low-stock items</span><b>{data.overview.lowStockItems}</b></Link>
              <Link href="/admin/messages" className="flex items-center justify-between rounded-lg bg-muted/55 px-3 py-2.5 text-xs"><span className="flex items-center gap-2 font-semibold"><MessageSquare size={14}/> Unread messages</span><b>{data.overview.unreadMessages}</b></Link>
              <Link href="/admin/invoices" className="flex items-center justify-between rounded-lg bg-muted/55 px-3 py-2.5 text-xs"><span className="flex items-center gap-2 font-semibold"><FileText size={14}/> Unpaid invoices</span><b>{data.overview.unpaidInvoices}</b></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-serif text-lg font-bold">Orders created</h2><p className="text-xs text-muted-foreground">Volume trend for capacity planning</p></div><CalendarDays size={18} className="text-secondary"/></div><div className="mt-4 h-[210px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:"hsl(var(--muted-foreground))"}} axisLine={false} tickLine={false} minTickGap={22}/><YAxis allowDecimals={false} tick={{fontSize:10,fill:"hsl(var(--muted-foreground))"}} axisLine={false} tickLine={false} width={28}/><Tooltip/><Bar dataKey="orders" name="Orders" fill="#9a6b3f" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-serif text-lg font-bold">Revenue mix</h2><p className="text-xs text-muted-foreground">Income categories in {period}</p></div><CircleDollarSign size={18} className="text-secondary"/></div>{data.revenueCategories.length ? <div className="mt-4 space-y-3">{data.revenueCategories.map((item,index)=>{const max=data.revenueCategories[0]?.total||1;return <div key={item.category}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-semibold capitalize">{item.category.replace(/_/g," ")}</span><b>{money(item.total)}</b></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{width:`${Math.max(4,item.total/max*100)}%`,background:STATUS_COLORS[index%STATUS_COLORS.length]}}/></div></div>})}</div>:<div className="flex h-[210px] items-center justify-center text-sm text-muted-foreground">Revenue appears here when invoices are paid.</div>}</div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Analytics updated {new Date(data.generatedAt).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })}</span><span className="inline-flex items-center gap-1"><Package size={12}/> {data.overview.completedOrders} completed in selected period · Rating {data.overview.averageRating.toFixed(1)}</span></footer>
    </div>
  );
}
