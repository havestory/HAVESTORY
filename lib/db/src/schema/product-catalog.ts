import { index, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

/**
 * Canonical product media library. Variant records reference media rows instead
 * of duplicating URLs, while the legacy customConfig JSON remains available for
 * existing storefronts during the compatibility period.
 */
export const productMediaTable = pgTable("product_media", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  kind: text("kind").notNull().default("gallery"),
  altText: text("alt_text").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: integer("is_primary").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  productUrlUnique: uniqueIndex("product_media_product_url_uidx").on(table.productId, table.url),
  productSortIdx: index("product_media_product_sort_idx").on(table.productId, table.sortOrder),
}));

/** A selectable product size or format variant such as 8x10, A4, or A3. */
export const productSizesTable = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  legacyId: text("legacy_id").notNull(),
  name: text("name").notNull(),
  packSize: integer("pack_size").notNull().default(1),
  unitLabel: text("unit_label").notNull().default("piece"),
  minQty: integer("min_qty").notNull().default(1),
  mediaId: integer("media_id").references(() => productMediaTable.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  productLegacyUnique: uniqueIndex("product_sizes_product_legacy_uidx").on(table.productId, table.legacyId),
  productSortIdx: index("product_sizes_product_sort_idx").on(table.productId, table.sortOrder),
}));

/** Quantity breaks for a size, e.g. 1–9 at Rs. 1,000 and 10+ at Rs. 850. */
export const productSizePriceTiersTable = pgTable("product_size_price_tiers", {
  id: serial("id").primaryKey(),
  sizeId: integer("size_id").notNull().references(() => productSizesTable.id, { onDelete: "cascade" }),
  qtyFrom: integer("qty_from").notNull().default(1),
  qtyTo: integer("qty_to"),
  pricePerUnit: numeric("price_per_unit", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  sizeTierIdx: index("product_size_price_tiers_size_idx").on(table.sizeId, table.qtyFrom),
}));

/** A configurable group such as Paper, Finish, Lamination, or Print Side. */
export const productOptionGroupsTable = pgTable("product_option_groups", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  legacyId: text("legacy_id").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  productLegacyUnique: uniqueIndex("product_option_groups_product_legacy_uidx").on(table.productId, table.legacyId),
  productSortIdx: index("product_option_groups_product_sort_idx").on(table.productId, table.sortOrder),
}));

/** A selectable choice with an optional flat/per-unit price and linked photo. */
export const productOptionChoicesTable = pgTable("product_option_choices", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => productOptionGroupsTable.id, { onDelete: "cascade" }),
  legacyId: text("legacy_id").notNull(),
  name: text("name").notNull(),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
  chargeType: text("charge_type").notNull().default("flat"),
  mediaId: integer("media_id").references(() => productMediaTable.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  groupLegacyUnique: uniqueIndex("product_option_choices_group_legacy_uidx").on(table.groupId, table.legacyId),
  groupSortIdx: index("product_option_choices_group_sort_idx").on(table.groupId, table.sortOrder),
}));

/** Optional overrides for a choice when a specific size is selected. */
export const productChoiceSizePricesTable = pgTable("product_choice_size_prices", {
  id: serial("id").primaryKey(),
  choiceId: integer("choice_id").notNull().references(() => productOptionChoicesTable.id, { onDelete: "cascade" }),
  sizeId: integer("size_id").notNull().references(() => productSizesTable.id, { onDelete: "cascade" }),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
}, (table) => ({
  choiceSizeUnique: uniqueIndex("product_choice_size_prices_choice_size_uidx").on(table.choiceId, table.sizeId),
}));

export type ProductMedia = typeof productMediaTable.$inferSelect;
export type ProductSize = typeof productSizesTable.$inferSelect;
export type ProductSizePriceTier = typeof productSizePriceTiersTable.$inferSelect;
export type ProductOptionGroup = typeof productOptionGroupsTable.$inferSelect;
export type ProductOptionChoice = typeof productOptionChoicesTable.$inferSelect;
export const productCatalogMigrationsTable = pgTable("product_catalog_migrations", {
  version: integer("version").primaryKey(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export type ProductChoiceSizePrice = typeof productChoiceSizePricesTable.$inferSelect;
