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
  PanelTop,
  Factory,
  FolderKanban,
  Circle,
  PlusCircle,
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
  const { data: admin } = useGetAdminMe({ query: { staleTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false } as any });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(loadTheme);
  const permissions = Array.isArray(admin?.permissions) ? admin.permissions.map(String) : [];
  const canAccess = (permission?: string) => !permission || admin?.role === 'owner' || permissions.includes(permission);

  const routeTitles = [
    ['/admin/custom-projects', 'Custom Projects'], ['/admin/crm-projects', 'CRM Projects'],
    ['/admin/shipping-labels', 'Shipping Labels'], ['/admin/production-usage', 'Production Usage'],
    ['/admin/website-editor', 'Website Editor'], ['/admin/raw-materials', 'Inventory'],
    ['/admin/price-lists', 'Price Lists'], ['/admin/attendance', 'Attendance'],
    ['/admin/invoices', 'Invoices'], ['/admin/products', 'Products'], ['/admin/services', 'Services'],
    ['/admin/portfolio', 'Portfolio'], ['/admin/reviews', 'Reviews'], ['/admin/messages', 'Messages'],
    ['/admin/notices', 'Notices'], ['/admin/finance', 'Finance'], ['/admin/reports', 'Reports'],
    ['/admin/coupons', 'Coupons'], ['/admin/clients', 'Clients'], ['/admin/orders', 'Orders'],
    ['/admin/team', 'Team Access'], ['/admin/settings', 'Settings'], ['/admin', 'Dashboard'],
  ] as const;
  const currentTitle = routeTitles.find(([path]) => path === '/admin' ? location === path : location.startsWith(path))?.[1] || 'Admin';

  const toggleTheme = () => {
    const next: AdminTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation('/admin/login') });
  };

  const NavItem = ({ href, label, icon: Icon, permission }: { href: string; label: string; icon: any; permission?: string }) => {
    if (!canAccess(permission)) return null;
    const isActive = location === href || (href !== '/admin' && location.startsWith(href));
    return (
      <Link href={href}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors cursor-pointer
          ${isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
            : 'text-sidebar-foreground font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
        >
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
          <span className="text-[14px] font-semibold">{label}</span>
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
              <span className="text-sidebar-foreground/70 font-semibold text-[10px] uppercase tracking-widest leading-tight">Admin Panel</span>
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
              <NavItem href="/admin" label="Dashboard" icon={LayoutDashboard} permission="dashboard" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Orders</p>
              <NavItem href="/admin/orders"          label="Orders"          icon={ShoppingCart} permission="orders" />
              <NavItem href="/admin/custom-projects" label="Custom Projects" icon={PenTool} permission="orders" />
              <NavItem href="/admin/clients"         label="Clients"         icon={Users} permission="customers" />
              <NavItem href="/admin/crm-projects"    label="CRM Projects"    icon={FolderKanban} permission="customers" />
              <NavItem href="/admin/invoices"        label="Invoices"        icon={FileText} permission="invoices" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Catalogue</p>
              <NavItem href="/admin/products"      label="Products"  icon={Package} permission="products_view" />
              <NavItem href="/admin/services"      label="Services"  icon={Layers} permission="catalog" />
              <NavItem href="/admin/portfolio"     label="Portfolio" icon={ImageIcon} permission="website" />
              <NavItem href="/admin/raw-materials" label="Inventory" icon={Box} permission="inventory" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Engagement</p>
              <NavItem href="/admin/reviews"  label="Reviews"  icon={Star} permission="website" />
              <NavItem href="/admin/messages" label="Messages" icon={MessageSquare} permission="website" />
              <NavItem href="/admin/notices"  label="Notices"  icon={Bell} permission="website" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Finance</p>
              <NavItem href="/admin/finance"  label="Finance" icon={DollarSign} permission="finance" />
              <NavItem href="/admin/reports"  label="Reports" icon={BarChart2} permission="reports" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Studio Tools</p>
              <NavItem href="/admin/coupons"         label="Coupons"         icon={Tag} permission="owner" />
              <NavItem href="/admin/shipping-labels" label="Shipping Labels" icon={Truck} permission="shipping" />
              <NavItem href="/admin/price-lists"     label="Price Lists"     icon={List} permission="price_lists_view" />
              <NavItem href="/admin/production-usage" label="Production Usage" icon={Factory} permission="production" />
            </div>

            {admin?.role === 'owner' && (
              <div className="space-y-1">
                <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Team</p>
                <NavItem href="/admin/team"       label="Team Access" icon={UserCog} />
                <NavItem href="/admin/attendance" label="Attendance"  icon={CalendarCheck} />
              </div>
            )}
            {admin?.role === 'staff' && (
              <div className="space-y-1">
                <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Team</p>
                <NavItem href="/admin/attendance" label="Attendance" icon={CalendarCheck} />
              </div>
            )}

            <div className="space-y-1 pb-4">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">System</p>
              <NavItem href="/admin/website-editor" label="Website Editor" icon={PanelTop} permission="website" />
              <NavItem href="/admin/settings" label="Settings" icon={Settings} permission="owner" />
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
              <span className="text-[10px] font-semibold text-sidebar-foreground/70 uppercase tracking-widest">Workshop Manager</span>
            </div>
          </div>

          {/* Night mode toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Night Mode' : 'Switch to Day Mode'}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-sidebar-foreground/75 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors shrink-0"
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
            className="w-8 h-8 flex items-center justify-center rounded-sm text-sidebar-foreground/75 hover:text-destructive hover:bg-sidebar-accent transition-colors shrink-0"
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
            className="text-sidebar-foreground/75 hover:text-sidebar-primary transition-colors"
            title={theme === 'light' ? 'Night mode' : 'Day mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </header>

        {/* Desktop workspace bar */}
        <header className="hidden h-16 shrink-0 items-center justify-between border-b border-border bg-card/95 px-6 backdrop-blur lg:flex">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><span>Admin</span><span>/</span><span className="text-secondary">{currentTitle}</span></div>
            <div className="mt-0.5 text-sm font-bold text-foreground">{currentTitle}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 xl:flex"><Circle size={7} fill="currentColor" /> System online</div>
            {canAccess('orders') && <Link href="/admin/orders" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"><PlusCircle size={15}/> New order</Link>}
            <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-secondary" title={theme === 'light' ? 'Night mode' : 'Day mode'}>{theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 animate-in fade-in slide-in-from-bottom-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
