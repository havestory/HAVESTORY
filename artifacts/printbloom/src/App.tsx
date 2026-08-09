import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useGetSettings, setBaseUrl } from "@workspace/api-client-react";
import { setSettingsCache, getSettingsCache } from "@/lib/settings-cache";
import { applyThemeVars } from "@/lib/theme-utils";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import NoticeBanner from "@/components/NoticeBanner";
import NoticePopup from "@/components/NoticePopup";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/SplashScreen";

// Closed Page
import SiteClosed from "@/pages/SiteClosed";

// Public Pages
import Home from "@/pages/Home";
import Store from "@/pages/Store";
import ProductDetail from "@/pages/ProductDetail";
import Services from "@/pages/Services";
import Portfolio from "@/pages/Portfolio";
import TrackOrder from "@/pages/TrackOrder";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import CustomProject from "@/pages/CustomProject";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import PrivatePriceList from "@/pages/PrivatePriceList";
import ShippingVerification from "@/pages/ShippingVerification";
import ClientVerification from "@/pages/ClientVerification";
import StaffVerification from "@/pages/StaffVerification";
import ClientAgreement from "@/pages/ClientAgreement";

// Admin Pages
import AdminLogin from "@/pages/admin/Login";
import AdminLayout from "@/pages/admin/Layout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminOrders from "@/pages/admin/Orders";
import AdminCustomProjects from "@/pages/admin/CustomProjects";
import AdminCRMProjects from "@/pages/admin/CRMProjects";
import AdminClients from "@/pages/admin/Clients";
import AdminInvoices from "@/pages/admin/Invoices";
import AdminReports from "@/pages/admin/Reports";
import AdminProducts from "@/pages/admin/Products";
import AdminServices from "@/pages/admin/Services";
import AdminRawMaterials from "@/pages/admin/RawMaterials";
import AdminNotices from "@/pages/admin/Notices";
import AdminMessages from "@/pages/admin/Messages";
import AdminReviews from "@/pages/admin/Reviews";
import AdminSettings from "@/pages/admin/Settings";
import AdminRevenue from "@/pages/admin/Revenue";
import AdminCoupons from "@/pages/admin/Coupons";
import AdminWebsiteEditor from "@/pages/admin/WebsiteEditor";
import AdminPriceLists from "@/pages/admin/PriceLists";
import AdminShippingLabels from "@/pages/admin/ShippingLabels";
import AdminFinanceInventory from "@/pages/admin/FinanceInventory";
import AdminTeamAccess from "@/pages/admin/TeamAccess";
import AdminAttendance from "@/pages/admin/Attendance";
import AdminProductionUsage from "@/pages/admin/ProductionUsage";
import AdminClientVerificationReport from "@/pages/admin/ClientVerificationReport";
import AdminStaffVerificationReport from "@/pages/admin/StaffVerificationReport";
import AdminStaffProfile from "@/pages/admin/StaffProfile";
import AdminClientAgreementReport from "@/pages/admin/ClientAgreementReport";

// If VITE_API_URL is set (e.g. pointing to a deployed API server on Railway/Render),
// use it as the base for all API calls. Leave unset for same-origin setups.
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL as string);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});


function ScrollToTop() {
  const [location] = useLocation();
  const prevLocation = useRef(location);
  useEffect(() => {
    if (prevLocation.current !== location) {
      prevLocation.current = location;
      // Small delay so the new page content mounts before scrolling
      const raf = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [location]);
  return null;
}

/* Apply cached theme instantly on module load (before React renders) */
(function applyCachedTheme() {
  try {
    const cached = getSettingsCache();
    if (cached?.themePreset) applyThemeVars(cached.themePreset);
  } catch {}
})();

function SiteSetup() {
  const { data: settings } = useGetSettings();
  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    /* Save to localStorage so next page load shows correct logo/theme instantly */
    setSettingsCache(s);

    /* Apply color theme */
    applyThemeVars(s.themePreset ?? "havestory-gallery");

    /* Apply SEO meta tags */
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    document.title = s.seoTitle || s.businessName || "Website";
    if (s.seoDescription) setMeta("description", s.seoDescription);
    if (s.seoKeywords) setMeta("keywords", s.seoKeywords);
    if (s.seoOgImage) { setMeta("og:image", s.seoOgImage, "property"); setMeta("twitter:image", s.seoOgImage); }
    if (s.seoTitle) { setMeta("og:title", s.seoTitle, "property"); setMeta("twitter:title", s.seoTitle); }
    if (s.seoDescription) { setMeta("og:description", s.seoDescription, "property"); setMeta("twitter:description", s.seoDescription); }

    /* Apply dynamic favicon */
    if (s.faviconUrl) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      const ext = s.faviconUrl.split("?")[0].split(".").pop()?.toLowerCase();
      link.type = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "image/x-icon";
      link.href = s.faviconUrl + "?v=" + Date.now();
    }
  }, [settings]);
  return null;
}

