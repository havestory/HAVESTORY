import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, MoreHorizontal, Edit2, Trash2, RefreshCw,
  Shield, ShieldCheck, ShieldOff, Link as LinkIcon, Copy,
  Check, Eye, EyeOff, UserCheck, UserX
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useGetAdminMe } from '@workspace/api-client-react';
import { Link } from 'wouter';

// ─── types ──────────────────────────────────────────────────────────────────

interface StaffMember {
  id: number;
  name: string;
  username: string;
  permissions: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'orders',          label: 'Orders' },
  { key: 'customers',       label: 'Clients' },
  { key: 'invoices',        label: 'Invoices' },
  { key: 'shipping',        label: 'Shipping' },
  { key: 'catalog',         label: 'Catalog' },
  { key: 'products_view',   label: 'Products (view)' },
  { key: 'price_lists_view',label: 'Price Lists (view)' },
  { key: 'inventory',       label: 'Inventory' },
  { key: 'production',      label: 'Production' },
  { key: 'website',         label: 'Website' },
  { key: 'finance',         label: 'Finance' },
  { key: 'reports',         label: 'Reports' },
];

const POS_PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'pos_access', label: 'Use POS / Counter Sales', description: 'View the POS, add items and collect payments.' },
  { key: 'pos_day_start', label: 'Start POS Day', description: 'Enter the opening float and open the counter.' },
  { key: 'pos_day_close', label: 'Close POS Day', description: 'Count the drawer and close the business day.' },
];

const ALL_PERMISSIONS = [...PERMISSIONS, ...POS_PERMISSIONS];

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PermissionBadges({ perms }: { perms: string[] }) {
  const labels = perms.map(p => ALL_PERMISSIONS.find(x => x.key === p)?.label ?? p);
  if (!labels.length) return <span className="text-muted-foreground text-xs">No permissions</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map(l => (
        <span key={l} className="px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/20">
          {l}
        </span>
      ))}
    </div>
  );
}

// ─── Create / Edit Dialog ────────────────────────────────────────────────────

