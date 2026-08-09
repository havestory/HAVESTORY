import { Link, useLocation } from "wouter";
import { useAdminLogout, useGetSettings } from "@workspace/api-client-react";
import { getSettingsCache } from "@/lib/settings-cache";
import {
  LayoutDashboard, ShoppingBag, Sparkles, Users,
  Receipt, BarChart2, Package, Wrench, FlaskConical,
  Bell, Settings, LogOut, ExternalLink, Search, ChevronUp, ChevronDown,
  Mail, Star, PenSquare, Moon, Sun, Menu, X, Tag, Calculator, FileSpreadsheet, PackageCheck, Landmark, ShieldCheck, CalendarCheck, Factory,
} from "lucide-react";
import { useState, useEffect } from "react";
import AdminNotificationBell from "../../components/AdminNotificationBell";

const NAV_SECTIONS = [
  {
    label: "OVERVIEW",
    items: [{ name: "Dashboard", href: "/admin", icon: LayoutDashboard, permission: "dashboard" }],
  },
  {
    label: "ORDERS",
    items: [
      { name: "All Orders", href: "/admin/orders", icon: ShoppingBag, permission: "orders" },
      { name: "Custom Projects", href: "/admin/custom-projects", icon: Sparkles, permission: "orders" },
    ],
  },
  {
    label: "CRM",
    items: [
      { name: "Clients", href: "/admin/clients", icon: Users, permission: "customers" },
      { name: "Projects", href: "/admin/crm-projects", icon: Sparkles, permission: "customers" },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { name: "Invoices", href: "/admin/invoices", icon: Receipt, permission: "invoices" },
      { name: "Finance & Inventory", href: "/admin/finance-inventory", icon: Landmark, permission: "finance" },
      { name: "Reports", href: "/admin/reports", icon: BarChart2, permission: "reports" },
      { name: "Coupons", href: "/admin/coupons", icon: Tag, permission: "owner" },
    ],
  },
  {
    label: "CATALOG",
    items: [
      { name: "Products", href: "/admin/products", icon: Package, permission: "products_view" },
      { name: "Private Price Lists", href: "/admin/price-lists", icon: FileSpreadsheet, permission: "price_lists_view" },
      { name: "Shipping Labels", href: "/admin/shipping-labels", icon: PackageCheck, permission: "shipping" },
      { name: "Smart Calculator", href: "/admin/label-calculator", icon: Calculator, permission: "catalog" },
      { name: "Services", href: "/admin/services", icon: Wrench, permission: "catalog" },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { name: "Production Usage", href: "/admin/production-usage", icon: Factory, permission: "production" },
      { name: "Raw Materials", href: "/admin/raw-materials", icon: FlaskConical, permission: "inventory" },
    ],
  },
  {
    label: "TEAM",
    items: [
      { name: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
      { name: "Team Access", href: "/admin/team-access", icon: ShieldCheck, ownerOnly: true },
    ],
  },
  {
    label: "WEBSITE",
    items: [
      { name: "Website Editor", href: "/admin/website-editor", icon: PenSquare, permission: "website" },
      { name: "Messages", href: "/admin/messages", icon: Mail, permission: "website" },
      { name: "Reviews", href: "/admin/reviews", icon: Star, permission: "website" },
      { name: "Notices", href: "/admin/notices", icon: Bell, permission: "website" },
      { name: "Settings", href: "/admin/settings", icon: Settings, ownerOnly: true },
    ],
  },
];

const DARK_KEY = "pb_admin_dark";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(DARK_KEY) === "1"; } catch { return false; }
  });

  const { mutate: logout } = useAdminLogout({
    mutation: { onSuccess: () => setLocation("/admin/login") },
  });
  const { data: settings } = useGetSettings({ query: {
    initialData: getSettingsCache() ?? undefined,
    initialDataUpdatedAt: 0,
  } });

  useEffect(() => {
    try { localStorage.setItem(DARK_KEY, dark ? "1" : "0"); } catch {}
  }, [dark]);

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include", cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(setSession).catch(() => setSession(null));
  }, []);

  const visibleSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter((item: any) => {
      if (!session || session.role !== "staff") return true;
      if (item.ownerOnly) return false;
      return !item.permission || (session.permissions || []).includes(item.permission);
    }),
  })).filter(section => section.items.length > 0);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const isActive = (href: string) =>
    href === "/admin" ? location === "/admin" : location.startsWith(href);

  const sidebarBg    = dark ? "bg-[#0f1117] border-white/[0.06]" : "bg-white border-gray-200";
  const sidebarSep   = dark ? "border-white/[0.06]" : "border-gray-100";
  const labelColor   = dark ? "text-gray-600" : "text-gray-400";
  const activeItem   = dark ? "bg-white/[0.08] text-pink-400" : "bg-pink-50 text-pink-600";
  const inactiveItem = dark ? "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900";
  const activeIcon   = dark ? "text-pink-400" : "text-pink-500";
  const inactiveIcon = dark ? "text-gray-600" : "text-gray-400";
  const activeDot    = dark ? "bg-pink-400" : "bg-pink-500";
  const bottomLink   = dark ? "text-gray-500 hover:bg-white/[0.05] hover:text-gray-200" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700";
  const mainBg       = dark ? "bg-[#0c0e14]" : "bg-gray-50";
  const topbarBg     = dark ? "bg-[#0f1117]/90 border-white/[0.05]" : "bg-white/80 border-gray-100";
  const logoSub      = dark ? "text-gray-600" : "text-gray-400";
  const nameText     = dark ? "text-white font-bold text-sm" : "font-bold text-gray-900 text-sm";
  const chev         = dark ? "text-gray-700" : "text-gray-300";

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`px-4 py-4 border-b shrink-0 flex items-center justify-between ${sidebarSep}`}>
        <div className="flex items-center gap-2.5">
          {settings?.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.businessName || "Logo"}
              className={`w-8 h-8 rounded-lg object-contain shrink-0 ${dark ? "bg-white/10" : "bg-gray-50"}`}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              PB
            </div>
          )}
          <div>
            <div className={`leading-tight ${nameText}`}>{settings?.businessName || "PrintBloom"}</div>
            <div className={`text-[10px] leading-tight ${logoSub}`}>{session?.role === "staff" ? "Staff Panel" : "Owner Admin Panel"}</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scroll indicator top */}
      {scrolled && (
        <div className={`flex justify-center py-1 border-b ${sidebarSep}`}>
          <ChevronUp size={14} className={chev} />
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto py-3"
        onScroll={e => setScrolled((e.target as HTMLElement).scrollTop > 0)}
      >
        {visibleSections.map(section => (
          <div key={section.label} className="mb-1">
            <div className={`px-4 py-1.5 text-[9px] font-bold tracking-widest uppercase ${labelColor}`}>
              {section.label}
            </div>
            {section.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-4 py-2 mx-1 rounded-lg text-sm font-medium transition-all ${active ? activeItem : inactiveItem}`}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon size={16} className={active ? activeIcon : inactiveIcon} />
                    {item.name}
                  </span>
                  {active && <span className={`w-1.5 h-1.5 rounded-full ${activeDot}`} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Scroll indicator bottom */}
      <div className={`flex justify-center py-1 border-t ${sidebarSep}`}>
        <ChevronDown size={14} className={chev} />
      </div>

      {/* Bottom links — safe-bottom so iPhone home-indicator doesn't overlap */}
      <div className={`border-t py-2 shrink-0 safe-bottom ${sidebarSep}`}>
        <a href="/track-order" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 px-4 py-2 mx-1 rounded-lg text-sm transition-all ${bottomLink}`}>
          <Search size={15} className={inactiveIcon} />
          Track Order
        </a>
        <a href="/" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 px-4 py-2 mx-1 rounded-lg text-sm transition-all ${bottomLink}`}>
          <ExternalLink size={15} className={inactiveIcon} />
          View Website
        </a>
        <button
          onClick={() => logout()}
          className={`flex items-center gap-2.5 w-full px-4 py-2 mx-1 rounded-lg text-sm transition-all ${dark ? "text-gray-500 hover:bg-red-900/30 hover:text-red-400" : "text-gray-500 hover:bg-red-50 hover:text-red-600"}`}
        >
          <LogOut size={15} className={inactiveIcon} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${dark ? "dark" : ""} ${mainBg}`}>

      {/* Mobile backdrop — tap outside the drawer to close it */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — desktop: fixed, mobile: slide-in drawer */}
      <aside className={`w-56 fixed inset-y-0 left-0 flex flex-col z-40 shadow-sm border-r transition-all duration-300 ease-in-out ${sidebarBg}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-56 min-w-0 min-h-screen overflow-x-hidden">
        {/* Top bar — paddingTop honours iPhone safe-area so the bar doesn't
            slip under the iOS status bar / notch on standalone PWA mode. */}
        <div
          className={`sticky top-0 z-20 backdrop-blur-sm border-b px-4 sm:px-8 py-3 flex items-center justify-between gap-3 transition-colors duration-200 ${topbarBg}`}
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className={`lg:hidden p-2 rounded-xl transition-all ${dark ? "bg-white/[0.08] text-gray-300 hover:bg-white/[0.12]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Spacer on desktop (topbar stays right-aligned) */}
          <div className="flex-1 hidden lg:block" />

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setDark(d => !d)}
              className={`p-2 rounded-xl transition-all ${dark ? "bg-white/[0.08] text-yellow-400 hover:bg-white/[0.12]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <AdminNotificationBell />
          </div>
        </div>

        {/* Page content */}
        <div className="p-4 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
