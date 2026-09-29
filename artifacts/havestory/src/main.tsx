import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { applyThemeVars } from '@/lib/theme-utils';

import './index.css';
import './hv-design.css';
import './admin-stability.css';
import './public-spacing.css';
import './design-refresh.css';
import './admin-search.css';
import './pos-unified.css';
import './pos-interface.css';
import './invoice-product-picker.css';
import './reference-refresh.css';
import './public-typography.css';
import './premium-white.css';
import './hero-polish.css';
import './invoice-product-picker';

applyThemeVars('studio-smart');

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

/* Dismiss the static boot loader ("developing frame" in index.html).
   Guarantees: minimum visible time so the animation reads, dismissal on
   window load, and a hard safety timeout so a slow asset can never hang
   the page. Idempotent. */
(function dismissBootLoader() {
  const startedAt = Date.now();
  const MIN_MS = 950;
  const MAX_MS = 3200;
  let done = false;
  function dismiss() {
    if (done) return;
    done = true;
    const el = document.getElementById('hs-boot');
    if (!el) return;
    el.classList.add('is-done');
    window.setTimeout(() => el.remove(), 500);
  }
  function dismissAfterMinimum() {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_MS) dismiss();
    else window.setTimeout(dismiss, MIN_MS - elapsed);
  }
  if (document.readyState === 'complete') {
    dismissAfterMinimum();
  } else {
    window.addEventListener('load', dismissAfterMinimum, { once: true });
  }
  window.setTimeout(dismiss, MAX_MS);
})();
