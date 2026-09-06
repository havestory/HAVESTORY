/** POS quotes use catalogue configuration, never a price submitted by the cashier. */
export function posConfig(raw: unknown): any {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export function quotePosProduct(
  basePrice: number,
  raw: unknown,
  quantity: number,
  sizeId = "",
  choices: Record<string, string> = {},
) {
  const config = posConfig(raw);
  const sizes = Array.isArray(config.sizes) ? config.sizes : [];
  const size = sizes.find((s: any) => s.id === sizeId);
  if (sizes.length && !size) throw new Error("Select a product size");
  const minQty = Math.max(
    1,
    Number(size?.minQty) || Number(config.minQuantity) || 1,
  );
  const step = Math.max(
    1,
    Number(size?.packSize) || Number(config.quantityStep) || 1,
  );
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < minQty ||
    (quantity - minQty) % step !== 0
  )
    throw new Error(`Quantity must start at ${minQty} and increase by ${step}`);
  const tiers = Array.isArray(size?.tiers) ? size.tiers : [];
  const tier = tiers.find(
    (t: any) =>
      quantity >= Number(t.from || 0) &&
      quantity <= Number(t.to || Number.MAX_SAFE_INTEGER),
  );
  if (tiers.length && !tier)
    throw new Error("No price configured for this quantity");
  let unitPrice = tier ? Number(tier.pricePerUnit) : Number(basePrice);
  // Size tiers take precedence. Only active custom pricing models use base tiers.
  if (!sizes.length && config.productType === "custom_print") {
    if (config.pricingModel === "fixed_quantities") {
      const fixed = config.fixedPrices?.find((r: any) => Number(r.qty) === quantity);
      if (!fixed) throw new Error("No price configured for this quantity");
      unitPrice = Number(fixed.price) / quantity;
    } else if (config.pricingModel === "range_per_unit") {
      const range = config.rangePrices?.find((r: any) => quantity >= Number(r.from) && quantity <= Number(r.to));
      if (!range) throw new Error("No price configured for this quantity");
      unitPrice = Number(range.pricePerUnit);
    }
  }
  let flatFee = 0;
  const names: string[] = size ? [String(size.name)] : [];
  for (const group of Array.isArray(config.optionGroups)
    ? config.optionGroups
    : []) {
    if (!Array.isArray(group.choices) || !group.choices.length) continue;
    const choice = group.choices.find((c: any) => c.id === choices[group.id]);
    if (!choice) throw new Error(`Select ${group.title || "a product option"}`);
    const override = choice.sizePrices?.find((p: any) => p.sizeId === sizeId);
    const price = Number(override ? override.price : choice.price || 0);
    if (!Number.isFinite(price) || price < 0)
      throw new Error("Invalid option price");
    if (choice.chargeType === "flat") flatFee += price;
    else if (choice.chargeType === "qty_range") {
      const range = choice.priceTiers?.find((r: any) => quantity >= Number(r.from) && quantity <= Number(r.to));
      if (!range || !Number.isFinite(Number(range.pricePerUnit)) || Number(range.pricePerUnit) < 0) throw new Error("No option price configured for this quantity");
      unitPrice += Number(range.pricePerUnit);
    } else unitPrice += price;
    names.push(String(choice.name));
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0)
    throw new Error("Invalid product price");
  return {
    price: unitPrice + flatFee / quantity,
    lineTotal: Math.round((unitPrice * quantity + flatFee) * 100) / 100,
    minQty,
    step,
    unitLabel: String(size?.unitLabel || "unit"),
    description: names.join(" / "),
  };
}
