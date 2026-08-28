const MAX_NAME = 160;
const MAX_PHONE = 40;
const MAX_EMAIL = 254;
const MAX_ADDRESS = 1000;
const MAX_NOTES = 4000;
const MAX_ITEMS = 50;
const MAX_OPTIONS = 30;
const MAX_LINKS = 50;
const MAX_TAGS = 30;

export type NormalizedCreateOrderBody = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress: string;
  orderType: string;
  items: Array<{
    productId?: number | null;
    productName: string;
    quantity: number;
    unitPrice?: number;
    selectedOptions?: Array<{ groupId: string; choiceId: string }>;
    notes?: string | null;
  }>;
  designLinks: string[];
  attachments: string[];
  notes?: string | null;
  shippingMethod?: string | null;
  serviceTypeId?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  priority?: string | null;
  advancePaid?: number | null;
  tags?: string[] | null;
  paymentMethod: "bank_transfer" | "full_payment" | "cod";
  paymentAmount: number;
  couponCode?: string | null;
  discountAmount?: number | null;
  autoInvoice: boolean;
  linkInvoiceId?: number | null;
};

function text(value: unknown, field: string, max: number, required: boolean): string {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${field} is required.`);
  if (result.length > max) throw new Error(`${field} is too long.`);
  return result;
}

function optionalText(value: unknown, field: string, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return value == null ? value : null;
  return text(value, field, max, false);
}

function nonNegativeNumber(value: unknown, field: string, fallback: number | null = null): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100_000_000) throw new Error(`${field} must be a valid non-negative amount.`);
  return Math.round(number);
}

function positiveId(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null || value === "") return value == null ? value : null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${field} must be a valid ID.`);
  return number;
}

function boundedStringArray(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be a list.`);
  if (value.length > maxItems) throw new Error(`${field} contains too many entries.`);
  return value.map((entry, index) => text(entry, `${field}[${index}]`, maxLength, true));
}

function normalizeItems(value: unknown, isAdmin: boolean) {
  if (!Array.isArray(value)) throw new Error("items must be a list.");
  if (value.length === 0 && !isAdmin) throw new Error("Add at least one item before submitting the order.");
  if (value.length > MAX_ITEMS) throw new Error(`An order can contain at most ${MAX_ITEMS} items.`);

  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Item ${index + 1} is invalid.`);
    const item = raw as Record<string, unknown>;
    const productName = text(item.productName, `Item ${index + 1} name`, 240, !isAdmin);
    const productId = positiveId(item.productId, `Item ${index + 1} product ID`);
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error(`Item ${index + 1} quantity must be between 1 and 999.`);
    const unitPrice = nonNegativeNumber(item.unitPrice, `Item ${index + 1} price`);
    const selectedOptions = item.selectedOptions === undefined || item.selectedOptions === null
      ? undefined
      : (() => {
        if (!Array.isArray(item.selectedOptions) || item.selectedOptions.length > MAX_OPTIONS) throw new Error(`Item ${index + 1} options are invalid.`);
        return item.selectedOptions.map((rawOption, optionIndex) => {
          if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) throw new Error(`Item ${index + 1} option ${optionIndex + 1} is invalid.`);
          const option = rawOption as Record<string, unknown>;
          return {
            groupId: text(option.groupId, `Item ${index + 1} option group`, 120, true),
            choiceId: text(option.choiceId, `Item ${index + 1} option choice`, 120, true),
          };
        });
      })();

    return {
      productId,
      productName,
      quantity,
      ...(unitPrice === null ? {} : { unitPrice }),
      ...(selectedOptions ? { selectedOptions } : {}),
      notes: optionalText(item.notes, `Item ${index + 1} notes`, MAX_NOTES),
    };
  });
}

export function normalizeCreateOrderBody(body: unknown, isAdmin: boolean): NormalizedCreateOrderBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("A valid order payload is required.");
  const input = body as Record<string, unknown>;
  const customerName = text(input.customerName, "Customer name", MAX_NAME, true);
  const customerPhone = text(input.customerPhone, "Customer phone", MAX_PHONE, true);
  const customerEmail = optionalText(input.customerEmail, "Customer email", MAX_EMAIL);
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new Error("Customer email is not valid.");
  const customerAddress = text(input.customerAddress, "Customer address", MAX_ADDRESS, true);
  const orderType = text(input.orderType ?? "standard", "Order type", 80, true);
  const paymentMethod = ["bank_transfer", "full_payment", "cod"].includes(String(input.paymentMethod ?? "bank_transfer"))
    ? String(input.paymentMethod ?? "bank_transfer") as NormalizedCreateOrderBody["paymentMethod"]
    : "bank_transfer";

  return {
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    orderType,
    items: normalizeItems(input.items, isAdmin),
    designLinks: boundedStringArray(input.designLinks, "designLinks", MAX_LINKS, 2000),
    attachments: boundedStringArray(input.attachments, "attachments", MAX_LINKS, 2000),
    notes: optionalText(input.notes, "Order notes", MAX_NOTES),
    shippingMethod: optionalText(input.shippingMethod, "Shipping method", 80),
    serviceTypeId: positiveId(input.serviceTypeId, "Service type ID"),
    dueDate: optionalText(input.dueDate, "Due date", 80),
    startDate: optionalText(input.startDate, "Start date", 80),
    priority: optionalText(input.priority, "Priority", 40),
    advancePaid: nonNegativeNumber(input.advancePaid, "Advance paid"),
    tags: input.tags == null ? null : boundedStringArray(input.tags, "tags", MAX_TAGS, 80),
    paymentMethod,
    paymentAmount: nonNegativeNumber(input.paymentAmount, "Payment amount", 0) ?? 0,
    couponCode: optionalText(input.couponCode, "Coupon code", 100),
    discountAmount: nonNegativeNumber(input.discountAmount, "Discount amount"),
    autoInvoice: input.autoInvoice !== false,
    linkInvoiceId: positiveId(input.linkInvoiceId, "Invoice ID"),
  };
}
