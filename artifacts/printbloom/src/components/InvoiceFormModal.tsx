import { useState } from "react";
import {
  useCreateInvoice, useUpdateInvoice, useGetSettings,
  type Invoice,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X, Plus, Trash2, User, ListOrdered, Truck, DollarSign,
  FileText, Eye,
} from "lucide-react";
import {
  type LineItem, type ShippingOption, SHIPPING_OPTIONS, INVOICE_EMPTY_FORM,
  newItem, num, rs, calcShipping, calcWeightCharge, buildInvoiceMetadata, deriveInvoiceStatus,
} from "@/lib/invoiceTypes";
import { InvoicePreview } from "@/components/InvoicePreview";
import { ClientPicker, type ClientPickerValue, EMPTY_CLIENT_VALUE, ensureClientFromPicker } from "@/components/ClientPicker";

export interface InvoiceFormModalProps {
  onClose: () => void;
  /** Fires after a successful create/update. The created (or updated)
   *  invoice is passed when the API returns one, so callers can chain
   *  follow-up actions like linking to a new order. */
  onSuccess?: (invoice?: Invoice) => void;
  invoiceId?: number;
  initialData?: {
    form: typeof INVOICE_EMPTY_FORM;
    items: LineItem[];
    shipping: ShippingOption;
    shippingCustom: string;
    weightKg: string;
    ratePerKg: string;
    firstKgRate?: string;
    addKgRate?: string;
    standardRate?: number;
    expressRate?: number;
    advance: string;
  };
  linkedOrderId?: string;
  prefilledClient?: { id?: number; name: string; phone?: string; email?: string; address?: string; businessName?: string };
  invoiceNumberOverride?: string;
  createdAtOverride?: Date;
  /** Current invoice status (only relevant in edit mode). Used to preserve
   *  manual statuses like "cancelled" / "overdue" when the advance auto-rule
   *  fires on save. */
  currentStatus?: string;
}

