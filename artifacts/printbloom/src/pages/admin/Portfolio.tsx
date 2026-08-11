import { useListPortfolio, useDeletePortfolioItem } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Portfolio() {
  const { data: items, isLoading, refetch } = useListPortfolio();
  const deleteItem = useDeletePortfolioItem();
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
          <h1 className="text-3xl font-serif font-bold text-foreground">Portfolio</h1>
          <p className="text-muted-foreground mt-1">Manage your design and print showcase.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground">Add Work</Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Title</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12"><ImageIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" /><p className="text-muted-foreground">No portfolio items.</p></TableCell>
                </TableRow>
              ) : (
                items?.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.category}</TableCell>
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