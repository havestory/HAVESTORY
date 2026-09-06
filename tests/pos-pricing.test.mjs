import { strict as assert } from "node:assert";
import { test } from "node:test";
import { quotePosProduct } from "../lib/api-zod/src/pos-pricing.ts";
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
