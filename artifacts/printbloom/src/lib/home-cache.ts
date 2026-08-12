const PRODUCTS_KEY = "hs_home_products_v1";
const SERVICES_KEY = "hs_home_services_v1";
const INVALIDATE_KEY = "hs_admin_saved_at";

export function getHomeProductsCache(): any[] | undefined {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return undefined;
}

export function setHomeProductsCache(data: any[]) {
  try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(data)); } catch {}
}

export function getHomeServicesCache(): any[] | undefined {
  try {
    const raw = localStorage.getItem(SERVICES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return undefined;
}

export function setHomeServicesCache(data: any[]) {
  try { localStorage.setItem(SERVICES_KEY, JSON.stringify(data)); } catch {}
}

export function broadcastAdminSave() {
  const timestamp = String(Date.now());
  try { localStorage.setItem(INVALIDATE_KEY, timestamp); } catch {}
  // Storage events do not fire in the tab that made the change. Dispatch a
  // same-tab event as well so the public shell can refresh without a reload.
  try { window.dispatchEvent(new CustomEvent("hs:admin-saved", { detail: { timestamp } })); } catch {}
}

export function getAdminSavedAt(): number {
  try { return parseInt(localStorage.getItem(INVALIDATE_KEY) ?? "0", 10) || 0; } catch { return 0; }
}
