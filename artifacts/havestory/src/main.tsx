import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { applyThemeVars } from '@/lib/theme-utils';

import './index.css';
import './public-spacing.css';
import './home-benefits.css';
// Loaded last on purpose: protects the final footer/drawer art direction from
// legacy responsive rules bundled in the older public stylesheets.
import './premium-footer.css';
import './admin-stability.css';
// Canonical 2026 design layer. Keep last so every legacy screen inherits the
// same accessible public and admin visual system.
import './design-refresh.css';

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
