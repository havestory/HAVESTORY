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
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  manualPaymentReason: string;
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
  manualPaymentReason: '',
};

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'completed', 'cancelled', 'reviewing', 'submitted'];

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusClass(value: string) {
  switch (value.toLowerCase()) {
    case 'completed': return 'bg-admin-success-soft text-admin-success border-admin-success-line';
    case 'processing': return 'bg-admin-brand-soft text-admin-brand-ink border-admin-brand-line';
    case 'confirmed': return 'bg-admin-brand-soft text-admin-brand-ink border-admin-brand-line';
    case 'ready': return 'bg-admin-brand-soft text-admin-brand-ink border-admin-brand-line';
    case 'shipped': return 'bg-admin-brand-soft text-admin-brand-ink border-admin-brand-line';
    case 'delivered': return 'bg-admin-success-soft text-admin-success border-admin-success-line';
    case 'cancelled': return 'bg-admin-danger-soft text-admin-danger border-admin-danger-line';
    case 'reviewing': return 'bg-admin-warning-soft text-admin-warning border-admin-warning-line';
    case 'submitted': return 'bg-admin-brand-soft text-admin-brand-ink border-admin-brand-line';
    default: return 'bg-admin-warning-soft text-admin-warning border-admin-warning-line';
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
    <section className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface shadow-[0_8px_24px_rgba(40,20,80,0.04)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-admin-surface">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-admin-brand-soft text-admin-brand-ink">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[15px] font-bold text-admin-ink">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-admin-muted" /> : <ChevronDown className="h-4 w-4 text-admin-muted" />}
      </button>
      {open && <div className="border-t border-admin-border px-5 py-5">{children}</div>}
    </section>
  );
}

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceMenuOpen, setInvoiceMenuOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);
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
  const orderPageSize = 40;
  const orderTotalPages = Math.max(1, Math.ceil(visibleOrders.length / orderPageSize));
  const pagedOrders = visibleOrders.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);

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
    setCreateError("");
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
      manualPaymentReason: '',
    });
    setSections({ status: true, customer: false, project: false, files: false, payment: false, delivery: false });
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

  const handleDelete = () => {
    if (!deleteTarget || deleteOrder.isPending) return;
    deleteOrder.mutate({ id: String(deleteTarget.id) }, {
      onSuccess: () => { toast({ title: 'Order deleted' }); setDeleteTarget(null); void refetch(); },
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
    if (createOrder.isPending || createInvoice.isPending || createClient.isPending) return;
    setCreateError("");
    const customerName = createForm.customerName.trim();
    const customerPhone = createForm.customerPhone.trim();
    const productName = createForm.productName.trim();
    if (!customerName || !customerPhone || !productName || quantity < 1) {
      setCreateError('Select a customer with a phone number, add a product, and enter a valid quantity.');
      toast({ title: 'Missing order details', description: 'Select a customer, add a print type, and enter a valid quantity.', variant: 'destructive' });
      return;
    }
    if (createForm.invoiceMode === 'link' && !createForm.invoiceId) {
      setCreateError('Select an available invoice before creating the order.');
      toast({ title: 'Select an invoice', description: 'Choose an available invoice before linking it to this order.', variant: 'destructive' });
      return;
    }

    createOrder.mutate({ data: {
      customerName,
      customerPhone,
      customerEmail: createForm.customerEmail.trim() || null,
      customerAddress: createForm.customerAddress.trim() || '',
      orderType: createForm.orderType,
      items: [{ productId: null, productName, quantity, notes: createForm.notes.trim() || null, unitPrice: Math.max(0, Number(createForm.price) || 0) } as any],
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
      onError: (error) => {
        const message = error instanceof Error ? error.message : 'The server could not create this order.';
        setCreateError(message);
        toast({ title: 'Order creation failed', description: message, variant: 'destructive' });
      },
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
      estimatedCompletion: manageForm.estimatedCompletion || null,
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
    if (action === 'approve' && !manageOrder.paymentProofUrl && manageForm.manualPaymentReason.trim().length < 8) { toast({ title: 'Verification reason required', description: 'Enter how you confirmed payment before marking this order paid.', variant: 'destructive' }); return; }
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
          manual: action === 'approve' && !manageOrder.paymentProofUrl,
          manualReason: action === 'approve' && !manageOrder.paymentProofUrl ? manageForm.manualPaymentReason.trim() : undefined,
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
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-admin-ink">All Orders</h1>
          <p className="mt-1 text-sm text-admin-muted">{stats.total} orders total</p>
        </div>
        <Button type="button" onClick={openCreate} className="h-11 rounded-sm bg-primary px-6 font-bold text-primary-foreground hover:bg-admin-muted">
          <span className="mr-2 text-lg">+</span> New Order
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[['total', stats.total, 'Total Orders', 'text-admin-brand-ink'], ['pending', stats.pending, 'Pending', 'text-admin-warning'], ['processing', stats.processing, 'Processing', 'text-admin-brand-ink'], ['completed', stats.completed, 'Completed', 'text-admin-success']].map(([key, value, label, color]) => (
          <button type="button" key={String(key)} onClick={() => { setStatusFilter(key === 'total' ? 'all' : key === 'processing' ? 'processing' : key === 'completed' ? 'completed' : 'pending'); setOrderPage(1); }} className="rounded-sm border border-admin-border bg-admin-surface p-5 text-left transition-colors hover:bg-admin-brand-soft">
            <div className={`text-3xl font-bold ${color}`}>{String(value)}</div>
            <div className="mt-1 text-sm text-admin-muted">{String(label)}</div>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden rounded-sm border border-admin-border bg-admin-surface">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-admin-border p-5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
              <Input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setOrderPage(1); }} placeholder="Search orders..." className="h-11 rounded-full border-admin-border bg-admin-surface pl-11 shadow-none focus-visible:ring-admin-brand" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'].map((status) => (
                <button type="button" key={status} onClick={() => { setStatusFilter(status); setOrderPage(1); }} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === status ? 'bg-primary text-primary-foreground' : 'text-admin-muted hover:bg-admin-surface'}`}>
                  {status === 'all' ? 'All' : statusLabel(status)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader className="bg-admin-surface/70">
                <TableRow className="border-admin-border hover:bg-transparent">
                  {['Order', 'Date', 'Customer', 'Product', 'Total', 'Status', 'Actions'].map((heading, index) => <TableHead key={heading} className={`${index === 6 ? 'text-right' : ''} px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-admin-muted`}>{heading}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <AdminTableLoading columns={7} /> : isError ? <AdminTableError columns={7} onRetry={() => void refetch()} /> : visibleOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-admin-muted" /><p className="text-admin-muted">No orders found.</p></TableCell></TableRow>
                ) : pagedOrders.map((order) => {
                  const item = orderItem(order);
                  const total = Number(orderTotalForRow(order));
                  return <TableRow key={order.id} className="border-admin-border transition hover:bg-admin-brand-soft/20">
                    <TableCell className="px-6 py-5"><div className="font-bold text-admin-ink">#{order.id}</div><div className="mt-1 font-mono text-[11px] font-semibold text-admin-brand-ink">{order.orderId}</div></TableCell>
                    <TableCell className="px-6 py-5 text-sm text-admin-muted">{safeDate(order.createdAt)}</TableCell>
                    <TableCell className="px-6 py-5"><div className="font-semibold text-admin-ink">{order.customerName || 'Unknown customer'}</div><div className="mt-1 text-xs text-admin-muted">{order.customerPhone || 'No phone'}</div></TableCell>
                    <TableCell className="max-w-[190px] truncate px-6 py-5 text-sm text-admin-muted">{item.productName || item.name || (order as any).orderDescription || '—'}</TableCell>
                    <TableCell className="px-6 py-5 font-bold text-admin-ink">{money(total)}</TableCell>
                    <TableCell className="px-6 py-5"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>{statusLabel(order.status || 'pending')}</span></TableCell>
                    <TableCell className="px-6 py-5"><div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="icon" title="Create shipping label" onClick={() => window.open(`/admin/shipping-labels?orderId=${encodeURIComponent(order.orderId)}`, '_blank', 'noopener,noreferrer')} className="h-9 w-9 rounded-full border-admin-brand-line text-admin-brand-ink hover:bg-admin-brand-soft"><Printer className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="icon" title="WhatsApp customer" onClick={() => window.open(`https://wa.me/${String(order.customerPhone || '').replace(/[^0-9]/g, '')}`, '_blank')} className="h-9 w-9 rounded-full border-admin-border text-admin-muted hover:bg-admin-success-soft hover:text-admin-success"><MessageCircle className="h-4 w-4" /></Button>
                      <Button type="button" onClick={() => openManage(order)} className="h-9 rounded-sm bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-admin-muted">Manage</Button>
                      <Button type="button" variant="outline" size="icon" title="Delete order" onClick={() => setDeleteTarget(order)} className="h-9 w-9 rounded-full border-admin-danger-line text-admin-danger hover:bg-admin-danger-soft"><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
          {orderTotalPages > 1 && <div className="flex items-center justify-center gap-3 border-t border-admin-border px-5 py-4"><Button type="button" variant="outline" size="sm" disabled={orderPage <= 1} onClick={() => setOrderPage(value => Math.max(1, value - 1))} className="rounded-full">Previous</Button><span className="text-xs font-semibold text-admin-muted">Page {orderPage} of {orderTotalPages} · {visibleOrders.length} orders</span><Button type="button" variant="outline" size="sm" disabled={orderPage >= orderTotalPages} onClick={() => setOrderPage(value => Math.min(orderTotalPages, value + 1))} className="rounded-full">Next</Button></div>}
        </CardContent>
      </Card>

      <ConfirmDialog open={!!deleteTarget} title="Delete Order" message={deleteTarget ? `Delete ${deleteTarget.orderId} for ${deleteTarget.customerName}? Its linked invoice will also be removed from the active list.` : ''} confirmLabel={deleteOrder.isPending ? 'Deleting…' : 'Delete Order'} onConfirm={handleDelete} onCancel={() => { if (!deleteOrder.isPending) setDeleteTarget(null); }} />

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="max-w-[570px] overflow-hidden rounded-[26px] border-0 bg-admin-surface p-0 shadow-2xl">
          <DialogHeader className="border-b border-admin-border px-6 py-5 text-left">
            <DialogTitle className="text-lg font-bold text-admin-ink">New Order</DialogTitle>
            <DialogDescription className="text-xs text-admin-muted">Create a manual order</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="max-h-[78vh] overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="relative space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Customer <span className="text-admin-brand-ink">*</span></Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
                  <Input value={selectedClient ? selectedClient.name : clientSearch} onClick={() => setCustomerMenuOpen(true)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'Enter') { event.preventDefault(); setCustomerMenuOpen(true); } }} onChange={(event) => { setCreateForm((form) => ({ ...form, clientId: null, isNewClient: true, customerName: event.target.value })); setClientSearch(event.target.value); setCustomerMenuOpen(true); }} placeholder="Search by name, phone, email, business, or PB-code..." className="h-11 rounded-full border-admin-brand-line bg-admin-surface pl-10 text-sm focus-visible:ring-admin-brand" />
                  {selectedClient && <button type="button" onClick={() => { setCreateForm((form) => ({ ...form, clientId: null, isNewClient: true, customerName: '', customerPhone: '', customerEmail: '', customerAddress: '' })); setClientSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-admin-muted hover:bg-admin-subtle"><X className="h-4 w-4" /></button>}
                </div>
                {selectedClient && <div className="mt-2 flex items-center justify-between rounded-xl bg-admin-brand-soft px-3 py-2 text-xs text-admin-brand-ink"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Saved client selected</span><span>{selectedClient.phone || selectedClient.email || 'Profile'}</span></div>}
                {customerMenuOpen && !selectedClient && <div className="absolute left-0 right-0 top-[68px] z-20 overflow-hidden rounded-2xl border border-admin-border bg-admin-surface shadow-xl">
                  <div className="px-4 py-3 text-[11px] italic text-admin-muted">{clientsLoading ? 'Loading saved clients…' : `Type to search name, phone, email, business, or PB-code · ${clients.length} saved`}</div>
                  <div className="max-h-52 overflow-y-auto">{filteredClients.map((client) => <button type="button" key={client.id} onClick={() => { setCreateForm((form) => ({ ...form, clientId: client.id, isNewClient: false, customerName: client.name, customerPhone: client.phone || '', customerEmail: client.email || '', customerAddress: client.address || '' })); setClientSearch(''); setCustomerMenuOpen(false); }} className="flex w-full items-center justify-between border-t border-admin-border px-4 py-3 text-left hover:bg-admin-brand-soft"><span><span className="block text-sm font-semibold text-admin-ink">{client.name}</span><span className="block text-xs text-admin-muted">{client.phone || client.email || client.businessName || 'Saved client'}</span></span><UserRound className="h-4 w-4 text-admin-brand-ink" /></button>)}{!clientsLoading && filteredClients.length === 0 && <div className="px-4 py-3 text-sm text-admin-muted">No matching saved clients.</div>}</div>
                  <button type="button" onClick={() => { setCreateForm((form) => ({ ...form, clientId: null, isNewClient: true, customerName: clientSearch || form.customerName })); setCustomerMenuOpen(false); }} className="flex w-full items-center gap-2 border-t border-admin-brand-line bg-admin-brand px-4 py-3 text-left text-sm font-bold text-white hover:opacity-90"><UserRoundPlus className="h-4 w-4" /> + Add a new client</button>
                </div>}
              </div>

              {createForm.isNewClient && <div className="grid grid-cols-1 gap-3 rounded-2xl border border-admin-brand-line bg-admin-brand-soft/40 p-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Full name</Label><Input value={createForm.customerName} onChange={(event) => setCreateForm((form) => ({ ...form, customerName: event.target.value }))} placeholder="Customer name" className="h-10 rounded-xl border-white bg-admin-surface" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Phone</Label><Input value={createForm.customerPhone} onChange={(event) => setCreateForm((form) => ({ ...form, customerPhone: event.target.value }))} placeholder="07X XXX XXXX" className="h-10 rounded-xl border-white bg-admin-surface" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Email</Label><Input type="email" value={createForm.customerEmail} onChange={(event) => setCreateForm((form) => ({ ...form, customerEmail: event.target.value }))} placeholder="customer@example.com" className="h-10 rounded-xl border-white bg-admin-surface" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Address</Label><Input value={createForm.customerAddress} onChange={(event) => setCreateForm((form) => ({ ...form, customerAddress: event.target.value }))} placeholder="Optional address" className="h-10 rounded-xl border-white bg-admin-surface" /></div>
              </div>}

              <div className="grid grid-cols-[1fr_0.7fr] gap-3"><div className="space-y-2"><Label className="text-xs text-admin-muted">Product / print type <span className="text-admin-brand-ink">*</span></Label><Input value={createForm.productName} onChange={(event) => setCreateForm((form) => ({ ...form, productName: event.target.value }))} placeholder="e.g. Event Banners, Business Cards..." className="h-11 rounded-full border-admin-border" /></div><div className="space-y-2"><Label className="text-xs text-admin-muted">Price (Rs.)</Label><Input type="number" min="0" step="1" value={createForm.price} onChange={(event) => setCreateForm((form) => ({ ...form, price: event.target.value }))} placeholder="0" className="h-11 rounded-full border-admin-border" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label className="text-xs text-admin-muted">Quantity</Label><Input type="number" min="1" step="1" value={createForm.quantity} onChange={(event) => setCreateForm((form) => ({ ...form, quantity: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div><div className="flex items-end justify-end pb-2 text-sm font-bold text-admin-muted">Order total: <span className="ml-1 text-admin-brand-ink">{money(orderTotal)}</span></div></div>

              <div className="space-y-3"><Label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-admin-muted"><FileText className="h-3.5 w-3.5" /> Invoice</Label>
                {[['none', 'No invoice yet', 'Create the order on its own. You can attach an invoice later from Invoices.'], ['link', 'Link to an existing invoice', 'Search by invoice number, client name, phone, or amount.'], ['create', 'Create a new invoice now', 'Build an invoice record and automatically link it to this order.']].map(([mode, title, description]) => <button type="button" key={mode} onClick={() => setCreateForm((form) => ({ ...form, invoiceMode: mode as InvoiceMode }))} className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${createForm.invoiceMode === mode ? 'border-admin-brand-line bg-admin-brand-soft/50 shadow-[0_4px_14px_rgba(236,72,153,0.08)]' : 'border-admin-border hover:border-admin-brand-line hover:bg-admin-brand-soft/30'}`}><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${createForm.invoiceMode === mode ? 'border-admin-brand-line bg-admin-brand' : 'border-admin-border'}`}>{createForm.invoiceMode === mode && <span className="h-1.5 w-1.5 rounded-full bg-admin-surface" />}</span><span><span className="block text-sm font-semibold text-admin-ink">{title}</span><span className="mt-0.5 block text-xs leading-4 text-admin-muted">{description}</span></span></button>)}
                {createForm.invoiceMode === 'link' && <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" /><Input value={selectedInvoice ? `${selectedInvoice.invoiceNumber} · ${selectedInvoice.clientName}` : invoiceSearch} onFocus={() => setInvoiceMenuOpen(true)} onChange={(event) => { setCreateForm((form) => ({ ...form, invoiceId: '' })); setInvoiceSearch(event.target.value); setInvoiceMenuOpen(true); }} placeholder="Search by invoice number, client, phone, or amount..." className="h-11 rounded-full border-admin-brand-line pl-10" />{invoiceMenuOpen && !selectedInvoice && <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-2xl border border-admin-border bg-admin-surface shadow-xl"><div className="max-h-48 overflow-y-auto">{invoicesLoading ? <div className="p-4 text-sm text-admin-muted">Loading invoices…</div> : availableInvoices.map((invoice) => <button type="button" key={invoice.id} onClick={() => { setCreateForm((form) => ({ ...form, invoiceId: String(invoice.id) })); setInvoiceSearch(''); setInvoiceMenuOpen(false); }} className="flex w-full items-center justify-between border-b border-admin-border px-4 py-3 text-left hover:bg-admin-brand-soft"><span><span className="block text-sm font-semibold text-admin-ink">{invoice.invoiceNumber}</span><span className="block text-xs text-admin-muted">{invoice.clientName} · {money(invoice.amount)}</span></span><Link2 className="h-4 w-4 text-admin-brand-ink" /></button>)}{!invoicesLoading && availableInvoices.length === 0 && <div className="p-4 text-sm text-admin-muted">No unlinked invoices found.</div>}</div></div>}</div>}
                {selectedInvoice && <div className="flex items-center justify-between rounded-xl bg-admin-brand-soft px-3 py-2 text-xs text-admin-brand-ink"><span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> {selectedInvoice.invoiceNumber} · {money(selectedInvoice.amount)}</span><button type="button" onClick={() => setCreateForm((form) => ({ ...form, invoiceId: '' }))}><X className="h-3.5 w-3.5" /></button></div>}
              </div>

              <div className="space-y-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Notes</Label><Textarea value={createForm.notes} onChange={(event) => setCreateForm((form) => ({ ...form, notes: event.target.value }))} placeholder="Internal notes..." rows={3} className="resize-none rounded-2xl border-admin-border" /></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label className="text-xs text-admin-muted">Order type</Label><select value={createForm.orderType} onChange={(event) => setCreateForm((form) => ({ ...form, orderType: event.target.value }))} className="h-11 w-full rounded-full border border-admin-border bg-admin-surface px-4 text-sm text-admin-ink"><option value="standard">Standard</option><option value="custom">Custom</option><option value="bulk">Bulk</option></select></div><div className="space-y-2"><Label className="text-xs text-admin-muted">Due date</Label><Input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((form) => ({ ...form, dueDate: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div></div>
            </div>
            {createError && <p role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{createError}</p>}
            <DialogFooter className="mt-6 gap-3 border-t border-admin-border pt-5 sm:justify-end"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating} className="h-11 rounded-full border-admin-border px-8 text-admin-muted">Cancel</Button><Button type="submit" disabled={isCreating} className="h-11 rounded-sm bg-admin-brand px-8 font-bold text-white hover:bg-admin-brand-ink">{isCreating ? 'Creating…' : 'Create Order'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="order-manage-dialog max-w-[700px] overflow-hidden rounded-[28px] border border-admin-border bg-admin-surface p-0 shadow-2xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-admin-border bg-admin-surface px-6 py-4 text-left"><div className="flex items-center justify-between gap-3"><div><DialogTitle className="text-lg font-bold text-admin-ink">Manage Order</DialogTitle><DialogDescription className="sr-only">Edit order details and project status</DialogDescription></div><div className="flex items-center gap-2"><span className="rounded-full border border-admin-brand-line bg-admin-brand-soft px-3 py-1 text-xs font-bold text-admin-brand-ink">{manageOrder?.orderId}</span><button type="button" onClick={() => setManageOpen(false)} className="rounded-full p-1 text-admin-muted hover:bg-admin-subtle"><X className="h-5 w-5" /></button></div></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void copyTrackLink()} className="h-8 rounded-full border-admin-brand-line bg-admin-brand-soft px-3 text-xs font-semibold text-admin-brand-ink"><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Track Link</Button><Button type="button" variant="outline" onClick={() => manageOrder && window.open(`${window.location.origin}/track-order?id=${encodeURIComponent(manageOrder.orderId)}`, '_blank')} className="h-8 rounded-full border-admin-success-line bg-admin-success-soft px-3 text-xs font-semibold text-admin-success"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Track Order</Button><Button type="button" variant="outline" onClick={() => manageOrder && window.open(`/admin/shipping-labels?orderId=${encodeURIComponent(manageOrder.orderId)}`, '_blank', 'noopener,noreferrer')} className="h-8 rounded-full border-admin-brand-line bg-admin-brand-soft px-3 text-xs font-semibold text-admin-brand-ink"><Printer className="mr-1.5 h-3.5 w-3.5" /> Shipping Label</Button></div></DialogHeader>
          {manageOrder && <div className="order-manage-scroll space-y-4 p-4 sm:p-6">
            <SectionCard title="Project Status" icon={Clipboard} open={sections.status} onToggle={() => setSections((value) => ({ ...value, status: !value.status }))}><div className="flex flex-wrap gap-2">{STATUS_OPTIONS.map((status) => <button type="button" key={status} onClick={() => setManageForm((form) => ({ ...form, status }))} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${manageForm.status === status ? `bg-admin-brand text-white ${statusClass(status).split(' ')[2] || ''}` : 'border-admin-border bg-admin-surface text-admin-muted hover:border-admin-brand-line hover:text-admin-brand-ink'}`}>{statusLabel(status)}</button>)}</div></SectionCard>

            <SectionCard title="Customer Details" icon={UserRound} open={sections.customer} onToggle={() => setSections((value) => ({ ...value, customer: !value.customer }))}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Full name</Label><Input value={manageForm.customerName} onChange={(event) => setManageForm((form) => ({ ...form, customerName: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Phone</Label><Input value={manageForm.customerPhone} onChange={(event) => setManageForm((form) => ({ ...form, customerPhone: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Email</Label><Input type="email" value={manageForm.customerEmail} onChange={(event) => setManageForm((form) => ({ ...form, customerEmail: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Address</Label><Input value={manageForm.customerAddress} onChange={(event) => setManageForm((form) => ({ ...form, customerAddress: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div></div></SectionCard>

            <SectionCard title="Project Details" icon={PackageOpen} open={sections.project} onToggle={() => setSections((value) => ({ ...value, project: !value.project }))}><div className="space-y-4"><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Product / print type</Label><Input value={manageForm.productName} onChange={(event) => setManageForm((form) => ({ ...form, productName: event.target.value }))} placeholder="e.g. Event Banners, Business Cards..." className="h-11 rounded-full border-admin-border" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Project notes / specs</Label><Textarea value={manageForm.projectNotes} onChange={(event) => setManageForm((form) => ({ ...form, projectNotes: event.target.value }))} placeholder="No notes from customer" rows={4} className="resize-none rounded-2xl border-admin-border" /></div><div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Internal notes</Label><Textarea value={manageForm.adminNotes} onChange={(event) => setManageForm((form) => ({ ...form, adminNotes: event.target.value }))} placeholder="Private production notes..." rows={3} className="resize-none rounded-2xl border-admin-border" /></div></div></SectionCard>

            <SectionCard title="Design / Reference Files" icon={FolderOpen} open={sections.files} onToggle={() => setSections((value) => ({ ...value, files: !value.files }))}>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-admin-muted">Customer-uploaded files</div>
                  <div className="rounded-2xl border border-dashed border-admin-border bg-admin-surface px-4 py-8 text-center text-sm text-admin-muted"><FolderOpen className="mx-auto mb-2 h-6 w-6 text-admin-muted" />{Array.isArray(manageOrder.attachments) && manageOrder.attachments.length > 0 ? `${manageOrder.attachments.length} file(s) attached` : 'No files uploaded by customer yet'}</div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-admin-muted">Admin proof / design file</div>
                  <label htmlFor="order-proof-upload" className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-admin-brand-line bg-admin-brand-soft/40 px-4 py-5 text-sm font-semibold text-admin-brand-ink transition hover:bg-admin-brand-soft"><UploadCloud className="h-5 w-5" /> {manageOrder.proofFileName || 'Upload Proof / Design File'}</label>
                  <input id="order-proof-upload" type="file" className="sr-only" onChange={(event) => void uploadProofFile(event.target.files?.[0])} />
                </div>
                <div className="rounded-3xl border border-admin-brand-line bg-admin-brand p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-admin-brand-ink"><Eye className="h-3.5 w-3.5" /> Customer design preview</div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-admin-muted">Upload a sample image for the customer to view from the tracking link. The preview stays watermarked and download access remains locked until you enable it and payment is approved.</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 shrink-0 text-admin-brand-ink" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <label htmlFor="order-design-preview-upload" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-admin-brand-line bg-admin-surface/80 px-4 py-3 text-sm font-bold text-admin-brand-ink transition hover:border-admin-brand-line hover:bg-admin-surface"><UploadCloud className="h-4 w-4" /> Upload preview image</label>
                    <input id="order-design-preview-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void uploadDesignPreview(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                    <Button type="button" variant="outline" onClick={saveDesignPreviews} disabled={updateOrder.isPending} className="h-12 rounded-2xl border-admin-brand-line bg-admin-surface px-5 text-xs font-bold text-admin-brand-ink hover:bg-admin-brand-soft"><Check className="mr-2 h-4 w-4" /> {updateOrder.isPending ? 'Saving…' : 'Save preview settings'}</Button>
                  </div>
                  {designPreviewsFor(manageOrder).length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-admin-brand-line bg-admin-surface/70 px-4 py-6 text-center text-xs text-admin-muted">No customer preview uploaded yet.</div> : <div className="mt-4 space-y-3">
                    {designPreviewsFor(manageOrder).map((preview) => <div key={preview.id} className="rounded-2xl border border-white bg-admin-surface/90 p-3 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-admin-subtle">
                          <img src={preview.previewUrl} alt={preview.name} className="h-full w-full object-cover" />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold tracking-[0.22em] text-white" style={{ opacity: preview.watermarkOpacity }}>{preview.watermarkText}</span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-admin-ink">{preview.name}</p><button type="button" onClick={() => removeDesignPreview(preview.id)} className="rounded-full p-2 text-admin-muted transition hover:bg-admin-danger-soft hover:text-admin-danger" aria-label={`Remove ${preview.name}`}><Trash2 className="h-4 w-4" /></button></div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Watermark text</Label><Input value={preview.watermarkText} onChange={(event) => patchDesignPreview(preview.id, { watermarkText: event.target.value })} className="h-10 rounded-xl border-admin-border text-sm" /></div>
                            <div className="space-y-1.5"><Label className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-admin-muted"><span>Watermark opacity</span><span>{Math.round(preview.watermarkOpacity * 100)}%</span></Label><input type="range" min="0.05" max="0.6" step="0.01" value={preview.watermarkOpacity} onChange={(event) => patchDesignPreview(preview.id, { watermarkOpacity: Number(event.target.value) })} className="mt-3 w-full accent-admin-brand" /></div>
                          </div>
                          <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Google Drive download link</Label><Input value={preview.driveUrl} onChange={(event) => patchDesignPreview(preview.id, { driveUrl: event.target.value })} placeholder="https://drive.google.com/file/d/..." className="h-10 rounded-xl border-admin-border text-sm" /></div>
                          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-admin-success-line bg-admin-success-soft/70 px-3 py-2.5 text-xs text-admin-success"><input type="checkbox" checked={preview.downloadEnabled} onChange={(event) => patchDesignPreview(preview.id, { downloadEnabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-admin-success" /><span><span className="block font-bold">Enable customer download after payment</span><span className="mt-0.5 block text-[11px] leading-4 text-admin-success/80">The button appears only after the Drive link is saved and the payment status becomes paid.</span></span></label>
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
                  <div className="rounded-2xl bg-admin-surface p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Method</div><div className="mt-1 text-sm font-bold text-admin-ink">{String(manageOrder.paymentMethod || '—').replace('_', ' ')}</div></div>
                  <div className="rounded-2xl bg-admin-surface p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Payment</div><div className="mt-1 text-sm font-bold text-admin-ink">{String(manageOrder.paymentStatus || 'pending').replace('_', ' ')}</div></div>
                  <div className="rounded-2xl bg-admin-surface p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Proof</div><div className="mt-1 text-sm font-bold text-admin-ink">{String(manageOrder.paymentProofStatus || 'not uploaded').replace('_', ' ')}</div></div>
                  <div className="rounded-2xl bg-admin-surface p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Amount</div><div className="mt-1 text-sm font-bold text-admin-ink">{money(manageOrder.paymentAmount || orderTotalForRow(manageOrder))}</div></div>
                </div>
                {manageOrder.paymentStatus !== 'paid' && (
                  <div className="rounded-2xl border border-admin-brand-line bg-admin-brand p-4 shadow-sm">
                    <div className="mb-3"><p className="text-sm font-bold text-admin-ink">Confirm received payment</p><p className="mt-1 text-xs leading-5 text-admin-muted">Choose the payment type and verify the exact amount received.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Payment type</Label><select value={manageForm.approvalPaymentType} onChange={(event) => setManageForm((form) => ({ ...form, approvalPaymentType: event.target.value as ManageForm['approvalPaymentType'], ...(event.target.value === 'full' ? { approvalPaymentAmount: String(orderTotalForRow(manageOrder)) } : {}) }))} className="h-11 w-full rounded-xl border border-white bg-admin-surface/90 px-4 text-sm font-semibold text-admin-ink shadow-sm outline-none transition focus:border-admin-brand-line focus:ring-2 focus:ring-admin-brand"><option value="advance">Advance payment</option><option value="full">Full payment</option><option value="custom">Custom amount</option></select></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wide text-admin-muted">Approved amount (Rs.)</Label><Input type="number" min="0.01" step="0.01" value={manageForm.approvalPaymentAmount} onChange={(event) => setManageForm((form) => ({ ...form, approvalPaymentAmount: event.target.value }))} className="h-11 rounded-xl border-white bg-admin-surface/90 text-sm font-semibold shadow-sm" placeholder="Enter exact amount" /></div>
                    </div>
                  </div>
                )}
                {!manageOrder.paymentProofUrl && manageOrder.paymentStatus !== 'paid' && <div className="space-y-2 rounded-2xl border border-admin-warning-line bg-admin-warning-soft p-4"><Label className="text-xs font-bold text-admin-ink">Manual payment verification (no slip)</Label><Textarea value={manageForm.manualPaymentReason} onChange={(event) => setManageForm((form) => ({ ...form, manualPaymentReason: event.target.value }))} placeholder="How did you confirm payment? e.g. bank statement reference, cash received in studio" maxLength={500} className="bg-admin-surface" /><Button type="button" onClick={() => void reviewPayment('approve')} disabled={paymentReviewLoading !== null || manageForm.manualPaymentReason.trim().length < 8} className="rounded-full bg-admin-success-solid text-white">{paymentReviewLoading === 'approve' ? 'Saving…' : 'Mark payment received'}</Button></div>}
                {manageOrder.paymentProofUrl ? <div className="flex flex-col gap-3 rounded-2xl border border-admin-brand-line bg-admin-brand-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><a href={manageOrder.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-admin-brand-ink hover:underline"><ExternalLink className="h-4 w-4" /> View customer payment proof</a>{manageOrder.paymentProofExpiresAt && <div className="mt-1 text-xs text-admin-brand-ink">Proof retention ends {safeDate(manageOrder.paymentProofExpiresAt)}.</div>}</div><div className="flex gap-2"><Button type="button" onClick={() => void reviewPayment('reject')} disabled={paymentReviewLoading !== null} variant="outline" className="h-9 rounded-full border-admin-danger-line px-4 text-xs font-bold text-admin-danger">{paymentReviewLoading === 'reject' ? 'Rejecting…' : 'Reject'}</Button><Button type="button" onClick={() => void reviewPayment('approve')} disabled={paymentReviewLoading !== null} className="h-9 rounded-full bg-admin-success-solid px-4 text-xs font-bold text-white hover:bg-admin-success-solid">{paymentReviewLoading === 'approve' ? 'Approving…' : 'Approve & Process'}</Button></div></div> : <div className="rounded-2xl border border-dashed border-admin-border bg-admin-surface px-4 py-8 text-center text-sm text-admin-muted"><CreditCard className="mx-auto mb-2 h-6 w-6 text-admin-muted" />No customer payment slip uploaded. You can verify the transfer or cash payment manually above.</div>}
              </div>
            </SectionCard>

            <SectionCard title="Delivery & Timeline" icon={Truck} open={sections.delivery} onToggle={() => setSections((value) => ({ ...value, delivery: !value.delivery }))}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Delivery method</Label><select value={manageForm.deliveryMethod} onChange={(event) => setManageForm((form) => ({ ...form, deliveryMethod: event.target.value }))} className="h-11 w-full rounded-full border border-admin-border bg-admin-surface px-4 text-sm text-admin-ink"><option value="">Not selected</option><option value="pickup">Pickup</option><option value="courier">Courier</option><option value="sl_post">Sri Lanka Post</option></select></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Due date</Label><Input type="date" value={manageForm.dueDate} onChange={(event) => setManageForm((form) => ({ ...form, dueDate: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Expected delivery handover date</Label><Input type="date" value={manageForm.estimatedCompletion} onChange={(event) => setManageForm((form) => ({ ...form, estimatedCompletion: event.target.value }))} className="h-11 rounded-full border-admin-border" /><p className="px-1 text-[11px] leading-4 text-admin-muted">The date you expect to hand this order to the courier or customer. It appears on the customer tracking page.</p></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Courier name</Label><Input value={manageForm.courierName} onChange={(event) => setManageForm((form) => ({ ...form, courierName: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">Tracking number</Label><Input value={manageForm.courierTrackingNumber} onChange={(event) => setManageForm((form) => ({ ...form, courierTrackingNumber: event.target.value }))} className="h-11 rounded-full border-admin-border" /></div>
                </div>
                <div className="rounded-2xl border border-admin-brand-line bg-admin-brand p-4">
                  <p className="text-sm font-bold text-admin-ink">Update customer delivery tracking</p>
                  <p className="mt-1 text-xs leading-5 text-admin-muted">Save the courier details above and publish the latest delivery state to the customer's Track Order timeline.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => setDeliveryStatus('shipped')} disabled={updateOrder.isPending || manageForm.status === 'shipped'} className="h-11 rounded-xl border-admin-brand-line bg-admin-surface font-bold text-admin-brand-ink hover:bg-admin-brand-soft"><Truck className="mr-2 h-4 w-4" /> {manageForm.status === 'shipped' ? 'Marked as Shipped' : 'Mark as Shipped'}</Button>
                    <Button type="button" onClick={() => setDeliveryStatus('delivered')} disabled={updateOrder.isPending || manageForm.status === 'delivered'} className="h-11 rounded-xl bg-admin-success-solid font-bold text-white hover:bg-admin-success-solid"><Check className="mr-2 h-4 w-4" /> {manageForm.status === 'delivered' ? 'Marked as Delivered' : 'Mark as Delivered'}</Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>}
          <DialogFooter className="sticky bottom-0 z-10 gap-3 border-t border-admin-border bg-admin-surface px-6 py-4 sm:justify-end"><Button type="button" variant="outline" onClick={() => setManageOpen(false)} disabled={updateOrder.isPending} className="h-11 rounded-full border-admin-border px-8 text-admin-muted">Cancel</Button><Button type="button" onClick={saveManageOrder} disabled={updateOrder.isPending || !manageOrder} className="h-11 rounded-sm bg-primary px-8 font-bold text-primary-foreground hover:bg-admin-muted">{updateOrder.isPending ? 'Saving…' : 'Save Changes'}</Button></DialogFooter>
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
