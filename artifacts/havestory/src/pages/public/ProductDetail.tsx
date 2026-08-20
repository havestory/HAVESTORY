import { useMemo, useState } from "react";
import { useGetProduct } from "@workspace/api-client-react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useShopCart, type CartSelection } from "@/lib/shop-cart";
import { formatMoney, money, parseProductConfig } from "@/lib/product-options";

export default function ProductDetail() {
  const [, params] = useRoute("/store/:id");
  const productId = Number(params?.id);
  const { data: rawProduct, isLoading, isError } = useGetProduct(Number.isFinite(productId) && productId > 0 ? productId : 0);
  const product: any = rawProduct;
  const config = useMemo(() => parseProductConfig(product?.customConfig), [product?.customConfig]);
  const optionGroups = (config.optionGroups || []).filter(group => group.title && group.choices?.length);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [, navigate] = useLocation();
  const { addItem } = useShopCart();
  const { toast } = useToast();

  const selections: CartSelection[] = optionGroups.map(group => {
    const choice = group.choices.find(item => item.id === selected[group.id]) || group.choices[0];
    return {
      groupId: group.id,
      groupTitle: group.title,
      choiceId: choice.id,
      choiceName: choice.name,
      price: money(choice.price),
      imageUrl: choice.imageUrl,
    };
  });
  const basePrice = money(product?.price);
  const optionPrice = selections.reduce((sum, item) => sum + item.price, 0);
  const unitPrice = basePrice + optionPrice;
  const minQuantity = Math.max(1, Number(config.minQuantity) || 1);
  const quantityStep = Math.max(1, Number(config.quantityStep) || 1);
  const gallery = product
    ? [...new Set([product.imageUrl, ...(Array.isArray(product.galleryImages) ? product.galleryImages : [])].filter(Boolean))] as string[]
    : [];
  const selectedImage = [...selections].reverse().find(item => item.imageUrl)?.imageUrl;
  const displayImage = activeImage || selectedImage || gallery[0] || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=86";
  const currentImageIndex = Math.max(0, gallery.indexOf(displayImage));
  const categoryName = product?.category?.name || "Frames & Prints";

  const choose = (groupId: string, choiceId: string, imageUrl?: string) => {
    setSelected(current => ({ ...current, [groupId]: choiceId }));
    if (imageUrl) setActiveImage(imageUrl);
  };

  const showImage = (direction: number) => {
    if (gallery.length < 2) return;
    const nextIndex = (currentImageIndex + direction + gallery.length) % gallery.length;
    setActiveImage(gallery[nextIndex]);
  };

  const putInCart = (buyNow = false) => {
    if (!product) return;
    addItem({ product, quantity: Math.max(minQuantity, quantity), selections, unitPrice, imageUrl: displayImage });
    toast({ title: "Added to cart", description: `${product.name} is ready for checkout.` });
    if (buyNow) navigate("/checkout");
  };

  if (isLoading) {
    return (
      <main className="hs-product-detail hs-product-detail-clean">
        <div className="hs-product-detail-grid">
          <Skeleton className="aspect-[1.08/1] rounded-[26px]" />
          <div className="space-y-5"><Skeleton className="h-5 w-36" /><Skeleton className="h-14 w-4/5" /><Skeleton className="h-28 w-full" /><Skeleton className="h-14 w-full" /></div>
        </div>
      </main>
    );
  }

  if (isError || !product || product.active === false) {
    return <div className="hs-product-missing"><span>Product unavailable</span><h1>This piece is not in the collection.</h1><p>It may have been unpublished or moved. Browse the current frames and prints instead.</p><Link href="/store">Back to the shop <ArrowRight /></Link></div>;
  }

  return (
    <main className="hs-product-detail hs-product-detail-clean">
      <div className="hs-product-breadcrumb"><Link href="/store"><ArrowLeft /> Frames &amp; Prints</Link><span>/</span><strong>{product.name}</strong></div>

      <div className="hs-product-detail-grid">
        <section className="hs-product-gallery" aria-label={`${product.name} images`}>
          <div className="hs-product-gallery-frame">
            <div className="hs-product-gallery-toolbar"><span>HAVESTORY / EDITION</span><span>{String(currentImageIndex + 1).padStart(2, "0")} / {String(Math.max(gallery.length, 1)).padStart(2, "0")}</span></div>
            <div className="hs-product-main-image">
              <img key={displayImage} src={displayImage} alt={product.name} />
              {gallery.length > 1 && (
                <>
                  <button type="button" className="hs-product-image-nav hs-product-image-nav-prev" onClick={() => showImage(-1)} aria-label="Previous product image"><ChevronLeft /></button>
                  <button type="button" className="hs-product-image-nav hs-product-image-nav-next" onClick={() => showImage(1)} aria-label="Next product image"><ChevronRight /></button>
                </>
              )}
            </div>
          </div>
          {gallery.length > 1 && <div className="hs-product-thumbnails">{gallery.map((image, index) => <button key={image} type="button" className={displayImage === image ? "is-active" : ""} onClick={() => setActiveImage(image)} aria-label={`View image ${index + 1}`}><img src={image} alt="" /></button>)}</div>}
        </section>

        <section className="hs-product-buybox">
          <div className="hs-product-meta-line"><span className="hs-product-kicker">{categoryName}</span><span className="hs-product-availability"><Check /> Cash on Delivery Available</span></div>
          <h1>{product.name}</h1>
          <p className="hs-product-description">{product.description || "A carefully finished photo piece, prepared in our studio and securely packed for delivery."}</p>

          {product.artworkGuideUrl && (
            <a className="hs-product-guide-link" href={product.artworkGuideUrl} target="_blank" rel="noreferrer">
              <span><span className="hs-product-guide-icon">↗</span><strong>{product.artworkGuideName || "Size & artwork guide"}</strong></span><ExternalLink />
            </a>
          )}

          <div className="hs-product-price-block"><span>Price</span><strong>{formatMoney(unitPrice)}</strong>{optionPrice > 0 && <small>Includes {formatMoney(optionPrice)} selected options</small>}</div>

          {optionGroups.map(group => (
            <fieldset className="hs-product-options" key={group.id}>
              <legend>{group.title}<span>{selections.find(item => item.groupId === group.id)?.choiceName}</span></legend>
              <div>{group.choices.map(choice => {
                const isSelected = (selected[group.id] || group.choices[0]?.id) === choice.id;
                return <button key={choice.id} type="button" className={isSelected ? "is-selected" : ""} onClick={() => choose(group.id, choice.id, choice.imageUrl)}>{choice.imageUrl && <img src={choice.imageUrl} alt="" />}<span>{choice.name}{money(choice.price) > 0 && <small>+ {formatMoney(choice.price)}</small>}</span>{isSelected && <Check />}</button>;
              })}</div>
            </fieldset>
          ))}

          <div className="hs-product-purchase-label">Quantity</div>
          <div className="hs-product-purchase-row">
            <div className="hs-product-quantity" aria-label="Quantity"><button type="button" onClick={() => setQuantity(value => Math.max(minQuantity, value - quantityStep))} aria-label="Decrease quantity"><Minus /></button><span>{Math.max(minQuantity, quantity)}</span><button type="button" onClick={() => setQuantity(value => Math.max(minQuantity, value) + quantityStep)} aria-label="Increase quantity"><Plus /></button></div>
            <Button type="button" onClick={() => putInCart(false)} className="hs-product-add"><ShoppingBag /> Add to cart</Button>
          </div>
          <Button type="button" onClick={() => putInCart(true)} className="hs-product-buy-now">Buy now <ArrowRight /></Button>

          {config.offerEnabled && config.offerMessage && <div className="hs-product-offer"><span>Special offer</span><p>{config.offerMessage}</p>{config.offerMinAmount ? <small>Valid from {formatMoney(config.offerMinAmount)}</small> : null}</div>}
          <div className="hs-product-assurance"><p><ShieldCheck /> Secure packaging</p><p><Truck /> Island-wide delivery</p>{config.productionTime && <p><Check /> Ready in {config.productionTime}</p>}</div>
        </section>
      </div>
    </main>
  );
}
