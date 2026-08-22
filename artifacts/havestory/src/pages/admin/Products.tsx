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
type FixedPrice = { qty: number; price: string };
type RangePrice = { from: number; to: number; pricePerUnit: string };
type Choice = { id: string; name: string; price: string; chargeType: "flat" | "per_unit"; imageUrl?: string; imageUrls?: string[]; sizePrices?: { sizeId: string; price: string }[] };
type OptionGroup = { id: string; title: string; choices: Choice[] };
type SizeTier = { from: number; to: number; pricePerUnit: string };
type ProductSize = { id: string; name: string; packSize: number; unitLabel: string; minQty: number; tiers: SizeTier[]; imageUrl?: string; imageUrls?: string[] };

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
    <span className="inline-flex rounded-lg overflow-hidden border border-gray-300 text-xs font-semibold">
      <button type="button" onClick={() => onChange("unit")} className={`px-3 py-1 transition ${value === "unit" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Unit Price</button>
      <button type="button" onClick={() => onChange("qty-range")} className={`px-3 py-1 border-l border-gray-300 transition ${value === "qty-range" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Qty Range</button>
    </span>
  );
}

/* ── MP Tier editor ── */
function MPTierEditor({ tiers, onChange }: { tiers: MPTier[]; onChange: (t: MPTier[]) => void }) {
  const up = (i: number, patch: Partial<MPTier>) => { const n = tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t); onChange(n); };
  return (
    <div className="mt-2 space-y-1">
      {tiers.length > 0 && (
        <div className="grid grid-cols-[80px_80px_1fr_24px] gap-1 text-[10px] text-gray-400 uppercase font-semibold px-1">
          <span>Min Qty</span><span>Max Qty</span><span>Price (Rs.)</span><span />
        </div>
      )}
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[80px_80px_1fr_24px] gap-1 items-center">
          <input type="number" min={1} value={t.minQty} onChange={e => up(i, { minQty: parseInt(e.target.value) || 1 })} className="px-2 py-1 border rounded text-xs" placeholder="Min" />
          <input type="number" value={t.maxQty ?? ""} onChange={e => up(i, { maxQty: e.target.value ? parseInt(e.target.value) : null })} className="px-2 py-1 border rounded text-xs" placeholder="Max(∞)" />
          <input type="number" value={t.price} onChange={e => up(i, { price: e.target.value })} className="px-2 py-1 border rounded text-xs" placeholder="Price" />
          <button type="button" onClick={() => onChange(tiers.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400"><X size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...tiers, emptyMPTier()])} className="text-xs text-indigo-500 font-semibold hover:text-indigo-700 flex items-center gap-1 mt-1"><Plus size={11} /> Add Tier</button>
    </div>
  );
}

/* ── MP PriceBlock (unit or qty-range) ── */
function MPPriceBlock({ mode, unitPrice, tiers, onMode, onUnit, onTiers }: { mode: MPPricingMode; unitPrice: string; tiers: MPTier[]; onMode: (m: MPPricingMode) => void; onUnit: (v: string) => void; onTiers: (t: MPTier[]) => void }) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-gray-500 font-medium">Mode</span>
        <MPModeToggle value={mode} onChange={onMode} />
      </div>
      {mode === "unit"
        ? <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Rs.</span><input type="number" value={unitPrice} onChange={e => onUnit(e.target.value)} className="w-32 px-2 py-1 border rounded text-sm" placeholder="Price per unit" /></div>
        : <MPTierEditor tiers={tiers} onChange={onTiers} />}
    </div>
  );
}

