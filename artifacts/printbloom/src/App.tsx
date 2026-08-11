import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { AuthGuard } from './components/layout/AuthGuard';

// Public Pages
import Home from './pages/public/Home';
import Store from './pages/public/Store';
import Services from './pages/public/Services';
import Portfolio from './pages/public/Portfolio';
import TrackOrder from './pages/public/TrackOrder';
import About from './pages/public/About';
import Contact from './pages/public/Contact';

// Admin Pages
import AdminLogin from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Orders from './pages/admin/Orders';
import CustomProjects from './pages/admin/CustomProjects';
import Clients from './pages/admin/Clients';
import Invoices from './pages/admin/Invoices';
import Products from './pages/admin/Products';
import AdminServices from './pages/admin/Services';
import AdminPortfolio from './pages/admin/Portfolio';
import RawMaterials from './pages/admin/RawMaterials';
import Reviews from './pages/admin/Reviews';
import Messages from './pages/admin/Messages';
import Notices from './pages/admin/Notices';
import Settings from './pages/admin/Settings';

const queryClient = new QueryClient();

function PublicRoutes() {
  return (
    <PublicLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/store" component={Store} />
        <Route path="/services" component={Services} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/track-order" component={TrackOrder} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
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
          <Route path="/admin" component={Dashboard} />
          <Route path="/admin/orders" component={Orders} />
          <Route path="/admin/custom-projects" component={CustomProjects} />
          <Route path="/admin/clients" component={Clients} />
          <Route path="/admin/invoices" component={Invoices} />
          <Route path="/admin/products" component={Products} />
          <Route path="/admin/services" component={AdminServices} />
          <Route path="/admin/portfolio" component={AdminPortfolio} />
          <Route path="/admin/raw-materials" component={RawMaterials} />
          <Route path="/admin/reviews" component={Reviews} />
          <Route path="/admin/messages" component={Messages} />
          <Route path="/admin/notices" component={Notices} />
          <Route path="/admin/settings" component={Settings} />
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
    <RoutedErrorBoundary>
      {isLogin ? (
        <Switch>
          <Route path="/admin/login" component={AdminLogin} />
          <Route component={NotFound} />
        </Switch>
      ) : isAdmin ? (
        <AdminRoutes />
      ) : (
        <PublicRoutes />
      )}
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;