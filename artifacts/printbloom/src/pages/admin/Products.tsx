import { useListProducts, useDeleteProduct } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Package, MoreHorizontal, Trash2, Edit2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Products() {
  const { data: products, isLoading, refetch } = useListProducts();
  const deleteProduct = useDeleteProduct();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this product?')) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Product deleted' });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage print catalog items.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
          Add Product
        </Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Price</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Package className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No products found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                products?.map(product => (
                  <TableRow key={product.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="w-10 h-10 bg-muted overflow-hidden">
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 mx-auto mt-2.5 text-muted-foreground/50" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {product.name}
                        {product.featured && <Star className="w-3 h-3 text-secondary fill-current" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{product.category?.name || 'Uncategorized'}</TableCell>
                    <TableCell>Rs. {product.price} <span className="text-xs text-muted-foreground">/ {product.priceType}</span></TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${product.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                        {product.active ? 'Active' : 'Draft'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border">
                          <DropdownMenuItem className="cursor-pointer"><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => handleDelete(product.id)}>
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