/* ── MP Print Side card ── */
function MPPrintSideCard({ ps, onChange, onRemove }: { ps: MPPrintSide; onChange: (p: MPPrintSide) => void; onRemove: () => void }) {
  return (
    <div className="mb-2 p-3 bg-white rounded-xl border border-blue-200">
      <div className="flex justify-between mb-2">
        <span className="text-xs font-bold text-blue-700">Print Side Option</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
          <select value={ps.name} onChange={e => onChange({ ...ps, name: e.target.value as MPPrintSide["name"] })} className="w-full px-2 py-1.5 border rounded text-xs">
            <option value="one-side">One Side Print</option>
            <option value="double-side">Double Side Print</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Label</label>
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
    <div className="mb-2 p-3 bg-white rounded-xl border border-stone-200">
      <div className="flex justify-between mb-2">
        <span className="text-xs font-bold text-stone-700">Lamination Option</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
          <select value={lam.name} onChange={e => onChange({ ...lam, name: e.target.value as MPLamination["name"] })} className="w-full px-2 py-1.5 border rounded text-xs">
            <option value="none">No Lamination</option>
            <option value="one-side-gloss">One Side Gloss</option>
            <option value="one-side-matte">One Side Matte</option>
            <option value="double-side-gloss">Double Side Gloss</option>
            <option value="double-side-matte">Double Side Matte</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Label</label>
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
    <div className="border-2 border-gray-200 rounded-2xl overflow-hidden mb-4 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <span className="flex-1 font-bold text-gray-800 text-sm">{board.name || `Board Type ${index + 1}`} {board.gsm ? `(${board.gsm}gsm)` : ""}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${board.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{board.isActive ? "Active" : "Inactive"}</span>
        <div className="flex items-center gap-0.5 ml-2" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={13} /></button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={13} /></button>
          <button type="button" onClick={onRemove} className="p-1 text-gray-300 hover:text-red-400 ml-1"><X size={14} /></button>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 ml-1" /> : <ChevronDown size={14} className="text-gray-400 ml-1" />}
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* ① Details */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-bold text-gray-600 mb-2">① Board Type Details</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Name</label>
                <input value={board.name} onChange={e => onChange({ ...board, name: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="e.g. 300gsm Art Board" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">GSM</label>
                <input type="number" value={board.gsm} onChange={e => onChange({ ...board, gsm: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 border rounded text-sm" />
              </div>
            </div>
            <div className="mb-2">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Description</label>
              <input value={board.description} onChange={e => onChange({ ...board, description: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Brief description" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-medium">Status</span>
              <button type="button" onClick={() => onChange({ ...board, isActive: !board.isActive })} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${board.isActive ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-500 border-gray-300"}`}>{board.isActive ? "Active" : "Inactive"}</button>
            </div>
          </div>

          {/* ② Print Sides */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-blue-800">② Print Sides</p>
              <button type="button" onClick={() => onChange({ ...board, printSides: [...board.printSides, emptyMPPrintSide()] })} className="text-[10px] font-bold px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Option</button>
            </div>
            {board.printSides.length === 0 && <p className="text-[11px] text-blue-400 text-center py-2">No print side options. Click "+ Add Option".</p>}
            {board.printSides.map((ps, i) => <MPPrintSideCard key={ps.id} ps={ps} onChange={u => setPrintSide(i, u)} onRemove={() => removePrintSide(i)} />)}
          </div>

          {/* ③ Laminations */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-stone-800">③ Laminations</p>
              <button type="button" onClick={() => onChange({ ...board, laminations: [...board.laminations, emptyMPLamination()] })} className="text-[10px] font-bold px-2 py-1 bg-stone-600 text-white rounded-lg hover:bg-stone-700">+ Add Option</button>
            </div>
            {board.laminations.length === 0 && <p className="text-[11px] text-stone-400 text-center py-2">No lamination options. Click "+ Add Option".</p>}
            {board.laminations.map((lam, i) => <MPLaminationCard key={lam.id} lam={lam} onChange={u => setLamination(i, u)} onRemove={() => removeLamination(i)} />)}
          </div>

          {/* ④ Base Price */}
          <div className="p-3 bg-green-50 rounded-xl border border-green-200">
            <p className="text-xs font-bold text-green-800 mb-1">④ Base Price (Board Material)</p>
            <p className="text-[10px] text-green-600 mb-2">Cost of the board itself, before options are added.</p>
            <MPPriceBlock mode={board.basePricingMode} unitPrice={board.baseUnitPrice} tiers={board.baseTiers} onMode={m => onChange({ ...board, basePricingMode: m })} onUnit={v => onChange({ ...board, baseUnitPrice: v })} onTiers={t => onChange({ ...board, baseTiers: t })} />
          </div>

          {/* ⑤ Round Corner Cut */}
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-orange-800">⑤ Round Corner Cut (Optional)</p>
              <button
                type="button"
                onClick={() => onChange({ ...board, roundCornerCut: { enabled: !(board.roundCornerCut?.enabled), pricingMode: board.roundCornerCut?.pricingMode ?? "unit", unitPrice: board.roundCornerCut?.unitPrice ?? "", tiers: board.roundCornerCut?.tiers ?? [] } })}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${board.roundCornerCut?.enabled ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-500 border-gray-300 hover:border-orange-300"}`}
              >
                {board.roundCornerCut?.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            {board.roundCornerCut?.enabled && (
              <>
                <p className="text-[10px] text-orange-600 mb-2">Extra charge for rounded corner cutting per unit.</p>
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

const EMPTY_FORM = { name: "", invoiceName: "", description: "", categoryId: "", categoryNewName: "", price: "", imageUrl: "", galleryImages: [] as string[], artworkGuideUrl: "", artworkGuideName: "", featured: false, active: true };

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
        chargeType: choice.chargeType === "per_unit" ? "per_unit" : "flat",
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

function FixedPriceTable({ rows, onChange }: { rows: FixedPrice[]; onChange: (r: FixedPrice[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
        <span>Quantity</span><span className="col-span-2">Price (Rs.)</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 items-center">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={row.qty}
              onChange={e => { const n = [...rows]; n[i] = { ...n[i], qty: Number(e.target.value) }; onChange(n); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="100"
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <input
              type="number"
              value={row.price}
              onChange={e => { const n = [...rows]; n[i] = { ...n[i], price: e.target.value }; onChange(n); }}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="e.g. 1500"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="p-2 text-gray-300 hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { qty: 0, price: "" }])}
        className="text-xs text-amber-500 font-semibold hover:text-amber-700 flex items-center gap-1 mt-1"
      >
        <Plus size={12} /> Add Quantity Tier
      </button>
    </div>
  );
}

function RangePriceTable({ rows, onChange }: { rows: RangePrice[]; onChange: (r: RangePrice[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
        <span>From</span><span>To</span><span className="col-span-2">Price / Unit (Rs.)</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-4 gap-2 items-center">
          <input type="number" value={row.from} onChange={e => { const n = [...rows]; n[i] = { ...n[i], from: Number(e.target.value) }; onChange(n); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="1" />
          <input type="number" value={row.to} onChange={e => { const n = [...rows]; n[i] = { ...n[i], to: Number(e.target.value) }; onChange(n); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="5" />
          <input type="number" value={row.pricePerUnit} onChange={e => { const n = [...rows]; n[i] = { ...n[i], pricePerUnit: e.target.value }; onChange(n); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="350" />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="p-2 text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { from: 0, to: 0, pricePerUnit: "" }])} className="text-xs text-amber-500 font-semibold hover:text-amber-700 flex items-center gap-1 mt-1">
        <Plus size={12} /> Add Range
      </button>
    </div>
  );
}

/* ── Multi-Size Tier Builder ── */
function SizeTierBuilder({ sizes, onChange, productImages = [] }: { sizes: ProductSize[]; onChange: (s: ProductSize[]) => void; productImages?: string[] }) {
  const addSize = () => onChange([...sizes, { id: uid(), name: "", packSize: 1, unitLabel: "Pack", minQty: 1, tiers: [{ from: 1, to: 100, pricePerUnit: "" }] }]);
  const removeSize = (idx: number) => onChange(sizes.filter((_, i) => i !== idx));
  const updateSize = (idx: number, patch: Partial<ProductSize>) => onChange(sizes.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const updateTier = (sIdx: number, tIdx: number, patch: Partial<SizeTier>) => {
    const s = sizes[sIdx];
    const newTiers = s.tiers.map((t, i) => i === tIdx ? { ...t, ...patch } : t);
    updateSize(sIdx, { tiers: newTiers });
  };
  const addTier = (sIdx: number) => {
    const s = sizes[sIdx];
    const lastTo = s.tiers.length > 0 ? s.tiers[s.tiers.length - 1].to : 0;
    updateSize(sIdx, { tiers: [...s.tiers, { from: lastTo, to: lastTo + 100, pricePerUnit: "" }] });
  };
  const removeTier = (sIdx: number, tIdx: number) => {
    const s = sizes[sIdx];
    updateSize(sIdx, { tiers: s.tiers.filter((_, i) => i !== tIdx) });
  };

  return (
    <div className="space-y-4">
      {sizes.map((size, sIdx) => (
        <div key={size.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Ruler size={14} className="text-amber-400 shrink-0" />
            <input
              value={size.name}
              onChange={e => updateSize(sIdx, { name: e.target.value })}
              className="flex-1 text-sm font-semibold bg-transparent outline-none placeholder:text-gray-300"
              placeholder="Size name (e.g. 3cm sticker sheet)"
            />
            <button type="button" onClick={() => removeSize(sIdx)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
          </div>
          <div className="p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-gray-500 font-medium block mb-1">Unit Label</label>
                <div className="relative">
                  <input
                    list={`unit-label-${size.id}`}
                    value={size.unitLabel || ""}
                    onChange={e => updateSize(sIdx, { unitLabel: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="Pack, Sheets, etc."
                  />
                  <datalist id={`unit-label-${size.id}`}>
                    <option value="Pack" />
                    <option value="Sheets" />
                    <option value="Roll" />
                    <option value="Box" />
                    <option value="Set" />
                  </datalist>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 font-medium block mb-1">Pack Size (multiples of)</label>
                <input
                  type="number"
                  min={1}
                  value={size.packSize}
                  onChange={e => updateSize(sIdx, { packSize: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="20"
                />
                <p className="text-[10px] text-gray-400 mt-1">Multiples of {size.packSize || 1}</p>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 font-medium block mb-1">Minimum Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={size.minQty || 1}
                  onChange={e => updateSize(sIdx, { minQty: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="1"
                />
                <p className="text-[10px] text-gray-400 mt-1">Min order qty</p>
              </div>
            </div>

            <div className="rounded-xl border border-violet-100 bg-violet-50/45 p-3">
              <div className="flex items-start gap-3">
                {size.imageUrl ? <img src={size.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-white shadow-sm" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-gray-300 ring-1 ring-gray-200"><Image size={16} /></div>}
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-violet-500">Photo shown for this size</label>
                  <select value={size.imageUrl || ""} onChange={e => updateSize(sIdx, { imageUrl: e.target.value || undefined })} className="w-full rounded-lg border border-violet-100 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-violet-200">
                    <option value="">Use the main product image</option>
                    {productImages.map((image, index) => <option key={image} value={image}>Product photo {index + 1}{index === 0 ? " (cover)" : ""}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] leading-relaxed text-gray-400">This photo appears when a customer selects {size.name || "this size"}.</p>
                </div>
              </div>
              {productImages.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {productImages.map((image, index) => (
                    <button type="button" key={image} onClick={() => updateSize(sIdx, { imageUrl: size.imageUrl === image ? undefined : image })} className={`group relative aspect-square overflow-hidden rounded-lg border-2 bg-white transition ${size.imageUrl === image ? "border-violet-500 ring-2 ring-violet-100" : "border-white hover:border-violet-200"}`} title={`Use product photo ${index + 1}`}>
                      <img src={image} alt={`Product photo ${index + 1}`} className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-bold text-white">{index + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tiers */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Price Tiers</span>
              {/* Desktop header */}
              <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                <span>From</span><span>To</span><span>Rs. / unit</span><span className="w-8"></span>
              </div>
              {size.tiers.map((tier, tIdx) => (
                <div key={tIdx} className="relative border border-gray-100 sm:border-0 rounded-xl sm:rounded-none p-3 sm:p-0">
                  <div className="grid grid-cols-3 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium sm:hidden block mb-1">From</span>
                      <input type="number" value={tier.from} onChange={e => updateTier(sIdx, tIdx, { from: Number(e.target.value) })} className="w-full px-2 py-2 sm:py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="20" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium sm:hidden block mb-1">To</span>
                      <input type="number" value={tier.to} onChange={e => updateTier(sIdx, tIdx, { to: Number(e.target.value) })} className="w-full px-2 py-2 sm:py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="80" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-medium sm:hidden block mb-1">Rs./unit</span>
                      <input type="number" value={tier.pricePerUnit} onChange={e => updateTier(sIdx, tIdx, { pricePerUnit: e.target.value })} className="w-full px-2 py-2 sm:py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="8.00" />
                    </div>
                    <button type="button" onClick={() => removeTier(sIdx, tIdx)} className="absolute top-2 right-2 sm:static p-1.5 text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addTier(sIdx)} className="text-xs text-amber-500 font-semibold hover:text-amber-700 flex items-center gap-1 py-1">
                <Plus size={12} /> Add tier
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addSize}
        className="w-full py-3 border-2 border-dashed border-amber-200 text-amber-500 text-sm font-semibold rounded-2xl hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Add another size
      </button>
    </div>
  );
}

function ChoiceRow({ choice, onChange, onRemove, sizes, productImages = [], onUploadImages }: { choice: Choice; onChange: (c: Choice) => void; onRemove: () => void; sizes?: ProductSize[]; productImages?: string[]; onUploadImages?: (files: File[]) => Promise<string[]> }) {
  const [showSizePrices, setShowSizePrices] = useState(false);
  const [itemUploading, setItemUploading] = useState(false);
  const itemPhotoInputRef = useRef<HTMLInputElement>(null);
  const hasSizes = sizes && sizes.length > 0;

  const handleItemPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !onUploadImages) return;
    setItemUploading(true);
    try {
      const urls = await onUploadImages(files);
      const merged = [...new Set([...(choice.imageUrls || []), ...urls])];
      onChange({ ...choice, imageUrls: merged });
    } catch {
      alert("Some item photos failed to upload. Please try again.");
    } finally {
      setItemUploading(false);
      event.target.value = "";
    }
  };

  const removeItemPhoto = (url: string) => {
    const remaining = (choice.imageUrls || []).filter(image => image !== url);
    onChange({ ...choice, imageUrls: remaining.length ? remaining : undefined });
  };

  const updateSizePrice = (sizeId: string, price: string) => {
    const existing = choice.sizePrices || [];
    const idx = existing.findIndex(sp => sp.sizeId === sizeId);
    let updated: { sizeId: string; price: string }[];
    if (idx >= 0) {
      updated = existing.map((sp, i) => i === idx ? { ...sp, price } : sp);
    } else {
      updated = [...existing, { sizeId, price }];
    }
    onChange({ ...choice, sizePrices: updated });
  };

  const getSizePrice = (sizeId: string): string => {
    return choice.sizePrices?.find(sp => sp.sizeId === sizeId)?.price || "";
  };

  return (
    <div className="bg-gray-50 p-2 rounded-xl space-y-2">
      <div className="flex gap-2 items-center">
        <input value={choice.name} onChange={e => onChange({ ...choice, name: e.target.value })} className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="e.g. Matte" />
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2">
          <span className="text-xs text-gray-400">Rs.</span>
          <input type="number" min="0" value={choice.price} onChange={e => onChange({ ...choice, price: e.target.value })} className="w-16 py-1.5 text-sm outline-none" placeholder="0" aria-label={`${choice.name || "Choice"} price`} />
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...choice, price: "0" })}
          className={`shrink-0 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors ${choice.price === "0" ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-white text-gray-400 hover:border-emerald-200 hover:text-emerald-600"}`}
          title="Set this choice to no extra charge"
        >
          No extra charge
        </button>
        <select value={choice.chargeType} onChange={e => onChange({ ...choice, chargeType: e.target.value as any })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white outline-none">
          <option value="flat">Flat Fee</option>
          <option value="per_unit">Per Unit</option>
        </select>
        {hasSizes && (
          <button
            type="button"
            onClick={() => setShowSizePrices(!showSizePrices)}
            className={`p-1.5 rounded-lg transition-colors ${showSizePrices ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
            title="Set different prices per size"
          >
            <Ruler size={14} />
          </button>
        )}
        <button type="button" onClick={onRemove} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
      </div>
      <p className="px-1 text-[10px] leading-relaxed text-gray-400">Price is optional. Leave it blank or choose <span className="font-semibold text-emerald-600">No extra charge</span> for a zero-cost choice.</p>

      <div className="rounded-xl border border-violet-100 bg-violet-50/45 p-3">
        <div className="flex items-start gap-3">
          {choice.imageUrl ? <img src={choice.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-white shadow-sm" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-gray-300 ring-1 ring-gray-200"><Image size={16} /></div>}
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-violet-500">Photo shown for this price / choice</label>
            <select value={choice.imageUrl || ""} onChange={e => onChange({ ...choice, imageUrl: e.target.value || undefined })} className="w-full rounded-lg border border-violet-100 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-violet-200">
              <option value="">Use the main product image</option>
              {productImages.map((image, index) => <option key={image} value={image}>Product photo {index + 1}{index === 0 ? " (cover)" : ""}</option>)}
            </select>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-400">When a customer selects this choice, this photo becomes the product preview and is saved with the cart item.</p>
          </div>
        </div>
        {productImages.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {productImages.map((image, index) => (
              <button type="button" key={image} onClick={() => onChange({ ...choice, imageUrl: choice.imageUrl === image ? undefined : image })} className={`group relative aspect-square overflow-hidden rounded-lg border-2 bg-white transition ${choice.imageUrl === image ? "border-violet-500 ring-2 ring-violet-100" : "border-white hover:border-violet-200"}`} title={`Use product photo ${index + 1}`}>
                <img src={image} alt={`Product photo ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-bold text-white">{index + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/45 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Item-specific photos</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Upload photos only for <span className="font-semibold text-gray-700">{choice.name || "this choice"}</span>. These stay linked to this item and never enter the default product photo list.</p>
          </div>
          <button type="button" onClick={() => itemPhotoInputRef.current?.click()} disabled={itemUploading || !onUploadImages} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-2 text-[10px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
            {itemUploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {itemUploading ? "Uploading…" : "Upload item photos"}
          </button>
          <input ref={itemPhotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleItemPhotoUpload} />
        </div>
        {(choice.imageUrls || []).length > 0 ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {(choice.imageUrls || []).map((url, index) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-white bg-white shadow-sm">
                <img src={url} alt={`${choice.name || "Item"} photo ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeItemPhoto(url)} title="Remove item photo" className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"><X size={11} /></button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-bold text-white">Item photo {index + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-emerald-200 bg-white/60 px-3 py-2 text-[10px] text-emerald-700/65">No item-specific photos uploaded yet.</div>
        )}
      </div>

      {/* Size-dependent pricing */}
      {hasSizes && showSizePrices && (
        <div className="ml-2 pl-3 border-l-2 border-blue-200 space-y-1.5">
          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Price per size (overrides base price)</p>
          {sizes.map(size => (
            <div key={size.id} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-32 truncate" title={size.name}>{size.name || "Unnamed"}</span>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2">
                <span className="text-[10px] text-gray-400">Rs.</span>
                <input
                  type="number"
                  value={getSizePrice(size.id)}
                  onChange={e => updateSizePrice(size.id, e.target.value)}
                  className="w-16 py-1 text-xs outline-none"
                  placeholder={choice.price || "0"}
                />
              </div>
              <span className="text-[10px] text-gray-400">{choice.chargeType === "per_unit" ? "/unit" : "flat"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionGroupCard({
  group, index, total,
  onChange, onRemove, onMoveUp, onMoveDown,
  dragHandleProps,
  sizes,
  productImages,
  onUploadImages,
}: {
  group: OptionGroup; index: number; total: number;
  onChange: (g: OptionGroup) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragHandleProps: any;
  sizes?: ProductSize[];
  productImages?: string[];
  onUploadImages?: (files: File[]) => Promise<string[]>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white" {...dragHandleProps}>
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 cursor-grab active:cursor-grabbing">
        <GripVertical size={16} className="text-gray-300 shrink-0" />
        <input
          value={group.title}
          onChange={e => onChange({ ...group, title: e.target.value })}
          className="flex-1 text-sm font-semibold bg-transparent outline-none placeholder:text-gray-300"
          placeholder="Option Group Title (e.g. Frame Colour)"
          onClick={e => e.stopPropagation()}
        />
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"><ChevronUp size={14} /></button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"><ChevronDown size={14} /></button>
          <button type="button" onClick={() => setCollapsed(c => !c)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button type="button" onClick={onRemove} className="p-1 text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-2">
          <div className="flex gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
            <span className="flex-1">Choice / item name</span>
            <span className="w-28 text-center">Price</span>
            <span className="w-24 text-center">Price basis</span>
            <span className="w-6" />
          </div>
          {group.choices.map((c, ci) => (
            <ChoiceRow
              key={c.id}
              choice={c}
              onChange={nc => onChange({ ...group, choices: group.choices.map((x, xi) => xi === ci ? nc : x) })}
              onRemove={() => onChange({ ...group, choices: group.choices.filter((_, xi) => xi !== ci) })}
              sizes={sizes}
              productImages={productImages}
              onUploadImages={onUploadImages}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...group, choices: [...group.choices, { id: uid(), name: "", price: "", chargeType: "flat" }] })}
            className="text-xs text-amber-500 font-semibold hover:text-amber-700 flex items-center gap-1 mt-2"
          >
            <Plus size={12} /> Add Choice
          </button>
        </div>
      )}
    </div>
  );
}

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
      <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-200">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange({ id: null, name: e.target.value }); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          placeholder="Select existing or type a new category…"
        />
        {query && (
          <button type="button" onMouseDown={e => { e.preventDefault(); clear(); }} className="text-gray-300 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 && !query.trim() && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">No categories yet — type to create one</div>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(c); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2 ${value.id === c.id ? "bg-amber-50 text-amber-700 font-semibold" : "text-gray-700"}`}
            >
              <Tag size={12} className="shrink-0 opacity-50" />
              {c.name}
              {value.id === c.id && <span className="ml-auto text-[10px] text-amber-400 font-bold">Selected</span>}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); createNew(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors flex items-center gap-2 border-t border-gray-100 font-semibold"
            >
              <Plus size={12} className="shrink-0" />
              Create new: &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}

      {value.id === null && value.name && (
        <p className="mt-1 text-[11px] text-stone-600 flex items-center gap-1">
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
    setForm({ name: p.name, invoiceName: (p as any).invoiceName || "", description: p.description, categoryId: String(p.categoryId || ""), categoryNewName: "", imageUrl: p.imageUrl || "", galleryImages: allImgs, artworkGuideUrl: p.artworkGuideUrl || "", artworkGuideName: p.artworkGuideName || "", featured: p.featured, active: p.active, price: p.price });
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
    return p.name?.toLowerCase().includes(q) || p.category?.name?.toLowerCase().includes(q);
  });

  const f = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-xs sm:text-sm text-gray-400">{products?.length ?? 0} products · {categories?.length ?? 0} categories {readOnly&&"· View only"}</p>
        </div>
        {!readOnly&&<div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={openCatModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
            title="Add, edit or delete product categories"
          >
            <Tag size={13} /> Manage Categories
          </button>
          <button
            onClick={seedDefaultCategories}
            disabled={seedingCats}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-sm font-semibold hover:bg-stone-100 transition-colors disabled:opacity-60"
            title="Seed 10 default printing categories"
          >
            {seedingCats ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Default Categories
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-stone-600 text-white text-sm font-semibold shadow-md shadow-amber-500/20 hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Product
          </button>
        </div>}
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-3 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name or category..." className="flex-1 text-sm outline-none placeholder:text-gray-400" />
        {search && <button onClick={() => setSearch("")}><X size={14} className="text-gray-300" /></button>}
      </div>

      {/* Product Cards Grid */}
      {productsLoading ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center">
          <Loader2 size={30} className="mx-auto text-amber-500 mb-3 animate-spin" />
          <p className="font-semibold text-gray-600">Loading products…</p>
          <p className="text-sm text-gray-400 mt-1">Fetching the latest catalog</p>
        </div>
      ) : productsError ? (
        <div className="bg-white border border-rose-100 rounded-2xl py-16 px-6 text-center">
          <Package size={42} className="mx-auto text-rose-300 mb-3" />
          <p className="font-semibold text-rose-700">Products could not be loaded</p>
          <p className="text-sm text-gray-500 mt-1">The catalog request failed. Your existing products have not been deleted.</p>
          <button
            type="button"
            onClick={() => void refetchProducts()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            <Loader2 size={14} /> Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-20 text-center">
          <Package size={44} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-400">No products yet</p>
          <p className="text-sm text-gray-300 mt-1">Click "Add Product" to create your first one</p>
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
              <div key={p.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                {/* ── MOBILE: horizontal list row ── */}
                <div className="flex sm:hidden items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="relative w-[72px] h-[72px] shrink-0 rounded-xl bg-gray-50 overflow-hidden">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <div className="w-full h-full flex items-center justify-center"><Image size={24} className="text-gray-200" /></div>
                    }
                    <span className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${p.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                      {p.active ? "On" : "Off"}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {p.category && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">{p.category.name}</span>}
                      {p.featured && <span className="text-[9px] font-bold text-amber-500 uppercase">⭐ Featured</span>}
                      {isCustom && <span className="text-[9px] font-bold text-stone-500 uppercase">Custom</span>}
                      {isMultiSize && <span className="text-[9px] font-bold text-blue-500 uppercase">Multi-Size</span>}
                      {isMultiPrints && <span className="text-[9px] font-bold text-indigo-500 uppercase">Multi Prints</span>}
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{p.name}</h3>
                    <div className="text-xs font-semibold text-amber-600 mt-0.5">{priceLabel}{!isCustom && !isMultiSize && <span className="text-gray-400 font-normal ml-1">/ item</span>}</div>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{parseDescriptionLines(p.description).join(" • ")}</p>
                  </div>
                  {/* Actions */}
                  {!readOnly&&<div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(p)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>}
                </div>

                {/* ── DESKTOP sm+: vertical card ── */}
                <div className="hidden sm:flex flex-col h-full">
                  {/* Image */}
                  <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Image size={32} className="text-gray-200" /></div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      {p.featured && <span className="px-2 py-0.5 bg-amber-400 text-white text-[10px] font-bold rounded-full">⭐ Featured</span>}
                      {isCustom && <span className="px-2 py-0.5 bg-stone-500 text-white text-[10px] font-bold rounded-full">Custom Print</span>}
                      {isMultiSize && <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">Multi-Size</span>}
                      {isMultiPrints && <span className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full">Multi Prints</span>}
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    {p.category && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">{p.category.name}</span>}
                    <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3 flex-1">{parseDescriptionLines(p.description).join(" • ")}</p>
                    {isMultiPrints ? (
                      <div className="space-y-1">
                        {(cfg.multiPrintsBoardTypes || []).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {(cfg.multiPrintsBoardTypes || []).map((b: MPBoardType) => (
                              <span key={b.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded-lg">
                                {b.name || "Unnamed"} · {b.gsm}gsm · {b.printSides.length}PS · {b.laminations.length}Lam
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">No board types set</span>
                        )}
                      </div>
                    ) : isMultiSize ? (
                      <div className="space-y-1">
                        {(cfg.sizes || []).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {(cfg.sizes || []).map((sz: ProductSize) => (
                              <span key={sz.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-lg">
                                {sz.name || "Unnamed"} · ×{sz.packSize} · {sz.tiers.length} tier{sz.tiers.length !== 1 ? "s" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">No sizes set</span>
                        )}
                      </div>
                    ) : isCustom ? (
                      <div className="space-y-1">
                        {cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices.filter(x => x.price).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {cfg.fixedPrices.filter(x => x.price).map((fp, i) => (
                              <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-lg">{fp.qty} pcs · {rs(fp.price)}</span>
                            ))}
                          </div>
                        ) : cfg.pricingModel === "range_per_unit" && cfg.rangePrices.filter(x => x.pricePerUnit).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {cfg.rangePrices.filter(x => x.pricePerUnit).map((rp, i) => (
                              <span key={i} className="px-2 py-0.5 bg-stone-50 text-stone-700 text-[10px] font-semibold rounded-lg">{rp.from}–{rp.to} · {rs(rp.pricePerUnit)}/unit</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">No pricing set</span>
                        )}
                        {cfg.optionGroups.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {cfg.optionGroups.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">{g.title}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="font-bold text-amber-600">{rs(p.price)}<span className="text-xs text-gray-400 font-normal ml-1">/ item</span></div>
                    )}
                    {!readOnly&&<div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex-1 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                        className="flex-1 py-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1"
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
          <div className="flex-1 bg-black/40 backdrop-blur-sm" />
          {/* Panel */}
          <div
            className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-stone-600 flex items-center justify-center">
                  <Package size={15} className="text-white" />
                </div>
                <h2 className="font-bold text-gray-900 text-lg">{editing ? "Edit Product" : "Add New Product"}</h2>
              </div>
              <button onClick={closeForm} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 p-6 space-y-6">
              {/* ── SECTION 1: Basic Info ── */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Tag size={12} /> Basic Information
                </h3>

                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Product Name *</label>
                  <input required value={form.name} onChange={e => f("name", e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="e.g. Gallery Walnut Frame" />
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">
                    Invoice Name
                    <span className="ml-1.5 text-gray-400 font-normal normal-case">(short name for invoices — leave blank to use Product Name)</span>
                  </label>
                  <input value={form.invoiceName || ""} onChange={e => f("invoiceName", e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200" placeholder="e.g. Biz Cards Premium" />
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Description</label>
                  <DescriptionEditor
                    value={form.description || ""}
                    onChange={v => f("description", v)}
                    placeholder="Describe this product…"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Category</label>
                  <CategoryCombobox
                    categories={categories ?? []}
                    value={catValue}
                    onChange={v => setCatValue(v)}
                  />
                </div>

                {/* ── Multi-Image Upload ── */}
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-2 flex items-center gap-1.5">
                    <ImagePlus size={12} /> Product Images
                    <span className="text-gray-400 font-normal">(first image = cover)</span>
                  </label>

                  {/* Image Grid */}
                  {form.galleryImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {form.galleryImages.map((url: string, idx: number) => (
                        <div key={url} className="relative group w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-100 shrink-0">
                          <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                          {/* Cover badge */}
                          {idx === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-[9px] font-bold text-center py-0.5">Cover</div>
                          )}
                          {/* Actions on hover */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                            {idx !== 0 && (
                              <button type="button" onClick={() => setCover(url)} title="Set as cover" className="p-1 bg-yellow-400 rounded-full text-white hover:bg-yellow-500">
                                <StarIcon size={10} fill="currentColor" />
                              </button>
                            )}
                            <button type="button" onClick={() => removeImage(url)} className="p-1 bg-red-500 rounded-full text-white hover:bg-red-600">
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
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 hover:border-amber-300 rounded-xl text-sm text-gray-400 hover:text-amber-500 transition-all w-full justify-center"
                  >
                    {imgUploading
                      ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                      : <><Upload size={15} /> Add Images (select multiple)</>}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
                  <p className="text-[10px] text-gray-400 mt-1">You can select multiple files at once. Click ⭐ on a thumbnail to set it as cover.</p>
                </div>

                {/* ── Artwork Guide Upload ── */}
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-2 flex items-center gap-1.5">
                    <FileText size={12} /> Artwork Guide / Template
                    <span className="text-gray-400 font-normal">(PDF, AI, PSD, ZIP…)</span>
                  </label>

                  {form.artworkGuideUrl ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <FileText size={16} className="text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-blue-800 truncate">{form.artworkGuideName || "Artwork Guide"}</div>
                        <a href={form.artworkGuideUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 hover:underline flex items-center gap-1">
                          <ExternalLink size={10} /> Preview / Download
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm((prev: any) => ({ ...prev, artworkGuideUrl: "", artworkGuideName: "" }))}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => guideInputRef.current?.click()}
                      disabled={guideUploading}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl text-sm text-gray-400 hover:text-blue-500 transition-all w-full justify-center"
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
                    <label className="text-xs text-gray-500 font-medium block mb-1">Production Time (badge)</label>
                    <input
                      value={config.productionTime || ""}
                      onChange={e => setC({ productionTime: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                      placeholder="e.g. 2-7 working days"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Size Label (badge)</label>
                    <input
                      value={config.sizeLabel || ""}
                      onChange={e => setC({ sizeLabel: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                      placeholder="e.g. Standard Size, A4, Custom"
                    />
                  </div>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.featured} onChange={e => f("featured", e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                    <span>⭐ Featured</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.active} onChange={e => f("active", e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                    <span>Active (visible on site)</span>
                  </label>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* ── SECTION 2: Pricing ── */}
              <section className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} /> Pricing & Business Format
                  </h3>

                {/* Business-friendly product format */}
                <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-amber-50/70 p-4 sm:p-5">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500">Product setup</p>
                      <h4 className="mt-1 text-base font-bold text-gray-900">What are you adding?</h4>
                    </div>
                    <p className="text-[11px] text-gray-500">Choose the closest format — you can still add custom options below.</p>
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
                          className={`rounded-2xl border-2 p-4 text-left transition-all ${isSelected ? "border-violet-400 bg-white shadow-md shadow-violet-100" : "border-white/80 bg-white/65 hover:border-violet-200 hover:bg-white"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${isSelected ? "border-violet-500 bg-violet-500" : "border-gray-300"}`}>
                              {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-gray-900">{opt.label}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-gray-500">{opt.sub}</span>
                              <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-500">{opt.example}</span>
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
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl">
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Regular Price (Rs.) *</label>
                        <input
                          required
                          type="number"
                          value={form.price}
                          onChange={e => f("price", e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Stock Quantity</label>
                        <input
                          type="number"
                          value={config.stockQty}
                          onChange={e => setC({ stockQty: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
                          placeholder="e.g. 50"
                        />
                      </div>
                    </div>

                    {/* ── Quantity Settings ── */}
                    <div className="p-4 bg-stone-50/60 border border-stone-100 rounded-2xl space-y-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Hash size={12} className="text-stone-500" />
                        <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Order Quantity Settings</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-500 font-medium block mb-1">Minimum Order Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={config.minQuantity ?? 1}
                            onChange={e => setC({ minQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200 bg-white"
                            placeholder="1"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Minimum units customer must order</p>
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500 font-medium block mb-1">Quantity Step</label>
                          <input
                            type="number"
                            min={1}
                            value={config.quantityStep ?? 1}
                            onChange={e => setC({ quantityStep: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200 bg-white"
                            placeholder="1"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Step size (1=any, 5 → 100, 105, 110…)
                          </p>
                        </div>
                      </div>
                      {(config.minQuantity > 1 || config.quantityStep > 1) && (
                        <p className="text-[11px] text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg">
                          Customer will order from <strong>{config.minQuantity || 1}</strong> units, in steps of <strong>{config.quantityStep || 1}</strong>
                          {config.quantityStep > 1 ? ` (e.g. ${config.minQuantity || 1}, ${(config.minQuantity || 1) + (config.quantityStep || 1)}, ${(config.minQuantity || 1) + 2 * (config.quantityStep || 1)}…)` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── CUSTOM PRINT: Base Pricing Builder ── */}
                {config.productType === "custom_print" && (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">Printing service pricing</span>
                    </div>

                    <div className="p-5 space-y-5">
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-2">Pricing Model</label>
                        <select
                          value={config.pricingModel}
                          onChange={e => setC({ pricingModel: e.target.value as any })}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white"
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
                      <div className="p-4 bg-stone-50/60 border border-stone-100 rounded-2xl space-y-3 mt-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Hash size={12} className="text-stone-500" />
                          <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Custom Order Quantity Settings</span>
                        </div>
                        <p className="text-[11px] text-gray-400 -mt-1">
                          Controls the "Custom Quantity" option customers see in the cart. They can order any amount above the minimum, increasing in the step you set.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-gray-500 font-medium block mb-1">Minimum Custom Order Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={config.minQuantity ?? 1}
                              onChange={e => setC({ minQuantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200 bg-white"
                              placeholder="e.g. 100"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Lowest qty for custom orders</p>
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-500 font-medium block mb-1">Quantity Step</label>
                            <input
                              type="number"
                              min={1}
                              value={config.quantityStep ?? 1}
                              onChange={e => setC({ quantityStep: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-200 bg-white"
                              placeholder="e.g. 5"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">
                              1 = any value · 5 → 100, 105, 110…
                            </p>
                          </div>
                        </div>
                        {(config.minQuantity > 1 || config.quantityStep > 1) && (
                          <p className="text-[11px] text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg">
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
                    <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Ruler size={12} className="text-blue-500" />
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Frame / print sizes & quantity pricing</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-3">
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
                    <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Layers size={13} className="text-indigo-500" />
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Paper & finishing combinations</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setC({ multiPrintsBoardTypes: [...(config.multiPrintsBoardTypes || []), emptyMPBoard()] })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                        >
                          <Plus size={12} /> Add material
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-3">
                        Add the papers or boards you offer (for example photo paper, art board, or mounted board). Each material can have its own print sides, lamination, corner cutting, and base price.
                      </p>
                      {(!config.multiPrintsBoardTypes || config.multiPrintsBoardTypes.length === 0) && (
                        <div className="text-center py-8 text-indigo-300 border-2 border-dashed border-indigo-200 rounded-xl">
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

              <div className="border-t border-gray-100" />

              {/* ── SECTION 3: Selection Options / Add-ons (All Product Types) ── */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} /> Customer Choices, Prices & Photos
                </h3>
                <p className="text-[11px] text-gray-400 -mt-2">
                  Add the choices customers can select — such as frame size, paper, finish, print side, or service type. Each choice can have its own price and linked product photo.
                  <span className="block mt-1 text-emerald-600">For frame colours: add a group named <strong>Frame Colour</strong>, add each colour as a choice, then use <strong>Upload item photos</strong> inside that choice. Those photos stay with the selected colour and do not enter the default product gallery.</span>
                  {config.productType === "multi_size_tier" && config.sizes?.length > 0 && (
                    <span className="text-blue-500 font-medium"> You can set different prices per size using the ruler icon on each choice.</span>
                  )}
                </p>

                {config.optionGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
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
                  className="w-full py-3 border-2 border-dashed border-amber-200 text-amber-500 text-sm font-semibold rounded-2xl hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add choice group
                </button>
              </section>

              <div className="border-t border-gray-100" />

              {/* Customer-facing promotional offer */}
              <section className="space-y-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-stone-50/80 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800"><Gift size={16} className="text-amber-500" /> Customer Offer</h3>
                    <p className="mt-1 text-[11px] text-gray-500">Show a product-specific free gift or promotion in the catalog and product page.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700">
                    <input type="checkbox" checked={config.offerEnabled} onChange={e => setC({ offerEnabled: e.target.checked })} className="h-4 w-4 accent-amber-500" /> Enable offer
                  </label>
                </div>
                {config.offerEnabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Minimum order value (Rs.)</label>
                      <input type="number" min={0} step="0.01" value={config.offerMinAmount || ""} onChange={e => setC({ offerMinAmount: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. 1500" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Offer message</label>
                      <textarea value={config.offerMessage} onChange={e => setC({ offerMessage: e.target.value })} rows={2} className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-300" placeholder="e.g. Get a FREE cute sticker pack with this order!" />
                    </div>
                  </div>
                )}
                            </section>
              {/* Product-level checkout payment rules */}
              <section className="space-y-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/75 to-slate-50/80 p-4 sm:p-5">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800"><CreditCard size={16} className="text-violet-600" /> Checkout Payment Options</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Control payment methods for this product. These settings override the old global checkout switches and are applied when this product is in the cart.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className={`rounded-2xl border p-4 transition-colors ${config.codEnabled ? "border-emerald-200 bg-emerald-50/70" : "border-gray-200 bg-white/75"}`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={config.codEnabled} onChange={e => setC({ codEnabled: e.target.checked })} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                      <span>
                        <span className="block text-sm font-bold text-gray-800">Cash on delivery</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">Allow customers to pay cash when this product is delivered.</span>
                      </span>
                    </label>
                    {config.codEnabled && (
                      <div className="mt-3">
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">COD message</label>
                        <input value={config.codMessage} onChange={e => setC({ codMessage: e.target.value })} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Pay cash when your order is delivered." />
                      </div>
                    )}
                  </div>
                  <div className={`rounded-2xl border p-4 transition-colors ${config.fullPaymentOfferEnabled ? "border-violet-200 bg-violet-50/70" : "border-gray-200 bg-white/75"}`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={config.fullPaymentOfferEnabled} onChange={e => setC({ fullPaymentOfferEnabled: e.target.checked })} className="mt-0.5 h-4 w-4 accent-violet-600" />
                      <span>
                        <span className="block text-sm font-bold text-gray-800">Full-payment offer</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">Offer a discount when the customer pays the full order amount upfront.</span>
                      </span>
                    </label>
                    {config.fullPaymentOfferEnabled && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Discount (%)</label>
                          <div className="relative">
                            <input type="number" min={0} max={100} step="0.1" value={config.fullPaymentOfferDiscount || ""} onChange={e => setC({ fullPaymentOfferDiscount: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-violet-200" placeholder="5" />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-violet-500">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Offer message</label>
                          <input value={config.fullPaymentOfferMessage} onChange={e => setC({ fullPaymentOfferMessage: e.target.value })} className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-200" placeholder="Pay in full and save on this product." />
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
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-stone-600 text-white font-bold rounded-2xl disabled:opacity-60 hover:opacity-90 transition-opacity shadow-lg shadow-amber-500/20"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="flex min-h-full items-start sm:items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 sm:my-0" style={{ maxHeight: "calc(100vh - 32px)" }}>
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900 flex items-center gap-2"><Tag size={18} className="text-amber-500" /> Manage Categories</h2>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Add, edit or remove product categories</p>
                </div>
                <button onClick={() => { setShowCatModal(false); cancelCatEdit(); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
                {/* Add / Edit form */}
                <form onSubmit={saveCat} className="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{catEditing ? `Editing: ${catEditing.name}` : "New Category"}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-medium text-gray-500 block mb-1">Name *</label>
                      <input
                        value={catForm.name}
                        onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Wedding Cards"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block mb-1">Sort Order</label>
                      <input
                        type="number"
                        value={catForm.sortOrder}
                        onChange={e => setCatForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <label className="text-[10px] font-medium text-gray-500 block mb-1">Description (optional)</label>
                    <input
                      value={catForm.description}
                      onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Short description"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  {catFormError && <p className="text-xs text-red-500 mt-2">{catFormError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={catSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-stone-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:opacity-90 disabled:opacity-60"
                    >
                      {catSaving ? <Loader2 size={13} className="animate-spin" /> : catEditing ? <Edit2 size={13} /> : <Plus size={13} />}
                      {catSaving ? "Saving..." : catEditing ? "Update" : "Add Category"}
                    </button>
                    {catEditing && (
                      <button type="button" onClick={cancelCatEdit} className="px-3 py-2 text-xs sm:text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
                    )}
                  </div>
                </form>

                {/* Category list */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {(categories ?? []).length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Tag size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No categories yet</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {(categories ?? []).map((cat: any) => {
                        const count = (products ?? []).filter((p: any) => p.categoryId === cat.id).length;
                        const isEditing = catEditing?.id === cat.id;
                        return (
                          <li key={cat.id} className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 ${isEditing ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm truncate">{cat.name}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100 shrink-0">{count}</span>
                              </div>
                              {cat.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{cat.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openCatEdit(cat)}
                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => deleteCat(cat)}
                                disabled={catDeletingId === cat.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
