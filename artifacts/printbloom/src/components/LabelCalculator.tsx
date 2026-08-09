import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calculator, Download, RotateCw, Ruler, Sparkles } from "lucide-react";

type PriceTier = { minQty: number; maxQty: number | null; price: number };
type Sheet = { id: string; name: string; widthMm: number; heightMm: number; price: number; marginMm?: number; marginTopMm?: number; marginBottomMm?: number; marginLeftMm?: number; marginRightMm?: number; gapMm: number; enabled: boolean; priceTiers?: PriceTier[] };
type Choice = { id: string; name: string; price: number; chargeType: "per_sheet" | "per_label" | "flat"; priceTiers?: PriceTier[] };
type Group = { id: string; title: string; choices: Choice[] };
type Shape = "round" | "rectangle" | "square";
type Unit = "mm" | "cm" | "inch";
type Product = { id: string; name: string; enabled: boolean; sheetIds?: string[]; shapes?: Shape[]; optionGroups: Group[] };
type Config = { enabled: boolean; pricingMessage?: string; sheets: Sheet[]; products: Product[] };

type Placement = { x: number; y: number; width: number; height: number; rotated: boolean };

function sheetMargins(sheet: Sheet) {
  const fallback = Math.max(0, Number(sheet.marginMm) || 0);
  const value = (side: number | undefined) => side == null ? fallback : Math.max(0, Number(side) || 0);
  return {
    top: value(sheet.marginTopMm),
    bottom: value(sheet.marginBottomMm),
    left: value(sheet.marginLeftMm),
    right: value(sheet.marginRightMm),
  };
}

function fit(sheet: Sheet, width: number, height: number) {
  const margins = sheetMargins(sheet);
  const usableW = Math.max(0, sheet.widthMm - margins.left - margins.right);
  const usableH = Math.max(0, sheet.heightMm - margins.top - margins.bottom);
  const gap = sheet.gapMm;

  const build = (primaryRotated: boolean, fill: "none" | "right" | "bottom") => {
    const pw = primaryRotated ? height : width;
    const ph = primaryRotated ? width : height;
    const rw = ph, rh = pw;
    const across = Math.max(0, Math.floor((usableW + gap) / (pw + gap)));
    const down = Math.max(0, Math.floor((usableH + gap) / (ph + gap)));
    const placements: Placement[] = [];
    for (let row = 0; row < down; row++) for (let col = 0; col < across; col++) {
      placements.push({ x: margins.left + col * (pw + gap), y: margins.top + row * (ph + gap), width: pw, height: ph, rotated: primaryRotated });
    }
    let extraAcross = 0, extraDown = 0;
    if (fill === "right" && across > 0) {
      const startX = across * (pw + gap);
      const remainingW = usableW - startX;
      extraAcross = Math.max(0, Math.floor((remainingW + gap) / (rw + gap)));
      extraDown = Math.max(0, Math.floor((usableH + gap) / (rh + gap)));
      for (let row = 0; row < extraDown; row++) for (let col = 0; col < extraAcross; col++) {
        placements.push({ x: margins.left + startX + col * (rw + gap), y: margins.top + row * (rh + gap), width: rw, height: rh, rotated: !primaryRotated });
      }
    }
    if (fill === "bottom" && down > 0) {
      const startY = down * (ph + gap);
      const remainingH = usableH - startY;
      extraAcross = Math.max(0, Math.floor((usableW + gap) / (rw + gap)));
      extraDown = Math.max(0, Math.floor((remainingH + gap) / (rh + gap)));
      for (let row = 0; row < extraDown; row++) for (let col = 0; col < extraAcross; col++) {
        placements.push({ x: margins.left + col * (rw + gap), y: margins.top + startY + row * (rh + gap), width: rw, height: rh, rotated: !primaryRotated });
      }
    }
    if (placements.length) {
      const minX = Math.min(...placements.map(p => p.x));
      const minY = Math.min(...placements.map(p => p.y));
      const maxX = Math.max(...placements.map(p => p.x + p.width));
      const maxY = Math.max(...placements.map(p => p.y + p.height));
      const offsetX = margins.left + (usableW - (maxX - minX)) / 2 - minX;
      const offsetY = margins.top + (usableH - (maxY - minY)) / 2 - minY;
      placements.forEach(p => { p.x += offsetX; p.y += offsetY; });
    }
    return {
      across, down, total: placements.length, placements,
      rotated: primaryRotated,
      mixed: fill !== "none" && extraAcross * extraDown > 0,
      fill,
      extraCount: extraAcross * extraDown,
    };
  };

  const candidates = [
    build(false, "none"), build(false, "right"), build(false, "bottom"),
    build(true, "none"), build(true, "right"), build(true, "bottom"),
  ];
  return candidates.sort((a, b) => b.total - a.total || Number(b.mixed) - Number(a.mixed))[0];
}

