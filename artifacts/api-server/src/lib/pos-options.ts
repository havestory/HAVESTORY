export function discountPosBill(subtotal: number, type: unknown, value: unknown, invoice: boolean) {
  const requested = Number(value ?? 0);
  if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(requested) || requested < 0) throw new Error("Invalid discount amount");
  if (type !== undefined && type !== "amount" && type !== "percent") throw new Error("Invalid discount type");
  if (invoice && requested !== 0) throw new Error("POS discounts cannot change an existing invoice balance");
  if (type === "percent" ? requested > 100 : requested > subtotal) throw new Error("Discount exceeds the bill amount");
  const discount = Math.round((type === "percent" ? subtotal * requested / 100 : requested) * 100);
  return { subtotal: Math.round(subtotal * 100) / 100, total: (Math.round(subtotal * 100) - discount) / 100 };
}

export function validatePosOptions(raw: unknown): Record<string, any> {
  const value: any = raw ?? {};
  if (typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 60000) throw new Error("Invalid item configuration");
  const positive = (n: any) => Number.isSafeInteger(Number(n)) && Number(n) > 0;
  const price = (n: any, optional = false) => (optional && (n === "" || n == null)) || (n !== "" && n != null && Number.isFinite(Number(n)) && Number(n) >= 0);
  const list = (rows: any, max: number) => Array.isArray(rows) && rows.length <= max;
  const ranges = (rows: any) => {
    if (!list(rows, 100) || !rows.length) throw new Error("Add at least one quantity range");
    const sorted = [...rows].sort((a, b) => Number(a?.from) - Number(b?.from));
    sorted.forEach((r, i) => {
      if (!r || !positive(r.from) || !positive(r.to) || Number(r.to) < Number(r.from) || !price(r.pricePerUnit) || (i > 0 && Number(r.from) <= Number(sorted[i - 1].to))) throw new Error("Quantity ranges must be valid and must not overlap");
    });
  };
  for (const key of ["minQuantity", "quantityStep"]) if (value[key] != null && !positive(value[key])) throw new Error("Minimum and step must be positive whole numbers");
  if (value.productType && !["standard", "custom_print", "multi_size_tier"].includes(value.productType)) throw new Error("Invalid POS pricing mode");
  if (value.productType === "custom_print") {
    if (value.pricingModel === "range_per_unit") ranges(value.rangePrices);
    else if (value.pricingModel === "fixed_quantities") {
      const rows = value.fixedPrices;
      if (!list(rows, 100) || !rows.length || rows.some((r: any) => !r || !positive(r.qty) || !price(r.price)) || new Set(rows.map((r: any) => Number(r.qty))).size !== rows.length) throw new Error("Add unique quantities with valid prices");
    } else throw new Error("Select a quantity pricing model");
  }
  const sizes = value.sizes ?? [];
  if (!list(sizes, 50) || (value.productType === "multi_size_tier" && !sizes.length)) throw new Error("Add valid product sizes");
  const sizeIds = new Set();
  for (const size of sizes) {
    if (!size?.id || sizeIds.has(size.id) || !String(size.name || "").trim() || !positive(size.minQty) || !positive(size.packSize)) throw new Error("Complete each size, minimum and quantity step");
    sizeIds.add(size.id); ranges(size.tiers);
  }
  const groups = value.optionGroups ?? [];
  if (!list(groups, 20)) throw new Error("Too many option groups");
  const groupIds = new Set();
  for (const group of groups) {
    if (!group?.id || groupIds.has(group.id) || !String(group.title || "").trim() || !list(group.choices, 50) || !group.choices.length) throw new Error("Each option group needs a title and choices");
    groupIds.add(group.id);
    const choiceIds = new Set();
    for (const choice of group.choices) {
      if (!choice?.id || choiceIds.has(choice.id) || !String(choice.name || "").trim() || !["flat", "per_unit", "qty_range"].includes(choice.chargeType) || !price(choice.price, true)) throw new Error("Complete every choice and price basis");
      choiceIds.add(choice.id);
      if (choice.chargeType === "qty_range") ranges(choice.priceTiers);
      if (choice.sizePrices != null && (!list(choice.sizePrices, 50) || choice.sizePrices.some((p: any) => !p || !sizeIds.has(p.sizeId) || !price(p.price, true)))) throw new Error("Invalid size-specific option price");
    }
  }
  return value;
}
