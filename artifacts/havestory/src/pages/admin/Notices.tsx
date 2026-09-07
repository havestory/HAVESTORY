import { useState } from 'react';
import { useGetNotices, useDeleteNoticeById, useCreateNotice, useUpdateNoticeById } from '@workspace/api-client-react';
import { Bell, Trash2, Edit2, Plus, Save, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { NoticeCard, type SiteNotice } from '@/components/public/SiteNotices';
import './notices.css';

const EMPTY_NOTICE = { message: '', topic: '', style: 'info', placement: 'banner', enabled: true, sortOrder: 0 };
export default function Notices() {
  const { data: notices, isLoading, isError, refetch } = useGetNotices();
  const deleteNotice = useDeleteNoticeById();
  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNoticeById();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_NOTICE);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [previewWidth, setPreviewWidth] = useState('desktop');
  const busy = createNotice.isPending || updateNotice.isPending || deleteNotice.isPending;
  const list = (Array.isArray(notices) ? notices : []).slice().sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);
  const visible = list.filter(n => (filter === 'all' || (filter === 'active' ? n.enabled : !n.enabled)) && `${n.topic || ''} ${n.message}`.toLowerCase().includes(query.toLowerCase()));
  const openEdit = (notice: SiteNotice) => {
    setEditingId(notice.id);
    setForm({ message: notice.message || '', topic: notice.topic || '', style: notice.style || 'info', placement: notice.placement || 'banner', enabled: !!notice.enabled, sortOrder: Number(notice.sortOrder || 0) });
    setOpen(true);
  };
  const saveNotice = async () => {
    if (busy || !form.message.trim() || !Number.isSafeInteger(form.sortOrder)) return;
    try {
      const data = { ...form, message: form.message.trim(), topic: form.topic.trim() };
      if (editingId !== null) await updateNotice.mutateAsync({ id: editingId, data });
      else await createNotice.mutateAsync({ data });
      toast({ title: editingId !== null ? 'Notice updated' : 'Notice created' });
      setOpen(false); void refetch();
    } catch { toast({ title: 'Notice could not be saved', description: 'Your edits are still here. Please try again.', variant: 'destructive' }); }
  };
  const toggle = async (notice: SiteNotice) => {
    if (busy) return;
    try { await updateNotice.mutateAsync({ id: notice.id, data: { message: notice.message, style: notice.style || 'info', placement: notice.placement || 'banner', enabled: !notice.enabled } }); void refetch(); toast({ title: notice.enabled ? 'Notice hidden' : 'Notice is live' }); }
    catch { toast({ title: 'Status could not be changed', variant: 'destructive' }); }
  };
  const remove = async (id: number) => {
    if (busy || !confirm('Delete this notice permanently? You can hide it instead to keep it for later.')) return;
    try { await deleteNotice.mutateAsync({ id }); void refetch(); toast({ title: 'Notice deleted' }); }
    catch { toast({ title: 'Notice could not be deleted', variant: 'destructive' }); }
  };
  return <div className="hs-notice-admin">
    <header className="hs-notice-admin-header"><div><span className="hs-notice-eyebrow"><Bell size={14} /> CUSTOMER COMMUNICATION</span><h1>Site notices</h1><p>Clear updates for your homepage, styled to match your studio.</p></div><button className="hs-notice-primary" disabled={busy} onClick={() => { setEditingId(null); setForm({ ...EMPTY_NOTICE }); setOpen(true); }}><Plus size={17} /> Add notice</button></header>
    <div className="hs-notice-filters"><label>Search notices<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title or message" /></label><label>Status<select aria-label="Status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All notices ({list.length})</option><option value="active">Live ({list.filter(n => n.enabled).length})</option><option value="hidden">Hidden ({list.filter(n => !n.enabled).length})</option></select></label></div>
    {isLoading ? <p role="status">Loading notices…</p> : isError ? <div role="alert">Notices could not load. <button onClick={() => void refetch()}>Try again</button></div> : !visible.length ? <div className="hs-notice-empty"><Bell size={28} /><h2>{list.length ? 'No matching notices' : 'Your next update starts here'}</h2><p>{list.length ? 'Try another search or status filter.' : 'Add delivery updates, studio news or important announcements.'}</p></div> : <div className="hs-notice-list">{visible.map(notice => <div key={notice.id} className="hs-notice-admin-card"><div className="hs-notice-meta"><span data-live={notice.enabled}>{notice.enabled ? 'Live' : 'Hidden'}</span><span>{notice.placement === 'popup' ? 'Popup' : 'Banner'} · Order {notice.sortOrder || 0}</span></div><NoticeCard notice={notice} /><div className="hs-notice-admin-actions"><button disabled={busy} onClick={() => openEdit(notice)}><Edit2 size={15} /> Edit & preview</button><button disabled={busy} onClick={() => void toggle(notice)}>{notice.enabled ? <EyeOff size={15} /> : <Eye size={15} />}{notice.enabled ? 'Hide notice' : 'Show notice'}</button><button disabled={busy} className="hs-notice-delete" aria-label={`Delete ${notice.topic || 'notice'}`} onClick={() => void remove(notice.id)}><Trash2 size={15} /> Delete</button></div></div>)}</div>}
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><DialogContent className="hs-notice-editor" data-admin-theme="light"><DialogHeader><DialogTitle>{editingId !== null ? 'Edit notice' : 'Create a notice'}</DialogTitle><DialogDescription>Choose your message and appearance. The preview uses the website design.</DialogDescription></DialogHeader>
      <fieldset disabled={busy} className="hs-notice-editor-fields"><label htmlFor="notice-topic">Title <small>(optional)</small></label><input id="notice-topic" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Delivery update" />
        <label htmlFor="notice-message">Message</label><textarea id="notice-message" rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="What would you like customers to know?" /><small>{form.message.length} characters · line breaks are preserved</small>
        <div className="hs-notice-field-grid"><label>Style<select aria-label="Style" value={form.style} onChange={e => setForm({ ...form, style: e.target.value })}><option value="info">Studio update · Violet</option><option value="success">Good news · Green</option><option value="warning">Please note · Amber</option><option value="urgent">Important · Rose</option>{!['info','success','warning','urgent'].includes(form.style) && <option value={form.style}>{form.style} (existing)</option>}</select></label><label>Placement<select aria-label="Placement" value={form.placement} onChange={e => setForm({ ...form, placement: e.target.value })}><option value="banner">Homepage banner</option><option value="popup">Homepage popup</option>{!['banner','popup'].includes(form.placement) && <option value={form.placement}>{form.placement} (existing)</option>}</select></label><label>Display order<input type="number" step="1" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label></div>
        <small>Lower numbers appear first. Dismissed notices stay hidden for that browser tab's session; changing their message shows them again.</small>
        <label className="hs-notice-enabled"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Show this notice on the homepage</label>
      </fieldset>
      <section className="hs-notice-preview" aria-label="Notice preview"><div className="hs-notice-preview-toolbar"><strong><Eye size={15} /> Live preview · {form.placement}</strong><label className="sr-only" htmlFor="notice-preview-size">Preview size</label><select id="notice-preview-size" value={previewWidth} onChange={e => setPreviewWidth(e.target.value)}><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></div><div style={{ maxWidth: previewWidth === 'mobile' ? 360 : undefined, margin: 'auto' }}>{form.placement === 'popup' ? <div className="hs-notice-preview-popup"><h3>A note from HAVESTORY</h3><NoticeCard notice={form} /><span className="hs-notice-primary">Got it, continue browsing</span></div> : <NoticeCard notice={form} />}</div></section>
      <DialogFooter><button disabled={busy} className="hs-notice-cancel" onClick={() => setOpen(false)}>Cancel</button><button className="hs-notice-primary" disabled={busy || !form.message.trim() || !Number.isSafeInteger(form.sortOrder)} onClick={() => void saveNotice()}><Save size={16} />{busy ? 'Saving…' : 'Save notice'}</button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