function downloadLayoutJpg(sheet: Sheet, layout: ReturnType<typeof fit>, labelW: number, labelH: number, shape: Shape) {
  const scale = 5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sheet.widthMm * scale);
  canvas.height = Math.round(sheet.heightMm * scale + 150);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 3; ctx.strokeRect(2, 2, sheet.widthMm * scale - 4, sheet.heightMm * scale - 4);
  ctx.setLineDash([8, 5]); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  const margins = sheetMargins(sheet);
  ctx.strokeRect(margins.left * scale, margins.top * scale, (sheet.widthMm - margins.left - margins.right) * scale, (sheet.heightMm - margins.top - margins.bottom) * scale);
  layout.placements.forEach((p, index) => {
    ctx.setLineDash([]); ctx.strokeStyle = p.rotated ? "#166cff" : "#f52d8b"; ctx.lineWidth = 1.5;
    if (shape === "round") {
      ctx.beginPath();
      ctx.ellipse((p.x + p.width / 2) * scale, (p.y + p.height / 2) * scale, p.width * scale / 2, p.height * scale / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(p.x * scale, p.y * scale, p.width * scale, p.height * scale);
    }
    if (p.width * scale > 28 && p.height * scale > 20) {
      ctx.fillStyle = "#475569"; ctx.font = "10px Arial"; ctx.fillText(String(index + 1), p.x * scale + 4, p.y * scale + 12);
    }
  });
  const y = sheet.heightMm * scale + 28;
  ctx.fillStyle = "#111827"; ctx.font = "bold 22px Arial"; ctx.fillText(`${sheet.name} Cutting Layout — ${layout.total} labels/sheet`, 12, y);
  ctx.font = "16px Arial"; ctx.fillStyle = "#475569";
  ctx.fillText(`Label: ${labelW} × ${labelH} mm | Shape: ${shape} | Gap: ${sheet.gapMm} mm`, 12, y + 28);
  ctx.fillText(`Margins — Top: ${margins.top} | Bottom: ${margins.bottom} | Left: ${margins.left} | Right: ${margins.right} mm`, 12, y + 54);
  ctx.fillText(`Pink: standard orientation  |  Blue: rotated orientation`, 12, y + 80);
  const link = document.createElement("a");
  link.download = `${sheet.name.replace(/\\s+/g, "-").toLowerCase()}-label-layout.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.95);
  link.click();
}

const money = (value: number) => `Rs. ${Math.round(value).toLocaleString()}`;
const tierRate = (base: number, tiers: PriceTier[] | undefined, count: number) => {
  const tier = [...(tiers || [])].sort((a,b)=>b.minQty-a.minQty).find(t => count >= t.minQty && (t.maxQty == null || count <= t.maxQty));
  return tier?.price ?? base;
};
const sheetRate = (sheet: Sheet, count: number) => tierRate(sheet.price, sheet.priceTiers, count);

export function LabelCalculator() {
  const [config, setConfig] = useState<Config | null>(null);
  const [productId, setProductId] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [width, setWidth] = useState("50");
  const [height, setHeight] = useState("50");
  const [quantity, setQuantity] = useState("50");
  const [shape, setShape] = useState<Shape>("rectangle");
  const [unit, setUnit] = useState<Unit>("mm");
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/label-calculator").then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      setConfig(data);
      const firstProduct = data.products?.find((p: Product) => p.enabled);
      const firstSheet = data.sheets?.find((s: Sheet) => s.enabled);
      setProductId(firstProduct?.id || "");
      setSheetId(firstSheet?.id || "");
    }).catch(() => {});
  }, []);

  const products = config?.products?.filter(p => p.enabled) || [];
  const product = products.find(p => p.id === productId) || products[0];
  const allSheets = config?.sheets?.filter(s => s.enabled) || [];
  const sheets = product?.sheetIds?.length ? allSheets.filter(s => product.sheetIds!.includes(s.id)) : allSheets;
  const sheet = sheets.find(s => s.id === sheetId) || sheets[0];
  const shapes: Shape[] = Array.from(new Set((product?.shapes?.length ? product.shapes : ["rectangle"]).map((value: any) => value === "circle" ? "round" : value).filter((value: any) => ["round","rectangle","square"].includes(value)))) as Shape[];
  const unitFactor = unit === "cm" ? 10 : unit === "inch" ? 25.4 : 1;

  const result = useMemo(() => {
    const w = Number(width) * unitFactor, h = Number(height) * unitFactor, qty = Math.max(0, Math.ceil(Number(quantity)));
    if (!sheet || !(w > 0) || !(h > 0) || !(qty > 0)) return null;
    const layout = fit(sheet, w, h);
    if (!layout.total) return { error: "This label size is larger than the usable sheet area." } as const;
    const requiredSheets = Math.ceil(qty / layout.total);
    const choices = (product?.optionGroups || []).flatMap(group => {
      const choice = group.choices.find(c => c.id === selected[group.id]);
      return choice ? [{ group: group.title, choice }] : [];
    });
    const calculate = (labelQty: number, sheetQty: number) => {
      const rate = sheetRate(sheet, sheetQty);
      const sheetTotal = sheetQty * rate;
      const optionRows = choices.map(({ group, choice }) => {
        const rangeQty = choice.chargeType === "per_sheet" ? sheetQty : labelQty;
        const appliedPrice = tierRate(choice.price, choice.priceTiers, rangeQty);
        return {
          group, choice: choice.name, appliedPrice, chargeType: choice.chargeType,
          charge: choice.chargeType === "per_sheet" ? appliedPrice * sheetQty
            : choice.chargeType === "per_label" ? appliedPrice * labelQty : appliedPrice,
        };
      });
      const optionsTotal = optionRows.reduce((sum, row) => sum + row.charge, 0);
      return { rate, sheetTotal, optionRows, optionsTotal, total: sheetTotal + optionsTotal };
    };
    const printedQuantity = requiredSheets * layout.total;
    const current = calculate(printedQuantity, requiredSheets);
    const currentUnitPrice = current.total / printedQuantity;
    const valueOptions = [...(sheet.priceTiers || [])]
      .sort((a, b) => a.minQty - b.minQty)
      .filter((tier, index, tiers) => tier.minQty > requiredSheets && tiers.findIndex(item => item.minQty === tier.minQty) === index)
      .map(tier => {
        const sheets = tier.minQty;
        const quantity = sheets * layout.total;
        const quote = calculate(quantity, sheets);
        return { sheets, quantity, ...quote, pricePerLabel: quote.total / quantity };
      })
      .filter(option => option.pricePerLabel < currentUnitPrice)
      .slice(0, 2);
    return {
      layout, qty, requiredSheets, printedQuantity, ...current, valueOptions,
      pricePerLabel: currentUnitPrice,
    };
  }, [sheet, width, height, unitFactor, quantity, product, selected]);

  if (!config?.enabled || !sheets.length || !products.length) return null;

  return (
    <section className="pb-calc-section" id="smart-label-calculator">
      <div className="pb-calc-heading">
        <span><Sparkles size={16} /> Smart Print Calculator</span>
        <h2>Know your quantity and price instantly.</h2>
        <p>Enter your label size and quantity. We automatically find the best sheet layout, including rotation.</p>
      </div>

      <div className="pb-calc-shell">
        <div className="pb-calc-form">
          <label>Print Product
            <select value={productId} onChange={e => { const next = products.find(p => p.id === e.target.value); setProductId(e.target.value); setSelected({}); setShape(next?.shapes?.[0] || "rectangle"); const allowed = next?.sheetIds?.length ? allSheets.filter(s => next.sheetIds!.includes(s.id)) : allSheets; setSheetId(allowed[0]?.id || ""); }}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Sheet Size
            <select value={sheetId} onChange={e => setSheetId(e.target.value)}>
              {sheets.map(s => <option key={s.id} value={s.id}>{s.name} — {s.widthMm} × {s.heightMm}mm</option>)}
            </select>
          </label>
          <label>Sticker Shape
            <select value={shape} onChange={e => {
              const next = e.target.value as Shape;
              setShape(next);
              if (next === "square" || next === "round") setHeight(width);
            }}>
              {shapes.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
            </select>
          </label>
          <label>Measurement Unit
            <select value={unit} onChange={e => {
              const next = e.target.value as Unit;
              const currentFactor = unit === "cm" ? 10 : unit === "inch" ? 25.4 : 1;
              const nextFactor = next === "cm" ? 10 : next === "inch" ? 25.4 : 1;
              const convert = (value: string) => {
                const converted = Number(value) * currentFactor / nextFactor;
                return Number.isFinite(converted) ? String(Number(converted.toFixed(3))) : value;
              };
              setWidth(convert(width)); setHeight(convert(height)); setUnit(next);
            }}>
              <option value="mm">Millimetres (mm)</option>
              <option value="cm">Centimetres (cm)</option>
              <option value="inch">Inches (in)</option>
            </select>
          </label>

          <div className="pb-calc-dimensions">
            <label>Width<input inputMode="decimal" value={width} onChange={e => { const v=e.target.value.replace(/[^0-9.]/g, ""); setWidth(v); if(shape==="square"||shape==="round") setHeight(v); }} /></label>
            <label>Height<input inputMode="decimal" value={height} onChange={e => setHeight(e.target.value.replace(/[^0-9.]/g, ""))} disabled={shape==="square"||shape==="round"} /></label>
          </div>
          <label>Required Quantity
            <input inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ""))} />
          </label>

          {product?.optionGroups?.map(group => (
            <label key={group.id}>{group.title}
              <select value={selected[group.id] || ""} onChange={e => setSelected(v => ({ ...v, [group.id]: e.target.value }))}>
                <option value="">Select {group.title}</option>
                {group.choices.map(c => <option key={c.id} value={c.id}>{c.name}{c.price ? ` (+${money(c.price)} ${c.chargeType.replace("_", " ")})` : ""}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="pb-calc-results">
          {!result ? <div className="pb-calc-empty"><Calculator size={40} /><p>Enter valid dimensions and quantity to calculate.</p></div>
          : "error" in result ? <div className="pb-calc-error">{result.error}</div>
          : <>
            <div className="pb-layout-badge"><RotateCw size={16} /> {result.layout.mixed ? `Mixed layout adds ${result.layout.extraCount} rotated label${result.layout.extraCount === 1 ? "" : "s"} in the leftover space` : result.layout.rotated ? "Rotated layout gives the best fit" : "Standard orientation gives the best fit"}</div>
            <div className="pb-required-summary">
              <div><span>You requested</span><strong>{result.qty} stickers</strong></div>
              <ArrowRight size={20} />
              <div><span>{result.requiredSheets} sheets will be printed</span><strong>{result.printedQuantity} stickers delivered</strong></div>
            </div>
            <p className="pb-calc-formula">{result.qty} requested ÷ {result.layout.total} per sheet = {(result.qty / result.layout.total).toFixed(2)} → <b>{result.requiredSheets} full sheets</b> → customer receives <b>{result.printedQuantity} stickers</b></p>

            <div className="pb-calc-metrics">
              <div><small>Stickers / Sheet</small><strong>{result.layout.total}</strong><span>{result.layout.across} across × {result.layout.down} down</span></div>
              <div><small>Sheets to Print</small><strong>{result.requiredSheets}</strong><span>Printed output: {result.printedQuantity}</span></div>
              <div className="primary"><small>Price / Sticker</small><strong>{money(result.pricePerLabel)}</strong><span>Based on {result.printedQuantity} delivered</span></div>
              <div className="primary"><small>Price / Sheet</small><strong>{money(result.rate)}</strong><span>Applied quantity range</span></div>
            </div>

            <div className="pb-price-breakdown">
              <h3>Price Breakdown</h3>
              <div><span>{result.requiredSheets} sheets × {money(result.rate)}</span><b>{money(result.sheetTotal)}</b></div>
              {result.optionRows.map(r => <div key={r.group}><span>{r.group}: {r.choice} <small>({money(r.appliedPrice)} {r.chargeType.replace("_"," ")})</small></span><b>+{money(r.charge)}</b></div>)}
              <div className="total"><span>Grand Total</span><b>{money(result.total)}</b></div>
              <div className="unit"><span>Final price per sticker</span><b>{money(result.pricePerLabel)}</b></div>
            </div>
            {!!result.valueOptions.length && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-blue-50 p-4 sm:p-5">
                <div className="flex items-start gap-2">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <h3 className="font-bold text-slate-900">Get more, pay less per sticker</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {config.pricingMessage?.trim() || "Quantity වැඩි කරන තරමට price per sticker අඩු වෙන්න පුළුවන්. Below value options බලලා ඔබට හොඳම quantity එක select කරන්න."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {result.valueOptions.map(option => (
                    <button
                      key={option.sheets}
                      type="button"
                      onClick={() => setQuantity(String(option.quantity))}
                      className="rounded-xl border border-white bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Better value option</span>
                      <strong className="mt-1 block text-xl text-slate-900">{option.quantity} stickers</strong>
                      <span className="mt-1 block text-sm text-slate-500">{option.sheets} sheets · Total {money(option.total)}</span>
                      <span className="mt-2 block font-bold text-blue-700">{money(option.pricePerLabel)} per sticker</span>
                      <small className="mt-1 block text-slate-400">Click to use this quantity</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="pb-sheet-visual">
              <Ruler size={18} /><span>Primary grid: {result.layout.across} × {result.layout.down}{result.layout.mixed ? ` + ${result.layout.extraCount} rotated in leftover space` : ""}</span>
              <div className="pb-live-sheet-wrap">
                <div className="pb-live-sheet" style={{ aspectRatio: `${sheet.widthMm} / ${sheet.heightMm}` }}>
                  <div className="pb-live-margin" style={{ left:`${sheetMargins(sheet).left/sheet.widthMm*100}%`,top:`${sheetMargins(sheet).top/sheet.heightMm*100}%`,right:`${sheetMargins(sheet).right/sheet.widthMm*100}%`,bottom:`${sheetMargins(sheet).bottom/sheet.heightMm*100}%` }} />
                  {result.layout.placements.slice(0, 300).map((p,i)=><i key={i} className={`${p.rotated?"rotated ":""}shape-${shape}`} style={{left:`${p.x/sheet.widthMm*100}%`,top:`${p.y/sheet.heightMm*100}%`,width:`${p.width/sheet.widthMm*100}%`,height:`${p.height/sheet.heightMm*100}%`}}><span>{i+1}</span></i>)}
                </div>
                <small>Live {sheet.name} preview · Pink = standard · Blue = rotated</small>
              </div>
              <button type="button" className="pb-layout-download" onClick={() => downloadLayoutJpg(sheet, result.layout, Number(width) * unitFactor, Number(height) * unitFactor, shape)}>
                <Download size={16} /> Download cutting layout JPG
              </button>
            </div>
            <a href="/custom-project" className="pb-calc-order">Start this print order <ArrowRight size={18} /></a>
          </>}
        </div>
      </div>
    </section>
  );
}
