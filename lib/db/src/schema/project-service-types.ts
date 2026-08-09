import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectServiceTypesTable = pgTable("project_service_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectServiceTypeSchema = createInsertSchema(projectServiceTypesTable).omit({ id: true, createdAt: true });
export type InsertProjectServiceType = z.infer<typeof insertProjectServiceTypeSchema>;
export type ProjectServiceType = typeof projectServiceTypesTable.$inferSelect;
