import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, CheckCircle2, XCircle, Calendar, Users,
  ChevronLeft, ChevronRight, Printer, Filter,
  LogIn, LogOut, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useGetAdminMe } from '@workspace/api-client-react';

// ─── types ──────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: number;
  staff_id: number;
  staff_name: string;
  username: string;
  attendance_date: string;
  check_in_at: string;
  check_out_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  owner_note: string | null;
  early_checkout: boolean;
  checkout_note: string | null;
  decided_at: string | null;
  duration_minutes: number | null;
}

interface PendingRecord {
  id: number;
  staff_name: string;
  username: string;
  attendance_date: string;
  check_in_at: string;
}

interface AttendanceResponse {
  month: string;
  role: string;
  today: string;
  records: AttendanceRecord[];
}

interface StaffMember {
  id: number;
  name: string;
  username: string;
  active: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function currentYYYYMM() {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtTime(dt: string | null | undefined) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function minutesToHours(mins: number | null | undefined) {
  if (!mins) return '0h 0m';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function daysInMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-widest ${styles[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

// ─── Decision Dialog ─────────────────────────────────────────────────────────

function DecisionDialog({ record, open, onClose, onDone }: {
  record: PendingRecord | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open || !record) return null;

  async function decide(status: 'approved' | 'rejected') {
    if (status === 'rejected' && !note.trim()) {
      toast({ title: 'Please add a reason for rejecting', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/attendance/${record!.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      });
      toast({ title: `Attendance ${status}` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-none max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Review Attendance</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{record.staff_name}</span> — {fmtDate(record.attendance_date)}
          </p>
          <p className="text-xs text-muted-foreground">Checked in at {fmtTime(record.check_in_at)}</p>
        </DialogHeader>
        <div className="py-2 space-y-1.5">
          <Label className="text-xs uppercase tracking-wider">Note <span className="text-muted-foreground">(required for rejection)</span></Label>
          <Input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="rounded-none"
            placeholder="Add a note…"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-none">Cancel</Button>
          <Button
            variant="outline"
            onClick={() => decide('rejected')}
            disabled={saving}
            className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
          <Button
            onClick={() => decide('approved')}
            disabled={saving}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Check-out Dialog (for staff self) ──────────────────────────────────────

function CheckoutDialog({ record, open, onClose, onDone }: {
  record: AttendanceRecord | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [early, setEarly] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open || !record) return null;

  async function handleCheckout() {
    if (early && !note.trim()) {
      toast({ title: 'Please add a reason for early checkout', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/attendance/${record!.id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ earlyCheckout: early, note }),
      });
      toast({ title: 'Checked out successfully' });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-none max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Check Out</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="early"
              checked={early}
              onChange={e => setEarly(e.target.checked)}
              className="rounded-none"
            />
            <Label htmlFor="early" className="text-sm cursor-pointer">Early checkout</Label>
          </div>
          {early && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Reason</Label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                className="rounded-none"
                placeholder="Reason for early checkout…"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-none">Cancel</Button>
          <Button
            onClick={handleCheckout}
            disabled={saving}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs tracking-widest px-6"
          >
            {saving ? 'Saving…' : 'Check Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monthly Calendar ─────────────────────────────────────────────────────────

function CalendarView({ records, month, staffList, staffFilter }: {
  records: AttendanceRecord[];
  month: string;
  staffList: StaffMember[];
  staffFilter: string;
}) {
  const days = daysInMonth(month);
  const [y, m] = month.split('-').map(Number);

  // Group records by staff_id → date
  const byStaff: Record<number, Record<string, AttendanceRecord>> = {};
  for (const r of records) {
    if (!byStaff[r.staff_id]) byStaff[r.staff_id] = {};
    byStaff[r.staff_id][r.attendance_date] = r;
  }

  const filteredStaff = staffFilter === 'all'
    ? staffList
    : staffList.filter(s => String(s.id) === staffFilter);

  // Status color mapping
  const statusColor: Record<string, string> = {
    approved: 'bg-green-500',
    pending:  'bg-amber-400',
    rejected: 'bg-red-400',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 bg-muted/50 border border-border font-semibold text-muted-foreground uppercase tracking-wider w-32">
              Staff
            </th>
            {Array.from({ length: days }, (_, i) => (
              <th key={i} className="px-1 py-2 bg-muted/50 border border-border text-center text-muted-foreground font-medium w-8">
                {i + 1}
              </th>
            ))}
            <th className="px-3 py-2 bg-muted/50 border border-border text-right text-muted-foreground font-semibold uppercase tracking-wider">
              Hours
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredStaff.length === 0 ? (
            <tr>
              <td colSpan={days + 2} className="text-center py-8 text-muted-foreground">No staff to display.</td>
            </tr>
          ) : filteredStaff.map(s => {
            const sRecords = byStaff[s.id] ?? {};
            const totalMins = Object.values(sRecords).reduce((sum, r) =>
              r.status === 'approved' && r.duration_minutes ? sum + r.duration_minutes : sum, 0);
            return (
              <tr key={s.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 border border-border font-medium">
                  <div>{s.name}</div>
                  <div className="text-muted-foreground font-mono">@{s.username}</div>
                </td>
                {Array.from({ length: days }, (_, i) => {
                  const dd = String(i + 1).padStart(2, '0');
                  const dateKey = `${y}-${String(m).padStart(2, '0')}-${dd}`;
                  const rec = sRecords[dateKey];
                  return (
                    <td key={i} className="border border-border text-center p-1">
                      {rec ? (
                        <div
                          className={`w-5 h-5 rounded-full mx-auto ${statusColor[rec.status] ?? 'bg-muted'}`}
                          title={`${rec.status} — in: ${fmtTime(rec.check_in_at)}${rec.check_out_at ? ` out: ${fmtTime(rec.check_out_at)}` : ''}`}
                        />
                      ) : (
                        <div className="w-5 h-5 mx-auto" />
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 border border-border text-right font-medium text-primary">
                  {minutesToHours(totalMins)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Approved</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Rejected</span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Attendance() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetAdminMe();
  const isOwner = me?.role === 'owner';

  const [month, setMonth] = useState(currentYYYYMM);
  const [staffFilter, setStaffFilter] = useState('all');
  const [tab, setTab] = useState<'queue' | 'calendar' | 'records'>('calendar');
  const [decisionTarget, setDecisionTarget] = useState<PendingRecord | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<AttendanceRecord | null>(null);

  const { data: attendanceData, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ['attendance', month],
    queryFn: () => apiFetch(`/api/admin/attendance?month=${month}`),
  });

  const { data: pending = [], refetch: refetchPending } = useQuery<PendingRecord[]>({
    queryKey: ['attendance-pending'],
    queryFn: () => apiFetch('/api/admin/attendance-pending'),
    enabled: isOwner,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ['team'],
    queryFn: () => apiFetch('/api/admin/team'),
    enabled: isOwner,
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['attendance'] });
    qc.invalidateQueries({ queryKey: ['attendance-pending'] });
  };

  const checkIn = useMutation({
    mutationFn: () => apiFetch('/api/admin/attendance/check-in', { method: 'POST' }),
    onSuccess: () => { toast({ title: 'Check-in request submitted' }); refetch(); },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const records = attendanceData?.records ?? [];
  const today = attendanceData?.today;

  // Find today's record for staff self-service
  const myRecord = !isOwner
    ? records.find(r => r.attendance_date === today)
    : null;

  // Summary by staff
  const summaryByStaff = records.reduce<Record<number, { name: string; username: string; total: number; days: number }>>((acc, r) => {
    if (!acc[r.staff_id]) acc[r.staff_id] = { name: r.staff_name, username: r.username, total: 0, days: 0 };
    if (r.status === 'approved') {
      acc[r.staff_id].total += r.duration_minutes ?? 0;
      acc[r.staff_id].days += 1;
    }
    return acc;
  }, {});

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 print:space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">
            {isOwner ? 'Manage staff attendance and approvals.' : 'Your attendance records.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="rounded-none gap-1.5 text-xs uppercase tracking-wider"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          {isOwner && pending.length > 0 && (
            <span className="px-2 py-1 text-[9px] bg-amber-100 text-amber-800 font-bold uppercase tracking-widest">
              {pending.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Staff Self-Service Card */}
      {!isOwner && (
        <Card className="rounded-none border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Today's Attendance</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {myRecord
                    ? `Checked in at ${fmtTime(myRecord.check_in_at)} — ${myRecord.status}`
                    : 'Not checked in yet'}
                </p>
              </div>
              <div className="flex gap-2">
                {!myRecord || myRecord.status === 'rejected' ? (
                  <Button
                    onClick={() => checkIn.mutate()}
                    disabled={checkIn.isPending}
                    className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs uppercase tracking-wider px-4"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Check In
                  </Button>
                ) : myRecord.check_out_at === null && (myRecord.status === 'approved' || myRecord.status === 'pending') ? (
                  <Button
                    onClick={() => setCheckoutTarget(myRecord)}
                    variant="outline"
                    className="rounded-none gap-1.5 text-xs uppercase tracking-wider px-4"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Check Out
                  </Button>
                ) : null}
              </div>
            </div>
            {myRecord && (
              <div className="mt-2">
                <StatusBadge status={myRecord.status} />
                {myRecord.owner_note && (
                  <p className="text-xs text-muted-foreground mt-1">Owner note: {myRecord.owner_note}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between print:hidden flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-none h-8 w-8" onClick={() => setMonth(prevMonth)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">{monthLabel(month)}</span>
          <Button variant="outline" size="icon" className="rounded-none h-8 w-8" onClick={() => setMonth(nextMonth)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="rounded-none h-8 w-44 text-xs">
                <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">All Staff</SelectItem>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isOwner && (
            <div className="flex rounded-none border border-border overflow-hidden text-xs">
              {(['calendar', 'queue', 'records'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 uppercase tracking-wider font-semibold transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {t === 'queue' ? `Queue${pending.length ? ` (${pending.length})` : ''}` : t === 'calendar' ? 'Calendar' : 'Records'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Queue (owner only) */}
      {isOwner && tab === 'queue' && (
        <Card className="rounded-none border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="admin-table">
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow className="hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Staff</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Check In</TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <CheckCircle2 className="w-8 h-8 text-green-500/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No pending approvals.</p>
                    </TableCell>
                  </TableRow>
                ) : pending.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="font-medium">{p.staff_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">@{p.username}</div>
                    </TableCell>
                    <TableCell>{fmtDate(p.attendance_date)}</TableCell>
                    <TableCell className="font-mono">{fmtTime(p.check_in_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none h-7 text-xs"
                        onClick={() => setDecisionTarget(p)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Calendar view (owner) */}
      {(!isOwner || tab === 'calendar') && (
        <Card className="rounded-none border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {monthLabel(month)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading…</p>
            ) : (
              <CalendarView
                records={staffFilter === 'all' ? records : records.filter(r => String(r.staff_id) === staffFilter)}
                month={month}
                staffList={isOwner ? staffList : []}
                staffFilter={staffFilter}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly Summary */}
      {isOwner && tab === 'calendar' && Object.keys(summaryByStaff).length > 0 && (
        <Card className="rounded-none border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Clock className="w-4 h-4" /> Monthly Hours Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="admin-table">
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow className="hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Staff</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Days</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(summaryByStaff)
                  .filter(([, v]) => staffFilter === 'all' || staffList.find(s => String(s.id) === staffFilter && s.name === v.name))
                  .map(([id, v]) => (
                  <TableRow key={id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">@{v.username}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{v.days}</TableCell>
                    <TableCell className="text-right font-medium text-primary">{minutesToHours(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      {(isOwner ? tab === 'records' : true) && (
        <Card className="rounded-none border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg">Attendance Records — {monthLabel(month)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="admin-table">
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow className="hover:bg-muted/50">
                  {isOwner && <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Staff</TableHead>}
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Check In</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Check Out</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Duration</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  {!isOwner && <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : (staffFilter === 'all' ? records : records.filter(r => String(r.staff_id) === staffFilter)).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No attendance records for this month.</p>
                    </TableCell>
                  </TableRow>
                ) : (staffFilter === 'all' ? records : records.filter(r => String(r.staff_id) === staffFilter)).map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                    {isOwner && (
                      <TableCell>
                        <div className="font-medium">{r.staff_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">@{r.username}</div>
                      </TableCell>
                    )}
                    <TableCell>{fmtDate(r.attendance_date)}</TableCell>
                    <TableCell className="font-mono text-sm">{fmtTime(r.check_in_at)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {fmtTime(r.check_out_at)}
                      {r.early_checkout && <span className="ml-1 text-[9px] text-amber-600 font-bold uppercase">Early</span>}
                    </TableCell>
                    <TableCell className="text-sm">{minutesToHours(r.duration_minutes)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.owner_note && <p className="text-xs text-muted-foreground mt-0.5 max-w-[180px] truncate">{r.owner_note}</p>}
                    </TableCell>
                    {!isOwner && (
                      <TableCell>
                        {r.check_out_at === null && (r.status === 'approved' || r.status === 'pending') && r.attendance_date === today ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-none h-7 text-xs gap-1"
                            onClick={() => setCheckoutTarget(r)}
                          >
                            <LogOut className="w-3 h-3" /> Check Out
                          </Button>
                        ) : null}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DecisionDialog
        record={decisionTarget}
        open={!!decisionTarget}
        onClose={() => setDecisionTarget(null)}
        onDone={refetch}
      />
      <CheckoutDialog
        record={checkoutTarget}
        open={!!checkoutTarget}
        onClose={() => setCheckoutTarget(null)}
        onDone={refetch}
      />
    </div>
  );
}
