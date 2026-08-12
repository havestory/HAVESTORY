import { type ReactNode, useState, useEffect } from 'react';
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
  BarChart2,
  Tag,
  Truck,
  List,
  UserCog,
  CalendarCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { useAdminLogout, useGetAdminMe } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type AdminTheme = 'light' | 'dark';
const THEME_KEY = 'hs_admin_theme';

function loadTheme(): AdminTheme {
  try { return (localStorage.getItem(THEME_KEY) as AdminTheme) || 'light'; } catch { return 'light'; }
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const logout = useAdminLogout();
  const { data: admin } = useGetAdminMe();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(loadTheme);

  const toggleTheme = () => {
    const next: AdminTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };

  const handleLogout = () => {
    logout.mutate({}, { onSuccess: () => setLocation('/admin/login') });
  };

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const isActive = location === href || (href !== '/admin' && location.startsWith(href));
    return (
      <Link href={href}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors cursor-pointer
          ${isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
            : 'text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}
        >
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
          <span className="text-sm">{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div
      data-admin-panel=""
      data-admin-theme={theme}
      className="min-h-screen flex bg-background"
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar border-r border-sidebar-border
        transition-transform duration-300 lg:translate-x-0 lg:static lg:flex
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-serif font-bold flex items-center justify-center text-sm shrink-0">
              HS
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-primary font-serif font-semibold text-base leading-tight">HAVESTORY</span>
              <span className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest leading-tight">Admin Panel</span>
            </div>
          </Link>
          <button className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1">
          <nav className="px-3 py-4 space-y-5">
            <div>
              <NavItem href="/admin" label="Dashboard" icon={LayoutDashboard} />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Orders</p>
              <NavItem href="/admin/orders"          label="Orders"          icon={ShoppingCart} />
              <NavItem href="/admin/custom-projects" label="Custom Projects" icon={PenTool} />
              <NavItem href="/admin/clients"         label="Clients"         icon={Users} />
              <NavItem href="/admin/invoices"        label="Invoices"        icon={FileText} />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Catalogue</p>
              <NavItem href="/admin/products"      label="Products"  icon={Package} />
              <NavItem href="/admin/services"      label="Services"  icon={Layers} />
              <NavItem href="/admin/portfolio"     label="Portfolio" icon={ImageIcon} />
              <NavItem href="/admin/raw-materials" label="Inventory" icon={Box} />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Engagement</p>
              <NavItem href="/admin/reviews"  label="Reviews"  icon={Star} />
              <NavItem href="/admin/messages" label="Messages" icon={MessageSquare} />
              <NavItem href="/admin/notices"  label="Notices"  icon={Bell} />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Finance</p>
              <NavItem href="/admin/finance"  label="Finance" icon={DollarSign} />
              <NavItem href="/admin/reports"  label="Reports" icon={BarChart2} />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Studio Tools</p>
              <NavItem href="/admin/coupons"         label="Coupons"         icon={Tag} />
              <NavItem href="/admin/shipping-labels" label="Shipping Labels" icon={Truck} />
              <NavItem href="/admin/price-lists"     label="Price Lists"     icon={List} />
            </div>

            {admin?.role === 'owner' && (
              <div className="space-y-1">
                <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Team</p>
                <NavItem href="/admin/team"       label="Team Access" icon={UserCog} />
                <NavItem href="/admin/attendance" label="Attendance"  icon={CalendarCheck} />
              </div>
            )}
            {admin?.role === 'staff' && (
              <div className="space-y-1">
                <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Team</p>
                <NavItem href="/admin/attendance" label="Attendance" icon={CalendarCheck} />
              </div>
            )}

            <div className="space-y-1 pb-4">
              <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">System</p>
              <NavItem href="/admin/settings" label="Settings" icon={Settings} />
            </div>
          </nav>
        </ScrollArea>

        {/* Footer — user + controls */}
        <div className="h-16 border-t border-sidebar-border px-3 flex items-center gap-2 bg-sidebar shrink-0">
          {/* Avatar + name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-secondary/20 text-sidebar-primary font-bold text-xs flex items-center justify-center uppercase shrink-0 border border-sidebar-border">
              {admin?.username?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm text-sidebar-foreground font-medium truncate">{admin?.username || 'Admin'}</span>
              <span className="text-[9px] text-sidebar-foreground/35 uppercase tracking-widest">Workshop Manager</span>
            </div>
          </div>

          {/* Night mode toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Night Mode' : 'Switch to Day Mode'}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-sidebar-foreground/50 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors shrink-0"
          >
            {theme === 'light'
              ? <Moon className="w-4 h-4" />
              : <Sun  className="w-4 h-4" />
            }
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Log out"
            className="w-8 h-8 flex items-center justify-center rounded-sm text-sidebar-foreground/50 hover:text-destructive hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Mobile topbar */}
        <header className="h-14 flex items-center justify-between px-4 bg-sidebar border-b border-sidebar-border lg:hidden shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-sidebar-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif font-semibold text-base text-sidebar-foreground">HAVESTORY</span>
          {/* Night mode toggle on mobile topbar */}
          <button
            onClick={toggleTheme}
            className="text-sidebar-foreground/50 hover:text-sidebar-primary transition-colors"
            title={theme === 'light' ? 'Night mode' : 'Day mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </header>

        <div className="flex-1 p-6 lg:p-8 overflow-auto animate-in fade-in slide-in-from-bottom-4">
          {children}
        </div>
      </main>
    </div>
  );
}
