import { useEffect, useState, useRef } from "react";
import { useListProducts, useListCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, createCategory, useGetAdminMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { broadcastAdminSave } from "@/lib/home-cache";
import { Search, Plus, Edit2, Trash2, Package, Image, X, GripVertical, ChevronDown, ChevronUp, Tag, Layers, Upload, Loader2, ImagePlus, Star as StarIcon, FileText, ExternalLink, Sparkles, Hash, Ruler, Gift, CreditCard } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DescriptionEditor } from "@/components/admin/DescriptionEditor";
import { parseDescriptionLines } from "@/lib/description-utils";

const DEFAULT_PRINT_CATEGORIES = [
  "Walnut Frames",
  "Oak Frames",
  "Black Frames",
  "Aluminium Frames",
  "Story Collages",
  "Fine Art Prints",
  "Canvas Prints",
  "Studio Portrait Sets",
  "Gallery Wall Sets",
  "Gift Frames",
];

/* ────────── Types ────────── */
import { FixedPriceTable, RangePriceTable, SizeTierBuilder, OptionGroupCard, type FixedPrice, type RangePrice, type Choice, type OptionGroup, type ProductSize } from "@/components/admin/ProductOptionEditor";

/* ── Multi Prints types ── */
type MPPricingMode = "unit" | "qty-range";
type MPTier = { minQty: number; maxQty: number | null; price: string };
type MPPrintSide = { id: string; name: "one-side" | "double-side"; label: string; pricingMode: MPPricingMode; unitPrice: string; tiers: MPTier[] };
type MPLamination = { id: string; name: "none" | "one-side-gloss" | "one-side-matte" | "double-side-gloss" | "double-side-matte"; label: string; pricingMode: MPPricingMode; unitPrice: string; tiers: MPTier[] };
type MPRoundCornerCut = { enabled: boolean; pricingMode: MPPricingMode; unitPrice: string; tiers: MPTier[] };
type MPBoardType = { id: string; name: string; gsm: number; description: string; isActive: boolean; basePricingMode: MPPricingMode; baseUnitPrice: string; baseTiers: MPTier[]; printSides: MPPrintSide[]; laminations: MPLamination[]; roundCornerCut?: MPRoundCornerCut };

type ProductFormat = "ready_made" | "frame_print" | "print_service" | "finishing";

type CustomConfig = {
  productFormat: ProductFormat;
  productType: "standard" | "custom_print" | "multi_size_tier" | "multi_prints";
  pricingModel: "fixed_quantities" | "range_per_unit";
  fixedPrices: FixedPrice[];
  rangePrices: RangePrice[];
  optionGroups: OptionGroup[];
  stockQty: string;
  minQuantity: number;
  quantityStep: number;
  sizes: ProductSize[];
  productionTime: string;
  sizeLabel: string;
  multiPrintsBoardTypes: MPBoardType[];
  offerEnabled: boolean;
  offerMinAmount: number;
  offerMessage: string;
  codEnabled: boolean;
  codMessage: string;
  fullPaymentOfferEnabled: boolean;
  fullPaymentOfferDiscount: number;
  fullPaymentOfferMessage: string;
};

const DEFAULT_CONFIG: CustomConfig = {
  productFormat: "ready_made",
  productType: "standard",
  pricingModel: "fixed_quantities",
  fixedPrices: [{ qty: 100, price: "" }, { qty: 250, price: "" }, { qty: 500, price: "" }],
  rangePrices: [{ from: 1, to: 5, pricePerUnit: "" }],
  optionGroups: [],
  stockQty: "",
  minQuantity: 1,
  quantityStep: 1,
  sizes: [],
  productionTime: "",
  sizeLabel: "",
  multiPrintsBoardTypes: [],
  offerEnabled: false,
  offerMinAmount: 0,
  offerMessage: "",
  codEnabled: false,
  codMessage: "Pay cash when your order is delivered.",
  fullPaymentOfferEnabled: false,
  fullPaymentOfferDiscount: 0,
  fullPaymentOfferMessage: "Pay the full amount upfront and receive a special offer.",
};

/* ── Multi Prints helpers ── */
function mpUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function emptyMPTier(): MPTier { return { minQty: 1, maxQty: null, price: "" }; }
function emptyMPPrintSide(): MPPrintSide { return { id: mpUid(), name: "one-side", label: "One Side Print", pricingMode: "unit", unitPrice: "", tiers: [] }; }
function emptyMPLamination(): MPLamination { return { id: mpUid(), name: "none", label: "No Lamination", pricingMode: "unit", unitPrice: "", tiers: [] }; }
function emptyMPBoard(): MPBoardType { return { id: mpUid(), name: "", gsm: 300, description: "", isActive: true, basePricingMode: "unit", baseUnitPrice: "", baseTiers: [], printSides: [], laminations: [] }; }

/* ── Reusable MP pricing mode pill toggle ── */
function MPModeToggle({ value, onChange }: { value: MPPricingMode; onChange: (m: MPPricingMode) => void }) {
  return (
    <span className="inline-flex rounded-lg overflow-hidden border border-admin-border text-xs font-semibold">
      <button type="button" onClick={() => onChange("unit")} className={`px-3 py-1 transition ${value === "unit" ? "bg-admin-brand text-white" : "bg-admin-surface text-admin-muted hover:bg-admin-surface"}`}>Unit Price</button>
      <button type="button" onClick={() => onChange("qty-range")} className={`px-3 py-1 border-l border-admin-border transition ${value === "qty-range" ? "bg-admin-brand text-white" : "bg-admin-surface text-admin-muted hover:bg-admin-surface"}`}>Qty Range</button>
    </span>
  );
}

/* ── MP Tier editor ── */
function MPTierEditor({ tiers, onChange }: { tiers: MPTier[]; onChange: (t: MPTier[]) => void }) {
  const up = (i: number, patch: Partial<MPTier>) => { const n = tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t); onChange(n); };
  return (
    <div className="mt-2 space-y-1">
      {tiers.length > 0 && (
        <div className="grid grid-cols-[80px_80px_1fr_24px] gap-1 text-[10px] text-admin-muted uppercase font-semibold px-1">
          <span>Min Qty</span><span>Max Qty</span><span>Price (Rs.)</span><span />
        </div>
      )}
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[80px_80px_1fr_24px] gap-1 items-center">
          <input type="number" min={1} value={t.minQty} onChange={e => up(i, { minQty: parseInt(e.target.value) || 1 })} className="px-2 py-1 border rounded text-xs" placeholder="Min" />
          <input type="number" value={t.maxQty ?? ""} onChange={e => up(i, { maxQty: e.target.value ? parseInt(e.target.value) : null })} className="px-2 py-1 border rounded text-xs" placeholder="Max(∞)" />
          <input type="number" value={t.price} onChange={e => up(i, { price: e.target.value })} className="px-2 py-1 border rounded text-xs" placeholder="Price" />
          <button type="button" onClick={() => onChange(tiers.filter((_, j) => j !== i))} className="text-admin-muted hover:text-admin-danger"><X size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...tiers, emptyMPTier()])} className="text-xs text-admin-brand-ink font-semibold hover:text-admin-brand-ink flex items-center gap-1 mt-1"><Plus size={11} /> Add Tier</button>
    </div>
  );
}

/* ── MP PriceBlock (unit or qty-range) ── */
function MPPriceBlock({ mode, unitPrice, tiers, onMode, onUnit, onTiers }: { mode: MPPricingMode; unitPrice: string; tiers: MPTier[]; onMode: (m: MPPricingMode) => void; onUnit: (v: string) => void; onTiers: (t: MPTier[]) => void }) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-admin-muted font-medium">Mode</span>
        <MPModeToggle value={mode} onChange={onMode} />
      </div>
      {mode === "unit"
        ? <div className="flex items-center gap-2"><span className="text-xs text-admin-muted">Rs.</span><input type="number" value={unitPrice} onChange={e => onUnit(e.target.value)} className="w-32 px-2 py-1 border rounded text-sm" placeholder="Price per unit" /></div>
        : <MPTierEditor tiers={tiers} onChange={onTiers} />}
    </div>
  );
}

/* ── MP Print Side card ── */
function MPPrintSideCard({ ps, onChange, onRemove }: { ps: MPPrintSide; onChange: (p: MPPrintSide) => void; onRemove: () => void }) {
  return (
    <div className="mb-2 p-3 bg-admin-surface rounded-xl border border-admin-brand-line">
      <div className="flex justify-between mb-2">
        <span className="text-xs font-bold text-admin-brand-ink">Print Side Option</span>
        <button type="button" onClick={onRemove} className="text-xs text-admin-danger hover:text-admin-danger">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div>
          <label className="text-[10px] text-admin-muted mb-0.5 block">Type</label>
          <select value={ps.name} onChange={e => onChange({ ...ps, name: e.target.value as MPPrintSide["name"] })} className="w-full px-2 py-1.5 border rounded text-xs">
            <option value="one-side">One Side Print</option>
            <option value="double-side">Double Side Print</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-admin-muted mb-0.5 block">Label</label>
          <input value={ps.label} onChange={e => onChange({ ...ps, label: e.target.value })} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Display label" />
        </div>
      </div>
      <MPPriceBlock mode={ps.pricingMode} unitPrice={ps.unitPrice} tiers={ps.tiers} onMode={m => onChange({ ...ps, pricingMode: m })} onUnit={v => onChange({ ...ps, unitPrice: v })} onTiers={t => onChange({ ...ps, tiers: t })} />
    </div>
  );
}