function ProtectedAdminRoute({ component: Component, permission }: { component: any; permission?: string }) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Not auth");
      return res.json();
    },
    retry: false
  });

  useEffect(() => {
    if (!isLoading && (error || !data?.authenticated)) {
      setLocation("/admin/login");
    }
  }, [isLoading, error, data, setLocation]);

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#c8d9d7] border-t-[#ff5e3a] rounded-full animate-spin" />
    </div>
  );

  if (error || !data?.authenticated) return null;
  const allowed = data.role !== "staff" || !permission || (data.permissions || []).includes(permission);
  return (
    <AdminLayout>
      {allowed ? <Component /> : (
        <div className="mx-auto mt-16 max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-black text-gray-900">Access restricted</div>
          <p className="mt-2 text-sm text-gray-500">Your staff account does not have permission to open this section. Ask the Owner to update Team Access.</p>
        </div>
      )}
    </AdminLayout>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-40">
        <NoticeBanner />
        <Navigation />
      </div>
      <div className="flex-grow">{children}</div>
      <WhatsAppButton />
      <Footer />
    </div>
  );
}

// Stable route components defined OUTSIDE Router so their references never change.
// If defined inline (arrow functions inside Router), React sees a new component type
// on every Router re-render and unmounts+remounts the entire page, wiping all form/modal state.
const RouteDashboard      = () => <ProtectedAdminRoute component={AdminDashboard} permission="dashboard" />;
const RouteOrders         = () => <ProtectedAdminRoute component={AdminOrders} permission="orders" />;
const RouteCustomProjects = () => <ProtectedAdminRoute component={AdminCustomProjects} permission="orders" />;
const RouteCRMProjects = () => <ProtectedAdminRoute component={AdminCRMProjects} permission="customers" />;
const RouteClients        = () => <ProtectedAdminRoute component={AdminClients} permission="customers" />;
const RouteInvoices       = () => <ProtectedAdminRoute component={AdminInvoices} permission="invoices" />;
const RouteReports        = () => <ProtectedAdminRoute component={AdminReports} permission="reports" />;
const RouteProducts       = () => <ProtectedAdminRoute component={AdminProducts} permission="products_view" />;
const RouteServices       = () => <ProtectedAdminRoute component={AdminServices} permission="catalog" />;
const RouteRawMaterials   = () => <ProtectedAdminRoute component={AdminRawMaterials} permission="inventory" />;
const RouteMessages       = () => <ProtectedAdminRoute component={AdminMessages} permission="website" />;
const RouteReviews        = () => <ProtectedAdminRoute component={AdminReviews} permission="website" />;
const RouteNotices        = () => <ProtectedAdminRoute component={AdminNotices} permission="website" />;
const RouteSettings       = () => <ProtectedAdminRoute component={AdminSettings} permission="owner" />;
const RouteWebsiteEditor  = () => <ProtectedAdminRoute component={AdminWebsiteEditor} permission="website" />;
const RouteRevenue        = () => <ProtectedAdminRoute component={AdminRevenue} permission="reports" />;
const RouteCoupons        = () => <ProtectedAdminRoute component={AdminCoupons} permission="owner" />;
const RoutePriceLists      = () => <ProtectedAdminRoute component={AdminPriceLists} permission="price_lists_view" />;
const RouteShippingLabels  = () => <ProtectedAdminRoute component={AdminShippingLabels} permission="shipping" />;
const RouteFinanceInventory = () => <ProtectedAdminRoute component={AdminFinanceInventory} permission="finance" />;
const RouteTeamAccess = () => <ProtectedAdminRoute component={AdminTeamAccess} permission="owner" />;
const RouteAttendance = () => <ProtectedAdminRoute component={AdminAttendance} />;
const RouteProductionUsage = () => <ProtectedAdminRoute component={AdminProductionUsage} permission="production" />;
const RouteClientVerificationReport = () => <ProtectedAdminRoute component={AdminClientVerificationReport} permission="owner" />;
const RouteStaffVerificationReport = () => <ProtectedAdminRoute component={AdminStaffVerificationReport} permission="owner" />;
const RouteStaffProfile = () => <ProtectedAdminRoute component={AdminStaffProfile} permission="owner" />;
const RouteClientAgreementReport = () => <ProtectedAdminRoute component={AdminClientAgreementReport} permission="owner" />;

