import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag, Plus, Trash2, MoreHorizontal, Edit2, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { AdminTableError, AdminTableLoading } from '@/components/admin/AdminPageState';

interface Coupon {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: number;
  expiresAt: string | null;
  createdAt: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

type CouponForm = { code: string; type: 'percentage' | 'fixed'; value: string; minOrder: string; maxUses: string; expiresAt: string };
const EMPTY_FORM: CouponForm = { code: '', type: 'percentage', value: '', minOrder: '', maxUses: '', expiresAt: '' };

export default function Coupons() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: coupons = [], isLoading, isError, refetch } = useQuery<Coupon[]>({
    queryKey: ['coupons'],
    queryFn: () => apiFetch('/api/coupons'),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast({ title: 'Coupon created' }); setDialogOpen(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      apiFetch(`/api/coupons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast({ title: 'Coupon updated' }); setDialogOpen(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/coupons/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast({ title: 'Coupon deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrder: c.minOrder != null ? String(c.minOrder) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: parseFloat(form.value),
      minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    };
    if (!body.code || isNaN(body.value)) return;
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  }

  function toggleActive(c: Coupon) {
    updateMut.mutate({ id: c.id, body: { isActive: c.isActive ? 0 : 1 } });
  }

  function handleDelete(id: number) {
    if (confirm('Delete this coupon permanently?')) deleteMut.mutate(id);
  }

  const inputClass = 'rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-sm shadow-none h-9';
  const labelClass = 'text-[9px] uppercase tracking-widest font-semibold text-muted-foreground';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Coupons</h1>
          <p className="text-muted-foreground mt-1">Create and manage discount codes for customers.</p>
        </div>
        <Button onClick={openCreate} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold gap-2">
          <Plus className="w-4 h-4" /> New Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Coupons', value: coupons.length },
          { label: 'Active', value: coupons.filter(c => c.isActive).length },
          { label: 'Total Uses', value: coupons.reduce((a, c) => a + c.usedCount, 0) },
          { label: 'Expired', value: coupons.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date()).length },
        ].map(s => (
          <Card key={s.label} className="rounded-none border border-border bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{s.label}</p>
              <p className="text-2xl font-bold font-mono text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Code</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type / Value</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Min. Order</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Usage</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Expires</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <AdminTableLoading columns={7} />
              ) : isError ? (
                <AdminTableError columns={7} onRetry={() => void refetch()} />
              ) : coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Tag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No coupons yet. Create your first discount code.</p>
                  </TableCell>
                </TableRow>
              ) : coupons.map(c => {
                const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                const isExhausted = c.maxUses != null && c.usedCount >= c.maxUses;
                return (
                  <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <span className="font-mono font-bold text-sm tracking-widest text-foreground">{c.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {c.type === 'percentage' ? `${c.value}% off` : `Rs. ${c.value.toLocaleString('en-IN')} off`}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.minOrder ? `Rs. ${c.minOrder.toLocaleString('en-IN')}` : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.expiresAt
                        ? <span className={isExpired ? 'text-destructive font-medium' : ''}>{new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {isExpired || isExhausted ? (
                        <span className="px-2 py-1 text-[9px] uppercase font-bold tracking-widest bg-muted text-muted-foreground">
                          {isExpired ? 'Expired' : 'Exhausted'}
                        </span>
                      ) : c.isActive ? (
                        <span className="px-2 py-1 text-[9px] uppercase font-bold tracking-widest bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[9px] uppercase font-bold tracking-widest bg-muted text-muted-foreground flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                          <DropdownMenuItem onClick={() => openEdit(c)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                            <Edit2 className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(c)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                            {c.isActive ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(c.id)} className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-none border-border p-0 overflow-hidden bg-background sm:max-w-[500px]">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">
                {editing ? 'Edit Coupon' : 'New Coupon'}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={labelClass}>Coupon Code *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="SAVE20"
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Type *</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="rounded-none border-0 border-b-2 border-border focus:ring-0 h-9 px-0 bg-transparent shadow-none text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Rs.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={labelClass}>{form.type === 'percentage' ? 'Discount (%)' : 'Discount Amount (Rs.)'} *</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={form.type === 'percentage' ? '20' : '500'}
                  min="0"
                  step={form.type === 'percentage' ? '0.1' : '1'}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Min. Order Value (Rs.)</Label>
                <Input
                  type="number"
                  value={form.minOrder}
                  onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))}
                  placeholder="Optional"
                  min="0"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={labelClass}>Max Uses (leave blank for unlimited)</Label>
                <Input
                  type="number"
                  value={form.maxUses}
                  onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                  placeholder="Unlimited"
                  min="1"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-none border-border h-10 font-bold uppercase tracking-widest text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending}
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-bold uppercase tracking-widest text-xs px-8"
              >
                {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Coupon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
