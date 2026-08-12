import { type ReactNode, useState, useCallback, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { PublicLayout }   from './components/layout/PublicLayout';
import { AdminLayout }    from './components/layout/AdminLayout';
import { AuthGuard }      from './components/layout/AuthGuard';
import { SplashScreen }   from './components/SplashScreen';
import { CustomCursor }   from './components/CustomCursor';

// Public Pages
import Home           from './pages/public/Home';
const Store = lazy(() => import('./pages/public/Store'));
const Services = lazy(() => import('./pages/public/Services'));
const Portfolio = lazy(() => import('./pages/public/Portfolio'));
const TrackOrder = lazy(() => import('./pages/public/TrackOrder'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const CustomProject = lazy(() => import('./pages/public/CustomProject'));
const Privacy = lazy(() => import('./pages/public/Privacy'));
const Terms = lazy(() => import('./pages/public/Terms'));
const ClientVerification = lazy(() => import('./pages/ClientVerification'));
const StaffVerification = lazy(() => import('./pages/StaffVerification'));
const ClientAgreement = lazy(() => import('./pages/ClientAgreement'));

// Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const CustomProjects = lazy(() => import('./pages/admin/CustomProjects'));
const Clients = lazy(() => import('./pages/admin/Clients'));
const CRMProjects = lazy(() => import('./pages/admin/CRMProjects'));
const Invoices = lazy(() => import('./pages/admin/Invoices'));
const Products = lazy(() => import('./pages/admin/Products'));
const AdminServices = lazy(() => import('./pages/admin/Services'));
const RawMaterials = lazy(() => import('./pages/admin/RawMaterials'));
const Reviews = lazy(() => import('./pages/admin/Reviews'));
const Messages = lazy(() => import('./pages/admin/Messages'));
const Notices = lazy(() => import('./pages/admin/Notices'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const WebsiteEditor = lazy(() => import('./pages/admin/WebsiteEditor'));
const Finance = lazy(() => import('./pages/admin/Finance'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const ShippingLabels = lazy(() => import('./pages/admin/ShippingLabels'));
const PriceLists = lazy(() => import('./pages/admin/PriceLists'));
const Team = lazy(() => import('./pages/admin/Team'));
const Attendance = lazy(() => import('./pages/admin/Attendance'));
const StaffProfile = lazy(() => import('./pages/admin/StaffProfile'));
const ProductionUsage = lazy(() => import('./pages/admin/ProductionUsage'));
const ClientVerificationReport = lazy(() => import('./pages/admin/ClientVerificationReport'));
const StaffVerificationReport = lazy(() => import('./pages/admin/StaffVerificationReport'));
const ClientAgreementReport = lazy(() => import('./pages/admin/ClientAgreementReport'));

// Public (unlisted)
const PriceListView = lazy(() => import('./pages/public/PriceListView'));
const ShippingVerify = lazy(() => import('./pages/public/ShippingVerify'));

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
const SPLASH_KEY  = 'hs_splash_v2';

function RouteLoader() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-label="Loading section">
      <div className="w-full max-w-xl space-y-4 px-6">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded bg-muted" />)}
        </div>
        <div className="h-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function CursorGate() {
  const [location] = useLocation();
  if (location.startsWith('/admin')) return null;
  return <CustomCursor />;
}

function PublicRoutes() {
  return (
    <PublicLayout>
      <Switch>
        <Route path="/"                   component={Home} />
        <Route path="/store"              component={Store} />
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
    </PublicLayout>
  );
}

function AdminRoutes() {
  return (
    <AuthGuard>
      <AdminLayout>
        <Switch>
          <Route path="/admin"                 component={Dashboard} />
          <Route path="/admin/orders"          component={Orders} />
          <Route path="/admin/custom-projects" component={CustomProjects} />
          <Route path="/admin/clients"         component={Clients} />
          <Route path="/admin/crm-projects"    component={CRMProjects} />
          <Route path="/admin/invoices"        component={Invoices} />
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
          <Route path="/admin/client-verification/:clientId" component={ClientVerificationReport} />
          <Route path="/admin/staff-verification/:staffId" component={StaffVerificationReport} />
          <Route path="/admin/client-agreement/:agreementId" component={ClientAgreementReport} />
          <Route component={NotFound} />
        </Switch>
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
      <Suspense fallback={<RouteLoader />}>
        {isLogin
          ? <Switch><Route path="/admin/login" component={AdminLogin} /><Route component={NotFound} /></Switch>
          : isAdmin
            ? <AdminRoutes />
            : <PublicRoutes />
        }
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try { return !sessionStorage.getItem(SPLASH_KEY); } catch { return false; }
  });
  const handleSplashDone = useCallback(() => {
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch {}
    setShowSplash(false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          {/* Custom cursor only on public site — admin uses system cursor */}
          <CursorGate />
          {showSplash && <SplashScreen onDone={handleSplashDone} />}
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
