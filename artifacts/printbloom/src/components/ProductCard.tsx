import { useState } from "react";
import { ArrowUpRight, Frame, Gift, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
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
    const config = JSON.parse(raw);
    if (config.productType === "multi_size_tier" && config.sizes?.length > 0) {
      const rates: number[] = [];
      for (const size of config.sizes) {
        for (const tier of size.tiers || []) {
          if (tier.pricePerUnit) rates.push(parseFloat(tier.pricePerUnit));
        }
      }
      return rates.length ? { min: Math.min(...rates), max: Math.max(...rates) } : null;
    }
    if (config.productType !== "custom_print") return null;
    if (config.pricingModel === "fixed_quantities" && config.fixedPrices?.length > 0) {
      const rates = config.fixedPrices
        .filter((item: any) => item.price && item.qty)
        .map((item: any) => parseFloat(item.price) / item.qty);
      return rates.length ? { min: Math.min(...rates), max: Math.max(...rates) } : null;
    }
    if (config.pricingModel === "range_per_unit" && config.rangePrices?.length > 0) {
      const rates = config.rangePrices
        .filter((item: any) => item.pricePerUnit)
        .map((item: any) => parseFloat(item.pricePerUnit));
      return rates.length ? { min: Math.min(...rates), max: Math.max(...rates) } : null;
    }
    return null;
  } catch {
    return null;
  }
}

function parseOffer(raw?: string | null): { minAmount: number; message: string } | null {
  if (!raw) return null;
  try {
    const config = JSON.parse(raw);
    const message = String(config.offerMessage || "").trim();
    if (!config.offerEnabled || !message) return null;
    return { minAmount: Math.max(0, Number(config.offerMinAmount) || 0), message };
  } catch {
    return null;
  }
}

function parseProductType(raw?: string | null): "standard" | "custom_print" | "multi_size_tier" {
  if (!raw) return "standard";
  try {
    return JSON.parse(raw)?.productType || "standard";
  } catch {
    return "standard";
  }
}

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const productType = parseProductType(product.customConfig);
  const isCustom = productType === "custom_print";
  const isMultiSize = productType === "multi_size_tier";
  const priceRange = getPriceRange(product.customConfig);
  const offer = parseOffer(product.customConfig);

  const handleCartClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setModalOpen(true);
  };

  const price = (isCustom || isMultiSize) && priceRange
    ? `Rs. ${priceRange.min.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
    : formatPrice(product.price);

  return (
    <>
      <Link href={`/product/${slugify(product.name)}`} className="hs-product-link">
        <article className="hs-product-card">
          <div className="hs-product-image">
            <span className="hs-product-index">{String(index + 1).padStart(2, "0")}</span>

            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" />
            ) : (
              <div className="hs-product-placeholder">
                <Frame size={52} strokeWidth={1.15} />
                <span>Image coming soon</span>
              </div>
            )}

            <div className="hs-product-badges">
              {product.featured && <span className="signal">Studio pick</span>}
              {isCustom && <span>Custom</span>}
              {isMultiSize && <span>Multi-size</span>}
            </div>

            <span className="hs-product-view">View piece <ArrowUpRight size={16} /></span>
          </div>

          <div className="hs-product-info">
            <div className="hs-product-meta">
              <span>{product.category?.name || "Frame collection"}</span>
              <span>{isCustom ? "Made to order" : isMultiSize ? "Select a size" : "Ready to customise"}</span>
            </div>

            <h2>{product.name}</h2>
            <p>{parseDescriptionLines(product.description).join(" · ")}</p>

            {offer && (
              <div className="hs-offer-note">
                <Gift size={15} />
                <div>
                  <strong>{offer.message}</strong>
                  {offer.minAmount > 0 && <small>Orders over Rs. {offer.minAmount.toLocaleString("en-IN")}</small>}
                </div>
              </div>
            )}

            <div className="hs-product-footer">
              <div>
                <small>{isCustom || isMultiSize ? "Starting from" : "Price"}</small>
                <strong>
                  {price}
                  {!(isCustom || isMultiSize) && <em>/ {product.priceType?.replace(/_/g, " ")}</em>}
                </strong>
              </div>
              <button onClick={handleCartClick} aria-label={`Add ${product.name} to cart`}>
                <ShoppingBag size={18} />
              </button>
            </div>
          </div>
        </article>
      </Link>

      <AddToCartModal product={modalOpen ? product : null} onClose={() => setModalOpen(false)} />
    </>
  );
}
