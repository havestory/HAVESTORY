import { useState, useRef, useEffect, useMemo, useDeferredValue } from "react";
import { useLocation } from "wouter";
import JSZip from "jszip";
import { useCreateClient, useUpdateClient, useDeleteClient, useGetAdminMe, useGetSettings } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Plus, Download, RefreshCw, X, Users, Phone, MapPin, Mail, FileText, MoreVertical, Pencil, Trash2, UserCircle2, Briefcase, Receipt, ChevronRight, ExternalLink, CheckCircle2, PackageCheck, ShieldCheck, Copy, FileSignature } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ShippingDetailsModal } from "@/components/admin/ShippingDetailsModal";
import { getInvoicePaidAmount } from "@/lib/invoiceTypes";
import { getBusinessName } from "@/lib/brand-settings";

type Client = {
  id: number;
  name: string;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  premiumPriceListId?: number | null;
  premiumNumber?: string | null;
  approved?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ClientSummary = Client & {
  projectCount: number;
  invoiceCount: number;
  invoiced: number;
  paid: number;
};

type ClientSummaryPage = {
  items: ClientSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: { total: number; withBusiness: number; withEmail: number; withPhone: number };
};

type CrmProject = {
  id: number;
  projectId: string;
  title: string;
  clientName: string;
  clientId?: number | null;
  status: string;
  totalValue?: number | null;
  amountPaid?: number | null;
  dueDate?: string | null;
  createdAt?: string | null;
};

type InvoiceLite = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  clientId?: number | null;
  amount: string | number;
  status: string;
  metadata?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
};

type FormState = {
  name: string;
  businessName: string;
  phones: string[];
  email: string;
  address: string;
  notes: string;
  premiumPriceListId: number | null;
};

const rs = (v: number) => `LKR ${Math.round(v).toLocaleString("en-IN")}`;
const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const projectStatusStyle: Record<string, string> = {
  planning: "bg-admin-brand-soft text-admin-brand-ink",
  in_progress: "bg-admin-subtle text-admin-muted",
  review: "bg-admin-warning-soft text-admin-warning",
  completed: "bg-admin-success-soft text-admin-success",
  on_hold: "bg-admin-subtle text-admin-muted",
};
const invoiceStatusStyle: Record<string, string> = {
  pending: "bg-admin-warning-soft text-admin-warning",
  paid: "bg-admin-success-soft text-admin-success",
  overdue: "bg-admin-danger-soft text-admin-danger",
  draft: "bg-admin-subtle text-admin-muted",
};

const buildAgreementTemplates = (businessName: string) => {
  const issuer = businessName || "the business";
  return [
    {
      id: "studio",
      label: "Studio, Print & Frame Services",
      title: `${issuer} Services Agreement`,
      text: `STUDIO, PRINT & FRAME SERVICES AGREEMENT

1. Parties & Service
This agreement covers photography, printing, framing and related studio services supplied by ${issuer} to the client named above. The exact items, quantities, sizes, materials, finishes, prices and delivery method are those approved in the relevant quotation, invoice or order confirmation.

2. Artwork & Client Content
The client confirms that supplied artwork, logos, text, photographs and other content may legally be used for the requested work. The client is responsible for checking spelling, dimensions, contact details and content before approval.

3. Proof & Approval
Production may begin after the client approves the final proof or artwork where a proof is provided. Changes requested after approval may require additional charges and may change the completion date.

4. Colour, Cutting & Production Tolerances
Screen colours can differ from printed output. Reasonable differences caused by print process, paper, material, finishing, cutting or device calibration are not treated as a defect unless a specific written tolerance was agreed.

5. Price & Payment
Prices follow the approved quotation or invoice. Production may be held until the required advance or full payment is received. Extra work outside the approved scope may be quoted separately.

6. Turnaround & Delivery
Turnaround starts after required artwork approval and payment. Delivery times are estimates unless a written guaranteed deadline is accepted. Courier charges and third-party delays follow the agreed order terms.

7. Changes, Cancellation & Reprints
Cancellation or quantity changes after production has started may incur costs for work or material already used. A genuine production error attributable to ${issuer} will be reviewed for an appropriate reprint or remedy.

8. Intellectual Property & Privacy
Client-owned content remains the client's content. ${issuer} retains rights in its own pre-existing tools, templates and working methods. Personal and order data is handled only for legitimate service and business administration purposes.

9. Acceptance
By signing electronically, the signer confirms authority to accept these terms and the approved service scope on behalf of the client.`,
    },
  ];
};

const EMPTY_FORM: FormState = { name: "", businessName: "", phones: [""], email: "", address: "", notes: "", premiumPriceListId: null };

const splitPhones = (raw?: string | null): string[] => {
  if (!raw) return [""];
  const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [""];
};

const joinPhones = (arr: string[]): string => arr.map(p => p.trim()).filter(Boolean).join(", ");

