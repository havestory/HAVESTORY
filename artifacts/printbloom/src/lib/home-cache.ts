const PRODUCTS_KEY = "pb_home_products_v1";
const SERVICES_KEY = "pb_home_services_v1";
const INVALIDATE_KEY = "pb_admin_saved_at";

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
  try { localStorage.setItem(INVALIDATE_KEY, String(Date.now())); } catch {}
}

export function getAdminSavedAt(): number {
  try { return parseInt(localStorage.getItem(INVALIDATE_KEY) ?? "0", 10) || 0; } catch { return 0; }
}
