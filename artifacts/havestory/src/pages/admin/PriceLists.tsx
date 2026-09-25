import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  List, Plus, Trash2, Edit2, Copy, Link2, MoreHorizontal,
  ExternalLink, RefreshCw, ToggleLeft, ToggleRight, PlusCircle, X,
  GripVertical, Eye, EyeOff, ArrowLeft, ArrowRight, ArrowUp, ArrowDown
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
  visibleColumns?: boolean[];
  rows: Array<{ id: string; cells: string[] }>;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

type DragItem = { kind: 'section' | 'column' | 'row'; sectionId: string; index: number };
function readDrag(event: React.DragEvent): DragItem | null {
  try {
    const item = JSON.parse(event.dataTransfer.getData('application/x-havestory-price-list'));
    return ['section', 'column', 'row'].includes(item.kind) && Number.isInteger(item.index) ? item : null;
  } catch { return null; }
}
function startDrag(event: React.DragEvent, item: DragItem) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-havestory-price-list', JSON.stringify(item));
}

interface PriceList {
  id: number;
  publicId: string;
  title: string;
  subtitle: string;
  note: string;
  offerPercent: number;
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

function editorId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSection(index: number): PriceListSection {
  return {
    id: editorId('section'),
    title: `Price Table ${index + 1}`,
    columns: ['Item', 'Size', 'Price'],
    visibleColumns: [true, true, true],
    rows: [{ id: editorId('row'), cells: ['', '', ''] }],
  };
}

function cloneSection(section: PriceListSection, titleSuffix = ''): PriceListSection {
  return {
    ...section,
    id: editorId('section'),
    title: titleSuffix ? `${section.title} ${titleSuffix}` : section.title,
    columns: [...section.columns],
    visibleColumns: [...(section.visibleColumns || section.columns.map(() => true))],
    rows: section.rows.map(row => ({ ...row, id: editorId('row'), cells: [...row.cells] })),
  };
}

function SectionEditor({ section, index, onChange, onRemove, onDuplicate, onMove, onDropSection }: {
  section: PriceListSection;
  index: number;
  onChange: (s: PriceListSection) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: number) => void;
  onDropSection: (source: DragItem) => void;
}) {
  const visibility = section.columns.map((_, i) => section.visibleColumns?.[i] !== false);
  function moveColumn(from: number, to: number) {
    onChange({ ...section, columns: moveItem(section.columns, from, to),
      visibleColumns: moveItem(visibility, from, to),
      rows: section.rows.map(row => ({ ...row, cells: moveItem(row.cells, from, to) })) });
  }
  function moveRow(from: number, to: number) {
    onChange({ ...section, rows: moveItem(section.rows, from, to) });
  }
  function toggleColumn(ci: number) {
    if (visibility[ci] && visibility.filter(Boolean).length === 1) return;
    const next = [...visibility];
    next[ci] = !next[ci];
    onChange({ ...section, visibleColumns: next });
  }
  function addColumn() {
    const col = `Column ${section.columns.length + 1}`;
    onChange({
      ...section,
      columns: [...section.columns, col],
      visibleColumns: [...visibility, true],
      rows: section.rows.map(r => ({ ...r, cells: [...r.cells, ''] })),
    });
  }

  function duplicateColumn(ci: number) {
    const source = section.columns[ci] || `Column ${ci + 1}`;
    onChange({
      ...section,
      columns: [
        ...section.columns.slice(0, ci + 1),
        `${source} Copy`,
        ...section.columns.slice(ci + 1),
      ],
      visibleColumns: [...visibility.slice(0, ci + 1), visibility[ci], ...visibility.slice(ci + 1)],
      rows: section.rows.map(row => ({
        ...row,
        cells: [
          ...row.cells.slice(0, ci + 1),
          row.cells[ci] ?? '',
          ...row.cells.slice(ci + 1),
        ],
      })),
    });
  }

  function removeColumn(ci: number) {
    if (section.columns.length <= 1) return;
    onChange({
      ...section,
      columns: section.columns.filter((_, i) => i !== ci),
      visibleColumns: visibility.filter((_, i) => i !== ci),
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
      rows: [...section.rows, { id: editorId('row'), cells: section.columns.map(() => '') }],
    });
  }

  function removeRow(ri: number) {
    onChange({ ...section, rows: section.rows.filter((_, i) => i !== ri) });
  }

  function duplicateRow(ri: number) {
    const source = section.rows[ri];
    if (!source) return;
    const copy = { ...source, id: editorId('row'), cells: [...source.cells] };
    onChange({
      ...section,
      rows: [...section.rows.slice(0, ri + 1), copy, ...section.rows.slice(ri + 1)],
    });
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
    <div className="border border-border rounded-xl mb-4 bg-card overflow-hidden"
      onDragOver={event => event.preventDefault()}
      onDrop={event => { const source = readDrag(event); if (source?.kind === 'section') { event.preventDefault(); onDropSection(source); } }}>
      {/* Section header */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 border-b border-border">
        <button type="button" draggable onDragStart={event => startDrag(event, { kind: 'section', sectionId: section.id, index })}
          className="cursor-grab touch-none text-muted-foreground" title="Drag table to reorder" aria-label={`Drag ${section.title} table`}><GripVertical className="w-4 h-4" /></button>
        <Input
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
          className="h-8 text-sm font-semibold rounded-none border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-secondary bg-transparent px-0 flex-1"
          placeholder="Section title"
        />
        <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          {section.columns.length} columns · {section.rows.length} rows
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(-1)} className="h-7 w-7" aria-label={`Move ${section.title} up`}><ArrowUp className="w-3.5 h-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(1)} className="h-7 w-7" aria-label={`Move ${section.title} down`}><ArrowDown className="w-3.5 h-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-none" title="Duplicate section" aria-label="Duplicate section">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-none" title="Remove section" aria-label="Remove section">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {section.columns.map((col, ci) => (
                <th key={ci} className="p-1 min-w-32" onDragOver={event => event.preventDefault()}
                  onDrop={event => { event.stopPropagation(); const source = readDrag(event); if (source?.kind === 'column' && source.sectionId === section.id) moveColumn(source.index, ci); }}>
                  <div className={`flex items-center gap-1 ${visibility[ci] ? '' : 'opacity-55'}`}>
                    <button type="button" draggable onDragStart={event => startDrag(event, { kind: 'column', sectionId: section.id, index: ci })}
                      className="cursor-grab touch-none text-muted-foreground shrink-0" title="Drag column" aria-label={`Drag ${col} column`}><GripVertical className="w-3.5 h-3.5" /></button>
                    <Input
                      value={col}
                      onChange={e => updateColumn(ci, e.target.value)}
                      className={cellClass + ' font-semibold bg-muted/50'}
                    />
                    <button type="button" onClick={() => duplicateColumn(ci)} className="text-muted-foreground hover:text-foreground shrink-0" title="Duplicate column" aria-label={`Duplicate ${col} column`}>
                      <Copy className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => toggleColumn(ci)} disabled={visibility[ci] && visibility.filter(Boolean).length === 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0" title={visibility[ci] ? 'Hide from shared list' : 'Show on shared list'} aria-label={`${visibility[ci] ? 'Hide' : 'Show'} ${col} column`}>
                      {visibility[ci] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button type="button" onClick={() => moveColumn(ci, ci - 1)} disabled={ci === 0} className="text-muted-foreground disabled:opacity-30" title="Move column left" aria-label={`Move ${col} left`}><ArrowLeft className="w-3 h-3" /></button>
                    <button type="button" onClick={() => moveColumn(ci, ci + 1)} disabled={ci === section.columns.length - 1} className="text-muted-foreground disabled:opacity-30" title="Move column right" aria-label={`Move ${col} right`}><ArrowRight className="w-3 h-3" /></button>
                    {section.columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(ci)} className="text-muted-foreground hover:text-destructive shrink-0" title="Remove column" aria-label={`Remove ${col} column`}>
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
              <tr key={row.id} onDragOver={event => event.preventDefault()}
                onDrop={event => { event.stopPropagation(); const source = readDrag(event); if (source?.kind === 'row' && source.sectionId === section.id) moveRow(source.index, ri); }}>
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
                <td className="p-1 w-14">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" draggable onDragStart={event => startDrag(event, { kind: 'row', sectionId: section.id, index: ri })}
                      className="cursor-grab touch-none text-muted-foreground" title="Drag row" aria-label={`Drag row ${ri + 1}`}><GripVertical className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => moveRow(ri, ri - 1)} disabled={ri === 0} className="text-muted-foreground disabled:opacity-30" title="Move row up" aria-label={`Move row ${ri + 1} up`}><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => moveRow(ri, ri + 1)} disabled={ri === section.rows.length - 1} className="text-muted-foreground disabled:opacity-30" title="Move row down" aria-label={`Move row ${ri + 1} down`}><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => duplicateRow(ri)} className="text-muted-foreground hover:text-foreground" title="Duplicate row" aria-label="Duplicate row">
                      <Copy className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => removeRow(ri)} className="text-muted-foreground hover:text-destructive" title="Remove row" aria-label="Remove row">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
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
  offerPercent: 0,
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
      offerPercent: pl.offerPercent || 0,
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
      offerPercent: pl.offerPercent || 0,
      active: pl.active,
      staffVisible: pl.staffVisible,
      expiresAt: pl.expiresAt ? pl.expiresAt.slice(0, 10) : '',
      sections: pl.sections.map(section => cloneSection(section)),
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      title: form.title || 'Untitled Price List',
      subtitle: form.subtitle,
      note: form.note,
      offerPercent: form.offerPercent,
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
          <h1 className="text-3xl font-sans font-bold text-foreground">Price Lists</h1>
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
                      <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest ${pl.active && !isExpired ? 'bg-admin-success-soft text-admin-success' : 'bg-muted text-muted-foreground'}`}>
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
              <DialogTitle className="font-sans text-2xl font-bold text-white">
                {editing ? 'Edit Price List' : 'New Price List'}
              </DialogTitle>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {editing && <div className="rounded-xl border border-admin-border bg-admin-subtle p-4 space-y-2">
                <Label className={labelClass}>Customer share link</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input readOnly aria-label="Customer share link" value={`${window.location.origin}/price-list/${editing.publicId}`} className="min-w-0 flex-1 text-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={() => copyShareLink(editing)}><Copy className="w-3.5 h-3.5 mr-1" /> Copy</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openShareLink(editing)}><ExternalLink className="w-3.5 h-3.5 mr-1" /> Preview</Button>
                  <Button type="button" variant="outline" size="sm" disabled={regenMut.isPending} onClick={() => {
                    if (window.confirm('Create a new link? The old customer link will stop working.')) {
                      regenMut.mutate(editing.id, { onSuccess: (updated: any) => setEditing(updated) });
                    }
                  }}><RefreshCw className="w-3.5 h-3.5 mr-1" /> New link</Button>
                </div>
                <p className="text-xs text-muted-foreground">Save table changes before previewing or replacing the link.</p>
              </div>}
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

              <div className="space-y-2 rounded-xl border border-admin-border bg-admin-subtle p-4">
                <Label className={labelClass}>Premium customer offer (%)</Label>
                <Input type="number" min="0" max="100" step="0.01" value={form.offerPercent}
                  onChange={e => setForm(f => ({ ...f, offerPercent: Number(e.target.value) }))}
                  className="w-32 rounded-lg bg-admin-surface" />
                <p className="text-xs text-admin-muted">Applied automatically to admin orders for clients linked to this active price list. Individual table prices remain for reference.</p>
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
                    index={i}
                    onChange={s => setForm(f => ({ ...f, sections: f.sections.map((sec, idx) => idx === i ? s : sec) }))}
                    onMove={direction => setForm(f => ({ ...f, sections: moveItem(f.sections, i, i + direction) }))}
                    onDropSection={source => setForm(f => ({ ...f, sections: source.sectionId === f.sections[source.index]?.id ? moveItem(f.sections, source.index, i) : f.sections }))}
                    onDuplicate={() => setForm(f => {
                      const copy = cloneSection(section, 'Copy');
                      return { ...f, sections: [...f.sections.slice(0, i + 1), copy, ...f.sections.slice(i + 1)] };
                    })}
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