/* ── MP Lamination card ── */
function MPLaminationCard({ lam, onChange, onRemove }: { lam: MPLamination; onChange: (l: MPLamination) => void; onRemove: () => void }) {
  return (
    <div className="mb-2 p-3 bg-admin-surface rounded-xl border border-admin-border">
      <div className="flex justify-between mb-2">
        <span className="text-xs font-bold text-admin-ink">Lamination Option</span>
        <button type="button" onClick={onRemove} className="text-xs text-admin-danger hover:text-admin-danger">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div>
          <label className="text-[10px] text-admin-muted mb-0.5 block">Type</label>
          <select value={lam.name} onChange={e => onChange({ ...lam, name: e.target.value as MPLamination["name"] })} className="w-full px-2 py-1.5 border rounded text-xs">
            <option value="none">No Lamination</option>
            <option value="one-side-gloss">One Side Gloss</option>
            <option value="one-side-matte">One Side Matte</option>
            <option value="double-side-gloss">Double Side Gloss</option>
            <option value="double-side-matte">Double Side Matte</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-admin-muted mb-0.5 block">Label</label>
          <input value={lam.label} onChange={e => onChange({ ...lam, label: e.target.value })} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Display label" />
        </div>
      </div>
      <MPPriceBlock mode={lam.pricingMode} unitPrice={lam.unitPrice} tiers={lam.tiers} onMode={m => onChange({ ...lam, pricingMode: m })} onUnit={v => onChange({ ...lam, unitPrice: v })} onTiers={t => onChange({ ...lam, tiers: t })} />
    </div>
  );
}

/* ── MP Board Type card (collapsible) ── */
function MPBoardCard({ board, index, total, onChange, onRemove, onMoveUp, onMoveDown }: { board: MPBoardType; index: number; total: number; onChange: (b: MPBoardType) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  const [open, setOpen] = useState(true);
  const setPrintSide = (i: number, ps: MPPrintSide) => { const arr = [...board.printSides]; arr[i] = ps; onChange({ ...board, printSides: arr }); };
  const removePrintSide = (i: number) => onChange({ ...board, printSides: board.printSides.filter((_, idx) => idx !== i) });
  const setLamination = (i: number, l: MPLamination) => { const arr = [...board.laminations]; arr[i] = l; onChange({ ...board, laminations: arr }); };
  const removeLamination = (i: number) => onChange({ ...board, laminations: board.laminations.filter((_, idx) => idx !== i) });
  return (
    <div className="border-2 border-admin-border rounded-2xl overflow-hidden mb-4 bg-admin-surface">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-admin-surface border-b border-admin-border cursor-pointer" onClick={() => setOpen(o => !o)}>
        <GripVertical size={14} className="text-admin-muted shrink-0" />
        <span className="flex-1 font-bold text-admin-ink text-sm">{board.name || `Board Type ${index + 1}`} {board.gsm ? `(${board.gsm}gsm)` : ""}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${board.isActive ? "bg-admin-success-soft text-admin-success" : "bg-admin-subtle text-admin-muted"}`}>{board.isActive ? "Active" : "Inactive"}</span>
        <div className="flex items-center gap-0.5 ml-2" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-1 text-admin-muted hover:text-admin-muted disabled:opacity-30"><ChevronUp size={13} /></button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-admin-muted hover:text-admin-muted disabled:opacity-30"><ChevronDown size={13} /></button>
          <button type="button" onClick={onRemove} className="p-1 text-admin-muted hover:text-admin-danger ml-1"><X size={14} /></button>
        </div>
        {open ? <ChevronUp size={14} className="text-admin-muted ml-1" /> : <ChevronDown size={14} className="text-admin-muted ml-1" />}
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* ① Details */}
          <div className="p-3 bg-admin-surface rounded-xl border border-admin-border">
            <p className="text-xs font-bold text-admin-muted mb-2">① Board Type Details</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-admin-muted mb-0.5 block">Name</label>
                <input value={board.name} onChange={e => onChange({ ...board, name: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g. 300gsm Art Board" />
              </div>
              <div>
                <label className="text-[10px] text-admin-muted mb-0.5 block">GSM</label>
                <input type="number" value={board.gsm} onChange={e => onChange({ ...board, gsm: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
            </div>
            <div className="mb-2">
              <label className="text-[10px] text-admin-muted mb-0.5 block">Description</label>
              <input value={board.description} onChange={e => onChange({ ...board, description: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Brief description" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-admin-muted font-medium">Status</span>
              <button type="button" onClick={() => onChange({ ...board, isActive: !board.isActive })} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${board.isActive ? "bg-admin-success-solid text-white border-admin-success-line" : "bg-admin-surface text-admin-muted border-admin-border"}`}>{board.isActive ? "Active" : "Inactive"}</button>
            </div>
          </div>

          {/* ② Print Sides */}
          <div className="p-3 bg-admin-brand-soft rounded-xl border border-admin-brand-line">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-admin-brand-ink">② Print Sides</p>
              <button type="button" onClick={() => onChange({ ...board, printSides: [...board.printSides, emptyMPPrintSide()] })} className="text-[10px] font-bold px-2 py-1 bg-admin-brand text-white rounded-lg hover:bg-admin-brand">+ Add Option</button>
            </div>
            {board.printSides.length === 0 && <p className="text-[11px] text-admin-brand-ink text-center py-2">No print side options. Click "+ Add Option".</p>}
            {board.printSides.map((ps, i) => <MPPrintSideCard key={ps.id} ps={ps} onChange={u => setPrintSide(i, u)} onRemove={() => removePrintSide(i)} />)}
          </div>

          {/* ③ Laminations */}
          <div className="p-3 bg-admin-surface rounded-xl border border-admin-border">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-admin-ink">③ Laminations</p>
              <button type="button" onClick={() => onChange({ ...board, laminations: [...board.laminations, emptyMPLamination()] })} className="text-[10px] font-bold px-2 py-1 bg-admin-subtle text-white rounded-lg hover:bg-admin-inverse">+ Add Option</button>
            </div>
            {board.laminations.length === 0 && <p className="text-[11px] text-admin-muted text-center py-2">No lamination options. Click "+ Add Option".</p>}
            {board.laminations.map((lam, i) => <MPLaminationCard key={lam.id} lam={lam} onChange={u => setLamination(i, u)} onRemove={() => removeLamination(i)} />)}
          </div>

          {/* ④ Base Price */}
          <div className="p-3 bg-admin-success-soft rounded-xl border border-admin-success-line">
            <p className="text-xs font-bold text-admin-success mb-1">④ Base Price (Board Material)</p>
            <p className="text-[10px] text-admin-success mb-2">Cost of the board itself, before options are added.</p>
            <MPPriceBlock mode={board.basePricingMode} unitPrice={board.baseUnitPrice} tiers={board.baseTiers} onMode={m => onChange({ ...board, basePricingMode: m })} onUnit={v => onChange({ ...board, baseUnitPrice: v })} onTiers={t => onChange({ ...board, baseTiers: t })} />
          </div>

          {/* ⑤ Round Corner Cut */}
          <div className="p-3 bg-admin-warning-soft rounded-xl border border-admin-warning-line">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-admin-warning">⑤ Round Corner Cut (Optional)</p>
              <button
                type="button"
                onClick={() => onChange({ ...board, roundCornerCut: { enabled: !(board.roundCornerCut?.enabled), pricingMode: board.roundCornerCut?.pricingMode ?? "unit", unitPrice: board.roundCornerCut?.unitPrice ?? "", tiers: board.roundCornerCut?.tiers ?? [] } })}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${board.roundCornerCut?.enabled ? "bg-admin-warning-solid text-white border-admin-warning-line" : "bg-admin-surface text-admin-muted border-admin-border hover:border-admin-warning-line"}`}
              >
                {board.roundCornerCut?.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            {board.roundCornerCut?.enabled && (
              <>
                <p className="text-[10px] text-admin-warning mb-2">Extra charge for rounded corner cutting per unit.</p>
                <MPPriceBlock
                  mode={board.roundCornerCut.pricingMode}
                  unitPrice={board.roundCornerCut.unitPrice}
                  tiers={board.roundCornerCut.tiers}
                  onMode={m => onChange({ ...board, roundCornerCut: { ...board.roundCornerCut!, pricingMode: m } })}
                  onUnit={v => onChange({ ...board, roundCornerCut: { ...board.roundCornerCut!, unitPrice: v } })}
                  onTiers={t => onChange({ ...board, roundCornerCut: { ...board.roundCornerCut!, tiers: t } })}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = { name: "", invoiceName: "", description: "", categoryId: "", categoryNewName: "", price: "", imageUrl: "", galleryImages: [] as string[], artworkGuideUrl: "", artworkGuideName: "", keywords: "", featured: false, active: true };

function slugPreview(value: string): string {
  return String(value || "product")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 85) || "product";
}

function uid() { return Math.random().toString(36).slice(2, 8); }
function rs(v: any) { return `Rs. ${Number(v || 0).toLocaleString("en-IN")}`; }

function parseGalleryImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function normalizeConfigForSave(config: CustomConfig): CustomConfig {
  return {
    ...config,
    optionGroups: (Array.isArray(config.optionGroups) ? config.optionGroups : []).map(group => ({
      ...group,
      title: String(group.title || "").trim(),
      choices: (Array.isArray(group.choices) ? group.choices : []).map(choice => ({
        ...choice,
        name: String(choice.name || "").trim(),
        price: choice.price === "" || choice.price === undefined || choice.price === null ? "0" : String(choice.price),
        chargeType: choice.chargeType === "qty_range" ? "qty_range" : choice.chargeType === "per_unit" ? "per_unit" : "flat",
        sizePrices: Array.isArray(choice.sizePrices) ? choice.sizePrices.map(override => ({
          ...override,
          price: override.price === "" || override.price === undefined || override.price === null ? "0" : String(override.price),
        })) : choice.sizePrices,
      })),
    })),
  };
}

function parseConfig(raw: string | null | undefined): CustomConfig {
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const saved = JSON.parse(raw);
    const legacyFormat: ProductFormat = saved.productType === "multi_size_tier"
      ? "frame_print"
      : saved.productType === "custom_print"
      ? "print_service"
      : saved.productType === "multi_prints"
      ? "finishing"
      : "ready_made";
    return normalizeConfigForSave({ ...DEFAULT_CONFIG, ...saved, productFormat: saved.productFormat || legacyFormat });
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/* ────────── Sub-components ────────── */

/* ────────── Category Combobox ────────── */
type CatOption = { id: number; name: string };

function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: CatOption[];
  value: { id: number | null; name: string };
  onChange: (v: { id: number | null; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value.name);

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );
  const exactMatch = categories.find(
    c => c.name.toLowerCase() === query.trim().toLowerCase()
  );

  const select = (c: CatOption) => {
    setQuery(c.name);
    onChange({ id: c.id, name: c.name });
    setOpen(false);
  };

  const createNew = () => {
    const name = query.trim();
    if (!name) return;
    onChange({ id: null, name });
    setOpen(false);
  };

  const clear = () => {
    setQuery("");
    onChange({ id: null, name: "" });
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-admin-border rounded-xl bg-admin-surface focus-within:ring-2 focus-within:ring-admin-warning">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange({ id: null, name: e.target.value }); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-admin-muted"
          placeholder="Select existing or type a new category…"
        />
        {query && (
          <button type="button" onMouseDown={e => { e.preventDefault(); clear(); }} className="text-admin-muted hover:text-admin-danger transition-colors">
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} className="text-admin-muted shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-admin-surface border border-admin-border rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 && !query.trim() && (
            <div className="px-4 py-3 text-xs text-admin-muted text-center">No categories yet — type to create one</div>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(c); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-admin-warning-soft hover:text-admin-warning transition-colors flex items-center gap-2 ${value.id === c.id ? "bg-admin-warning-soft text-admin-warning font-semibold" : "text-admin-ink"}`}
            >
              <Tag size={12} className="shrink-0 opacity-50" />
              {c.name}
              {value.id === c.id && <span className="ml-auto text-[10px] text-admin-warning font-bold">Selected</span>}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); createNew(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-admin-muted hover:bg-admin-surface transition-colors flex items-center gap-2 border-t border-admin-border font-semibold"
            >
              <Plus size={12} className="shrink-0" />
              Create new: &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}

      {value.id === null && value.name && (
        <p className="mt-1 text-[11px] text-admin-muted flex items-center gap-1">
          <Plus size={10} /> New category &ldquo;{value.name}&rdquo; will be created when you save
        </p>
      )}
    </div>
  );
}

