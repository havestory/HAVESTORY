import { useListServices, useDeleteService } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Layers, MoreHorizontal, Trash2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Services() {
  const { data: services, isLoading, refetch } = useListServices();
  const deleteService = useDeleteService();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this service?')) {
      deleteService.mutate({ id }, { onSuccess: () => { toast({ title: 'Service deleted' }); refetch(); }});
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Services</h1>
          <p className="text-muted-foreground mt-1">Manage service packages and offerings.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground">Add Service</Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Service</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : services?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12"><Layers className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" /><p className="text-muted-foreground">No services found.</p></TableCell>
                </TableRow>
              ) : (
                services?.map(service => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="truncate max-w-xs">{service.description}</TableCell>
                    <TableCell>{service.active ? 'Active' : 'Draft'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(service.id)}><Trash2 className="w-4 h-4" /></Button>
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