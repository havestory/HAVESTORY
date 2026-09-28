import { visibleBanks } from "@workspace/api-zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCreateOrder, useGetSettings } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, ChevronRight, ClipboardCheck, CreditCard, Loader2, MapPin, Package, ShieldCheck, Sparkles, Trash2, Truck, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useShopCart } from "@/lib/shop-cart";
import { parseProductConfig } from "@/lib/product-options";

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
  checkoutCourierEnabled: 1,
  checkoutCourierLabel: "Studio courier",
  checkoutCourierDescription: "Carefully packed and delivered to your door.",
  checkoutSlPostEnabled: 1,
  checkoutSlPostLabel: "Sri Lanka Post",
  checkoutSlPostDescription: "A considered island-wide delivery route.",
  checkoutPickupEnabled: 0,
  checkoutPickupLabel: "Studio pickup",
  checkoutPickupDescription: "Collect your order from the HAVESTORY studio.",
  checkoutPickupAddress: "Contact us for pickup details.",
  checkoutBankTransferEnabled: 1,
  checkoutDepositAmount: 500,
  checkoutDepositMessage: "A Rs. 500 deposit is required to confirm this order. Upload your payment proof after paying.",
  bankDetails: "[]",
};

function money(value: number) {
  return `Rs. ${Math.max(0, value).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

function settingEnabled(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true";
}

function cartLineUnitPrice(item: any) {
  const storedPrice = Number(item?.unitPrice);
  if (Number.isFinite(storedPrice) && storedPrice > 0) return storedPrice;
  const productPrice = Number(item?.product?.price);
  return Number.isFinite(productPrice) && productPrice > 0 ? productPrice : 0;
}

type ProductPaymentRule = {
  codEnabled: boolean;
  codMessage: string;
  fullPaymentOfferEnabled: boolean;
  fullPaymentOfferDiscount: number;
  fullPaymentOfferMessage: string;
};

function getProductPaymentRule(product: any): ProductPaymentRule {
  const config = parseProductConfig(product?.customConfig);
  return {
    codEnabled: config.codEnabled === true,
    codMessage: String(config.codMessage || "Pay cash when your order is delivered."),
    fullPaymentOfferEnabled: config.fullPaymentOfferEnabled === true,
    fullPaymentOfferDiscount: Math.min(100, Math.max(0, Number(config.fullPaymentOfferDiscount) || 0)),
    fullPaymentOfferMessage: String(config.fullPaymentOfferMessage || "Pay the full amount upfront and receive a special offer."),
  };
}

function uniqueMessages(rules: ProductPaymentRule[], field: "codMessage" | "fullPaymentOfferMessage", fallback: string) {
  const messages = [...new Set(rules.map(rule => rule[field].trim()).filter(Boolean))];
  return messages.join(" • ") || fallback;
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, count, clear, removeItem } = useShopCart();
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  // React state updates after the event; a ref closes the double-click gap.
  const submissionInFlight = useRef(false);

  const bankTransferEnabled = settingEnabled(settings.checkoutBankTransferEnabled, true);
  const depositAmount = Number(settings.checkoutDepositAmount) || 500;
  const productPaymentRules = useMemo(() => items.map(item => ({ item, rule: getProductPaymentRule(item.product) })), [items]);
  const calculatedSubtotal = items.reduce((sum, item) => sum + cartLineUnitPrice(item) * Math.max(1, Number(item.quantity) || 1), 0);
  const allProductRules = productPaymentRules.map(entry => entry.rule);
  const fullPaymentEnabled = items.length > 0 && productPaymentRules.every(entry => entry.rule.fullPaymentOfferEnabled);
  const codEnabled = items.length > 0 && productPaymentRules.every(entry => entry.rule.codEnabled);
  const fullPaymentOfferMessage = uniqueMessages(allProductRules.filter(rule => rule.fullPaymentOfferEnabled), "fullPaymentOfferMessage", "Pay the full amount upfront and receive a special offer.");
  const codMessage = uniqueMessages(allProductRules.filter(rule => rule.codEnabled), "codMessage", "Pay cash when your order is delivered.");
  const courierCharge = Math.max(0, Number(settings.courierCharge) || 450);
  const slPostCharge = Math.max(0, Number(settings.slPostCharge) || 250);
  const deliveryOptions = useMemo(() => [
    settingEnabled(settings.checkoutCourierEnabled, true) ? {
      value: "courier" as const,
      title: String(settings.checkoutCourierLabel || "Studio courier"),
      price: courierCharge,
      detail: String(settings.checkoutCourierDescription || "Carefully packed and delivered to your door."),
    } : null,
    settingEnabled(settings.checkoutSlPostEnabled, true) ? {
      value: "sl_post" as const,
      title: String(settings.checkoutSlPostLabel || "Sri Lanka Post"),
      price: slPostCharge,
      detail: String(settings.checkoutSlPostDescription || "A considered island-wide delivery route."),
    } : null,
    settingEnabled(settings.checkoutPickupEnabled, false) ? {
      value: "pickup" as const,
      title: String(settings.checkoutPickupLabel || "Studio pickup"),
      price: 0,
      detail: String(settings.checkoutPickupDescription || "Collect your order from the HAVESTORY studio."),
    } : null,
  ].filter(Boolean) as { value: ShippingMethod; title: string; price: number; detail: string }[], [
    courierCharge,
    settings.checkoutCourierDescription,
    settings.checkoutCourierEnabled,
    settings.checkoutCourierLabel,
    settings.checkoutPickupDescription,
    settings.checkoutPickupEnabled,
    settings.checkoutPickupLabel,
    settings.checkoutSlPostDescription,
    settings.checkoutSlPostEnabled,
    settings.checkoutSlPostLabel,
    slPostCharge,
  ]);
  const selectedDelivery = deliveryOptions.find(option => option.value === shippingMethod);
  const shippingCost = selectedDelivery?.price || 0;
  const shippingAddressRequired = shippingMethod !== "pickup";
  const couponDiscount = coupon?.valid ? Number(coupon.discount) || 0 : 0;
  const fullPaymentOffer = paymentMethod === "full_payment"
    ? productPaymentRules.reduce((sum, { item, rule }) => {
      if (!rule.fullPaymentOfferEnabled) return sum;
      const lineTotal = cartLineUnitPrice(item) * Math.max(1, Number(item.quantity) || 1);
      return sum + Math.min(lineTotal, lineTotal * rule.fullPaymentOfferDiscount / 100);
    }, 0)
    : 0;
  const total = Math.max(0, calculatedSubtotal + shippingCost - couponDiscount - fullPaymentOffer);
  const isQuote = items.some(item => {
    const hasNumericPrice = cartLineUnitPrice(item) > 0;
    return !hasNumericPrice && (item.product?.isCustomInquiry || item.product?.priceType === "custom_quote");
  });
  const bankDetails = visibleBanks(settings, "website");

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
        eyebrow: fullPaymentOffer > 0 ? `Save ${money(fullPaymentOffer)}` : "Fastest route",
        title: "Pay in full",
        description: fullPaymentOfferMessage,
      } : null,
      codEnabled ? {
        value: "cod" as const,
        icon: Wallet,
        eyebrow: "On delivery",
        title: "Cash on delivery",
        description: codMessage,
      } : null,
    ].filter(Boolean) as { value: PaymentMethod; icon: typeof Banknote; eyebrow: string; title: string; description: string }[], [
    bankTransferEnabled,
    codEnabled,
    codMessage,
    depositAmount,
    fullPaymentEnabled,
    fullPaymentOffer,
    fullPaymentOfferMessage,
    settings.checkoutDepositMessage,
  ]);

  useEffect(() => {
    if (!paymentOptions.some(option => option.value === paymentMethod)) {
      setPaymentMethod(paymentOptions[0]?.value || "bank_transfer");
    }
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    if (deliveryOptions.length > 0 && !deliveryOptions.some(option => option.value === shippingMethod)) {
      setShippingMethod(deliveryOptions[0].value);
    }
  }, [deliveryOptions, shippingMethod]);

  const handleRemoveItem = (key: string) => {
    removeItem(key);
    setCoupon(null);
  };

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orderTotal: calculatedSubtotal }),
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
    unitPrice: cartLineUnitPrice(item),
    imageUrl: item.imageUrl || undefined,
    selectedOptions: (item.selections || []).map(selection => ({ groupId: selection.groupId, choiceId: selection.choiceId })),
    selectedDetails: (item.selections || []).map(selection => ({
      groupId: selection.groupId,
      groupTitle: selection.groupTitle,
      choiceId: selection.choiceId,
      choiceName: selection.choiceName,
      price: Number(selection.price) || 0,
      imageUrl: selection.imageUrl || undefined,
    })),
    notes: item.product?.description || null,
  }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionInFlight.current || createOrder.isPending) return;
    setSubmitError(null);
    if (items.length === 0) {
      toast({ title: "Your cart is empty", description: "Add a piece from the collection before checking out.", variant: "destructive" });
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || (shippingAddressRequired && !customerAddress.trim())) {
      toast({ title: "A few details are missing", description: shippingAddressRequired ? "Please add your name, phone number and delivery address." : "Please add your name and phone number.", variant: "destructive" });
      return;
    }
    if (paymentOptions.length === 0) {
      toast({ title: "Payment is temporarily unavailable", description: "Please contact the studio before placing this order.", variant: "destructive" });
      return;
    }

    submissionInFlight.current = true;
    const itemSummary = items.map(item => `${item.quantity}× ${item.product?.name || "HAVESTORY item"}${item.selections?.length ? ` (${item.selections.map(selection => `${selection.groupTitle}: ${selection.choiceName}`).join(", ")})` : ""}`).join("\n");
    const notes = [
      orderNotes.trim() ? `Customer request: ${orderNotes.trim()}` : "",
      `Items:\n${itemSummary}`,
      paymentMethod === "bank_transfer" ? `Payment plan: ${money(depositAmount)} deposit via bank transfer` : "",
      paymentMethod === "full_payment" ? `Payment plan: full payment${fullPaymentOffer > 0 ? ` with ${money(fullPaymentOffer)} offer` : ""}` : "",
      paymentMethod === "cod" ? "Payment plan: cash on delivery" : "",
      selectedDelivery ? `Delivery: ${selectedDelivery.title}${selectedDelivery.price ? ` (${money(selectedDelivery.price)})` : " (free pickup)"}` : "",
    ].filter(Boolean).join("\n\n");

    createOrder.mutate({
      data: {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        customerAddress: customerAddress.trim() || (shippingMethod === "pickup" ? String(settings.checkoutPickupAddress || "Studio pickup") : ""),
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
        submissionInFlight.current = false;
        const orderId = String(order?.orderId || order?.id || "");
        window.sessionStorage.setItem('havestory-tracking-token', String(order?.trackingToken || ''));
        clear();
        setSubmittedOrderId(orderId);
        setSubmitError(null);
        toast({ title: "Order received", description: orderId ? `Your tracking number is ${orderId}.` : "Your order has been received by the studio.", className: "hs-order-received-toast" });
      },
      onError: (error: any) => {
        submissionInFlight.current = false;
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
        setSubmitError(message);
        toast({ title: "Order could not be submitted", description: message, variant: "destructive" });
      },
    });
  };

  if (submittedOrderId) {
    return (
      <div className="hv-page">
        <div className="hv-container hv-section-tight">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hv-empty mx-auto max-w-2xl"
          >
            <div className="hv-empty-icon"><CheckCircle2 /></div>
            <span className="hv-kicker hv-kicker-center mt-2">The next moment</span>
            <h1 className="hv-display hv-display-lg mt-4">Order received.</h1>
            <p className="hv-lede mx-auto mt-5 max-w-xl">
              Thank you, {customerName || "friend"}. The HAVESTORY studio has your request.
              Use your tracking page to review the order and upload payment proof when your transfer is complete.
            </p>
            <div className="hv-card mx-auto mt-8 max-w-sm p-5 text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#6f6259]">Tracking number</span>
              <strong className="hv-display hv-display-sm mt-2 block tracking-[0.06em]">{submittedOrderId || "Created successfully"}</strong>
            </div>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {submittedOrderId && (
                <Link href={`/track-order?id=${encodeURIComponent(submittedOrderId)}`} className="hv-btn hv-btn-bronze">
                  Track &amp; confirm payment <ArrowRight />
                </Link>
              )}
              <Link href="/store" className="hv-btn hv-btn-ghost">
                Continue browsing
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="hv-page">
        <div className="hv-container hv-section-tight">
          <div className="hv-empty mx-auto max-w-xl">
            <div className="hv-empty-icon"><Package /></div>
            <h1 className="hv-display hv-display-md mt-2">Your cart is empty.</h1>
            <p className="hv-lede mx-auto mt-4">Choose a frame or print to continue to checkout.</p>
            <Link href="/store" className="hv-btn hv-btn-solid mt-8">
              Browse frames &amp; prints <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="hv-page min-h-screen">
      <div className="hv-container hv-section-tight">
        <Link href="/store" className="hv-text-link">
          <ArrowLeft /> Back to collection
        </Link>

        <div className="mt-8 max-w-2xl">
          <span className="hv-kicker">The final edit / 01</span>
          <h1 className="hv-display hv-display-lg mt-4">
            Make it <em>yours.</em>
          </h1>
          <p className="hv-lede mt-5">
            A few considered details and your piece can begin its journey from our studio to your space.
          </p>
          <div className="mt-6 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6f6259]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#171310] text-white">1</span>
            <span>Details</span>
            <ChevronRight size={13} />
            <span className="grid h-7 w-7 place-items-center rounded-full border border-[rgba(23,19,16,0.2)]">2</span>
            <span>Payment</span>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.72fr)] lg:items-start">
          <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-6">
            {/* 01 — Customer details */}
            <section className="hv-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="hv-badge hv-badge-bronze">01 / Your details</span>
                  <h2 className="hv-display hv-display-sm mt-3">Where should we reach you?</h2>
                </div>
                <MapPin className="mt-1 shrink-0 text-[#b07c3a]" size={22} />
              </div>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <div className="hv-field">
                  <label htmlFor="co-name">Full name *</label>
                  <input id="co-name" required value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Your name" className="hv-input" />
                </div>
                <div className="hv-field">
                  <label htmlFor="co-phone">Phone number *</label>
                  <input id="co-phone" required value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="077 123 4567" className="hv-input" />
                </div>
                <div className="hv-field sm:col-span-2">
                  <label htmlFor="co-email">Email address <span className="normal-case tracking-normal text-[#a89a8c]">(for your receipt)</span></label>
                  <input id="co-email" type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} placeholder="hello@example.com" className="hv-input" />
                </div>
                <div className="hv-field sm:col-span-2">
                  <label htmlFor="co-address">
                    Delivery address {shippingAddressRequired ? "*" : <span className="normal-case tracking-normal text-[#a89a8c]">(optional for pickup)</span>}
                  </label>
                  <textarea
                    id="co-address"
                    required={shippingAddressRequired}
                    value={customerAddress}
                    onChange={event => setCustomerAddress(event.target.value)}
                    placeholder={shippingAddressRequired ? "House number, street, city" : String(settings.checkoutPickupAddress || "Optional — studio pickup")}
                    className="hv-textarea"
                  />
                </div>
                <div className="hv-field sm:col-span-2">
                  <label htmlFor="co-notes">A note for the studio <span className="normal-case tracking-normal text-[#a89a8c]">(optional)</span></label>
                  <textarea
                    id="co-notes"
                    value={orderNotes}
                    onChange={event => setOrderNotes(event.target.value)}
                    placeholder="Any special instructions, colour notes or timing requests?"
                    className="hv-textarea"
                    style={{ minHeight: 92 }}
                  />
                </div>
              </div>
            </section>

            {/* 02 — Delivery */}
            <section className="hv-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="hv-badge hv-badge-bronze">02 / Delivery</span>
                  <h2 className="hv-display hv-display-sm mt-3">Choose the handoff.</h2>
                </div>
                <Truck className="mt-1 shrink-0 text-[#b07c3a]" size={22} />
              </div>
              {deliveryOptions.length > 0 ? (
                <div className={`mt-7 grid gap-3 ${deliveryOptions.length === 1 ? "sm:grid-cols-1" : deliveryOptions.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                  {deliveryOptions.map(({ value, title, price, detail }) => {
                    const selected = shippingMethod === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setShippingMethod(value)}
                        aria-pressed={selected}
                        className="hv-card p-5 text-left"
                        style={selected ? { borderColor: "#b07c3a", boxShadow: "0 0 0 3px rgba(176,124,58,0.16)" } : undefined}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <strong className="text-[15px]">{title}</strong>
                          {selected && (
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#b07c3a] text-white">
                              <Check size={14} />
                            </span>
                          )}
                        </span>
                        <span className="mt-3 block text-sm font-extrabold">{price ? money(price) : "Free"}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-[#6f6259]">{detail}</span>
                        {value === "pickup" && selected && (
                          <span className="mt-3 block border-t border-[rgba(23,19,16,0.1)] pt-3 text-sm leading-relaxed text-[#6f6259]">
                            {String(settings.checkoutPickupAddress || "Contact us for pickup details.")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm leading-6 text-red-900">
                  No delivery method is currently enabled. Please contact HAVESTORY before placing an order.
                </div>
              )}
            </section>

            {/* 03 — Payment */}
            <section className="hv-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="hv-badge hv-badge-bronze">03 / Payment</span>
                  <h2 className="hv-display hv-display-sm mt-3">Choose your rhythm.</h2>
                </div>
                <CreditCard className="mt-1 shrink-0 text-[#b07c3a]" size={22} />
              </div>
              {paymentOptions.length > 0 ? (
                <div className="mt-7 grid gap-3">
                  {paymentOptions.map(option => {
                    const Icon = option.icon;
                    const selected = paymentMethod === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPaymentMethod(option.value)}
                        aria-pressed={selected}
                        className="hv-card w-full p-5 text-left"
                        style={selected ? { borderColor: "#b07c3a", boxShadow: "0 0 0 3px rgba(176,124,58,0.16)" } : undefined}
                      >
                        <div className="flex items-start gap-4">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f1e9da] text-[#2b241e]">
                            <Icon size={20} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <strong className="block text-base">{option.title}</strong>
                              <span className="hv-badge hv-badge-bronze">{option.eyebrow}</span>
                            </span>
                            <span className="mt-2 block text-xs leading-relaxed text-[#6f6259]">{option.description}</span>
                          </span>
                          <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-[#b07c3a] bg-[#b07c3a] text-white" : "border-[rgba(23,19,16,0.22)]"}`}>
                            {selected && <Check size={13} />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm leading-6 text-red-900">
                  No payment option is currently enabled. Please contact HAVESTORY before placing an order.
                </div>
              )}
              {paymentMethod === "bank_transfer" && bankDetails.length > 0 && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-[rgba(23,19,16,0.08)] bg-[#faf7f1] p-4 sm:grid-cols-2">
                  {bankDetails.slice(0, 4).map((bank: any, index: number) => (
                    <div key={`${bank.bankName || "bank"}-${index}`}>
                      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6f6259]">{bank.bankName || "Bank details"}</span>
                      <p className="mt-1 text-sm font-bold">{bank.accountHolder || bank.accountNumber || bank.branch || "Details will be shared after order creation"}</p>
                      {bank.accountNumber && (
                        <p className="mt-1 text-xs text-[#6f6259]">A/C {bank.accountNumber}{bank.branch ? ` · ${bank.branch}` : ""}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex items-start gap-3 px-1 text-xs leading-relaxed text-[#6f6259]">
              <ShieldCheck className="mt-0.5 shrink-0 text-[#b07c3a]" size={17} />
              <p>Your order is created securely. For bank transfer and full payment, you can upload a JPG, PNG or PDF payment proof from the tracking page after paying.</p>
            </div>

            {submitError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm leading-relaxed text-red-900">
                <strong className="block text-xs font-extrabold uppercase tracking-[0.12em]">Order not submitted</strong>
                <span className="mt-1 block">{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={createOrder.isPending || paymentOptions.length === 0}
              className="hv-btn hv-btn-solid w-full"
              style={{ minHeight: 58 }}
            >
              {createOrder.isPending ? (
                <><Loader2 className="animate-spin" /> Creating your order</>
              ) : (
                <>Place secure order <ArrowRight /></>
              )}
            </button>
          </motion.form>

          {/* Order summary */}
          <motion.aside initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="lg:sticky lg:top-28">
            <section className="hv-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="hv-kicker">Your edit / {String(count).padStart(2, "0")}</span>
                <Sparkles size={18} className="text-[#b07c3a]" />
              </div>

              <div className="mt-6">
                {items.map(item => (
                  <div key={item.key} className="flex gap-4 border-b border-[rgba(23,19,16,0.08)] pb-5 pt-5 first:pt-0">
                    <div className="hv-img-frame h-16 w-16 shrink-0">
                      <img src={item.imageUrl || item.product?.imageUrl || "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300&q=80"} alt="" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{item.product?.name || "HAVESTORY piece"}</p>
                      <p className="mt-1 text-xs text-[#6f6259]">{item.quantity} × {money(cartLineUnitPrice(item))}</p>
                      {item.selections?.length ? (
                        <p className="mt-1 line-clamp-1 text-[10px] uppercase tracking-[0.08em] text-[#a89a8c]">
                          {item.selections.map(selection => selection.choiceName).join(" · ")}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a5f28] transition hover:text-[#171310]"
                        onClick={() => handleRemoveItem(item.key)}
                        aria-label={`Remove ${item.product?.name || "item"} from checkout`}
                        title="Remove item"
                      >
                        <Trash2 size={13} /><span>Remove</span>
                      </button>
                    </div>
                    <span className="shrink-0 text-right text-sm font-extrabold">{money(cartLineUnitPrice(item) * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {isQuote && (
                <div className="mt-4 rounded-xl border border-[#b07c3a]/30 bg-[#b07c3a]/10 p-3 text-xs leading-relaxed">
                  <strong>Quote on request.</strong> This edit includes a custom piece without a stored price; the studio will confirm its final price with you.
                </div>
              )}

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#6f6259]">Subtotal</span>
                  <strong>{money(calculatedSubtotal)}</strong>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between gap-4 text-[#8a5f28]">
                    <span>Coupon</span>
                    <strong>− {money(couponDiscount)}</strong>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-[#6f6259]">Delivery</span>
                  <strong>{shippingCost ? money(shippingCost) : "Free"}</strong>
                </div>
                {fullPaymentOffer > 0 && (
                  <div className="flex justify-between gap-4 text-[#8a5f28]">
                    <span>Full payment offer</span>
                    <strong>− {money(fullPaymentOffer)}</strong>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-t border-[rgba(23,19,16,0.12)] pt-4 text-lg">
                  <span className="font-extrabold">Estimated total</span>
                  <strong>{isQuote ? "Quote" : money(total)}</strong>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <input
                  value={couponCode}
                  onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null); }}
                  onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(); } }}
                  placeholder="Coupon code"
                  className="hv-input"
                  aria-label="Coupon code"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={!couponCode.trim() || couponLoading}
                  className="hv-btn hv-btn-ghost hv-btn-sm shrink-0"
                >
                  {couponLoading ? "..." : "Apply"}
                </button>
              </div>
              {coupon?.valid && (
                <p className="mt-2 text-xs font-bold text-[#8a5f28]">{coupon.code} applied — you save {money(couponDiscount)}.</p>
              )}
            </section>

            <div className="mt-4 grid gap-3">
              <div className="hv-card flex items-center gap-3 p-4">
                <ClipboardCheck size={18} className="shrink-0 text-[#b07c3a]" />
                <span className="text-xs leading-relaxed">
                  <strong className="block">Human checked</strong>
                  <span className="text-[#6f6259]">Every order reviewed by the studio</span>
                </span>
              </div>
              <div className="hv-card flex items-center gap-3 p-4">
                <ShieldCheck size={18} className="shrink-0 text-[#b07c3a]" />
                <span className="text-xs leading-relaxed">
                  <strong className="block">Payment protected</strong>
                  <span className="text-[#6f6259]">Proofs are automatically removed after 14 days</span>
                </span>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </main>
  );
}
