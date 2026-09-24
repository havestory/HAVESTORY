import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  ShoppingCart,
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
  PlusCircle,
  ChevronRight,
  Clock3,
  BadgeDollarSign,
} from 'lucide-react';
import { useAdminLogout, useGetAdminMe } from '@workspace/api-client-react';

type AdminTheme = 'light' | 'dark';
const THEME_KEY = 'hs_admin_theme';

function loadTheme(): AdminTheme {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const logout = useAdminLogout();
  const { data: admin } = useGetAdminMe({ query: { staleTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false } as any });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(loadTheme);
  const permissions = Array.isArray(admin?.permissions) ? admin.permissions.map(String) : [];
  const canAccess = (permission?: string) => !permission || admin?.role === 'owner' || permissions.includes(permission);

  useEffect(() => {
    document.documentElement.dataset.hsAdminTheme = theme;
    return () => { delete document.documentElement.dataset.hsAdminTheme; };
  }, [theme]);

  useEffect(() => { setSidebarOpen(false); }, [location]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [sidebarOpen]);

  const routeTitles = [
    ['/admin/crm-projects', 'CRM Projects'],
    ['/admin/shipping-labels', 'Shipping Labels'], ['/admin/production-usage', 'Production Usage'],
    ['/admin/website-editor', 'Website Editor'], ['/admin/raw-materials', 'Inventory'],
    ['/admin/price-lists', 'Price Lists'], ['/admin/procurement', 'Procurement'], ['/admin/attendance', 'Attendance'],
    ['/admin/invoices', 'Invoices'], ['/admin/pos', 'POS / Counter Sales'], ['/admin/products', 'Products'], ['/admin/services', 'Services'],
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
      <Link href={href} className={`admin-nav-item${isActive ? ' admin-nav-active' : ''}`} aria-current={isActive ? 'page' : undefined}>
        <Icon size={18} aria-hidden="true" />
        <span>{label}</span>
        {isActive && <ChevronRight size={15} className="admin-nav-chevron" aria-hidden="true" />}
      </Link>
    );
  };

  return (
    <div
      data-admin-panel=""
      data-admin-theme={theme}
      className="admin-frame"
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside id="admin-navigation" className={`admin-sidebar${sidebarOpen ? ' admin-sidebar-open' : ''}`}>
        {/* Logo header */}
        <div className="admin-sidebar-heading">
          <Link href="/admin" className="admin-sidebar-brand">
            <span className="admin-sidebar-monogram">HS</span>
            <span className="admin-sidebar-brand-copy">
              <span className="admin-sidebar-wordmark">HAVESTORY</span>
              <span className="admin-sidebar-subtitle">STUDIO WORKSPACE</span>
            </span>
          </Link>
          <button type="button" className="admin-sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <div className="admin-sidebar-scroll">
          <nav className="admin-sidebar-nav" aria-label="Admin navigation">
            <div>
              <NavItem href="/admin" label="Dashboard" icon={LayoutDashboard} permission="dashboard" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Orders</p>
              <NavItem href="/admin/orders"          label="Orders"          icon={ShoppingCart} permission="orders" />
              <NavItem href="/admin/clients"         label="Clients"         icon={Users} permission="customers" />
              <NavItem href="/admin/crm-projects"    label="CRM Projects"    icon={FolderKanban} permission="customers" />
              <NavItem href="/admin/invoices"        label="Invoices"        icon={FileText} permission="invoices" />
              <NavItem href="/admin/pos"             label="POS / Counter Sales" icon={BadgeDollarSign} permission="pos_access" />
            </div>

            <div className="space-y-1">
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Catalogue</p>
              <NavItem href="/admin/products"      label="Products"  icon={Package} permission="products_view" />
              <NavItem href="/admin/services"      label="Services"  icon={Layers} permission="catalog" />
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
              <NavItem href="/admin/procurement"     label="Procurement"     icon={PlusCircle} permission="production" />
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
        </div>

        {/* Footer — user + controls */}
        <div className="border-t border-sidebar-border px-4 py-4 flex items-center gap-2 bg-admin-brand shrink-0">
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

          {/* The theme control lives here for both desktop and mobile. */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to night mode' : 'Switch to day mode'}
            aria-label={theme === 'light' ? 'Switch to night mode' : 'Switch to day mode'}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-sidebar-foreground/75 hover:text-sidebar-primary hover:bg-sidebar-accent transition-colors shrink-0"
          >
            {theme === 'light'
              ? <Moon className="w-4 h-4" />
              : <Sun  className="w-4 h-4" />
            }
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            disabled={logout.isPending}
            className="w-8 h-8 flex items-center justify-center rounded-sm text-sidebar-foreground/75 hover:text-destructive hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="admin-main">
        <header className="admin-workspace-header">
          <button type="button" className="admin-menu-button" aria-label="Open menu" aria-controls="admin-navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="admin-header-copy">
            <div className="admin-header-eyebrow">HAVESTORY STUDIO <ChevronRight size={12} aria-hidden="true" /> WORKSPACE</div>
            <h1 className="admin-workspace-title">{currentTitle}</h1>
          </div>
          <div className="admin-header-actions">
            <time className="admin-header-date" dateTime={new Date().toISOString().slice(0, 10)}><Clock3 size={15} aria-hidden="true" /> {new Intl.DateTimeFormat('en-LK', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date())}</time>
            {canAccess('orders') && <Link href="/admin/orders" className="admin-new-order"><PlusCircle size={17} aria-hidden="true" /> Orders</Link>}
          </div>
        </header>

        <div className="admin-workspace-content">
          {children}
        </div>
      </main>
    </div>
  );
}
