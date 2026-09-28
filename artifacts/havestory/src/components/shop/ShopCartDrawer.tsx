import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useShopCart } from "@/lib/shop-cart";
import { formatMoney } from "@/lib/product-options";

export function ShopCartDrawer({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { items, count, subtotal, updateQuantity, removeItem } = useShopCart();
  const [, navigate] = useLocation();

  const beginCheckout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="hv-page w-[min(26rem,calc(100vw-1rem))]! border-l border-[rgba(23,19,16,0.1)] p-0 flex flex-col gap-0">
        <div className="px-6 pt-6 pb-5 border-b border-[rgba(23,19,16,0.08)]">
          <span className="hv-kicker">Havestory shop</span>
          <SheetHeader className="text-left mt-2 p-0 space-y-0">
            <SheetTitle className="hv-display hv-display-sm">Your cart.</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-[#6f6259] mt-2">{count ? `${count} ${count === 1 ? "piece" : "pieces"} selected` : "Ready when you are"}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            <div className="hv-empty">
              <div className="hv-empty-icon"><ShoppingBag /></div>
              <h3 className="hv-display hv-display-sm">Your cart is waiting.</h3>
              <p className="hv-lede text-sm mt-3">Browse the collection, open a product and choose its frame, size and finish.</p>
              <Link href="/store" onClick={() => setOpen(false)} className="hv-btn hv-btn-solid hv-btn-sm mt-6">Explore frames &amp; prints <ArrowRight /></Link>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {items.map(item => (
                <article key={item.key} className="flex gap-4">
                  <Link href={`/store/${item.product.slug || item.product.id}`} onClick={() => setOpen(false)} className="hv-img-frame !rounded-2xl w-24 h-24 shrink-0">
                    <img src={item.imageUrl || item.product.imageUrl} alt={item.product.name} loading="lazy" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a89a8c]">{item.product.category?.name || "Havestory edition"}</span>
                      <button type="button" onClick={() => removeItem(item.key)} aria-label={`Remove ${item.product.name}`} className="text-[#a89a8c] hover:text-red-700 transition-colors shrink-0"><Trash2 size={15} /></button>
                    </div>
                    <Link href={`/store/${item.product.slug || item.product.id}`} onClick={() => setOpen(false)}>
                      <h3 className="font-semibold text-[15px] leading-snug mt-1 hover:text-[#8a5f28] transition-colors line-clamp-2">{item.product.name}</h3>
                    </Link>
                    {item.selections?.length > 0 && <p className="text-xs text-[#6f6259] mt-1 line-clamp-2">{item.selections.map(selection => `${selection.groupTitle}: ${selection.choiceName}`).join(" · ")}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1 border border-[rgba(23,19,16,0.12)] rounded-full px-1 py-1">
                        <button type="button" onClick={() => updateQuantity(item.key, -1)} aria-label="Decrease quantity" className="w-7 h-7 grid place-items-center rounded-full hover:bg-[rgba(23,19,16,0.06)] transition-colors"><Minus size={13} /></button>
                        <strong className="min-w-6 text-center text-sm">{item.quantity}</strong>
                        <button type="button" onClick={() => updateQuantity(item.key, 1)} aria-label="Increase quantity" className="w-7 h-7 grid place-items-center rounded-full hover:bg-[rgba(23,19,16,0.06)] transition-colors"><Plus size={13} /></button>
                      </div>
                      <strong className="hv-display text-[17px]">{formatMoney(item.unitPrice * item.quantity)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-[rgba(23,19,16,0.08)] bg-[#fffdf9]">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6f6259]">Subtotal</span>
              <strong className="hv-display hv-display-sm">{formatMoney(subtotal)}</strong>
            </div>
            <p className="text-xs text-[#a89a8c] mt-2">Delivery and coupon discounts are calculated at checkout.</p>
            <button type="button" onClick={beginCheckout} className="hv-btn hv-btn-bronze w-full mt-4">Continue to checkout <ArrowRight /></button>
            <div className="text-center mt-4">
              <Link href="/store" onClick={() => setOpen(false)} className="hv-text-link"><ArrowLeft /> Back to store</Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
