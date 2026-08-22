import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { applyThemeVars } from '@/lib/theme-utils';

import './index.css';

// Seed the public Liquid Glass palette before settings arrive so the first paint
// never flashes the legacy darkroom or brown editorial theme.
applyThemeVars('havestory-gallery');

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
