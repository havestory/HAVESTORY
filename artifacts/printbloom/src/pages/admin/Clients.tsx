import { useState } from 'react';
import { useListClients, useDeleteClient } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, MoreHorizontal, Trash2, Edit2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Clients() {
  const { data: clients, isLoading, refetch } = useListClients();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this client? This does not delete their past invoices.')) {
      deleteClient.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Client deleted' });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage client records and profiles.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
          Add Client
        </Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Name / Business</TableHead>
                <TableHead className="font-semibold">Contact</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : clients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No clients found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                clients?.map(client => (
                  <TableRow key={client.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{client.name}</div>
                      {client.businessName && <div className="text-xs text-muted-foreground">{client.businessName}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{client.email || '-'}</div>
                      <div className="text-sm text-muted-foreground">{client.phone || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${client.approved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {client.approved ? 'Approved' : 'Pending'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border">
                          <DropdownMenuItem className="cursor-pointer"><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer"><FileText className="mr-2 h-4 w-4" /> View Invoices</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => handleDelete(client.id)}>
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