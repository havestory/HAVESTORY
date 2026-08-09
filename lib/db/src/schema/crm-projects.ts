import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crmProjectsTable = pgTable("crm_projects", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull().unique(),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  clientId: integer("client_id"),
  serviceTypeId: integer("service_type_id"),
  status: text("status").notNull().default("planning"),
  description: text("description"),
  totalValue: integer("total_value").default(0),
  amountPaid: integer("amount_paid").default(0),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertCrmProjectSchema = createInsertSchema(crmProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmProject = z.infer<typeof insertCrmProjectSchema>;
export type CrmProject = typeof crmProjectsTable.$inferSelect;
