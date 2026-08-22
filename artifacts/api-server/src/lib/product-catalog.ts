import { db } from "@workspace/db";
import {
  productChoiceSizePricesTable,
  productMediaTable,
  productOptionChoicesTable,
  productOptionGroupsTable,
  productSizePriceTiersTable,
  productSizesTable,
  productsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

type CatalogConfig = {
  sizes?: Array<{
    id?: string;
    name?: string;
    packSize?: number;
    unitLabel?: string;
    minQty?: number;
    imageUrl?: string;
    tiers?: Array<{ from?: number; to?: number; pricePerUnit?: string | number }>;
  }>;
  optionGroups?: Array<{
    id?: string;
    title?: string;
    choices?: Array<{
      id?: string;
      name?: string;
      price?: string | number;
      chargeType?: string;
      imageUrl?: string;
      sizePrices?: Array<{ sizeId?: string; price?: string | number }>;
    }>;
  }>;
};

function parseConfig(raw: string | null | undefined): CatalogConfig {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function positiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function moneyText(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : "0.00";
}

function uniqueUrls(imageUrl: string | null | undefined, galleryImages: string[]) {
  return [...new Set([imageUrl, ...galleryImages].map((value) => cleanText(value)).filter(Boolean))];
}

/**
 * Rebuild the normalized child rows for one product from the current editor
 * payload. Legacy customConfig remains the source of truth during the
 * compatibility period; this table set makes the same data queryable and
 * scalable for future catalog APIs.
 */
export async function syncNormalizedProductCatalog(
  productId: number,
  customConfig: string | null | undefined,
  imageUrl: string | null | undefined,
  galleryImages: string[] = [],
) {
  const config = parseConfig(customConfig);
  const sizes = Array.isArray(config.sizes) ? config.sizes : [];
  const optionGroups = Array.isArray(config.optionGroups) ? config.optionGroups : [];
  const linkedVariantUrls = [
    ...sizes.map((size) => size.imageUrl),
    ...optionGroups.flatMap((group) => (Array.isArray(group.choices) ? group.choices : []).map((choice) => choice.imageUrl)),
  ].filter((url): url is string => typeof url === "string" && url.trim().length > 0);
  const urls = uniqueUrls(imageUrl, [...galleryImages, ...linkedVariantUrls]);

  await db.transaction(async (tx) => {
    await tx.delete(productSizesTable).where(eq(productSizesTable.productId, productId));
    await tx.delete(productOptionGroupsTable).where(eq(productOptionGroupsTable.productId, productId));
    await tx.delete(productMediaTable).where(eq(productMediaTable.productId, productId));

    const mediaRows = urls.length
      ? await tx.insert(productMediaTable).values(urls.map((url, index) => ({
          productId,
          url,
          kind: index === 0 ? "primary" : "gallery",
          altText: "",
          sortOrder: index,
          isPrimary: index === 0 ? 1 : 0,
        }))).returning({ id: productMediaTable.id, url: productMediaTable.url })
      : [];
    const mediaByUrl = new Map(mediaRows.map((row) => [row.url, row.id]));

    const sizeByLegacyId = new Map<string, number>();
    for (const [index, size] of sizes.entries()) {
      const legacyId = cleanText(size.id, `size-${index + 1}`);
      const [savedSize] = await tx.insert(productSizesTable).values({
        productId,
        legacyId,
        name: cleanText(size.name, `Size ${index + 1}`),
        packSize: positiveInt(size.packSize, 1),
        unitLabel: cleanText(size.unitLabel, "piece"),
        minQty: positiveInt(size.minQty, 1),
        mediaId: size.imageUrl ? mediaByUrl.get(cleanText(size.imageUrl)) ?? null : null,
        sortOrder: index,
      }).returning({ id: productSizesTable.id });
      if (!savedSize) continue;
      sizeByLegacyId.set(legacyId, savedSize.id);

      const tiers = Array.isArray(size.tiers) ? size.tiers : [];
      if (tiers.length) {
        await tx.insert(productSizePriceTiersTable).values(tiers.map((tier, tierIndex) => ({
          sizeId: savedSize.id,
          qtyFrom: positiveInt(tier.from, 1),
          qtyTo: Number(tier.to) > 0 ? Math.round(Number(tier.to)) : null,
          pricePerUnit: moneyText(tier.pricePerUnit),
          sortOrder: tierIndex,
        })));
      }
    }

    for (const [groupIndex, group] of optionGroups.entries()) {
      const groupLegacyId = cleanText(group.id, `group-${groupIndex + 1}`);
      const [savedGroup] = await tx.insert(productOptionGroupsTable).values({
        productId,
        legacyId: groupLegacyId,
        title: cleanText(group.title, `Option group ${groupIndex + 1}`),
        sortOrder: groupIndex,
      }).returning({ id: productOptionGroupsTable.id });
      if (!savedGroup) continue;

      const choices = Array.isArray(group.choices) ? group.choices : [];
      for (const [choiceIndex, choice] of choices.entries()) {
        const [savedChoice] = await tx.insert(productOptionChoicesTable).values({
          groupId: savedGroup.id,
          legacyId: cleanText(choice.id, `choice-${groupIndex + 1}-${choiceIndex + 1}`),
          name: cleanText(choice.name, `Choice ${choiceIndex + 1}`),
          basePrice: moneyText(choice.price),
          chargeType: choice.chargeType === "per_unit" ? "per_unit" : "flat",
          mediaId: choice.imageUrl ? mediaByUrl.get(cleanText(choice.imageUrl)) ?? null : null,
          sortOrder: choiceIndex,
        }).returning({ id: productOptionChoicesTable.id });
        if (!savedChoice) continue;

        const sizePrices = Array.isArray(choice.sizePrices) ? choice.sizePrices : [];
        const overrides = sizePrices
          .map((override) => ({
            choiceId: savedChoice.id,
            sizeId: sizeByLegacyId.get(cleanText(override.sizeId)),
            price: moneyText(override.price),
          }))
          .filter((override): override is { choiceId: number; sizeId: number; price: string } => Number.isFinite(override.sizeId));
        if (overrides.length) {
          await tx.insert(productChoiceSizePricesTable).values(overrides);
        }
      }
    }
  });
}

/** Backfill all existing products once the tables are available. */
export async function syncAllNormalizedProductCatalog() {
  const products = await db.select({
    id: productsTable.id,
    customConfig: productsTable.customConfig,
    imageUrl: productsTable.imageUrl,
    galleryImages: productsTable.galleryImages,
  }).from(productsTable);

  for (const product of products) {
    let gallery: string[] = [];
    try {
      const parsed = product.galleryImages ? JSON.parse(product.galleryImages) : [];
      gallery = Array.isArray(parsed) ? parsed : [];
    } catch {
      gallery = [];
    }
    await syncNormalizedProductCatalog(product.id, product.customConfig, product.imageUrl, gallery);
  }
}
