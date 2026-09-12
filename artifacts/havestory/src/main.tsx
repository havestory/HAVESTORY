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
// Final public cleanup override: keep backgrounds flat and remove decorative
// circle/glow elements without changing cards, buttons, or layout geometry.
import './clean-background.css';
// POS-only cleanup/history enhancer. It removes legacy management/report controls
// from the counter screen and injects a secure From/To bill-history view.
import './pos-cleanup';
// Final admin-only consistency layer. Loaded after legacy styles so search/filter
// bars, form controls, tables and dialogs share one clean visual language.
import './admin-ui-cleanup.css';
// Optical alignment for search icons, button icons, table actions and select triggers.
import './admin-icon-alignment.css';
// Admin typography must stay clean and sans-serif everywhere; no decorative/serif headings.
import './admin-typography.css';

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
