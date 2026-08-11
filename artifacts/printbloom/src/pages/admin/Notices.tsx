import { useGetNotices, useDeleteNoticeById } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Bell, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Notices() {
  const { data: notices, isLoading, refetch } = useGetNotices();
  const deleteNotice = useDeleteNoticeById();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm('Delete this notice?')) {
      deleteNotice.mutate({ id }, { onSuccess: () => { toast({ title: 'Notice deleted' }); refetch(); }});
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Site Notices</h1>
          <p className="text-muted-foreground mt-1">Manage announcement banners for the public site.</p>
        </div>
        <Button className="rounded-none bg-primary text-primary-foreground">Add Notice</Button>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Message</TableHead>
                <TableHead className="font-semibold">Style</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : notices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12"><Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" /><p className="text-muted-foreground">No notices active.</p></TableCell>
                </TableRow>
              ) : (
                notices?.map(notice => (
                  <TableRow key={notice.id}>
                    <TableCell className="font-medium max-w-sm truncate">{notice.message}</TableCell>
                    <TableCell className="capitalize">{notice.style}</TableCell>
                    <TableCell>{notice.enabled ? 'Enabled' : 'Disabled'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(notice.id)}><Trash2 className="w-4 h-4" /></Button>
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