import { useEffect, useState } from "react";
import { Loader2, MapPin, PackageCheck, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type ShippingDetails = {
  recipientName: string;
  phone: string;
  alternatePhone: string;
  address: string;
  city: string;
  district: string;
  postalCode: string;
  deliveryNotes: string;
  urgent: boolean;
  fragile: boolean;
  handleWithCare: boolean;
  thisSideUp: boolean;
  keepDry: boolean;
  labelSize: "standard" | "a5";
};

export const EMPTY_SHIPPING_DETAILS: ShippingDetails = { recipientName: "", phone: "", alternatePhone: "", address: "", city: "", district: "", postalCode: "", deliveryNotes: "", urgent: false, fragile: false, handleWithCare: false, thisSideUp: false, keepDry: false, labelSize: "standard" };

export function ShippingDetailsModal({ client, onClose }: { client: { id: number; name: string; phone?: string | null; address?: string | null }; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<ShippingDetails>({ ...EMPTY_SHIPPING_DETAILS, recipientName: client.name, phone: String(client.phone || "").split(",")[0]?.trim() || "", alternatePhone: String(client.phone || "").split(",")[1]?.trim() || "", address: client.address || "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/shipping-labels/client-details/${client.id}`, { credentials: "include", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not load shipping details");
        return response.json();
      })
      .then(body => {
        if (!controller.signal.aborted) setForm({ ...EMPTY_SHIPPING_DETAILS, ...body.details });
      })
      .catch((error: any) => {
        if (error.name !== "AbortError") toast({ title: "Could not load saved shipping details", description: "Customer main details are shown as a fallback. Please review before saving.", variant: "destructive" });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client.id]);
  const field = (key: keyof ShippingDetails, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/shipping-labels/client-details/${client.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Save failed");
      const saved = await response.json();
      setForm({ ...EMPTY_SHIPPING_DETAILS, ...saved.details });
      toast({ title: "Shipping details saved", description: "The updated address will be used on new shipping labels." }); onClose();
    } catch (error: any) { toast({ title: "Could not save shipping details", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  const input = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-pink-400";
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl" onClick={event => event.stopPropagation()}>
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4"><div className="flex items-center gap-2"><PackageCheck className="text-pink-500" size={19}/><div><h2 className="font-bold text-gray-900">Shipping Details</h2><p className="text-[11px] text-gray-400">{client.name} · saved to customer profile</p></div></div><button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={18}/></button></div>
    {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-pink-500"/></div> : <div className="space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-500">Recipient Name<input value={form.recipientName} onChange={e=>field("recipientName",e.target.value)} className={`mt-1 ${input}`}/></label><label className="text-xs font-semibold text-gray-500">Primary Delivery Phone<input value={form.phone} onChange={e=>field("phone",e.target.value)} className={`mt-1 ${input}`} inputMode="tel"/></label><label className="text-xs font-semibold text-gray-500">Alternative Phone<input value={form.alternatePhone} onChange={e=>field("alternatePhone",e.target.value)} className={`mt-1 ${input}`} inputMode="tel"/></label><label className="text-xs font-semibold text-gray-500">Postal Code<input value={form.postalCode} onChange={e=>field("postalCode",e.target.value)} className={`mt-1 ${input}`}/></label><label className="text-xs font-semibold text-gray-500">City<input value={form.city} onChange={e=>field("city",e.target.value)} className={`mt-1 ${input}`}/></label><label className="text-xs font-semibold text-gray-500">District<input value={form.district} onChange={e=>field("district",e.target.value)} className={`mt-1 ${input}`}/></label></div>
      <label className="block text-xs font-semibold text-gray-500"><span className="flex items-center gap-1"><MapPin size={12}/>Full Shipping Address</span><textarea value={form.address} onChange={e=>field("address",e.target.value)} rows={4} placeholder={"House / Building\nStreet / Area\nCity"} className={`mt-1 resize-y leading-relaxed ${input}`}/><span className="mt-1 block text-[10px] text-gray-400">Use a new line for each address part.</span></label>
      <label className="block text-xs font-semibold text-gray-500">Delivery Notes<textarea value={form.deliveryNotes} onChange={e=>field("deliveryNotes",e.target.value)} rows={2} placeholder="Landmark, gate instructions, etc." className={`mt-1 resize-none ${input}`}/></label>
      <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 text-sm font-bold text-white disabled:opacity-60">{saving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Save Shipping Details</button>
    </div>}
  </div></div>;
}
