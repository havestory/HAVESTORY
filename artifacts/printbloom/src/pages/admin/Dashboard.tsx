import { useGetSiteStats, useListOrders, useListMessages, useGetSettings } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Clock, CheckCircle, MessageSquare, AlertTriangle, Users, Star, TrendingUp, ChevronRight, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

const LIVE_INTERVAL = 30_000; // refresh every 30 s
const liveQuery = { refetchInterval: LIVE_INTERVAL, refetchIntervalInBackground: false };

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, dataUpdatedAt } = useGetSiteStats({ query: liveQuery });
  const { data: recentOrders, isLoading: ordersLoading } = useListOrders({ status: 'pending' }, { query: liveQuery });
  const { data: unreadMessages, isLoading: messagesLoading } = useListMessages({ read: false }, { query: liveQuery });
  const { data: settings } = useGetSettings();

  const statCards = [
    { title: 'Total Orders', value: stats?.totalOrders || 0, icon: Package, link: '/admin/orders', iconBg: 'bg-amber-100', iconColor: 'text-amber-700', borderClass: 'card-accent-l-amber' },
    { title: 'Pending Orders', value: stats?.pendingOrders || 0, icon: Clock, link: '/admin/orders?status=pending', iconBg: 'bg-amber-100', iconColor: 'text-amber-700', borderClass: 'card-accent-l-amber' },
    { title: 'Completed', value: stats?.completedOrders || 0, icon: CheckCircle, link: '/admin/orders?status=completed', iconBg: 'bg-green-100', iconColor: 'text-green-700', borderClass: 'card-accent-l-green' },
    { title: 'Unread Messages', value: stats?.unreadMessages || 0, icon: MessageSquare, link: '/admin/messages', iconBg: 'bg-blue-100', iconColor: 'text-blue-700', borderClass: 'card-accent-l-blue' },
    { title: 'Low Stock Items', value: stats?.lowStockItems || 0, icon: AlertTriangle, link: '/admin/raw-materials', iconBg: 'bg-red-100', iconColor: 'text-red-700', borderClass: 'card-accent-l-red' },
    { title: 'Happy Clients', value: `${stats?.happyClients || 0}%`, icon: Users, iconBg: 'bg-green-100', iconColor: 'text-green-700', borderClass: 'card-accent-l-green' },
    { title: 'Average Rating', value: stats?.starRating?.toFixed(1) || '0.0', icon: Star, link: '/admin/reviews', iconBg: 'bg-amber-100', iconColor: 'text-amber-700', borderClass: 'card-accent-l-amber' },
    { title: 'Total Reviews', value: stats?.totalReviews || 0, icon: TrendingUp, link: '/admin/reviews', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700', borderClass: 'card-accent-l-indigo' },
  ];

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Workshop Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back. Here is what's happening at {settings?.businessName || 'HAVESTORY'} today.</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 uppercase tracking-widest shrink-0 mt-1">
            <RefreshCw className="w-2.5 h-2.5 animate-[spin_3s_linear_infinite] opacity-50" />
            {lastUpdated}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className={`rounded-none border-y border-r border-border shadow-sm hover-lift bg-card ${stat.borderClass}`}>
            <CardContent className="p-5 flex flex-col h-full justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${stat.iconBg} ${stat.iconColor}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="section-label mb-1">{stat.title}</p>
                  <p className="text-4xl font-serif font-bold text-foreground tracking-tight">
                    {statsLoading ? '-' : stat.value}
                  </p>
                </div>
              </div>
              {stat.link && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <Link href={stat.link} className="text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors uppercase tracking-widest inline-flex items-center gap-1">
                    View details <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-none border border-border shadow-sm bg-card">
          <CardHeader className="border-b border-border bg-muted/50 px-5 py-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif text-lg">Recent Pending Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild className="rounded-none h-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              <Link href="/admin/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : recentOrders?.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <CheckCircle className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No pending orders. You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders?.slice(0, 5).map(order => (
                  <div key={order.id} className="px-5 py-4 hover:bg-muted/40 transition-colors flex justify-between items-center group">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{order.orderId}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] uppercase font-bold tracking-widest">{order.status}</span>
                      </div>
                      <p className="font-medium text-foreground">{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Due: {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'N/A'}</p>
                      <Link href={`/admin/orders`} className="text-xs font-semibold text-secondary opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest inline-flex items-center gap-1">
                        Manage <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border border-border shadow-sm bg-card">
          <CardHeader className="border-b border-border bg-muted/50 px-5 py-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif text-lg">Unread Messages</CardTitle>
            <Button variant="ghost" size="sm" asChild className="rounded-none h-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              <Link href="/admin/messages">View Inbox</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {messagesLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : unreadMessages?.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No unread messages.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {unreadMessages?.slice(0, 5).map(msg => (
                  <div key={msg.id} className="px-5 py-4 hover:bg-muted/40 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-foreground truncate">{msg.subject}</h4>
                      <span className="text-xs text-muted-foreground shrink-0 ml-4 font-mono">{new Date(msg.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">{msg.fullName}</p>
                    <p className="text-sm text-foreground/80 line-clamp-1 leading-relaxed">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}