function Router() {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const isAdmin = location.startsWith("/admin");
  const isClosed = !isAdmin && (settings as any)?.siteClosedEnabled === 1;

  return (
    <Switch>
      {/* Admin Routes — always accessible regardless of site closed status */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={RouteDashboard} />
      <Route path="/admin/orders" component={RouteOrders} />
      <Route path="/admin/custom-projects" component={RouteCustomProjects} />
      <Route path="/admin/crm-projects" component={RouteCRMProjects} />
      <Route path="/admin/clients" component={RouteClients} />
      <Route path="/admin/client-verification/:clientId" component={RouteClientVerificationReport} />
      <Route path="/admin/staff-verification/:staffId" component={RouteStaffVerificationReport} />
      <Route path="/admin/staff/:staffId" component={RouteStaffProfile} />
      <Route path="/admin/client-agreement/:agreementId" component={RouteClientAgreementReport} />
      <Route path="/admin/invoices" component={RouteInvoices} />
      <Route path="/admin/reports" component={RouteReports} />
      <Route path="/admin/products" component={RouteProducts} />
      <Route path="/admin/services" component={RouteServices} />
      <Route path="/admin/raw-materials" component={RouteRawMaterials} />
      <Route path="/admin/messages" component={RouteMessages} />
      <Route path="/admin/reviews" component={RouteReviews} />
      <Route path="/admin/notices" component={RouteNotices} />
      <Route path="/admin/settings" component={RouteSettings} />
      <Route path="/admin/website-editor" component={RouteWebsiteEditor} />
      <Route path="/admin/revenue" component={RouteRevenue} />
      <Route path="/admin/coupons" component={RouteCoupons} />
      <Route path="/admin/price-lists" component={RoutePriceLists} />
      <Route path="/admin/shipping-labels" component={RouteShippingLabels} />
      <Route path="/admin/finance-inventory" component={RouteFinanceInventory} />
      <Route path="/admin/team-access" component={RouteTeamAccess} />
      <Route path="/admin/attendance" component={RouteAttendance} />
      <Route path="/admin/production-usage" component={RouteProductionUsage} />
      <Route path="/admin/*" component={RouteDashboard} />

      {/* Private customer price lists are available only through their exact share URL */}
      <Route path="/price-list/:publicId" component={PrivatePriceList} />
      <Route path="/shipping-check/:token" component={ShippingVerification} />
      <Route path="/client-verification/:token" component={ClientVerification} />
      <Route path="/staff-verification/:token" component={StaffVerification} />
      <Route path="/client-agreement/:token" component={ClientAgreement} />

      {/* Site Closed — show closed page for all public routes when enabled */}
      {isClosed && <Route path="/:rest*" component={SiteClosed} />}

      {/* Public Routes */}
      <Route path="/"><PublicLayout><Home /></PublicLayout></Route>
      <Route path="/store"><PublicLayout><Store /></PublicLayout></Route>
      <Route path="/product/:slug"><PublicLayout><ProductDetail /></PublicLayout></Route>
      <Route path="/services"><PublicLayout><Services /></PublicLayout></Route>
      <Route path="/portfolio"><PublicLayout><Portfolio /></PublicLayout></Route>
      <Route path="/track-order"><PublicLayout><TrackOrder /></PublicLayout></Route>
      <Route path="/about"><PublicLayout><About /></PublicLayout></Route>
      <Route path="/contact"><PublicLayout><Contact /></PublicLayout></Route>
      <Route path="/custom-project"><PublicLayout><CustomProject /></PublicLayout></Route>
      <Route path="/privacy"><PublicLayout><Privacy /></PublicLayout></Route>
      <Route path="/terms"><PublicLayout><Terms /></PublicLayout></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  // Show the branded loader on every public-page refresh while the app settles.
  // Admin pages stay instant so daily back-office work is not interrupted.
  const [splashDone, setSplashDone] = useState(isAdmin);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SiteSetup />
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ScrollToTop />
          <Router />
        </WouterRouter>
        <NoticePopup />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
