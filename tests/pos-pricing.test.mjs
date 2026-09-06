import { strict as assert } from "node:assert";
import { test } from "node:test";
import { quotePosProduct } from "../lib/api-zod/src/pos-pricing.ts";
import { discountPosBill, validatePosOptions } from "../artifacts/api-server/src/lib/pos-options.ts";
const config = {
  sizes: [
    {
      id: "a4",
      name: "A4",
      minQty: 10,
      packSize: 10,
      unitLabel: "sheet",
      tiers: [
        { from: 10, to: 19, pricePerUnit: "150" },
        { from: 20, to: 100, pricePerUnit: "120" },
      ],
    },
  ],
  optionGroups: [
    {
      id: "finish",
      title: "Finish",
      choices: [
        {
          id: "cut",
          name: "Cut",
          price: "30",
          sizePrices: [{ sizeId: "a4", price: "20" }],
        },
      ],
    },
  ],
};
test("POS charges configured per-unit tier and size-specific options, not base set price", () => {
  assert.equal(
    quotePosProduct(1500, config, 10, "a4", { finish: "cut" }).price,
    170,
  );
  assert.equal(
    quotePosProduct(1500, config, 20, "a4", { finish: "cut" }).price,
    140,
  );
  assert.equal(
    quotePosProduct(1500, config, 10, "a4", { finish: "cut" }).unitLabel,
    "sheet",
  );
});
test("reject missing selections, invalid increments and unconfigured quantity tiers", () => {
  for (const qty of [0, -1, 11, 10.5, Infinity, 110])
    assert.throws(() =>
      quotePosProduct(1500, config, qty, "a4", { finish: "cut" }),
    );
  assert.throws(() => quotePosProduct(1500, config, 10));
  assert.throws(() => quotePosProduct(1500, config, 10, "a4"));
});
test("simple and POS-only items retain their unit price; invalid prices rejected", () => {
  assert.equal(quotePosProduct(125, "{}", 3).price, 125);
  assert.throws(() => quotePosProduct(NaN, {}, 1));
  assert.throws(() => quotePosProduct(-3, {}, 1));
});

test("flat fees apply once and range options reprice when quantity changes", () => {
  const options = { optionGroups: [{ id: "finish", title: "Finish", choices: [
    { id: "flat", name: "Setup", chargeType: "flat", price: "50" },
    { id: "range", name: "Lamination", chargeType: "qty_range", priceTiers: [{ from: 1, to: 10, pricePerUnit: "5" }, { from: 11, to: 20, pricePerUnit: "3" }] },
  ] }] };
  assert.equal(quotePosProduct(100, options, 10, "", { finish: "flat" }).lineTotal, 1050);
  assert.equal(quotePosProduct(100, options, 11, "", { finish: "flat" }).lineTotal, 1150);
  assert.equal(quotePosProduct(100, options, 3, "", { finish: "flat" }).lineTotal, 350);
  assert.equal(quotePosProduct(100, options, 11, "", { finish: "range" }).lineTotal, 1133);
  assert.throws(() => quotePosProduct(100, options, 21, "", { finish: "range" }));
});

test("fixed quantity totals and active range pricing are respected", () => {
  const fixed = { productType: "custom_print", pricingModel: "fixed_quantities", fixedPrices: [{ qty: 3, price: "100" }] };
  assert.equal(quotePosProduct(999, fixed, 3).lineTotal, 100);
  assert.throws(() => quotePosProduct(999, fixed, 4));
  const range = { productType: "custom_print", pricingModel: "range_per_unit", rangePrices: [{ from: 1, to: 5, pricePerUnit: "10" }] };
  assert.equal(quotePosProduct(999, range, 4).lineTotal, 40);
  assert.equal(quotePosProduct(999, { ...range, productType: "standard" }, 4).lineTotal, 3996);
});

test("bill discounts round in cents and cannot alter invoice settlements", () => {
  assert.deepEqual(discountPosBill(1150, "percent", 10, false), { subtotal: 1150, total: 1035 });
  assert.deepEqual(discountPosBill(999.99, "percent", 10, false), { subtotal: 999.99, total: 899.99 });
  assert.equal(discountPosBill(500, "amount", 25, false).total, 475);
  assert.equal(discountPosBill(500, undefined, undefined, true).total, 500);
  for (const [type, value, invoice] of [["amount", -1, false], ["amount", 501, false], ["percent", 101, false], ["amount", Infinity, false], ["other", 0, false], ["percent", 10, true]]) assert.throws(() => discountPosBill(500, type, value, invoice));
});

test("item validation preserves configuration and rejects malformed or overlapping tiers", () => {
  const value = { minQuantity: 1, quantityStep: 1, productType: "custom_print", pricingModel: "range_per_unit", rangePrices: [{ from: 1, to: 10, pricePerUnit: "12" }], optionGroups: [{ id: "a", title: "Finish", choices: [{ id: "b", name: "None", price: "", chargeType: "flat" }] }] };
  const original = JSON.stringify(value);
  assert.equal(validatePosOptions(value), value);
  assert.equal(JSON.stringify(value), original);
  assert.throws(() => validatePosOptions({ ...value, quantityStep: 0 }));
  assert.throws(() => validatePosOptions({ ...value, rangePrices: [...value.rangePrices, { from: 10, to: 20, pricePerUnit: "5" }] }));
  assert.throws(() => validatePosOptions({ productType: "multi_size_tier", sizes: [] }));
  assert.throws(() => validatePosOptions({ optionGroups: [null] }));
});
