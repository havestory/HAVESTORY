import { FormEvent, useState } from 'react';
import { useCreateOrder, useListOrders, useUpdateOrder, useDeleteOrder } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MoreHorizontal, Trash2, Eye, MessageCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AdminTableError, AdminTableLoading } from '@/components/admin/AdminPageState';

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    productName: '',
    quantity: '1',
    orderType: 'standard',
    priority: 'normal',
    dueDate: '',
    notes: '',
  });
  const { data: orders, isLoading, isError, refetch } = useListOrders(
    statusFilter !== 'all' ? { status: statusFilter } : {}
  );
  
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const { toast } = useToast();

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateOrder.mutate({ id: String(orderId), data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: 'Order Updated', description: `Status changed to ${newStatus}` });
        refetch();
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update order', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (orderId: number) => {
    if (confirm('Are you sure you want to delete this order? This cannot be undone.')) {
      deleteOrder.mutate({ id: String(orderId) }, {
        onSuccess: () => {
          toast({ title: 'Order Deleted' });
          refetch();
        }
      });
    }
  };

  const handleCreateOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customerName = createForm.customerName.trim();
    const customerPhone = createForm.customerPhone.trim();
    const customerAddress = createForm.customerAddress.trim();
    const productName = createForm.productName.trim();
    const quantity = Number.parseInt(createForm.quantity, 10);

    if (!customerName || !customerPhone || !customerAddress || !productName || !Number.isFinite(quantity) || quantity < 1) {
      toast({
        title: 'Missing order details',
        description: 'Enter the customer name, phone, address, item, and a valid quantity.',
        variant: 'destructive',
      });
      return;
    }

    createOrder.mutate({
      data: {
        customerName,
        customerPhone,
        customerEmail: createForm.customerEmail.trim() || null,
        customerAddress,
        orderType: createForm.orderType,
        items: [{ productId: null, productName, quantity, notes: null }],
        designLinks: [],
        attachments: [],
        notes: createForm.notes.trim() || null,
        dueDate: createForm.dueDate || null,
        startDate: null,
        priority: createForm.priority,
        discountAmount: 0,
        advancePaid: 0,
        tags: [],
      },
    }, {
      onSuccess: () => {
        toast({ title: 'Order Created', description: 'The new order is now available in the order list.' });
        setCreateOpen(false);
        setCreateForm({
          customerName: '', customerPhone: '', customerEmail: '', customerAddress: '',
          productName: '', quantity: '1', orderType: 'standard', priority: 'normal', dueDate: '', notes: '',
        });
        void refetch();
      },
      onError: (error) => {
        toast({
          title: 'Order creation failed',
          description: error instanceof Error ? error.message : 'The server could not create this order. Check the details and try again.',
          variant: 'destructive',
        });
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
      case 'processing': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100';
      case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'cancelled': return 'bg-red-100 text-red-800 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">Manage standard print orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] rounded-none border-border bg-card">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-border">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => setCreateOpen(true)} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold">
            Create Order
          </Button>
        </div>
      </div>

      <Card className="rounded-none border border-border shadow-sm">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Order ID</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <AdminTableLoading columns={6} />
              ) : isError ? (
                <AdminTableError columns={6} onRetry={() => void refetch()} />
              ) : orders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No orders found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                orders?.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-sm">{order.orderId}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{order.customerPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(order.createdAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="capitalize text-sm">{order.orderType}</TableCell>
                    <TableCell>
                      <Select 
                        defaultValue={order.status} 
                        onValueChange={(val) => handleStatusChange(order.id, val)}
                      >
                        <SelectTrigger className={`w-[130px] h-7 text-[10px] rounded-none border-none font-bold uppercase tracking-widest ${getStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-border">
                          <SelectItem value="pending" className="text-[10px] font-bold uppercase tracking-widest">PENDING</SelectItem>
                          <SelectItem value="processing" className="text-[10px] font-bold uppercase tracking-widest">PROCESSING</SelectItem>
                          <SelectItem value="shipped" className="text-[10px] font-bold uppercase tracking-widest">SHIPPED</SelectItem>
                          <SelectItem value="completed" className="text-[10px] font-bold uppercase tracking-widest">COMPLETED</SelectItem>
                          <SelectItem value="cancelled" className="text-[10px] font-bold uppercase tracking-widest text-red-600">CANCELLED</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium" onClick={() => {
                            const num = order.customerPhone.replace(/[^0-9]/g, '');
                            window.open(`https://wa.me/${num}`, '_blank');
                          }}>
                            <MessageCircle className="mr-2 h-4 w-4 text-green-600" /> WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(order.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-none border-border bg-background max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold">Create Order</DialogTitle>
            <DialogDescription>Capture a manual customer order. You can add pricing and invoice details after the order is created.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-order-customer-name">Customer name *</Label>
                <Input id="create-order-customer-name" value={createForm.customerName} onChange={e => setCreateForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Customer name" autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-order-customer-phone">Phone *</Label>
                <Input id="create-order-customer-phone" value={createForm.customerPhone} onChange={e => setCreateForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="07X XXX XXXX" autoComplete="tel" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-order-customer-email">Email</Label>
                <Input id="create-order-customer-email" type="email" value={createForm.customerEmail} onChange={e => setCreateForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="customer@example.com" autoComplete="email" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-order-customer-address">Delivery address *</Label>
                <Textarea id="create-order-customer-address" value={createForm.customerAddress} onChange={e => setCreateForm(f => ({ ...f, customerAddress: e.target.value }))} placeholder="Full delivery or pickup address" rows={3} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-order-product">Item / service *</Label>
                <Input id="create-order-product" value={createForm.productName} onChange={e => setCreateForm(f => ({ ...f, productName: e.target.value }))} placeholder="e.g. A3 Walnut Frame" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-order-quantity">Quantity *</Label>
                <Input id="create-order-quantity" type="number" min="1" step="1" value={createForm.quantity} onChange={e => setCreateForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-order-type">Order type</Label>
                <select id="create-order-type" value={createForm.orderType} onChange={e => setCreateForm(f => ({ ...f, orderType: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="standard">Standard</option>
                  <option value="custom">Custom</option>
                  <option value="bulk">Bulk</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-order-priority">Priority</Label>
                <select id="create-order-priority" value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-order-due-date">Due date</Label>
                <Input id="create-order-due-date" type="date" value={createForm.dueDate} onChange={e => setCreateForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-order-notes">Notes</Label>
                <Textarea id="create-order-notes" value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional production, delivery, or customer notes" rows={3} />
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createOrder.isPending}>Cancel</Button>
              <Button type="submit" disabled={createOrder.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {createOrder.isPending ? 'Creating…' : 'Create Order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
