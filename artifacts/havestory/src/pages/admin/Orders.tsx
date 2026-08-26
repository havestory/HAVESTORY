import { FormEvent, ReactNode, useMemo, useState } from 'react';
import {
  useCreateClient,
  useCreateInvoice,
  useCreateOrder,
  useDeleteOrder,
  useListClients,
  useListInvoices,
  useListOrders,
  useUpdateOrder,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AdminTableError, AdminTableLoading } from '@/components/admin/AdminPageState';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  AlertTriangle,
  BadgeDollarSign,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Link2,
  MessageCircle,
  PackageOpen,
  Printer,
  Search,
  ShieldCheck,
  Truck,
  Trash2,
  UploadCloud,
  UserRound,
  UserRoundPlus,
  X,
} from 'lucide-react';

type InvoiceMode = 'none' | 'link' | 'create';
type OrderRecord = Record<string, any>;

type CreateForm = {
  clientId: number | null;
  isNewClient: boolean;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  productName: string;
  price: string;
  quantity: string;
  orderType: string;
  priority: string;
  dueDate: string;
  notes: string;
  invoiceMode: InvoiceMode;
  invoiceId: string;
};

type ManageForm = {
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  productName: string;
  projectNotes: string;
  adminNotes: string;
  deliveryMethod: string;
  courierName: string;
  courierTrackingNumber: string;
  estimatedCompletion: string;
  dueDate: string;
  approvalPaymentType: 'advance' | 'full' | 'custom';
  approvalPaymentAmount: string;
};

const EMPTY_CREATE_FORM: CreateForm = {
  clientId: null,
  isNewClient: false,
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  productName: '',
  price: '',
  quantity: '1',
  orderType: 'standard',
  priority: 'normal',
  dueDate: '',
  notes: '',
  invoiceMode: 'none',
  invoiceId: '',
};

const EMPTY_MANAGE_FORM: ManageForm = {
  status: 'pending',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  productName: '',
  projectNotes: '',
  adminNotes: '',
  deliveryMethod: '',
  courierName: '',
  courierTrackingNumber: '',
  estimatedCompletion: '',
  dueDate: '',
  approvalPaymentType: 'advance',
  approvalPaymentAmount: '',
};

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled', 'reviewing', 'submitted'];

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusClass(value: string) {
  switch (value.toLowerCase()) {
    case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'processing': return 'bg-violet-50 text-violet-600 border-violet-100';
    case 'confirmed': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'ready': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
    case 'shipped': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
    case 'reviewing': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'submitted': return 'bg-sky-50 text-sky-600 border-sky-100';
    default: return 'bg-amber-50 text-amber-600 border-amber-100';
  }
}

