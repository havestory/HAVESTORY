import { useListInvoices, useDeleteInvoice } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function Invoices() {
  const { data: invoices, isLoading, refetch } = useListInvoices();
  const deleteInv = useDeleteInvoice();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this invoice?')) {
      deleteInv.mutate({ id }, { onSuccess: () => { toast({ title: 'Invoice deleted' }); refetch(); }});
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage billing and payments.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground">Create Invoice</Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Invoice #</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Amount</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12"><FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" /><p className="text-muted-foreground">No invoices found.</p></TableCell>
                </TableRow>
              ) : (
                invoices?.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell>Rs. {inv.amount}</TableCell>
                    <TableCell className="capitalize">{inv.status}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(inv.id)}><Trash2 className="w-4 h-4" /></Button>
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