function ClientFormModal({
  title,
  form,
  setForm,
  onSubmit,
  onClose,
  isSaving,
  priceLists,
  isOwner,
}: {
  title: string;
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSaving: boolean;
  priceLists: Array<{ id: number; title: string; premiumItems: Array<{ id: string }>; active: boolean }>;
  isOwner: boolean;
}) {
  const updatePhone = (index: number, value: string) => {
    setForm(prev => {
      const phones = [...prev.phones];
      phones[index] = value;
      return { ...prev, phones };
    });
  };
  const addPhone = () => setForm(prev => ({ ...prev, phones: [...prev.phones, ""] }));
  const removePhone = (index: number) =>
    setForm(prev => {
      const phones = prev.phones.filter((_, i) => i !== index);
      return { ...prev, phones: phones.length ? phones : [""] };
    });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-admin-inverse/60 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-admin-surface rounded-2xl shadow-2xl w-full max-w-md" style={{ maxHeight: "calc(100vh - 48px)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border">
            <h2 className="font-bold text-admin-ink text-lg">{title}</h2>
            <button onClick={onClose} className="inline-flex items-center justify-center p-1.5 hover:bg-admin-subtle rounded-lg transition-colors">
              <X size={18} className="text-admin-muted" />
            </button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
            <div>
              <label className="text-xs font-semibold text-admin-muted block mb-1">Full Name <span className="text-admin-warning">*</span></label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Enter full name"
                className="w-full border border-admin-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-admin-warning-line transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-admin-muted block mb-1">Business Name</label>
              <input
                value={form.businessName}
                onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))}
                placeholder="Enter business name"
                className="w-full border border-admin-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-admin-warning-line transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-admin-muted">Phone Numbers</label>
                <button
                  type="button"
                  onClick={addPhone}
                  className="flex items-center gap-1 text-[11px] font-semibold text-admin-warning hover:text-admin-warning"
                >
                  <Plus size={11} /> Add another
                </button>
              </div>
              <div className="space-y-2">
                {form.phones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center flex-1 border border-admin-border rounded-xl pl-3 pr-1 focus-within:border-admin-warning-line transition-colors">
                      <Phone size={13} className="text-admin-muted shrink-0" />
                      <input
                        value={p}
                        onChange={e => updatePhone(i, e.target.value)}
                        placeholder={i === 0 ? "Primary phone number" : `Phone ${i + 1}`}
                        className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
                        inputMode="tel"
                      />
                    </div>
                    {form.phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhone(i)}
                        className="inline-flex items-center justify-center p-2 text-admin-muted hover:text-admin-danger hover:bg-admin-danger-soft rounded-lg transition-colors"
                        aria-label="Remove phone"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-admin-muted block mb-1">Email</label>
              <input
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="Enter email address"
                type="email"
                className="w-full border border-admin-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-admin-warning-line transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-admin-muted block mb-1">Address</label>
              <textarea
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder={"House / Building\nStreet / Area\nCity"}
                rows={3}
                className="w-full resize-y border border-admin-border rounded-xl px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-admin-warning-line transition-colors"
              />
              <p className="mt-1 text-[10px] leading-relaxed text-admin-muted">Use a new line for each address part. Line breaks will be kept on customer cards and shipping labels.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-admin-muted block mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Add notes about this client"
                rows={3}
                className="w-full border border-admin-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-admin-warning-line transition-colors resize-none"
              />
            </div>
            {isOwner && <div className="rounded-xl border border-admin-border bg-admin-subtle p-3 space-y-2">
              <label htmlFor="client-premium-list" className="text-xs font-semibold text-admin-ink">Premium price list</label>
              <select id="client-premium-list" value={form.premiumPriceListId ?? ""}
                onChange={e => setForm(p => ({ ...p, premiumPriceListId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-lg border border-admin-border bg-admin-surface px-3 py-2.5 text-sm text-admin-ink">
                <option value="">Standard customer</option>
                {priceLists.map(list => <option key={list.id} value={list.id}>{list.title} · {list.premiumItems?.length || 0} items{list.active ? "" : " (inactive)"}</option>)}
              </select>
              <p className="text-xs text-admin-muted">Assign a list to generate a premium customer number and apply its offer to admin orders.</p>
            </div>}
            <button
              onClick={onSubmit}
              disabled={isSaving || !form.name.trim()}
              className="w-full py-3 bg-admin-brand text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-60 transition-all"
            >
              {isSaving ? "Saving..." : title}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardMenu({ onEdit, onDelete, canDelete }: { onEdit: () => void; onDelete: () => void; canDelete:boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center justify-center p-1.5 rounded-lg text-admin-muted hover:bg-admin-subtle hover:text-admin-muted transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-admin-surface border border-admin-border rounded-xl shadow-lg py-1 w-32 text-sm">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-admin-ink hover:bg-admin-surface transition-colors"
          >
            <Pencil size={13} className="text-admin-brand-ink" /> Edit
          </button>
          {canDelete&&<button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-admin-danger hover:bg-admin-danger-soft transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>}
        </div>
      )}
    </div>
  );
}

export default function AdminClients() {
  const { data: settings } = useGetSettings();
  const businessName = getBusinessName(settings as any);
  const agreementTemplates = useMemo(() => buildAgreementTemplates(businessName), [businessName]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [shippingClient, setShippingClient] = useState<Client | null>(null);
  const [verification, setVerification] = useState<any>(null);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [agreements,setAgreements]=useState<any[]>([]);
  const [agreementTemplate,setAgreementTemplate]=useState("studio");
  const [agreementTitle,setAgreementTitle]=useState("Studio, Print & Frame Services Agreement");
  const [agreementText,setAgreementText]=useState("");
  const [agreementUrl,setAgreementUrl]=useState("");
  const [agreementBusy,setAgreementBusy]=useState(false);
  const [showAgreementForm,setShowAgreementForm]=useState(false);
  const [, setLocation] = useLocation();

  const { data: admin } = useGetAdminMe({ query: { staleTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false } as any });
  const isOwner = Boolean(admin && admin.role !== "staff");
  const { data: premiumPriceLists = [] } = useQuery<Array<{ id: number; title: string; premiumItems: Array<{ id: string }>; active: boolean }>>({
    queryKey: ["/api/price-lists", "client-assignment"],
    queryFn: async () => { const response = await fetch("/api/price-lists", { credentials: "include" }); if (!response.ok) throw new Error("Could not load price lists"); return response.json(); },
    enabled: isOwner,
  });
  const {
    data: clientPage,
    refetch,
    isFetching,
    isError: clientsError,
    error: clientsLoadError,
  } = useQuery<ClientSummaryPage>({
    queryKey: ["/api/clients/summary", page, deferredSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "30" });
      if (deferredSearch) params.set("search", deferredSearch);
      const response = await fetch(`/api/clients/summary?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch client summaries");
      return response.json();
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
  const clients = clientPage?.items || [];
  useEffect(() => { setPage(1); }, [deferredSearch]);

  const { data: activityData, isFetching: activityLoading } = useQuery<{ projects: CrmProject[]; invoices: InvoiceLite[] }>({
    queryKey: ["/api/clients", viewingClient?.id, "activity"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${viewingClient!.id}/activity`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch client activity");
      return response.json();
    },
    enabled: Boolean(viewingClient?.id),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setVerification(null);
    setVerificationUrl("");
    setVerificationError("");
    if (!isOwner || !viewingClient) return;
    fetch(`/api/admin/clients/${viewingClient.id}/verification`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || "Could not load identity verification");
        return response.json();
      })
      .then(setVerification)
      .catch(error => setVerificationError(error instanceof Error ? error.message : "Could not load identity verification"));
  }, [isOwner, viewingClient?.id]);

  useEffect(()=>{
    setAgreements([]);setAgreementUrl("");setShowAgreementForm(false);
    if(!isOwner||!viewingClient)return;
    fetch(`/api/admin/clients/${viewingClient.id}/agreements`,{credentials:"include",cache:"no-store"})
      .then(r=>r.ok?r.json():[]).then(x=>setAgreements(Array.isArray(x)?x:[])).catch(()=>setAgreements([]));
  },[isOwner,viewingClient?.id]);

  const applyAgreementTemplate=(id:string)=>{const t=agreementTemplates.find(x=>x.id===id)||agreementTemplates[0];setAgreementTemplate(t.id);setAgreementTitle(t.title);setAgreementText(t.text);};
  useEffect(()=>{const t=agreementTemplates[0];setAgreementTemplate(t.id);setAgreementTitle(t.title);setAgreementText(t.text);},[agreementTemplates]);
  const createAgreement=async(clientId:number)=>{
    setAgreementBusy(true);
    try{
      const r=await fetch(`/api/admin/clients/${clientId}/agreements`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:agreementTitle,agreementText,brandName:businessName,operatorName:businessName})});
      const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Could not create agreement");
      const full=new URL(b.path,window.location.origin).toString();setAgreementUrl(full);try{await navigator.clipboard.writeText(full)}catch{}
      setAgreements(x=>[b,...x]);setShowAgreementForm(false);applyAgreementTemplate(agreementTemplates[0].id);
    }catch(e){setVerificationError(e instanceof Error?e.message:"Could not create agreement")}finally{setAgreementBusy(false)}
  };

  const generateVerificationLink = async (clientId: number) => {
    setVerificationBusy(true);
    setVerificationError("");
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/verification-link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not create secure link");
      const fullUrl = new URL(body.path, window.location.origin).toString();
      setVerificationUrl(fullUrl);
      setVerification((current: any) => ({ ...(current || {}), exists: true, status: body.status }));
      await navigator.clipboard?.writeText(fullUrl).catch(() => undefined);
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "Could not create secure link");
    } finally {
      setVerificationBusy(false);
    }
  };

  const copyVerificationLink = async () => {
    if (!verificationUrl) return;
    await navigator.clipboard?.writeText(verificationUrl).catch(() => undefined);
  };

  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clients/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  };

  const { mutate: createClient, isPending: isCreating } = useCreateClient({ mutation: { onSuccess: () => { invalidate(); setShowAdd(false); setForm(EMPTY_FORM); }, onError: (error: any) => { window.alert(error?.response?.data?.error || error?.message || "Could not save client. Please try again."); } } });
  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient({ mutation: { onSuccess: () => { invalidate(); setEditingClient(null); setForm(EMPTY_FORM); } } });
  const { mutate: deleteClient } = useDeleteClient({ mutation: { onSuccess: () => invalidate() } });

  const clientCode = (c: Client) => `C${String(c.id).padStart(4, "0")}`;

  // Summary rows keep the initial page payload small. Full linked records are
  // requested only for the client whose details are currently open.
  const statsFor = (c: Client) => {
    const summary = c as ClientSummary;
    const isSelected = viewingClient?.id === c.id && Boolean(activityData);
    const linkedInvoices = isSelected ? activityData!.invoices : [];
    const linkedProjects = isSelected ? activityData!.projects : [];
    return {
      projects: linkedProjects,
      invoices: linkedInvoices,
      projectCount: isSelected ? linkedProjects.length : (summary?.projectCount || 0),
      invoiceCount: isSelected ? linkedInvoices.length : (summary?.invoiceCount || 0),
      invoiced: isSelected ? linkedInvoices.reduce((total, invoice) => total + num(invoice.amount), 0) : (summary?.invoiced || 0),
      paid: isSelected ? linkedInvoices.reduce((total, invoice) => total + getInvoicePaidAmount(invoice as any), 0) : (summary?.paid || 0),
    };
  };

  const openAdd = () => { setForm(EMPTY_FORM); setShowAdd(true); };
  const openEdit = (c: Client) => {
    setForm({
      name: c.name || "",
      businessName: c.businessName || "",
      phones: splitPhones(c.phone),
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
      premiumPriceListId: c.premiumPriceListId || null,
    });
    setEditingClient(c);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/clients/summary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await refetch();
      if (viewingClient?.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/clients", viewingClient.id, "activity"] });
      }
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const blank = (s: string) => (s.trim() === "" ? null : s.trim());

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const phoneStr = joinPhones(form.phones);
    createClient({ data: {
      name: form.name.trim(),
      businessName: blank(form.businessName),
      phone: blank(phoneStr),
      email: blank(form.email),
      address: blank(form.address),
      notes: blank(form.notes),
      ...(isOwner ? { premiumPriceListId: form.premiumPriceListId } : {}),
    } } as any);
  };

  const handleUpdate = () => {
    if (!form.name.trim() || !editingClient) return;
    const phoneStr = joinPhones(form.phones);
    updateClient({ id: editingClient.id, data: {
      name: form.name.trim(),
      businessName: blank(form.businessName),
      phone: blank(phoneStr),
      email: blank(form.email),
      address: blank(form.address),
      notes: blank(form.notes),
      ...(isOwner ? { premiumPriceListId: form.premiumPriceListId } : {}),
    } } as any);
  };

  const exportClientsXlsx = async () => {
    try {
      const response = await fetch("/api/clients/export", { credentials: "include" });
      if (!response.ok) throw new Error("Could not export clients");
      const exportClients = await response.json() as Client[];
      const rows = [
        ["Client ID", "Full Name", "Business Name", "Phones", "Email", "Address", "Notes", "Added"],
        ...exportClients.map(c => [clientCode(c), c.name, c.businessName || "", c.phone || "", c.email || "", c.address || "", c.notes || "", c.createdAt ? format(new Date(c.createdAt), "yyyy-MM-dd") : ""]),
      ];
      const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
      const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${[14, 28, 28, 24, 32, 38, 44, 18].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
      const zip = new JSZip();
      zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
      zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
      zip.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clients" sheetId="1" r:id="rId1"/></sheets></workbook>');
      zip.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
      zip.file("xl/worksheets/sheet1.xml", sheet);
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "clients.xlsx"; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not export clients");
    }
  };

  const filtered = clients;
  const withBusiness = clientPage?.stats.withBusiness || 0;
  const withEmail = clientPage?.stats.withEmail || 0;
  const withPhone = clientPage?.stats.withPhone || 0;

  const isSpinning = refreshing || isFetching;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Users size={22} className="text-admin-warning" />
            <h1 className="text-xl sm:text-2xl font-bold text-admin-ink">Clients</h1>
          </div>
          <p className="text-xs sm:text-sm text-admin-muted mt-0.5">Manage your client database</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isSpinning}
            aria-label="Refresh clients"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-admin-border text-sm text-admin-muted hover:bg-admin-surface transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={isSpinning ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportClientsXlsx} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-admin-border text-sm text-admin-muted hover:bg-admin-surface transition-colors">
            <Download size={13} /><span className="hidden sm:inline">Export Excel</span><span className="sm:hidden">Excel</span>
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold hover:bg-admin-muted transition-colors whitespace-nowrap">
            <Plus size={14} /> New Client
          </button>
        </div>
      </div>

      {clientsError && <div role="alert" className="mb-4 rounded-xl border border-admin-danger-line bg-admin-danger-soft p-4 text-sm text-admin-danger"><strong>Clients could not be loaded.</strong> {clientsLoadError instanceof Error ? clientsLoadError.message : 'Please retry.'} <button type="button" onClick={() => void refetch()} className="ml-2 font-bold underline">Retry</button></div>}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Clients", val: clientPage?.stats.total || 0 },
          { label: "With Business", val: withBusiness },
          { label: "With Email", val: withEmail },
          { label: "With Phone", val: withPhone },
        ].map(c => (
          <div key={c.label} className="bg-admin-surface border border-admin-border rounded-xl px-3 sm:px-5 py-3 sm:py-4 shadow-sm">
            <div className={`text-lg sm:text-2xl font-bold text-admin-brand-ink`}>{c.val}</div>
            <div className="text-xs sm:text-sm text-admin-muted mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-admin-surface border border-admin-border rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
          <Search size={15} className="text-admin-muted shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="flex-1 min-w-0 text-sm outline-none placeholder:text-admin-muted"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-admin-muted hover:text-admin-muted">
              <X size={14} />
            </button>
          )}
          <span className="text-[10px] sm:text-xs text-admin-muted shrink-0">{clientPage?.total || 0} found</span>
        </div>
      </div>

      {/* Client Cards Grid */}
      {clientsError ? null : filtered.length === 0 ? (
        <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm py-20 text-center">
          <Users size={40} className="mx-auto mb-3 text-admin-muted" />
          <p className="font-medium text-admin-muted">{search ? "No clients match your search" : "No clients yet"}</p>
          {!search && <p className="text-xs text-admin-muted mt-1">Click "New Client" to add your first client</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map(client => {
            const code = clientCode(client);
            const createdMs = client.createdAt ? new Date(client.createdAt).getTime() : 0;
            const updatedMs = client.updatedAt ? new Date(client.updatedAt).getTime() : 0;
            const wasEdited = updatedMs > 0 && createdMs > 0 && updatedMs - createdMs > 60_000;
            const dateLabel = wasEdited
              ? `Updated ${format(new Date(client.updatedAt!), "dd MMM yyyy")}`
              : client.createdAt ? format(new Date(client.createdAt), "dd MMM yyyy") : null;
            const phones = splitPhones(client.phone).filter(Boolean);

            const stats = statsFor(client);
            return (
              <div
                key={client.id}
                onClick={() => setViewingClient(client)}
                className="h-full min-h-[245px] bg-admin-surface border border-admin-border rounded-2xl shadow-sm hover:shadow-md hover:border-admin-border transition-all p-3 sm:p-5 flex flex-col gap-2 sm:gap-3 cursor-pointer"
              >
                {/* Top row: avatar + name + menu */}
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-admin-brand flex items-center justify-center shrink-0">
                      <UserCircle2 size={20} className="text-admin-muted sm:hidden" />
                      <UserCircle2 size={24} className="text-admin-muted hidden sm:block" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-admin-ink text-[13px] sm:text-sm leading-snug truncate">{client.name}</div>
                      <div className="text-[10px] sm:text-xs text-admin-muted font-medium mt-0.5">{client.premiumPriceListId ? `HS-P${String(client.id).padStart(6, "0")} · Premium` : code}</div>
                    </div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <CardMenu canDelete={isOwner} onEdit={() => openEdit(client)} onDelete={() => setDeleteConfirm(client)} />
                  </div>
                </div>

                {/* Consistent identity row keeps every card aligned */}
                <div className={`min-h-5 font-bold text-[13px] sm:text-[15px] leading-snug truncate ${client.businessName ? "text-admin-ink" : "text-admin-muted"}`}>
                  {client.businessName || "Individual customer"}
                </div>

                {/* Phones (one row per number) */}
                {phones.length > 0 && (
                  <div className="space-y-1">
                    {phones.map((ph, i) => (
                      <a
                        key={i}
                        href={`tel:${ph.replace(/\s+/g, "")}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 sm:gap-2 text-[12px] sm:text-sm text-admin-ink hover:text-admin-warning transition-colors"
                      >
                        <Phone size={12} className="text-admin-danger shrink-0" />
                        <span className="truncate">{ph}</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Address */}
                {client.address && (
                  <div className="flex items-start gap-1.5 sm:gap-2 text-[12px] sm:text-sm text-admin-muted leading-snug">
                    <MapPin size={12} className="text-admin-danger shrink-0 mt-0.5" />
                    <span className="line-clamp-3 whitespace-pre-line break-words">{client.address}</span>
                  </div>
                )}

                {/* Email (if no phone/address) */}
                {phones.length === 0 && !client.address && client.email && (
                  <div className="text-[12px] sm:text-sm text-admin-muted truncate">{client.email}</div>
                )}

                {/* Activity stats — projects · invoiced row, paid row right
                    below it (left-aligned with a green check icon), chevron
                    stays on the far right. Stacking the paid amount avoids
                    the mobile overflow we used to see on grid-cols-2 cards. */}
                {(stats.projectCount > 0 || stats.invoiceCount > 0) && (
                  <div className="pt-2 mt-auto border-t border-admin-border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] sm:text-xs">
                          {stats.projectCount > 0 && (
                            <div className="flex items-center gap-1 text-admin-muted font-semibold">
                              <Briefcase size={11} className="shrink-0" />
                              <span>{stats.projectCount} {stats.projectCount === 1 ? "project" : "projects"}</span>
                            </div>
                          )}
                          {stats.invoiceCount > 0 && (
                            <>
                              {stats.projectCount > 0 && <span className="text-admin-muted">·</span>}
                              <div className="flex items-center gap-1 text-admin-warning font-semibold min-w-0">
                                <Receipt size={11} className="shrink-0" />
                                <span className="truncate">{rs(stats.invoiced)}</span>
                              </div>
                            </>
                          )}
                        </div>
                        {stats.paid > 0 && (
                          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-admin-success font-semibold min-w-0">
                            <CheckCircle2 size={11} className="shrink-0" />
                            <span className="truncate">{rs(stats.paid)} paid</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={12} className="text-admin-muted shrink-0" />
                    </div>
                  </div>
                )}

                {/* Empty stats — keep the original simple footer */}
                {stats.projectCount === 0 && stats.invoiceCount === 0 && (
                  <div className="flex items-center justify-between gap-1 pt-2 mt-auto border-t border-admin-border">
                    <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-admin-muted min-w-0">
                      <FileText size={11} className="text-admin-muted shrink-0" />
                      <span className="truncate">No activity yet</span>
                    </div>
                    {dateLabel && (
                      <div className={`text-[10px] sm:text-xs shrink-0 truncate ${wasEdited ? "text-admin-warning font-semibold" : "text-admin-muted"}`}>{dateLabel}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(clientPage?.totalPages || 1) > 1 && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-admin-border bg-admin-surface px-4 py-3 shadow-sm">
          <button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border border-admin-border px-3 py-2 text-xs font-bold text-admin-muted disabled:opacity-40">Previous</button>
          <span className="text-xs font-semibold text-admin-muted">Page {clientPage?.page || page} of {clientPage?.totalPages || 1}</span>
          <button type="button" disabled={page >= (clientPage?.totalPages || 1) || isFetching} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-admin-border px-3 py-2 text-xs font-bold text-admin-muted disabled:opacity-40">Next</button>
        </div>
      )}

      {shippingClient && <ShippingDetailsModal client={shippingClient} onClose={() => setShippingClient(null)} />}

      {/* Viewing Modal — projects + invoices for a single client */}
      {viewingClient && (() => {
        const c = viewingClient;
        const code = clientCode(c);
        const premiumList = premiumPriceLists.find(list => list.id === c.premiumPriceListId);
        const stats = statsFor(c);
        const sortedProjects = [...stats.projects].sort((a, b) => {
          const ad = new Date(a.createdAt || 0).getTime();
          const bd = new Date(b.createdAt || 0).getTime();
          return bd - ad;
        });
        const sortedInvoices = [...stats.invoices].sort((a, b) => {
          const ad = new Date(a.createdAt || 0).getTime();
          const bd = new Date(b.createdAt || 0).getTime();
          return bd - ad;
        });
        return (
          <div className="fixed inset-0 bg-admin-inverse/70 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewingClient(null)}>
            <div
              className="bg-admin-surface w-full sm:max-w-2xl rounded-t-xl sm:rounded-sm shadow-xl max-h-[92dvh] sm:max-h-[85dvh] flex flex-col overflow-hidden border border-admin-border"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-admin-border sticky top-0 bg-admin-surface rounded-t-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-admin-brand flex items-center justify-center shrink-0">
                    <UserCircle2 size={22} className="text-admin-muted" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-admin-ink text-[15px] sm:text-base leading-snug truncate">{c.name}</div>
                    <div className="text-[11px] sm:text-xs text-admin-muted font-medium mt-0.5">{c.premiumPriceListId ? `HS-P${String(c.id).padStart(6, "0")}` : code}{c.businessName ? ` · ${c.businessName}` : ""}</div>
                    {c.premiumPriceListId && <div className="mt-1 text-xs font-semibold text-admin-brand-ink">Premium · {premiumList?.title || "Linked price list"}{premiumList?.active ? ` · ${premiumList.premiumItems.length} products` : ""}</div>}
                  </div>
                </div>
                <button onClick={() => setViewingClient(null)} aria-label="Close" className="text-admin-muted hover:text-admin-muted shrink-0 p-1 -mr-1">
                  <X size={20} />
                </button>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b border-admin-border bg-admin-surface/50">
                <div className="text-center">
                  <div className="text-lg sm:text-xl font-bold text-admin-muted">{stats.projectCount}</div>
                  <div className="text-[10px] sm:text-xs text-admin-muted mt-0.5">Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-admin-warning truncate">{rs(stats.invoiced)}</div>
                  <div className="text-[10px] sm:text-xs text-admin-muted mt-0.5">Invoiced</div>
                </div>
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-admin-success truncate">{rs(stats.paid)}</div>
                  <div className="text-[10px] sm:text-xs text-admin-muted mt-0.5">Paid</div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
                {activityLoading && !activityData && (
                  <div className="rounded-2xl border border-admin-warning-line bg-admin-warning-soft/60 px-4 py-3 text-xs font-semibold text-admin-warning">Loading client activity…</div>
                )}
                {/* Full customer profile */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-muted">
                      <UserCircle2 size={13} className="text-admin-muted" /> Customer Details
                    </div>
                    <button onClick={() => { setViewingClient(null); setShippingClient(c); }} className="flex items-center gap-1 rounded-lg bg-admin-brand-soft px-2.5 py-1.5 text-[11px] font-bold text-admin-brand-ink hover:bg-admin-brand-soft">
                      <PackageCheck size={12}/> Shipping Details
                    </button>
                  </div>
                  <div className="grid gap-2 rounded-2xl border border-admin-border bg-admin-surface/70 p-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-admin-surface p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Customer</div>
                      <div className="mt-1 text-sm font-bold text-admin-ink">{c.name}</div>
                      <div className="text-xs text-admin-muted">{c.businessName || "Individual customer"}</div>
                    </div>
                    <div className="rounded-xl bg-admin-surface p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Phone Numbers</div>
                      <div className="mt-1 space-y-1">{splitPhones(c.phone).filter(Boolean).map((phone,index)=><a key={index} href={`tel:${phone.replace(/\s+/g,"")}`} className="flex items-center gap-1.5 text-xs font-semibold text-admin-ink hover:text-admin-warning"><Phone size={12} className="text-admin-warning"/>{phone}</a>)}
                      {!c.phone&&<div className="text-xs text-admin-muted">Not added</div>}</div>
                    </div>
                    <div className="rounded-xl bg-admin-surface p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Email</div>
                      <div className="mt-1 flex items-start gap-1.5 break-all text-xs text-admin-ink"><Mail size={12} className="mt-0.5 shrink-0 text-admin-brand-ink"/>{c.email||"Not added"}</div>
                    </div>
                    <div className="rounded-xl bg-admin-surface p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Main Address</div>
                      <div className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-admin-ink"><MapPin size={12} className="mt-0.5 shrink-0 text-admin-danger"/><span className="whitespace-pre-line break-words">{c.address||"Not added"}</span></div>
                    </div>
                    {c.notes&&<div className="rounded-xl bg-admin-surface p-3 sm:col-span-2"><div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Notes</div><div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-admin-ink">{c.notes}</div></div>}
                  </div>
                </div>
                {isOwner && <div className="rounded-2xl border border-admin-brand-line bg-admin-brand-soft/60 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-admin-brand-ink"><ShieldCheck size={14}/> Identity Verification</div>
                      <div className="mt-1 text-xs text-admin-muted">Owner only · encrypted live selfie + ID front/back</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${verification?.status === "approved" ? "bg-admin-success-soft text-admin-success" : verification?.status === "submitted" ? "bg-admin-warning-soft text-admin-warning" : verification?.status === "rejected" ? "bg-admin-danger-soft text-admin-danger" : "bg-admin-surface text-admin-muted"}`}>{verification?.status || "not started"}</span>
                  </div>
                  {verificationError && <div className="mt-2 rounded-lg bg-admin-danger-soft px-3 py-2 text-xs font-semibold text-admin-danger">{verificationError}</div>}
                  {verificationUrl && <div className="mt-3 flex items-center gap-2">
                    <input readOnly value={verificationUrl} className="min-w-0 flex-1 rounded-lg border border-admin-brand-line bg-admin-surface px-3 py-2 text-[11px] text-admin-muted" />
                    <button onClick={() => void copyVerificationLink()} className="rounded-lg bg-admin-surface p-2 text-admin-brand-ink" title="Copy secure verification link"><Copy size={15}/></button>
                  </div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!["submitted","approved"].includes(verification?.status) && <button disabled={verificationBusy} onClick={() => void generateVerificationLink(c.id)} className="rounded-lg bg-admin-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{verificationBusy ? "Creating…" : verification?.status === "rejected" ? "Create new verification link" : "Generate secure link"}</button>}
                    {verification?.exists && <button onClick={() => setLocation(`/admin/client-verification/${c.id}`)} className="rounded-lg border border-admin-brand-line bg-admin-surface px-3 py-2 text-xs font-bold text-admin-brand-ink">Open A4 report / review</button>}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-admin-muted">The share token is shown only when generated. The customer link never exposes saved Client data.</p>
                </div>}
                {isOwner && <div className="rounded-2xl border border-admin-border bg-admin-surface/70 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-admin-ink"><FileSignature size={14}/> Client Agreements</div><div className="mt-1 text-xs text-admin-muted">Owner only · immutable agreement snapshot + secure online e-sign</div></div><button onClick={()=>setShowAgreementForm(v=>!v)} className="rounded-lg bg-admin-inverse px-3 py-2 text-xs font-bold text-white">{showAgreementForm?"Cancel":"New agreement"}</button></div>
                  {showAgreementForm&&<div className="mt-3 space-y-3 rounded-xl border bg-admin-surface p-3"><label className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Agreement template<select value={agreementTemplate} onChange={e=>applyAgreementTemplate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-xs normal-case">{agreementTemplates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label><div className="rounded-lg border border-admin-warning-line bg-admin-warning-soft px-3 py-2 text-xs font-bold text-admin-warning">Agreement issuer: {businessName || "Set the business name in General Settings"}</div><input value={agreementTitle} onChange={e=>setAgreementTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm font-bold" placeholder="Agreement title"/><textarea rows={14} value={agreementText} onChange={e=>setAgreementText(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-xs leading-5" placeholder="Agreement terms"/><div className="rounded-lg bg-admin-warning-soft p-2 text-[10px] leading-4 text-admin-warning">These are editable operational templates, not a substitute for legal advice. Review the final wording for your exact service. Once the secure signing link is created, that agreement snapshot is locked into its audit record.</div><button disabled={agreementBusy||agreementText.trim().length<20||!agreementTitle.trim()||!businessName} onClick={()=>void createAgreement(c.id)} className="rounded-lg bg-admin-warning-solid px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{agreementBusy?"Creating…":"Create secure signing link"}</button></div>}
                  {agreementUrl&&<div className="mt-3 flex gap-2"><input readOnly value={agreementUrl} className="min-w-0 flex-1 rounded-lg border bg-admin-surface px-3 py-2 text-[11px]"/><button onClick={()=>navigator.clipboard.writeText(agreementUrl).catch(()=>{})} className="rounded-lg border bg-admin-surface p-2"><Copy size={14}/></button></div>}
                  {agreements.length>0&&<div className="mt-3 space-y-2">{agreements.slice(0,5).map(a=><div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-admin-surface px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-bold">{a.title}</div><div className="text-[10px] uppercase text-admin-muted">{a.status} · {a.brand_name||businessName||"Business name not set"} · {new Date(a.created_at||a.createdAt).toLocaleDateString("en-LK")}</div></div><button onClick={()=>setLocation(`/admin/client-agreement/${a.id}`)} className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold">Audit / A4</button></div>)}</div>}
                  <p className="mt-2 text-[10px] leading-4 text-admin-muted">Signing records consent, the exact document SHA-256, signed time and encrypted audit evidence. Agreement identity and issuer come from General Settings.</p>
                </div>}
                                {/* Projects */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-admin-muted uppercase tracking-wide">
                      <Briefcase size={13} className="text-admin-muted" />
                      Projects ({sortedProjects.length})
                    </div>
                    {sortedProjects.length > 0 && (
                      <button
                        onClick={() => setLocation("/admin/crm-projects")}
                        className="text-[11px] text-admin-muted font-semibold hover:underline flex items-center gap-0.5"
                      >
                        View all <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                  {sortedProjects.length === 0 ? (
                    <div className="text-center py-6 text-xs text-admin-muted bg-admin-surface rounded-xl">No projects linked yet</div>
                  ) : (
                    <div className="space-y-1.5">
                      {sortedProjects.map(p => {
                        const due = p.dueDate ? new Date(p.dueDate) : null;
                        return (
                          <div key={p.id} className="flex items-center gap-2 sm:gap-3 px-3 py-2.5 bg-admin-surface hover:bg-admin-surface border border-admin-border rounded-xl transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-mono text-admin-muted shrink-0">{p.projectId}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${projectStatusStyle[p.status] || "bg-admin-subtle text-admin-muted"}`}>
                                  {p.status.replace("_", " ")}
                                </span>
                              </div>
                              <div className="text-[13px] font-semibold text-admin-ink truncate mt-0.5">{p.title}</div>
                              <div className="flex items-center gap-2 text-[11px] text-admin-muted mt-0.5 flex-wrap">
                                <span className="font-medium text-admin-warning">{rs(num(p.totalValue))}</span>
                                {num(p.amountPaid) > 0 && <span className="text-admin-success">· {rs(num(p.amountPaid))} paid</span>}
                                {due && <span>· due {format(due, "dd MMM")}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => { setViewingClient(null); setLocation(`/admin/crm-projects?edit=${p.id}`); }}
                              aria-label={`Open project ${p.projectId}`}
                              className="shrink-0 w-8 h-8 rounded-lg bg-admin-surface border border-admin-border hover:bg-admin-subtle hover:border-admin-border text-admin-muted flex items-center justify-center transition-colors"
                            >
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Invoices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-admin-muted uppercase tracking-wide">
                      <Receipt size={13} className="text-admin-warning" />
                      Invoices ({sortedInvoices.length})
                    </div>
                    {sortedInvoices.length > 0 && (
                      <button
                        onClick={() => setLocation("/admin/invoices")}
                        className="text-[11px] text-admin-warning font-semibold hover:underline flex items-center gap-0.5"
                      >
                        View all <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                  {sortedInvoices.length === 0 ? (
                    <div className="text-center py-6 text-xs text-admin-muted bg-admin-surface rounded-xl">No invoices linked yet</div>
                  ) : (
                    <div className="space-y-1.5">
                      {sortedInvoices.map(inv => {
                        const due = inv.dueDate ? new Date(inv.dueDate) : null;
                        const created = inv.createdAt ? new Date(inv.createdAt) : null;
                        return (
                          <div key={inv.id} className="flex items-center gap-2 sm:gap-3 px-3 py-2.5 bg-admin-surface hover:bg-admin-warning-soft border border-admin-border rounded-xl transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="admin-record-id text-[11px] font-mono truncate">{inv.invoiceNumber}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${invoiceStatusStyle[inv.status] || "bg-admin-subtle text-admin-muted"}`}>
                                  {inv.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[12px] text-admin-ink mt-0.5 flex-wrap">
                                <span className="font-bold text-admin-warning">{rs(num(inv.amount))}</span>
                                {due && <span className="text-[11px] text-admin-muted">· due {format(due, "dd MMM")}</span>}
                                {!due && created && <span className="text-[11px] text-admin-muted">· {format(created, "dd MMM yyyy")}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => { setViewingClient(null); setLocation(`/admin/invoices?edit=${inv.id}`); }}
                              aria-label={`Open invoice ${inv.invoiceNumber}`}
                              className="shrink-0 w-8 h-8 rounded-lg bg-admin-surface border border-admin-border hover:bg-admin-warning-soft hover:border-admin-warning-line text-admin-warning flex items-center justify-center transition-colors"
                            >
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex gap-2 px-4 sm:px-5 py-3 border-t border-admin-border bg-admin-surface">
                <button onClick={() => { setViewingClient(null); setShippingClient(c); }} className="flex-1 px-3 py-2.5 rounded-xl border border-admin-brand-line bg-admin-brand-soft text-admin-brand-ink text-xs sm:text-sm font-semibold hover:bg-admin-brand-soft transition-colors flex items-center justify-center gap-1.5">
                  <PackageCheck size={13}/> Shipping
                </button>
                <button
                  onClick={() => { const cc = c; setViewingClient(null); openEdit(cc); }}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-admin-subtle text-admin-ink text-xs sm:text-sm font-semibold hover:bg-admin-subtle transition-colors flex items-center justify-center gap-1.5"
                >
                  <Pencil size={13} /> Edit Client
                </button>
                <button
                  onClick={() => setViewingClient(null)}
                  className="px-4 py-2.5 rounded-xl bg-admin-brand text-white text-sm font-semibold hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Modal */}
      {showAdd && (
        <ClientFormModal
          title="Add New Client"
          form={form}
          setForm={setForm}
          onSubmit={handleCreate}
          onClose={() => { setShowAdd(false); setForm(EMPTY_FORM); }}
          isSaving={isCreating}
          priceLists={premiumPriceLists}
          isOwner={isOwner}
        />
      )}

      {/* Edit Modal */}
      {editingClient && (
        <ClientFormModal
          title="Edit Client"
          form={form}
          setForm={setForm}
          onSubmit={handleUpdate}
          onClose={() => { setEditingClient(null); setForm(EMPTY_FORM); }}
          isSaving={isUpdating}
          priceLists={premiumPriceLists}
          isOwner={isOwner}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Client"
        message={deleteConfirm ? `Are you sure you want to permanently delete ${deleteConfirm.name} (${clientCode(deleteConfirm)})?` : ""}
        confirmLabel="Delete Client"
        onConfirm={() => { if (deleteConfirm) deleteClient({ id: deleteConfirm.id }); }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
