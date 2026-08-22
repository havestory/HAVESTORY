import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id"),
  name: text("name").notNull(),
  invoiceName: text("invoice_name"),
  description: text("description").notNull().default(""),
  price: text("price").notNull().default("0"),
  priceType: text("price_type").notNull().default("per_item"),
  productFormat: text("product_format").notNull().default("ready_made"),
  imageUrl: text("image_url"),
  galleryImages: text("gallery_images"),
  artworkGuideUrl: text("artwork_guide_url"),
  artworkGuideName: text("artwork_guide_name"),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  customConfig: text("custom_config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
