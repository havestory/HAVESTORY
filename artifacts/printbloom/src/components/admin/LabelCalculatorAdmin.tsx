import { useEffect, useState } from "react";
import { Calculator, Check, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";

type ChargeType = "per_sheet" | "per_label" | "flat";
type Choice = { id: string; name: string; price: number; chargeType: ChargeType; priceTiers?: PriceTier[] };
type Group = { id: string; title: string; choices: Choice[] };
type Shape = "round" | "rectangle" | "square";
type Product = { id: string; name: string; enabled: boolean; sheetIds?: string[]; shapes?: Shape[]; optionGroups: Group[] };
type PriceTier = { minQty: number; maxQty: number | null; price: number };
type Sheet = { id: string; name: string; widthMm: number; heightMm: number; price: number; marginMm?: number; marginTopMm?: number; marginBottomMm?: number; marginLeftMm?: number; marginRightMm?: number; gapMm: number; enabled: boolean; priceTiers?: PriceTier[] };
type Config = { enabled: boolean; pricingMessage?: string; sheets: Sheet[]; products: Product[] };

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const initial: Config = { enabled: true, pricingMessage: "", sheets: [], products: [] };

export function LabelCalculatorAdmin() {
  const [config, setConfig] = useState<Config>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openProduct, setOpenProduct] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/label-calculator", { credentials: "include" })
      .then(r => r.json()).then(data => setConfig(data)).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch("/api/label-calculator", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Save failed");
      setConfig(await res.json()); setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { alert("Calculator settings could not be saved. Please re-login and try again."); }
    finally { setSaving(false); }
  };

  const updateSheet = (id: string, patch: Partial<Sheet>) => setConfig(c => ({ ...c, sheets: c.sheets.map(s => s.id === id ? { ...s, ...patch } : s) }));
  const updateProduct = (id: string, patch: Partial<Product>) => setConfig(c => ({ ...c, products: c.products.map(p => p.id === id ? { ...p, ...patch } : p) }));

  if (loading) return <div className="bg-white border rounded-2xl p-6 text-sm text-gray-400">Loading Smart Print Calculator…</div>;

  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Calculator className="text-blue-600" size={20} /><h2 className="font-bold text-gray-900">Smart Print Calculator</h2></div>
          <p className="text-xs text-gray-400 mt-1">Set sheet prices, margins, gaps, products and priced customer options.</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={13} /> Saved</span>}
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"><Save size={14} /> {saving ? "Saving…" : "Save Calculator"}</button>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold">
        <button type="button" onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))} className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? "translate-x-1" : "-translate-x-4"}`} />
        </button>
        Show calculator on homepage
      </label>

      <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-4">
        <label className="block text-xs font-bold text-gray-700">
          Customer Pricing Message
          <textarea
            value={config.pricingMessage || ""}
            onChange={e => setConfig(current => ({ ...current, pricingMessage: e.target.value }))}
            rows={3}
            maxLength={500}
            placeholder="Quantity වැඩි කරන තරමට price per sticker අඩු වෙන්න පුළුවන්..."
            className="mt-2 w-full resize-y rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm font-normal text-gray-700 outline-none focus:ring-2 focus:ring-pink-200"
          />
        </label>
        <p className="mt-1 text-[10px] text-gray-400">This message appears above the next two better-value quantity suggestions. Sinhala + English mix is supported.</p>
      </div>

      <section>
        <div className="flex justify-between items-center mb-3"><div><h3 className="font-bold text-gray-800">Sheet Sizes & Selling Prices</h3><p className="text-xs text-gray-400">Margin and gap are measured in millimetres.</p></div>
          <button onClick={() => setConfig(c => ({ ...c, sheets: [...c.sheets, { id: uid("sheet"), name: "New Sheet", widthMm: 210, heightMm: 297, price: 180, marginMm: 5, marginTopMm: 5, marginBottomMm: 5, marginLeftMm: 5, marginRightMm: 5, gapMm: 2, enabled: true, priceTiers: [] }] }))} className="text-xs font-bold text-blue-600 flex items-center gap-1"><Plus size={14} /> Add Sheet</button>
        </div>
        <div className="space-y-3">
          {config.sheets.map(sheet => (
            <div key={sheet.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
              <label className="sm:col-span-2 text-[10px] text-gray-400">NAME<input value={sheet.name} onChange={e => updateSheet(sheet.id,{name:e.target.value})} className="admin-calc-input" /></label>
              <label className="text-[10px] text-gray-400">WIDTH mm<input type="number" min={1} value={sheet.widthMm} onChange={e => updateSheet(sheet.id,{widthMm:+e.target.value})} className="admin-calc-input" /></label>
              <label className="text-[10px] text-gray-400">HEIGHT mm<input type="number" min={1} value={sheet.heightMm} onChange={e => updateSheet(sheet.id,{heightMm:+e.target.value})} className="admin-calc-input" /></label>
              <label className="text-[10px] text-gray-400">SELLING Rs.<input type="number" min={0} value={sheet.price} onChange={e => updateSheet(sheet.id,{price:+e.target.value})} className="admin-calc-input" /></label>
              <div className="col-span-2 sm:col-span-5 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-blue-700">Printable Area Margins (mm)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="text-[10px] text-gray-400">TOP<input type="number" min={0} value={sheet.marginTopMm ?? sheet.marginMm ?? 0} onChange={e => updateSheet(sheet.id,{marginTopMm:+e.target.value})} className="admin-calc-input" /></label>
                  <label className="text-[10px] text-gray-400">BOTTOM<input type="number" min={0} value={sheet.marginBottomMm ?? sheet.marginMm ?? 0} onChange={e => updateSheet(sheet.id,{marginBottomMm:+e.target.value})} className="admin-calc-input" /></label>
                  <label className="text-[10px] text-gray-400">LEFT<input type="number" min={0} value={sheet.marginLeftMm ?? sheet.marginMm ?? 0} onChange={e => updateSheet(sheet.id,{marginLeftMm:+e.target.value})} className="admin-calc-input" /></label>
                  <label className="text-[10px] text-gray-400">RIGHT<input type="number" min={0} value={sheet.marginRightMm ?? sheet.marginMm ?? 0} onChange={e => updateSheet(sheet.id,{marginRightMm:+e.target.value})} className="admin-calc-input" /></label>
                </div>
              </div>
              <label className="text-[10px] text-gray-400">STICKER GAP mm<input type="number" min={0} value={sheet.gapMm} onChange={e => updateSheet(sheet.id,{gapMm:+e.target.value})} className="admin-calc-input" /></label>
              <div className="col-span-2 sm:col-span-5 border-t border-gray-200 pt-3 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <div><div className="text-xs font-bold text-gray-700">Advanced Quantity-Range Pricing</div><p className="text-[10px] text-gray-400">Price is per sheet. Example: 1–9 = Rs.180, 10–24 = Rs.165.</p></div>
                  <button type="button" onClick={()=>updateSheet(sheet.id,{priceTiers:[...(sheet.priceTiers||[]),{minQty:1,maxQty:null,price:sheet.price}]})} className="text-xs font-bold text-blue-600 flex items-center gap-1"><Plus size={13}/> Add Range</button>
                </div>
                {!!sheet.priceTiers?.length && <div className="grid grid-cols-[1fr_1fr_1.2fr_28px] gap-2 text-[9px] uppercase text-gray-400 font-bold px-1 mb-1"><span>Min Sheets</span><span>Max Sheets</span><span>Price / Sheet</span><span/></div>}
                <div className="space-y-1.5">
                  {(sheet.priceTiers||[]).map((tier,index)=><div key={index} className="grid grid-cols-[1fr_1fr_1.2fr_28px] gap-2">
                    <input type="number" min={1} value={tier.minQty} onChange={e=>updateSheet(sheet.id,{priceTiers:(sheet.priceTiers||[]).map((t,i)=>i===index?{...t,minQty:+e.target.value||1}:t)})} className="admin-calc-input"/>
                    <input type="number" min={1} value={tier.maxQty??""} placeholder="No max" onChange={e=>updateSheet(sheet.id,{priceTiers:(sheet.priceTiers||[]).map((t,i)=>i===index?{...t,maxQty:e.target.value?+e.target.value:null}:t)})} className="admin-calc-input"/>
                    <input type="number" min={0} value={tier.price} onChange={e=>updateSheet(sheet.id,{priceTiers:(sheet.priceTiers||[]).map((t,i)=>i===index?{...t,price:+e.target.value||0}:t)})} className="admin-calc-input"/>
                    <button type="button" onClick={()=>updateSheet(sheet.id,{priceTiers:(sheet.priceTiers||[]).filter((_,i)=>i!==index)})} className="text-red-400"><Trash2 size={14}/></button>
                  </div>)}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-5 flex justify-between">
                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={sheet.enabled} onChange={e => updateSheet(sheet.id,{enabled:e.target.checked})} /> Active</label>
                <button onClick={() => setConfig(c => ({...c,sheets:c.sheets.filter(s=>s.id!==sheet.id)}))} className="text-red-400"><Trash2 size={15}/></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3"><div><h3 className="font-bold text-gray-800">Print Products & Dropdown Options</h3><p className="text-xs text-gray-400">Examples: Sticker Printing → Lamination / Cut; Business Cards → Finish / Corner Cut.</p></div>
          <button onClick={() => { const id=uid("product"); setConfig(c=>({...c,products:[...c.products,{id,name:"New Print Product",enabled:true,sheetIds:[],shapes:["rectangle"],optionGroups:[]}]})); setOpenProduct(id); }} className="text-xs font-bold text-pink-600 flex items-center gap-1"><Plus size={14}/> Add Product</button>
        </div>
        <div className="space-y-3">
          {config.products.map(product => (
            <div key={product.id} className="border border-gray-150 rounded-xl overflow-hidden">
              <div className="p-3 flex items-center gap-3 bg-gray-50">
                <input value={product.name} onChange={e=>updateProduct(product.id,{name:e.target.value})} className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm font-semibold" />
                <label className="text-xs"><input type="checkbox" checked={product.enabled} onChange={e=>updateProduct(product.id,{enabled:e.target.checked})}/> Active</label>
                <button onClick={()=>setOpenProduct(v=>v===product.id?null:product.id)}>{openProduct===product.id?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>
                <button onClick={()=>setConfig(c=>({...c,products:c.products.filter(p=>p.id!==product.id)}))} className="text-red-400"><Trash2 size={15}/></button>
              </div>
              {openProduct===product.id && <div className="p-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-xl border border-pink-100 bg-pink-50/30">
                  <div>
                    <div className="text-xs font-bold text-gray-700 mb-2">Available Sheet Types</div>
                    <div className="flex flex-wrap gap-2">
                      {config.sheets.map(sheet => <label key={sheet.id} className="px-2.5 py-1.5 rounded-lg bg-white border text-xs flex items-center gap-1.5"><input type="checkbox" checked={(product.sheetIds||[]).includes(sheet.id)} onChange={e=>updateProduct(product.id,{sheetIds:e.target.checked?[...(product.sheetIds||[]),sheet.id]:(product.sheetIds||[]).filter(id=>id!==sheet.id)})}/>{sheet.name}</label>)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Customers only see the selected sheets for this product. Leave all unchecked to allow every active sheet.</p>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-700 mb-2">Available Shapes</div>
                    <div className="flex flex-wrap gap-2">
                      {(["round","rectangle","square"] as Shape[]).map(shape=><label key={shape} className="px-2.5 py-1.5 rounded-lg bg-white border text-xs flex items-center gap-1.5 capitalize"><input type="checkbox" checked={(product.shapes||["rectangle"]).includes(shape)} onChange={e=>updateProduct(product.id,{shapes:e.target.checked?[...(product.shapes||[]),shape]:(product.shapes||[]).filter(v=>v!==shape)})}/>{shape}</label>)}
                    </div>
                  </div>
                </div>
                {product.optionGroups.map(group => (
                  <div key={group.id} className="p-3 rounded-xl bg-blue-50/40 border border-blue-100">
                    <div className="flex gap-2 mb-3">
                      <input value={group.title} onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,title:e.target.value}:g)})} className="flex-1 px-3 py-2 border rounded-lg text-sm font-bold" placeholder="Dropdown title" />
                      <button onClick={()=>updateProduct(product.id,{optionGroups:product.optionGroups.filter(g=>g.id!==group.id)})} className="text-red-400"><Trash2 size={15}/></button>
                    </div>
                    <div className="space-y-2">
                      {group.choices.map(choice=>(
                        <div key={choice.id} className="rounded-xl border border-blue-100 bg-white p-2.5">
                          <div className="grid grid-cols-[1fr_100px_125px_28px] gap-2">
                            <input value={choice.name} onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,name:e.target.value}:c)}:g)})} className="admin-calc-input" placeholder="Choice name"/>
                            <input type="number" value={choice.price} onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,price:+e.target.value}:c)}:g)})} className="admin-calc-input" />
                            <select value={choice.chargeType} onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,chargeType:e.target.value as ChargeType}:c)}:g)})} className="admin-calc-input"><option value="per_sheet">Per Sheet</option><option value="per_label">Per Label</option><option value="flat">Flat</option></select>
                            <button onClick={()=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.filter(c=>c.id!==choice.id)}:g)})} className="text-red-400"><Trash2 size={14}/></button>
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed border-blue-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Advanced {choice.chargeType==="per_sheet"?"Sheet":"Quantity"} Ranges</span>
                              <button type="button" onClick={()=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,priceTiers:[...(c.priceTiers||[]),{minQty:1,maxQty:null,price:c.price}]}:c)}:g)})} className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Plus size={11}/> Add Range</button>
                            </div>
                            {!!choice.priceTiers?.length&&<div className="grid grid-cols-[1fr_1fr_1.2fr_25px] gap-1.5 mt-2 text-[9px] uppercase font-bold text-gray-400"><span>Min</span><span>Max</span><span>Price</span><span/></div>}
                            {(choice.priceTiers||[]).map((tier,ti)=><div key={ti} className="grid grid-cols-[1fr_1fr_1.2fr_25px] gap-1.5 mt-1">
                              <input type="number" min={1} value={tier.minQty} onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,priceTiers:(c.priceTiers||[]).map((t,i)=>i===ti?{...t,minQty:+e.target.value||1}:t)}:c)}:g)})} className="admin-calc-input"/>
                              <input type="number" min={1} value={tier.maxQty??""} placeholder="No max" onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,priceTiers:(c.priceTiers||[]).map((t,i)=>i===ti?{...t,maxQty:e.target.value?+e.target.value:null}:t)}:c)}:g)})} className="admin-calc-input"/>
                              <input type="number" min={0} value={tier.price} onChange={e=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,priceTiers:(c.priceTiers||[]).map((t,i)=>i===ti?{...t,price:+e.target.value||0}:t)}:c)}:g)})} className="admin-calc-input"/>
                              <button type="button" onClick={()=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:g.choices.map(c=>c.id===choice.id?{...c,priceTiers:(c.priceTiers||[]).filter((_,i)=>i!==ti)}:c)}:g)})} className="text-red-400"><Trash2 size={12}/></button>
                            </div>)}
                          </div>
                        </div>
                      ))}                   </div>
                    <button onClick={()=>updateProduct(product.id,{optionGroups:product.optionGroups.map(g=>g.id===group.id?{...g,choices:[...g.choices,{id:uid("choice"),name:"New Choice",price:0,chargeType:"flat",priceTiers:[]}]}:g)})} className="mt-3 text-xs font-bold text-blue-600 flex items-center gap-1"><Plus size={13}/> Add Choice</button>
                  </div>
                ))}
                <button onClick={()=>updateProduct(product.id,{optionGroups:[...product.optionGroups,{id:uid("group"),title:"New Option",choices:[]}]})} className="text-xs font-bold text-pink-600 flex items-center gap-1"><Plus size={13}/> Add Dropdown Option</button>
              </div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
