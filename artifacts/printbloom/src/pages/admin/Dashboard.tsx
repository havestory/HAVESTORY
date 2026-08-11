import { useGetSiteStats, useListOrders, useListMessages, useGetSettings } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Clock, CheckCircle, MessageSquare, AlertTriangle, Users, Star, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetSiteStats();
  const { data: recentOrders, isLoading: ordersLoading } = useListOrders({ status: 'pending' });
  const { data: unreadMessages, isLoading: messagesLoading } = useListMessages({ read: false });
  const { data: settings } = useGetSettings();

  const statCards = [
    { title: 'Total Orders', value: stats?.totalOrders || 0, icon: Package, link: '/admin/orders', color: 'text-primary' },
    { title: 'Pending Orders', value: stats?.pendingOrders || 0, icon: Clock, link: '/admin/orders?status=pending', color: 'text-amber-500' },
    { title: 'Completed', value: stats?.completedOrders || 0, icon: CheckCircle, link: '/admin/orders?status=completed', color: 'text-green-500' },
    { title: 'Unread Messages', value: stats?.unreadMessages || 0, icon: MessageSquare, link: '/admin/messages', color: 'text-blue-500' },
    { title: 'Low Stock Items', value: stats?.lowStockItems || 0, icon: AlertTriangle, link: '/admin/raw-materials', color: 'text-red-500' },
    { title: 'Happy Clients', value: `${stats?.happyClients || 0}%`, icon: Users, color: 'text-indigo-500' },
    { title: 'Average Rating', value: stats?.starRating?.toFixed(1) || '0.0', icon: Star, link: '/admin/reviews', color: 'text-yellow-500' },
    { title: 'Total Reviews', value: stats?.totalReviews || 0, icon: TrendingUp, link: '/admin/reviews', color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Workshop Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome back. Here is what's happening at {settings?.businessName || 'HAVESTORY'} today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="rounded-none border-border shadow-sm hover-elevate">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-3xl font-serif">{statsLoading ? '-' : stat.value}</p>
              </div>
              <div className={`p-3 bg-muted/50 rounded-none ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </CardContent>
            {stat.link && (
              <div className="border-t border-border bg-muted/20 px-6 py-3">
                <Link href={stat.link} className="text-xs font-medium text-primary hover:text-secondary transition-colors">
                  View Details &rarr;
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-lg">Recent Pending Orders</CardTitle>
              <Button variant="outline" size="sm" asChild className="rounded-none h-8 text-xs">
                <Link href="/admin/orders">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : recentOrders?.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <CheckCircle className="w-8 h-8 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No pending orders. You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders?.slice(0, 5).map(order => (
                  <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{order.orderId}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] uppercase font-bold tracking-widest">{order.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.customerName} &bull; {order.orderType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Due: {order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'N/A'}</p>
                      <Button variant="secondary" size="sm" asChild className="rounded-none h-7 px-3 text-xs">
                        <Link href={`/admin/orders`}>Manage</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-lg">Unread Messages</CardTitle>
              <Button variant="outline" size="sm" asChild className="rounded-none h-8 text-xs">
                <Link href="/admin/messages">View Inbox</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {messagesLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : unreadMessages?.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No unread messages.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {unreadMessages?.slice(0, 5).map(msg => (
                  <div key={msg.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-foreground truncate">{msg.subject}</h4>
                      <span className="text-xs text-muted-foreground shrink-0 ml-4">{new Date(msg.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-2">{msg.fullName}</p>
                    <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{msg.message}</p>
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