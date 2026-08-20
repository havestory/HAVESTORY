import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useShopCart } from "@/lib/shop-cart";
import { formatMoney } from "@/lib/product-options";

export function ShopCartDrawer({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { items, count, subtotal, updateQuantity, removeItem } = useShopCart();
  const [, navigate] = useLocation();

  const beginCheckout = () => {
    try { sessionStorage.setItem("hs-open-checkout", "1"); } catch { /* optional */ }
    window.dispatchEvent(new CustomEvent("hs:checkout-request"));
    setOpen(false);
    navigate("/store");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="hs-cart-drawer">
        <div className="hs-cart-drawer-head">
          <span>HAVESTORY SHOP</span>
          <SheetHeader><SheetTitle>Your cart.</SheetTitle></SheetHeader>
          <p>{count ? `${count} ${count === 1 ? "piece" : "pieces"} selected` : "Ready when you are"}</p>
        </div>

        <div className="hs-cart-drawer-body">
          {items.length === 0 ? (
            <div className="hs-cart-empty">
              <div><ShoppingBag /></div>
              <h3>Your cart is waiting.</h3>
              <p>Browse the collection, open a product and choose its frame, size and finish.</p>
              <Link href="/store" onClick={() => setOpen(false)}>Explore frames &amp; prints <ArrowRight /></Link>
            </div>
          ) : (
            <div className="hs-cart-items">
              {items.map(item => (
                <article key={item.key} className="hs-cart-item">
                  <Link href={`/store/${item.product.id}`} onClick={() => setOpen(false)} className="hs-cart-item-image"><img src={item.imageUrl || item.product.imageUrl} alt={item.product.name} /></Link>
                  <div className="hs-cart-item-copy">
                    <div><span>{item.product.category?.name || "HAVESTORY EDITION"}</span><button type="button" onClick={() => removeItem(item.key)} aria-label={`Remove ${item.product.name}`}><Trash2 /></button></div>
                    <Link href={`/store/${item.product.id}`} onClick={() => setOpen(false)}><h3>{item.product.name}</h3></Link>
                    {item.selections?.length > 0 && <p>{item.selections.map(selection => `${selection.groupTitle}: ${selection.choiceName}`).join(" · ")}</p>}
                    <div className="hs-cart-item-base">
                      <div className="hs-cart-quantity"><button type="button" onClick={() => updateQuantity(item.key, -1)}><Minus /></button><strong>{item.quantity}</strong><button type="button" onClick={() => updateQuantity(item.key, 1)}><Plus /></button></div>
                      <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="hs-cart-drawer-footer">
            <div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
            <p>Delivery and coupon discounts are calculated at checkout.</p>
            <button type="button" onClick={beginCheckout}>Continue to checkout <ArrowRight /></button>
            <Link href="/store" onClick={() => setOpen(false)}>Continue shopping</Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
