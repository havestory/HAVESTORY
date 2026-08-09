/**
 * Card Printing Types
 * Supports unit-based pricing (single flat price) and qty-range-based pricing (tiered)
 */

/** How price is determined for an option */
export type PricingMode = 'unit' | 'qty-range';

/** A single quantity-range price tier */
export interface PriceOption {
  minQuantity: number;
  maxQuantity: number | null; // null = unlimited (open-ended upper tier)
  price: number;
}

/** Card physical size option */
export interface SizeOption {
  id: string;
  name: string;
  label: string;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'inch' | 'cm';
  };
  pricingMode: PricingMode;
  basePrice: number;           // used when pricingMode === 'unit'
  quantityPricing: PriceOption[]; // used when pricingMode === 'qty-range'
}

/** One-side or double-side print option */
export interface PrintSide {
  id: string;
  name: 'one-side' | 'double-side';
  label: string;
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
}

/** Lamination surface finish option */
export interface Lamination {
  id: string;
  name:
    | 'none'
    | 'one-side-gloss'
    | 'one-side-matte'
    | 'double-side-gloss'
    | 'double-side-matte';
  label: string;
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
}

/** Any additional finish (spot UV, emboss, foil, etc.) */
export interface FinishOption {
  id: string;
  name: string;
  label: string;
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
}

/** A board-paper type (e.g. 300gsm Art Board, 260gsm Photo Board) */
export interface BoardType {
  id: string;
  name: string;
  label: string;
  description: string;
  gsm: number;
  /** Board base price mode */
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
  sizes: SizeOption[];
  printSides: PrintSide[];
  laminations: Lamination[];
  finishOptions: FinishOption[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Top-level card printing product (contains many board types) */
export interface CardPrintingProduct {
  id: string;
  name: string;
  description: string;
  boardTypes: BoardType[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Customer Selection ───────────────────────────────────────────────────────

export interface CustomerCardSelection {
  boardTypeId: string;
  sizeId: string;
  quantity: number;
  printSideId: string;
  laminationId: string;
  finishOptionId?: string;
}

export interface PricingBreakdown {
  basePrice: number;
  boardTypePrice: number;
  sizePrice: number;
  printSidePrice: number;
  laminationPrice: number;
  finishOptionPrice: number;
  quantityDiscount?: number;
  totalUnitPrice: number;
  totalPrice: number;
}
