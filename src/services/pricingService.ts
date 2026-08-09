/**
 * Pricing Calculation Service for Card Printing
 * Supports both unit-based and qty-range-based pricing modes.
 */

import {
  CustomerCardSelection,
  PricingBreakdown,
  BoardType,
  PrintSide,
  Lamination,
  FinishOption,
  SizeOption,
  PriceOption,
  PricingMode,
} from '@/types/cardPrinting';

class PricingService {
  /**
   * Find the matching price tier for a given quantity.
   * Tiers are sorted ascending by minQuantity; the last matching tier wins.
   */
  private getQtyRangePrice(quantity: number, tiers: PriceOption[]): number {
    if (!tiers || tiers.length === 0) return 0;

    const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    let match = sorted[0]; // fallback: lowest tier

    for (const tier of sorted) {
      if (quantity >= tier.minQuantity) {
        match = tier;
      }
    }

    return match.price;
  }

  /**
   * Resolve the effective unit price for a component given mode + quantity.
   */
  resolvePrice(
    quantity: number,
    pricingMode: PricingMode,
    basePrice: number,
    tiers: PriceOption[]
  ): number {
    if (pricingMode === 'unit') {
      return basePrice;
    }
    // qty-range: use tier price, fall back to basePrice if no tiers defined
    if (!tiers || tiers.length === 0) return basePrice;
    return this.getQtyRangePrice(quantity, tiers);
  }

  /**
   * Calculate a full price breakdown for all selected options.
   */
  calculatePriceBreakdown(
    selection: CustomerCardSelection,
    boardType: BoardType,
    size: SizeOption,
    printSide: PrintSide,
    lamination: Lamination,
    finishOption?: FinishOption
  ): PricingBreakdown {
    const { quantity } = selection;

    const boardTypePrice = this.resolvePrice(
      quantity,
      boardType.pricingMode,
      boardType.basePrice,
      boardType.quantityPricing
    );

    const sizePrice = this.resolvePrice(
      quantity,
      size.pricingMode,
      size.basePrice,
      size.quantityPricing
    );

    const printSidePrice = this.resolvePrice(
      quantity,
      printSide.pricingMode,
      printSide.basePrice,
      printSide.quantityPricing
    );

    const laminationPrice = this.resolvePrice(
      quantity,
      lamination.pricingMode,
      lamination.basePrice,
      lamination.quantityPricing
    );

    const finishOptionPrice = finishOption
      ? this.resolvePrice(
          quantity,
          finishOption.pricingMode,
          finishOption.basePrice,
          finishOption.quantityPricing
        )
      : 0;

    const totalUnitPrice =
      boardTypePrice + sizePrice + printSidePrice + laminationPrice + finishOptionPrice;

    return {
      basePrice: boardType.basePrice,
      boardTypePrice,
      sizePrice,
      printSidePrice,
      laminationPrice,
      finishOptionPrice,
      quantityDiscount: 0,
      totalUnitPrice,
      totalPrice: totalUnitPrice * quantity,
    };
  }

  /**
   * Validate a set of quantity-pricing tiers for gaps and overlaps.
   */
  validatePricingTiers(tiers: PriceOption[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!tiers || tiers.length === 0) return { valid: true, errors }; // empty is fine for unit mode

    const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (cur.maxQuantity !== null && cur.maxQuantity >= next.minQuantity) {
        errors.push(
          `Overlapping ranges: ${cur.minQuantity}–${cur.maxQuantity} and ${next.minQuantity}–${next.maxQuantity ?? '∞'}`
        );
      }
    }

    tiers.forEach((t, i) => {
      if (t.price < 0) errors.push(`Tier ${i + 1}: price cannot be negative`);
      if (t.minQuantity < 1) errors.push(`Tier ${i + 1}: minimum quantity must be ≥ 1`);
    });

    return { valid: errors.length === 0, errors };
  }

  /** Human-readable dimension string */
  getSizeDimensions(size: SizeOption): string {
    const { width, height, unit } = size.dimensions;
    return `${width}${unit} × ${height}${unit}`;
  }
}

export const pricingService = new PricingService();
