import { useListInventory, useDeleteInventoryItem } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Box, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RawMaterials() {
  const { data: items, isLoading, refetch } = useListInventory();
  const deleteItem = useDeleteInventoryItem();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this item?')) {
      deleteItem.mutate({ id }, { onSuccess: () => { toast({ title: 'Item deleted' }); refetch(); }});
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage raw materials and supplies.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground">Add Stock</Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Item</TableHead>
                <TableHead className="font-semibold">Stock</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12"><Box className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" /><p className="text-muted-foreground">No inventory items.</p></TableCell>
                </TableRow>
              ) : (
                items?.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.quantity} {item.unit}</TableCell>
                    <TableCell>
                      {item.quantity <= item.lowStockThreshold ? (
                        <span className="text-destructive font-semibold text-xs">LOW STOCK</span>
                      ) : (
                        <span className="text-green-600 font-semibold text-xs">OK</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
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