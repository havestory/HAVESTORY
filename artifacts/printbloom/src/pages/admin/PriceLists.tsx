import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  List, Plus, Trash2, Edit2, Copy, Link2, MoreHorizontal,
  ExternalLink, RefreshCw, ToggleLeft, ToggleRight, PlusCircle, X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface PriceListSection {
  id: string;
  title: string;
  columns: string[];
  rows: Array<{ id: string; cells: string[] }>;
}

interface PriceList {
  id: number;
  publicId: string;
  title: string;
  subtitle: string;
  note: string;
  sections: PriceListSection[];
  active: boolean;
  staffVisible: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
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

function newSection(index: number): PriceListSection {
  return {
    id: `section-${Date.now()}-${index}`,
    title: `Price Table ${index + 1}`,
    columns: ['Item', 'Size', 'Price'],
    rows: [{ id: `row-${Date.now()}`, cells: ['', '', ''] }],
  };
}

function SectionEditor({ section, onChange, onRemove }: {
  section: PriceListSection;
  onChange: (s: PriceListSection) => void;
  onRemove: () => void;
}) {
  function addColumn() {
    const col = `Column ${section.columns.length + 1}`;
    onChange({
      ...section,
      columns: [...section.columns, col],
      rows: section.rows.map(r => ({ ...r, cells: [...r.cells, ''] })),
    });
  }

  function removeColumn(ci: number) {
    if (section.columns.length <= 1) return;
    onChange({
      ...section,
      columns: section.columns.filter((_, i) => i !== ci),
      rows: section.rows.map(r => ({ ...r, cells: r.cells.filter((_, i) => i !== ci) })),
    });
  }

  function updateColumn(ci: number, val: string) {
    const cols = [...section.columns];
    cols[ci] = val;
    onChange({ ...section, columns: cols });
  }

  function addRow() {
    onChange({
      ...section,
      rows: [...section.rows, { id: `row-${Date.now()}`, cells: section.columns.map(() => '') }],
    });
  }

  function removeRow(ri: number) {
    onChange({ ...section, rows: section.rows.filter((_, i) => i !== ri) });
  }

  function updateCell(ri: number, ci: number, val: string) {
    const rows = section.rows.map((r, rIdx) => {
      if (rIdx !== ri) return r;
      const cells = [...r.cells];
      cells[ci] = val;
      return { ...r, cells };
    });
    onChange({ ...section, rows });
  }

  const cellClass = 'h-8 text-xs rounded-none border border-border/50 bg-background px-2 focus-visible:ring-0 focus-visible:border-secondary';

  return (
    <div className="border border-border rounded-none mb-4">
      {/* Section header */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 border-b border-border">
        <Input
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
          className="h-8 text-sm font-semibold rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 flex-1"
          placeholder="Section title"
        />
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-none shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {section.columns.map((col, ci) => (
                <th key={ci} className="p-1">
                  <div className="flex items-center gap-1">
                    <Input
                      value={col}
                      onChange={e => updateColumn(ci, e.target.value)}
                      className={cellClass + ' font-semibold bg-muted/50'}
                    />
                    {section.columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(ci)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1 w-8" />
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, ri) => (
              <tr key={row.id}>
                {row.cells.map((cell, ci) => (
                  <td key={ci} className="p-1">
                    <Input
                      value={cell}
                      onChange={e => updateCell(ri, ci, e.target.value)}
                      className={cellClass}
                      placeholder="—"
                    />
                  </td>
                ))}
                <td className="p-1 w-8">
                  <button type="button" onClick={() => removeRow(ri)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex gap-2 mt-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="rounded-none border-border h-7 text-xs uppercase tracking-widest font-semibold gap-1">
            <PlusCircle className="w-3 h-3" /> Row
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addColumn} className="rounded-none border-border h-7 text-xs uppercase tracking-widest font-semibold gap-1">
            <PlusCircle className="w-3 h-3" /> Column
          </Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  note: '',
  active: true,
  staffVisible: true,
  expiresAt: '',
  sections: [newSection(0)] as PriceListSection[],
};

export default function PriceLists() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PriceList | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: lists = [], isLoading } = useQuery<PriceList[]>({
    queryKey: ['price-lists'],
    queryFn: () => apiFetch('/api/price-lists'),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch('/api/price-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); toast({ title: 'Price list created' }); setDialogOpen(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      apiFetch(`/api/price-lists/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); toast({ title: 'Price list updated' }); setDialogOpen(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/price-lists/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); toast({ title: 'Price list deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const regenMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/price-lists/${id}/regenerate-link`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-lists'] }); toast({ title: 'New share link generated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sections: [newSection(0)] });
    setDialogOpen(true);
  }

  function openEdit(pl: PriceList) {
    setEditing(pl);
    setForm({
      title: pl.title,
      subtitle: pl.subtitle,
      note: pl.note,
      active: pl.active,
      staffVisible: pl.staffVisible,
      expiresAt: pl.expiresAt ? pl.expiresAt.slice(0, 10) : '',
      sections: pl.sections.length > 0 ? pl.sections : [newSection(0)],
    });
    setDialogOpen(true);
  }

  function openDuplicate(pl: PriceList) {
    setEditing(null);
    setForm({
      title: `${pl.title} (Copy)`,
      subtitle: pl.subtitle,
      note: pl.note,
      active: pl.active,
      staffVisible: pl.staffVisible,
      expiresAt: pl.expiresAt ? pl.expiresAt.slice(0, 10) : '',
      sections: pl.sections,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: form.title || 'Untitled Price List',
      subtitle: form.subtitle,
      note: form.note,
      sections: form.sections,
      active: form.active,
      staffVisible: form.staffVisible,
      expiresAt: form.expiresAt || null,
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  }

  function copyShareLink(pl: PriceList) {
    const base = window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    navigator.clipboard.writeText(`${base}/price-list/${pl.publicId}`)
      .then(() => toast({ title: 'Share link copied!' }))
      .catch(() => toast({ title: 'Copy failed', variant: 'destructive' }));
  }

  function openShareLink(pl: PriceList) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    window.open(`${base}/price-list/${pl.publicId}`, '_blank');
  }

  const inputClass = 'rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 text-sm shadow-none h-9';
  const labelClass = 'text-[9px] uppercase tracking-widest font-semibold text-muted-foreground';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Price Lists</h1>
          <p className="text-muted-foreground mt-1">Create private shareable price lists for B2B clients.</p>
        </div>
        <Button onClick={openCreate} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 btn-glow uppercase text-xs tracking-widest px-5 h-9 font-semibold gap-2">
          <Plus className="w-4 h-4" /> New Price List
        </Button>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Sections</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Expires</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : lists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <List className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No price lists yet. Create one to share with B2B clients.</p>
                  </TableCell>
                </TableRow>
              ) : lists.map(pl => {
                const isExpired = pl.expiresAt && new Date(pl.expiresAt) < new Date();
                return (
                  <TableRow key={pl.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{pl.title}</p>
                        {pl.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{pl.subtitle}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{pl.sections.length} section{pl.sections.length !== 1 ? 's' : ''}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pl.expiresAt
                        ? <span className={isExpired ? 'text-destructive font-medium' : ''}>{new Date(pl.expiresAt).toLocaleDateString('en-GB')}</span>
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest ${pl.active && !isExpired ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {isExpired ? 'Expired' : pl.active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copyShareLink(pl)} className="h-8 w-8 rounded-none text-muted-foreground hover:text-foreground" title="Copy share link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openShareLink(pl)} className="h-8 w-8 rounded-none text-muted-foreground hover:text-foreground" title="Open share link">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                            <DropdownMenuItem onClick={() => openEdit(pl)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDuplicate(pl)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                              <Copy className="mr-2 h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => regenMut.mutate(pl.id)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                              <RefreshCw className="mr-2 h-4 w-4" /> Regenerate Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { if (confirm('Delete this price list?')) deleteMut.mutate(pl.id); }} className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:bg-destructive/10 focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-none border-border p-0 overflow-hidden bg-background max-w-4xl max-h-[90vh] flex flex-col">
          <div className="p-6 bg-primary text-primary-foreground shrink-0">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-bold text-white">
                {editing ? 'Edit Price List' : 'New Price List'}
              </DialogTitle>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Title *</Label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Wholesale Price List 2024" className={inputClass} required />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Subtitle / Client Name</Label>
                  <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="For ABC Interiors" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Validity / Expiry Date</Label>
                  <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className={inputClass} />
                </div>
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label className={labelClass}>Active (visible via share link)</Label>
                    <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className={labelClass}>Visible to Staff</Label>
                    <Switch checked={form.staffVisible} onCheckedChange={v => setForm(f => ({ ...f, staffVisible: v }))} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Notes / Footer Message</Label>
                <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Prices valid until end of quarter. Minimum order Rs. 5,000." className={inputClass} />
              </div>

              {/* Sections */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={labelClass}>Price Tables</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm(f => ({ ...f, sections: [...f.sections, newSection(f.sections.length)] }))}
                    className="rounded-none border-border h-7 text-xs uppercase tracking-widest font-semibold gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Table
                  </Button>
                </div>
                {form.sections.map((section, i) => (
                  <SectionEditor
                    key={section.id}
                    section={section}
                    onChange={s => setForm(f => ({ ...f, sections: f.sections.map((sec, idx) => idx === i ? s : sec) }))}
                    onRemove={() => {
                      if (form.sections.length <= 1) return;
                      setForm(f => ({ ...f, sections: f.sections.filter((_, idx) => idx !== i) }));
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="shrink-0 p-6 border-t border-border flex gap-3 justify-end bg-background">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-none border-border h-10 font-bold uppercase tracking-widest text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending}
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-bold uppercase tracking-widest text-xs px-8"
              >
                {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Price List'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
