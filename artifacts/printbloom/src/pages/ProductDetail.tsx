import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetProduct, useListProducts } from "@workspace/api-client-react";
import { slugify } from "@/lib/utils";
import { useCart } from "@/store/use-cart";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Minus, Plus, ShoppingCart, Share2,
  Download, Clock, Ruler, Star, Facebook, Mail, Linkedin, Loader2, X, Sparkles, Gift
} from "lucide-react";
import { DescriptionDisplay } from "@/components/DescriptionDisplay";

/* ─── Types ─── */
type FixedPrice = { qty: number; price: string };
type RangePrice = { from: number; to: number; pricePerUnit: string };
type Choice = { id: string; name: string; price: string; chargeType: "flat" | "per_unit"; sizePrices?: { sizeId: string; price: string }[] };
type OptionGroup = { id: string; title: string; choices: Choice[] };
type SizeTier = { from: number; to: number; pricePerUnit: string };
type ProductSize = { id: string; name: string; packSize: number; unitLabel?: string; minQty?: number; tiers: SizeTier[] };

/* Multi Prints types */
type MPPricingMode = "unit" | "qty-range";
type MPTier = { minQty: number; maxQty: number | null; price: string };
type MPPrintSide = { id: string; name: string; label: string; pricingMode: MPPricingMode; unitPrice: string; tiers: MPTier[] };
type MPLamination = { id: string; name: string; label: string; pricingMode: MPPricingMode; unitPrice: string; tiers: MPTier[] };
type MPRoundCornerCut = { enabled: boolean; pricingMode: MPPricingMode; unitPrice: string; tiers: MPTier[] };
type MPBoardType = {
  id: string; name: string; gsm: number; description: string; isActive: boolean;
  basePricingMode: MPPricingMode; baseUnitPrice: string; baseTiers: MPTier[];
  printSides: MPPrintSide[]; laminations: MPLamination[];
  roundCornerCut?: MPRoundCornerCut;
};

type CustomConfig = {
  productType: "standard" | "custom_print" | "multi_size_tier" | "multi_prints";
  pricingModel: "fixed_quantities" | "range_per_unit";
  fixedPrices: FixedPrice[];
  rangePrices: RangePrice[];
  optionGroups: OptionGroup[];
  stockQty: string;
  minQuantity?: number;
  quantityStep?: number;
  sizes?: ProductSize[];
  productionTime?: string;
  sizeLabel?: string;
  multiPrintsBoardTypes?: MPBoardType[];
  offerEnabled?: boolean;
  offerMinAmount?: number;
  offerMessage?: string;
};

function parseConfig(raw?: string | null): CustomConfig {
  const def: CustomConfig = {
    productType: "standard",
    pricingModel: "fixed_quantities",
    fixedPrices: [],
    rangePrices: [],
    optionGroups: [],
    stockQty: "",
    sizes: [],
    offerEnabled: false,
    offerMinAmount: 0,
    offerMessage: "",
  };
  if (!raw) return def;
  try { return { ...def, ...JSON.parse(raw) }; }
  catch { return def; }
}

function getSizeTierRate(tiers: SizeTier[], qty: number): number {
  const sorted = [...tiers].filter(t => t.pricePerUnit).sort((a, b) => a.from - b.from);
  for (const t of sorted) {
    if (qty >= t.from && qty <= t.to) return num(t.pricePerUnit);
  }
  const last = sorted[sorted.length - 1];
  if (last && qty > last.to) return num(last.pricePerUnit);
  if (sorted[0] && qty < sorted[0].from) return num(sorted[0].pricePerUnit);
  return 0;
}

function num(s: string | undefined | null) {
  if (!s) return 0;
  return parseFloat(s.toString().replace(/[^0-9.-]/g, "")) || 0;
}

function rs(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── Multi Prints price resolver ─── */
function resolveMPPrice(qty: number, mode: MPPricingMode, unitPrice: string, tiers: MPTier[]): number {
  if (mode === "unit") return num(unitPrice);
  if (!tiers || tiers.length === 0) return num(unitPrice);
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let match = sorted[0];
  for (const tier of sorted) { if (qty >= tier.minQty) match = tier; }
  return num(match.price);
}

/* ─── Price Engine ─── */
function getBaseUnitPrice(cfg: CustomConfig, qty: number): number {
  if (cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices.length > 0) {
    // Find the highest tier that qty meets (sorted ascending)
    const sorted = [...cfg.fixedPrices].sort((a, b) => a.qty - b.qty);
    let match = sorted[0];
    for (const tier of sorted) {
      if (qty >= tier.qty) match = tier;
    }
    if (!match || !match.price) return 0;
    return num(match.price) / match.qty;
  }
  if (cfg.pricingModel === "range_per_unit" && cfg.rangePrices.length > 0) {
    const sorted = [...cfg.rangePrices].sort((a, b) => a.from - b.from);
    let match = sorted[sorted.length - 1];
    for (const r of sorted) {
      if (qty >= r.from && qty <= r.to) { match = r; break; }
      if (qty >= r.from) match = r;
    }
    return num(match?.pricePerUnit);
  }
  return 0;
}

function getPriceRange(cfg: CustomConfig): { min: number; max: number } {
  if (cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices.length > 0) {
    const perUnit = cfg.fixedPrices.filter(f => f.price && f.qty).map(f => num(f.price) / f.qty);
    if (perUnit.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...perUnit), max: Math.max(...perUnit) };
  }
  if (cfg.pricingModel === "range_per_unit" && cfg.rangePrices.length > 0) {
    const rates = cfg.rangePrices.filter(r => r.pricePerUnit).map(r => num(r.pricePerUnit));
    if (rates.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...rates), max: Math.max(...rates) };
  }
  return { min: 0, max: 0 };
}

function getMinQty(cfg: CustomConfig): number {
  // Prefer the explicit admin-set minimum, fall back to the smallest price tier
  if (cfg.minQuantity && cfg.minQuantity > 0) return cfg.minQuantity;
  if (cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices.length > 0) {
    return Math.min(...cfg.fixedPrices.filter(f => f.qty > 0).map(f => f.qty));
  }
  if (cfg.pricingModel === "range_per_unit" && cfg.rangePrices.length > 0) {
    return cfg.rangePrices[0]?.from || 1;
  }
  return 1;
}

