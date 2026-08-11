import { useListInventory, useDeleteInventoryItem } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Box, Trash2, Edit2, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage raw materials and stock levels.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold">Add Item</Button>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Material Name</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Current Stock</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Supplier</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12"><Box className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No inventory items.</p></TableCell>
                </TableRow>
              ) : (
                items?.map(item => {
                  const isLow = item.quantity <= item.lowStockThreshold;
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                      <TableCell>
                        <span className={`font-mono ${isLow ? 'text-red-600 font-bold' : 'text-foreground'}`}>{item.quantity}</span>
                        <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.supplierName || '-'}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-[9px] uppercase font-bold tracking-widest border border-red-200">Low Stock</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-[9px] uppercase font-bold tracking-widest border border-green-200">In Stock</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                            <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium"><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}