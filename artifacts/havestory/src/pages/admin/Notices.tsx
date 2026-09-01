import { useState } from 'react';
import { useGetNotices, useDeleteNoticeById, useCreateNotice, useUpdateNoticeById } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Bell, Trash2, Edit2, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AdminTableError, AdminTableLoading } from '@/components/admin/AdminPageState';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMPTY_NOTICE = { message: '', style: 'info', placement: 'banner', enabled: true, sortOrder: 0 };

export default function Notices() {
  const { data: notices, isLoading, isError, refetch } = useGetNotices();
  const deleteNotice = useDeleteNoticeById();
  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNoticeById();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_NOTICE);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_NOTICE); setOpen(true); };
  const openEdit = (notice: any) => {
    setEditingId(notice.id);
    setForm({ message: notice.message || '', style: notice.style || 'info', placement: notice.placement || 'banner', enabled: !!notice.enabled, sortOrder: Number(notice.sortOrder || 0) });
    setOpen(true);
  };
  const saveNotice = () => {
    if (!form.message.trim()) { toast({ title: 'Message is required', variant: 'destructive' }); return; }
    const request = editingId
      ? updateNotice.mutateAsync({ id: editingId, data: { ...form, message: form.message.trim() } })
      : createNotice.mutateAsync({ data: { ...form, message: form.message.trim() } });
    void request.then(() => { toast({ title: editingId ? 'Notice updated' : 'Notice created' }); setOpen(false); void refetch(); })
      .catch(() => toast({ title: 'Notice could not be saved', variant: 'destructive' }));
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this notice?')) {
      deleteNotice.mutate({ id }, { onSuccess: () => { toast({ title: 'Notice deleted' }); refetch(); }});
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Site Notices</h1>
          <p className="text-muted-foreground mt-1">Manage announcement banners for the public site.</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs tracking-widest px-5 h-10 font-semibold">Add Notice</Button>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Message</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Style</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <AdminTableLoading columns={4} />
              ) : isError ? (
                <AdminTableError columns={4} onRetry={() => void refetch()} />
              ) : notices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12"><Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No notices active.</p></TableCell>
                </TableRow>
              ) : (
                notices?.map(notice => (
                  <TableRow key={notice.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium text-foreground max-w-sm truncate">{notice.message}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-muted text-muted-foreground text-[9px] uppercase font-bold tracking-widest">
                        {notice.style}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest ${notice.enabled ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                        {notice.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                          <DropdownMenuItem onClick={() => openEdit(notice)} className="cursor-pointer text-xs uppercase tracking-widest font-medium"><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(notice.id)}>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader><DialogTitle>{editingId ? 'Edit notice' : 'Add notice'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Message</Label><Input value={form.message} onChange={e => setForm(v => ({ ...v, message: e.target.value }))} placeholder="Announcement shown on the website" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Style</Label><select value={form.style} onChange={e => setForm(v => ({ ...v, style: e.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3 text-foreground"><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select></div>
              <div className="space-y-1.5"><Label>Placement</Label><select value={form.placement} onChange={e => setForm(v => ({ ...v, placement: e.target.value }))} className="h-10 w-full rounded-xl border border-border bg-card px-3 text-foreground"><option value="banner">Banner</option><option value="popup">Popup</option></select></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground"><input type="checkbox" checked={form.enabled} onChange={e => setForm(v => ({ ...v, enabled: e.target.checked }))} /> Enabled</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={saveNotice} disabled={createNotice.isPending || updateNotice.isPending}>{createNotice.isPending || updateNotice.isPending ? 'Saving…' : 'Save notice'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