function getQtyStep(cfg: CustomConfig): number {
  // Use the explicit admin-configured step — price tier gaps are NOT the step
  if (cfg.quantityStep && cfg.quantityStep > 1) return cfg.quantityStep;
  return 1;
}

/* ─── Product Image Carousel ─── */
function ProductImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const total = images.length;
  const prev = () => setCurrent(c => (c - 1 + total) % total);
  const next = () => setCurrent(c => (c + 1) % total);

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    touchEnd.current = e.changedTouches[0].clientX;
    if (touchStart.current !== null && touchEnd.current !== null) {
      const diff = touchStart.current - touchEnd.current;
      if (Math.abs(diff) > 40) { diff > 0 ? next() : prev(); }
    }
    touchStart.current = null;
    touchEnd.current = null;
  };

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl flex items-center justify-center border border-gray-100">
        <ShoppingCart size={60} className="text-gray-200" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 cursor-pointer select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => setLightbox(true)}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={images[current]}
            alt={`${alt} ${current + 1}`}
            className="w-full h-full object-contain"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            draggable={false}
          />
        </AnimatePresence>

        {/* Nav Arrows */}
        {total > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors z-10"
            >
              <ChevronRight size={16} className="rotate-180" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors z-10"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Counter */}
        {total > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none">
            {current + 1} / {total}
          </div>
        )}

        {/* Click to zoom hint */}
        <div className="absolute top-3 right-3 bg-black/30 text-white text-[10px] px-2 py-1 rounded-full pointer-events-none">
          Click to zoom
        </div>
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex gap-1.5 justify-center">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${i === current ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-gray-300"}`}
            />
          ))}
        </div>
      )}

      {/* Thumbnail Strip */}
      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${i === current ? "border-primary shadow-md shadow-pink-500/20" : "border-transparent hover:border-gray-300"}`}
            >
              <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={images[current]}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-xl"
            draggable={false}
          />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
          {total > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── X (Twitter) brand icon ─── */
function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

/* ─── Social Share ─── */
const SOCIALS = [
  { key: "facebook", Icon: Facebook, color: "#1877f2", label: "Facebook",
    getUrl: (url: string, title: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { key: "x", Icon: null, color: "#000000", label: "X",
    getUrl: (url: string, title: string) => `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { key: "linkedin", Icon: Linkedin, color: "#0a66c2", label: "LinkedIn",
    getUrl: (url: string, title: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { key: "mail", Icon: Mail, color: "#ea4335", label: "Email",
    getUrl: (url: string, title: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
];

/* ─── Artwork Guide Download ─── */
function ArtworkGuideDownload({ url, name }: { url: string; name: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      window.open(url, "_blank", "noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline disabled:opacity-60"
    >
      {downloading
        ? <><Loader2 size={14} className="animate-spin" /> Downloading…</>
        : <><Download size={14} /> Download artwork guide</>}
      {!downloading && name && name !== "artwork-guide" && (
        <span className="text-xs font-normal text-gray-400 ml-1">({name})</span>
      )}
    </button>
  );
}

/* ─── Main Page ─── */
export default function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const numericId = /^\d+$/.test(slug) ? parseInt(slug, 10) : 0;
  const isNumeric = numericId > 0;

  // Numeric ID path (backward compat for old /product/4 links)
  const { data: productById, isLoading: loadingById } = useGetProduct(numericId, { query: { enabled: isNumeric } });

  // Slug path — fetch all products and find by slug match
  const { data: allProducts, isLoading: loadingAll } = useListProducts({}, { query: { enabled: !isNumeric } });
  const productBySlug = useMemo(() => {
    if (isNumeric || !allProducts) return undefined;
    return (allProducts as any[]).find((p: any) => slugify(p.name) === slug);
  }, [allProducts, slug, isNumeric]);

  const product = isNumeric ? productById : productBySlug;
  const isLoading = isNumeric ? loadingById : loadingAll;
  const error = !isLoading && !product ? new Error("Not found") : null;
  const { addItem } = useCart();
  const { toast } = useToast();
  const [addedAnim, setAddedAnim] = useState(false);

  const cfg = useMemo(() => parseConfig((product as any)?.customConfig), [product]);
  const isCustom = cfg.productType === "custom_print";
  const isMultiSize = cfg.productType === "multi_size_tier";
  const isMultiPrints = cfg.productType === "multi_prints";
  const sizes = useMemo(() => (cfg.sizes || []).filter(s => s.name && s.tiers.length > 0), [cfg.sizes]);

  /* ── Multi Prints state ── */
  const mpBoards = useMemo(() => (cfg.multiPrintsBoardTypes || []).filter(b => b.isActive !== false), [cfg]);
  const [mpBoardIdx, setMpBoardIdx] = useState(0);
  const [mpPrintSideId, setMpPrintSideId] = useState("");
  const [mpLaminationId, setMpLaminationId] = useState("");
  const [mpRoundCorner, setMpRoundCorner] = useState(false);

  const mpBoard = isMultiPrints ? (mpBoards[mpBoardIdx] ?? null) : null;

  // reset child selections when board changes
  useEffect(() => {
    if (!mpBoard) return;
    setMpPrintSideId(mpBoard.printSides[0]?.id ?? "");
    setMpLaminationId(mpBoard.laminations[0]?.id ?? "");
    setMpRoundCorner(false);
  }, [mpBoardIdx, mpBoard?.id]);

  const mpSelectedPS = mpBoard?.printSides.find(p => p.id === mpPrintSideId) ?? mpBoard?.printSides[0] ?? null;
  const mpSelectedLam = mpBoard?.laminations.find(l => l.id === mpLaminationId) ?? mpBoard?.laminations[0] ?? null;

  const minQty = useMemo(() => isCustom ? getMinQty(cfg) : 1, [cfg, isCustom]);
  const qtyStep = useMemo(() => isCustom ? getQtyStep(cfg) : 1, [cfg, isCustom]);
  const { min: priceMin, max: priceMax } = useMemo(() => {
    if (isMultiPrints && mpBoards.length > 0) {
      const allRates: number[] = [];
      for (const b of mpBoards) {
        if (b.basePricingMode === "unit") { allRates.push(num(b.baseUnitPrice)); }
        else { for (const t of b.baseTiers) allRates.push(num(t.price)); }
      }
      if (allRates.filter(r => r > 0).length) return { min: Math.min(...allRates.filter(r=>r>0)), max: Math.max(...allRates) };
    }
    if (isMultiSize && sizes.length > 0) {
      const allRates: number[] = [];
      for (const sz of sizes) for (const t of sz.tiers) if (t.pricePerUnit) allRates.push(num(t.pricePerUnit));
      if (allRates.length) return { min: Math.min(...allRates), max: Math.max(...allRates) };
    }
    return getPriceRange(cfg);
  }, [cfg, isMultiPrints, isMultiSize, mpBoards, sizes]);

  const [qty, setQty] = useState(minQty);
  const [qtyInput, setQtyInput] = useState(String(minQty));
  const [qtyWarning, setQtyWarning] = useState("");
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(0);

  useEffect(() => {
    if (!product) return;
    if (isMultiSize && sizes.length > 0) {
      setSelectedSizeIdx(0);
      const sz = sizes[0];
      const initQty = Math.max(sz.minQty || 1, sz.packSize || 1);
      setQty(initQty);
      setQtyInput(String(initQty));
      setQtyWarning("");
      return;
    }
    if (isCustom && minQty > 1) {
      setQty(minQty);
      setQtyInput(String(minQty));
      setQtyWarning("");
    }
  }, [product?.id, isCustom, isMultiSize, minQty]);

  const selectedSize = isMultiSize ? sizes[selectedSizeIdx] : null;
  const selectedSizeId = selectedSize?.id || undefined;

  const validateQtyPD = (val: number): string => {
    if (isMultiSize && selectedSize) {
      const ps = selectedSize.packSize || 1;
      const mq = Math.max(selectedSize.minQty || 1, ps);
      if (val < mq) return `Minimum quantity is ${mq} pcs`;
      if (ps > 1 && val % ps !== 0) return `Must be a multiple of ${ps}`;
      return "";
    }
    if (val < minQty) return `Minimum quantity is ${minQty} pcs`;
    if (qtyStep > 1 && (val - minQty) % qtyStep !== 0) {
      const nearest = minQty + Math.round((val - minQty) / qtyStep) * qtyStep;
      return `Must be a multiple of ${qtyStep} (nearest: ${Math.max(minQty, nearest)} pcs)`;
    }
    return "";
  };

  // Base unit price changes with qty
  const baseUnitPrice = useMemo(() => {
    if (isMultiPrints && mpBoard) {
      const boardBase = resolveMPPrice(qty, mpBoard.basePricingMode, mpBoard.baseUnitPrice, mpBoard.baseTiers);
      const psPrice = mpSelectedPS ? resolveMPPrice(qty, mpSelectedPS.pricingMode, mpSelectedPS.unitPrice, mpSelectedPS.tiers) : 0;
      const lamPrice = mpSelectedLam ? resolveMPPrice(qty, mpSelectedLam.pricingMode, mpSelectedLam.unitPrice, mpSelectedLam.tiers) : 0;
      const rcPrice = (mpRoundCorner && mpBoard.roundCornerCut?.enabled)
        ? resolveMPPrice(qty, mpBoard.roundCornerCut.pricingMode, mpBoard.roundCornerCut.unitPrice, mpBoard.roundCornerCut.tiers)
        : 0;
      return boardBase + psPrice + lamPrice + rcPrice;
    }
    if (isMultiSize && selectedSize) return getSizeTierRate(selectedSize.tiers, qty);
    if (isCustom) return getBaseUnitPrice(cfg, qty);
    return num(product?.price);
  }, [cfg, isCustom, isMultiPrints, isMultiSize, selectedSize, mpBoard, mpSelectedPS, mpSelectedLam, mpRoundCorner, qty, product?.price]);

  // Helper: get effective price for a choice considering size-dependent pricing
  const getChoicePrice = (choice: Choice, sizeId?: string): number => {
    if (sizeId && choice.sizePrices?.length) {
      const sizePrice = choice.sizePrices.find(sp => sp.sizeId === sizeId);
      if (sizePrice && sizePrice.price) return num(sizePrice.price);
    }
    return num(choice.price);
  };

  // Add-on costs per unit
  const addonPerUnit = useMemo(() => {
    if (cfg.optionGroups.length === 0) return 0;
    const currentSizeId = isMultiSize && selectedSizeId ? selectedSizeId : undefined;
    return cfg.optionGroups.reduce((acc, group) => {
      const choiceId = selectedChoices[group.id];
      if (!choiceId) return acc;
      const choice = group.choices.find(c => c.id === choiceId);
      if (!choice) return acc;
      return acc + (choice.chargeType === "per_unit" ? getChoicePrice(choice, currentSizeId) : 0);
    }, 0);
  }, [cfg, selectedChoices, isMultiSize, selectedSizeId]);

  const addonFlat = useMemo(() => {
    if (cfg.optionGroups.length === 0) return 0;
    const currentSizeId = isMultiSize && selectedSizeId ? selectedSizeId : undefined;
    return cfg.optionGroups.reduce((acc, group) => {
      const choiceId = selectedChoices[group.id];
      if (!choiceId) return acc;
      const choice = group.choices.find(c => c.id === choiceId);
      if (!choice) return acc;
      return acc + (choice.chargeType === "flat" ? getChoicePrice(choice, currentSizeId) : 0);
    }, 0);
  }, [cfg, selectedChoices, isMultiSize, selectedSizeId]);

  const unitPrice = baseUnitPrice + addonPerUnit;
  const subtotal = unitPrice * qty + addonFlat;
  const total = subtotal;

  const valueSuggestions = useMemo(() => {
    const thresholds: number[] = [];
    if (isMultiPrints && mpBoard) {
      const addTiers = (mode: MPPricingMode, tiers: MPTier[]) => {
        if (mode === "qty-range") thresholds.push(...(tiers || []).map(t => t.minQty));
      };
      addTiers(mpBoard.basePricingMode, mpBoard.baseTiers);
      if (mpSelectedPS) addTiers(mpSelectedPS.pricingMode, mpSelectedPS.tiers);
      if (mpSelectedLam) addTiers(mpSelectedLam.pricingMode, mpSelectedLam.tiers);
      if (mpRoundCorner && mpBoard.roundCornerCut?.enabled) addTiers(mpBoard.roundCornerCut.pricingMode, mpBoard.roundCornerCut.tiers);
    } else if (isMultiSize && selectedSize) {
      thresholds.push(...selectedSize.tiers.map(t => t.from));
    } else if (isCustom && cfg.pricingModel === "fixed_quantities") {
      thresholds.push(...cfg.fixedPrices.map(t => t.qty));
    } else if (isCustom && cfg.pricingModel === "range_per_unit") {
      thresholds.push(...cfg.rangePrices.map(t => t.from));
    }

    const pack = isMultiSize ? Math.max(1, selectedSize?.packSize || 1) : 1;
    const currentEffectiveUnit = qty > 0 ? total / qty : unitPrice;
    const resolveFutureBase = (futureQty: number) => {
      if (isMultiPrints && mpBoard) {
        const boardBase = resolveMPPrice(futureQty, mpBoard.basePricingMode, mpBoard.baseUnitPrice, mpBoard.baseTiers);
        const psPrice = mpSelectedPS ? resolveMPPrice(futureQty, mpSelectedPS.pricingMode, mpSelectedPS.unitPrice, mpSelectedPS.tiers) : 0;
        const lamPrice = mpSelectedLam ? resolveMPPrice(futureQty, mpSelectedLam.pricingMode, mpSelectedLam.unitPrice, mpSelectedLam.tiers) : 0;
        const cornerPrice = (mpRoundCorner && mpBoard.roundCornerCut?.enabled)
          ? resolveMPPrice(futureQty, mpBoard.roundCornerCut.pricingMode, mpBoard.roundCornerCut.unitPrice, mpBoard.roundCornerCut.tiers)
          : 0;
        return boardBase + psPrice + lamPrice + cornerPrice;
      }
      if (isMultiSize && selectedSize) return getSizeTierRate(selectedSize.tiers, futureQty);
      if (isCustom) return getBaseUnitPrice(cfg, futureQty);
      return num(product?.price);
    };

    return Array.from(new Set(thresholds.map(value => Math.ceil(value / pack) * pack)))
      .filter(value => value > qty)
      .sort((a, b) => a - b)
      .map(quantity => {
        const futureUnit = resolveFutureBase(quantity) + addonPerUnit;
        const futureTotal = futureUnit * quantity + addonFlat;
        const effectiveUnit = futureTotal / quantity;
        return {
          quantity,
          total: futureTotal,
          unitPrice: effectiveUnit,
          savingPerUnit: currentEffectiveUnit - effectiveUnit,
          totalSaving: (currentEffectiveUnit - effectiveUnit) * quantity,
        };
      })
      .filter(option => option.savingPerUnit > 0.0001)
      .slice(0, 2);
  }, [qty, total, unitPrice, addonPerUnit, addonFlat, cfg, isCustom, isMultiPrints, isMultiSize, selectedSize, mpBoard, mpSelectedPS, mpSelectedLam, mpRoundCorner, product?.price]);

  const changeQty = (delta: number) => {
    if (isMultiSize && selectedSize) {
      const ps = selectedSize.packSize || 1;
      const mq = Math.max(selectedSize.minQty || 1, ps);
      const next = Math.max(mq, qty + delta * ps);
      setQty(next);
      setQtyInput(String(next));
      setQtyWarning("");
      return;
    }
    const next = Math.max(minQty, qty + delta * qtyStep);
    setQty(next);
    setQtyInput(String(next));
    setQtyWarning(validateQtyPD(next));
  };

  const handleSelectSize = (idx: number) => {
    setSelectedSizeIdx(idx);
    const sz = sizes[idx];
    const ps = sz?.packSize || 1;
    const initQty = Math.max(sz?.minQty || 1, ps);
    setQty(initQty);
    setQtyInput(String(initQty));
    setQtyWarning("");
  };

  const snapMultiSizeQty = () => {
    if (!selectedSize) return;
    const ps = selectedSize.packSize || 1;
    const mq = Math.max(selectedSize.minQty || 1, ps);
    const raw = parseInt(qtyInput);
    if (isNaN(raw) || raw < mq) {
      setQty(mq);
      setQtyInput(String(mq));
      setQtyWarning("");
      return;
    }
    if (raw % ps !== 0) {
      const nearest = Math.max(ps, Math.round(raw / ps) * ps);
      setQty(nearest);
      setQtyInput(String(nearest));
      setQtyWarning("");
      toast({ title: "Quantity adjusted", description: `Adjusted to ${nearest} pcs (must be a multiple of ${ps}).`, duration: 4000 });
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    let effectiveUnitPrice: number;
    let label: string;
    let toastDesc: string;
    let itemNotes: string | null = null;

    if (isMultiPrints && mpBoard) {
      effectiveUnitPrice = unitPrice; // unitPrice = baseUnitPrice + addonPerUnit (option groups)
      const psLabel = mpSelectedPS?.label ?? "";
      const lamLabel = mpSelectedLam?.label ?? "";
      const rcLabel = mpRoundCorner ? " + Round Corner" : "";
      label = `${product.name} — ${mpBoard.name} | ${psLabel} | ${lamLabel}${rcLabel} (${qty} pcs)`;
      toastDesc = `${product.name} × ${qty} added — ${mpBoard.name}, ${psLabel}, ${lamLabel}${rcLabel}`;
      // Build notes from any extra option groups on multi-prints
      const optionParts = cfg.optionGroups
        .map(group => {
          const choiceId = selectedChoices[group.id];
          if (!choiceId) return null;
          const choice = group.choices.find(c => c.id === choiceId);
          return choice ? `${group.title}: ${choice.name}` : null;
        })
        .filter(Boolean) as string[];
      if (optionParts.length > 0) itemNotes = optionParts.join(", ");
    } else {
      effectiveUnitPrice = qty > 0 ? total / qty : total;
      label = isMultiSize && selectedSize
        ? `${product.name} — ${selectedSize.name} (${qty} pcs)`
        : qty > 1 ? `${product.name} (${qty} pcs)` : product.name;
      toastDesc = `${product.name}${selectedSize ? ` (${selectedSize.name})` : ""} × ${qty} added to your order.`;
      // Build notes from selected option choices (e.g. "Lamination: Matte Laminate")
      const optionParts = cfg.optionGroups
        .map(group => {
          const choiceId = selectedChoices[group.id];
          if (!choiceId) return null;
          const choice = group.choices.find(c => c.id === choiceId);
          return choice ? `${group.title}: ${choice.name}` : null;
        })
        .filter(Boolean) as string[];
      if (optionParts.length > 0) itemNotes = optionParts.join(", ");
    }

    addItem({
      id: `p-${product.id}-${Date.now()}`,
      productId: product.id,
      name: label,
      price: effectiveUnitPrice.toFixed(2),
      quantity: qty,
      imageUrl: product.imageUrl,
      notes: itemNotes,
    });
    setAddedAnim(true);
    setTimeout(() => setAddedAnim(false), 1500);
    toast({ title: "Added to cart!", description: toastDesc, duration: 5000 });
  };

  // ─── Loading / Error ───
  if (isLoading) {
    return (
      <div className="hs-product-page min-h-screen pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-pulse">
            <div className="aspect-square bg-gray-100 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-gray-100 rounded w-2/3" />
              <div className="h-10 bg-gray-100 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-4/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="hs-product-page min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-700 mb-2">Product not found</h2>
          <Link href="/store" className="text-primary underline">Back to Store</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hs-product-page min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-400 font-medium mb-6 sm:mb-8 min-w-0">
          <Link href="/" className="hover:text-primary transition-colors shrink-0">HOME</Link>
          <ChevronRight size={12} className="shrink-0" />
          {product.category && (
            <>
              <Link href="/store" className="hover:text-primary transition-colors uppercase shrink-0 max-w-[40vw] truncate">{product.category.name}</Link>
              <ChevronRight size={12} className="shrink-0" />
            </>
          )}
          <span className="text-gray-700 uppercase truncate min-w-0 flex-1">{product.name}</span>
        </nav>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">
          {/* ──── LEFT: Image Carousel ──── */}
          <div className="space-y-4">
            <ProductImageCarousel
              images={[
                ...(product.imageUrl ? [product.imageUrl] : []),
                ...((product as any).galleryImages || []).filter((u: string) => u !== product.imageUrl),
              ].filter(Boolean)}
              alt={product.name}
            />

            {/* Social Share */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Share2 size={12} /> Share:</span>
              {SOCIALS.map(({ key, Icon, color, label, getUrl }) => {
                const shareUrl = typeof window !== "undefined" ? window.location.href : "";
                const href = getUrl(shareUrl, (product as any)?.name || "Photo frame");
                return (
                  <a
                    key={key}
                    href={href}
                    target={key === "mail" ? "_self" : "_blank"}
                    rel="noreferrer"
                    aria-label={`Share on ${label}`}
                    title={`Share on ${label}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform text-white"
                    style={{ backgroundColor: color }}
                  >
                    {key === "x" ? <XIcon size={13} /> : Icon ? <Icon size={13} className="text-white" /> : null}
                  </a>
                );
              })}
            </div>
          </div>

          {/* ──── RIGHT: Details ──── */}
          <div className="space-y-5">
            {/* Header */}
            {product.category && (
              <div className="text-xs font-bold text-primary uppercase tracking-widest">{product.category.name}</div>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-gray-900 leading-tight break-words">{product.name}</h1>

            {/* Price Range / Live Price */}
            {(isCustom || isMultiSize || isMultiPrints) && priceMin > 0 ? (
              <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-lg sm:text-2xl font-bold text-pink-600">{rs(priceMin)}</span>
                {priceMax > priceMin && (
                  <><span className="text-gray-400">–</span><span className="text-lg sm:text-2xl font-bold text-pink-600">{rs(priceMax)}</span></>
                )}
                <span className="text-xs sm:text-sm text-gray-400">per unit</span>
              </div>
            ) : (
              /* Standard product — show live price including any addon */
              <div className="flex items-baseline gap-2 flex-wrap">
                <motion.span
                  key={unitPrice}
                  initial={{ scale: 1.08 }}
                  animate={{ scale: 1 }}
                  className="text-lg sm:text-2xl font-bold text-pink-600"
                >
                  {rs(unitPrice > 0 ? unitPrice : num(product.price))}
                </motion.span>
                {addonPerUnit > 0 && (
                  <span className="text-xs text-gray-400 line-through">{rs(num(product.price))}</span>
                )}
                <span className="text-xs text-gray-400">per unit</span>
              </div>
            )}

            {/* Meta badges */}
            <div className="flex flex-wrap gap-3">
              {cfg.productionTime && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                  <Clock size={12} /> {cfg.productionTime}
                </div>
              )}
              {cfg.sizeLabel && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                  <Ruler size={12} /> {cfg.sizeLabel}
                </div>
              )}
              {product.featured && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
                  <Star size={12} fill="currentColor" /> Featured
                </div>
              )}
            </div>

            <DescriptionDisplay
              value={product.description}
              className="text-sm text-gray-600 leading-relaxed"
              iconSize={15}
            />


            {/* Artwork Guide */}
            {(product as any).artworkGuideUrl && (
              <ArtworkGuideDownload
                url={(product as any).artworkGuideUrl}
                name={(product as any).artworkGuideName || "artwork-guide"}
              />
            )}

            <div className="border-t border-gray-100" />

            {/* ─── Multi Prints Configurator ─── */}
            {isMultiPrints && mpBoards.length > 0 && (
              <div className="space-y-3">

                {/* ── Board Type ── */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Board Type</label>
                  <select
                    value={mpBoardIdx}
                    onChange={e => setMpBoardIdx(Number(e.target.value))}
                    className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer hover:border-pink-300 transition-colors"
                  >
                    {mpBoards.map((b, i) => (
                      <option key={b.id} value={i}>{b.name} — {b.gsm}gsm</option>
                    ))}
                  </select>
                  {mpBoard?.description && (
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{mpBoard.description}</p>
                  )}
                </div>

                {/* ── Print Sides dropdown ── */}
                {mpBoard && mpBoard.printSides.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Print Sides</label>
                    <select
                      value={mpPrintSideId || mpBoard.printSides[0]?.id || ""}
                      onChange={e => setMpPrintSideId(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer hover:border-pink-300 transition-colors"
                    >
                      {mpBoard.printSides.map(ps => {
                        const price = resolveMPPrice(qty, ps.pricingMode, ps.unitPrice, ps.tiers);
                        return (
                          <option key={ps.id} value={ps.id}>
                            {ps.label}{price > 0 ? ` — +${rs(price)}/unit` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* ── Laminations dropdown ── */}
                {mpBoard && mpBoard.laminations.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Lamination</label>
                    <select
                      value={mpLaminationId || mpBoard.laminations[0]?.id || ""}
                      onChange={e => setMpLaminationId(e.target.value)}
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer hover:border-purple-300 transition-colors"
                    >
                      {mpBoard.laminations.map(lam => {
                        const price = resolveMPPrice(qty, lam.pricingMode, lam.unitPrice, lam.tiers);
                        return (
                          <option key={lam.id} value={lam.id}>
                            {lam.label}{price > 0 ? ` — +${rs(price)}/unit` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* ── Round Corner Cut dropdown ── */}
                {mpBoard?.roundCornerCut?.enabled && (() => {
                  const rc = mpBoard.roundCornerCut!;
                  const rcPrice = resolveMPPrice(qty, rc.pricingMode, rc.unitPrice, rc.tiers);
                  return (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Round Corner Cut</label>
                      <select
                        value={mpRoundCorner ? "yes" : "no"}
                        onChange={e => setMpRoundCorner(e.target.value === "yes")}
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer hover:border-indigo-300 transition-colors"
                      >
                        <option value="no">No Round Corner Cut</option>
                        <option value="yes">Add Round Corner Cut{rcPrice > 0 ? ` — +${rs(rcPrice)}/unit` : ""}</option>
                      </select>
                    </div>
                  );
                })()}

                {/* ── Live Price Breakdown ── */}
                {mpBoard && baseUnitPrice > 0 && (() => {
                  const boardBase = resolveMPPrice(qty, mpBoard.basePricingMode, mpBoard.baseUnitPrice, mpBoard.baseTiers);
                  const psP = mpSelectedPS ? resolveMPPrice(qty, mpSelectedPS.pricingMode, mpSelectedPS.unitPrice, mpSelectedPS.tiers) : 0;
                  const lamP = mpSelectedLam ? resolveMPPrice(qty, mpSelectedLam.pricingMode, mpSelectedLam.unitPrice, mpSelectedLam.tiers) : 0;
                  const rcP = (mpRoundCorner && mpBoard.roundCornerCut?.enabled)
                    ? resolveMPPrice(qty, mpBoard.roundCornerCut!.pricingMode, mpBoard.roundCornerCut!.unitPrice, mpBoard.roundCornerCut!.tiers) : 0;
                  /* option-group addons (e.g. Round Corner Cut added as option group) */
                  const currentSizeId = isMultiSize && selectedSizeId ? selectedSizeId : undefined;
                  const optionRows = cfg.optionGroups
                    .map(group => {
                      const choiceId = selectedChoices[group.id];
                      if (!choiceId) return null;
                      const choice = group.choices.find(c => c.id === choiceId);
                      if (!choice) return null;
                      const price = getChoicePrice(choice, currentSizeId);
                      if (price === 0) return null;
                      return { group, choice, price };
                    })
                    .filter(Boolean) as { group: OptionGroup; choice: Choice; price: number }[];
                  /* unitPrice already = baseUnitPrice + addonPerUnit + addonFlat-related,
                     use it for the totals so everything stays in sync */
                  return (
                    <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white mt-1">
                      {/* header */}
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Price Breakdown</span>
                        <span className="text-xs text-gray-400">{qty} unit{qty !== 1 ? "s" : ""}</span>
                      </div>
                      {/* line items */}
                      <div className="divide-y divide-gray-50">
                        {boardBase > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm text-gray-500 truncate pr-2">Board — {mpBoard.name}</span>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">{rs(boardBase)}<span className="text-xs font-normal text-gray-400">/unit</span></span>
                          </div>
                        )}
                        {psP > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm text-gray-500 truncate pr-2">{mpSelectedPS?.label}</span>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">+{rs(psP)}<span className="text-xs font-normal text-gray-400">/unit</span></span>
                          </div>
                        )}
                        {lamP > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm text-gray-500 truncate pr-2">{mpSelectedLam?.label}</span>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">+{rs(lamP)}<span className="text-xs font-normal text-gray-400">/unit</span></span>
                          </div>
                        )}
                        {rcP > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm text-gray-500">Round Corner Cut</span>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">+{rs(rcP)}<span className="text-xs font-normal text-gray-400">/unit</span></span>
                          </div>
                        )}
                        {/* option group addons (e.g. extra features added via Selection Options) */}
                        {optionRows.map(({ group, choice, price }) => (
                          <div key={group.id} className="flex items-center justify-between px-4 py-2.5 bg-indigo-50/40">
                            <span className="text-sm text-gray-500 truncate pr-2">
                              {group.title}: <span className="font-medium text-gray-700">{choice.name}</span>
                            </span>
                            <span className="text-sm font-semibold text-gray-700 shrink-0">
                              +{rs(price)}
                              <span className="text-xs font-normal text-gray-400">
                                {choice.chargeType === "per_unit" ? "/unit" : " flat"}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* unit total — use unitPrice so addons are included */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                        <span className="text-sm font-bold text-gray-700">Unit Total</span>
                        <motion.span key={unitPrice} initial={{ scale: 1.12 }} animate={{ scale: 1 }} className="text-base font-bold text-pink-600">{rs(unitPrice)}</motion.span>
                      </div>
                      {/* grand total — use unitPrice × qty + addonFlat */}
                      <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-pink-50 to-purple-50 border-t border-pink-100">
                        <div>
                          <span className="text-sm font-bold text-gray-900">Total</span>
                          <span className="text-xs text-gray-400 ml-1">({qty} × {rs(unitPrice)}{addonFlat > 0 ? ` + ${rs(addonFlat)}` : ""})</span>
                        </div>
                        <motion.span key={total} initial={{ scale: 1.12 }} animate={{ scale: 1 }} className="text-xl font-extrabold text-pink-600">{rs(total)}</motion.span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ─── Multi-Size Tier Selector ─── */}
            {isMultiSize && sizes.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Size</label>
                <select
                  value={selectedSizeIdx}
                  onChange={e => handleSelectSize(Number(e.target.value))}
                  className="w-full py-3 px-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer hover:border-blue-300 transition-colors"
                >
                  {sizes.map((sz, i) => (
                    <option key={sz.id} value={i}>
                      {sz.name} — {sz.unitLabel || "Pack"} of {sz.packSize}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ─── Price Tier Chart (Multi-Size) ─── */}
            {isMultiSize && selectedSize && selectedSize.tiers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Pricing Tiers</label>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span>Quantity</span>
                    <span>Price / Unit</span>
                  </div>
                  {selectedSize.minQty && selectedSize.minQty > 1 && (
                    <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100 font-medium">
                      Minimum order: {selectedSize.minQty} pcs
                    </div>
                  )}
                  {[...selectedSize.tiers].sort((a, b) => a.from - b.from).map((t, i) => {
                    const isActive = qty >= t.from && qty <= t.to;
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm border-t border-gray-50 transition-colors ${isActive ? "bg-blue-50 font-semibold text-blue-900" : "text-gray-600"}`}
                      >
                        <span>{t.from}–{t.to} pcs</span>
                        <span className="font-semibold">{rs(num(t.pricePerUnit))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Dynamic Options (standard / custom_print / multi_size) ─── */}
            {cfg.optionGroups.length > 0 && (
              <div className="space-y-3">
                {Object.values(selectedChoices).some(v => v) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedChoices({})}
                      className="text-xs text-gray-400 hover:text-pink-500 font-medium uppercase tracking-wide transition-colors"
                    >
                      CLEAR
                    </button>
                  </div>
                )}
                {cfg.optionGroups.map(group => {
                  const currentSizeId = isMultiSize && selectedSizeId ? selectedSizeId : undefined;
                  return (
                    <div key={group.id}>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{group.title}</label>
                      <select
                        value={selectedChoices[group.id] || ""}
                        onChange={e => setSelectedChoices(prev => ({ ...prev, [group.id]: e.target.value }))}
                        className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 cursor-pointer hover:border-gray-300 transition-colors"
                      >
                        <option value="">Select {group.title}…</option>
                        {group.choices.map(c => {
                          const effectivePrice = currentSizeId && c.sizePrices?.length
                            ? (c.sizePrices.find(sp => sp.sizeId === currentSizeId)?.price || c.price)
                            : c.price;
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name}{effectivePrice ? ` — +${rs(num(effectivePrice))}${c.chargeType === "per_unit" ? "/unit" : ""}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Fixed Qty Pricing Tiers ─── */}
            {isCustom && cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices.length > 0 && (() => {
              const sortedTiers = [...cfg.fixedPrices].filter(t => t.qty > 0 && t.price).sort((a, b) => a.qty - b.qty);
              const applicable = sortedTiers.filter(t => qty >= t.qty).at(-1) ?? sortedTiers[0];
              return (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Price Tiers</label>
                  <div className="flex flex-wrap gap-2">
                    {sortedTiers.map(tier => {
                      const isApplicable = applicable?.qty === tier.qty;
                      return (
                        <button
                          key={tier.qty}
                          type="button"
                          onClick={() => { setQty(tier.qty); setQtyInput(String(tier.qty)); setQtyWarning(""); }}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all text-left ${
                            isApplicable
                              ? "border-pink-500 bg-pink-50 text-pink-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <div>{tier.qty}+ pcs</div>
                          {tier.price && <div className="text-[11px] font-normal text-current opacity-70">{rs(num(tier.price) / tier.qty)}/unit</div>}
                          {isApplicable && qty !== tier.qty && (
                            <div className="text-[9px] font-bold text-pink-500 mt-0.5">applied</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {applicable && qty !== applicable.qty && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      Qty {qty} → using <span className="font-semibold text-pink-600">{applicable.qty} pcs tier</span> rate ({rs(num(applicable.price) / applicable.qty)}/unit)
                    </p>
                  )}
                </div>
              );
            })()}

            {!!valueSuggestions.length && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4">
                <div className="flex items-start gap-2">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">More quantity, better unit price</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Quantity එක ටිකක් වැඩි කළොත් unit price එක අඩු කරගන්න පුළුවන්. ඔබට හොඳම value option එක පහතින් බලන්න.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {valueSuggestions.map(option => (
                    <button
                      key={option.quantity}
                      type="button"
                      onClick={() => { setQty(option.quantity); setQtyInput(String(option.quantity)); setQtyWarning(""); }}
                      className="rounded-xl border border-emerald-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Buy {option.quantity}+</span>
                      <strong className="mt-1 block text-base text-slate-900">{rs(option.unitPrice)} each</strong>
                      <span className="mt-0.5 block text-xs text-slate-500">Total {rs(option.total)}</span>
                      <span className="mt-1.5 block text-xs font-semibold text-emerald-700">Total saving {rs(option.totalSaving)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Live Unit Price (custom / multi_size only) ─── */}
            {(isCustom || isMultiSize) && unitPrice > 0 && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-gray-500">Unit price:</span>
                <motion.span
                  key={unitPrice}
                  initial={{ scale: 1.15, color: "#ec4899" }}
                  animate={{ scale: 1, color: "#7c3aed" }}
                  className="text-lg font-bold"
                >
                  {rs(unitPrice)}
                </motion.span>
                {addonFlat > 0 && <span className="text-xs text-gray-400">+ {rs(addonFlat)} flat fee</span>}
              </div>
            )}

            {/* ─── Summary / Price Breakdown (all product types except multi_prints) ─── */}
            {!isMultiPrints && (num(product.price) > 0 || isCustom || isMultiSize || addonPerUnit > 0 || addonFlat > 0) && (
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                {/* Base product price row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Base Price</span>
                  <span className="text-sm text-gray-700">
                    {rs(baseUnitPrice)}
                    <span className="text-gray-400 text-xs ml-1">× {qty}</span>
                    <span className="text-gray-400 text-xs mx-1">=</span>
                    <span className="font-bold text-gray-900">{rs(baseUnitPrice * qty)}</span>
                  </span>
                </div>

                {/* Per-option breakdown rows */}
                {cfg.optionGroups.map(group => {
                  const choiceId = selectedChoices[group.id];
                  if (!choiceId) return null;
                  const choice = group.choices.find(c => c.id === choiceId);
                  if (!choice) return null;
                  const currentSizeId = isMultiSize && selectedSizeId ? selectedSizeId : undefined;
                  const price = getChoicePrice(choice, currentSizeId);
                  if (price === 0) return null;
                  return (
                    <div key={group.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500">
                        {group.title}: <span className="text-gray-700">{choice.name}</span>
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {choice.chargeType === "per_unit" ? (
                          <>+{rs(price)}<span className="text-gray-400 text-xs ml-1">× {qty} = </span><span className="font-bold text-gray-900">+{rs(price * qty)}</span></>
                        ) : (
                          <><span className="text-gray-400 text-xs mr-1">flat </span><span className="font-bold text-gray-900">+{rs(price)}</span></>
                        )}
                      </span>
                    </div>
                  );
                })}

                {/* Total row */}
                <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-pink-50 to-purple-50">
                  <span className="font-bold text-gray-900 text-sm uppercase tracking-wide">Total</span>
                  <motion.span key={total} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="text-xl font-extrabold text-pink-600">
                    {rs(total)}
                  </motion.span>
                </div>
              </div>
            )}

            {cfg.offerEnabled && cfg.offerMessage?.trim() && (() => {
              const threshold = Math.max(0, Number(cfg.offerMinAmount) || 0);
              const unlocked = threshold === 0 || total >= threshold;
              const remaining = Math.max(0, threshold - total);
              const progress = threshold > 0 ? Math.min(100, (total / threshold) * 100) : 100;
              return (
                <div className={`rounded-2xl border p-4 ${unlocked ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" : "border-pink-200 bg-gradient-to-br from-pink-50 via-white to-purple-50"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unlocked ? "bg-emerald-100 text-emerald-600" : "bg-pink-100 text-pink-600"}`}><Gift size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-pink-500">{unlocked ? "Offer unlocked!" : "Special offer"}</div>
                      <p className="mt-0.5 text-sm font-semibold leading-relaxed text-gray-900">{cfg.offerMessage}</p>
                      {threshold > 0 && (
                        <>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><motion.div className={`h-full rounded-full ${unlocked ? "bg-emerald-500" : "bg-gradient-to-r from-pink-500 to-purple-500"}`} initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div>
                          <p className={`mt-1.5 text-xs ${unlocked ? "font-semibold text-emerald-700" : "text-gray-500"}`}>
                            {unlocked ? `Qualified with ${rs(total)}` : `Add ${rs(remaining)} more to unlock this offer`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Quantity + Add to Cart ─── */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                {/* Qty stepper */}
                <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden bg-white shrink-0">
                  <button
                    onClick={() => changeQty(-1)}
                    disabled={isMultiSize ? (qty <= Math.max(selectedSize?.minQty || 1, selectedSize?.packSize || 1)) : (qty <= minQty)}
                    className="w-11 h-11 flex items-center justify-center text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-30 border-r border-gray-200"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={qtyInput}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setQtyInput(raw);
                      const parsed = parseInt(raw);
                      if (!isNaN(parsed)) { setQty(parsed); setQtyWarning(validateQtyPD(parsed)); }
                      else { setQtyWarning(""); }
                    }}
                    onBlur={() => {
                      if (isMultiSize) { snapMultiSizeQty(); return; }
                      const raw = parseInt(qtyInput);
                      if (isNaN(raw) || raw < minQty) { setQty(minQty); setQtyInput(String(minQty)); setQtyWarning(""); }
                    }}
                    className={`w-16 text-center text-base font-bold text-gray-900 outline-none py-2.5 ${qtyWarning ? "text-red-500" : ""}`}
                  />
                  <button
                    onClick={() => changeQty(1)}
                    className="w-11 h-11 flex items-center justify-center text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors border-l border-gray-200"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Add to Cart */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddToCart}
                  disabled={!!qtyWarning || qtyInput === ""}
                  className={`flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 ${
                    addedAnim
                      ? "bg-green-500 text-white shadow-green-500/30"
                      : "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-pink-500/25 hover:opacity-90"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {addedAnim ? (
                      <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                        ✓ Added!
                      </motion.span>
                    ) : (
                      <motion.span key="add" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                        <ShoppingCart size={16} /> Add to Cart
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* warnings / notices */}
              {qtyWarning && (
                <p className="text-xs text-red-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{qtyWarning}
                </p>
              )}
              {isCustom && minQty > 1 && !qtyWarning && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  Min order: {minQty} pcs{qtyStep > 1 ? `, step ${qtyStep}` : ""}
                </p>
              )}
            </div>

            {/* ─── Footer Meta ─── */}
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <div className="text-xs text-gray-400"><span className="font-medium text-gray-500">SKU:</span> HS-{product.id.toString().padStart(4, "0")}</div>
              {product.category && (
                <div className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500">Category:</span>{" "}
                  <Link href="/store" className="hover:text-primary">{product.category.name}</Link>
                </div>
              )}
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-500">Tags:</span> printing, customizable, {product.category?.name?.toLowerCase() || "print"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
