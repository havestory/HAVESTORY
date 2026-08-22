export type ProductChoice = {
  id: string;
  name: string;
  price?: string;
  chargeType?: "flat" | "per_unit";
  imageUrl?: string;
  sizePrices?: { sizeId: string; price: string }[];
};

export type ProductOptionGroup = {
  id: string;
  title: string;
  choices: ProductChoice[];
};

export type ProductSize = {
  id: string;
  name: string;
  packSize?: number;
  unitLabel?: string;
  minQty?: number;
  imageUrl?: string;
  tiers?: { from: number; to: number; pricePerUnit: string }[];
};

export type ProductConfig = {
  optionGroups?: ProductOptionGroup[];
  sizes?: ProductSize[];
  productionTime?: string;
  sizeLabel?: string;
  minQuantity?: number;
  quantityStep?: number;
  stockQty?: string;
  offerEnabled?: boolean;
  offerMinAmount?: number;
  offerMessage?: string;
  codEnabled?: boolean;
  codMessage?: string;
  fullPaymentOfferEnabled?: boolean;
  fullPaymentOfferDiscount?: number;
  fullPaymentOfferMessage?: string;
};

export function parseProductConfig(raw: unknown): ProductConfig {
  if (!raw || typeof raw !== "string") return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function money(value: unknown) {
  const amount = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(amount) ? amount : 0;
}

export function formatMoney(value: unknown) {
  return `Rs. ${money(value).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