function StaffDialog({
  open, onClose, existing, onSaved
}: {
  open: boolean;
  onClose: () => void;
  existing: StaffMember | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? '');
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [active, setActive] = useState(existing?.active ?? true);
  const [perms, setPerms] = useState<string[]>(existing?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  // reset on open
  if (!open) return null;

  function togglePerm(key: string) {
    setPerms(current => {
      if (current.includes(key)) {
        if (key === 'pos_access') {
          return current.filter(x => !['pos_access', 'pos_day_start', 'pos_day_close'].includes(x));
        }
        return current.filter(x => x !== key);
      }
      if (key === 'pos_day_start' || key === 'pos_day_close') {
        return Array.from(new Set([...current, 'pos_access', key]));
      }
      return [...current, key];
    });
  }

  async function handleSave() {
    if (!name.trim() || username.trim().length < 3) {
      toast({ title: 'Name and username (3+ chars) are required', variant: 'destructive' }); return;
    }
    if (!isEdit && password.length < 10) {
      toast({ title: 'Password must be at least 10 characters', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/admin/team/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username, permissions: perms, active }),
        });
        toast({ title: 'Staff account updated' });
      } else {
        await apiFetch('/api/admin/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username, password, permissions: perms }),
        });
        toast({ title: 'Staff account created' });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-none max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? 'Edit Staff Account' : 'Create Staff Account'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="rounded-none" placeholder="e.g. Saman Perera" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Username</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} className="rounded-none font-mono" placeholder="saman.perera" />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Password <span className="text-muted-foreground">(min 10 chars)</span></Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="rounded-none pr-10"
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-3">
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={v => setActive(!!v)}
                className="rounded-none"
              />
              <Label htmlFor="active" className="text-sm cursor-pointer">Account active</Label>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">General Permissions</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border border-border">
              {PERMISSIONS.map(p => (
                <div key={p.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${p.key}`}
                    checked={perms.includes(p.key)}
                    onCheckedChange={() => togglePerm(p.key)}
                    className="rounded-none"
                  />
                  <Label htmlFor={`perm-${p.key}`} className="text-sm cursor-pointer">{p.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div>
              <Label className="text-xs uppercase tracking-wider">POS / Counter Sales</Label>
              <p className="mt-1 text-xs text-muted-foreground">Choose exactly what this team member may do at the counter. Reopening a closed day always remains owner-only.</p>
            </div>
            <div className="space-y-2 border border-border bg-muted/30 p-3">
              {POS_PERMISSIONS.map(p => (
                <div key={p.key} className="flex items-start gap-2.5 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <Checkbox
                    id={`perm-${p.key}`}
                    checked={perms.includes(p.key)}
                    onCheckedChange={() => togglePerm(p.key)}
                    className="mt-0.5 rounded-none"
                  />
                  <Label htmlFor={`perm-${p.key}`} className="cursor-pointer">
                    <span className="block text-sm font-medium text-foreground">{p.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{p.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-none">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs tracking-widest px-6"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ───────────────────────────────────────────────────

function ResetPasswordDialog({ staffId, name, open, onClose }: {
  staffId: number; name: string; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleReset() {
    if (password.length < 10) {
      toast({ title: 'Password must be at least 10 characters', variant: 'destructive' }); return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/team/${staffId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      toast({ title: `Password reset for ${name}` });
      setPassword(''); setConfirm('');
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
          <DialogTitle className="font-serif text-xl">Reset Password</DialogTitle>
          <p className="text-sm text-muted-foreground">Setting new password for <span className="font-medium text-foreground">{name}</span></p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">New Password</Label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="rounded-none pr-10"
                placeholder="••••••••••"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Confirm Password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="rounded-none"
              placeholder="••••••••••"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-none">Cancel</Button>
          <Button
            onClick={handleReset}
            disabled={saving}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 uppercase text-xs tracking-widest px-6"
          >
            {saving ? 'Saving…' : 'Reset Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Team() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetAdminMe();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [verifyLinks, setVerifyLinks] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['team'],
    queryFn: () => apiFetch('/api/admin/team'),
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['team'] });

  const toggleActive = useMutation({
    mutationFn: ({ id, active, member }: { id: number; active: boolean; member: StaffMember }) =>
      apiFetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: member.name,
          username: member.username,
          permissions: member.permissions,
          active,
        }),
      }),
    onSuccess: () => { toast({ title: 'Status updated' }); refetch(); },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteStaff = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/admin/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast({ title: 'Staff account deleted' }); refetch(); },
    onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
  });

  async function generateVerifyLink(staffId: number) {
    try {
      const data = await apiFetch<{ path: string }>(`/api/admin/staff/${staffId}/verification-link`, { method: 'POST' });
      const fullUrl = `${window.location.origin}${data.path}`;
      setVerifyLinks(prev => ({ ...prev, [staffId]: fullUrl }));
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    }
  }

  function copyLink(staffId: number, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(staffId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleDelete(member: StaffMember) {
    if (confirm(`Delete ${member.name} (@${member.username})? This cannot be undone.`)) {
      deleteStaff.mutate(member.id);
    }
  }

  if (me?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ShieldOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Owner access required to manage team accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Team Access</h1>
          <p className="text-muted-foreground mt-1">Manage staff accounts and permissions.</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Staff Member</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Permissions</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Last Login</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No staff accounts yet. Create one to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map(member => (
                  <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">@{member.username}</div>
                      {/* Verification link */}
                      {verifyLinks[member.id] && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-muted/50 border border-border">
                          <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                            {verifyLinks[member.id]}
                          </span>
                          <button
                            onClick={() => copyLink(member.id, verifyLinks[member.id])}
                            className="shrink-0 text-primary hover:text-primary/80"
                          >
                            {copiedId === member.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell><PermissionBadges perms={member.permissions} /></TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest ${member.active ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-500'}`}>
                        {member.active ? 'Active' : 'Paused'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{fmtDate(member.last_login_at)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md w-52">
                          <DropdownMenuItem onClick={() => setEditTarget(member)} className="cursor-pointer gap-2">
                            <Edit2 className="w-3.5 h-3.5" /> Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetTarget(member)} className="cursor-pointer gap-2">
                            <RefreshCw className="w-3.5 h-3.5" /> Reset Password
                          </DropdownMenuItem>
                          <Link href={`/admin/team/${member.id}/profile`}>
                            <DropdownMenuItem className="cursor-pointer gap-2">
                              <Shield className="w-3.5 h-3.5" /> Staff Profile / CV
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => generateVerifyLink(member.id)} className="cursor-pointer gap-2">
                            <LinkIcon className="w-3.5 h-3.5" /> Generate ID Verify Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => toggleActive.mutate({ id: member.id, active: !member.active, member })}
                            className="cursor-pointer gap-2"
                          >
                            {member.active
                              ? <><UserX className="w-3.5 h-3.5" /> Pause Account</>
                              : <><UserCheck className="w-3.5 h-3.5" /> Activate Account</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(member)}
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Account
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

      {/* Activity Log shortcut */}
      <p className="text-xs text-muted-foreground">
        Staff activity is logged automatically.{' '}
        <Link href="/admin/settings" className="underline underline-offset-2 hover:text-foreground">
          View in Settings →
        </Link>
      </p>

      <StaffDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existing={null}
        onSaved={refetch}
      />
      <StaffDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        existing={editTarget}
        onSaved={refetch}
      />
      <ResetPasswordDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        staffId={resetTarget?.id ?? 0}
        name={resetTarget?.name ?? ''}
      />
    </div>
  );
}
