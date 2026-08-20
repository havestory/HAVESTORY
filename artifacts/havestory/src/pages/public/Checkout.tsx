import { useEffect, useMemo, useState } from "react";
import { useCreateOrder, useGetSettings } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, ChevronRight, ClipboardCheck, CreditCard, Loader2, MapPin, Package, ShieldCheck, Sparkles, Truck, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useShopCart } from "@/lib/shop-cart";

type ShippingMethod = "courier" | "sl_post" | "pickup";
type PaymentMethod = "bank_transfer" | "full_payment" | "cod";

type CouponResult = {
  valid: boolean;
  discount?: number;
  code?: string;
  message?: string;
};

const FALLBACK_SETTINGS = {
  courierCharge: 450,
  slPostCharge: 250,
  checkoutBankTransferEnabled: 1,
  checkoutDepositAmount: 500,
  checkoutDepositMessage: "A Rs. 500 deposit is required to confirm this order. Upload your payment proof after paying.",
  checkoutFullPaymentEnabled: 0,
  checkoutFullPaymentOffer: "Pay the full amount upfront and receive a special offer.",
  checkoutFullPaymentDiscount: 0,
  checkoutCodEnabled: 0,
  checkoutCodMessage: "Cash on delivery is currently unavailable.",
  bankDetails: "[]",
};

