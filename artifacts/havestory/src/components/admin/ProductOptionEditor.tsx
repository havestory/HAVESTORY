import { useState, useRef } from "react";
import { Plus, X, GripVertical, ChevronUp, ChevronDown, Ruler, Image, ImagePlus, Loader2 } from "lucide-react";
const uid = () => crypto.randomUUID();
export type FixedPrice = { qty: number; price: string };
export type RangePrice = { from: number; to: number; pricePerUnit: string };
export type Choice = { id: string; name: string; price: string; chargeType: "flat" | "per_unit" | "qty_range"; priceTiers?: RangePrice[]; imageUrl?: string; imageUrls?: string[]; sizePrices?: { sizeId: string; price: string }[] };
export type OptionGroup = { id: string; title: string; choices: Choice[] };
type SizeTier = { from: number; to: number; pricePerUnit: string };
export type ProductSize = { id: string; name: string; packSize: number; unitLabel: string; minQty: number; tiers: SizeTier[]; imageUrl?: string; imageUrls?: string[] };

export function FixedPriceTable({ rows, onChange }: { rows: FixedPrice[]; onChange: (r: FixedPrice[]) => void }) {
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

export function RangePriceTable({ rows, onChange }: { rows: RangePrice[]; onChange: (r: RangePrice[]) => void }) {
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
export function SizeTierBuilder({ sizes, onChange, productImages = [] }: { sizes: ProductSize[]; onChange: (s: ProductSize[]) => void; productImages?: string[] }) {
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
    updateSize(sIdx, { tiers: [...s.tiers, { from: lastTo + 1, to: lastTo + 100, pricePerUnit: "" }] });
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
              className="min-w-0 flex-1 text-sm font-semibold bg-transparent outline-none placeholder:text-gray-300"
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

function ChoiceRow({ allowRange = false, choice, onChange, onRemove, sizes, productImages = [], onUploadImages }: { allowRange?: boolean; choice: Choice; onChange: (c: Choice) => void; onRemove: () => void; sizes?: ProductSize[]; productImages?: string[]; onUploadImages?: (files: File[]) => Promise<string[]> }) {
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
      <div className="flex flex-wrap gap-2 items-center">
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
          <option value="per_unit">Per Unit</option>{allowRange && <option value="qty_range">Quantity Range</option>}
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

      {choice.chargeType === "qty_range" && <RangePriceTable rows={choice.priceTiers || []} onChange={priceTiers => onChange({ ...choice, priceTiers })} />}
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

export function OptionGroupCard({
  allowRange = false, group, index, total,
  onChange, onRemove, onMoveUp, onMoveDown,
  dragHandleProps,
  sizes,
  productImages,
  onUploadImages,
}: {
  allowRange?: boolean; group: OptionGroup; index: number; total: number;
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
          className="min-w-0 flex-1 text-sm font-semibold bg-transparent outline-none placeholder:text-gray-300"
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
              allowRange={allowRange}
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

