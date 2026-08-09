/**
 * Multi Prints – focused types
 * Board types with Print Sides, Laminations, and Base Price.
 * Each option supports unit-based OR qty-range-based pricing.
 */

export type PricingMode = 'unit' | 'qty-range';

export interface PriceTier {
  minQty: number;
  maxQty: number | null; // null = open-ended (no upper limit)
  price: number;
}

// ─── Print Side ────────────────────────────────────────────────────────────────

export interface PrintSideOption {
  id: string;
  name: 'one-side' | 'double-side';
  label: string;
  pricingMode: PricingMode;
  unitPrice: number;   // used when pricingMode === 'unit'
  tiers: PriceTier[];  // used when pricingMode === 'qty-range'
}

// ─── Lamination ────────────────────────────────────────────────────────────────

export type LaminationName =
  | 'none'
  | 'one-side-gloss'
  | 'one-side-matte'
  | 'double-side-gloss'
  | 'double-side-matte';

export interface LaminationOption {
  id: string;
  name: LaminationName;
  label: string;
  pricingMode: PricingMode;
  unitPrice: number;
  tiers: PriceTier[];
}

// ─── Board Type ────────────────────────────────────────────────────────────────

export interface MultiPrintsBoardType {
  id: string;
  name: string;        // e.g. "300gsm Art Board"
  gsm: number;
  description: string;
  isActive: boolean;
  /** Board base price (the paper/material cost) */
  basePricingMode: PricingMode;
  baseUnitPrice: number;
  baseTiers: PriceTier[];
  printSides: PrintSideOption[];
  laminations: LaminationOption[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── Product ───────────────────────────────────────────────────────────────────

export interface MultiPrintsProduct {
  id: string;
  name: 'Multi Prints';
  boardTypes: MultiPrintsBoardType[];
}

// ─── Customer Selection ────────────────────────────────────────────────────────

export interface MultiPrintsSelection {
  boardTypeId: string;
  printSideId: string;
  laminationId: string;
  quantity: number;
}

export interface MultiPrintsPriceBreakdown {
  boardBasePrice: number;
  printSidePrice: number;
  laminationPrice: number;
  unitTotal: number;
  grandTotal: number;
}
