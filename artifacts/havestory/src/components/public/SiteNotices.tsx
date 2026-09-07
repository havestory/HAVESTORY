import { useState } from 'react';
import { Bell, CircleCheck, TriangleAlert, Megaphone, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import './site-notices.css';

export type SiteNotice = { id: number; message: string; topic?: string | null; imageUrl?: string | null; style?: string; placement?: string; enabled?: boolean; sortOrder?: number; updatedAt?: string };
const themes = {
  info: { label: 'Studio update', Icon: Bell },
  success: { label: 'Good news', Icon: CircleCheck },
  warning: { label: 'Please note', Icon: TriangleAlert },
  urgent: { label: 'Important update', Icon: Megaphone },
};
export function NoticeCard({ notice, onDismiss }: { notice: Pick<SiteNotice, 'message' | 'style' | 'topic'>; onDismiss?: () => void }) {
  const style = notice.style && notice.style in themes ? notice.style as keyof typeof themes : 'info';
  const { label, Icon } = themes[style];
  return <article className="hs-notice-card" data-tone={style}>
    <span className="hs-notice-icon"><Icon size={20} aria-hidden="true" /></span>
    <div className="hs-notice-copy"><strong>{notice.topic?.trim() || label}</strong><p>{notice.message || 'Your announcement will appear here.'}</p></div>
    {onDismiss && <button type="button" className="hs-notice-dismiss" aria-label={`Dismiss ${notice.topic?.trim() || label}`} onClick={onDismiss}><X size={18} /></button>}
  </article>;
}
// A changed message is shown again; dismissal lasts for this browser tab's session.
const version = (n: SiteNotice) => JSON.stringify([n.id, n.message, n.topic, n.style, n.placement]);
export function SiteNotices({ notices }: { notices: SiteNotice[] }) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('havestory.notice-dismissals') || '[]'); return Array.isArray(saved) ? saved.filter(v => typeof v === 'string') : []; } catch { return []; }
  });
  const active = notices.filter(n => n.enabled && n.message?.trim() && !dismissed.includes(version(n))).sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);
  const dismiss = (notice: SiteNotice) => setDismissed(old => {
    const next = [...old, version(notice)].slice(-100);
    try { sessionStorage.setItem('havestory.notice-dismissals', JSON.stringify(next)); } catch { /* Session storage may be unavailable. */ }
    return next;
  });
  const popup = active.find(n => n.placement === 'popup');
  return <>
    {!!active.filter(n => n.placement !== 'popup').length && <section className="hs-notice-stack" aria-label="Studio announcements">{active.filter(n => n.placement !== 'popup').map(notice => <NoticeCard key={notice.id} notice={notice} onDismiss={() => dismiss(notice)} />)}</section>}
    <Dialog open={!!popup} onOpenChange={open => { if (!open && popup) dismiss(popup); }}>
      {popup && <DialogContent className="hs-notice-popup"><DialogTitle className="hs-notice-popup-title">A note from HAVESTORY</DialogTitle><DialogDescription className="sr-only">Studio announcement</DialogDescription><NoticeCard notice={popup} /><button className="hs-notice-primary" onClick={() => dismiss(popup)}>Got it, continue browsing</button></DialogContent>}
    </Dialog>
  </>;
}
