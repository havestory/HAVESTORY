import { useState } from 'react';
import { useListOrders, useUpdateOrder, useDeleteOrder } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Eye, MessageCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function CustomProjects() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: orders, isLoading, refetch } = useListOrders({
    type: 'custom',
    ...(statusFilter !== 'all' ? { status: statusFilter } : {})
  });
  
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const { toast } = useToast();

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateOrder.mutate({ id: orderId, data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: 'Project Updated', description: `Status changed to ${newStatus}` });
        refetch();
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update project', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (orderId: number) => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteOrder.mutate({ id: orderId }, {
        onSuccess: () => {
          toast({ title: 'Project Deleted' });
          refetch();
        }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
      case 'processing': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'cancelled': return 'bg-red-100 text-red-800 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Custom Projects</h1>
          <p className="text-muted-foreground mt-1">Manage bespoke and graphic design orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] rounded-none border-border bg-card">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-border shadow-md">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold">
            New Project
          </Button>
        </div>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Project ID</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading projects...</TableCell>
                </TableRow>
              ) : orders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No custom projects found.</p>
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
                    <TableCell>
                      <Select 
                        defaultValue={order.status} 
                        onValueChange={(val) => handleStatusChange(order.id, val)}
                      >
                        <SelectTrigger className={`w-[130px] h-7 text-[10px] rounded-none border-none font-bold uppercase tracking-widest ${getStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-border shadow-md">
                          <SelectItem value="pending" className="text-[10px] font-bold uppercase tracking-widest">PENDING</SelectItem>
                          <SelectItem value="processing" className="text-[10px] font-bold uppercase tracking-widest">PROCESSING</SelectItem>
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
    </div>
  );
}