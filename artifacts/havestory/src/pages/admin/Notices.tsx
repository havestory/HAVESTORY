import { useState } from 'react';
import { useGetNotices, useDeleteNoticeById, useCreateNotice, useUpdateNoticeById } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Bell, Trash2, Edit2, MoreHorizontal, Plus, Save, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AdminTableError, AdminTableLoading } from '@/components/admin/AdminPageState';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
        <Button onClick={openCreate} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs tracking-widest px-5 h-10 font-semibold"><Plus className="mr-2 h-4 w-4" /> Add Notice</Button>
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
        <DialogContent data-admin-theme="light" className="max-w-lg w-[calc(100%-2rem)] rounded-2xl border-slate-200 bg-white text-slate-900 p-6">
          <DialogHeader><DialogTitle>{editingId ? 'Edit notice' : 'Add notice'}</DialogTitle><DialogDescription className="text-slate-600">Write an announcement, choose where it appears and preview it before saving.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="notice-message">Notice message</Label><textarea id="notice-message" rows={4} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500" value={form.message} onChange={e => setForm(v => ({ ...v, message: e.target.value }))} placeholder="Announcement shown on the website" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="notice-style">Notice style</Label><select id="notice-style" value={form.style} onChange={e => setForm(v => ({ ...v, style: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:ring-2 focus:ring-violet-500"><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="notice-placement">Display location</Label><select id="notice-placement" value={form.placement} onChange={e => setForm(v => ({ ...v, placement: e.target.value }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 focus:ring-2 focus:ring-violet-500"><option value="banner">Banner</option><option value="popup">Popup</option></select></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground"><input type="checkbox" checked={form.enabled} onChange={e => setForm(v => ({ ...v, enabled: e.target.checked }))} className="h-4 w-4 accent-violet-700" /> Show this notice on the website</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><Eye size={15} /> Message preview · {form.placement}</div><p className={`whitespace-pre-wrap break-words rounded-lg border p-3 text-sm ${form.style === 'urgent' ? 'border-red-200 bg-red-50 text-red-900' : form.style === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : form.style === 'success' ? 'border-green-200 bg-green-50 text-green-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>{form.message || 'Your announcement will appear here.'}</p></div>
          </div>
          <DialogFooter className="gap-2 border-t border-slate-200 pt-4"><Button variant="outline" className="h-11 rounded-xl border-slate-300 bg-white text-slate-800" onClick={() => setOpen(false)}>Cancel</Button><Button className="h-11 rounded-xl bg-violet-700 text-white hover:bg-violet-800" onClick={saveNotice} disabled={!form.message.trim() || createNotice.isPending || updateNotice.isPending}><Save className="mr-2 h-4 w-4" />{createNotice.isPending || updateNotice.isPending ? 'Saving…' : 'Save notice'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
