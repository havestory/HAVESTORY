import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  trackingToken: text("tracking_token").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address").notNull(),
  orderType: text("order_type").notNull().default("standard"),
  items: text("items").notNull().default("[]"),
  designLinks: text("design_links").notNull().default("[]"),
  attachments: text("attachments").notNull().default("[]"),
  status: text("status").notNull().default("submitted"),
  adminNotes: text("admin_notes"),
  estimatedCompletion: text("estimated_completion"),
  statusHistory: text("status_history").notNull().default("[]"),
  deliveryMethod: text("delivery_method"),
  courierName: text("courier_name"),
  courierTrackingNumber: text("courier_tracking_number"),
  onlineDeliveryFiles: text("online_delivery_files").notNull().default("[]"),
  onlineDeliveryLinks: text("online_delivery_links").notNull().default("[]"),
  orderDescription: text("order_description"),
  shippingMethod: text("shipping_method"),
  paymentProofUrl: text("payment_proof_url"),
  proofFileUrl: text("proof_file_url"),
  proofFileName: text("proof_file_name"),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentAmount: integer("payment_amount").notNull().default(0),
  paymentType: text("payment_type").notNull().default("advance"),
  paymentSubmittedAmount: integer("payment_submitted_amount").notNull().default(0),
  paymentProofStatus: text("payment_proof_status").notNull().default("not_uploaded"),
  paymentProofUploadedAt: timestamp("payment_proof_uploaded_at"),
  paymentProofExpiresAt: timestamp("payment_proof_expires_at"),
  paymentApprovedAt: timestamp("payment_approved_at"),
  paymentRejectionReason: text("payment_rejection_reason"),
  customerPaymentConfirmedAt: timestamp("customer_payment_confirmed_at"),
  serviceTypeId: integer("service_type_id"),
  // Optional fields used by the admin New Custom Project form. Nullable so
  // existing orders are unaffected. dueDate/startDate are stored as ISO date
  // strings (YYYY-MM-DD) for simplicity. priority is one of
  // "low" | "medium" | "high" | "urgent". discountAmount and advancePaid are
  // whole rupees. tags is a JSON-encoded string array.
  dueDate: text("due_date"),
  startDate: text("start_date"),
  priority: text("priority"),
  discountAmount: integer("discount_amount").notNull().default(0),
  advancePaid: integer("advance_paid").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
