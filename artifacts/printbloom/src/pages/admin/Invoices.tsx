import { useState, useRef, useEffect } from "react";
import { useListInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useListClients, useGetSettings } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { InvoicePreview } from "@/components/InvoicePreview";
import {
  Search, Plus, Receipt, TrendingUp, CheckCircle, X,
  User, ListOrdered, Truck, DollarSign, Eye, Trash2,
  FileText, Printer, Pencil, ImageDown, UserPlus, Check,
  Clock, CircleDollarSign, AlertTriangle, Lock,
} from "lucide-react";
import { normalizePhone } from "@/components/ClientPicker";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deriveInvoiceStatus, getInvoicePaidAmount, isUnpaidInvoiceStatus } from "@/lib/invoiceTypes";
import { dateMatchesFilter } from "@/components/admin/DateFilter";

function rs(v: any) { return `Rs. ${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }
function num(v: any) { return parseFloat(String(v || 0).replace(/[^0-9.-]/g, "")) || 0; }

type InvoiceDateRange = "today" | "week" | "month" | "year" | "custom";
type InvoicePaymentView = "all" | "unpaid" | "partial";

const INVOICE_RANGE_OPTIONS: Array<{ value: InvoiceDateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

function invoiceDateMatches(raw: string | Date | null | undefined, range: InvoiceDateRange, from: string, to: string): boolean {
  if (range !== "custom") return dateMatchesFilter(raw, range);
  if (!raw || !from || !to) return false;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return date >= start && date < end;
}

type CostComponent = { id: string; type: "inventory" | "production"; refId: number; name: string; unit: string; unitCost: string; quantity: string; wasteQuantity?: string };
type LineItem = { id: string; description: string; qty: number; unitPrice: string; notes: string; costPrice?: string; costComponents?: CostComponent[]; deductStock?: boolean };
type CatalogInvoiceItem = { key: string; name: string; price: string; kind: "Product" | "Service"; category?: string };
type ShippingOption = "none" | "standard" | "express" | "weight" | "custom";

const SHIPPING_OPTIONS: { key: ShippingOption; label: string; amount: number | null }[] = [
  { key: "none", label: "No Shipping / Pickup", amount: 0 },
  { key: "standard", label: "Standard Delivery", amount: 350 },
  { key: "express", label: "Express Delivery", amount: 530 },
  { key: "weight", label: "Weight-based", amount: null },
  { key: "custom", label: "Custom / Manual Amount", amount: null },
];

function newItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", qty: 1, unitPrice: "", notes: "", costPrice: "", costComponents: [], deductStock: false };
}

const EMPTY_FORM = { clientName: "", clientId: null as number | null, phone: "", email: "", businessName: "", address: "", projectTitle: "", additionalNotes: "", internalNotes: "" };



/* ─── Helper: parse saved metadata or build fallback ─── */
function parseInvoiceMeta(inv: any) {
  try {
    if (inv.metadata) {
      const m = JSON.parse(inv.metadata);
      if (m.form && m.items) return m;
    }
  } catch {}
  // Fallback for invoices without metadata
  const amount = num(inv.amount);
  return {
    form: { clientName: inv.clientName || "", clientId: inv.clientId ?? null, phone: "", email: "", businessName: "", address: "", projectTitle: "", additionalNotes: inv.notes || "", internalNotes: "" },
    items: [{ id: crypto.randomUUID(), description: "Invoice total", qty: 1, unitPrice: String(amount), notes: "" }],
    shipping: "none" as ShippingOption,
    shippingCustom: "",
    weightKg: "",
    ratePerKg: "120",
    firstKgRate: undefined as string | undefined,
    addKgRate: undefined as string | undefined,
    standardRate: undefined as number | undefined,
    expressRate: undefined as number | undefined,
    advance: "0",
  };
}

/* ─── Main Page ─── */
export default function AdminInvoices() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<InvoiceDateRange>("month");
  const [paymentView, setPaymentView] = useState<InvoicePaymentView>("all");
  const [customFrom, setCustomFrom] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [showManual, setShowManual] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  // Entry mode for new invoice: 'existing' = pick from CRM, 'manual' = type details directly
  const [entryMode, setEntryMode] = useState<"existing" | "manual">("existing");

  // Inline status editing
  const [editingInvId, setEditingInvId] = useState<number | null>(null);
  const [editInvStatus, setEditInvStatus] = useState("");
  const [paymentConfirm, setPaymentConfirm] = useState<{ invoice: any; status: string } | null>(null);
  const [paymentReceivedDate, setPaymentReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; number: string } | null>(null);

  // Multi-select for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Full invoice view
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);

  // Full invoice edit
  const [editingFullId, setEditingFullId] = useState<number | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [catalogItems, setCatalogItems] = useState<CatalogInvoiceItem[]>([]);
  const [invoiceCostSources, setInvoiceCostSources] = useState<Array<{ key: string; type: "inventory" | "production"; refId: number; name: string; unit: string; unitCost: string }>>([]);
  const [costSearchByItem, setCostSearchByItem] = useState<Record<string, string>>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [shipping, setShipping] = useState<ShippingOption>("none");
  const [shippingCustom, setShippingCustom] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [firstKgRate, setFirstKgRate] = useState("450");
  const [addKgRate, setAddKgRate]     = useState("200");
  const [advance, setAdvance] = useState("0");

  const { data: invoices } = useListInvoices();
  const { data: crmClients, refetch: refetchClients } = useListClients();
  const { data: settings } = useGetSettings();
  const queryClient = useQueryClient();
  const { data: adminSession } = useQuery({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      const response = await fetch("/api/admin/me", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Not authenticated");
      return response.json();
    },
    staleTime: 30000,
  });
  const canViewFinance = adminSession?.role !== "staff" || (adminSession?.permissions || []).includes("finance");

  // When the manual entry path is used, the owner can opt-in to also persist
  // the typed client to the Clients DB so the new invoice ends up linked.
  const [saveManualAsClient, setSaveManualAsClient] = useState(false);
  const [clientCreateError, setClientCreateError]   = useState("");
  const [allowDuplicateCustomer, setAllowDuplicateCustomer] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/products", { credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/services", { credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/inventory", { credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/finance-inventory/cost-values", { credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([products, services, inventory, costValues]) => {
      if (!active) return;
      const productItems = (Array.isArray(products) ? products : []).filter((p: any) => p.active !== false).map((p: any) => ({ key: `product-${p.id}`, name: p.invoiceName || p.name, price: String(p.price || ""), kind: "Product" as const, category: p.category?.name || "" }));
      const serviceItems = (Array.isArray(services) ? services : []).filter((s: any) => s.active !== false).map((s: any) => ({ key: `service-${s.id}`, name: s.name, price: String(s.price || ""), kind: "Service" as const, category: s.categoryName || "" }));
      setCatalogItems([...productItems, ...serviceItems]);
      const materialSources = (Array.isArray(inventory) ? inventory : []).map((item: any) => ({ key: `inventory-${item.id}`, type: "inventory" as const, refId: Number(item.id), name: item.name, unit: item.unit || "unit", unitCost: String(item.cost || "0") }));
      const productionSources = (Array.isArray(costValues) ? costValues : []).map((item: any) => ({ key: `production-${item.id}`, type: "production" as const, refId: Number(item.id), name: item.name, unit: item.unit || "unit", unitCost: String(item.unit_cost || "0") }));
      setInvoiceCostSources([...materialSources, ...productionSources]);
    }).catch(() => { if (active) { setCatalogItems([]); setInvoiceCostSources([]); } });
    return () => { active = false; };
  }, []);


  // Configured shipping rates from settings
  const cfgStandard = num((settings as any)?.invoiceStandardRate ?? 350);
  const cfgExpress  = num((settings as any)?.invoiceExpressRate  ?? 530);
  const cfgFirstKg  = (settings as any)?.invoiceWeightFirstKg  ?? "450";
  const cfgAddKg    = (settings as any)?.invoiceWeightAddKg    ?? "200";

  const { mutate: createInvoice, isPending } = useCreateInvoice({
    mutation: {
      onMutate: () => setClientCreateError(""),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        setShowManual(false);
        setShowPreview(false);
        resetForm();
      },
      onError: (error: any) => {
        const message = error?.data?.error || error?.message || "The invoice could not be created. Please retry.";
        setClientCreateError(message);
      },
    }
  });
  const { mutate: updateInvoice, isPending: isUpdating } = useUpdateInvoice({
    mutation: {
      onMutate: () => setClientCreateError(""),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        setEditingInvId(null);
        setPaymentConfirm(null);
        setEditingFullId(null);
        setShowManual(false);
        setShowPreview(false);
        resetForm();
      },
      onError: (error: any) => {
        const message = error?.data?.error || error?.message || "The invoice could not be updated. Please retry.";
        setClientCreateError(message);
      },
    }
  });
  const { mutate: deleteInvoice, mutateAsync: deleteInvoiceAsync } = useDeleteInvoice({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/invoices"] }) }
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => deleteInvoiceAsync({ id })));
      clearSelection();
      setBulkDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    } finally {
      setBulkDeleting(false);
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setItems([newItem()]);
    setShipping("none");
    setShippingCustom("");
    setWeightKg("");
    setFirstKgRate(cfgFirstKg);
    setAddKgRate(cfgAddKg);
    setAdvance("0");
    setClientSearch("");
    setEditingFullId(null);
    setEntryMode("existing");
    setSaveManualAsClient(false);
    setClientCreateError("");
    setAllowDuplicateCustomer(false);
  };

  const filteredClients = (crmClients ?? []).filter((c: any) =>
    clientSearch.length < 1 ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone || "").includes(clientSearch)
  );

  const selectClient = (c: any) => {
    setForm(f => ({ ...f, clientId: c.id ?? null, clientName: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", businessName: c.businessName || "" }));
    setClientSearch("");
    setShowClientDropdown(false);
    setSaveManualAsClient(false);
    setClientCreateError("");
    setAllowDuplicateCustomer(false);
  };

  const clearClient = () => {
    setForm(f => ({ ...f, clientId: null, clientName: "", phone: "", email: "", address: "", businessName: "" }));
    setClientSearch("");
    setSaveManualAsClient(false);
    setClientCreateError("");
    setAllowDuplicateCustomer(false);
  };

  // Promote the typed search term to a manual-entry client name and switch
  // the modal into manual mode with the "save to clients" opt-in turned on.
  const startManualEntry = () => {
    const name = clientSearch.trim();
    if (!name) return;
    setForm(f => ({ ...f, clientId: null, clientName: name, phone: "", email: "", address: "", businessName: "" }));
    setClientSearch("");
    setShowClientDropdown(false);
    setEntryMode("manual");
    setSaveManualAsClient(true);
    setClientCreateError("");
    setAllowDuplicateCustomer(false);
  };

  // Picker helpers used by the new "+ Add as new client" affordance.
  const trimmedClientSearch = clientSearch.trim().toLowerCase();
  const hasExactClientMatch = trimmedClientSearch.length > 0 &&
    (crmClients ?? []).some((c: any) => c.name.trim().toLowerCase() === trimmedClientSearch);
  const showAddNewClient = trimmedClientSearch.length > 0 && !hasExactClientMatch;
  const duplicatePhoneClient = entryMode === "manual" && !form.clientId && normalizePhone(form.phone)
    ? (crmClients ?? []).find((client: any) =>
        normalizePhone(client.phone) === normalizePhone(form.phone),
      ) ?? null
    : null;

  // Calculations
  const subtotal = items.reduce((s, it) => s + it.qty * num(it.unitPrice), 0);

  const calcWeightAmt = (kg: number, fkg: string, akg: string) => {
    if (kg <= 0) return 0;
    return num(fkg) + Math.ceil(Math.max(0, kg - 1)) * num(akg);
  };

  const weightShippingAmt = calcWeightAmt(num(weightKg), firstKgRate, addKgRate);
  const shippingAmt =
    shipping === "custom" ? num(shippingCustom) :
    shipping === "weight" ? weightShippingAmt :
    shipping === "standard" ? cfgStandard :
    shipping === "express"  ? cfgExpress  : 0;
  const grandTotal = subtotal + shippingAmt;

  const componentTotal = (component: CostComponent) => (num(component.quantity) + (component.type === "inventory" ? num(component.wasteQuantity) : 0)) * num(component.unitCost);
  const withCalculatedCost = (item: LineItem) => {
    const components = item.costComponents || [];
    if (!components.length) return item;
    const total = components.reduce((sum, component) => sum + componentTotal(component), 0);
    return { ...item, costPrice: String(item.qty > 0 ? total / item.qty : total) };
  };
  const updateItem = (id: string, field: keyof LineItem, val: any) =>
    setItems(items => items.map(it => it.id === id ? withCalculatedCost({ ...it, [field]: val }) : it));
  const removeItem = (id: string) => setItems(items => items.filter(it => it.id !== id));
  const addCostComponent = (itemId: string, sourceKey: string) => {
    const source = invoiceCostSources.find(entry => entry.key === sourceKey);
    if (!source) return;
    setItems(current => current.map(item => {
      if (item.id !== itemId || (item.costComponents || []).some(component => component.type === source.type && component.refId === source.refId)) return item;
      return withCalculatedCost({ ...item, costComponents: [...(item.costComponents || []), { id: crypto.randomUUID(), type: source.type, refId: source.refId, name: source.name, unit: source.unit, unitCost: source.unitCost, quantity: "1", wasteQuantity: source.type === "inventory" ? "0" : undefined }] });
    }));
    setCostSearchByItem(current => ({ ...current, [itemId]: "" }));
  };
  const updateCostComponent = (itemId: string, componentId: string, field: keyof CostComponent, value: string) =>
    setItems(current => current.map(item => item.id === itemId ? withCalculatedCost({ ...item, costComponents: (item.costComponents || []).map(component => component.id === componentId ? { ...component, [field]: value } : component) }) : item));
  const removeCostComponent = (itemId: string, componentId: string) =>
    setItems(current => current.map(item => item.id === itemId ? withCalculatedCost({ ...item, costComponents: (item.costComponents || []).filter(component => component.id !== componentId) }) : item));
  const addItem = () => setItems(items => [...items, newItem()]);
  const filteredCatalogItems = catalogItems.filter(item => {
    const q = catalogSearch.trim().toLowerCase();
    return !q || item.name.toLowerCase().includes(q) || item.kind.toLowerCase().includes(q) || (item.category || "").toLowerCase().includes(q);
  }).slice(0, 10);
  const addCatalogItem = (item: CatalogInvoiceItem) => {
    const selected = { ...newItem(), description: item.name, unitPrice: item.price, notes: item.kind + (item.category ? ` · ${item.category}` : "") };
    setItems(current => current.length === 1 && !current[0].description.trim() && !current[0].unitPrice ? [selected] : [...current, selected]);
    setCatalogSearch(""); setShowCatalogDropdown(false);
  };

  const handleSave = async () => {
    if (!form.clientName.trim()) return;
    setClientCreateError("");
    setAllowDuplicateCustomer(false);

    // If the owner typed a new client manually and opted in to save it, create
    // the Clients DB record first so we can link the invoice on the same call.
    let clientIdToUse = form.clientId;
    if (editingFullId === null && clientIdToUse == null && saveManualAsClient) {
      try {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.clientName.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            businessName: form.businessName.trim() || null,
            address: form.address.trim() || null,
            allowDuplicatePhone: allowDuplicateCustomer,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 409 && body?.existingClient) {
            throw new Error(`Existing customer found: ${body.existingClient.name} (PB${String(body.existingClient.id).padStart(4, "0")}). Use the existing record or tick the special separate-customer override.`);
          }
          throw new Error(body?.error || "Failed to create client");
        }
        const newClient = await res.json();
        clientIdToUse = newClient?.id ?? null;
        if (clientIdToUse != null) {
          setForm(f => ({ ...f, clientId: clientIdToUse }));
        }
        refetchClients();
      } catch (error) {
        setClientCreateError(error instanceof Error ? error.message : "Couldn't save the new client. The invoice was not saved.");
        return;
      }
    }

    const amount = String(grandTotal);
    const kg = num(weightKg);
    let shippingNote = `Shipping: ${SHIPPING_OPTIONS.find(o => o.key === shipping)?.label}`;
    if (shipping === "standard") shippingNote = `Shipping: 🚚 Standard Delivery — Rs. ${cfgStandard}`;
    if (shipping === "express")  shippingNote = `Shipping: ⚡ Express Delivery — Rs. ${cfgExpress}`;
    if (shipping === "weight" && kg > 0) {
      shippingNote = kg <= 1
        ? `Shipping (Weight): ${kg}kg = Rs. ${weightShippingAmt}`
        : `Shipping (Weight): 1st kg Rs.${num(firstKgRate)} + ${Math.ceil(kg - 1)}kg × Rs.${num(addKgRate)} = Rs. ${weightShippingAmt}`;
    }
    const notes = [
      form.additionalNotes,
      form.internalNotes ? `[Internal: ${form.internalNotes}]` : "",
      shippingNote,
      num(advance) > 0 ? `Advance paid: ${rs(num(advance))}` : "",
    ].filter(Boolean).join("\n");

    const metadata = JSON.stringify({ form: { ...form, clientId: clientIdToUse }, items, shipping, shippingCustom, weightKg, ratePerKg: firstKgRate, advance, firstKgRate, addKgRate, standardRate: cfgStandard, expressRate: cfgExpress });
    // Auto-derive status from the advance amount entered. "paid" if advance
    // covers the full grand total, "partial" if some advance is paid, else
    // "pending". Manual statuses (cancelled / overdue / draft / issued) on
    // existing invoices are preserved.
    if (editingFullId !== null) {
      const existing = (invoices ?? []).find(i => i.id === editingFullId);
      const status = deriveInvoiceStatus(num(advance), grandTotal, existing?.status);
      updateInvoice({ id: editingFullId, data: { clientName: form.clientName, clientId: clientIdToUse, amount, notes, status, metadata } as any });
    } else {
      const status = deriveInvoiceStatus(num(advance), grandTotal);
      createInvoice({ data: { clientName: form.clientName, clientId: clientIdToUse, amount, notes, status, metadata } as any });
    }
  };

  const saveInlineStatus = (inv: any) => {
    if (editInvStatus === "paid") {
      let existingDate = "";
      try {
        const meta = typeof inv.metadata === "string" ? JSON.parse(inv.metadata) : (inv.metadata || {});
        existingDate = meta?.paymentReceivedDate || "";
      } catch {}
      setPaymentReceivedDate(existingDate || new Date().toISOString().slice(0, 10));
      setPaymentConfirm({ invoice: inv, status: editInvStatus });
      return;
    }
    updateInvoice({ id: inv.id, data: { status: editInvStatus } as any });
  };

  const confirmPaidInvoice = () => {
    if (!paymentConfirm || !paymentReceivedDate) return;
    let meta: any = {};
    try {
      meta = typeof paymentConfirm.invoice.metadata === "string"
        ? JSON.parse(paymentConfirm.invoice.metadata)
        : (paymentConfirm.invoice.metadata || {});
    } catch {}
    const metadata = JSON.stringify({ ...meta, paymentReceivedDate });
    updateInvoice({
      id: paymentConfirm.invoice.id,
      data: { status: paymentConfirm.status, metadata } as any,
    });
  };

  const openEdit = (inv: any) => {
    const meta = parseInvoiceMeta(inv);
    // Always trust the invoice row for the linked client id, in case older
    // metadata snapshots are stale.
    setForm({ ...EMPTY_FORM, ...meta.form, clientId: inv.clientId ?? meta.form.clientId ?? null });
    setItems(meta.items.length > 0 ? meta.items : [newItem()]);
    setShipping(meta.shipping || "none");
    setShippingCustom(meta.shippingCustom || "");
    setWeightKg(meta.weightKg || "");
    setFirstKgRate(meta.firstKgRate ?? cfgFirstKg);
    setAddKgRate(meta.addKgRate ?? cfgAddKg);
    setAdvance(meta.advance || "0");
    setClientSearch("");
    setEditingFullId(inv.id);
    setEntryMode(inv.clientId ? "existing" : "manual");
    setSaveManualAsClient(false);
    setClientCreateError("");
    setAllowDuplicateCustomer(false);
    setShowManual(true);
  };

  const openView = (inv: any) => {
    setViewingInvoice(inv);
  };

  // Deeplink: open the edit modal for ?edit=<id> (e.g. coming from /admin/clients).
  // Fires once after invoices load and the matching invoice is in the list.
  const consumedEditParam = useRef(false);
  useEffect(() => {
    if (consumedEditParam.current) return;
    if (!invoices || invoices.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) { consumedEditParam.current = true; return; }
    const target = invoices.find(i => String(i.id) === editId);
    if (target) {
      openEdit(target);
      consumedEditParam.current = true;
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [invoices]);

  const rangeLabel = INVOICE_RANGE_OPTIONS.find(option => option.value === dateFilter)?.label ?? "This Month";
  // Dashboard cards are period-aware. Default is This Month, not lifetime totals.
  const periodInvoices = (invoices ?? []).filter(inv => invoiceDateMatches(inv.createdAt, dateFilter, customFrom, customTo));
  const totalInvoices = periodInvoices.length;
  const paidCount = periodInvoices.filter(i => i.status === "paid").length;
  // Pending count includes both pending and issued; partial is shown separately.
  const pendingCount = periodInvoices.filter(i => isUnpaidInvoiceStatus(i.status)).length;
  const partialCount = periodInvoices.filter(i => i.status === "partial").length;
  const totalBilled = periodInvoices.reduce((sum, invoice) => sum + num(invoice.amount), 0);
  const totalReceived = periodInvoices.reduce((sum, invoice) => sum + getInvoicePaidAmount(invoice), 0);

  const filteredInvoices = [...periodInvoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(inv => {
      const status = String(inv.status || "").toLowerCase();
      if (paymentView === "unpaid" && (["paid", "cancelled", "partial"].includes(status) || !isUnpaidInvoiceStatus(status) && status !== "overdue")) return false;
      if (paymentView === "partial" && status !== "partial") return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.clientName?.toLowerCase().includes(q) ||
        (inv.orderId ?? "").toLowerCase().includes(q) ||
        (inv.status ?? "").toLowerCase().includes(q)
      );
    });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    issued: "bg-blue-100 text-blue-700",
    partial: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  type StringFormKey = Exclude<keyof typeof form, "clientId">;
  const setF = (k: StringFormKey, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Viewing invoice — reconstruct state from metadata
  const viewMeta = viewingInvoice ? parseInvoiceMeta(viewingInvoice) : null;
  const viewSubtotal = viewMeta ? viewMeta.items.reduce((s: number, it: LineItem) => s + it.qty * num(it.unitPrice), 0) : 0;
  const viewShippingAmt = (() => {
    if (!viewMeta) return 0;
    const { shipping, shippingCustom, weightKg, ratePerKg, firstKgRate, addKgRate, standardRate, expressRate } = viewMeta;
    if (shipping === "custom") return num(shippingCustom);
    if (shipping === "standard") return standardRate ?? cfgStandard;
    if (shipping === "express")  return expressRate  ?? cfgExpress;
    if (shipping === "weight") {
      const kg = num(weightKg);
      if (kg <= 0) return 0;
      if (firstKgRate !== undefined) return num(firstKgRate) + Math.ceil(Math.max(0, kg - 1)) * (num(addKgRate) || 200);
      return Math.ceil(kg * num(ratePerKg || "120")); // legacy
    }
    return 0;
  })();
  const viewGrandTotal = viewSubtotal + viewShippingAmt;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Receipt size={22} className="text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Invoices</h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Generate from a saved client or fill details manually</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-2 shrink-0">
          <button
            onClick={() => { resetForm(); setEntryMode("existing"); setShowManual(true); }}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-stone-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-amber-500/25"
          >
            <User size={13} /> <span className="whitespace-nowrap">From Client</span>
          </button>
          <button
            onClick={() => { resetForm(); setEntryMode("manual"); setShowManual(true); }}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border-2 border-amber-300 text-amber-600 bg-white text-xs sm:text-sm font-semibold hover:bg-amber-50 transition-colors"
          >
            <Plus size={13} /> <span className="whitespace-nowrap">Manual Entry</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Invoice Dashboard Period</div>
            <div className="mt-0.5 text-[11px] text-gray-400">Cards and invoice list use the same date range.</div>
          </div>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as InvoiceDateRange)} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs sm:text-sm font-bold text-gray-700 outline-none focus:border-amber-400">
            {INVOICE_RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {dateFilter === "custom" && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-[11px] font-bold text-gray-400">FROM</span>
          <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400" />
          <span className="text-[11px] font-bold text-gray-400">TO</span>
          <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400" />
        </div>}
      </div>

      {/* Stats — auto-wraps on mid-desktop (3 + 3 = two rows) so the money
          values are never cropped, and collapses to one row on very wide
          (2xl ≥ 1536 px) screens. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { icon: Receipt,           color: "pink",   n: totalInvoices,     label: `${rangeLabel} Invoices`, isMoney: false },
          { icon: Clock,             color: "orange", n: pendingCount,      label: "Pending / Issued",       isMoney: false },
          { icon: CircleDollarSign,  color: "amber",  n: partialCount,      label: "Partial (Advance)",      isMoney: false },
          { icon: CheckCircle,       color: "green",  n: paidCount,         label: "Paid",                   isMoney: false },
          { icon: TrendingUp,        color: "blue",   n: rs(totalBilled),   label: `${rangeLabel} Billed`,   isMoney: true  },
          { icon: DollarSign,        color: "amber",  n: rs(totalReceived), label: `${rangeLabel} Received`, isMoney: true  },
        ].map(({ icon: Icon, color, n, label, isMoney }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl px-3 py-3 sm:px-5 sm:py-4 shadow-sm flex items-center gap-2 sm:gap-4">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-${color}-50 flex items-center justify-center shrink-0`}>
              <Icon size={18} className={`text-${color}-500`} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={
                  isMoney
                    ? "font-bold text-gray-900 text-[clamp(0.65rem,3vw,0.95rem)] sm:text-xl tabular-nums whitespace-nowrap"
                    : "font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis text-[clamp(0.875rem,4vw,1.5rem)] sm:text-2xl"
                }
              >
                {n}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-400 truncate">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── INVOICES TABLE ─── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search invoices..."
              className="flex-1 min-w-0 text-sm outline-none placeholder:text-gray-400" />
            {search && <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={14} /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as InvoiceDateRange)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 outline-none focus:border-amber-400"
              aria-label="Invoice date range"
            >
              {INVOICE_RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button type="button" onClick={() => setPaymentView("all")} className={`rounded-lg px-2.5 py-1 text-[11px] sm:text-xs font-bold transition ${paymentView === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>All</button>
              <button type="button" onClick={() => setPaymentView("unpaid")} className={`rounded-lg px-2.5 py-1 text-[11px] sm:text-xs font-bold transition ${paymentView === "unpaid" ? "bg-orange-500 text-white shadow-sm" : "text-gray-400"}`}>Unpaid</button>
              <button type="button" onClick={() => setPaymentView("partial")} className={`rounded-lg px-2.5 py-1 text-[11px] sm:text-xs font-bold transition ${paymentView === "partial" ? "bg-amber-500 text-white shadow-sm" : "text-gray-400"}`}>Partial</button>
            </div>
          </div>
          {dateFilter === "custom" && <div className="flex w-full flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Custom range</span>
            <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-amber-400" />
          </div>}
        </div>
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-800 text-sm">{paymentView === "unpaid" ? `Unpaid · ${rangeLabel}` : paymentView === "partial" ? `Partial · ${rangeLabel}` : `${rangeLabel} Invoices`}</h3>
          <span className="text-xs text-gray-400">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
        </div>
        {selectedIds.size > 0 && (
          <div className="px-4 sm:px-5 py-2.5 border-b border-amber-100 bg-amber-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-[11px] font-bold shrink-0">{selectedIds.size}</span>
              <span className="text-xs sm:text-sm font-semibold text-amber-700 truncate">selected</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={clearSelection}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-white/70 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 sm:px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                <Trash2 size={13} /> Delete{" "}
                <span className="hidden sm:inline">selected</span>
              </button>
            </div>
          </div>
        )}
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id))}
                    ref={el => {
                      if (el) {
                        const some = filteredInvoices.some(inv => selectedIds.has(inv.id));
                        const all = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id));
                        el.indeterminate = some && !all;
                      }
                    }}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
                      } else {
                        clearSelection();
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-300 cursor-pointer"
                    aria-label="Select all invoices"
                  />
                </th>
                {["Invoice #", "Client", "Order ID", "Amount", "Status", "Date", "Actions"].map((h, i) => (
                  <th key={i} className={`px-4 py-3 ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInvoices.map(inv => {
                const isEditing = editingInvId === inv.id;
                const isSelected = selectedIds.has(inv.id);
                return (
                  <tr key={inv.id} className={`hover:bg-gray-50/50 ${isSelected ? "bg-amber-50/40" : ""}`}>
                    <td className="pl-4 pr-2 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(inv.id)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-300 cursor-pointer"
                        aria-label={`Select invoice ${inv.invoiceNumber}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-500 text-xs font-bold whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{inv.clientName}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {inv.orderId ? (
                        <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded text-gray-600">{inv.orderId}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{rs(inv.amount)}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <select value={editInvStatus} onChange={e => setEditInvStatus(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-amber-300">
                            {["pending","issued","partial","paid","overdue","cancelled"].map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                          <button onClick={() => saveInlineStatus(inv)} className="text-xs px-2 py-1 bg-green-500 text-white rounded-lg font-bold">Save</button>
                          <button onClick={() => setEditingInvId(null)} className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingInvId(inv.id); setEditInvStatus(inv.status); }}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize cursor-pointer border border-transparent hover:border-current transition-colors ${statusColors[inv.status] ?? "bg-gray-100 text-gray-500"}`}
                        >
                          {inv.status}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{format(new Date(inv.createdAt), "MMM dd, yyyy")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* View */}
                        <button onClick={() => openView(inv)} title="View Invoice"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                          <Eye size={14} />
                        </button>
                        {/* Edit */}
                        <button onClick={() => openEdit(inv)} title="Edit Invoice"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                        {/* Delete */}
                        <button onClick={() => setDeleteConfirm({ id: inv.id, number: inv.invoiceNumber })} title="Delete invoice"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    {search ? `No invoices matching "${search}"` : "No invoices yet — orders will auto-generate invoices"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-50">
          {filteredInvoices.map(inv => {
            const isEditing = editingInvId === inv.id;
            const isSelected = selectedIds.has(inv.id);
            return (
              <div key={inv.id} className={`p-4 space-y-2.5 ${isSelected ? "bg-amber-50/40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(inv.id)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-amber-500 focus:ring-amber-300 cursor-pointer shrink-0"
                      aria-label={`Select invoice ${inv.invoiceNumber}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-amber-500 text-[11px] font-bold truncate">{inv.invoiceNumber}</div>
                      <div className="font-semibold text-gray-900 text-sm mt-0.5 truncate">{inv.clientName}</div>
                      {inv.orderId && (
                        <div className="font-mono text-[10px] text-gray-500 bg-gray-50 inline-block px-1.5 py-0.5 rounded mt-1">{inv.orderId}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-gray-900 text-sm whitespace-nowrap">{rs(inv.amount)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{format(new Date(inv.createdAt), "MMM dd")}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select value={editInvStatus} onChange={e => setEditInvStatus(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-amber-300">
                        {["pending","issued","paid","overdue","cancelled"].map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <button onClick={() => saveInlineStatus(inv)} className="text-xs px-2 py-1 bg-green-500 text-white rounded-lg font-bold">Save</button>
                      <button onClick={() => setEditingInvId(null)} className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingInvId(inv.id); setEditInvStatus(inv.status); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${statusColors[inv.status] ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {inv.status}
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button onClick={() => openView(inv)} aria-label="View"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-blue-50 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => openEdit(inv)} aria-label="Edit"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-amber-50 hover:bg-amber-100 hover:text-amber-600 transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeleteConfirm({ id: inv.id, number: inv.invoiceNumber })} aria-label="Delete"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-red-50 hover:bg-red-100 hover:text-red-600 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredInvoices.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">
              {search ? `No invoices matching "${search}"` : "No invoices yet — orders will auto-generate invoices"}
            </div>
          )}
        </div>
      </div>

      {/* ─── VIEW INVOICE MODAL ─── */}
      {viewingInvoice && viewMeta && (
        <InvoicePreview showPrivateFinancials
          form={viewMeta.form}
          items={viewMeta.items}
          shipping={viewMeta.shipping || "none"}
          shippingCustom={viewMeta.shippingCustom || ""}
          shippingLabelOverride={viewMeta.shippingLabel || ""}
          courierName={viewMeta.courierName || ""}
          advance={viewMeta.advance || "0"}
          subtotal={viewSubtotal}
          shippingAmt={viewShippingAmt}
          grandTotal={viewGrandTotal}
          invoiceNumberOverride={viewingInvoice.invoiceNumber}
          createdAtOverride={new Date(viewingInvoice.createdAt)}
          status={viewingInvoice.status}
          linkedOrderId={viewingInvoice.orderId || null}
          onClose={() => setViewingInvoice(null)}
        />
      )}

      {/* ─── CREATE / EDIT MANUAL INVOICE POPUP ─── */}
      {showManual && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={() => { setShowManual(false); resetForm(); }}>
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg sm:max-w-2xl lg:max-w-3xl flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ maxHeight: "calc(100vh - 48px)" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-stone-50 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-amber-500" />
                  <span className="font-bold text-gray-900 text-base">
                    {editingFullId !== null ? "Edit Invoice" : "Create Manual Invoice"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(() => {
                    const editing = editingFullId !== null
                      ? (invoices ?? []).find(i => i.id === editingFullId)
                      : null;
                    return editing?.orderId
                      ? <>Linked to order: <span className="font-mono font-semibold text-gray-600">{editing.orderId}</span></>
                      : "Multi-item invoice with shipping & advance payment";
                  })()}
                </p>
              </div>
              <button onClick={() => { setShowManual(false); resetForm(); }} className="p-1.5 hover:bg-white/80 rounded-lg transition-colors mt-0.5">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-6">

                {/* Client Information — Existing or Manual */}
                <section>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center"><User size={13} className="text-amber-600" /></div>
                      <span className="text-sm font-bold text-gray-800">Client Information</span>
                    </div>
                    {/* Mode toggle — available in both create and edit so client can always be changed */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => { setEntryMode("existing"); }}
                        className={`px-2.5 py-1 rounded-md transition-colors ${entryMode === "existing" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500"}`}
                      >Existing</button>
                      <button
                        type="button"
                        onClick={() => { setEntryMode("manual"); clearClient(); }}
                        className={`px-2.5 py-1 rounded-md transition-colors ${entryMode === "manual" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500"}`}
                      >Manual</button>
                    </div>
                  </div>

                  {/* Searchable dropdown — only in 'existing' mode */}
                  {entryMode === "existing" && (
                    <div className="relative mb-3">
                      <label className="text-[10px] font-semibold text-amber-500 mb-1.5 flex items-center gap-1"><User size={10} /> Select Client from Database *</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={clientSearch}
                          onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                          onFocus={() => setShowClientDropdown(true)}
                          placeholder={form.clientName ? `Selected: ${form.clientName}` : "Search clients by name or phone…"}
                          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-gray-400"
                        />
                      </div>
                      {showClientDropdown && (
                        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                          {filteredClients.length > 0 ? (
                            filteredClients.map((c: any) => (
                              <button key={c.id} type="button" onClick={() => selectClient(c)} className="w-full text-left px-4 py-2.5 hover:bg-amber-50 text-sm border-b border-gray-50 last:border-0">
                                <div className="font-semibold text-gray-800">{c.name}</div>
                                {c.phone && <div className="text-xs text-gray-400">{c.phone}{c.businessName ? ` · ${c.businessName}` : ""}</div>}
                              </button>
                            ))
                          ) : (
                            !showAddNewClient && (
                              <div className="px-4 py-3 text-sm text-gray-400 italic">No clients found. Type a name to add a new one, or switch to Manual.</div>
                            )
                          )}
                          {showAddNewClient && (
                            <button
                              type="button"
                              onClick={startManualEntry}
                              className="w-full text-left px-4 py-2.5 hover:bg-amber-50 text-sm border-t border-gray-100 flex items-center gap-2 text-amber-600 font-semibold"
                            >
                              <UserPlus size={13} />
                              Add &ldquo;{clientSearch.trim()}&rdquo; as new client
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual entry: full-name input always shown in manual mode */}
                  {entryMode === "manual" && (
                    <div className="mb-3">
                      <label className="text-[10px] font-semibold text-amber-500 mb-1.5 flex items-center gap-1"><User size={10} /> Client Full Name *</label>
                      <input
                        value={form.clientName}
                        onChange={e => setF("clientName", e.target.value)}
                        placeholder="e.g. Nipun Kavinda"
                        className="input-field"
                      />
                    </div>
                  )}

                  {/* Editable details — shown in manual mode always, or in existing mode after a client is picked */}
                  {(entryMode === "manual" || form.clientName) ? (
                    <div className="space-y-2.5" onClick={() => setShowClientDropdown(false)}>
                      {entryMode === "existing" && form.clientName && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${form.clientId ? "bg-amber-50 border-amber-100" : "bg-amber-50 border-amber-100"}`}>
                          <User size={13} className={`${form.clientId ? "text-amber-500" : "text-amber-500"} shrink-0`} />
                          <span className={`text-sm font-semibold flex-1 truncate ${form.clientId ? "text-amber-700" : "text-amber-700"}`}>{form.clientName}</span>
                          {form.clientId ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500 bg-white/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Check size={10} /> Linked
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-white/70 px-1.5 py-0.5 rounded">
                              Unlinked
                            </span>
                          )}
                          <button type="button" onClick={clearClient} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      )}
                      {entryMode === "manual" && form.clientName && editingFullId === null && !form.clientId && (
                        <label className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveManualAsClient}
                            onChange={e => setSaveManualAsClient(e.target.checked)}
                            className="mt-0.5 accent-amber-500"
                          />
                          <span>
                            Also save <strong>{form.clientName || "this client"}</strong> to the Clients database and link this invoice.
                          </span>
                        </label>
                      )}
                      {clientCreateError && (
                        <p className="text-xs text-red-600 px-1">{clientCreateError}</p>
                      )}
                      {duplicatePhoneClient && saveManualAsClient && (
                        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                          <div className="flex items-start gap-2 text-amber-800">
                            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                            <div className="flex-1">
                              <div className="font-bold">Existing customer found</div>
                              <div className="mt-0.5">
                                {duplicatePhoneClient.name} (PB{String(duplicatePhoneClient.id).padStart(4, "0")}) already uses this phone number.
                              </div>
                            </div>
                            <button type="button" onClick={() => selectClient(duplicatePhoneClient)} className="rounded-lg bg-amber-500 px-2.5 py-1 font-bold text-white">
                              Use existing
                            </button>
                          </div>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">
                            <input type="checkbox" checked={allowDuplicateCustomer} onChange={e => setAllowDuplicateCustomer(e.target.checked)} className="mt-0.5 accent-red-600" />
                            <span><strong>Create as a separate customer anyway.</strong> Use only when a different customer genuinely shares this phone number.</span>
                          </label>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">📞 Phone</label>
                          <input value={form.phone} onChange={e => { setF("phone", e.target.value); setAllowDuplicateCustomer(false); }} placeholder="077 123 4567" className="input-field" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">✉ Email</label>
                          <input value={form.email} onChange={e => setF("email", e.target.value)} placeholder="client@email.com" className="input-field" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">🏢 Business Name</label>
                          <input value={form.businessName} onChange={e => setF("businessName", e.target.value)} placeholder="ABC Pvt Ltd" className="input-field" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">📍 Address</label>
                          <input value={form.address} onChange={e => setF("address", e.target.value)} placeholder="Colombo, Sri Lanka" className="input-field" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Search and select a client above to fill in their details, or switch to <button type="button" onClick={() => setEntryMode("manual")} className="text-amber-500 font-semibold underline">Manual</button>.</p>
                  )}
                </section>

                {/* Line Items */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-stone-100 flex items-center justify-center"><ListOrdered size={13} className="text-stone-600" /></div>
                    <span className="text-sm font-bold text-gray-800">Line Items</span>
                  </div>
                  <div className="relative mb-3 rounded-2xl border border-stone-100 bg-stone-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between"><div><div className="text-xs font-bold text-stone-700">Add from Products & Services</div><div className="text-[10px] text-gray-400">Search the catalog, or continue with manual line items below.</div></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-stone-600">{catalogItems.length} items</span></div>
                    <div className="relative">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input value={catalogSearch} onFocus={()=>setShowCatalogDropdown(true)} onChange={e=>{setCatalogSearch(e.target.value);setShowCatalogDropdown(true);}} onBlur={()=>window.setTimeout(()=>setShowCatalogDropdown(false),150)} placeholder="Search sticker print, business cards, design service..." className="input-field w-full pl-9"/>
                      {showCatalogDropdown&&<div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">{filteredCatalogItems.length===0?<div className="px-3 py-6 text-center text-xs text-gray-400">No matching product or service</div>:filteredCatalogItems.map(item=><button key={item.key} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>addCatalogItem(item)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-stone-50"><span className={`rounded-md px-2 py-1 text-[9px] font-black ${item.kind==="Product"?"bg-amber-50 text-amber-600":"bg-blue-50 text-blue-600"}`}>{item.kind}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-gray-800">{item.name}</span>{item.category&&<span className="block text-[10px] text-gray-400">{item.category}</span>}</span><span className="text-xs font-black text-stone-600">{num(item.price)>0?rs(item.price):"Manual price"}</span></button>)}</div>}
                    </div>
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
                      const lineTotal = it.qty * num(it.unitPrice);
                      return (
                        <div key={it.id} className="bg-gray-50 rounded-xl p-2.5 sm:p-3 space-y-2">
                          {/* Mobile: stacked (description on its own row, then qty/price/total). */}
                          <div className="block sm:hidden space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={it.description}
                                onChange={e => updateItem(it.id, "description", e.target.value)}
                                placeholder={`Item ${idx + 1}`}
                                className="input-field text-sm flex-1 min-w-0"
                              />
                              {items.length > 1 && (
                                <button
                                  onClick={() => removeItem(it.id)}
                                  className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-2 transition-colors flex items-center justify-center shrink-0"
                                  title="Remove item"
                                  aria-label="Remove item"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
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
                                  placeholder="0.00"
                                  aria-label="Unit price"
                                  className="input-field text-right text-sm font-semibold pl-9 w-full"
                                />
                              </div>
                              <span className="text-sm font-bold text-amber-600 text-right whitespace-nowrap pl-1 pr-0.5">
                                Rs. {lineTotal.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          {/* Desktop: original single-row grid. */}
                          <div
                            className="hidden sm:grid gap-2 items-center"
                            style={{ gridTemplateColumns: "minmax(0,1fr) 90px 120px 110px 24px" }}
                          >
                            <input value={it.description} onChange={e => updateItem(it.id, "description", e.target.value)} placeholder={`Item ${idx + 1}`} className="input-field text-base" />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={it.qty || ""}
                              onChange={e => {
                                const v = e.target.value.replace(/[^\d]/g, "");
                                updateItem(it.id, "qty", v === "" ? 0 : parseInt(v));
                              }}
                              onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) updateItem(it.id, "qty", 1); }}
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
                                placeholder="0.00"
                                className="input-field text-right text-base font-semibold pl-9"
                              />
                            </div>
                            <span className="text-sm font-bold text-amber-600 text-right truncate">
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

                          <input value={it.notes} onChange={e => updateItem(it.id, "notes", e.target.value)} placeholder="Notes / specifications (optional)"
                            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-200 placeholder:text-gray-300 text-gray-600" />
                        </div>
                      );
                    })}
                    {/* Always-visible "Add another item" right under the last
                        row, so users with long invoices don't have to scroll
                        all the way back up to the section header. */}
                    <button
                      type="button"
                      onClick={addItem}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-amber-200 text-amber-600 text-xs font-bold hover:border-amber-400 hover:bg-amber-50/60 transition-colors"
                    >
                      <Plus size={14} /> Add another item
                    </button>
                  </div>
                </section>

                {/* Shipping */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center"><Truck size={13} className="text-blue-600" /></div>
                    <span className="text-sm font-bold text-gray-800">Shipping Charges</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SHIPPING_OPTIONS.map(opt => (
                      <button key={opt.key} onClick={() => setShipping(opt.key)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left border-2 transition-all ${shipping === opt.key ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {opt.key === "standard" ? `🚚 Standard — Rs. ${cfgStandard.toLocaleString("en-IN")}` :
                         opt.key === "express"  ? `⚡ Express — Rs. ${cfgExpress.toLocaleString("en-IN")}` :
                         opt.key === "weight"   ? "⚖️ Weight-based" :
                         opt.key === "custom"   ? "✏️ Custom Amount" : "No Shipping / Pickup"}
                      </button>
                    ))}
                  </div>
                  {shipping === "weight" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input type="number" min={0} step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="0.0" className="input-field pr-10" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">kg</span>
                        </div>
                        {num(weightKg) > 0 && (
                          <span className="text-sm font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl whitespace-nowrap">
                            Rs. {weightShippingAmt.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                      <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 space-y-2">
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Weight Rates (editable)</div>
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
                        {num(weightKg) > 0 && (
                          <div className="text-xs text-blue-700 bg-blue-100/60 rounded-lg px-3 py-1.5 font-medium">
                            {num(weightKg) <= 1
                              ? `${num(weightKg)}kg = Rs. ${weightShippingAmt.toLocaleString("en-IN")}`
                              : `1st kg Rs.${num(firstKgRate)} + ${Math.ceil(num(weightKg) - 1)}kg × Rs.${num(addKgRate)} = Rs. ${weightShippingAmt.toLocaleString("en-IN")}`
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
                      onChange={e => setAdvance(e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0"
                      className="input-field pl-11 pr-3 text-right font-semibold"
                    />
                  </div>
                  <div className="mt-3 bg-gradient-to-r from-amber-50 to-stone-50 rounded-xl p-3 space-y-1.5 border border-amber-100">
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
                    <div className="border-t border-amber-200 pt-1.5 flex justify-between text-sm font-bold">
                      <span>Grand Total</span><span className="text-amber-600">Rs. {grandTotal.toLocaleString("en-IN")}</span>
                    </div>
                    {num(advance) > 0 && (
                      <div className="flex justify-between text-sm font-bold text-stone-700">
                        <span>Balance Due</span><span>Rs. {(grandTotal - num(advance)).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Private Profit Tracking — owner or finance-authorized staff only */}
                {canViewFinance && <section>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp size={13} className="text-emerald-600" /></div>
                      <span className="text-sm font-bold text-gray-800">Profit Tracking</span>
                    </div>
                    <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1"><Lock size={9}/>Private</span>
                  </div>
                  <div className="space-y-2">
                    {items.filter(it => it.description.trim()).map((it, idx) => {
                      const revenue = it.qty * num(it.unitPrice);
                      const cost = it.qty * num(it.costPrice || "0");
                      const profit = revenue - cost;
                      const hasCost = num(it.costPrice || "0") > 0;
                      return (
                        <div key={it.id} className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100">
                          <div className="text-xs font-semibold text-gray-600 mb-1.5 truncate">{it.description}</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-400 block mb-0.5">Cost Price (Rs.)</label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400 pointer-events-none select-none">Rs.</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={it.costPrice || ""}
                                  onChange={e => updateItem(it.id, "costPrice", e.target.value.replace(/[^\d.]/g, ""))}
                                  placeholder="0.00"
                                  className="w-full pl-9 pr-2 py-1.5 border border-emerald-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-300 bg-white text-right font-semibold"
                                />
                              </div>
                            </div>
                            <div className="text-right shrink-0 min-w-[80px]">
                              <div className="text-[10px] text-gray-400">Profit</div>
                              <div className={`text-sm font-bold ${!hasCost ? "text-gray-300" : profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {hasCost ? `Rs. ${profit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 border-t border-emerald-100 pt-3 space-y-2">
                            <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1"><input list={`cost-source-${it.id}`} value={costSearchByItem[it.id]||""} onChange={e=>setCostSearchByItem(current=>({...current,[it.id]:e.target.value}))} placeholder="Search paper, print cost, cut..." className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-300"/><datalist id={`cost-source-${it.id}`}>{invoiceCostSources.map(source=><option key={source.key} value={source.name}>{source.type==="inventory"?"Material":"Production"} · {rs(source.unitCost)} / {source.unit}</option>)}</datalist></div><button type="button" onClick={()=>{const q=(costSearchByItem[it.id]||"").toLowerCase();const source=invoiceCostSources.find(entry=>entry.name.toLowerCase()===q||entry.key===q);if(source)addCostComponent(it.id,source.key);}} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white">Add Cost</button></div>
                            {(it.costComponents||[]).map(component=><div key={component.id} className="rounded-xl border border-emerald-100 bg-white p-2"><div className="flex items-center gap-2"><span className={`rounded-md px-1.5 py-1 text-[9px] font-black ${component.type==="inventory"?"bg-blue-50 text-blue-600":"bg-stone-50 text-stone-600"}`}>{component.type==="inventory"?"MATERIAL":"COST"}</span><span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-700">{component.name}</span><span className="text-[10px] font-semibold text-gray-400">{rs(component.unitCost)}/{component.unit}</span><button type="button" onClick={()=>removeCostComponent(it.id,component.id)} className="p-1 text-gray-300 hover:text-red-500"><X size={12}/></button></div><div className={`mt-2 grid gap-2 ${component.type==="inventory"?"grid-cols-3":"grid-cols-2"}`}><label className="text-[9px] font-bold text-gray-400">USED / QTY<input type="number" min="0" value={component.quantity} onChange={e=>updateCostComponent(it.id,component.id,"quantity",e.target.value)} className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"/></label>{component.type==="inventory"&&<label className="text-[9px] font-bold text-orange-500">EXTRA WASTE<input type="number" min="0" value={component.wasteQuantity||""} onChange={e=>updateCostComponent(it.id,component.id,"wasteQuantity",e.target.value)} className="mt-1 w-full rounded-md border border-orange-200 px-2 py-1.5 text-xs"/></label>}<div className="self-end pb-1 text-right"><div className="text-[9px] text-gray-400">Component Total</div><div className="text-xs font-black text-emerald-700">{rs(componentTotal(component))}</div></div></div></div>)}
                            {(it.costComponents||[]).some(component=>component.type==="inventory")&&<label className="flex items-start gap-2 rounded-lg bg-blue-50 p-2 text-[10px] text-blue-700"><input type="checkbox" checked={!!it.deductStock} onChange={e=>updateItem(it.id,"deductStock",e.target.checked)} className="mt-0.5"/><span><b>Deduct used + waste from inventory when invoice is saved</b><br/>Editing the invoice recalculates the same usage; deleting restores stock.</span></label>}
                            {(it.costComponents||[]).length>0&&<div className="flex justify-between rounded-lg bg-emerald-100/60 px-3 py-2 text-xs font-black text-emerald-800"><span>Total line cost</span><span>{rs((it.costComponents||[]).reduce((sum,component)=>sum+componentTotal(component),0))}</span></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const validItems = items.filter(it => it.description.trim());
                    const hasCost = validItems.some(it => num(it.costPrice || "0") > 0);
                    if (!hasCost) return (
                      <p className="text-xs text-gray-400 italic mt-2 px-1">Enter cost prices above to see profit calculations. Private — not shown on invoice.</p>
                    );
                    const totalCost = validItems.reduce((s, it) => s + it.qty * num(it.costPrice || "0"), 0);
                    const totalProfit = subtotal - totalCost;
                    const margin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;
                    return (
                      <div className="mt-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 space-y-1.5 border border-emerald-100">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Total Cost</span><span className="font-semibold text-red-500">Rs. {totalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Revenue (items only)</span><span className="font-semibold">Rs. {subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                        </div>
                        {shippingAmt > 0 && (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>+ Shipping</span><span className="font-semibold">Rs. {shippingAmt.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="border-t border-emerald-200 pt-1.5 flex justify-between text-sm font-bold">
                          <span>Net Profit</span>
                          <span className={totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}>
                            Rs. {totalProfit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-gray-500">Margin</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${margin >= 30 ? "bg-emerald-100 text-emerald-700" : margin >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </section>}

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
              <button onClick={() => setShowPreview(true)} disabled={!form.clientName.trim()}
                className="flex-1 py-2.5 border-2 border-amber-200 text-amber-600 text-sm font-bold rounded-xl hover:bg-amber-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Eye size={14} /> Preview
              </button>
              <button onClick={handleSave} disabled={isPending || isUpdating || !form.clientName.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-stone-600 text-white text-sm font-bold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                {isPending || isUpdating ? "Saving…" : editingFullId !== null ? "Update Invoice" : "Save & Continue"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ─── CREATE PREVIEW (before saving new invoice) ─── */}
      {showPreview && !editingFullId && (
        <InvoicePreview showPrivateFinancials
          form={form} items={items} shipping={shipping} shippingCustom={shippingCustom}
          advance={advance} subtotal={subtotal} shippingAmt={shippingAmt} grandTotal={grandTotal}
          onClose={() => setShowPreview(false)}
          onSave={handleSave}
          isSaving={isPending}
        />
      )}

      {paymentConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle size={21}/></div>
                <div><h2 className="font-black text-gray-900">Confirm Payment Received</h2><p className="text-xs text-gray-500">{paymentConfirm.invoice.invoiceNumber} · {paymentConfirm.invoice.clientName}</p></div>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-800">
                This invoice will be marked Paid and <b>{rs(paymentConfirm.invoice.amount)}</b> will be recorded in Cash Flow for the selected month.
              </div>
              <label className="block text-xs font-bold text-gray-600">Payment Received Date
                <input type="date" value={paymentReceivedDate} max="9999-12-31" onChange={e => setPaymentReceivedDate(e.target.value)} className="input-field mt-1.5"/>
              </label>
              <p className="text-[11px] leading-relaxed text-gray-400">If this invoice was paid in July but updated later, select the actual July payment date. Re-saving will update the same finance entry—not create a duplicate.</p>
            </div>
            <div className="flex gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
              <button type="button" onClick={() => setPaymentConfirm(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-bold text-gray-600">Cancel</button>
              <button type="button" onClick={confirmPaidInvoice} disabled={!paymentReceivedDate || isUpdating} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white disabled:opacity-50">{isUpdating ? "Confirming…" : "Confirm Paid"}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Invoice"
        message={deleteConfirm ? `Are you sure you want to delete invoice ${deleteConfirm.number}?` : ""}
        confirmLabel="Delete Invoice"
        onConfirm={() => { if (deleteConfirm) deleteInvoice({ id: deleteConfirm.id }); }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${selectedIds.size} invoice${selectedIds.size === 1 ? "" : "s"}?`}
        message={`This will permanently delete ${selectedIds.size} selected invoice${selectedIds.size === 1 ? "" : "s"}. This action cannot be undone.`}
        confirmLabel={bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size}`}
        onConfirm={runBulkDelete}
        onCancel={() => { if (!bulkDeleting) setBulkDeleteConfirm(false); }}
      />
    </div>
  );
}
