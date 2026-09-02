import { type ComponentType, type ReactNode, useState, useCallback, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary, type ErrorFallbackProps } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { PublicLayout }   from './components/layout/PublicLayout';
import { AdminLayout }    from './components/layout/AdminLayout';
import { AuthGuard }      from './components/layout/AuthGuard';
import { SplashScreen }   from './components/SplashScreen';
import { ShopCartProvider } from './lib/shop-cart';
import { StudioLoader } from './components/StudioLoader';

// Public Pages
import Home           from './pages/public/Home';

// A user can keep the admin open while Vercel replaces a deployment. The old
// page may then request a hashed lazy chunk that no longer exists. Retry once
// with the current index instead of dropping the whole app into a blank error
// screen. Genuine component errors still reach the section error boundary.
function lazyWithRecovery<T extends { default: ComponentType<any> }>(loader: () => Promise<T>) {
  return lazy(async () => {
    const key = `hs-chunk-recovery:${window.location.pathname}`;
    try {
      const module = await loader();
      sessionStorage.removeItem(key);
      return module;
    } catch (error) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return new Promise<T>(() => undefined);
      }
      sessionStorage.removeItem(key);
      throw error;
    }
  });
}

const Store = lazyWithRecovery(() => import('./pages/public/Store'));
const Checkout = lazyWithRecovery(() => import('./pages/public/Checkout'));
const ProductDetail = lazyWithRecovery(() => import('./pages/public/ProductDetail'));
const Services = lazyWithRecovery(() => import('./pages/public/Services'));
const Portfolio = lazyWithRecovery(() => import('./pages/public/Portfolio'));
const TrackOrder = lazyWithRecovery(() => import('./pages/public/TrackOrder'));
const About = lazyWithRecovery(() => import('./pages/public/About'));
const Contact = lazyWithRecovery(() => import('./pages/public/Contact'));
const CustomProject = lazyWithRecovery(() => import('./pages/public/CustomProject'));
const Privacy = lazyWithRecovery(() => import('./pages/public/Privacy'));
const Terms = lazyWithRecovery(() => import('./pages/public/Terms'));
const ClientVerification = lazyWithRecovery(() => import('./pages/ClientVerification'));
const StaffVerification = lazyWithRecovery(() => import('./pages/StaffVerification'));
const ClientAgreement = lazyWithRecovery(() => import('./pages/ClientAgreement'));

// Admin Pages
const AdminLogin = lazyWithRecovery(() => import('./pages/admin/Login'));
const Dashboard = lazyWithRecovery(() => import('./pages/admin/Dashboard'));
const Orders = lazyWithRecovery(() => import('./pages/admin/Orders'));
const Clients = lazyWithRecovery(() => import('./pages/admin/Clients'));
const CRMProjects = lazyWithRecovery(() => import('./pages/admin/CRMProjects'));
const Invoices = lazyWithRecovery(() => import('./pages/admin/Invoices'));
const Products = lazyWithRecovery(() => import('./pages/admin/Products'));
const AdminServices = lazyWithRecovery(() => import('./pages/admin/Services'));
const RawMaterials = lazyWithRecovery(() => import('./pages/admin/RawMaterials'));
const Reviews = lazyWithRecovery(() => import('./pages/admin/Reviews'));
const Messages = lazyWithRecovery(() => import('./pages/admin/Messages'));
const Notices = lazyWithRecovery(() => import('./pages/admin/Notices'));
const Settings = lazyWithRecovery(() => import('./pages/admin/Settings'));
const WebsiteEditor = lazyWithRecovery(() => import('./pages/admin/WebsiteEditor'));
const Finance = lazyWithRecovery(() => import('./pages/admin/Finance'));
const Reports = lazyWithRecovery(() => import('./pages/admin/Reports'));
const Coupons = lazyWithRecovery(() => import('./pages/admin/Coupons'));
const ShippingLabels = lazyWithRecovery(() => import('./pages/admin/ShippingLabels'));
const PriceLists = lazyWithRecovery(() => import('./pages/admin/PriceLists'));
const Team = lazyWithRecovery(() => import('./pages/admin/Team'));
const Attendance = lazyWithRecovery(() => import('./pages/admin/Attendance'));
const StaffProfile = lazyWithRecovery(() => import('./pages/admin/StaffProfile'));
const ProductionUsage = lazyWithRecovery(() => import('./pages/admin/ProductionUsage'));
const Procurement = lazyWithRecovery(() => import('./pages/admin/Procurement'));
const ClientVerificationReport = lazyWithRecovery(() => import('./pages/admin/ClientVerificationReport'));
const StaffVerificationReport = lazyWithRecovery(() => import('./pages/admin/StaffVerificationReport'));
const ClientAgreementReport = lazyWithRecovery(() => import('./pages/admin/ClientAgreementReport'));
const POS = lazyWithRecovery(() => import('./pages/admin/POS'));

