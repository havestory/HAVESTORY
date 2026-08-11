import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// NOTE: client_id, client_phone, and client_email are added at runtime by
// startup-migrations.ts (ALTER TABLE … ADD COLUMN IF NOT EXISTS …).
// They are declared here so Drizzle's typed query builder knows about them.
export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientId: integer("client_id"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  orderId: text("order_id"),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: text("due_date"),
  notes: text("notes"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
