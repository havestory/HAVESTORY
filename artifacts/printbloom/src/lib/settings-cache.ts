const KEY = "pb_settings_v1";

export function getSettingsCache(): any {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function setSettingsCache(data: any): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}
