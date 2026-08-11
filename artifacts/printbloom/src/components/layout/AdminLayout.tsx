import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  PenTool, 
  Users, 
  FileText, 
  Package, 
  Image as ImageIcon,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Star,
  Bell,
  Layers,
  Box
} from 'lucide-react';
import { useAdminLogout, useGetAdminMe } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/custom-projects', label: 'Custom Projects', icon: PenTool },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/services', label: 'Services', icon: Layers },
  { href: '/admin/portfolio', label: 'Portfolio', icon: ImageIcon },
  { href: '/admin/raw-materials', label: 'Inventory', icon: Box },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { href: '/admin/notices', label: 'Notices', icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const logout = useAdminLogout();
  const { data: admin } = useGetAdminMe();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate({}, {
      onSuccess: () => setLocation('/admin/login')
    });
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 transform lg:translate-x-0 lg:static lg:block ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
          <Link href="/admin" className="font-serif text-xl font-bold text-sidebar-primary">HAVESTORY Admin</Link>
          <button className="lg:hidden text-sidebar-foreground/70" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-4rem-4rem)]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== '/admin' && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-sidebar-primary' : ''}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        
        <div className="absolute bottom-0 w-full h-16 border-t border-sidebar-border p-4 flex items-center justify-between bg-sidebar">
          <div className="flex flex-col truncate">
            <span className="text-sm font-medium truncate">{admin?.username || 'Admin'}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" title="Log out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 bg-background border-b border-border lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-serif font-semibold">Admin Panel</span>
          <div className="w-6" /> {/* Spacer */}
        </header>
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}