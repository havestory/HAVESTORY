import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Scrolls the window back to the top whenever the route changes.
 * Mount once inside the wouter <Router> so it observes every navigation
 * (public pages, admin pages and auth screens alike).
 *
 * In-page anchor jumps (hash links) are left alone, and users who prefer
 * reduced motion get an instant jump instead of a smooth scroll.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // wouter's location does not include the hash, but guard anyway so a
    // same-page anchor navigation is never hijacked.
    if (window.location.hash) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [location]);

  return null;
}