export function InvoiceFormModal({
  onClose, onSuccess, invoiceId, initialData, linkedOrderId,
  prefilledClient, invoiceNumberOverride, createdAtOverride, currentStatus,
}: InvoiceFormModalProps) {
  const isEdit = invoiceId !== undefined;

  const { data: settings } = useGetSettings();

  // Configured rates from settings (with hardcoded fallbacks)
  const cfgStandard = num((settings as any)?.invoiceStandardRate ?? 350);
  const cfgExpress  = num((settings as any)?.invoiceExpressRate  ?? 530);
  const cfgFirstKg  = (settings as any)?.invoiceWeightFirstKg  ?? "450";
  const cfgAddKg    = (settings as any)?.invoiceWeightAddKg    ?? "200";

  // Parse courier services from settings
  type CourierEntry = { name: string; trackingUrl: string; firstKgRate?: string; addKgRate?: string };
  let courierList: CourierEntry[] = [];
  try { courierList = JSON.parse((settings as any)?.courierServices || "[]"); } catch {}

  const [form, setForm] = useState(() => {
    if (initialData?.form) return { ...initialData.form };
    if (prefilledClient) return { ...INVOICE_EMPTY_FORM, clientName: prefilledClient.name || "", phone: prefilledClient.phone || "", email: prefilledClient.email || "", address: prefilledClient.address || "", businessName: prefilledClient.businessName || "" };
    return { ...INVOICE_EMPTY_FORM };
  });
  const [items, setItems] = useState<LineItem[]>(() => initialData?.items?.length ? initialData.items : [newItem()]);
  const [shipping, setShipping]           = useState<ShippingOption>(initialData?.shipping || "none");
  const [shippingCustom, setShippingCustom] = useState(initialData?.shippingCustom || "");
  const [weightKg, setWeightKg]           = useState(initialData?.weightKg || "");
  const [firstKgRate, setFirstKgRate]     = useState(initialData?.firstKgRate ?? cfgFirstKg);
  const [addKgRate, setAddKgRate]         = useState(initialData?.addKgRate ?? cfgAddKg);
  const [advance, setAdvance]             = useState(initialData?.advance || "0");
  const [selectedCourier, setSelectedCourier] = useState((initialData as any)?.courierName || "");
  const [showPreview, setShowPreview]     = useState(false);
  const [clientValue, setClientValue]     = useState<ClientPickerValue>(() => {
    const src = initialData?.form ?? (prefilledClient ? { ...INVOICE_EMPTY_FORM, clientName: prefilledClient.name || "", phone: prefilledClient.phone || "", email: prefilledClient.email || "", address: prefilledClient.address || "", businessName: prefilledClient.businessName || "" } : INVOICE_EMPTY_FORM);
    return { clientId: prefilledClient?.id ?? (src as any).clientId ?? null, name: src.clientName || "", phone: src.phone || "", email: src.email || "", businessName: src.businessName || "", address: src.address || "" };
  });
  const [saveToClients, setSaveToClients] = useState(false);
  const [allowDuplicateCustomer, setAllowDuplicateCustomer] = useState(false);
  const [clientSaveError, setClientSaveError] = useState("");

  const queryClient = useQueryClient();

  const { mutate: createInvoice, isPending: isCreating } = useCreateInvoice({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        onSuccess?.(created as Invoice | undefined);
        onClose();
      }
    }
  });
  const { mutate: updateInvoice, isPending: isUpdating } = useUpdateInvoice({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        onSuccess?.(updated as Invoice | undefined);
        onClose();
      }
    }
  });

  const isSaving = isCreating || isUpdating;

  // Resolve rates: if courier_service with a selected courier, use that courier's rates
  const activeCourier = shipping === "courier_service" ? courierList.find(c => c.name === selectedCourier) : null;
  const effectiveFirstKg = activeCourier?.firstKgRate ?? firstKgRate;
  const effectiveAddKg   = activeCourier?.addKgRate   ?? addKgRate;

  // Weight-based shipping: first kg flat + ceil(extra kg) × add-kg rate
  const calcWeightAmt = (kg: number) => calcWeightCharge(kg, effectiveFirstKg, effectiveAddKg);

  const shippingAmt = calcShipping(
    shipping, shippingCustom, weightKg,
    effectiveFirstKg ?? firstKgRate,  // legacy ratePerKg arg
    effectiveFirstKg, effectiveAddKg, // two-tier weight
    cfgStandard, cfgExpress,          // flat delivery rates
  );
  const subtotal   = items.reduce((s, it) => s + it.qty * num(it.unitPrice), 0);
  const grandTotal = subtotal + shippingAmt;

  const setF = (k: keyof typeof INVOICE_EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }));
  const updateItem = (id: string, field: keyof LineItem, val: any) => setItems(its => its.map(it => it.id === id ? { ...it, [field]: val } : it));
  const removeItem = (id: string) => setItems(its => its.filter(it => it.id !== id));
  const addItem = () => setItems(its => [...its, newItem()]);

  const buildNotes = () => {
    const kg = num(weightKg);
    let shippingNote = `Shipping: ${SHIPPING_OPTIONS.find(o => o.key === shipping)?.label}`;
    if (shipping === "standard") shippingNote = `Shipping: 🚚 Standard Delivery — Rs. ${cfgStandard}`;
    if (shipping === "express")  shippingNote = `Shipping: ⚡ Express Delivery — Rs. ${cfgExpress}`;
    if (shipping === "courier_service" && selectedCourier && kg > 0) {
      const amt = calcWeightAmt(kg);
      shippingNote = `Shipping (${selectedCourier}): ${kg}kg → Rs. ${amt.toLocaleString("en-IN")} (1st kg Rs.${num(effectiveFirstKg)}, +Rs.${num(effectiveAddKg)}/kg)`;
    } else if (shipping === "weight" && kg > 0) {
      const amt = calcWeightAmt(kg);
      shippingNote = `Shipping (Weight-Based): ${kg}kg → Rs. ${amt.toLocaleString("en-IN")} (1st kg Rs.${num(effectiveFirstKg)}, +Rs.${num(effectiveAddKg)}/kg)`;
    }
    return [
      form.additionalNotes,
      form.internalNotes ? `[Internal: ${form.internalNotes}]` : "",
      shippingNote,
      num(advance) > 0 ? `Advance paid: ${rs(num(advance))}` : "",
    ].filter(Boolean).join("\n");
  };

  const handleSave = async () => {
    if (!clientValue.name.trim()) return;
    // Merge client picker values into the form shape expected by buildInvoiceMetadata / InvoicePreview
    const mergedForm = { ...form, clientName: clientValue.name, phone: clientValue.phone, email: clientValue.email, address: clientValue.address, businessName: clientValue.businessName };
    const amount = String(grandTotal);
    const notes  = buildNotes();
    const metadata = buildInvoiceMetadata(
      mergedForm, items, shipping, shippingCustom, weightKg,
      effectiveFirstKg ?? firstKgRate,  // ratePerKg (legacy)
      advance,
      effectiveFirstKg, effectiveAddKg,
      cfgStandard, cfgExpress,
      shipping === "courier_service" ? selectedCourier : undefined,
    );
    // Auto-derive status from advance vs grand total. Existing manual
    // statuses (cancelled / overdue / draft / issued) are preserved.
    const status = deriveInvoiceStatus(num(advance), grandTotal, isEdit ? currentStatus : undefined);
    setClientSaveError("");
    let resolvedClientId = clientValue.clientId;
    try {
      // Every invoice is attached to one canonical Client record. This also
      // prevents a later order/invoice from creating a second profile.
      resolvedClientId = resolvedClientId ?? await ensureClientFromPicker(clientValue, true, false);
      if (resolvedClientId && resolvedClientId !== clientValue.clientId) {
        setClientValue(current => ({ ...current, clientId: resolvedClientId }));
      }
    } catch (error) {
      setClientSaveError(error instanceof Error ? error.message : "Could not save this customer.");
      return;
    }
    const invoiceData = {
      clientName: mergedForm.clientName,
      clientId: resolvedClientId,
      clientPhone: mergedForm.phone || undefined,
      clientEmail: mergedForm.email || undefined,
      amount,
      notes,
      status,
      metadata,
      orderId: linkedOrderId,
    } as any;
    if (isEdit && invoiceId !== undefined) {
      updateInvoice({ id: invoiceId, data: invoiceData });
    } else {
      createInvoice({ data: invoiceData });
    }
  };

  const handlePreviewSave = () => {
    setShowPreview(false);
    void handleSave();
  };

  // Dynamic labels for shipping buttons
  const shippingLabel = (key: ShippingOption) => {
    if (key === "courier_service") return `🚚 Courier Service`;
    if (key === "standard") return `🚚 Standard — Rs. ${cfgStandard.toLocaleString("en-IN")}`;
    if (key === "express")  return `⚡ Express — Rs. ${cfgExpress.toLocaleString("en-IN")}`;
    if (key === "weight")   return `⚖️ Weight-based`;
    if (key === "custom")   return `✏️ Custom Amount`;
    return "No Shipping / Pickup";
  };

  const handleCourierChange = (name: string) => {
    setSelectedCourier(name);
    const c = courierList.find(x => x.name === name);
    if (c) {
      setFirstKgRate(c.firstKgRate || "450");
      setAddKgRate(c.addKgRate || "200");
    }
  };

  const kg = num(weightKg);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={() => onClose()}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg sm:max-w-2xl lg:max-w-3xl flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ maxHeight: "calc(100vh - 48px)" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-purple-50 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-pink-500" />
                  <span className="font-bold text-gray-900 text-base">
                    {isEdit ? "Edit Invoice" : "Create Invoice"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {linkedOrderId ? `Linked to order: ${linkedOrderId}` : "Multi-item invoice with shipping & advance payment"}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/80 rounded-lg transition-colors mt-0.5">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-6">

                {/* Client Information */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-pink-100 flex items-center justify-center"><User size={13} className="text-pink-600" /></div>
                    <span className="text-sm font-bold text-gray-800">Client Information</span>
                  </div>
                  <ClientPicker
                    value={clientValue}
                    onChange={setClientValue}
                    saveToClients={saveToClients}
                    onSaveToClientsChange={setSaveToClients}
                    allowDuplicatePhone={allowDuplicateCustomer}
                    onAllowDuplicatePhoneChange={setAllowDuplicateCustomer}
                    label="CLIENT"
                    defaultMode={isEdit ? "select" : undefined}
                  />
                  {clientSaveError && <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{clientSaveError}</div>}
                </section>

                {/* Line Items */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center"><ListOrdered size={13} className="text-purple-600" /></div>
                    <span className="text-sm font-bold text-gray-800">Line Items</span>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="hidden sm:grid text-[10px] text-gray-400 font-semibold uppercase tracking-wide px-1 gap-2"
                      style={{ gridTemplateColumns: "minmax(0,1fr) 90px 120px 110px 24px" }}
                    >
                      <span>Description *</span>
                      <span className="text-center">Qty</span>
                      <span className="text-center">Unit Price</span>
                      <span className="text-right">Total</span>
                      <span></span>
                    </div>
                    {items.map((it, idx) => {
                      const handleRowKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: "description" | "qty" | "unitPrice" | "notes") => {
                        if (e.key !== "Backspace") return;
                        if (items.length <= 1) return;
                        const isEmpty = field === "description"
                          ? !it.description
                          : field === "notes"
                          ? !it.notes
                          : field === "qty"
                          ? (!it.qty || it.qty === 1) && !it.description && !it.unitPrice
                          : !String(it.unitPrice ?? "") && !it.description;
                        const target = e.currentTarget;
                        const atStart = target.selectionStart === 0 && target.selectionEnd === 0;
                        if (isEmpty && atStart) {
                          e.preventDefault();
                          removeItem(it.id);
                        }
                      };
                      const lineTotal = it.qty * num(it.unitPrice);
                      return (
                        <div key={it.id} className="bg-gray-50 rounded-xl p-2.5 sm:p-3 space-y-2 group">
                          {/* Mobile: stacked. Desktop: single grid row. */}
                          <div className="block sm:hidden space-y-2">
                            {/* Row 1: Description full-width with delete tucked to the right */}
                            <div className="flex items-center gap-2">
                              <input
                                value={it.description}
                                onChange={e => updateItem(it.id, "description", e.target.value)}
                                onKeyDown={e => handleRowKeyDown(e, "description")}
                                placeholder={`Item ${idx + 1}`}
                                className="input-field text-sm flex-1 min-w-0"
                              />
                              {items.length > 1 && (
                                <button
                                  onClick={() => removeItem(it.id)}
                                  className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-colors flex items-center justify-center shrink-0"
                                  title="Remove item"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                            {/* Row 2: Qty | Price | Total */}
                            <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2 items-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={it.qty || ""}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^\d]/g, "");
                                  updateItem(it.id, "qty", v === "" ? 0 : parseInt(v));
                                }}
                                onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) updateItem(it.id, "qty", 1); }}
                                onKeyDown={e => handleRowKeyDown(e, "qty")}
                                placeholder="Qty"
                                aria-label="Quantity"
                                className="input-field text-center text-sm font-semibold"
                              />
                              <div className="relative min-w-0">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400 pointer-events-none select-none">Rs.</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={it.unitPrice}
                                  onChange={e => {
                                    const v = e.target.value.replace(/[^\d.]/g, "");
                                    updateItem(it.id, "unitPrice", v);
                                  }}
                                  onKeyDown={e => handleRowKeyDown(e, "unitPrice")}
                                  placeholder="0.00"
                                  aria-label="Unit price"
                                  className="input-field text-right text-sm font-semibold pl-9 w-full"
                                />
                              </div>
                              <span className="text-sm font-bold text-pink-600 text-right whitespace-nowrap pl-1 pr-0.5">
                                Rs. {lineTotal.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          {/* Desktop: original single-row grid */}
                          <div
                            className="hidden sm:grid gap-2 items-center"
                            style={{ gridTemplateColumns: "minmax(0,1fr) 90px 120px 110px 24px" }}
                          >
                            <input
                              value={it.description}
                              onChange={e => updateItem(it.id, "description", e.target.value)}
                              onKeyDown={e => handleRowKeyDown(e, "description")}
                              placeholder={`Item ${idx + 1}`}
                              className="input-field text-base"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={it.qty || ""}
                              onChange={e => {
                                const v = e.target.value.replace(/[^\d]/g, "");
                                updateItem(it.id, "qty", v === "" ? 0 : parseInt(v));
                              }}
                              onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) updateItem(it.id, "qty", 1); }}
                              onKeyDown={e => handleRowKeyDown(e, "qty")}
                              placeholder="1"
                              className="input-field text-center text-base font-semibold"
                            />
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none select-none">Rs.</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={it.unitPrice}
                                onChange={e => {
                                  const v = e.target.value.replace(/[^\d.]/g, "");
                                  updateItem(it.id, "unitPrice", v);
                                }}
                                onKeyDown={e => handleRowKeyDown(e, "unitPrice")}
                                placeholder="0.00"
                                className="input-field text-right text-base font-semibold pl-9"
                              />
                            </div>
                            <span className="text-sm font-bold text-pink-600 text-right truncate">
                              Rs. {lineTotal.toLocaleString("en-IN")}
                            </span>
                            {items.length > 1 ? (
                              <button
                                onClick={() => removeItem(it.id)}
                                className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors flex items-center justify-center"
                                title="Remove item"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : <span />}
                          </div>
                          <input
                            value={it.notes}
                            onChange={e => updateItem(it.id, "notes", e.target.value)}
                            onKeyDown={e => handleRowKeyDown(e, "notes")}
                            placeholder="Notes / specifications (optional)"
                            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-pink-200 placeholder:text-gray-300 text-gray-600"
                          />
                        </div>
                      );
                    })}
                    {/* Always-visible "Add another item" right under the last
                        row, so users with long invoices don't have to scroll
                        all the way back up to the section header. */}
                    <button
                      type="button"
                      onClick={addItem}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-pink-200 text-pink-600 text-xs font-bold hover:border-pink-400 hover:bg-pink-50/60 transition-colors"
                    >
                      <Plus size={14} /> Add another item
                    </button>
                  </div>
                  <p className="hidden sm:block text-[10px] text-gray-400 mt-2 px-1">Tip: press Backspace on an empty row to remove it.</p>
                </section>

                {/* Shipping */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center"><Truck size={13} className="text-blue-600" /></div>
                    <span className="text-sm font-bold text-gray-800">Shipping Charges</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SHIPPING_OPTIONS.filter(opt => opt.key !== "courier_service" || courierList.length > 0).map(opt => (
                      <button key={opt.key} onClick={() => setShipping(opt.key)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left border-2 transition-all ${shipping === opt.key ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {shippingLabel(opt.key)}
                      </button>
                    ))}
                  </div>

                  {/* Courier service dropdown + weight input */}
                  {shipping === "courier_service" && courierList.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold block mb-1">SELECT COURIER</label>
                        <select
                          value={selectedCourier}
                          onChange={e => handleCourierChange(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 bg-white font-semibold transition-colors appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-10"
                        >
                          <option value="">Choose a courier...</option>
                          {courierList.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedCourier && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={weightKg}
                                onChange={e => setWeightKg(e.target.value.replace(/[^\d.]/g, ""))}
                                placeholder="0.0"
                                className="input-field pr-10 font-semibold"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-semibold pointer-events-none select-none">kg</span>
                            </div>
                            {kg > 0 && (
                              <span className="text-sm font-bold text-pink-600 bg-pink-50 border border-pink-100 px-3 py-2 rounded-xl whitespace-nowrap">
                                Rs. {calcWeightAmt(kg).toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>

                          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 space-y-2">
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">{selectedCourier} — Weight Rates</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-xs text-gray-600">1st kg: <span className="font-bold text-gray-800">Rs. {effectiveFirstKg || "450"}</span></div>
                              <div className="text-xs text-gray-600">Extra kg: <span className="font-bold text-gray-800">Rs. {effectiveAddKg || "200"}</span></div>
                            </div>
                            {kg > 0 && (
                              <div className="text-xs text-blue-700 bg-blue-100/60 rounded-lg px-3 py-1.5 font-medium">
                                {kg <= 1
                                  ? `${kg}kg × first kg rate = Rs. ${calcWeightAmt(kg).toLocaleString("en-IN")}`
                                  : `1st kg Rs.${num(effectiveFirstKg)} + ${Math.ceil(kg - 1)}kg × Rs.${num(effectiveAddKg)} = Rs. ${calcWeightAmt(kg).toLocaleString("en-IN")}`
                                }
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Weight-based input */}
                  {shipping === "weight" && (
                    <div className="mt-3 space-y-2">
                      {/* Weight input */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={weightKg}
                            onChange={e => setWeightKg(e.target.value.replace(/[^\d.]/g, ""))}
                            placeholder="0.0"
                            className="input-field pr-10 font-semibold"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-semibold pointer-events-none select-none">kg</span>
                        </div>
                        {kg > 0 && (
                          <span className="text-sm font-bold text-pink-600 bg-pink-50 border border-pink-100 px-3 py-2 rounded-xl whitespace-nowrap">
                            Rs. {calcWeightAmt(kg).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      {/* Rate breakdown panel */}
                      <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 space-y-2">
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Weight Rates (editable)</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">First kg rate (Rs.)</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-500 pointer-events-none select-none">Rs.</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={firstKgRate}
                                onChange={e => setFirstKgRate(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full pl-9 pr-2.5 py-1.5 border border-blue-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-300 bg-white text-right font-semibold"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-1">Each extra kg (Rs.)</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-500 pointer-events-none select-none">Rs.</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={addKgRate}
                                onChange={e => setAddKgRate(e.target.value.replace(/[^\d.]/g, ""))}
                                className="w-full pl-9 pr-2.5 py-1.5 border border-blue-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-300 bg-white text-right font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                        {kg > 0 && (
                          <div className="text-xs text-blue-700 bg-blue-100/60 rounded-lg px-3 py-1.5 font-medium">
                            {kg <= 1
                              ? `${kg}kg × first kg rate = Rs. ${calcWeightAmt(kg).toLocaleString("en-IN")}`
                              : `1st kg Rs.${num(firstKgRate)} + ${Math.ceil(kg - 1)}kg × Rs.${num(addKgRate)} = Rs. ${calcWeightAmt(kg).toLocaleString("en-IN")}`
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {shipping === "custom" && (
                    <div className="mt-3 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 pointer-events-none select-none">Rs.</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={shippingCustom}
                        onChange={e => setShippingCustom(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="0"
                        className="input-field pl-11 pr-3 text-right font-semibold"
                      />
                    </div>
                  )}
                </section>

                {/* Advance & Totals */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center"><DollarSign size={13} className="text-green-600" /></div>
                    <span className="text-sm font-bold text-gray-800">Advance Payment</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 pointer-events-none select-none">Rs.</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={advance}
                      onChange={e => {
                        const v = e.target.value.replace(/[^\d.]/g, "");
                        setAdvance(v);
                      }}
                      placeholder="0"
                      className="input-field pl-11 pr-3 text-right font-semibold"
                    />
                  </div>
                  <div className="mt-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-3 space-y-1.5 border border-pink-100">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Subtotal</span><span className="font-semibold">Rs. {subtotal.toLocaleString("en-IN")}</span>
                    </div>
                    {shippingAmt > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Shipping</span><span>Rs. {shippingAmt.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {num(advance) > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Advance paid</span><span>−Rs. {num(advance).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    <div className="border-t border-pink-200 pt-1.5 flex justify-between text-sm font-bold">
                      <span>Grand Total</span><span className="text-pink-600">Rs. {grandTotal.toLocaleString("en-IN")}</span>
                    </div>
                    {num(advance) > 0 && (
                      <div className="flex justify-between text-sm font-bold text-purple-700">
                        <span>Balance Due</span><span>Rs. {(grandTotal - num(advance)).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Notes */}
                <section>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Additional Notes (shown on invoice)</label>
                      <textarea value={form.additionalNotes} onChange={e => setF("additionalNotes", e.target.value)} rows={2} placeholder="Payment instructions, thank you message, etc." className="input-field resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Internal Notes (not on invoice)</label>
                      <textarea value={form.internalNotes} onChange={e => setF("internalNotes", e.target.value)} rows={2} placeholder="Staff-only notes..." className="input-field resize-none" />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button onClick={() => setShowPreview(true)} disabled={!clientValue.name.trim()}
                className="flex-1 py-2.5 border-2 border-pink-200 text-pink-600 text-sm font-bold rounded-xl hover:bg-pink-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Eye size={14} /> Preview
              </button>
              <button onClick={() => void handleSave()} disabled={isSaving || !clientValue.name.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                {isSaving ? "Saving…" : isEdit ? "Update Invoice" : "Save Invoice"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview overlay */}
      {showPreview && (
        <InvoicePreview
          form={{ ...form, clientName: clientValue.name, phone: clientValue.phone, email: clientValue.email, address: clientValue.address, businessName: clientValue.businessName }}
          items={items}
          shipping={shipping}
          shippingCustom={shippingCustom}
          courierName={shipping === "courier_service" ? selectedCourier : undefined}
          advance={advance}
          subtotal={subtotal}
          shippingAmt={shippingAmt}
          grandTotal={grandTotal}
          invoiceNumberOverride={invoiceNumberOverride}
          createdAtOverride={createdAtOverride}
          linkedOrderId={linkedOrderId || null}
          onClose={() => setShowPreview(false)}
          onSave={handlePreviewSave}
          isSaving={isSaving}
        />
      )}
    </>
  );
}