function money(value: unknown) {
  const amount = Number.parseFloat(String(value ?? '0').replace(/[^0-9.-]/g, '')) || 0;
  return `Rs. ${amount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function orderItem(order: OrderRecord) {
  const item = Array.isArray(order.items) ? order.items[0] : null;
  return item || {};
}

type DesignPreview = {
  id: string;
  type: 'design-preview';
  name: string;
  previewUrl: string;
  driveUrl: string;
  downloadEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  createdAt?: string;
};

function designPreviewsFor(order: OrderRecord | null): DesignPreview[] {
  if (!order) return [];
  if (Array.isArray(order.designPreviews)) return order.designPreviews as DesignPreview[];
  return (Array.isArray(order.designLinks) ? order.designLinks : [])
    .filter((entry: any) => entry && typeof entry === 'object' && entry.type === 'design-preview') as DesignPreview[];
}

function SectionCard({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(40,20,80,0.04)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[15px] font-bold text-slate-800">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-5 py-5">{children}</div>}
    </section>
  );
}

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceMenuOpen, setInvoiceMenuOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [manageOrder, setManageOrder] = useState<OrderRecord | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageForm, setManageForm] = useState<ManageForm>(EMPTY_MANAGE_FORM);
  const [sections, setSections] = useState({ status: true, customer: true, project: true, files: true, payment: true, delivery: true });
  const [paymentReviewLoading, setPaymentReviewLoading] = useState<'approve' | 'reject' | null>(null);

  const { data: orders, isLoading, isError, refetch } = useListOrders(
    statusFilter !== 'all' ? { status: statusFilter } : {},
    { query: { staleTime: 15_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false } as any },
  );
  const { data: clients = [], isLoading: clientsLoading } = useListClients({
    query: { enabled: createOpen, staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false } as any,
  });
  const { data: invoices = [], isLoading: invoicesLoading } = useListInvoices({
    query: { enabled: createOpen, staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false } as any,
  });
  const createOrder = useCreateOrder();
  const createClient = useCreateClient();
  const createInvoice = useCreateInvoice();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const { toast } = useToast();

  const visibleOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return orders || [];
    return (orders || []).filter((order) => [order.orderId, order.customerName, order.customerPhone, order.customerEmail]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [orders, searchTerm]);

  const stats = useMemo(() => ({
    total: orders?.length || 0,
    pending: orders?.filter((order) => ['pending', 'submitted', 'reviewing'].includes(String(order.status).toLowerCase())).length || 0,
    processing: orders?.filter((order) => ['processing', 'confirmed', 'ready'].includes(String(order.status).toLowerCase())).length || 0,
    completed: orders?.filter((order) => ['completed', 'delivered'].includes(String(order.status).toLowerCase())).length || 0,
  }), [orders]);

  const selectedClient = clients.find((client) => client.id === createForm.clientId);
  const selectedInvoice = invoices.find((invoice) => String(invoice.id) === createForm.invoiceId);
  const quantity = Math.max(1, Number.parseInt(createForm.quantity, 10) || 1);
  const orderTotal = Math.max(0, Number.parseFloat(createForm.price) || 0) * quantity;

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    return clients.filter((client) => !query || [client.name, client.businessName, client.email, client.phone]
      .some((value) => String(value || '').toLowerCase().includes(query))).slice(0, 7);
  }, [clients, clientSearch]);

  const availableInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    return invoices.filter((invoice) => !invoice.orderId && (!query || [invoice.invoiceNumber, invoice.clientName, invoice.clientPhone]
      .some((value) => String(value || '').toLowerCase().includes(query)))).slice(0, 7);
  }, [invoices, invoiceSearch]);

  const resetCreateForm = () => {
    setCreateForm({ ...EMPTY_CREATE_FORM });
    setClientSearch('');
    setInvoiceSearch('');
    setCustomerMenuOpen(false);
    setInvoiceMenuOpen(false);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const openManage = (order: OrderRecord) => {
    const item = orderItem(order);
    const submittedAmount = Number(order.paymentSubmittedAmount ?? order.paymentAmount ?? 0) || 0;
    const submittedType = ['advance', 'full', 'custom'].includes(String(order.paymentType))
      ? String(order.paymentType) as ManageForm['approvalPaymentType']
      : 'advance';
    setManageOrder(order);
    setManageForm({
      status: order.status || 'pending',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      customerEmail: order.customerEmail || '',
      customerAddress: order.customerAddress || '',
      productName: order.orderDescription || item.productName || item.name || '',
      projectNotes: item.notes || order.orderDescription || '',
      adminNotes: order.adminNotes || '',
      deliveryMethod: order.deliveryMethod || '',
      courierName: order.courierName || '',
      courierTrackingNumber: order.courierTrackingNumber || '',
      estimatedCompletion: order.estimatedCompletion || '',
      dueDate: order.dueDate || '',
      approvalPaymentType: submittedType,
      approvalPaymentAmount: submittedAmount > 0 ? String(submittedAmount) : String(orderTotalForRow(order) || ''),
    });
    setSections({ status: true, customer: true, project: true, files: true, payment: true, delivery: true });
    setManageOpen(true);
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateOrder.mutate({ id: String(orderId), data: { status: newStatus } as any }, {
      onSuccess: () => {
        toast({ title: 'Order updated', description: `Status changed to ${statusLabel(newStatus)}.` });
        void refetch();
      },
      onError: () => toast({ title: 'Update failed', description: 'Could not update this order.', variant: 'destructive' }),
    });
  };

  const handleDelete = (orderId: number) => {
    if (!confirm('Are you sure you want to delete this order? This cannot be undone.')) return;
    deleteOrder.mutate({ id: String(orderId) }, {
      onSuccess: () => { toast({ title: 'Order deleted' }); void refetch(); },
      onError: () => toast({ title: 'Delete failed', description: 'Could not delete this order.', variant: 'destructive' }),
    });
  };

  const finishOrderCreation = (createdOrder: OrderRecord) => {
    const close = () => {
      setCreateOpen(false);
      resetCreateForm();
      void refetch();
    };
    const saveNewClient = () => {
      if (!createForm.isNewClient) {
        close();
        return;
      }
      createClient.mutate({ data: {
        name: createForm.customerName.trim(),
        phone: createForm.customerPhone.trim() || null,
        email: createForm.customerEmail.trim() || null,
        address: createForm.customerAddress.trim() || null,
        approved: true,
      } }, {
        onSuccess: () => toast({ title: 'Client saved', description: 'The new client was added to your CRM.' }),
        onError: () => toast({ title: 'Client not saved', description: 'The order was created, but the client profile could not be saved.', variant: 'destructive' }),
        onSettled: close,
      });
    };

    if (createForm.invoiceMode === 'create') {
      createInvoice.mutate({ data: {
        clientName: createForm.customerName.trim(),
        clientId: createForm.clientId,
        clientPhone: createForm.customerPhone.trim() || null,
        clientEmail: createForm.customerEmail.trim() || null,
        orderId: createdOrder.orderId,
        amount: orderTotal.toFixed(2),
        status: 'pending',
        dueDate: createForm.dueDate || null,
        notes: createForm.notes.trim() || null,
      } }, {
        onSuccess: (invoice) => toast({ title: 'Order and invoice created', description: `${invoice.invoiceNumber} is linked to ${createdOrder.orderId}.` }),
        onError: () => toast({ title: 'Invoice not created', description: 'The order was saved, but the new invoice could not be created.', variant: 'destructive' }),
        onSettled: saveNewClient,
      });
    } else {
      toast({ title: 'Order created', description: `${createdOrder.orderId} is now available in All Orders.` });
      saveNewClient();
    }
  };

  const handleCreateOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customerName = createForm.customerName.trim();
    const customerPhone = createForm.customerPhone.trim();
    const productName = createForm.productName.trim();
    if (!customerName || !customerPhone || !productName || quantity < 1) {
      toast({ title: 'Missing order details', description: 'Select a customer, add a print type, and enter a valid quantity.', variant: 'destructive' });
      return;
    }
    if (createForm.invoiceMode === 'link' && !createForm.invoiceId) {
      toast({ title: 'Select an invoice', description: 'Choose an available invoice before linking it to this order.', variant: 'destructive' });
      return;
    }

    createOrder.mutate({ data: {
      customerName,
      customerPhone,
      customerEmail: createForm.customerEmail.trim() || null,
      customerAddress: createForm.customerAddress.trim() || '',
      orderType: createForm.orderType,
      items: [{ productId: null, productName, quantity, notes: createForm.notes.trim() || null, price: createForm.price || '0' } as any],
      designLinks: [],
      attachments: [],
      notes: createForm.notes.trim() || null,
      dueDate: createForm.dueDate || null,
      startDate: null,
      priority: createForm.priority,
      discountAmount: 0,
      advancePaid: 0,
      tags: [],
      autoInvoice: false,
      linkInvoiceId: createForm.invoiceMode === 'link' ? Number(createForm.invoiceId) : undefined,
    } as any }, {
      onSuccess: finishOrderCreation,
      onError: (error) => toast({ title: 'Order creation failed', description: error instanceof Error ? error.message : 'The server could not create this order.', variant: 'destructive' }),
    });
  };

  const saveManageOrder = () => {
    if (!manageOrder) return;
    updateOrder.mutate({ id: String(manageOrder.id), data: {
      status: manageForm.status,
      customerName: manageForm.customerName.trim(),
      customerPhone: manageForm.customerPhone.trim(),
      customerEmail: manageForm.customerEmail.trim() || null,
      customerAddress: manageForm.customerAddress.trim() || null,
      orderDescription: manageForm.productName.trim() || null,
      adminNotes: manageForm.adminNotes.trim() || null,
      deliveryMethod: manageForm.deliveryMethod || null,
      courierName: manageForm.courierName.trim() || null,
      courierTrackingNumber: manageForm.courierTrackingNumber.trim() || null,
      estimatedCompletion: manageForm.estimatedCompletion || null,
      dueDate: manageForm.dueDate || null,
    } as any }, {
      onSuccess: () => {
        toast({ title: 'Changes saved', description: `${manageOrder.orderId} was updated successfully.` });
        setManageOpen(false);
        void refetch();
      },
      onError: () => toast({ title: 'Save failed', description: 'Could not save the order changes.', variant: 'destructive' }),
    });
  };

  const setDeliveryStatus = (nextStatus: 'shipped' | 'delivered') => {
    if (!manageOrder) return;
    updateOrder.mutate({ id: String(manageOrder.id), data: {
      status: nextStatus,
      statusNote: nextStatus === 'delivered'
        ? 'Order delivered to the customer.'
        : 'Order handed over for delivery.',
      deliveryMethod: manageForm.deliveryMethod || null,
      courierName: manageForm.courierName.trim() || null,
      courierTrackingNumber: manageForm.courierTrackingNumber.trim() || null,
    } as any }, {
      onSuccess: (updatedOrder) => {
        setManageForm((form) => ({ ...form, status: nextStatus }));
        setManageOrder((current) => current ? { ...current, ...(updatedOrder as any), status: nextStatus } : current);
        toast({
          title: nextStatus === 'delivered' ? 'Order marked as delivered' : 'Order marked as shipped',
          description: 'The customer tracking timeline is now updated.',
        });
        void refetch();
      },
      onError: () => toast({ title: 'Status update failed', description: 'Could not update the delivery status.', variant: 'destructive' }),
    });
  };

  const copyTrackLink = async () => {
    if (!manageOrder) return;
    const link = `${window.location.origin}/track-order?id=${encodeURIComponent(manageOrder.orderId)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Tracking link copied' });
    } catch {
      toast({ title: 'Copy failed', description: link, variant: 'destructive' });
    }
  };

  const uploadProofFile = async (file: File | undefined) => {
    if (!file || !manageOrder) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/orders/${manageOrder.id}/proof-file`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      toast({ title: 'File uploaded', description: 'The proof/design file is now attached to this order.' });
      const latest = await fetch(`/api/orders/${manageOrder.id}`).then((res) => res.ok ? res.json() : null);
      if (latest) setManageOrder(latest);
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload this file.', variant: 'destructive' });
    }
  };

  const uploadDesignPreview = async (file: File | undefined) => {
    if (!file || !manageOrder) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`/api/orders/${manageOrder.id}/design-preview`, { method: 'POST', body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Upload failed');
      setManageOrder(payload?.order || manageOrder);
      toast({ title: 'Preview uploaded', description: 'A watermarked customer preview was added to this order.' });
    } catch (error) {
      toast({ title: 'Preview upload failed', description: error instanceof Error ? error.message : 'Could not upload this preview.', variant: 'destructive' });
    }
  };

  const patchDesignPreview = (id: string, patch: Partial<DesignPreview>) => {
    setManageOrder((current) => {
      if (!current) return current;
      const previews = designPreviewsFor(current).map((preview) => preview.id === id ? { ...preview, ...patch } : preview);
      return { ...current, designPreviews: previews };
    });
  };

  const removeDesignPreview = (id: string) => {
    setManageOrder((current) => {
      if (!current) return current;
      return { ...current, designPreviews: designPreviewsFor(current).filter((preview) => preview.id !== id) };
    });
  };

  const saveDesignPreviews = () => {
    if (!manageOrder) return;
    const previews = designPreviewsFor(manageOrder).map((preview) => ({
      ...preview,
      name: preview.name.trim() || 'Design preview',
      driveUrl: preview.driveUrl.trim(),
      watermarkText: preview.watermarkText.trim() || 'HAVESTORY',
      watermarkOpacity: Math.min(0.6, Math.max(0.05, Number(preview.watermarkOpacity) || 0.18)),
    }));
    const legacyLinks = (Array.isArray(manageOrder.designLinks) ? manageOrder.designLinks : [])
      .filter((entry: any) => !(entry && typeof entry === 'object' && entry.type === 'design-preview'));
    updateOrder.mutate({ id: String(manageOrder.id), data: { designLinks: [...legacyLinks, ...previews] } as any }, {
      onSuccess: (updated: any) => {
        setManageOrder(updated && typeof updated === 'object' ? updated : (current) => current ? { ...current, designPreviews: previews, designLinks: [...legacyLinks, ...previews] } : current);
        toast({ title: 'Preview settings saved', description: 'Customer visibility, watermark, and Drive access were updated.' });
      },
      onError: () => toast({ title: 'Preview settings failed', description: 'Could not save the customer preview settings.', variant: 'destructive' }),
    });
  };

  const reviewPayment = async (action: 'approve' | 'reject') => {
    if (!manageOrder) return;
    const reason = action === 'reject' ? window.prompt('Reason for rejecting this payment proof:', 'Please upload a clearer payment slip.') : '';
    if (action === 'reject' && reason === null) return;
    setPaymentReviewLoading(action);
    try {
      const response = await fetch(`/api/orders/${manageOrder.id}/payment-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: reason || undefined,
          paymentType: action === 'approve' ? manageForm.approvalPaymentType : undefined,
          approvedAmount: action === 'approve' ? Number(manageForm.approvalPaymentAmount) : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Payment review failed');
      setManageOrder((current) => current ? { ...current, ...payload } : payload);
      if (action === 'approve') {
        updateOrder.mutate({ id: String(manageOrder.id), data: { status: 'processing' } as any }, {
          onSuccess: () => {
            setManageOrder((current) => current ? { ...current, status: 'processing' } : current);
            void refetch();
          },
        });
      } else {
        void refetch();
      }
      toast({ title: action === 'approve' ? 'Payment approved' : 'Payment proof rejected', description: action === 'approve' ? 'The order is now marked for processing.' : 'The customer can upload a new proof.' });
    } catch (error) {
      toast({ title: 'Payment review failed', description: error instanceof Error ? error.message : 'Could not update payment review.', variant: 'destructive' });
    } finally {
      setPaymentReviewLoading(null);
    }
  };

  const isCreating = createOrder.isPending || createInvoice.isPending || createClient.isPending;

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">All Orders</h1>
          <p className="mt-1 text-sm text-slate-400">{stats.total} orders total</p>
        </div>
        <Button type="button" onClick={openCreate} className="h-11 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-6 font-bold text-white shadow-[0_10px_24px_rgba(184,49,214,0.22)] hover:from-pink-600 hover:to-violet-700">
          <span className="mr-2 text-lg">+</span> New Order
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[['total', stats.total, 'Total Orders', 'text-pink-500'], ['pending', stats.pending, 'Pending', 'text-amber-500'], ['processing', stats.processing, 'Processing', 'text-violet-500'], ['completed', stats.completed, 'Completed', 'text-emerald-500']].map(([key, value, label, color]) => (
          <button type="button" key={String(key)} onClick={() => setStatusFilter(key === 'total' ? 'all' : key === 'processing' ? 'processing' : key === 'completed' ? 'completed' : 'pending')} className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-[0_8px_22px_rgba(40,20,80,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(40,20,80,0.08)]">
            <div className={`text-3xl font-bold ${color}`}>{String(value)}</div>
            <div className="mt-1 text-sm text-slate-400">{String(label)}</div>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_12px_35px_rgba(40,20,80,0.05)]">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search orders..." className="h-11 rounded-full border-slate-200 bg-slate-50 pl-11 shadow-none focus-visible:ring-violet-200" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'].map((status) => (
                <button type="button" key={status} onClick={() => setStatusFilter(status)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === status ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                  {status === 'all' ? 'All' : statusLabel(status)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader className="bg-slate-50/70">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  {['Order', 'Date', 'Customer', 'Product', 'Total', 'Status', 'Actions'].map((heading, index) => <TableHead key={heading} className={`${index === 6 ? 'text-right' : ''} px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400`}>{heading}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <AdminTableLoading columns={7} /> : isError ? <AdminTableError columns={7} onRetry={() => void refetch()} /> : visibleOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-slate-400">No orders found.</p></TableCell></TableRow>
                ) : visibleOrders.map((order) => {
                  const item = orderItem(order);
                  const total = Number(orderTotalForRow(order));
                  return <TableRow key={order.id} className="border-slate-100 transition hover:bg-violet-50/20">
                    <TableCell className="px-6 py-5"><div className="font-bold text-slate-800">#{order.id}</div><div className="mt-1 font-mono text-[11px] font-semibold text-pink-500">{order.orderId}</div></TableCell>
                    <TableCell className="px-6 py-5 text-sm text-slate-500">{safeDate(order.createdAt)}</TableCell>
                    <TableCell className="px-6 py-5"><div className="font-semibold text-slate-800">{order.customerName || 'Unknown customer'}</div><div className="mt-1 text-xs text-slate-400">{order.customerPhone || 'No phone'}</div></TableCell>
                    <TableCell className="max-w-[190px] truncate px-6 py-5 text-sm text-slate-500">{item.productName || item.name || (order as any).orderDescription || '—'}</TableCell>
                    <TableCell className="px-6 py-5 font-bold text-slate-900">{money(total)}</TableCell>
                    <TableCell className="px-6 py-5"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>{statusLabel(order.status || 'pending')}</span></TableCell>
                    <TableCell className="px-6 py-5"><div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="icon" title="Create shipping label" onClick={() => window.open(`/admin/shipping-labels?orderId=${encodeURIComponent(order.orderId)}`, '_blank', 'noopener,noreferrer')} className="h-9 w-9 rounded-full border-violet-100 text-violet-600 hover:bg-violet-50"><Printer className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="icon" title="WhatsApp customer" onClick={() => window.open(`https://wa.me/${String(order.customerPhone || '').replace(/[^0-9]/g, '')}`, '_blank')} className="h-9 w-9 rounded-full border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"><MessageCircle className="h-4 w-4" /></Button>
                      <Button type="button" onClick={() => openManage(order)} className="h-9 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-4 text-xs font-bold text-white hover:from-pink-600 hover:to-violet-700">Manage</Button>
                      <Button type="button" variant="outline" size="icon" title="Delete order" onClick={() => handleDelete(order.id)} className="h-9 w-9 rounded-full border-rose-100 text-rose-400 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="max-w-[570px] overflow-hidden rounded-[26px] border-0 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left">
            <DialogTitle className="text-lg font-bold text-slate-900">New Order</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">Create a manual order</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="max-h-[78vh] overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="relative space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Customer <span className="text-pink-500">*</span></Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={selectedClient ? selectedClient.name : clientSearch} onFocus={() => setCustomerMenuOpen(true)} onChange={(event) => { setCreateForm((form) => ({ ...form, clientId: null, isNewClient: true, customerName: event.target.value })); setClientSearch(event.target.value); setCustomerMenuOpen(true); }} placeholder="Search by name, phone, email, business, or PB-code..." className="h-11 rounded-full border-pink-100 bg-white pl-10 text-sm shadow-[0_4px_12px_rgba(220,40,150,0.08)] focus-visible:ring-pink-200" />
                  {selectedClient && <button type="button" onClick={() => { setCreateForm((form) => ({ ...form, clientId: null, isNewClient: true, customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' })); setClientSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
                </div>
                {selectedClient && <div className="mt-2 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Saved client selected</span><span>{selectedClient.phone || selectedClient.email || 'Profile'}</span></div>}
                {customerMenuOpen && !selectedClient && <div className="absolute left-0 right-0 top-[68px] z-20 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                  <div className="px-4 py-3 text-[11px] italic text-slate-400">{clientsLoading ? 'Loading saved clients…' : `Type to search name, phone, email, business, or PB-code · ${clients.length} saved`}</div>
                  <div className="max-h-52 overflow-y-auto">{filteredClients.map((client) => <button type="button" key={client.id} onClick={() => { setCreateForm((form) => ({ ...form, clientId: client.id, isNewClient: false, customerName: client.name, customerPhone: client.phone || '', customerEmail: client.email || '', customerAddress: client.address || '' })); setClientSearch(''); setCustomerMenuOpen(false); }} className="flex w-full items-center justify-between border-t border-slate-50 px-4 py-3 text-left hover:bg-violet-50"><span><span className="block text-sm font-semibold text-slate-700">{client.name}</span><span className="block text-xs text-slate-400">{client.phone || client.email || client.businessName || 'Saved client'}</span></span><UserRound className="h-4 w-4 text-violet-400" /></button>)}{!clientsLoading && filteredClients.length === 0 && <div className="px-4 py-3 text-sm text-slate-400">No matching saved clients.</div>}</div>
                  <button type="button" onClick={() => { setCreateForm((form) => ({ ...form, clientId: null, isNewClient: true, customerName: clientSearch || form.customerName })); setCustomerMenuOpen(false); }} className="flex w-full items-center gap-2 border-t border-pink-50 bg-gradient-to-r from-pink-50 to-violet-50 px-4 py-3 text-left text-sm font-bold text-violet-700 hover:from-pink-100 hover:to-violet-100"><UserRoundPlus className="h-4 w-4" /> + Add a new client</button>
                </div>}
              </div>

              {createForm.isNewClient && <div className="grid grid-cols-1 gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Full name</Label><Input value={createForm.customerName} onChange={(event) => setCreateForm((form) => ({ ...form, customerName: event.target.value }))} placeholder="Customer name" className="h-10 rounded-xl border-white bg-white" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Phone</Label><Input value={createForm.customerPhone} onChange={(event) => setCreateForm((form) => ({ ...form, customerPhone: event.target.value }))} placeholder="07X XXX XXXX" className="h-10 rounded-xl border-white bg-white" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</Label><Input type="email" value={createForm.customerEmail} onChange={(event) => setCreateForm((form) => ({ ...form, customerEmail: event.target.value }))} placeholder="customer@example.com" className="h-10 rounded-xl border-white bg-white" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Address</Label><Input value={createForm.customerAddress} onChange={(event) => setCreateForm((form) => ({ ...form, customerAddress: event.target.value }))} placeholder="Optional address" className="h-10 rounded-xl border-white bg-white" /></div>
              </div>}

              <div className="grid grid-cols-[1fr_0.7fr] gap-3"><div className="space-y-2"><Label className="text-xs text-slate-400">Product / print type <span className="text-pink-500">*</span></Label><Input value={createForm.productName} onChange={(event) => setCreateForm((form) => ({ ...form, productName: event.target.value }))} placeholder="e.g. Event Banners, Business Cards..." className="h-11 rounded-full border-slate-200" /></div><div className="space-y-2"><Label className="text-xs text-slate-400">Price (Rs.)</Label><Input type="number" min="0" step="1" value={createForm.price} onChange={(event) => setCreateForm((form) => ({ ...form, price: event.target.value }))} placeholder="0" className="h-11 rounded-full border-slate-200" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label className="text-xs text-slate-400">Quantity</Label><Input type="number" min="1" step="1" value={createForm.quantity} onChange={(event) => setCreateForm((form) => ({ ...form, quantity: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div><div className="flex items-end justify-end pb-2 text-sm font-bold text-slate-600">Order total: <span className="ml-1 text-violet-600">{money(orderTotal)}</span></div></div>

              <div className="space-y-3"><Label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><FileText className="h-3.5 w-3.5" /> Invoice</Label>
                {[['none', 'No invoice yet', 'Create the order on its own. You can attach an invoice later from Invoices.'], ['link', 'Link to an existing invoice', 'Search by invoice number, client name, phone, or amount.'], ['create', 'Create a new invoice now', 'Build an invoice record and automatically link it to this order.']].map(([mode, title, description]) => <button type="button" key={mode} onClick={() => setCreateForm((form) => ({ ...form, invoiceMode: mode as InvoiceMode }))} className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${createForm.invoiceMode === mode ? 'border-pink-300 bg-pink-50/50 shadow-[0_4px_14px_rgba(236,72,153,0.08)]' : 'border-slate-200 hover:border-violet-200 hover:bg-violet-50/30'}`}><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${createForm.invoiceMode === mode ? 'border-pink-500 bg-pink-500' : 'border-slate-400'}`}>{createForm.invoiceMode === mode && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span><span><span className="block text-sm font-semibold text-slate-700">{title}</span><span className="mt-0.5 block text-xs leading-4 text-slate-400">{description}</span></span></button>)}
                {createForm.invoiceMode === 'link' && <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={selectedInvoice ? `${selectedInvoice.invoiceNumber} · ${selectedInvoice.clientName}` : invoiceSearch} onFocus={() => setInvoiceMenuOpen(true)} onChange={(event) => { setCreateForm((form) => ({ ...form, invoiceId: '' })); setInvoiceSearch(event.target.value); setInvoiceMenuOpen(true); }} placeholder="Search by invoice number, client, phone, or amount..." className="h-11 rounded-full border-violet-100 pl-10" />{invoiceMenuOpen && !selectedInvoice && <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl"><div className="max-h-48 overflow-y-auto">{invoicesLoading ? <div className="p-4 text-sm text-slate-400">Loading invoices…</div> : availableInvoices.map((invoice) => <button type="button" key={invoice.id} onClick={() => { setCreateForm((form) => ({ ...form, invoiceId: String(invoice.id) })); setInvoiceSearch(''); setInvoiceMenuOpen(false); }} className="flex w-full items-center justify-between border-b border-slate-50 px-4 py-3 text-left hover:bg-violet-50"><span><span className="block text-sm font-semibold text-slate-700">{invoice.invoiceNumber}</span><span className="block text-xs text-slate-400">{invoice.clientName} · {money(invoice.amount)}</span></span><Link2 className="h-4 w-4 text-violet-400" /></button>)}{!invoicesLoading && availableInvoices.length === 0 && <div className="p-4 text-sm text-slate-400">No unlinked invoices found.</div>}</div></div>}</div>}
                {selectedInvoice && <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700"><span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> {selectedInvoice.invoiceNumber} · {money(selectedInvoice.amount)}</span><button type="button" onClick={() => setCreateForm((form) => ({ ...form, invoiceId: '' }))}><X className="h-3.5 w-3.5" /></button></div>}
              </div>

              <div className="space-y-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Notes</Label><Textarea value={createForm.notes} onChange={(event) => setCreateForm((form) => ({ ...form, notes: event.target.value }))} placeholder="Internal notes..." rows={3} className="resize-none rounded-2xl border-slate-200" /></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label className="text-xs text-slate-400">Order type</Label><select value={createForm.orderType} onChange={(event) => setCreateForm((form) => ({ ...form, orderType: event.target.value }))} className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700"><option value="standard">Standard</option><option value="custom">Custom</option><option value="bulk">Bulk</option></select></div><div className="space-y-2"><Label className="text-xs text-slate-400">Due date</Label><Input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((form) => ({ ...form, dueDate: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div></div>
            </div>
            <DialogFooter className="mt-6 gap-3 border-t border-slate-100 pt-5 sm:justify-end"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating} className="h-11 rounded-full border-slate-200 px-8 text-slate-600">Cancel</Button><Button type="submit" disabled={isCreating} className="h-11 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-8 font-bold text-white hover:from-pink-600 hover:to-violet-700">{isCreating ? 'Creating…' : 'Create Order'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-[700px] overflow-hidden rounded-[28px] border-0 bg-slate-50 p-0 shadow-2xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4 text-left"><div className="flex items-center justify-between gap-3"><div><DialogTitle className="text-lg font-bold text-slate-900">Manage Order</DialogTitle><DialogDescription className="sr-only">Edit order details and project status</DialogDescription></div><div className="flex items-center gap-2"><span className="rounded-full border border-pink-100 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-600">{manageOrder?.orderId}</span><button type="button" onClick={() => setManageOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void copyTrackLink()} className="h-8 rounded-full border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-600"><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Track Link</Button><Button type="button" variant="outline" onClick={() => manageOrder && window.open(`${window.location.origin}/track-order?id=${encodeURIComponent(manageOrder.orderId)}`, '_blank')} className="h-8 rounded-full border-emerald-100 bg-emerald-50 px-3 text-xs font-semibold text-emerald-600"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Track Order</Button><Button type="button" variant="outline" onClick={() => manageOrder && window.open(`/admin/shipping-labels?orderId=${encodeURIComponent(manageOrder.orderId)}`, '_blank', 'noopener,noreferrer')} className="h-8 rounded-full border-violet-100 bg-violet-50 px-3 text-xs font-semibold text-violet-700"><Printer className="mr-1.5 h-3.5 w-3.5" /> Shipping Label</Button></div></DialogHeader>
          {manageOrder && <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4 sm:p-6">
            <SectionCard title="Project Status" icon={Clipboard} open={sections.status} onToggle={() => setSections((value) => ({ ...value, status: !value.status }))}><div className="flex flex-wrap gap-2">{STATUS_OPTIONS.map((status) => <button type="button" key={status} onClick={() => setManageForm((form) => ({ ...form, status }))} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${manageForm.status === status ? `bg-gradient-to-r from-pink-500 to-violet-600 text-white ${statusClass(status).split(' ')[2] || ''}` : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600'}`}>{statusLabel(status)}</button>)}</div></SectionCard>

            <SectionCard title="Customer Details" icon={UserRound} open={sections.customer} onToggle={() => setSections((value) => ({ ...value, customer: !value.customer }))}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Full name</Label><Input value={manageForm.customerName} onChange={(event) => setManageForm((form) => ({ ...form, customerName: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Phone</Label><Input value={manageForm.customerPhone} onChange={(event) => setManageForm((form) => ({ ...form, customerPhone: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</Label><Input type="email" value={manageForm.customerEmail} onChange={(event) => setManageForm((form) => ({ ...form, customerEmail: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Address</Label><Input value={manageForm.customerAddress} onChange={(event) => setManageForm((form) => ({ ...form, customerAddress: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div></div></SectionCard>

            <SectionCard title="Project Details" icon={PackageOpen} open={sections.project} onToggle={() => setSections((value) => ({ ...value, project: !value.project }))}><div className="space-y-4"><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Product / print type</Label><Input value={manageForm.productName} onChange={(event) => setManageForm((form) => ({ ...form, productName: event.target.value }))} placeholder="e.g. Event Banners, Business Cards..." className="h-11 rounded-full border-slate-200" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Project notes / specs</Label><Textarea value={manageForm.projectNotes} onChange={(event) => setManageForm((form) => ({ ...form, projectNotes: event.target.value }))} placeholder="No notes from customer" rows={4} className="resize-none rounded-2xl border-slate-200" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Internal notes</Label><Textarea value={manageForm.adminNotes} onChange={(event) => setManageForm((form) => ({ ...form, adminNotes: event.target.value }))} placeholder="Private production notes..." rows={3} className="resize-none rounded-2xl border-slate-200" /></div></div></SectionCard>

            <SectionCard title="Design / Reference Files" icon={FolderOpen} open={sections.files} onToggle={() => setSections((value) => ({ ...value, files: !value.files }))}>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Customer-uploaded files</div>
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400"><FolderOpen className="mx-auto mb-2 h-6 w-6 text-slate-300" />{Array.isArray(manageOrder.attachments) && manageOrder.attachments.length > 0 ? `${manageOrder.attachments.length} file(s) attached` : 'No files uploaded by customer yet'}</div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Admin proof / design file</div>
                  <label htmlFor="order-proof-upload" className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-5 text-sm font-semibold text-violet-600 transition hover:bg-violet-50"><UploadCloud className="h-5 w-5" /> {manageOrder.proofFileName || 'Upload Proof / Design File'}</label>
                  <input id="order-proof-upload" type="file" className="sr-only" onChange={(event) => void uploadProofFile(event.target.files?.[0])} />
                </div>
                <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-pink-50/60 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-violet-600"><Eye className="h-3.5 w-3.5" /> Customer design preview</div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Upload a sample image for the customer to view from the tracking link. The preview stays watermarked and download access remains locked until you enable it and payment is approved.</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 shrink-0 text-violet-400" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label htmlFor="order-design-preview-upload" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-200 bg-white/80 px-4 py-3 text-sm font-bold text-violet-700 transition hover:border-violet-300 hover:bg-white"><UploadCloud className="h-4 w-4" /> Upload preview image</label>
                    <input id="order-design-preview-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void uploadDesignPreview(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                    <Button type="button" variant="outline" onClick={saveDesignPreviews} disabled={updateOrder.isPending} className="h-12 rounded-2xl border-violet-200 bg-white px-5 text-xs font-bold text-violet-700 hover:bg-violet-50"><Check className="mr-2 h-4 w-4" /> {updateOrder.isPending ? 'Saving…' : 'Save preview settings'}</Button>
                  </div>
                  {designPreviewsFor(manageOrder).length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-violet-100 bg-white/70 px-4 py-6 text-center text-xs text-slate-400">No customer preview uploaded yet.</div> : <div className="mt-4 space-y-3">
                    {designPreviewsFor(manageOrder).map((preview) => <div key={preview.id} className="rounded-2xl border border-white bg-white/90 p-3 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          <img src={preview.previewUrl} alt={preview.name} className="h-full w-full object-cover" />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-black tracking-[0.22em] text-white" style={{ opacity: preview.watermarkOpacity }}>{preview.watermarkText}</span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-slate-800">{preview.name}</p><button type="button" onClick={() => removeDesignPreview(preview.id)} className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${preview.name}`}><Trash2 className="h-4 w-4" /></button></div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Watermark text</Label><Input value={preview.watermarkText} onChange={(event) => patchDesignPreview(preview.id, { watermarkText: event.target.value })} className="h-10 rounded-xl border-slate-200 text-sm" /></div>
                            <div className="space-y-1.5"><Label className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400"><span>Watermark opacity</span><span>{Math.round(preview.watermarkOpacity * 100)}%</span></Label><input type="range" min="0.05" max="0.6" step="0.01" value={preview.watermarkOpacity} onChange={(event) => patchDesignPreview(preview.id, { watermarkOpacity: Number(event.target.value) })} className="mt-3 w-full accent-violet-600" /></div>
                          </div>
                          <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Google Drive download link</Label><Input value={preview.driveUrl} onChange={(event) => patchDesignPreview(preview.id, { driveUrl: event.target.value })} placeholder="https://drive.google.com/file/d/..." className="h-10 rounded-xl border-slate-200 text-sm" /></div>
                          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-800"><input type="checkbox" checked={preview.downloadEnabled} onChange={(event) => patchDesignPreview(preview.id, { downloadEnabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-emerald-600" /><span><span className="block font-bold">Enable customer download after payment</span><span className="mt-0.5 block text-[11px] leading-4 text-emerald-700/80">The button appears only after the Drive link is saved and the payment status becomes paid.</span></span></label>
                        </div>
                      </div>
                    </div>)}
                  </div>}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Payment Proof & Approval" icon={CreditCard} open={sections.payment} onToggle={() => setSections((value) => ({ ...value, payment: !value.payment }))}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Method</div><div className="mt-1 text-sm font-bold text-slate-700">{String(manageOrder.paymentMethod || '—').replace('_', ' ')}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment</div><div className="mt-1 text-sm font-bold text-slate-700">{String(manageOrder.paymentStatus || 'pending').replace('_', ' ')}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Proof</div><div className="mt-1 text-sm font-bold text-slate-700">{String(manageOrder.paymentProofStatus || 'not uploaded').replace('_', ' ')}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Amount</div><div className="mt-1 text-sm font-bold text-slate-700">{money(manageOrder.paymentAmount || orderTotalForRow(manageOrder))}</div></div>
                </div>
                {manageOrder.paymentProofUrl && manageOrder.paymentProofStatus !== 'approved' && (
                  <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/60 to-fuchsia-50/50 p-4 shadow-sm">
                    <div className="mb-3"><p className="text-sm font-bold text-slate-800">Confirm received payment</p><p className="mt-1 text-xs leading-5 text-slate-500">Choose what this proof represents and verify the exact amount before approving.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment type</Label><select value={manageForm.approvalPaymentType} onChange={(event) => setManageForm((form) => ({ ...form, approvalPaymentType: event.target.value as ManageForm['approvalPaymentType'], ...(event.target.value === 'full' ? { approvalPaymentAmount: String(orderTotalForRow(manageOrder)) } : {}) }))} className="h-11 w-full rounded-xl border border-white bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"><option value="advance">Advance payment</option><option value="full">Full payment</option><option value="custom">Custom amount</option></select></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Approved amount (Rs.)</Label><Input type="number" min="0.01" step="0.01" value={manageForm.approvalPaymentAmount} onChange={(event) => setManageForm((form) => ({ ...form, approvalPaymentAmount: event.target.value }))} className="h-11 rounded-xl border-white bg-white/90 text-sm font-semibold shadow-sm" placeholder="Enter exact amount" /></div>
                    </div>
                  </div>
                )}
                {manageOrder.paymentProofUrl ? <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><a href={manageOrder.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-violet-700 hover:underline"><ExternalLink className="h-4 w-4" /> View customer payment proof</a>{manageOrder.paymentProofExpiresAt && <div className="mt-1 text-xs text-violet-500">Proof retention ends {safeDate(manageOrder.paymentProofExpiresAt)}.</div>}</div><div className="flex gap-2"><Button type="button" onClick={() => void reviewPayment('reject')} disabled={paymentReviewLoading !== null} variant="outline" className="h-9 rounded-full border-rose-200 px-4 text-xs font-bold text-rose-600">{paymentReviewLoading === 'reject' ? 'Rejecting…' : 'Reject'}</Button><Button type="button" onClick={() => void reviewPayment('approve')} disabled={paymentReviewLoading !== null} className="h-9 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700">{paymentReviewLoading === 'approve' ? 'Approving…' : 'Approve & Process'}</Button></div></div> : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400"><CreditCard className="mx-auto mb-2 h-6 w-6 text-slate-300" />No customer payment proof yet. The customer must upload a slip from the tracking link.</div>}
              </div>
            </SectionCard>

            <SectionCard title="Delivery & Timeline" icon={Truck} open={sections.delivery} onToggle={() => setSections((value) => ({ ...value, delivery: !value.delivery }))}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Delivery method</Label><select value={manageForm.deliveryMethod} onChange={(event) => setManageForm((form) => ({ ...form, deliveryMethod: event.target.value }))} className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700"><option value="">Not selected</option><option value="pickup">Pickup</option><option value="courier">Courier</option><option value="sl_post">Sri Lanka Post</option></select></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Due date</Label><Input type="date" value={manageForm.dueDate} onChange={(event) => setManageForm((form) => ({ ...form, dueDate: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Courier name</Label><Input value={manageForm.courierName} onChange={(event) => setManageForm((form) => ({ ...form, courierName: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tracking number</Label><Input value={manageForm.courierTrackingNumber} onChange={(event) => setManageForm((form) => ({ ...form, courierTrackingNumber: event.target.value }))} className="h-11 rounded-full border-slate-200" /></div>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/80 p-4">
                  <p className="text-sm font-bold text-slate-800">Update customer delivery tracking</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Save the courier details above and publish the latest delivery state to the customer's Track Order timeline.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => setDeliveryStatus('shipped')} disabled={updateOrder.isPending || manageForm.status === 'shipped'} className="h-11 rounded-xl border-indigo-200 bg-white font-bold text-indigo-700 hover:bg-indigo-50"><Truck className="mr-2 h-4 w-4" /> {manageForm.status === 'shipped' ? 'Marked as Shipped' : 'Mark as Shipped'}</Button>
                    <Button type="button" onClick={() => setDeliveryStatus('delivered')} disabled={updateOrder.isPending || manageForm.status === 'delivered'} className="h-11 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"><Check className="mr-2 h-4 w-4" /> {manageForm.status === 'delivered' ? 'Marked as Delivered' : 'Mark as Delivered'}</Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>}
          <DialogFooter className="sticky bottom-0 z-10 gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:justify-end"><Button type="button" variant="outline" onClick={() => setManageOpen(false)} disabled={updateOrder.isPending} className="h-11 rounded-full border-slate-200 px-8 text-slate-600">Cancel</Button><Button type="button" onClick={saveManageOrder} disabled={updateOrder.isPending || !manageOrder} className="h-11 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-8 font-bold text-white hover:from-pink-600 hover:to-violet-700">{updateOrder.isPending ? 'Saving…' : 'Save Changes'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function safeDate(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'MMM d, yyyy');
}

function orderTotalForRow(order: OrderRecord) {
  const item = orderItem(order);
  const itemTotal = Array.isArray(order.items) ? order.items.reduce((sum: number, current: any) => sum + (Number(current.price ?? current.unitPrice ?? 0) || 0) * (Number(current.quantity ?? 1) || 1), 0) : 0;
  if (itemTotal > 0) return itemTotal;
  return Number(order.totalAmount ?? order.amount ?? 0) || 0;
}
