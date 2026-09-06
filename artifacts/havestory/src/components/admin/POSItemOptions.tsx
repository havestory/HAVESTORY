import { Plus } from "lucide-react";
import { FixedPriceTable, RangePriceTable, SizeTierBuilder, OptionGroupCard, type FixedPrice, type RangePrice, type OptionGroup, type ProductSize } from "./ProductOptionEditor";

export type POSItemConfig = {
  productType: "standard" | "custom_print" | "multi_size_tier";
  pricingModel: "fixed_quantities" | "range_per_unit";
  fixedPrices: FixedPrice[];
  rangePrices: RangePrice[];
  sizes: ProductSize[];
  optionGroups: OptionGroup[];
  minQuantity: number;
  quantityStep: number;
};
export const emptyPOSConfig = (): POSItemConfig => ({ productType: "standard", pricingModel: "range_per_unit", fixedPrices: [], rangePrices: [], sizes: [], optionGroups: [], minQuantity: 1, quantityStep: 1 });

export function POSItemOptions({ config, onChange }: { config: POSItemConfig; onChange: (config: POSItemConfig) => void }) {
  const uploadImages = async (files: File[]) => Promise.all(files.map(async file => {
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/settings/upload-image", { method: "POST", credentials: "include", body: form });
    if (!response.ok) throw new Error("Image upload failed");
    const data = await response.json();
    return data.url as string;
  }));
  const images = [...new Set(config.optionGroups.flatMap(group => group.choices.flatMap(choice => choice.imageUrls || [])))];
  const patch = (value: Partial<POSItemConfig>) => onChange({ ...config, ...value });
  const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  const move = (index: number, step: number) => {
    const groups = [...config.optionGroups];
    [groups[index], groups[index + step]] = [groups[index + step], groups[index]];
    patch({ optionGroups: groups });
  };
  return <div className="space-y-4 text-slate-900" style={{ gridColumn: "1 / -1", minWidth: 0 }}>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">Pricing
        <select className={field} value={config.productType} onChange={e => patch({ productType: e.target.value as POSItemConfig["productType"], sizes: e.target.value === "multi_size_tier" ? config.sizes : [] })}>
          <option value="standard">Unit price</option><option value="custom_print">Quantity pricing</option><option value="multi_size_tier">Size &amp; unit pricing</option>
        </select>
      </label>
      <label className="text-sm font-semibold">Minimum quantity<input className={field} type="number" min="1" step="1" value={config.minQuantity} onChange={e => patch({ minQuantity: Number(e.target.value) })} /></label>
      <label className="text-sm font-semibold">Quantity step<input className={field} type="number" min="1" step="1" value={config.quantityStep} onChange={e => patch({ quantityStep: Number(e.target.value) })} /></label>
    </div>
    {config.productType === "custom_print" && <div className="space-y-3 rounded-xl border bg-white p-4">
      <label className="block text-sm font-semibold">Quantity price basis<select className={field} value={config.pricingModel} onChange={e => patch({ pricingModel: e.target.value as POSItemConfig["pricingModel"] })}><option value="range_per_unit">Range / per unit</option><option value="fixed_quantities">Fixed quantity / total price</option></select></label>
      {config.pricingModel === "fixed_quantities" ? <FixedPriceTable rows={config.fixedPrices} onChange={fixedPrices => patch({ fixedPrices })} /> : <RangePriceTable rows={config.rangePrices} onChange={rangePrices => patch({ rangePrices })} />}
    </div>}
    {config.productType === "multi_size_tier" && <SizeTierBuilder sizes={config.sizes} onChange={sizes => patch({ sizes })} />}
    <p className="text-sm text-slate-600">Choose a flat fee charged once, a per-unit add-on, or quantity-range pricing for each option.</p>
    {config.optionGroups.map((group, index) => <OptionGroupCard key={group.id} group={group} index={index} total={config.optionGroups.length} sizes={config.sizes} productImages={images} onUploadImages={uploadImages} allowRange dragHandleProps={{}} onChange={next => patch({ optionGroups: config.optionGroups.map((g, i) => i === index ? next : g) })} onRemove={() => patch({ optionGroups: config.optionGroups.filter((_, i) => i !== index) })} onMoveUp={() => move(index, -1)} onMoveDown={() => move(index, 1)} />)}
    <button type="button" onClick={() => patch({ optionGroups: [...config.optionGroups, { id: crypto.randomUUID(), title: "", choices: [] }] })} className="flex min-h-11 items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900"><Plus size={16} /> Add option group</button>
  </div>;
}
