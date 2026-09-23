import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { applyThemeVars } from '@/lib/theme-utils';

import './index.css';
import './admin-stability.css';
import './public-spacing.css';
import './design-refresh.css';
import './admin-search.css';
import './pos-unified.css';
import './pos-interface.css';
import './invoice-product-picker.css';
import './invoice-product-picker';

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
