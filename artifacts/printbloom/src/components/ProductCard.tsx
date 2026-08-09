import { useState } from "react";
import { ShoppingCart, Eye, Gift } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/store/use-cart";
import { formatPrice, slugify } from "@/lib/utils";
import { AddToCartModal } from "@/components/AddToCartModal";
import { parseDescriptionLines } from "@/lib/description-utils";

type Product = {
  id: number;
  name: string;
  description: string;
  price: string;
  priceType: string;
  imageUrl?: string | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  categoryId?: number | null;
  category?: { id: number; name: string } | null;
  createdAt: string;
  customConfig?: string | null;
};

function getPriceRange(raw?: string | null): { min: number; max: number } | null {
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    if (cfg.productType === "multi_size_tier" && cfg.sizes?.length > 0) {
      const allRates: number[] = [];
      for (const sz of cfg.sizes) {
        for (const t of sz.tiers || []) {
          if (t.pricePerUnit) allRates.push(parseFloat(t.pricePerUnit));
        }
      }
      if (!allRates.length) return null;
      return { min: Math.min(...allRates), max: Math.max(...allRates) };
    }
    if (cfg.productType !== "custom_print") return null;
    if (cfg.pricingModel === "fixed_quantities" && cfg.fixedPrices?.length > 0) {
      const perUnit = cfg.fixedPrices.filter((f: any) => f.price && f.qty).map((f: any) => parseFloat(f.price) / f.qty);
      if (!perUnit.length) return null;
      return { min: Math.min(...perUnit), max: Math.max(...perUnit) };
    }
    if (cfg.pricingModel === "range_per_unit" && cfg.rangePrices?.length > 0) {
      const rates = cfg.rangePrices.filter((r: any) => r.pricePerUnit).map((r: any) => parseFloat(r.pricePerUnit));
      if (!rates.length) return null;
      return { min: Math.min(...rates), max: Math.max(...rates) };
    }
    return null;
  } catch { return null; }
}

function parseOffer(raw?: string | null): { minAmount: number; message: string } | null {
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    const message = String(cfg.offerMessage || "").trim();
    if (!cfg.offerEnabled || !message) return null;
    return { minAmount: Math.max(0, Number(cfg.offerMinAmount) || 0), message };
  } catch { return null; }
}

function parseProductType(raw?: string | null): "standard" | "custom_print" | "multi_size_tier" {
  if (!raw) return "standard";
  try { return JSON.parse(raw)?.productType || "standard"; }
  catch { return "standard"; }
}

export function ProductCard({ product }: { product: Product }) {
  const [modalOpen, setModalOpen] = useState(false);
  const productType = parseProductType(product.customConfig);
  const isCustom = productType === "custom_print";
  const isMultiSize = productType === "multi_size_tier";
  const priceRange = getPriceRange(product.customConfig);
  const offer = parseOffer(product.customConfig);

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <Link href={`/product/${slugify(product.name)}`}>
        <div className="glass-card rounded-2xl overflow-hidden flex flex-col group h-full cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-white/50 p-2 sm:p-4">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-20">
                <ShoppingCart size={48} />
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1">
              {product.featured && (
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md">
                  Featured
                </span>
              )}
              {isCustom && (
                <span className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[9px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md">
                  Custom
                </span>
              )}
              {isMultiSize && (
                <span className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-[9px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md">
                  Multi-Size
                </span>
              )}
              {offer && (
                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white text-[9px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md">
                  <Gift size={11} /> Special Offer
                </span>
              )}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Eye size={15} /> View Details
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 sm:p-5 flex flex-col flex-grow">
            <div className="mb-1 text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
              {product.category?.name || "Print"}
            </div>
            <h3 className="font-display font-bold text-sm sm:text-lg text-foreground mb-1 sm:mb-2 leading-tight">
              {product.name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 mb-2 sm:mb-4 flex-grow">
              {parseDescriptionLines(product.description).join(" • ")}
            </p>
            {offer && (
              <div className="mb-3 rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50 to-purple-50 px-2.5 py-2 text-[10px] sm:text-xs text-purple-900">
                <div className="flex items-start gap-1.5 font-semibold">
                  <Gift size={13} className="mt-0.5 shrink-0 text-pink-500" />
                  <span className="line-clamp-2">{offer.message}</span>
                </div>
                {offer.minAmount > 0 && <div className="mt-1 pl-[19px] text-[9px] sm:text-[10px] text-gray-500">On orders of Rs. {offer.minAmount.toLocaleString("en-IN")}+</div>}
              </div>
            )}

            <div className="flex items-end justify-between mt-auto pt-2 sm:pt-4 border-t border-gray-100">
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5">
                  {(isCustom || isMultiSize) ? "From" : "Price"}
                </div>
                {(isCustom || isMultiSize) && priceRange ? (
                  <div className="font-bold text-sm sm:text-lg text-purple-900 truncate">
                    Rs. {priceRange.min.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    <span className="text-[10px] sm:text-xs font-normal text-gray-400 ml-0.5">/unit</span>
                  </div>
                ) : (
                  <div className="font-bold text-sm sm:text-lg text-purple-900 truncate">
                    {formatPrice(product.price)}
                    <span className="text-[10px] sm:text-sm font-normal text-gray-500 ml-0.5">/ {product.priceType?.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleCartClick}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors shadow-sm shrink-0"
                aria-label="Add to cart"
              >
                <ShoppingCart size={15} className="sm:hidden" />
                <ShoppingCart size={18} className="hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      </Link>

      <AddToCartModal
        product={modalOpen ? product : null}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
