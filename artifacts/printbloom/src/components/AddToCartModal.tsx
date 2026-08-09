import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Plus, Minus, ShoppingBag, Hash, ChevronDown, AlertCircle, Ruler } from "lucide-react";
import { useCart } from "@/store/use-cart";
import { useToast } from "@/hooks/use-toast";
import { parseDescriptionLines } from "@/lib/description-utils";

interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  priceType?: string;
  imageUrl?: string | null;
  category?: { id: number; name: string } | null;
  customConfig?: string | null;
}

interface Props {
  product: Product | null;
  onClose: () => void;
}

type FixedPrice = { qty: number; price: string };
type RangePrice = { from: number; to: number; pricePerUnit: string };
type SizeTier = { from: number; to: number; pricePerUnit: string };
type ProductSize = { id: string; name: string; packSize: number; unitLabel?: string; minQty?: number; tiers: SizeTier[] };

interface ParsedConfig {
  productType: "standard" | "custom_print" | "multi_size_tier";
  pricingModel: "fixed_quantities" | "range_per_unit";
  fixedPrices: FixedPrice[];
  rangePrices: RangePrice[];
  minQuantity: number;
  quantityStep: number;
  sizes: ProductSize[];
}

function parseConfig(raw?: string | null): ParsedConfig {
  const defaults: ParsedConfig = {
    productType: "standard",
    pricingModel: "fixed_quantities",
    fixedPrices: [],
    rangePrices: [],
    minQuantity: 1,
    quantityStep: 1,
    sizes: [],
  };
  if (!raw) return defaults;
  try { return { ...defaults, ...JSON.parse(raw) }; }
  catch { return defaults; }
}

function getSizeTierRate(tiers: SizeTier[], qty: number): number | null {
  const sorted = [...tiers].filter(t => t.pricePerUnit).sort((a, b) => a.from - b.from);
  for (const t of sorted) {
    if (qty >= t.from && qty <= t.to) return parseNum(t.pricePerUnit);
  }
  const last = sorted[sorted.length - 1];
  if (last && qty > last.to) return parseNum(last.pricePerUnit);
  if (sorted[0] && qty < sorted[0].from) return parseNum(sorted[0].pricePerUnit);
  return null;
}

function parseNum(v: string | number | undefined): number {
  return parseFloat(String(v || "0").replace(/[^0-9.-]+/g, "")) || 0;
}