function money(value: number) {
  return `Rs. ${Math.max(0, value).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

function settingEnabled(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseBankDetails(value: unknown) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, count, subtotal, clear } = useShopCart();
  const { data: rawSettings } = useGetSettings();
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const settings: any = { ...FALLBACK_SETTINGS, ...(rawSettings as any || {}) };
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("courier");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState("");

  const bankTransferEnabled = settingEnabled(settings.checkoutBankTransferEnabled, true);
  const fullPaymentEnabled = settingEnabled(settings.checkoutFullPaymentEnabled, false);
  const codEnabled = settingEnabled(settings.checkoutCodEnabled, false);
  const depositAmount = Number(settings.checkoutDepositAmount) || 500;
  const fullPaymentDiscount = Math.max(0, Number(settings.checkoutFullPaymentDiscount) || 0);
  const courierCharge = Number(settings.courierCharge) || 450;
  const slPostCharge = Number(settings.slPostCharge) || 250;
  const shippingCost = shippingMethod === "courier" ? courierCharge : shippingMethod === "sl_post" ? slPostCharge : 0;
  const couponDiscount = coupon?.valid ? Number(coupon.discount) || 0 : 0;
  const fullPaymentOffer = paymentMethod === "full_payment" ? Math.min(fullPaymentDiscount, subtotal) : 0;
  const total = Math.max(0, subtotal + shippingCost - couponDiscount - fullPaymentOffer);
  const isQuote = items.some(item => item.product?.isCustomInquiry || item.product?.priceType === "custom_quote");
  const bankDetails = parseBankDetails(settings.bankDetails);

  const paymentOptions = useMemo(() => [
    bankTransferEnabled ? {
      value: "bank_transfer" as const,
      icon: Banknote,
      eyebrow: "Recommended",
      title: "Direct bank transfer",
      description: String(settings.checkoutDepositMessage || `A ${money(depositAmount)} deposit is required to confirm this order.`),
    } : null,
    fullPaymentEnabled ? {
      value: "full_payment" as const,
      icon: CreditCard,
      eyebrow: fullPaymentDiscount > 0 ? `Save ${money(fullPaymentDiscount)}` : "Fastest route",
      title: "Pay in full",
      description: String(settings.checkoutFullPaymentOffer || "Pay the full amount upfront and receive a special offer."),
    } : null,
    codEnabled ? {
      value: "cod" as const,
      icon: Wallet,
      eyebrow: "On delivery",
      title: "Cash on delivery",
      description: String(settings.checkoutCodMessage || "Pay when your order arrives."),
    } : null,
  ].filter(Boolean) as { value: PaymentMethod; icon: typeof Banknote; eyebrow: string; title: string; description: string }[], [
    bankTransferEnabled,
    codEnabled,
    depositAmount,
    fullPaymentDiscount,
    fullPaymentEnabled,
    settings.checkoutCodMessage,
    settings.checkoutDepositMessage,
    settings.checkoutFullPaymentOffer,
  ]);

  useEffect(() => {
    if (!paymentOptions.some(option => option.value === paymentMethod)) {
      setPaymentMethod(paymentOptions[0]?.value || "bank_transfer");
    }
  }, [paymentMethod, paymentOptions]);

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orderTotal: subtotal }),
      });
      const data = await response.json();
      setCoupon(data);
      if (!data.valid) {
        toast({ title: "Coupon not applied", description: data.message || "That code is not available.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not validate coupon", description: "Please try again or continue without a coupon.", variant: "destructive" });
    } finally {
      setCouponLoading(false);
    }
  };

  const orderItems = items.map(item => ({
    productId: typeof item.product?.id === "number" ? item.product.id : null,
    productName: item.product?.name || "HAVESTORY item",
    quantity: Math.max(1, item.quantity),
    unitPrice: Number(item.unitPrice) || 0,
    selectedOptions: (item.selections || []).map(selection => ({ groupId: selection.groupId, choiceId: selection.choiceId })),
    notes: [
      item.selections?.length ? item.selections.map(selection => `${selection.groupTitle}: ${selection.choiceName}`).join(", ") : "",
      item.product?.description || "",
    ].filter(Boolean).join(" — ") || null,
  }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) {
      toast({ title: "Your cart is empty", description: "Add a piece from the collection before checking out.", variant: "destructive" });
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      toast({ title: "A few details are missing", description: "Please add your name, phone number and delivery address.", variant: "destructive" });
      return;
    }
    if (paymentOptions.length === 0) {
      toast({ title: "Payment is temporarily unavailable", description: "Please contact the studio before placing this order.", variant: "destructive" });
      return;
    }

    const itemSummary = items.map(item => `${item.quantity}× ${item.product?.name || "HAVESTORY item"}${item.selections?.length ? ` (${item.selections.map(selection => `${selection.groupTitle}: ${selection.choiceName}`).join(", ")})` : ""}`).join("\n");
    const notes = [
      orderNotes.trim() ? `Customer request: ${orderNotes.trim()}` : "",
      `Items:\n${itemSummary}`,
      paymentMethod === "bank_transfer" ? `Payment plan: ${money(depositAmount)} deposit via bank transfer` : "",
      paymentMethod === "full_payment" ? `Payment plan: full payment${fullPaymentOffer > 0 ? ` with ${money(fullPaymentOffer)} offer` : ""}` : "",
      paymentMethod === "cod" ? "Payment plan: cash on delivery" : "",
    ].filter(Boolean).join("\n\n");

    createOrder.mutate({
      data: {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        customerAddress: customerAddress.trim(),
        orderType: "standard",
        items: orderItems,
        designLinks: [],
        attachments: [],
        notes,
        shippingMethod,
        paymentMethod,
        paymentAmount: paymentMethod === "bank_transfer" ? depositAmount : paymentMethod === "full_payment" ? total : 0,
        couponCode: coupon?.valid ? coupon.code : undefined,
      },
    }, {
      onSuccess: (order: any) => {
        const orderId = String(order?.orderId || order?.id || "");
        clear();
        setSubmittedOrderId(orderId);
        toast({ title: "Order received", description: orderId ? `Your tracking number is ${orderId}.` : "Your order has been received by the studio." });
      },
      onError: (error: any) => {
        let message = "Please check your details and try again.";
        const payload = error?.data ?? error?.response?.data;
        if (payload) {
          try {
            const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
            if (parsed?.error) message = parsed.error;
          } catch { /* keep the friendly fallback */ }
        } else if (error?.message && error.message !== "Error") {
          message = error.message;
        }
        toast({ title: "Order could not be submitted", description: message, variant: "destructive" });
      },
    });
  };

  if (submittedOrderId) {
    return (
      <main className="glass-gallery-main min-h-[75vh] overflow-hidden px-4 pb-24 pt-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center">
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-panel-strong w-full p-8 text-center sm:p-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(185,216,204,0.52)] text-[var(--glass-ink)]"><CheckCircle2 size={30} /></div>
            <span className="editorial-kicker mt-8 block">THE NEXT MOMENT</span>
            <h1 className="editorial-display mt-4 text-5xl leading-none text-[var(--glass-ink)] sm:text-7xl">Order received.</h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[rgba(7,26,43,0.68)] sm:text-base">Thank you, {customerName || "friend"}. The HAVESTORY studio has your request. Use your tracking page to review the order and upload payment proof when your transfer is complete.</p>
            <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-[rgba(7,26,43,0.12)] bg-white/45 p-5 text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[rgba(7,26,43,0.52)]">Tracking number</span>
              <strong className="mt-2 block text-xl tracking-[0.08em] text-[var(--glass-ink)]">{submittedOrderId || "Created successfully"}</strong>
            </div>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {submittedOrderId && <Link href={`/track-order?id=${encodeURIComponent(submittedOrderId)}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--glass-saffron)] px-6 text-xs font-black uppercase tracking-[0.15em] text-[var(--glass-ink)] shadow-[0_12px_28px_rgba(228,185,95,0.24)]">Track &amp; confirm payment <ArrowRight size={15} /></Link>}
              <Link href="/store" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(7,26,43,0.16)] bg-white/35 px-6 text-xs font-black uppercase tracking-[0.15em] text-[var(--glass-ink)]">Continue browsing</Link>
            </div>
          </motion.section>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="glass-gallery-main min-h-[70vh] px-4 pb-24 pt-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <section className="glass-panel-strong w-full p-8 text-center sm:p-12">
            <Package className="mx-auto text-[var(--glass-clay)]" size={34} />
            <span className="editorial-kicker mt-6 block">YOUR EDIT</span>
            <h1 className="editorial-display mt-3 text-5xl text-[var(--glass-ink)]">Nothing here yet.</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[rgba(7,26,43,0.64)]">Choose a frame or print from the collection first. Your selected piece will return here, ready for its final details.</p>
            <Link href="/store" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--glass-saffron)] px-6 text-xs font-black uppercase tracking-[0.15em] text-[var(--glass-ink)]">Return to collection <ArrowRight size={15} /></Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="glass-gallery-main min-h-screen overflow-hidden px-4 pb-24 pt-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[92rem]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(7,26,43,0.1)] pb-6">
          <Link href="/store" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[rgba(7,26,43,0.65)] transition hover:text-[var(--glass-clay)]"><ArrowLeft size={15} /> Back to collection</Link>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[rgba(7,26,43,0.52)]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--glass-ink)] text-white">1</span><span>Details</span><ChevronRight size={13} /><span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(7,26,43,0.2)]">2</span><span>Payment</span></div>
        </div>

        <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.72fr)] lg:items-start">
          <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-8 max-w-2xl">
              <span className="editorial-kicker">THE FINAL EDIT / 01</span>
              <h1 className="editorial-display mt-3 text-5xl leading-[0.92] text-[var(--glass-ink)] sm:text-7xl">Make it <em>yours.</em></h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-[rgba(7,26,43,0.65)] sm:text-base">A few considered details and your piece can begin its journey from our studio to your space.</p>
            </div>

            <section className="glass-panel p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4"><div><span className="glass-chip px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]">01 / Your details</span><h2 className="editorial-display mt-4 text-3xl text-[var(--glass-ink)]">Where should we reach you?</h2></div><MapPin className="mt-1 shrink-0 text-[var(--glass-clay)]" size={22} /></div>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="checkout-label">Full name *</span><Input required value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Your name" className="checkout-input" /></label>
                <label className="block"><span className="checkout-label">Phone number *</span><Input required value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="077 123 4567" className="checkout-input" /></label>
                <label className="block sm:col-span-2"><span className="checkout-label">Email address <small>(for your receipt)</small></span><Input type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} placeholder="hello@example.com" className="checkout-input" /></label>
                <label className="block sm:col-span-2"><span className="checkout-label">Delivery address *</span><textarea required value={customerAddress} onChange={event => setCustomerAddress(event.target.value)} placeholder="House number, street, city" className="checkout-textarea" /></label>
                <label className="block sm:col-span-2"><span className="checkout-label">A note for the studio <small>(optional)</small></span><textarea value={orderNotes} onChange={event => setOrderNotes(event.target.value)} placeholder="Any special instructions, colour notes or timing requests?" className="checkout-textarea min-h-[92px]" /></label>
              </div>
            </section>

            <section className="glass-panel p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4"><div><span className="glass-chip px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]">02 / Delivery</span><h2 className="editorial-display mt-4 text-3xl text-[var(--glass-ink)]">Choose the handoff.</h2></div><Truck className="mt-1 shrink-0 text-[var(--glass-clay)]" size={22} /></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {([
                  ["courier", "Studio courier", courierCharge, "Carefully packed to your door"],
                  ["sl_post", "Sri Lanka Post", slPostCharge, "A considered island-wide route"],
                  ["pickup", "Studio pickup", 0, "Collect from HAVESTORY"],
                ] as [ShippingMethod, string, number, string][]).map(([value, title, price, detail]) => <button key={value} type="button" onClick={() => setShippingMethod(value)} className={`checkout-choice text-left ${shippingMethod === value ? "is-selected" : ""}`}><span className="flex items-center justify-between gap-3"><strong>{title}</strong>{shippingMethod === value && <Check size={16} />}</span><span className="mt-3 block text-sm font-black">{price ? money(price) : "Free"}</span><small className="mt-1 block leading-relaxed">{detail}</small></button>)}
              </div>
            </section>

            <section className="glass-panel p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4"><div><span className="glass-chip px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]">03 / Payment</span><h2 className="editorial-display mt-4 text-3xl text-[var(--glass-ink)]">Choose your rhythm.</h2></div><CreditCard className="mt-1 shrink-0 text-[var(--glass-clay)]" size={22} /></div>
              {paymentOptions.length > 0 ? <div className="mt-7 grid gap-3">{paymentOptions.map(option => { const Icon = option.icon; return <button key={option.value} type="button" onClick={() => setPaymentMethod(option.value)} className={`checkout-payment text-left ${paymentMethod === option.value ? "is-selected" : ""}`}><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(185,216,204,0.42)] text-[var(--glass-ink)]"><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="block text-base">{option.title}</strong><small className="rounded-full bg-[rgba(228,185,95,0.28)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--glass-ink)]">{option.eyebrow}</small></span><span className="mt-2 block text-xs leading-relaxed text-[rgba(7,26,43,0.64)]">{option.description}</span></span><span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${paymentMethod === option.value ? "border-[var(--glass-clay)] bg-[var(--glass-clay)] text-white" : "border-[rgba(7,26,43,0.22)]"}`}>{paymentMethod === option.value && <Check size={13} />}</span></div></button>; })}</div> : <div className="mt-7 rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800">No payment option is currently enabled. Please contact HAVESTORY before placing an order.</div>}
              {paymentMethod === "bank_transfer" && bankDetails.length > 0 && <div className="mt-4 grid gap-3 rounded-2xl border border-[rgba(7,26,43,0.1)] bg-white/35 p-4 sm:grid-cols-2">{bankDetails.slice(0, 4).map((bank: any, index: number) => <div key={`${bank.bankName || "bank"}-${index}`}><span className="checkout-label">{bank.bankName || "Bank details"}</span><p className="mt-1 text-sm font-bold text-[var(--glass-ink)]">{bank.accountHolder || bank.accountNumber || bank.branch || "Details will be shared after order creation"}</p>{bank.accountNumber && <p className="mt-1 text-xs text-[rgba(7,26,43,0.62)]">A/C {bank.accountNumber}{bank.branch ? ` · ${bank.branch}` : ""}</p>}</div>)}</div>}
            </section>

            <div className="flex items-start gap-3 px-1 text-xs leading-relaxed text-[rgba(7,26,43,0.6)]"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--glass-clay)]" size={17} /><p>Your order is created securely. For bank transfer and full payment, you can upload a JPG, PNG or PDF payment proof from the tracking page after paying.</p></div>
            <Button type="submit" disabled={createOrder.isPending || paymentOptions.length === 0} className="group h-14 w-full rounded-full bg-[var(--glass-ink)] px-7 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_36px_rgba(7,26,43,0.2)] hover:bg-[var(--glass-clay)]">{createOrder.isPending ? <><Loader2 className="mr-2 animate-spin" size={16} /> Creating your order</> : <>Place secure order <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" size={16} /></>}</Button>
          </motion.form>

          <motion.aside initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="lg:sticky lg:top-8">
            <section className="glass-frame overflow-hidden bg-[rgba(185,216,204,0.34)] p-2">
              <div className="glass-panel-strong overflow-hidden rounded-[1.2rem] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3"><span className="editorial-kicker">YOUR EDIT / {String(count).padStart(2, "0")}</span><Sparkles size={18} className="text-[var(--glass-saffron)]" /></div>
                <div className="mt-6 space-y-4">{items.map(item => <div key={item.key} className="flex gap-3 border-b border-[rgba(7,26,43,0.1)] pb-4"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[rgba(185,216,204,0.45)]"><img src={item.imageUrl || item.product?.imageUrl || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300&q=80"} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[var(--glass-ink)]">{item.product?.name || "HAVESTORY piece"}</p><p className="mt-1 text-xs text-[rgba(7,26,43,0.58)]">{item.quantity} × {money(Number(item.unitPrice) || 0)}</p>{item.selections?.length ? <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-[0.08em] text-[rgba(7,26,43,0.5)]">{item.selections.map(selection => selection.choiceName).join(" · ")}</p> : null}</div><span className="text-sm font-black text-[var(--glass-ink)]">{money((Number(item.unitPrice) || 0) * item.quantity)}</span></div>)}</div>
                {isQuote && <div className="mt-4 rounded-xl bg-[rgba(228,185,95,0.22)] p-3 text-xs leading-relaxed text-[var(--glass-ink)]"><strong>Quote on request.</strong> This edit includes a custom piece; the studio will confirm its final price with you.</div>}
                <div className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-[rgba(7,26,43,0.6)]">Subtotal</span><strong>{money(subtotal)}</strong></div>{couponDiscount > 0 && <div className="flex justify-between gap-4 text-[var(--glass-clay)]"><span>Coupon</span><strong>− {money(couponDiscount)}</strong></div>}<div className="flex justify-between gap-4"><span className="text-[rgba(7,26,43,0.6)]">Delivery</span><strong>{shippingCost ? money(shippingCost) : "Free"}</strong></div>{fullPaymentOffer > 0 && <div className="flex justify-between gap-4 text-[var(--glass-clay)]"><span>Full payment offer</span><strong>− {money(fullPaymentOffer)}</strong></div>}<div className="flex justify-between gap-4 border-t border-[rgba(7,26,43,0.14)] pt-4 text-lg"><span className="font-black text-[var(--glass-ink)]">Estimated total</span><strong className="text-[var(--glass-ink)]">{isQuote ? "Quote" : money(total)}</strong></div></div>
                <div className="mt-6 flex gap-2"><Input value={couponCode} onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(); } }} placeholder="Coupon code" className="checkout-input h-10" /><Button type="button" onClick={applyCoupon} disabled={!couponCode.trim() || couponLoading} variant="outline" className="h-10 rounded-xl border-[rgba(7,26,43,0.16)] bg-white/35 px-4 text-[10px] font-black uppercase tracking-[0.12em]">{couponLoading ? "..." : "Apply"}</Button></div>{coupon?.valid && <p className="mt-2 text-xs font-bold text-[var(--glass-clay)]">{coupon.code} applied — you save {money(couponDiscount)}.</p>}
              </div>
            </section>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><div className="glass-chip px-4 py-3 text-xs"><ClipboardCheck size={15} className="text-[var(--glass-clay)]" /><span><strong className="block text-[var(--glass-ink)]">Human checked</strong><small>Every order reviewed by the studio</small></span></div><div className="glass-chip px-4 py-3 text-xs"><ShieldCheck size={15} className="text-[var(--glass-clay)]" /><span><strong className="block text-[var(--glass-ink)]">Payment protected</strong><small>Proofs are automatically removed after 14 days</small></span></div></div>
          </motion.aside>
        </div>
      </div>
    </main>
  );
}
