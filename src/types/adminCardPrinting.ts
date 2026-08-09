/**
 * Admin Panel Schema for Card Printing Configuration
 */

import {
  BoardType,
  PrintSide,
  Lamination,
  FinishOption,
  PriceOption,
  SizeOption,
  PricingMode,
} from './cardPrinting';

export interface AdminBoardTypeForm {
  id?: string;
  name: string;
  label: string;
  description: string;
  gsm: number;
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
  isActive: boolean;
}

export interface AdminSizeForm {
  id?: string;
  name: string;
  label: string;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'inch' | 'cm';
  };
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface AdminPrintSideForm {
  id?: string;
  name: 'one-side' | 'double-side';
  label: string;
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
}

export interface AdminLaminationForm {
  id?: string;
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

export interface AdminFinishOptionForm {
  id?: string;
  name: string;
  label: string;
  pricingMode: PricingMode;
  basePrice: number;
  quantityPricing: PriceOption[];
}

/** Full board-type config bundle saved from the admin form */
export interface AdminBoardTypeConfig {
  boardType: AdminBoardTypeForm;
  sizes: AdminSizeForm[];
  printSides: AdminPrintSideForm[];
  laminations: AdminLaminationForm[];
  finishOptions: AdminFinishOptionForm[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface PricingValidation {
  isValid: boolean;
  errors: string[];
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface AdminPricingStats {
  boardTypeCount: number;
  totalSizeVariations: number;
  totalPrintSideVariations: number;
  totalLaminationVariations: number;
  totalFinishVariations: number;
  priceRangeMin: number;
  priceRangeMax: number;
  lastUpdated: Date;
}
