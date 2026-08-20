export type BrandSettings = Record<string, unknown> | null | undefined;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getBusinessName(settings: BrandSettings): string {
  return text(settings?.businessName);
}

export function getBusinessInitials(settings: BrandSettings): string {
  const name = getBusinessName(settings);
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");
}

export function getBusinessEmail(settings: BrandSettings): string {
  return text(settings?.email);
}

export function getBusinessPhone(settings: BrandSettings): string {
  return text(settings?.phone);
}

export function getBusinessWhatsapp(settings: BrandSettings): string {
  return text(settings?.whatsappNumber);
}

export function getBusinessWebsite(settings: BrandSettings): string {
  return text(settings?.website);
}

