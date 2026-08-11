import { useListInvoices, useDeleteInvoice } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, MoreHorizontal, Edit2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Invoices() {
  const { data: invoices, isLoading, refetch } = useListInvoices();
  const deleteInv = useDeleteInvoice();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this invoice?')) {
      deleteInv.mutate({ id }, { onSuccess: () => { toast({ title: 'Invoice deleted' }); refetch(); }});
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage billing and payments.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold">Create Invoice</Button>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Invoice #</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12"><FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No invoices found.</p></TableCell>
                </TableRow>
              ) : (
                invoices?.map(inv => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-foreground">{inv.clientName}</TableCell>
                    <TableCell className="font-medium text-sm">Rs. {inv.amount}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium"><Download className="mr-2 h-4 w-4" /> Download PDF</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium"><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(inv.id)}>
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