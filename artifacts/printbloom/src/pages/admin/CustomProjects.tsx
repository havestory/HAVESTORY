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
      case 'shipped': return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100';
      case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'cancelled': return 'bg-red-100 text-red-800 hover:bg-red-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
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
            <SelectContent className="rounded-none border-border">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold text-foreground">Project ID</TableHead>
                <TableHead className="font-semibold text-foreground">Client</TableHead>
                <TableHead className="font-semibold text-foreground">Date</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : orders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No custom projects found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                orders?.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{order.orderId}</TableCell>
                    <TableCell>
                      <div>
                        <p>{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(order.createdAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Select defaultValue={order.status} onValueChange={(val) => handleStatusChange(order.id, val)}>
                        <SelectTrigger className={`w-[130px] h-8 text-xs rounded-none border-none font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="pending">PENDING</SelectItem>
                          <SelectItem value="processing">PROCESSING</SelectItem>
                          <SelectItem value="shipped">SHIPPED</SelectItem>
                          <SelectItem value="completed">COMPLETED</SelectItem>
                          <SelectItem value="cancelled">CANCELLED</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => {
                            const num = order.customerPhone.replace(/[^0-9]/g, '');
                            window.open(`https://wa.me/${num}`, '_blank');
                          }}>
                            <MessageCircle className="mr-2 h-4 w-4 text-green-600" /> WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => handleDelete(order.id)}>
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