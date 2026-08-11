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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage print catalog items.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold">
          Add Product
        </Button>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="w-16"></TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Category</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Price</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No products found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                products?.map(product => (
                  <TableRow key={product.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="w-10 h-10 bg-muted/50 border border-border overflow-hidden">
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 mx-auto mt-3 text-muted-foreground/30" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {product.name}
                        {product.featured && <Star className="w-3 h-3 text-secondary fill-current" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.category?.name || 'Uncategorized'}</TableCell>
                    <TableCell className="text-sm font-medium">Rs. {product.price} <span className="text-xs text-muted-foreground font-normal">/ {product.priceType}</span></TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest ${product.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                        {product.active ? 'Active' : 'Draft'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium"><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(product.id)}>
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