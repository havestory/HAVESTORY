import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfolioTable = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  clientName: text("client_name"),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  galleryImages: text("gallery_images").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  featured: boolean("featured").notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPortfolioSchema = createInsertSchema(portfolioTable).omit({ id: true, createdAt: true });
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolioTable.$inferSelect;
