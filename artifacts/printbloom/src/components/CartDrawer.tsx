import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Plus, Minus, Trash2, ChevronRight, CheckCircle, Truck, Package, AlertCircle, ExternalLink, Building2, QrCode, Tag, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { useCart } from "@/store/use-cart";
import { useCreateOrder, useGetSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_FORM = { name: "", phone: "", email: "", address: "", notes: "" };

export function CartDrawer({ open, onClose }: Props) {
  const { items, removeItem, updateQuantity, clearCart, getTotals } = useCart();
  const { data: settings } = useGetSettings();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [form, setForm] = useState(EMPTY_FORM);
  const [shippingMethod, setShippingMethod] = useState<"courier" | "sl_post" | "">("");
  const [shippingError, setShippingError] = useState(false);
  const [orderId, setOrderId] = useState("");
  const queryClient = useQueryClient();

  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "qr_payment" | "">("");
  const [paymentMethodError, setPaymentMethodError] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);

  const [couponInput, setCouponInput] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: number; code: string; discount: number; type: string; value: number } | null>(null);

  const courierCharge = parseFloat((settings as any)?.courierCharge ?? "450") || 450;
  const slPostCharge = parseFloat((settings as any)?.slPostCharge ?? "250") || 250;
  const shippingCost = shippingMethod === "courier" ? courierCharge : shippingMethod === "sl_post" ? slPostCharge : 0;

  const bankDetails: { bankName: string; accountHolder: string; accountNumber: string; branch: string; swiftBic: string }[] = (() => {
    try { return JSON.parse((settings as any)?.bankDetails || "[]"); } catch { return []; }
  })();
  const qrUrl = (settings as any)?.paymentQrUrl || "";

  const hasBankTransfer = bankDetails.length > 0;
  const hasQrPayment = !!qrUrl;
  const hasAnyPaymentOption = hasBankTransfer || hasQrPayment;

  const { mutate: createOrder, isPending } = useCreateOrder({
    mutation: {
      onSuccess: (data: any) => {
        setOrderId(data.orderId || "");
        clearCart();
        setStep("success");
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      }
    }
  });

  const { subtotal, count } = getTotals();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const couponDiscount = appliedCoupon?.discount ?? 0;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponApplying(true);
    setCouponError("");
    try {
      const baseTotal = subtotal + (shippingMethod ? shippingCost : 0);
      const r = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), orderTotal: baseTotal }),
      });
      const data = await r.json();
      if (data.valid) {
        setAppliedCoupon({ id: data.id, code: data.code, discount: data.discount, type: data.type, value: data.value });
        setCouponInput("");
        setCouponError("");
      } else {
        setCouponError(data.message || "Invalid coupon code.");
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setCouponApplying(false);
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    if (!shippingMethod) { setShippingError(true); hasError = true; } else { setShippingError(false); }
    if (hasAnyPaymentOption && !paymentMethod) { setPaymentMethodError(true); hasError = true; } else { setPaymentMethodError(false); }
    if (hasError) return;
    const rawTotal = subtotal + (shippingMethod ? shippingCost : 0);
    const finalTotal = Math.max(0, rawTotal - couponDiscount);
    setOrderTotal(finalTotal);
    const paymentNote = paymentMethod ? `[Payment: ${paymentMethod.replace(/_/g, " ")}]` : "";
    const couponNote = appliedCoupon ? `[Coupon: ${appliedCoupon.code} -Rs.${appliedCoupon.discount}]` : "";
    createOrder({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email || null,
        customerAddress: form.address || "Not specified",
        orderType: "standard",
        items: items.map(i => ({
          productId: i.productId ?? null,
          name: i.name,
          quantity: i.quantity,
          price: parseFloat(i.price.replace(/[^0-9.-]+/g, "")) || 0,
          notes: i.notes ?? null,
        })),
        designLinks: [],
        attachments: [],
        notes: [paymentNote, couponNote, form.notes].filter(Boolean).join(" ") || null,
        shippingMethod,
        // Pass the coupon discount through so the auto-generated invoice
        // matches what the customer is actually paying. Without this the
        // invoice was being saved at the un-discounted total.
        discountAmount: Math.max(0, Math.round(couponDiscount || 0)),
      } as any
    });
    if (appliedCoupon) {
      fetch(`/api/coupons/${appliedCoupon.id}/use`, { method: "POST" }).catch(() => {});
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      if (step === "success") {
        setStep("cart");
        setForm(EMPTY_FORM);
        setShippingMethod("");
        setShippingError(false);
        setOrderId("");
        setPaymentMethod("");
        setPaymentMethodError(false);
        setOrderTotal(0);
        setCouponInput("");
        setCouponError("");
        setAppliedCoupon(null);
      }
    }, 300);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <ShoppingBag size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">
                    {step === "cart" ? "Your Cart" : step === "checkout" ? "Checkout" : "Order Placed!"}
                  </h2>
                  {step === "cart" && (
                    <p className="text-xs text-gray-400">
                      {items.length} {items.length === 1 ? "item" : "items"}
                      {count > 0 && ` • ${count} ${count === 1 ? "pc" : "pcs"}`}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* STEP: Cart */}
            {step === "cart" && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                        <ShoppingBag size={36} className="text-gray-300" />
                      </div>
                      <h3 className="font-bold text-gray-700 mb-1">Your cart is empty</h3>
                      <p className="text-sm text-gray-400">Browse our store and add products to get started.</p>
                      <button onClick={handleClose} className="mt-5 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold rounded-xl">
                        Continue Shopping
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map(item => (
                        <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-2xl">
                          <div className="w-16 h-16 rounded-xl bg-white border border-gray-100 overflow-hidden shrink-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag size={20} className="text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                            {item.notes && (
                              <p className="text-xs text-purple-600 mt-0.5 italic line-clamp-2">{item.notes}</p>
                            )}
                            <p className="text-pink-600 font-bold text-sm mt-0.5">{formatPrice(item.price)}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => item.quantity <= 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)}
                                className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-pink-300 transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-sm font-bold text-gray-800 w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-pink-300 transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-between shrink-0">
                            <button onClick={() => removeItem(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                            <p className="text-sm font-bold text-gray-800">
                              Rs. {(parseFloat(item.price.replace(/[^0-9.-]+/g, "")) * item.quantity).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"}{count > 0 ? ` • ${count} ${count === 1 ? "pc" : "pcs"}` : ""})</span>
                      <span className="font-bold text-gray-900">Rs. {subtotal.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                      Final price will be confirmed after reviewing your design requirements.
                    </div>
                    <button
                      onClick={() => setStep("checkout")}
                      className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/25"
                    >
                      Proceed to Checkout <ChevronRight size={18} />
                    </button>
                    <button onClick={() => clearCart()} className="w-full py-2 text-sm text-gray-400 hover:text-red-500 transition-colors">
                      Clear cart
                    </button>
                  </div>
                )}
              </>
            )}

            {/* STEP: Checkout */}
            {step === "checkout" && (
              <form onSubmit={handlePlaceOrder} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Summary</h3>
                    {items.map(i => (
                      <div key={i.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{i.name} <span className="text-gray-400">×{i.quantity}</span></span>
                        <span className="font-semibold text-gray-800">Rs. {(parseFloat(i.price.replace(/[^0-9.-]+/g, "")) * i.quantity).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-2 flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-semibold text-gray-700">Rs. {subtotal.toLocaleString("en-IN")}</span>
                    </div>
                    {shippingMethod && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Shipping ({shippingMethod === "courier" ? "Courier" : "SL Post"})</span>
                        <span className="font-semibold text-gray-700">Rs. {shippingCost.toLocaleString("en-IN")} <span className="text-[10px] text-amber-500">*est.</span></span>
                      </div>
                    )}
                    {appliedCoupon && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-1.5">
                          <Tag size={12} />
                          Coupon ({appliedCoupon.code})
                        </span>
                        <span className="font-bold">− Rs. {appliedCoupon.discount.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span className="text-pink-600">
                        Rs. {Math.max(0, subtotal + (shippingMethod ? shippingCost : 0) - couponDiscount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Coupon Code */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Tag size={11} /> Coupon Code
                    </h3>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                            <Tag size={13} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-green-700 font-mono">{appliedCoupon.code}</p>
                            <p className="text-xs text-green-600">
                              {appliedCoupon.type === "percentage" ? `${appliedCoupon.value}%` : `Rs. ${appliedCoupon.value}`} discount applied — saved Rs. {appliedCoupon.discount.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAppliedCoupon(null)}
                          className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          <X size={14} className="text-green-500" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleApplyCoupon())}
                            placeholder="Enter coupon code"
                            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={couponApplying || !couponInput.trim()}
                            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                          >
                            {couponApplying ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                          </button>
                        </div>
                        {couponError && (
                          <p className="text-xs text-red-500 flex items-center gap-1.5 px-1">
                            <AlertCircle size={11} /> {couponError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Shipping Method — Required */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Shipping Method <span className="text-red-400">*</span>
                    </h3>
                    <div className="space-y-2.5">
                      {/* Courier Service */}
                      <label
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${shippingMethod === "courier" ? "border-pink-400 bg-pink-50/60" : "border-gray-200 hover:border-pink-200 bg-white"}`}
                      >
                        <input
                          type="radio"
                          name="shippingMethod"
                          value="courier"
                          checked={shippingMethod === "courier"}
                          onChange={() => { setShippingMethod("courier"); setShippingError(false); }}
                          className="sr-only"
                        />
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${shippingMethod === "courier" ? "bg-pink-100" : "bg-gray-100"}`}>
                          <Truck size={18} className={shippingMethod === "courier" ? "text-pink-500" : "text-gray-400"} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sm text-gray-900">Courier Service</div>
                          <div className="text-xs text-gray-400 mt-0.5">Fast delivery via registered courier</div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                          <span className="text-sm font-bold text-pink-600">Rs. {courierCharge.toLocaleString("en-IN")}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${shippingMethod === "courier" ? "border-pink-500 bg-pink-500" : "border-gray-300"}`}>
                            {shippingMethod === "courier" && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </div>
                      </label>

                      {/* SL Post */}
                      <label
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${shippingMethod === "sl_post" ? "border-pink-400 bg-pink-50/60" : "border-gray-200 hover:border-pink-200 bg-white"}`}
                      >
                        <input
                          type="radio"
                          name="shippingMethod"
                          value="sl_post"
                          checked={shippingMethod === "sl_post"}
                          onChange={() => { setShippingMethod("sl_post"); setShippingError(false); }}
                          className="sr-only"
                        />
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${shippingMethod === "sl_post" ? "bg-pink-100" : "bg-gray-100"}`}>
                          <Package size={18} className={shippingMethod === "sl_post" ? "text-pink-500" : "text-gray-400"} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sm text-gray-900">Sri Lanka Post</div>
                          <div className="text-xs text-gray-400 mt-0.5">Standard postal service delivery</div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                          <span className="text-sm font-bold text-pink-600">Rs. {slPostCharge.toLocaleString("en-IN")}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${shippingMethod === "sl_post" ? "border-pink-500 bg-pink-500" : "border-gray-300"}`}>
                            {shippingMethod === "sl_post" && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </div>
                      </label>
                    </div>

                    {shippingError && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
                        <AlertCircle size={12} /> Please select a shipping method before placing your order.
                      </p>
                    )}

                    {/* Shipping charge notice */}
                    {shippingMethod && (
                      <div className="mt-3 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          <span className="font-semibold">Note:</span> Shipping charges may change depending on the total weight of your items. Final shipping cost will be confirmed when we process your order.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  {hasAnyPaymentOption && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Payment Method <span className="text-red-400">*</span>
                      </h3>
                      <div className="space-y-2.5">

                        {hasBankTransfer && (
                          <label className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "bank_transfer" ? "border-pink-400 bg-pink-50/60" : "border-gray-200 hover:border-pink-200 bg-white"}`}>
                            <input type="radio" name="paymentMethod" value="bank_transfer" checked={paymentMethod === "bank_transfer"} onChange={() => { setPaymentMethod("bank_transfer"); setPaymentMethodError(false); }} className="sr-only" />
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "bank_transfer" ? "bg-pink-100" : "bg-gray-100"}`}>
                              <Building2 size={18} className={paymentMethod === "bank_transfer" ? "text-pink-500" : "text-gray-400"} />
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-sm text-gray-900">Bank Transfer</div>
                              <div className="text-xs text-gray-400 mt-0.5">Pay via direct bank deposit</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${paymentMethod === "bank_transfer" ? "border-pink-500 bg-pink-500" : "border-gray-300"}`}>
                              {paymentMethod === "bank_transfer" && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </label>
                        )}

                        {hasQrPayment && (
                          <label className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "qr_payment" ? "border-pink-400 bg-pink-50/60" : "border-gray-200 hover:border-pink-200 bg-white"}`}>
                            <input type="radio" name="paymentMethod" value="qr_payment" checked={paymentMethod === "qr_payment"} onChange={() => { setPaymentMethod("qr_payment"); setPaymentMethodError(false); }} className="sr-only" />
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === "qr_payment" ? "bg-pink-100" : "bg-gray-100"}`}>
                              <QrCode size={18} className={paymentMethod === "qr_payment" ? "text-pink-500" : "text-gray-400"} />
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-sm text-gray-900">QR Payment</div>
                              <div className="text-xs text-gray-400 mt-0.5">Scan QR with FriMo, mCash, or bank app</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${paymentMethod === "qr_payment" ? "border-pink-500 bg-pink-500" : "border-gray-300"}`}>
                              {paymentMethod === "qr_payment" && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </label>
                        )}

                      </div>
                      {paymentMethodError && (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
                          <AlertCircle size={12} /> Please select a payment method before placing your order.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Contact Form */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Details</h3>
                    {[
                      { key: "name", label: "Full Name *", placeholder: "Enter your full name", required: true },
                      { key: "phone", label: "Phone Number *", placeholder: "Enter your phone number", required: true },
                      { key: "email", label: "Email Address *", placeholder: "Enter your email address", required: true },
                      { key: "address", label: "Delivery Address *", placeholder: "Enter your delivery address", required: true },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                        <input
                          required={f.required}
                          value={(form as any)[f.key]}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Special Notes / Design Instructions</label>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={e => set("notes", e.target.value)}
                        placeholder="Add any special requirements, sizes, colors, or file formats"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-300 resize-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/25 disabled:opacity-70"
                  >
                    {isPending ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Placing Order...</>
                    ) : (
                      <>Place Order — Rs. {Math.max(0, subtotal + (shippingMethod ? shippingCost : 0) - couponDiscount).toLocaleString("en-IN")}</>
                    )}
                  </button>
                  <button type="button" onClick={() => setStep("cart")} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    ← Back to Cart
                  </button>
                </div>
              </form>
            )}

            {/* STEP: Success */}
            {step === "success" && (
              <div className="flex-1 flex flex-col items-center px-6 py-10 text-center overflow-y-auto">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle size={40} className="text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Order Placed!</h2>
                <p className="text-gray-500 text-sm mb-2">
                  {paymentMethod === "bank_transfer"
                    ? "Your order is confirmed. Please complete the bank transfer using the details below."
                    : paymentMethod === "qr_payment"
                    ? "Your order is confirmed. Scan the QR code below to complete payment."
                    : "Submitted successfully. We'll contact you shortly to confirm details."}
                </p>
                <p className="text-emerald-600 text-sm font-semibold mb-4">
                  Your order will be processed shortly.
                </p>

                {/* Bank Transfer Details */}
                {paymentMethod === "bank_transfer" && bankDetails.length > 0 && (
                  <div className="w-full mb-5 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={16} className="text-pink-500" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Transfer Details</span>
                    </div>
                    <div className="space-y-3">
                      {bankDetails.map((bank, i) => (
                        <div key={i} className="bg-gradient-to-br from-pink-50 to-purple-50 border border-purple-100 rounded-2xl p-4 space-y-2">
                          {bank.bankName && <div className="font-bold text-gray-800 text-sm">{bank.bankName}</div>}
                          {bank.accountHolder && (
                            <div className="flex items-center justify-between gap-2">
                              <div><p className="text-[10px] text-gray-400">Account Holder</p><p className="text-sm font-semibold text-gray-800">{bank.accountHolder}</p></div>
                            </div>
                          )}
                          {bank.accountNumber && (
                            <div className="flex items-center justify-between gap-2">
                              <div><p className="text-[10px] text-gray-400">Account Number</p><p className="text-sm font-bold text-pink-600 font-mono">{bank.accountNumber}</p></div>
                              <CopyButton text={bank.accountNumber} label="Copy" />
                            </div>
                          )}
                          {bank.branch && <div><p className="text-[10px] text-gray-400">Branch</p><p className="text-sm text-gray-700">{bank.branch}</p></div>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">After transferring, send your payment slip via WhatsApp so we can confirm your order quickly.</p>
                    </div>
                  </div>
                )}

                {/* QR Payment */}
                {paymentMethod === "qr_payment" && qrUrl && (
                  <div className="w-full mb-5 text-left">
                    <div className="flex items-center gap-2 mb-3">
                      <QrCode size={16} className="text-pink-500" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Scan to Pay</span>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-purple-100 rounded-2xl p-5 flex flex-col items-center gap-4">
                      <img src={qrUrl} alt="Payment QR Code" className="w-48 h-48 object-contain rounded-xl border border-white shadow-md" />
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-1">Amount to Pay</p>
                        <p className="text-2xl font-bold text-pink-600">Rs. {orderTotal.toLocaleString("en-IN")}</p>
                        <p className="text-xs text-amber-600 mt-1">*Final amount may vary based on shipping weight</p>
                      </div>
                    </div>
                    <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">After scanning and paying, send us the payment screenshot via WhatsApp to confirm your order.</p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-5 w-full text-left flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  Shipping charges may be adjusted based on item weight. We'll confirm the final total before processing payment.
                </p>

                {orderId && (() => {
                  const trackingUrl = `${window.location.origin}/track-order?id=${orderId}`;
                  return (
                    <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-purple-100 rounded-2xl p-5 mb-5 w-full text-left space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Order Details</p>

                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Order ID</p>
                          <p className="font-mono font-bold text-pink-600 text-lg leading-tight">{orderId}</p>
                        </div>
                        <CopyButton text={orderId} label="ID" />
                      </div>

                      <div className="h-px bg-purple-100" />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">Tracking Link</p>
                          <p className="text-xs text-gray-600 truncate font-mono">{trackingUrl}</p>
                        </div>
                        <CopyButton text={trackingUrl} label="Link" />
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed">
                        Save your Order ID — use it anytime on the Track Order page to check your status.
                      </p>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-2.5 w-full">
                  {orderId && (
                    <a
                      href={`/track-order?id=${orderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 border border-purple-200 bg-purple-50 text-purple-700 font-semibold rounded-2xl text-sm hover:bg-purple-100 transition-colors"
                    >
                      <ExternalLink size={15} /> Track My Order
                    </a>
                  )}
                  <button
                    onClick={handleClose}
                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-2xl text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