function rs(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getApplicableTier(tiers: FixedPrice[], qty: number): FixedPrice | null {
  const sorted = [...tiers].filter(t => t.qty > 0 && t.price).sort((a, b) => a.qty - b.qty);
  const below = sorted.filter(t => qty >= t.qty);
  if (below.length) return below[below.length - 1];
  return sorted[0] ?? null;
}

function getRangeRate(ranges: RangePrice[], qty: number): number | null {
  const sorted = [...ranges].filter(r => r.pricePerUnit).sort((a, b) => a.from - b.from);
  for (const r of sorted) {
    if (qty >= r.from && qty <= r.to) return parseNum(r.pricePerUnit);
  }
  const last = sorted[sorted.length - 1];
  if (last && qty > last.to) return parseNum(last.pricePerUnit);
  if (sorted[0] && qty < sorted[0].from) return parseNum(sorted[0].pricePerUnit);
  return null;
}

export function AddToCartModal({ product, onClose }: Props) {
  const { addItem } = useCart();
  const { toast } = useToast();

  const cfg = useMemo(() => parseConfig(product?.customConfig), [product?.customConfig]);
  const isCustom = cfg.productType === "custom_print";
  const isMultiSize = cfg.productType === "multi_size_tier";
  const isFixed = cfg.pricingModel === "fixed_quantities";
  const isRange = cfg.pricingModel === "range_per_unit";

  const sizes = useMemo(() => (cfg.sizes || []).filter(s => s.name && s.tiers.length > 0), [cfg.sizes]);

  const tiers = useMemo(
    () => [...cfg.fixedPrices].filter(t => t.qty > 0 && t.price).sort((a, b) => a.qty - b.qty),
    [cfg.fixedPrices]
  );

  const minQty = cfg.minQuantity || 1;
  const step = cfg.quantityStep || 1;

  // For custom_print: if admin set minQuantity > 1 use it, otherwise default to first tier qty
  const customMinQty = (isCustom && cfg.minQuantity > 1)
    ? cfg.minQuantity
    : (tiers[0]?.qty || 1);

  const [quantity, setQuantity] = useState(minQty);
  const [qtyInput, setQtyInput] = useState(String(minQty));
  const [selectedTierIdx, setSelectedTierIdx] = useState(0);
  const [customQtyMode, setCustomQtyMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [qtyWarning, setQtyWarning] = useState("");
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(0);

  const validateQty = (val: number, currentMin: number, currentStep: number): string => {
    if (val < currentMin) return `Minimum quantity is ${currentMin} pcs`;
    if (currentStep > 1 && (val - currentMin) % currentStep !== 0) {
      const nearest = currentMin + Math.round((val - currentMin) / currentStep) * currentStep;
      return `Must be a multiple of ${currentStep} (nearest valid: ${Math.max(currentMin, nearest)} pcs)`;
    }
    return "";
  };

  useEffect(() => {
    if (!product) return;
    if (isMultiSize && sizes.length > 0) {
      setSelectedSizeIdx(0);
      const sz = sizes[0];
      const initQty = Math.max(sz.minQty || 1, sz.packSize || 1);
      setQuantity(initQty);
      setQtyInput(String(initQty));
    } else if (isCustom && isFixed && tiers.length > 0) {
      setQuantity(tiers[0].qty);
      setQtyInput(String(tiers[0].qty));
      setSelectedTierIdx(0);
      setCustomQtyMode(false);
    } else {
      setQuantity(minQty);
      setQtyInput(String(minQty));
    }
    setNotes("");
    setQtyWarning("");
  }, [product?.id]);

  const selectedTier = tiers[selectedTierIdx] ?? null;

  const selectedSize = isMultiSize ? sizes[selectedSizeIdx] : null;

  const { totalPrice, perUnitPrice, rateLabel } = useMemo(() => {
    if (!product) return { totalPrice: 0, perUnitPrice: 0, rateLabel: "" };

    if (isMultiSize && selectedSize) {
      const rate = getSizeTierRate(selectedSize.tiers, quantity);
      if (rate === null) return { totalPrice: 0, perUnitPrice: 0, rateLabel: "No rate" };
      return { totalPrice: rate * quantity, perUnitPrice: rate, rateLabel: `${rs(rate)} per unit` };
    }

    if (!isCustom) {
      const unit = parseNum(product.price);
      return { totalPrice: unit * quantity, perUnitPrice: unit, rateLabel: `${rs(unit)} per unit` };
    }

    if (isFixed) {
      if (!customQtyMode && selectedTier) {
        const total = parseNum(selectedTier.price);
        const perUnit = selectedTier.qty > 0 ? total / selectedTier.qty : 0;
        return { totalPrice: total, perUnitPrice: perUnit, rateLabel: `${rs(perUnit)} per unit` };
      }
      const tier = getApplicableTier(tiers, quantity);
      if (!tier) return { totalPrice: 0, perUnitPrice: 0, rateLabel: "No rate" };
      const perUnit = tier.qty > 0 ? parseNum(tier.price) / tier.qty : 0;
      return { totalPrice: perUnit * quantity, perUnitPrice: perUnit, rateLabel: `${rs(perUnit)}/unit (${tier.qty} pcs tier)` };
    }

    if (isRange) {
      const rate = getRangeRate(cfg.rangePrices, quantity);
      if (rate === null) return { totalPrice: 0, perUnitPrice: 0, rateLabel: "No rate" };
      return { totalPrice: rate * quantity, perUnitPrice: rate, rateLabel: `${rs(rate)} per unit` };
    }

    return { totalPrice: 0, perUnitPrice: 0, rateLabel: "" };
  }, [product, isCustom, isMultiSize, isFixed, isRange, customQtyMode, selectedTier, selectedSize, tiers, quantity, cfg.rangePrices]);

  if (!product) return null;

  const adjustQty = (delta: number, currentMin = minQty) => {
    const base = validateQty(quantity, currentMin, step) !== "" ? currentMin : quantity;
    const next = Math.max(currentMin, base + delta * step);
    setQuantity(next);
    setQtyInput(String(next));
    setQtyWarning(validateQty(next, currentMin, step));
  };

  // Snap qtyInput to nearest valid value on blur
  const snapQty = (currentMin: number) => {
    const raw = parseInt(qtyInput);
    if (isNaN(raw) || raw < currentMin) {
      setQuantity(currentMin);
      setQtyInput(String(currentMin));
      setQtyWarning("");
    } else if (step > 1 && (raw - currentMin) % step !== 0) {
      const nearest = Math.max(currentMin, currentMin + Math.round((raw - currentMin) / step) * step);
      // Keep the warning, don't auto-snap — user can see warning and fix themselves
      // Just make sure quantity reflects what they typed
      setQuantity(raw);
    }
  };

  const handleSelectTier = (idx: number) => {
    setSelectedTierIdx(idx);
    setCustomQtyMode(false);
    const q = tiers[idx]?.qty || minQty;
    setQuantity(q);
    setQtyInput(String(q));
    setQtyWarning("");
  };

  const handleCustomMode = () => {
    setCustomQtyMode(true);
    setQuantity(customMinQty);
    setQtyInput(String(customMinQty));
    setQtyWarning("");
  };

  const handleSelectSize = (idx: number) => {
    setSelectedSizeIdx(idx);
    const sz = sizes[idx];
    const ps = sz?.packSize || 1;
    const initQty = Math.max(sz?.minQty || 1, ps);
    setQuantity(initQty);
    setQtyInput(String(initQty));
    setQtyWarning("");
  };

  const snapMultiSizeQty = () => {
    if (!selectedSize) return;
    const ps = selectedSize.packSize || 1;
    const mq = Math.max(selectedSize.minQty || 1, ps);
    const raw = parseInt(qtyInput);
    if (isNaN(raw) || raw < mq) {
      setQuantity(mq);
      setQtyInput(String(mq));
      setQtyWarning("");
      return;
    }
    if (raw % ps !== 0) {
      const nearest = Math.max(ps, Math.round(raw / ps) * ps);
      setQuantity(nearest);
      setQtyInput(String(nearest));
      setQtyWarning("");
      toast({
        title: "Quantity adjusted",
        description: `Adjusted to ${nearest} pcs (must be a multiple of ${ps}).`,
        duration: 4000,
      });
    }
  };

  const adjustMultiSizeQty = (delta: number) => {
    if (!selectedSize) return;
    const ps = selectedSize.packSize || 1;
    const mq = Math.max(selectedSize.minQty || 1, ps);
    const next = Math.max(mq, quantity + delta * ps);
    setQuantity(next);
    setQtyInput(String(next));
    setQtyWarning("");
  };

  const handleAdd = () => {
    const itemQty = isMultiSize
      ? quantity
      : (!isCustom || isRange || customQtyMode) ? quantity : (selectedTier?.qty || quantity);
    const itemPerUnit = perUnitPrice.toFixed(2);
    const label = isMultiSize && selectedSize
      ? `${product.name} — ${selectedSize.name} (${itemQty} pcs)`
      : isCustom && isFixed && !customQtyMode && selectedTier
      ? `${product.name} (${selectedTier.qty} pcs)`
      : isCustom
      ? `${product.name} (${itemQty} pcs)`
      : product.name;

    addItem({
      id: `p-${product.id}-${Date.now()}`,
      productId: product.id,
      name: label,
      price: itemPerUnit,
      quantity: itemQty,
      imageUrl: product.imageUrl,
      notes: notes.trim() || null,
    });
    toast({
      title: "Added to cart",
      description: `${itemQty}× ${product.name}${selectedSize ? ` (${selectedSize.name})` : ""} added to your order.`,
      duration: 5000,
    });
    onClose();
    setQuantity(minQty);
    setNotes("");
  };

  return (
    <AnimatePresence>
      {product && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 400 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden max-h-[90vh] sm:max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                    <ShoppingCart size={15} className="text-white" />
                  </div>
                  <h2 className="font-bold text-gray-900 text-base">Add to Cart</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={17} className="text-gray-500" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {/* Product info */}
                <div className="px-6 py-4 flex gap-4 bg-gray-50/60">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      : <ShoppingBag size={24} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {product.category && (
                      <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                        {product.category.name}
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">{parseDescriptionLines(product.description).join(" • ")}</p>
                    )}
                    {isCustom && (
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        Custom Print
                      </span>
                    )}
                    {isMultiSize && (
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Multi-Size
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">

                  {/* ── MULTI-SIZE TIER: size dropdown + qty + auto-snap ── */}
                  {isMultiSize && sizes.length > 0 && (
                    <div className="space-y-4">
                      {/* Size dropdown */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-2.5 flex items-center gap-1">
                          <Ruler size={12} /> Select Size
                        </label>
                        <select
                          value={selectedSizeIdx}
                          onChange={e => handleSelectSize(Number(e.target.value))}
                          className="w-full py-3 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                        >
                          {sizes.map((sz, i) => (
                            <option key={sz.id} value={i}>
                              {sz.name} — {sz.unitLabel || "Pack"} of {sz.packSize}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Price tier chart */}
                      {selectedSize && selectedSize.tiers.length > 0 && (
                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] text-[10px] font-bold text-gray-400 uppercase tracking-wide px-3 py-1.5 bg-gray-50">
                            <span>Quantity</span>
                            <span>Price / Unit</span>
                          </div>
                          {selectedSize.minQty && selectedSize.minQty > 1 && (
                            <div className="px-3 py-1.5 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-100 font-medium">
                              Minimum order: {selectedSize.minQty} pcs
                            </div>
                          )}
                          {[...selectedSize.tiers].sort((a, b) => a.from - b.from).map((t, i) => {
                            const isActive = quantity >= t.from && quantity <= t.to;
                            return (
                              <div
                                key={i}
                                className={`grid grid-cols-[1fr_auto] px-3 py-2 text-sm border-t border-gray-50 transition-colors ${isActive ? "bg-blue-50 font-semibold text-blue-900" : "text-gray-600"}`}
                              >
                                <span>{t.from}–{t.to} pcs</span>
                                <span className="font-semibold">Rs. {parseNum(t.pricePerUnit).toLocaleString("en-IN")}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Quantity input */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-2.5 flex items-center gap-1">
                          <Hash size={12} /> Quantity
                          {selectedSize && <span className="text-gray-400 font-normal">(multiples of {selectedSize.packSize}{selectedSize.minQty && selectedSize.minQty > 1 ? `, min ${selectedSize.minQty}` : ""})</span>}
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustMultiSizeQty(-1)}
                              disabled={!selectedSize || quantity <= Math.max(selectedSize?.minQty || 1, selectedSize?.packSize || 1)}
                              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-blue-100 active:bg-blue-200 text-gray-600 hover:text-blue-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                            >
                              <Minus size={15} />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={qtyInput}
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                setQtyInput(raw);
                                const num = parseInt(raw);
                                if (!isNaN(num)) {
                                  setQuantity(num);
                                  const ps = selectedSize?.packSize || 1;
                                  const mq = Math.max(selectedSize?.minQty || 1, ps);
                                  if (num < mq) {
                                    setQtyWarning(`Minimum quantity is ${mq} pcs`);
                                  } else if (ps > 1 && num % ps !== 0) {
                                    setQtyWarning(`Must be a multiple of ${ps}`);
                                  } else {
                                    setQtyWarning("");
                                  }
                                }
                              }}
                              onBlur={snapMultiSizeQty}
                              className={`w-16 flex-1 max-w-[5rem] text-center text-base font-bold text-gray-900 border rounded-xl py-2 outline-none focus:ring-2 transition-colors ${qtyWarning ? "border-red-400 focus:ring-red-100 bg-red-50" : "border-gray-200 focus:ring-blue-200"}`}
                            />
                            <button
                              onClick={() => adjustMultiSizeQty(1)}
                              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-blue-100 active:bg-blue-200 text-gray-600 hover:text-blue-600 flex items-center justify-center transition-colors shrink-0"
                            >
                              <Plus size={15} />
                            </button>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 mt-1">
                            <div className="text-xs text-gray-500">{rateLabel}</div>
                            <div className="text-sm font-bold text-gray-800">Total: {rs(totalPrice)}</div>
                      </div>
                        {qtyWarning && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                            <AlertCircle size={12} /> {qtyWarning}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── STANDARD: simple qty with min/step ── */}
                  {!isCustom && !isMultiSize && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-2.5 flex items-center gap-1">
                        <Hash size={12} /> Quantity
                        {minQty > 1 && <span className="text-gray-400 font-normal">(min {minQty})</span>}
                        {step > 1 && <span className="text-gray-400 font-normal">, step {step}</span>}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustQty(-1)}
                          disabled={quantity <= minQty}
                          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-pink-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={qtyInput}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setQtyInput(raw);
                            const num = parseInt(raw);
                            if (!isNaN(num)) {
                              setQuantity(num);
                              setQtyWarning(validateQty(num, minQty, step));
                            } else {
                              setQtyWarning("");
                            }
                          }}
                          onBlur={() => snapQty(minQty)}
                          className={`w-16 flex-1 max-w-[5rem] text-center text-base font-bold text-gray-900 border rounded-xl py-2 outline-none focus:ring-2 transition-colors ${qtyWarning ? "border-red-400 focus:ring-red-100 bg-red-50" : "border-gray-200 focus:ring-pink-200"}`}
                        />
                        <button
                          onClick={() => adjustQty(1)}
                          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-pink-600 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 mt-1">
                        <div className="text-xs text-gray-500">{rateLabel}</div>
                        <div className="text-sm font-bold text-gray-800">Total: {rs(totalPrice)}</div>
                      </div>
                      {qtyWarning && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                          <AlertCircle size={12} /> {qtyWarning}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CUSTOM PRINT: Fixed Quantities (tier selector) ── */}
                  {isCustom && isFixed && tiers.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-2.5">Select Quantity</label>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {tiers.map((tier, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectTier(i)}
                            className={`py-2.5 px-2 rounded-xl border-2 text-center transition-all ${
                              !customQtyMode && selectedTierIdx === i
                                ? "border-purple-500 bg-purple-50"
                                : "border-gray-200 hover:border-purple-300"
                            }`}
                          >
                            <div className="text-sm font-bold text-gray-900">{tier.qty} pcs</div>
                            <div className="text-xs text-purple-700 font-semibold mt-0.5">Rs. {parseNum(tier.price).toLocaleString("en-IN")}</div>
                            <div className="text-[10px] text-gray-400">{rs(parseNum(tier.price) / tier.qty)}/pc</div>
                          </button>
                        ))}
                      </div>

                      {/* Custom qty option */}
                      <div className={`rounded-xl border-2 transition-all ${customQtyMode ? "border-purple-500 bg-purple-50" : "border-dashed border-gray-200 hover:border-purple-300"}`}>
                        <button
                          type="button"
                          onClick={handleCustomMode}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-600"
                        >
                          <span className="flex items-center gap-1.5">
                            <ChevronDown size={14} /> Custom Quantity
                          </span>
                          {!customQtyMode && (
                            <span className="text-[11px] text-gray-400 font-normal">
                              min {customMinQty} pcs{step > 1 ? `, step ${step}` : ""}
                            </span>
                          )}
                        </button>
                        {customQtyMode && (
                          <div className="px-4 pb-4 space-y-3">
                            {step > 1 && (
                              <div className="text-[11px] text-purple-700 bg-purple-100/70 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                <Hash size={11} />
                                Step: <strong>{step}</strong> — enter {customMinQty}, {customMinQty + step}, {customMinQty + step * 2}…
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => adjustQty(-1, customMinQty)}
                                disabled={quantity <= customMinQty}
                                className="w-9 h-9 rounded-xl bg-white border border-gray-200 hover:bg-pink-50 text-gray-500 hover:text-pink-600 flex items-center justify-center transition-colors disabled:opacity-40"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={qtyInput}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const raw = e.target.value.replace(/[^0-9]/g, "");
                                  setQtyInput(raw);
                                  const num = parseInt(raw);
                                  if (!isNaN(num)) {
                                    setQuantity(num);
                                    setQtyWarning(validateQty(num, customMinQty, step));
                                  } else {
                                    setQtyWarning("");
                                  }
                                }}
                                onBlur={() => snapQty(customMinQty)}
                                className={`w-24 text-center text-lg font-bold text-gray-900 border rounded-xl py-1.5 outline-none focus:ring-2 transition-colors bg-white ${qtyWarning ? "border-red-400 focus:ring-red-100 bg-red-50" : "border-gray-200 focus:ring-purple-200"}`}
                              />
                              <button
                                type="button"
                                onClick={() => adjustQty(1, customMinQty)}
                                className="w-9 h-9 rounded-xl bg-white border border-gray-200 hover:bg-pink-50 text-gray-500 hover:text-pink-600 flex items-center justify-center transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            {qtyWarning && (
                              <div className="flex items-center gap-1.5 text-xs text-red-500">
                                <AlertCircle size={12} /> {qtyWarning}
                              </div>
                            )}
                            {!qtyWarning && getApplicableTier(tiers, quantity) && (
                              <div className="text-[11px] text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg">
                                Using <strong>{getApplicableTier(tiers, quantity)!.qty} pcs</strong> tier rate · {rateLabel}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price summary */}
                      <div className="mt-3 flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                        <div>
                          <div className="text-xs text-gray-400">{customQtyMode ? quantity : (selectedTier?.qty ?? 0)} pcs</div>
                          <div className="text-sm font-bold text-purple-900">{rs(totalPrice)}</div>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                          {rateLabel}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── CUSTOM PRINT: Range / Per Unit ── */}
                  {isCustom && isRange && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-2.5 flex items-center gap-1">
                        <Hash size={12} /> Quantity
                        {cfg.rangePrices.length > 0 && (
                          <span className="text-gray-400 font-normal">
                            (min {cfg.rangePrices.sort((a, b) => a.from - b.from)[0]?.from || 1})
                          </span>
                        )}
                      </label>
                      {/* Rate table */}
                      {cfg.rangePrices.length > 0 && (
                        <div className="mb-3 rounded-xl border border-gray-100 overflow-hidden">
                          <div className="grid grid-cols-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide px-3 py-1.5 bg-gray-50">
                            <span>Quantity Range</span>
                            <span>Price / Unit</span>
                          </div>
                          {[...cfg.rangePrices].sort((a, b) => a.from - b.from).map((r, i) => {
                            const isActive = quantity >= r.from && quantity <= r.to;
                            return (
                              <div
                                key={i}
                                className={`grid grid-cols-2 px-3 py-2 text-sm border-t border-gray-50 transition-colors ${isActive ? "bg-purple-50 font-semibold text-purple-900" : "text-gray-600"}`}
                              >
                                <span>{r.from}–{r.to} pcs</span>
                                <span>Rs. {parseNum(r.pricePerUnit).toLocaleString("en-IN")}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => adjustQty(-1)}
                          disabled={quantity <= minQty}
                          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-pink-600 flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={qtyInput}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setQtyInput(raw);
                            const num = parseInt(raw);
                            if (!isNaN(num)) {
                              setQuantity(num);
                              setQtyWarning(validateQty(num, minQty, step));
                            } else {
                              setQtyWarning("");
                            }
                          }}
                          onBlur={() => snapQty(minQty)}
                          className={`w-20 text-center text-xl font-bold text-gray-900 border rounded-xl py-1.5 outline-none focus:ring-2 transition-colors ${qtyWarning ? "border-red-400 focus:ring-red-100 bg-red-50" : "border-gray-200 focus:ring-purple-200"}`}
                        />
                        <button
                          onClick={() => adjustQty(1)}
                          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-pink-600 flex items-center justify-center transition-colors"
                        >
                          <Plus size={15} />
                        </button>
                        <div className="text-xs text-gray-400 ml-1">
                          <div>{rateLabel}</div>
                          <div className="font-bold text-gray-700 mt-0.5">Total: {rs(totalPrice)}</div>
                        </div>
                      </div>
                      {qtyWarning && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                          <AlertCircle size={12} /> {qtyWarning}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">
                      Special Notes / Instructions <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Any special size, color, or design requirements..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-100 transition-colors resize-none placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 border-t border-gray-100 shrink-0 space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-500 px-1 mb-1">
                  <span>Order Total</span>
                  <span className="font-bold text-lg text-purple-900">{rs(totalPrice)}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={totalPrice <= 0 || !!qtyWarning || qtyInput === ""}
                    className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/25 disabled:opacity-40"
                  >
                    <ShoppingCart size={16} /> Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