/* ────────── Main Component ────────── */
export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [readOnly,setReadOnly]=useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [config, setConfig] = useState<CustomConfig>({ ...DEFAULT_CONFIG });
  const [pricingTab, setPricingTab] = useState<"base" | "options">("base"); // kept for compat
  const [catValue, setCatValue] = useState<{ id: number | null; name: string }>({ id: null, name: "" });
  const [imgUploading, setImgUploading] = useState(false);
  const [guideUploading, setGuideUploading] = useState(false);
  const [seedingCats, setSeedingCats] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catEditing, setCatEditing] = useState<any>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", sortOrder: 0 });
  const [catSaving, setCatSaving] = useState(false);
  const [catDeletingId, setCatDeletingId] = useState<number | null>(null);
  const [catFormError, setCatFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guideInputRef = useRef<HTMLInputElement>(null);
    const { data: admin } = useGetAdminMe({ query: { staleTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false } as any });
  useEffect(() => { setReadOnly(admin?.role === "staff"); }, [admin?.role]);
  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useListProducts();
  const { data: categories } = useListCategories();
  const queryClient = useQueryClient();
  const inv = { queryKey: ["/api/products"] };
  const updateProductCache = (savedProduct: any) => {
    if (!savedProduct?.id) return;
    queryClient.setQueryData(inv.queryKey, (current: any) => Array.isArray(current)
      ? current.map(item => item.id === savedProduct.id
        ? {
            ...item,
            customConfig: savedProduct.customConfig ?? item.customConfig,
            productFormat: savedProduct.productFormat ?? item.productFormat,
            price: savedProduct.price ?? item.price,
            priceType: savedProduct.priceType ?? item.priceType,
          }
        : item)
      : current);
  };

  const { mutate: createProduct, isPending: creating } = useCreateProduct({
    mutation: { onSuccess: (savedProduct) => { updateProductCache(savedProduct); queryClient.invalidateQueries(inv); broadcastAdminSave(); closeForm(); } }
  });
  const { mutate: updateProduct, isPending: updating } = useUpdateProduct({
    mutation: { onSuccess: (savedProduct) => { updateProductCache(savedProduct); queryClient.invalidateQueries(inv); broadcastAdminSave(); closeForm(); } }
  });
  const { mutate: deleteProduct } = useDeleteProduct({ mutation: { onSuccess: () => { queryClient.invalidateQueries(inv); broadcastAdminSave(); } } });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); setConfig({ ...DEFAULT_CONFIG }); setPricingTab("base"); setCatValue({ id: null, name: "" }); };

  const openEdit = (p: any) => {
    setEditing(p);
    const gallery: string[] = Array.isArray(p.galleryImages) ? p.galleryImages : [];
    const allImgs = p.imageUrl ? [p.imageUrl, ...gallery.filter((u: string) => u !== p.imageUrl)] : gallery;
    setForm({ name: p.name, invoiceName: (p as any).invoiceName || "", description: p.description, categoryId: String(p.categoryId || ""), categoryNewName: "", imageUrl: p.imageUrl || "", galleryImages: allImgs, artworkGuideUrl: p.artworkGuideUrl || "", artworkGuideName: p.artworkGuideName || "", keywords: Array.isArray(p.keywords) ? p.keywords.join(", ") : "", featured: p.featured, active: p.active, price: p.price });
    if (p.categoryId && p.category) {
      setCatValue({ id: p.categoryId, name: p.category.name });
    } else {
      setCatValue({ id: null, name: "" });
    }
    setConfig(parseConfig(p.customConfig));
    setShowForm(true);
  };

  const uploadProductImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url;
  };

  const uploadProductImages = (files: File[]): Promise<string[]> => Promise.all(files.map(uploadProductImage));

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImgUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadProductImage));
      setForm((prev: any) => {
        const merged = [...new Set([...prev.galleryImages, ...urls])];
        return { ...prev, galleryImages: merged, imageUrl: merged[0] || prev.imageUrl };
      });
    } catch { alert("Some images failed to upload."); }
    finally {
      setImgUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => {
    setForm((prev: any) => {
      const gallery = prev.galleryImages.filter((u: string) => u !== url);
      return { ...prev, galleryImages: gallery, imageUrl: gallery[0] || "" };
    });
    setConfig(current => ({
      ...current,
      sizes: current.sizes.map(size => size.imageUrl === url ? { ...size, imageUrl: undefined } : size),
      optionGroups: current.optionGroups.map(group => ({
        ...group,
        choices: group.choices.map(choice => choice.imageUrl === url ? { ...choice, imageUrl: undefined } : choice),
      })),
    }));
  };

  const setCover = (url: string) => {
    setForm((prev: any) => {
      const rest = prev.galleryImages.filter((u: string) => u !== url);
      return { ...prev, galleryImages: [url, ...rest], imageUrl: url };
    });
  };

  const handleGuideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGuideUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/upload-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url, originalName } = await res.json();
      setForm((prev: any) => ({ ...prev, artworkGuideUrl: url, artworkGuideName: originalName || file.name }));
    } catch { alert("Guide upload failed. Please try again."); }
    finally {
      setGuideUploading(false);
      if (guideInputRef.current) guideInputRef.current.value = "";
    }
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setConfig({ ...DEFAULT_CONFIG }); setPricingTab("base"); setCatValue({ id: null, name: "" }); setShowForm(true); };

  const openCatModal = () => {
    setCatEditing(null);
    setCatForm({ name: "", description: "", sortOrder: (categories?.length ?? 0) * 10 });
    setCatFormError("");
    setShowCatModal(true);
  };

  const openCatEdit = (cat: any) => {
    setCatEditing(cat);
    setCatForm({ name: cat.name || "", description: cat.description || "", sortOrder: cat.sortOrder ?? 0 });
    setCatFormError("");
  };

  const cancelCatEdit = () => {
    setCatEditing(null);
    setCatForm({ name: "", description: "", sortOrder: (categories?.length ?? 0) * 10 });
    setCatFormError("");
  };

  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { setCatFormError("Category name is required."); return; }
    setCatSaving(true);
    setCatFormError("");
    try {
      if (catEditing) {
        const r = await fetch(`/api/categories/${catEditing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catForm.name.trim(), description: catForm.description, sortOrder: Number(catForm.sortOrder) || 0 }),
        });
        if (!r.ok) throw new Error("Failed");
      } else {
        await createCategory({ name: catForm.name.trim(), description: catForm.description, sortOrder: Number(catForm.sortOrder) || 0 });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCatEditing(null);
      setCatForm({ name: "", description: "", sortOrder: 0 });
    } catch {
      setCatFormError(catEditing ? "Failed to update category." : "Failed to create category.");
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = async (cat: any) => {
    const usedCount = (products ?? []).filter((p: any) => p.categoryId === cat.id).length;
    const msg = usedCount > 0
      ? `Delete "${cat.name}"? ${usedCount} product${usedCount === 1 ? " is" : "s are"} assigned to it and will become uncategorized.`
      : `Delete "${cat.name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    setCatDeletingId(cat.id);
    try {
      const r = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      if (catEditing?.id === cat.id) {
        setCatEditing(null);
        setCatForm({ name: "", description: "", sortOrder: 0 });
      }
    } catch {
      alert("Failed to delete category.");
    } finally {
      setCatDeletingId(null);
    }
  };

  const seedDefaultCategories = async () => {
    setSeedingCats(true);
    try {
      const existingNames = new Set((categories ?? []).map((c: any) => c.name.toLowerCase()));
      const toCreate = DEFAULT_PRINT_CATEGORIES.filter(n => !existingNames.has(n.toLowerCase()));
      for (const name of toCreate) {
        await createCategory({ name });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      if (toCreate.length === 0) {
        alert("All default categories already exist!");
      } else {
        alert(`Added ${toCreate.length} default categor${toCreate.length === 1 ? "y" : "ies"} successfully!`);
      }
    } catch {
      alert("Failed to seed categories. Please try again.");
    } finally {
      setSeedingCats(false);
    }
  };

  const setC = (patch: Partial<CustomConfig>) => setConfig(c => ({ ...c, ...patch }));

  const moveGroup = (from: number, to: number) => {
    setConfig(c => {
      const groups = [...c.optionGroups];
      const [moved] = groups.splice(from, 1);
      groups.splice(to, 0, moved);
      return { ...c, optionGroups: groups };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let resolvedCatId: number | undefined;
    if (catValue.id !== null) {
      resolvedCatId = catValue.id;
    } else if (catValue.name.trim()) {
      try {
        const newCat = await createCategory({ name: catValue.name.trim() });
        resolvedCatId = newCat.id;
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        setCatValue({ id: newCat.id, name: newCat.name });
      } catch {
        alert("Failed to create category. Please try again.");
        return;
      }
    }

    const isCustom = config.productType === "custom_print";
    const isMultiSize = config.productType === "multi_size_tier";
    const isMultiPrints = config.productType === "multi_prints";
    const price = isMultiSize
      ? (config.sizes?.[0]?.tiers?.[0]?.pricePerUnit || "0")
      : isCustom
      ? (config.pricingModel === "fixed_quantities" ? config.fixedPrices[0]?.price || "0" : config.rangePrices[0]?.pricePerUnit || "0")
      : isMultiPrints
      ? (config.multiPrintsBoardTypes?.[0]?.baseUnitPrice || "0")
      : form.price;
    const priceType = (isCustom || isMultiSize || isMultiPrints) ? "custom_quote" : "per_item";
    const normalizedConfig = normalizeConfigForSave(config);
    const customConfig = JSON.stringify(normalizedConfig);
    const gallery: string[] = form.galleryImages || [];
    const data = {
      name: form.name,
      invoiceName: form.invoiceName?.trim() || null,
      keywords: String(form.keywords || "").split(/[,\n]/).map((value: string) => value.trim()).filter(Boolean).filter((value: string, index: number, values: string[]) => values.indexOf(value) === index).slice(0, 30),
      description: form.description,
      categoryId: resolvedCatId,
      imageUrl: gallery[0] || form.imageUrl || null,
      galleryImages: gallery,
      artworkGuideUrl: form.artworkGuideUrl || null,
      artworkGuideName: form.artworkGuideName || null,
      featured: form.featured,
      active: form.active,
      price,
      priceType,
      customConfig,
    };
    if (editing) updateProduct({ id: editing.id, data });
    else createProduct({ data });
  };

  const filtered = (products ?? []).filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.category?.name?.toLowerCase().includes(q) || (Array.isArray(p.keywords) && p.keywords.some((keyword: string) => keyword.toLowerCase().includes(q)));
  });

  const f = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-admin-ink">Products</h1>
          <p className="text-xs sm:text-sm text-admin-muted">{products?.length ?? 0} products · {categories?.length ?? 0} categories {readOnly&&"· View only"}</p>
        </div>
        {!readOnly&&<div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={openCatModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-admin-warning-line bg-admin-warning-soft text-admin-warning text-sm font-semibold hover:bg-admin-warning-soft transition-colors"
            title="Add, edit or delete product categories"
          >
            <Tag size={13} /> Manage Categories
          </button>
          <button
            onClick={seedDefaultCategories}
            disabled={seedingCats}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-admin-border bg-admin-surface text-admin-ink text-sm font-semibold hover:bg-admin-subtle transition-colors disabled:opacity-60"
            title="Seed 10 default printing categories"
          >
            {seedingCats ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Default Categories
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-admin-brand text-white text-sm font-semibold shadow-md shadow-admin-shadow/20 hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Product
          </button>
        </div>}
      </div>

      {/* Search */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm px-3 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
        <Search size={16} className="text-admin-muted shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name or category..." className="flex-1 text-sm outline-none placeholder:text-admin-muted" />
        {search && <button onClick={() => setSearch("")}><X size={14} className="text-admin-muted" /></button>}
      </div>

      {/* Product Cards Grid */}
      {productsLoading ? (
        <div className="bg-admin-surface border border-admin-border rounded-2xl py-20 text-center">
          <Loader2 size={30} className="mx-auto text-admin-warning mb-3 animate-spin" />
          <p className="font-semibold text-admin-muted">Loading products…</p>
          <p className="text-sm text-admin-muted mt-1">Fetching the latest catalog</p>
        </div>
      ) : productsError ? (
        <div className="bg-admin-surface border border-admin-danger-line rounded-2xl py-16 px-6 text-center">
          <Package size={42} className="mx-auto text-admin-danger mb-3" />
          <p className="font-semibold text-admin-danger">Products could not be loaded</p>
          <p className="text-sm text-admin-muted mt-1">The catalog request failed. Your existing products have not been deleted.</p>
          <button
            type="button"
            onClick={() => void refetchProducts()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-admin-inverse px-4 py-2 text-sm font-semibold text-white hover:bg-admin-inverse"
          >
            <Loader2 size={14} /> Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-admin-surface border border-dashed border-admin-border rounded-2xl py-20 text-center">
          <Package size={44} className="mx-auto text-admin-muted mb-3" />
          <p className="font-semibold text-admin-muted">No products yet</p>
          <p className="text-sm text-admin-muted mt-1">Click "Add Product" to create your first one</p>
        </div>
      ) : (
        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map(p => {
            const cfg = parseConfig((p as any).customConfig);
            const isCustom = cfg.productType === "custom_print";
            const isMultiSize = cfg.productType === "multi_size_tier";
            const isMultiPrints = cfg.productType === "multi_prints";
            const _fixedCount = cfg.fixedPrices.filter((x: any) => x.price).length;
            const _rangeCount = cfg.rangePrices.filter((x: any) => x.pricePerUnit).length;
            const _sizeCount = (cfg.sizes || []).length;
            const _mpBoardCount = (cfg.multiPrintsBoardTypes || []).length;
            const priceLabel = isMultiPrints
              ? (_mpBoardCount + " board type" + (_mpBoardCount !== 1 ? "s" : ""))
              : isMultiSize
              ? (_sizeCount + " size" + (_sizeCount !== 1 ? "s" : "") + " with tiers")
              : !isCustom
              ? rs(p.price)
              : cfg.pricingModel === "fixed_quantities" && _fixedCount > 0
              ? (_fixedCount + " price tier" + (_fixedCount > 1 ? "s" : ""))
              : cfg.pricingModel === "range_per_unit" && _rangeCount > 0
              ? (_rangeCount + " range tier" + (_rangeCount > 1 ? "s" : ""))
              : "Custom";
            return (
              <div key={p.id} className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                {/* ── MOBILE: horizontal list row ── */}
                <div className="flex sm:hidden items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="relative w-[72px] h-[72px] shrink-0 rounded-xl bg-admin-surface overflow-hidden">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <div className="w-full h-full flex items-center justify-center"><Image size={24} className="text-admin-muted" /></div>
                    }
                    <span className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${p.active ? "bg-admin-success-soft text-admin-success" : "bg-admin-danger-soft text-admin-danger"}`}>
                      {p.active ? "On" : "Off"}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {p.category && <span className="text-[9px] font-bold text-admin-warning uppercase tracking-widest">{p.category.name}</span>}
                      {p.featured && <span className="text-[9px] font-bold text-admin-warning uppercase">⭐ Featured</span>}
                      {isCustom && <span className="text-[9px] font-bold text-admin-muted uppercase">Custom</span>}
                      {isMultiSize && <span className="text-[9px] font-bold text-admin-brand-ink uppercase">Multi-Size</span>}
                      {isMultiPrints && <span className="text-[9px] font-bold text-admin-brand-ink uppercase">Multi Prints</span>}
                    </div>
                    <h3 className="font-bold text-admin-ink text-sm leading-tight truncate">{p.name}</h3>
                    <div className="text-xs font-semibold text-admin-warning mt-0.5">{priceLabel}{!isCustom && !isMultiSize && <span className="text-admin-muted font-normal ml-1">/ item</span>}</div>
                    <p className="text-[11px] text-admin-muted mt-0.5 truncate">{parseDescriptionLines(p.description).join(" • ")}</p>
                  </div>
                  {/* Actions */}
                  {!readOnly&&<div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(p)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-admin-brand-ink bg-admin-brand-soft hover:bg-admin-brand-soft transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-admin-danger bg-admin-danger-soft hover:bg-admin-danger-soft transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>}
                </div>

                {/* ── DESKTOP sm+: vertical card ── */}
                <div className="hidden sm:flex flex-col h-full">
                  {/* Image */}
                  <div className="relative aspect-[4/3] bg-admin-surface overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Image size={32} className="text-admin-muted" /></div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      {p.featured && <span className="px-2 py-0.5 bg-admin-warning-solid text-white text-[10px] font-bold rounded-full">⭐ Featured</span>}
                      {isCustom && <span className="px-2 py-0.5 bg-admin-subtle text-white text-[10px] font-bold rounded-full">Custom Print</span>}
                      {isMultiSize && <span className="px-2 py-0.5 bg-admin-brand text-white text-[10px] font-bold rounded-full">Multi-Size</span>}
                      {isMultiPrints && <span className="px-2 py-0.5 bg-admin-brand text-white text-[10px] font-bold rounded-full">Multi Prints</span>}
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.active ? "bg-admin-success-soft text-admin-success" : "bg-admin-danger-soft text-admin-danger"}`}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    {p.category && <span className="text-[10px] font-bold text-admin-warning uppercase tracking-widest mb-1">{p.category.name}</span>}
                    <h3 className="font-bold text-admin-ink text-sm leading-tight mb-1 truncate">{p.name}</h3>
                    <p className="text-xs text-admin-muted line-clamp-2 mb-3 flex-1">{parseDescriptionLines(p.description).join(" • ")}</p>
                    {isMultiPrints ? (
                      <div className="space-y-1">
                        {(cfg.multiPrintsBoardTypes || []).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {(cfg.multiPrintsBoardTypes || []).map((b: MPBoardType) => (
                              <span key={b.id} className="px-2 py-0.5 bg-admin-brand-soft text-admin-brand-ink text-[10px] font-semibold rounded-lg">
                                {b.name || "Unnamed"} · {b.gsm}gsm · {b.printSides.length}PS · {b.laminations.length}Lam
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-admin-muted italic">No board types set</span>
                        )}
                      </div>
                    ) : isMultiSize ? (
                      <div className="space-y-1">
                        {(cfg.sizes || []).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {(cfg.sizes || []).map((sz: ProductSize) => (
                              <span key={sz.id} className="px-2 py-0.5 bg-admin-brand-soft text-admin-brand-ink text-[10px] font-semibold rounded-lg">
                                {sz.name || "Unnamed"} · ×{sz.packSize} · {sz.tiers.length} tier{sz.tiers.length !== 1 ? "s" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-admin-muted italic">No sizes set</span>
                        )}
                      </div>
                    ) : isCustom ? (
                      <div className="space-y-1">
                        {cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices.filter(x => x.price).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {cfg.fixedPrices.filter(x => x.price).map((fp, i) => (
                              <span key={i} className="px-2 py-0.5 bg-admin-warning-soft text-admin-warning text-[10px] font-semibold rounded-lg">{fp.qty} pcs · {rs(fp.price)}</span>
                            ))}
                          </div>
                        ) : cfg.pricingModel === "range_per_unit" && cfg.rangePrices.filter(x => x.pricePerUnit).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {cfg.rangePrices.filter(x => x.pricePerUnit).map((rp, i) => (
                              <span key={i} className="px-2 py-0.5 bg-admin-surface text-admin-ink text-[10px] font-semibold rounded-lg">{rp.from}–{rp.to} · {rs(rp.pricePerUnit)}/unit</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-admin-muted italic">No pricing set</span>
                        )}
                        {cfg.optionGroups.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {cfg.optionGroups.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 bg-admin-subtle text-admin-muted text-[10px] rounded">{g.title}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="font-bold text-admin-warning">{rs(p.price)}<span className="text-xs text-admin-muted font-normal ml-1">/ item</span></div>
                    )}
                    {!readOnly&&<div className="flex gap-2 mt-3 pt-3 border-t border-admin-border">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex-1 py-1.5 text-xs font-semibold text-admin-brand-ink bg-admin-brand-soft hover:bg-admin-brand-soft rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                        className="flex-1 py-1.5 text-xs font-semibold text-admin-danger bg-admin-danger-soft hover:bg-admin-danger-soft rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Product Form (Slide Panel) ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex" onClick={closeForm}>
          {/* Backdrop */}
          <div className="flex-1 bg-admin-inverse/40 backdrop-blur-sm" />
          {/* Panel */}
          <div
            className="w-full max-w-2xl bg-admin-surface shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border shrink-0 sticky top-0 bg-admin-surface z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-admin-brand flex items-center justify-center">
                  <Package size={15} className="text-white" />
                </div>
                <h2 className="font-bold text-admin-ink text-lg">{editing ? "Edit Product" : "Add New Product"}</h2>
              </div>
              <button onClick={closeForm} className="inline-flex items-center justify-center p-2 hover:bg-admin-subtle rounded-xl transition-colors">
                <X size={18} className="text-admin-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 space-y-6">
              {/* ── SECTION 1: Basic Info ── */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-admin-muted uppercase tracking-widest flex items-center gap-2">
                  <Tag size={12} /> Basic Information
                </h3>

                <div>
                  <label className="text-xs text-admin-muted font-medium block mb-1">Product Name *</label>
                  <input required value={form.name} onChange={e => f("name", e.target.value)} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="e.g. Gallery Walnut Frame" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-admin-muted font-medium block mb-1">
                      Search Keywords
                      <span className="ml-1.5 text-admin-muted font-normal normal-case">(comma separated)</span>
                    </label>
                    <input value={form.keywords || ""} onChange={e => f("keywords", e.target.value)} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="frame, wall art, gift" />
                  </div>
                  <div>
                    <label className="text-xs text-admin-muted font-medium block mb-1">Product Link</label>
                    <div className="px-4 py-2.5 rounded-xl border border-admin-border bg-admin-surface text-xs text-admin-muted truncate" title={`/store/${slugPreview(form.name)}`}>
                      /store/<span className="font-semibold text-admin-ink">{slugPreview(form.name)}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-admin-muted">Uses the item name. Duplicate names receive a safe suffix.</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-admin-muted font-medium block mb-1">
                    Invoice Name
                    <span className="ml-1.5 text-admin-muted font-normal normal-case">(short name for invoices — leave blank to use Product Name)</span>
                  </label>
                  <input value={form.invoiceName || ""} onChange={e => f("invoiceName", e.target.value)} className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="e.g. Biz Cards Premium" />
                </div>

                <div>
                  <label className="text-xs text-admin-muted font-medium block mb-1">Description</label>
                  <DescriptionEditor
                    value={form.description || ""}
                    onChange={v => f("description", v)}
                    placeholder="Describe this product…"
                  />
                </div>

                <div>
                  <label className="text-xs text-admin-muted font-medium block mb-1">Category</label>
                  <CategoryCombobox
                    categories={categories ?? []}
                    value={catValue}
                    onChange={v => setCatValue(v)}
                  />
                </div>

                {/* ── Multi-Image Upload ── */}
                <div>
                  <label className="text-xs text-admin-muted font-medium block mb-2 flex items-center gap-1.5">
                    <ImagePlus size={12} /> Product Images
                    <span className="text-admin-muted font-normal">(first image = cover)</span>
                  </label>

                  {/* Image Grid */}
                  {form.galleryImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {form.galleryImages.map((url: string, idx: number) => (
                        <div key={url} className="relative group w-20 h-20 rounded-xl overflow-hidden border-2 border-admin-border shrink-0">
                          <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                          {/* Cover badge */}
                          {idx === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-admin-warning-solid text-white text-[9px] font-bold text-center py-0.5">Cover</div>
                          )}
                          {/* Actions on hover */}
                          <div className="absolute inset-0 bg-admin-inverse/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                            {idx !== 0 && (
                              <button type="button" onClick={() => setCover(url)} title="Set as cover" className="p-1 bg-admin-warning-solid rounded-full text-white hover:bg-admin-warning-solid">
                                <StarIcon size={10} fill="currentColor" />
                              </button>
                            )}
                            <button type="button" onClick={() => removeImage(url)} className="p-1 bg-admin-danger-solid rounded-full text-white hover:bg-admin-danger-solid">
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imgUploading}
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-admin-border hover:border-admin-warning-line rounded-xl text-sm text-admin-muted hover:text-admin-warning transition-all w-full justify-center"
                  >
                    {imgUploading
                      ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                      : <><Upload size={15} /> Add Images (select multiple)</>}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
                  <p className="text-[10px] text-admin-muted mt-1">You can select multiple files at once. Click ⭐ on a thumbnail to set it as cover.</p>
                </div>

                {/* ── Artwork Guide Upload ── */}
                <div>
                  <label className="text-xs text-admin-muted font-medium block mb-2 flex items-center gap-1.5">
                    <FileText size={12} /> Artwork Guide / Template
                    <span className="text-admin-muted font-normal">(PDF, AI, PSD, ZIP…)</span>
                  </label>

                  {form.artworkGuideUrl ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-admin-brand-soft border border-admin-brand-line rounded-xl">
                      <FileText size={16} className="text-admin-brand-ink shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-admin-brand-ink truncate">{form.artworkGuideName || "Artwork Guide"}</div>
                        <a href={form.artworkGuideUrl} target="_blank" rel="noreferrer" className="text-[11px] text-admin-brand-ink hover:underline flex items-center gap-1">
                          <ExternalLink size={10} /> Preview / Download
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm((prev: any) => ({ ...prev, artworkGuideUrl: "", artworkGuideName: "" }))}
                        className="inline-flex items-center justify-center p-1.5 text-admin-danger hover:text-admin-danger hover:bg-admin-danger-soft rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => guideInputRef.current?.click()}
                      disabled={guideUploading}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-admin-border hover:border-admin-brand-line rounded-xl text-sm text-admin-muted hover:text-admin-brand-ink transition-all w-full justify-center"
                    >
                      {guideUploading
                        ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                        : <><Upload size={15} /> Upload artwork guide file</>}
                    </button>
                  )}
                  <input ref={guideInputRef} type="file" accept=".pdf,.ai,.psd,.eps,.zip,.png,.jpg,.jpeg,.svg" className="hidden" onChange={handleGuideUpload} />
                </div>

                {/* Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-admin-muted font-medium block mb-1">Production Time (badge)</label>
                    <input
                      value={config.productionTime || ""}
                      onChange={e => setC({ productionTime: e.target.value })}
                      className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning bg-admin-surface"
                      placeholder="e.g. 2-7 working days"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-admin-muted font-medium block mb-1">Size Label (badge)</label>
                    <input
                      value={config.sizeLabel || ""}
                      onChange={e => setC({ sizeLabel: e.target.value })}
                      className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning bg-admin-surface"
                      placeholder="e.g. Standard Size, A4, Custom"
                    />
                  </div>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-admin-muted cursor-pointer">
                    <input type="checkbox" checked={form.featured} onChange={e => f("featured", e.target.checked)} className="w-4 h-4 rounded accent-admin-warning" />
                    <span>⭐ Featured</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-admin-muted cursor-pointer">
                    <input type="checkbox" checked={form.active} onChange={e => f("active", e.target.checked)} className="w-4 h-4 rounded accent-admin-warning" />
                    <span>Active (visible on site)</span>
                  </label>
                </div>
              </section>

              <div className="border-t border-admin-border" />

              {/* ── SECTION 2: Pricing ── */}
              <section className="space-y-4">
                  <h3 className="text-xs font-bold text-admin-muted uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} /> Pricing & Business Format
                  </h3>

                {/* Business-friendly product format */}
                <div className="rounded-2xl border border-admin-brand-line bg-admin-brand p-4 sm:p-5">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-admin-brand-ink">Product setup</p>
                      <h4 className="mt-1 text-base font-bold text-admin-ink">What are you adding?</h4>
                    </div>
                    <p className="text-[11px] text-admin-muted">Choose the closest format — you can still add custom options below.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { value: "ready_made" as const, type: "standard", label: "Ready-made product", sub: "Frames, albums, gifts, wall décor", example: "One base price + stock" },
                      { value: "frame_print" as const, type: "multi_size_tier", label: "Photo frame or print", sub: "Sizes, packs, and quantity tiers", example: "A4 / A3 / custom sizes" },
                      { value: "print_service" as const, type: "custom_print", label: "Printing service", sub: "Business cards, flyers, photos, books", example: "Quantity-based pricing" },
                      { value: "finishing" as const, type: "multi_prints", label: "Paper & finishing", sub: "Paper, sides, lamination, cutting", example: "Material combinations" },
                    ].map(opt => {
                      const isSelected = config.productFormat === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setC({ productFormat: opt.value, productType: opt.type as CustomConfig["productType"] })}
                          className={`rounded-2xl border-2 p-4 text-left transition-all ${isSelected ? "border-admin-brand-line bg-admin-surface shadow-md shadow-admin-shadow" : "border-white/80 bg-admin-surface/65 hover:border-admin-brand-line hover:bg-admin-surface"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${isSelected ? "border-admin-brand-line bg-admin-brand" : "border-admin-border"}`}>
                              {isSelected && <span className="h-2 w-2 rounded-full bg-admin-surface" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-admin-ink">{opt.label}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-admin-muted">{opt.sub}</span>
                              <span className="mt-2 inline-flex rounded-full bg-admin-subtle px-2 py-1 text-[10px] font-semibold text-admin-muted">{opt.example}</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── STANDARD: Simple Price ── */}
                {config.productType === "standard" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-admin-surface rounded-2xl">
                      <div>
                        <label className="text-xs text-admin-muted font-medium block mb-1">Regular Price (Rs.) *</label>
                        <input
                          required
                          type="number"
                          value={form.price}
                          onChange={e => f("price", e.target.value)}
                          className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning bg-admin-surface"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-admin-muted font-medium block mb-1">Stock Quantity</label>
                        <input
                          type="number"
                          value={config.stockQty}
                          onChange={e => setC({ stockQty: e.target.value })}
                          className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning bg-admin-surface"
                          placeholder="e.g. 50"
                        />
                      </div>
                    </div>

                    {/* ── Quantity Settings ── */}
                    <div className="p-4 bg-admin-surface/60 border border-admin-border rounded-2xl space-y-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Hash size={12} className="text-admin-muted" />
                        <span className="text-xs font-bold text-admin-ink uppercase tracking-wide">Order Quantity Settings</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-admin-muted font-medium block mb-1">Minimum Order Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={config.minQuantity ?? 1}
                            onChange={e => setC({ minQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-2 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-border bg-admin-surface"
                            placeholder="1"
                          />
                          <p className="text-[10px] text-admin-muted mt-1">Minimum units customer must order</p>
                        </div>
                        <div>
                          <label className="text-[11px] text-admin-muted font-medium block mb-1">Quantity Step</label>
                          <input
                            type="number"
                            min={1}
                            value={config.quantityStep ?? 1}
                            onChange={e => setC({ quantityStep: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-2 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-border bg-admin-surface"
                            placeholder="1"
                          />
                          <p className="text-[10px] text-admin-muted mt-1">
                            Step size (1=any, 5 → 100, 105, 110…)
                          </p>
                        </div>
                      </div>
                      {(config.minQuantity > 1 || config.quantityStep > 1) && (
                        <p className="text-[11px] text-admin-muted bg-admin-subtle px-3 py-1.5 rounded-lg">
                          Customer will order from <strong>{config.minQuantity || 1}</strong> units, in steps of <strong>{config.quantityStep || 1}</strong>
                          {config.quantityStep > 1 ? ` (e.g. ${config.minQuantity || 1}, ${(config.minQuantity || 1) + (config.quantityStep || 1)}, ${(config.minQuantity || 1) + 2 * (config.quantityStep || 1)}…)` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── CUSTOM PRINT: Base Pricing Builder ── */}
                {config.productType === "custom_print" && (
                  <div className="border border-admin-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-admin-surface border-b border-admin-border">
                        <span className="text-sm font-semibold text-admin-ink">Printing service pricing</span>
                    </div>

                    <div className="p-5 space-y-5">
                      <div>
                        <label className="text-xs text-admin-muted font-medium block mb-2">Pricing Model</label>
                        <select
                          value={config.pricingModel}
                          onChange={e => setC({ pricingModel: e.target.value as any })}
                          className="w-full px-4 py-2.5 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-warning bg-admin-surface"
                        >
                          <option value="fixed_quantities">Fixed Quantities (e.g. 100 pcs = Rs. 1500)</option>
                          <option value="range_per_unit">Range / Per Unit (e.g. 1–5 sheets = Rs. 350/unit)</option>
                        </select>
                      </div>

                      {config.pricingModel === "fixed_quantities" ? (
                        <FixedPriceTable rows={config.fixedPrices} onChange={r => setC({ fixedPrices: r })} />
                      ) : (
                        <RangePriceTable rows={config.rangePrices} onChange={r => setC({ rangePrices: r })} />
                      )}

                      {/* ── Custom Order Quantity Settings ── */}
                      <div className="p-4 bg-admin-surface/60 border border-admin-border rounded-2xl space-y-3 mt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Hash size={12} className="text-admin-muted" />
                          <span className="text-xs font-bold text-admin-ink uppercase tracking-wide">Custom Order Quantity Settings</span>
                        </div>
                        <p className="text-[11px] text-admin-muted -mt-1">
                          Controls the "Custom Quantity" option customers see in the cart. They can order any amount above the minimum, increasing in the step you set.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-admin-muted font-medium block mb-1">Minimum Custom Order Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={config.minQuantity ?? 1}
                              onChange={e => setC({ minQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-3 py-2 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-border bg-admin-surface"
                              placeholder="e.g. 100"
                            />
                            <p className="text-[10px] text-admin-muted mt-1">Lowest qty for custom orders</p>
                          </div>
                          <div>
                            <label className="text-[11px] text-admin-muted font-medium block mb-1">Quantity Step</label>
                            <input
                              type="number"
                              min={1}
                              value={config.quantityStep ?? 1}
                              onChange={e => setC({ quantityStep: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-3 py-2 border border-admin-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-admin-border bg-admin-surface"
                              placeholder="e.g. 5"
                            />
                            <p className="text-[10px] text-admin-muted mt-1">
                              1 = any value · 5 → 100, 105, 110…
                            </p>
                          </div>
                        </div>
                        {(config.minQuantity > 1 || config.quantityStep > 1) && (
                          <p className="text-[11px] text-admin-muted bg-admin-subtle px-3 py-1.5 rounded-lg">
                            Customer will order from <strong>{config.minQuantity || 1}</strong> pcs, in steps of <strong>{config.quantityStep || 1}</strong>
                            {config.quantityStep > 1 ? ` → ${config.minQuantity || 1}, ${(config.minQuantity || 1) + (config.quantityStep || 1)}, ${(config.minQuantity || 1) + 2 * (config.quantityStep || 1)}…` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── MULTI-SIZE TIER: Size builder ── */}
                {config.productType === "multi_size_tier" && (
                  <div className="space-y-3">
                    <div className="p-4 bg-admin-brand-soft/60 border border-admin-brand-line rounded-2xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Ruler size={12} className="text-admin-brand-ink" />
                        <span className="text-xs font-bold text-admin-brand-ink uppercase tracking-wide">Frame / print sizes & quantity pricing</span>
                      </div>
                      <p className="text-[11px] text-admin-muted mb-3">
                        Add the sizes you sell for this frame or print. Set pack multiples, minimum quantities, and price tiers that adjust automatically as the customer changes quantity.
                      </p>
                      <SizeTierBuilder sizes={config.sizes || []} onChange={s => setC({ sizes: s })} productImages={form.galleryImages || []} />
                    </div>
                  </div>
                )}
              </section>

                {/* ── MULTI PRINTS: Board Type Builder ── */}
                {config.productType === "multi_prints" && (
                  <div className="space-y-3">
                    <div className="p-4 bg-admin-brand-soft/60 border border-admin-brand-line rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Layers size={13} className="text-admin-brand-ink" />
                          <span className="text-xs font-bold text-admin-brand-ink uppercase tracking-wide">Paper & finishing combinations</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setC({ multiPrintsBoardTypes: [...(config.multiPrintsBoardTypes || []), emptyMPBoard()] })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-admin-brand text-white text-xs font-bold rounded-lg hover:bg-admin-brand"
                        >
                          <Plus size={12} /> Add material
                        </button>
                      </div>
                      <p className="text-[11px] text-admin-muted mb-3">
                        Add the papers or boards you offer (for example photo paper, art board, or mounted board). Each material can have its own print sides, lamination, corner cutting, and base price.
                      </p>
                      {(!config.multiPrintsBoardTypes || config.multiPrintsBoardTypes.length === 0) && (
                        <div className="text-center py-8 text-admin-brand-ink border-2 border-dashed border-admin-brand-line rounded-xl">
                          <Layers size={28} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-medium">No materials added yet</p>
                          <p className="text-[11px] mt-0.5">Add paper, board, or finishing materials to start</p>
                        </div>
                      )}
                      {(config.multiPrintsBoardTypes || []).map((board, i) => (
                        <MPBoardCard
                          key={board.id}
                          board={board}
                          index={i}
                          total={(config.multiPrintsBoardTypes || []).length}
                          onChange={updated => { const arr = [...(config.multiPrintsBoardTypes || [])]; arr[i] = updated; setC({ multiPrintsBoardTypes: arr }); }}
                          onRemove={() => setC({ multiPrintsBoardTypes: (config.multiPrintsBoardTypes || []).filter((_, j) => j !== i) })}
                          onMoveUp={() => { const arr = [...(config.multiPrintsBoardTypes || [])]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setC({ multiPrintsBoardTypes: arr }); }}
                          onMoveDown={() => { const arr = [...(config.multiPrintsBoardTypes || [])]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; setC({ multiPrintsBoardTypes: arr }); }}
                        />
                      ))}
                    </div>
                  </div>
                )}

              <div className="border-t border-admin-border" />

              {/* ── SECTION 3: Selection Options / Add-ons (All Product Types) ── */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-admin-muted uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} /> Customer Choices, Prices & Photos
                </h3>
                <p className="text-[11px] text-admin-muted -mt-2">
                  Add the choices customers can select — such as frame size, paper, finish, print side, or service type. Each choice can have its own price and linked product photo.
                  <span className="block mt-1 text-admin-success">For frame colours: add a group named <strong>Frame Colour</strong>, add each colour as a choice, then use <strong>Upload item photos</strong> inside that choice. Those photos stay with the selected colour and do not enter the default product gallery.</span>
                  {config.productType === "multi_size_tier" && config.sizes?.length > 0 && (
                    <span className="text-admin-brand-ink font-medium"> You can set different prices per size using the ruler icon on each choice.</span>
                  )}
                </p>

                {config.optionGroups.length === 0 ? (
                  <div className="text-center py-8 text-admin-muted border-2 border-dashed border-admin-border rounded-2xl">
                    <Layers size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No option groups yet</p>
                    <p className="text-xs mt-1">Add options like Print Sides, Lamination, Board Type, Paper Size, etc.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.optionGroups.map((g, i) => (
                      <OptionGroupCard
                        key={g.id}
                        group={g}
                        index={i}
                        total={config.optionGroups.length}
                        onChange={ng => setC({ optionGroups: config.optionGroups.map((x, xi) => xi === i ? ng : x) })}
                        onRemove={() => setC({ optionGroups: config.optionGroups.filter((_, xi) => xi !== i) })}
                        onMoveUp={() => moveGroup(i, i - 1)}
                        onMoveDown={() => moveGroup(i, i + 1)}
                        dragHandleProps={{}}
                        sizes={config.productType === "multi_size_tier" ? config.sizes : undefined}
                        productImages={form.galleryImages || []}
                        onUploadImages={uploadProductImages}
                      />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setC({ optionGroups: [...config.optionGroups, { id: uid(), title: "", choices: [] }] })}
                  className="w-full py-3 border-2 border-dashed border-admin-warning-line text-admin-warning text-sm font-semibold rounded-2xl hover:bg-admin-warning-soft transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add choice group
                </button>
              </section>

              <div className="border-t border-admin-border" />

              {/* Customer-facing promotional offer */}
              <section className="space-y-4 rounded-2xl border border-admin-warning-line bg-admin-brand p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-admin-ink"><Gift size={16} className="text-admin-warning" /> Customer Offer</h3>
                    <p className="mt-1 text-[11px] text-admin-muted">Show a product-specific free gift or promotion in the catalog and product page.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-admin-ink">
                    <input type="checkbox" checked={config.offerEnabled} onChange={e => setC({ offerEnabled: e.target.checked })} className="h-4 w-4 accent-admin-warning" /> Enable offer
                  </label>
                </div>
                {config.offerEnabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-admin-muted">Minimum order value (Rs.)</label>
                      <input type="number" min={0} step="0.01" value={config.offerMinAmount || ""} onChange={e => setC({ offerMinAmount: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-xl border border-admin-warning-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="e.g. 1500" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-admin-muted">Offer message</label>
                      <textarea value={config.offerMessage} onChange={e => setC({ offerMessage: e.target.value })} rows={2} className="w-full resize-none rounded-xl border border-admin-warning-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin-warning" placeholder="e.g. Get a FREE cute sticker pack with this order!" />
                    </div>
                  </div>
                )}
                            </section>
              {/* Product-level checkout payment rules */}
              <section className="space-y-4 rounded-2xl border border-admin-brand-line bg-admin-brand p-4 sm:p-5">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-admin-ink"><CreditCard size={16} className="text-admin-brand-ink" /> Checkout Payment Options</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-admin-muted">Control payment methods for this product. These settings override the old global checkout switches and are applied when this product is in the cart.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className={`rounded-2xl border p-4 transition-colors ${config.codEnabled ? "border-admin-success-line bg-admin-success-soft/70" : "border-admin-border bg-admin-surface/75"}`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={config.codEnabled} onChange={e => setC({ codEnabled: e.target.checked })} className="mt-0.5 h-4 w-4 accent-admin-success" />
                      <span>
                        <span className="block text-sm font-bold text-admin-ink">Cash on delivery</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-admin-muted">Allow customers to pay cash when this product is delivered.</span>
                      </span>
                    </label>
                    {config.codEnabled && (
                      <div className="mt-3">
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-admin-muted">COD message</label>
                        <input value={config.codMessage} onChange={e => setC({ codMessage: e.target.value })} className="w-full rounded-xl border border-admin-success-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin-success" placeholder="Pay cash when your order is delivered." />
                      </div>
                    )}
                  </div>
                  <div className={`rounded-2xl border p-4 transition-colors ${config.fullPaymentOfferEnabled ? "border-admin-brand-line bg-admin-brand-soft/70" : "border-admin-border bg-admin-surface/75"}`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={config.fullPaymentOfferEnabled} onChange={e => setC({ fullPaymentOfferEnabled: e.target.checked })} className="mt-0.5 h-4 w-4 accent-admin-brand" />
                      <span>
                        <span className="block text-sm font-bold text-admin-ink">Full-payment offer</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-admin-muted">Offer a discount when the customer pays the full order amount upfront.</span>
                      </span>
                    </label>
                    {config.fullPaymentOfferEnabled && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-admin-muted">Discount (%)</label>
                          <div className="relative">
                            <input type="number" min={0} max={100} step="0.1" value={config.fullPaymentOfferDiscount || ""} onChange={e => setC({ fullPaymentOfferDiscount: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-full rounded-xl border border-admin-brand-line bg-admin-surface px-3 py-2.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-admin-brand" placeholder="5" />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-admin-brand-ink">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-admin-muted">Offer message</label>
                          <input value={config.fullPaymentOfferMessage} onChange={e => setC({ fullPaymentOfferMessage: e.target.value })} className="w-full rounded-xl border border-admin-brand-line bg-admin-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin-brand" placeholder="Pay in full and save on this product." />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="w-full py-3.5 bg-admin-brand text-white font-bold rounded-2xl disabled:opacity-60 hover:opacity-90 transition-opacity shadow-lg shadow-admin-shadow/20"
                >
                  {(creating || updating) ? "Saving..." : editing ? "Update Product" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Product"
        message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"?` : ""}
        confirmLabel="Delete Product"
        onConfirm={() => { if (deleteConfirm) deleteProduct({ id: deleteConfirm.id }); }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Manage Categories Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-admin-inverse/60 backdrop-blur-sm">
          <div className="flex min-h-full items-start sm:items-center justify-center p-3 sm:p-4">
            <div className="bg-admin-surface rounded-2xl shadow-2xl w-full max-w-2xl my-4 sm:my-0" style={{ maxHeight: "calc(100vh - 32px)" }}>
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-admin-border sticky top-0 bg-admin-surface rounded-t-2xl">
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-admin-ink flex items-center gap-2"><Tag size={18} className="text-admin-warning" /> Manage Categories</h2>
                  <p className="text-[11px] sm:text-xs text-admin-muted mt-0.5">Add, edit or remove product categories</p>
                </div>
                <button onClick={() => { setShowCatModal(false); cancelCatEdit(); }} className="inline-flex items-center justify-center p-1.5 hover:bg-admin-subtle rounded-lg"><X size={18} /></button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
                {/* Add / Edit form */}
                <form onSubmit={saveCat} className="bg-admin-surface border border-admin-border rounded-xl p-3 sm:p-4">
                  <div className="text-xs font-bold text-admin-muted uppercase tracking-wide mb-2">{catEditing ? `Editing: ${catEditing.name}` : "New Category"}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-medium text-admin-muted block mb-1">Name *</label>
                      <input
                        value={catForm.name}
                        onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Wedding Cards"
                        className="w-full px-3 py-2 border border-admin-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-admin-warning"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-admin-muted block mb-1">Sort Order</label>
                      <input
                        type="number"
                        value={catForm.sortOrder}
                        onChange={e => setCatForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-admin-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-admin-warning"
                      />
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <label className="text-[10px] font-medium text-admin-muted block mb-1">Description (optional)</label>
                    <input
                      value={catForm.description}
                      onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Short description"
                      className="w-full px-3 py-2 border border-admin-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-admin-warning"
                    />
                  </div>
                  {catFormError && <p className="text-xs text-admin-danger mt-2">{catFormError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={catSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-admin-brand text-white text-xs sm:text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-60"
                    >
                      {catSaving ? <Loader2 size={13} className="animate-spin" /> : catEditing ? <Edit2 size={13} /> : <Plus size={13} />}
                      {catSaving ? "Saving..." : catEditing ? "Update" : "Add Category"}
                    </button>
                    {catEditing && (
                      <button type="button" onClick={cancelCatEdit} className="px-3 py-2 text-xs sm:text-sm text-admin-muted border border-admin-border rounded-lg hover:bg-admin-subtle">Cancel</button>
                    )}
                  </div>
                </form>

                {/* Category list */}
                <div className="border border-admin-border rounded-xl overflow-hidden">
                  {(categories ?? []).length === 0 ? (
                    <div className="text-center py-10 text-admin-muted">
                      <Tag size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No categories yet</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-admin-border">
                      {(categories ?? []).map((cat: any) => {
                        const count = (products ?? []).filter((p: any) => p.categoryId === cat.id).length;
                        const isEditing = catEditing?.id === cat.id;
                        return (
                          <li key={cat.id} className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 ${isEditing ? "bg-admin-warning-soft" : "hover:bg-admin-surface"}`}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-admin-ink text-sm truncate">{cat.name}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-admin-warning-soft text-admin-warning rounded-full border border-admin-warning-line shrink-0">{count}</span>
                              </div>
                              {cat.description && <p className="text-[11px] text-admin-muted truncate mt-0.5">{cat.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openCatEdit(cat)}
                                className="inline-flex items-center justify-center p-1.5 text-admin-muted hover:text-admin-brand-ink hover:bg-admin-brand-soft rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => deleteCat(cat)}
                                disabled={catDeletingId === cat.id}
                                className="inline-flex items-center justify-center p-1.5 text-admin-muted hover:text-admin-danger hover:bg-admin-danger-soft rounded-lg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                {catDeletingId === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
