import { useEffect, useMemo, useState } from "react";
import { useGetProduct } from "@workspace/api-client-react";
import { Link, useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useShopCart, type CartSelection } from "@/lib/shop-cart";
import { formatMoney, money, parseProductConfig, type ProductChoice, type ProductOptionGroup } from "@/lib/product-options";
import { Reveal } from "@/components/public/Reveal";

function isFrameColourGroup(group: { title: string }) {
  return /\bframes?\b|frame\s*(colour|color)|\b(colour|color)\b/i.test(group.title);
}

function isAddOnGroup(group: { title: string }) {
  return /\b(add[\s-]?ons?|extras?)\b/i.test(group.title);
}

export default function ProductDetail() {
  const [, params] = useRoute("/store/:id");
  const productIdentifier = String(params?.id || "");
  const { data: rawProduct, isLoading, isError } = useGetProduct(productIdentifier);
  const product: any = rawProduct;
  const config = useMemo(() => parseProductConfig(product?.customConfig), [product?.customConfig]);
  const optionGroups = useMemo(() => (config.optionGroups || []).filter(group => group.title && group.choices?.length), [config.optionGroups]);
  const frameColourGroups = useMemo(() => optionGroups.filter(isFrameColourGroup), [optionGroups]);
  const addOnGroups = useMemo(() => optionGroups.filter(group => !isFrameColourGroup(group) && isAddOnGroup(group)), [optionGroups]);
  const regularOptionGroups = useMemo(() => optionGroups.filter(group => !isFrameColourGroup(group) && !isAddOnGroup(group)), [optionGroups]);
  const sizeOptions = useMemo(() => (config.sizes || []).filter(size => size.name || size.tiers?.length), [config.sizes]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [activeImage, setActiveImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [, navigate] = useLocation();
  const { addItem } = useShopCart();
  const { toast } = useToast();

  useEffect(() => {
    if (sizeOptions.length > 0 && !sizeOptions.some(size => size.id === selectedSizeId)) {
      setSelectedSizeId(sizeOptions[0].id);
    }
  }, [selectedSizeId, sizeOptions]);

  const activeSize = sizeOptions.find(size => size.id === selectedSizeId) || sizeOptions[0];
  const basePrice = money(product?.price);
  const getSizeUnitPrice = (size: typeof activeSize, qty: number) => {
    if (!size) return basePrice;
    const tiers = size.tiers || [];
    const tier = tiers.find(item => qty >= Number(item.from || 0) && qty <= Number(item.to || Number.MAX_SAFE_INTEGER)) || tiers[tiers.length - 1];
    const tierPrice = money(tier?.pricePerUnit);
    return tierPrice > 0 ? tierPrice : basePrice;
  };
  const minQuantity = Math.max(1, Number(activeSize?.minQty) || Number(config.minQuantity) || 1);
  const quantityStep = Math.max(1, Number(activeSize?.packSize) || Number(config.quantityStep) || 1);
  const sizeUnitPrice = getSizeUnitPrice(activeSize, Math.max(minQuantity, quantity));
  const getChoicePrice = (choice: ProductChoice) => {
    const sizeOverride = activeSize?.id
      ? choice.sizePrices?.find(override => String(override.sizeId) === String(activeSize.id))
      : undefined;
    return money(sizeOverride ? sizeOverride.price : choice.price);
  };
  const sizeSelection: CartSelection[] = activeSize ? [{
    groupId: "product-size",
    groupTitle: config.sizeLabel || "Size",
    choiceId: activeSize.id,
    choiceName: activeSize.name,
    price: 0,
    imageUrl: activeSize.imageUrls?.[0] || activeSize.imageUrl,
    imageUrls: activeSize.imageUrls,
  }] : [];
  const optionSelections: CartSelection[] = optionGroups.flatMap(group => {
    const choiceId = selected[group.id] || (isFrameColourGroup(group) ? "" : group.choices[0]?.id);
    const choice = group.choices.find(item => item.id === choiceId);
    return choice ? [{
      groupId: group.id,
      groupTitle: group.title,
      choiceId: choice.id,
      choiceName: choice.name,
      price: getChoicePrice(choice),
      imageUrl: choice.imageUrls?.[0] || choice.imageUrl,
      imageUrls: choice.imageUrls,
    }] : [];
  });
  const selections = [...sizeSelection, ...optionSelections];
  const hasRequiredSelections = (sizeOptions.length === 0 || Boolean(activeSize?.id)) && frameColourGroups.every(group => Boolean(selected[group.id]));
  const optionPrice = optionSelections.reduce((sum, item) => sum + item.price, 0);
  const unitPrice = sizeOptions.length > 0 ? sizeUnitPrice + optionPrice : basePrice + optionPrice;
  const baseGallery = product
    ? [...new Set([product.imageUrl, ...(Array.isArray(product.galleryImages) ? product.galleryImages : [])].filter(Boolean))] as string[]
    : [];
  const selectedVariantImages = [...selections].reverse().flatMap(item => [item.imageUrl, ...(item.imageUrls || [])].filter((image): image is string => Boolean(image)));
  const gallery = [...new Set([...baseGallery, ...selectedVariantImages])];
  const selectedImage = selectedVariantImages[0];
  const displayImage = activeImage || selectedImage || gallery[0] || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=86";
  const currentImageIndex = Math.max(0, gallery.indexOf(displayImage));
  const categoryName = product?.category?.name || "Frames & Prints";

  const choose = (groupId: string, choiceId: string, imageUrl?: string, imageUrls: string[] = []) => {
    setSelected(current => ({ ...current, [groupId]: choiceId }));
    setActiveImage(imageUrls[0] || imageUrl || "");
  };

  const chooseSize = (size: NonNullable<typeof activeSize>) => {
    setSelectedSizeId(size.id);
    setQuantity(current => Math.max(current, Number(size.minQty) || 1));
    setActiveImage(size.imageUrls?.[0] || size.imageUrl || "");
  };

  const showImage = (direction: number) => {
    if (gallery.length < 2) return;
    const nextIndex = (currentImageIndex + direction + gallery.length) % gallery.length;
    setActiveImage(gallery[nextIndex]);
  };

  const putInCart = (buyNow = false) => {
    if (!product) return;
    if (!hasRequiredSelections) {
      toast({ title: "Choose your frame details", description: "Select a size and frame colour before adding this item." });
      return;
    }
    addItem({ product, quantity: Math.max(minQuantity, quantity), selections, unitPrice, imageUrl: displayImage });
    toast({ title: "Added to cart", description: `${product.name} is ready for checkout.` });
    if (buyNow) navigate("/checkout");
  };

  /** Chip-row renderer for an option group; preserves default-selection + preview behaviour. */
  const renderChipGroup = (group: ProductOptionGroup, subtitle: string) => {
    const isColour = isFrameColourGroup(group);
    const currentId = selected[group.id] || (isColour ? "" : group.choices[0]?.id || "");
    const preview = selections.find(item => item.groupId === group.id);
    return (
      <fieldset className="mt-8" key={group.id}>
        <legend className="mb-1 flex w-full items-baseline justify-between gap-4">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#171310]">{group.title}</span>
          <span className="text-right text-sm text-[#6f6259]">{preview?.choiceName || subtitle}</span>
        </legend>
        <div className="hv-chip-row mt-3">
          {group.choices.map(choice => {
            const isSelected = currentId === choice.id;
            const choicePrice = getChoicePrice(choice);
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => choose(group.id, choice.id, choice.imageUrl, choice.imageUrls)}
                aria-pressed={isSelected}
                className={`hv-chip ${isSelected ? "is-active" : ""}`}
              >
                {isSelected && <Check size={13} />}
                {choice.name}{choicePrice > 0 ? ` + ${formatMoney(choicePrice)}` : ""}
              </button>
            );
          })}
        </div>
        {preview?.imageUrl && (
          <div className="mt-4 flex items-center gap-3">
            <span className="hv-img-frame block h-14 w-14 shrink-0" style={{ borderRadius: 12 }}>
              <img src={preview.imageUrl} alt="" />
            </span>
            <span className="text-sm text-[#6f6259]">Preview for {preview.choiceName}</span>
          </div>
        )}
      </fieldset>
    );
  };

  if (isLoading) {
    return (
      <main className="hv-page min-h-screen">
        <div className="hv-container pb-24 pt-32">
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="hv-skeleton aspect-square" />
            <div className="space-y-5">
              <div className="hv-skeleton h-5 w-36" />
              <div className="hv-skeleton h-14 w-4/5" />
              <div className="hv-skeleton h-28 w-full" />
              <div className="hv-skeleton h-14 w-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isError || !product || product.active === false) {
    return (
      <main className="hv-page min-h-screen">
        <div className="hv-container pb-24 pt-40">
          <div className="hv-empty mx-auto max-w-2xl">
            <div className="hv-empty-icon"><ShoppingBag /></div>
            <span className="hv-kicker hv-kicker-center">Product unavailable</span>
            <h1 className="hv-display hv-display-md mt-4">This piece is not in the collection.</h1>
            <p className="hv-lede mx-auto mt-4">It may have been unpublished or moved. Browse the current frames and prints instead.</p>
            <Link href="/store" className="hv-btn hv-btn-solid mt-8">Back to the shop <ArrowRight /></Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="hv-page min-h-screen">
      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <div className="hv-container pb-8 pt-28">
        <Reveal>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3">
            <Link href="/store" className="hv-text-link"><ArrowLeft /> Frames &amp; Prints</Link>
            <span aria-hidden="true" className="text-[#a89a8c]">/</span>
            <strong className="max-w-[60vw] truncate text-sm font-semibold text-[#6f6259]">{product.name}</strong>
          </nav>
        </Reveal>
      </div>

      <div className="hv-container pb-32 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ── Gallery ─────────────────────────────────────── */}
          <Reveal>
            <section aria-label={`${product.name} images`}>
              <div className="hv-img-frame hv-frame-double aspect-square">
                <img key={displayImage} src={displayImage} alt={product.name} />
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => showImage(-1)}
                      aria-label="Previous product image"
                      className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#171310] shadow-lg transition hover:bg-white"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => showImage(1)}
                      aria-label="Next product image"
                      className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#171310] shadow-lg transition hover:bg-white"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <span className="hv-badge hv-badge-ink absolute bottom-4 right-4">
                      {String(currentImageIndex + 1).padStart(2, "0")} / {String(Math.max(gallery.length, 1)).padStart(2, "0")}
                    </span>
                  </>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {gallery.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setActiveImage(image)}
                      aria-label={`View image ${index + 1}`}
                      className={`hv-img-frame aspect-square ${displayImage === image ? "" : "opacity-60 transition hover:opacity-100"}`}
                      style={displayImage === image ? { outline: "2px solid var(--hv-bronze)", outlineOffset: 3 } : undefined}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </Reveal>

          {/* ── Buybox ──────────────────────────────────────── */}
          <Reveal delay={0.1}>
            <section>
              <div className="flex flex-wrap items-center gap-3">
                <span className="hv-kicker">{categoryName}</span>
                {config.codEnabled === true && (
                  <span className="hv-badge hv-badge-bronze"><Check size={12} /> Cash on Delivery Available</span>
                )}
              </div>
              <h1 className="hv-display hv-display-md mt-4">{product.name}</h1>
              <p className="hv-lede mt-4">
                {product.description || "A carefully finished photo piece, prepared in our studio and securely packed for delivery."}
              </p>

              {product.artworkGuideUrl && (
                <a className="hv-text-link mt-5" href={product.artworkGuideUrl} target="_blank" rel="noreferrer">
                  <ExternalLink /> {product.artworkGuideName || "Size & artwork guide"}
                </a>
              )}

              {/* Price */}
              <div className="mt-8 border-y py-6" style={{ borderColor: "var(--hv-line-soft)" }}>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a89a8c]">
                  {activeSize ? `${config.sizeLabel || "Selected size"} price` : "Price"}
                </p>
                <p className="hv-display hv-display-md mt-2">{formatMoney(unitPrice)}</p>
                {activeSize && (
                  <p className="mt-2 text-sm text-[#6f6259]">
                    {formatMoney(sizeUnitPrice)} per {activeSize.unitLabel || "unit"}
                    {optionPrice > 0 ? ` + ${formatMoney(optionPrice)} selected options` : ""}
                  </p>
                )}
                {!activeSize && optionPrice > 0 && (
                  <p className="mt-2 text-sm text-[#6f6259]">Includes {formatMoney(optionPrice)} selected options</p>
                )}
              </div>

              {/* Sizes */}
              {sizeOptions.length > 0 && (
                <fieldset className="mt-8">
                  <legend className="mb-1 flex w-full items-baseline justify-between gap-4">
                    <span className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#171310]">
                      {config.sizeLabel || "Choose a size"}
                    </span>
                    <span className="text-right text-sm text-[#6f6259]">{activeSize?.name || "Select one"}</span>
                  </legend>
                  <div className="hv-chip-row mt-3">
                    {sizeOptions.map(size => (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => chooseSize(size)}
                        aria-pressed={selectedSizeId === size.id}
                        className={`hv-chip ${selectedSizeId === size.id ? "is-active" : ""}`}
                      >
                        {selectedSizeId === size.id && <Check size={13} />}
                        {size.name || "Unnamed size"} · {formatMoney(getSizeUnitPrice(size, Math.max(minQuantity, quantity)))}
                      </button>
                    ))}
                  </div>
                  {(activeSize?.imageUrls?.[0] || activeSize?.imageUrl) && (
                    <div className="mt-4 flex items-center gap-3">
                      <span className="hv-img-frame block h-14 w-14 shrink-0" style={{ borderRadius: 12 }}>
                        <img src={activeSize.imageUrls?.[0] || activeSize.imageUrl} alt="" />
                      </span>
                      <span className="text-sm text-[#6f6259]">Preview for {activeSize.name}</span>
                    </div>
                  )}
                </fieldset>
              )}

              {/* Frame colours (required) */}
              {frameColourGroups.map(group => renderChipGroup(group, "Select one"))}
              {/* Add-ons (optional) */}
              {addOnGroups.map(group => renderChipGroup(group, "Optional"))}
              {/* Regular options (default: first choice) */}
              {regularOptionGroups.map(group => renderChipGroup(group, group.choices[0]?.name || ""))}

              {/* Quantity + purchase */}
              <div className="mt-10">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#171310]">Quantity</p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex items-center rounded-full border" style={{ borderColor: "var(--hv-line)" }} aria-label="Quantity">
                    <button
                      type="button"
                      onClick={() => setQuantity(value => Math.max(minQuantity, value - quantityStep))}
                      aria-label="Decrease quantity"
                      className="grid h-12 w-12 place-items-center rounded-full text-[#171310] transition hover:bg-black/5"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="min-w-10 text-center text-[15px] font-bold tabular-nums text-[#171310]">
                      {Math.max(minQuantity, quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(value => Math.max(minQuantity, value) + quantityStep)}
                      aria-label="Increase quantity"
                      className="grid h-12 w-12 place-items-center rounded-full text-[#171310] transition hover:bg-black/5"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => putInCart(false)}
                    disabled={!hasRequiredSelections}
                    className="hv-btn hv-btn-bronze flex-1"
                  >
                    <ShoppingBag /> Add to cart
                  </motion.button>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => putInCart(true)}
                  disabled={!hasRequiredSelections}
                  className="hv-btn hv-btn-solid mt-3 w-full"
                >
                  Buy now <ArrowRight />
                </motion.button>
                {!hasRequiredSelections && (
                  <p className="mt-3 text-sm font-medium text-[#8a5f28]">Select a size and frame colour to continue.</p>
                )}
              </div>

              {/* Offer */}
              {config.offerEnabled && config.offerMessage && (
                <div className="hv-card mt-8 p-6" style={{ borderLeft: "3px solid var(--hv-bronze)" }}>
                  <span className="hv-badge hv-badge-bronze">Special offer</span>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#2b241e]">{config.offerMessage}</p>
                  {config.offerMinAmount ? (
                    <p className="mt-2 text-sm text-[#6f6259]">Valid from {formatMoney(config.offerMinAmount)}</p>
                  ) : null}
                </div>
              )}

              {/* Trust badges */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                <span className="hv-badge hv-badge-ghost"><ShieldCheck size={13} /> Secure packaging</span>
                <span className="hv-badge hv-badge-ghost"><Truck size={13} /> Island-wide delivery</span>
                {config.productionTime && (
                  <span className="hv-badge hv-badge-ghost"><Check size={13} /> Ready in {config.productionTime}</span>
                )}
              </div>

              {/* Accordion-ish details */}
              <div
                className="mt-10"
                style={{ borderTop: "1px solid var(--hv-line-soft)", borderBottom: "1px solid var(--hv-line-soft)" }}
              >
                <details className="group py-5" style={{ borderBottom: "1px solid var(--hv-line-soft)" }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#171310] [&::-webkit-details-marker]:hidden">
                    About this piece
                    <Plus size={15} className="shrink-0 text-[#b07c3a] transition-transform duration-300 group-open:rotate-45" />
                  </summary>
                  <p className="mt-4 text-[15px] leading-relaxed text-[#6f6259]">
                    {product.description || "A carefully finished photo piece, prepared in our studio and securely packed for delivery."}
                  </p>
                </details>
                <details className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#171310] [&::-webkit-details-marker]:hidden">
                    Delivery &amp; payment
                    <Plus size={15} className="shrink-0 text-[#b07c3a] transition-transform duration-300 group-open:rotate-45" />
                  </summary>
                  <div className="mt-4 space-y-2 text-[15px] leading-relaxed text-[#6f6259]">
                    <p>Each piece is finished and packed in our studio, then delivered island-wide.</p>
                    {config.productionTime && <p>Production time: {config.productionTime}.</p>}
                    {config.codEnabled === true && <p>Cash on delivery is available for this piece.</p>}
                    {config.offerEnabled && config.offerMessage && <p>{config.offerMessage}</p>}
                  </div>
                </details>
              </div>
            </section>
          </Reveal>
        </div>
      </div>

      {/* ── Mobile quick order ──────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-[#faf7f1]/95 p-4 backdrop-blur lg:hidden"
        style={{ borderColor: "var(--hv-line-soft)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#a89a8c]">Selected price</p>
            <p className="hv-display text-xl">{formatMoney(unitPrice)}</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => putInCart(true)}
            disabled={!hasRequiredSelections}
            className="hv-btn hv-btn-bronze hv-btn-sm"
          >
            {hasRequiredSelections ? "Order now" : "Choose options"} <ArrowRight />
          </motion.button>
        </div>
      </div>
    </main>
  );
}
