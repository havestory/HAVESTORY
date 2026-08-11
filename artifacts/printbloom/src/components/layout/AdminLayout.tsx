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
  Box,
  DollarSign,
  BarChart2
} from 'lucide-react';
import { useAdminLogout, useGetAdminMe } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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

  const NavItem = ({ href, label, icon: Icon }: { href: string, label: string, icon: any }) => {
    const isActive = location === href || (href !== '/admin' && location.startsWith(href));
    return (
      <Link href={href}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors cursor-pointer ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
          <Icon className={`w-4 h-4 ${isActive ? 'text-sidebar-primary' : ''}`} />
          <span className="text-sm">{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 transform lg:translate-x-0 lg:static lg:block ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Link href="/admin" className="flex items-center gap-3 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-serif font-bold flex items-center justify-center text-sm">
              HS
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-primary font-serif font-semibold text-base leading-tight">HAVESTORY</span>
              <span className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest leading-tight">Admin Panel</span>
            </div>
          </Link>
          <button className="lg:hidden text-sidebar-foreground/70" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <nav className="px-3 py-4 space-y-6">
            <div>
              <NavItem href="/admin" label="Dashboard" icon={LayoutDashboard} />
            </div>

            <div className="space-y-1">
              <div className="section-label text-sidebar-foreground/30 px-3 pt-2 pb-1 text-[9px]">ORDERS</div>
              <NavItem href="/admin/orders" label="Orders" icon={ShoppingCart} />
              <NavItem href="/admin/custom-projects" label="Custom Projects" icon={PenTool} />
              <NavItem href="/admin/clients" label="Clients" icon={Users} />
              <NavItem href="/admin/invoices" label="Invoices" icon={FileText} />
            </div>

            <div className="space-y-1">
              <div className="section-label text-sidebar-foreground/30 px-3 pt-2 pb-1 text-[9px]">CATALOGUE</div>
              <NavItem href="/admin/products" label="Products" icon={Package} />
              <NavItem href="/admin/services" label="Services" icon={Layers} />
              <NavItem href="/admin/portfolio" label="Portfolio" icon={ImageIcon} />
              <NavItem href="/admin/raw-materials" label="Inventory" icon={Box} />
            </div>

            <div className="space-y-1">
              <div className="section-label text-sidebar-foreground/30 px-3 pt-2 pb-1 text-[9px]">ENGAGEMENT</div>
              <NavItem href="/admin/reviews" label="Reviews" icon={Star} />
              <NavItem href="/admin/messages" label="Messages" icon={MessageSquare} />
              <NavItem href="/admin/notices" label="Notices" icon={Bell} />
            </div>

            <div className="space-y-1">
              <div className="section-label text-sidebar-foreground/30 px-3 pt-2 pb-1 text-[9px]">FINANCE</div>
              <NavItem href="/admin/finance" label="Finance" icon={DollarSign} />
              <NavItem href="/admin/reports" label="Reports" icon={BarChart2} />
            </div>

            <div className="space-y-1 pb-4">
              <div className="section-label text-sidebar-foreground/30 px-3 pt-2 pb-1 text-[9px]">SYSTEM</div>
              <NavItem href="/admin/settings" label="Settings" icon={Settings} />
            </div>
          </nav>
        </ScrollArea>
        
        <div className="absolute bottom-0 w-full h-16 border-t border-sidebar-border px-4 flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center uppercase shrink-0">
              {admin?.username?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm text-sidebar-foreground truncate">{admin?.username || 'Admin'}</span>
              <span className="text-[10px] text-sidebar-foreground/40">Workshop Manager</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0 rounded-sm" title="Log out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="h-14 flex items-center justify-between px-4 bg-background border-b border-border lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif font-semibold text-lg">HAVESTORY</span>
          <div className="w-5" /> {/* Spacer */}
        </header>
        <div className="flex-1 p-6 lg:p-8 overflow-auto animate-in fade-in slide-in-from-bottom-4">
          {children}
        </div>
      </main>
    </div>
  );
}