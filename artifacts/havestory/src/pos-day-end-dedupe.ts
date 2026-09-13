function dedupePosEnhancements() {
  if (!location.pathname.includes("/admin/pos")) return;
  for (const selector of ["[data-pos-day-close]", "[data-pos-report-tools]", "[data-pos-date-range]"]) {
    const matches = [...document.querySelectorAll(selector)];
    matches.slice(1).forEach((node) => node.remove());
  }
}

const posEnhancementObserver = new MutationObserver(dedupePosEnhancements);
posEnhancementObserver.observe(document.documentElement, { childList: true, subtree: true });
queueMicrotask(dedupePosEnhancements);