// Public (unlisted)
const PriceListView = lazyWithRecovery(() => import('./pages/public/PriceListView'));
const ShippingVerify = lazyWithRecovery(() => import('./pages/public/ShippingVerify'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});
function RouteLoader() {
  return <StudioLoader label="Preparing your studio collection" />;
}

function PublicRouteLoader() {
  return (
    <div className="hs-public-route-pending" role="status" aria-live="polite" aria-label="Loading page">
      <span />
    </div>
  );
}

function AdminRouteFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-50 text-lg font-black text-red-600">!</div>
        <h1 className="mt-4 font-serif text-2xl font-bold text-foreground">This section needs another try</h1>
        <p className="mt-2 text-sm text-muted-foreground">The admin shell is still running. Retry this section, or return to the dashboard without losing your session.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={resetError} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Try again</button>
          <a href="/admin" className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground">Dashboard</a>
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground">Error reference: {error.name || "SectionError"}</p>
      </div>
    </div>
  );
}

function PublicRoutes() {
  return (
    <PublicLayout>
      <Suspense fallback={<PublicRouteLoader />}>
        <Switch>
          <Route path="/"                   component={Home} />
          <Route path="/store"              component={Store} />
          <Route path="/checkout"            component={Checkout} />
          <Route path="/store/:id"          component={ProductDetail} />
          <Route path="/frames-and-prints"  component={Store} />
          <Route path="/services"           component={Services} />
          <Route path="/studio-services"    component={Services} />
          <Route path="/portfolio"          component={Portfolio} />
          <Route path="/gallery"            component={Portfolio} />
          <Route path="/track-order"        component={TrackOrder} />
          <Route path="/about"              component={About} />
          <Route path="/contact"            component={Contact} />
          <Route path="/custom-project"     component={CustomProject} />
          <Route path="/privacy"            component={Privacy} />
          <Route path="/terms"             component={Terms} />
          <Route path="/price-list/:publicId" component={PriceListView} />
          <Route path="/verify-shipping/:token" component={ShippingVerify} />
          <Route path="/client-verification/:token" component={ClientVerification} />
          <Route path="/staff-verification/:token" component={StaffVerification} />
          <Route path="/client-agreement/:token" component={ClientAgreement} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </PublicLayout>
  );
}

function AdminRoutes() {
  const [location] = useLocation();
  return (
    <AuthGuard>
      <AdminLayout>
        <ErrorBoundary resetKey={location} FallbackComponent={AdminRouteFallback}>
          <Suspense fallback={<RouteLoader />}>
            <Switch>
          <Route path="/admin"                 component={Dashboard} />
          <Route path="/admin/orders"          component={Orders} />
          <Route path="/admin/clients"         component={Clients} />
          <Route path="/admin/crm-projects"    component={CRMProjects} />
          <Route path="/admin/invoices"        component={Invoices} />
          <Route path="/admin/pos"             component={POS} />
          <Route path="/admin/products"        component={Products} />
          <Route path="/admin/services"        component={AdminServices} />
          <Route path="/admin/portfolio"       component={WebsiteEditor} />
          <Route path="/admin/raw-materials"   component={RawMaterials} />
          <Route path="/admin/reviews"         component={Reviews} />
          <Route path="/admin/messages"        component={Messages} />
          <Route path="/admin/notices"         component={Notices} />
          <Route path="/admin/website-editor"  component={WebsiteEditor} />
          <Route path="/admin/settings"        component={Settings} />
          <Route path="/admin/finance"         component={Finance} />
          <Route path="/admin/reports"         component={Reports} />
          <Route path="/admin/coupons"             component={Coupons} />
          <Route path="/admin/shipping-labels"   component={ShippingLabels} />
          <Route path="/admin/price-lists"       component={PriceLists} />
          <Route path="/admin/team"              component={Team} />
          <Route path="/admin/team/:id/profile"  component={StaffProfile} />
          <Route path="/admin/attendance"        component={Attendance} />
          <Route path="/admin/production-usage"  component={ProductionUsage} />
          <Route path="/admin/procurement"       component={Procurement} />
          <Route path="/admin/client-verification/:clientId" component={ClientVerificationReport} />
          <Route path="/admin/staff-verification/:staffId" component={StaffVerificationReport} />
          <Route path="/admin/client-agreement/:agreementId" component={ClientAgreementReport} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </ErrorBoundary>
      </AdminLayout>
    </AuthGuard>
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith('/admin');
  const isLogin = location === '/admin/login';
  return (
    <ErrorBoundary resetKey={location}>
      {isLogin
        ? <Suspense fallback={<RouteLoader />}><Switch><Route path="/admin/login" component={AdminLogin} /><Route component={NotFound} /></Switch></Suspense>
        : isAdmin
          ? <AdminRoutes />
          : <PublicRoutes />
      }
    </ErrorBoundary>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => !window.location.pathname.startsWith('/admin'));
  const handleSplashDone = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          {showSplash && <SplashScreen onDone={handleSplashDone} />}
          <ShopCartProvider><Router /></ShopCartProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
