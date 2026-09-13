import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { applyThemeVars } from '@/lib/theme-utils';

import './index.css';
import './public-spacing.css';
import './home-benefits.css';
import './premium-footer.css';
import './admin-stability.css';
import './design-refresh.css';
import './clean-background.css';
import './admin-ui-cleanup.css';
import './admin-icon-alignment.css';
import './admin-typography.css';
import './admin-search.css';
import './pos-unified.css';
import './pos-interface.css';

applyThemeVars('havestory-gallery');

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
