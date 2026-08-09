import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, Loader2, PackagePlus, Plus, RefreshCw, Save, Trash2, TrendingUp, Wallet, Recycle, Printer } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { A4PrintPortal,useA4Print } from "@/components/A4PrintPortal";

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
const input = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-pink-400";
const emptyTransaction = { type: "expense", category: "general", description: "", amount: "", transactionDate: today(), projectId: "", invoiceId: "", inventoryItemId: "", inventoryQuantity: "", purchaseMode: "pack", packCount: "", unitsPerPack: "" };
const emptyWaste = { projectId: "", inventoryItemId: "", quantity: "", note: "", wasteDate: today() };

type Summary = { month: string; initialBalance: number; currentBalance: number; income: number; expenses: number; netProfit: number; inventoryValue: number; lowStockItems: number };
type Transaction = { id: number; type: "income" | "expense"; category: string; description: string; amount: string; transaction_date: string; project_id?: string; invoice_id?: string; inventory_name?: string; inventory_quantity?: number; pack_count?: number; units_per_pack?: number };
type CostValue = { id: number; name: string; category: string; unit: string; unit_cost: string; notes?: string };
type WasteRecord = { id: number; project_id?: string; inventory_name: string; quantity: number; unit: string; note?: string; waste_date: string };

export default function FinanceInventory() {
  const { active: printActive, print: printA4 } = useA4Print();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState<"overview" | "cash" | "waste" | "costs">("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [costValues, setCostValues] = useState<CostValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState("");
  const [transactionForm, setTransactionForm] = useState(emptyTransaction);
  const [wasteForm, setWasteForm] = useState(emptyWaste);
  const [costMaterialId, setCostMaterialId] = useState("");
  const [costMaterialQty, setCostMaterialQty] = useState("");
  const [costQuantities, setCostQuantities] = useState<Record<number, string>>({});
  const loadSequence = useRef(0);
  const [costForm, setCostForm] = useState({ name: "", category: "printing", unit: "sheet", unitCost: "", notes: "" });

  const request = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, { credentials: "include", cache: "no-store", ...options, headers: options?.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options?.headers });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Request failed");
    return response.json();
  };

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setSummary(null);
    setTransactions([]);
    setWasteRecords([]);
    const selectedMonth = month;
    try {
      const [summaryData, transactionData, wasteData, inventoryData, projectData, invoiceData, costValueData] = await Promise.all([
        request(`/api/finance-inventory/summary?month=${encodeURIComponent(selectedMonth)}`),
        request(`/api/finance-inventory/transactions?month=${encodeURIComponent(selectedMonth)}`),
        request(`/api/finance-inventory/waste?month=${encodeURIComponent(selectedMonth)}`),
        request("/api/inventory"),
        request("/api/crm-projects"),
        request("/api/invoices"),
        request("/api/finance-inventory/cost-values"),
      ]);
      if (sequence !== loadSequence.current) return;
      setSummary(summaryData); setBalance(String(summaryData.initialBalance ?? 0));
      setTransactions(transactionData); setWasteRecords(wasteData); setInventory(inventoryData);
      setProjects(projectData); setInvoices(invoiceData); setCostValues(costValueData);
    } catch (error: any) {
      if (sequence === loadSequence.current) toast({ title: "Finance module could not load", description: error.message, variant: "destructive" });
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const saveBalance = async () => {
    setSaving(true);
    try {
      await request("/api/finance-inventory/initial-balance", { method: "PUT", body: JSON.stringify({ amount: balance }) });
      toast({ title: "Initial balance updated" }); await load();
    } catch (error: any) { toast({ title: "Could not update balance", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveTransaction = async () => {
    setSaving(true);
    try {
      const costItems = Object.entries(costQuantities).filter(([,quantity])=>Number(quantity)>0).map(([id,quantity])=>({ id:Number(id), quantity:Number(quantity) }));
      await request("/api/finance-inventory/transactions", { method: "POST", body: JSON.stringify({ ...transactionForm, usageItemId: costMaterialId || null, usageQuantity: costMaterialQty || null, costItems }) });
      toast({ title: transactionForm.category === "material_purchase" ? "Purchase saved and inventory updated" : "Transaction saved" });
      setTransactionForm({ ...emptyTransaction, transactionDate: today() }); setCostMaterialId(""); setCostMaterialQty(""); setCostQuantities({}); await load();
    } catch (error: any) { toast({ title: "Could not save transaction", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveWaste = async () => {
    setSaving(true);
    try {
      await request("/api/finance-inventory/waste", { method: "POST", body: JSON.stringify(wasteForm) });
      toast({ title: "Waste recorded and stock deducted" }); setWasteForm({ ...emptyWaste, wasteDate: today() }); await load();
    } catch (error: any) { toast({ title: "Could not record waste", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const saveCostValue = async () => {
    setSaving(true);
    try {
      await request("/api/finance-inventory/cost-values", { method: "POST", body: JSON.stringify(costForm) });
      toast({ title: "Production cost value added" }); setCostForm({ name: "", category: "printing", unit: "sheet", unitCost: "", notes: "" }); await load();
    } catch (error: any) { toast({ title: "Could not save cost value", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const removeCostValue = async (id: number) => {
    if (!window.confirm("Delete this production cost value?")) return;
    try { await request(`/api/finance-inventory/cost-values/${id}`, { method: "DELETE" }); toast({ title: "Cost value deleted" }); await load(); }
    catch (error: any) { toast({ title: "Could not delete cost value", description: error.message, variant: "destructive" }); }
  };

  const remove = async (kind: "transactions" | "waste", id: number) => {
    if (!window.confirm("Delete this record and reverse its inventory movement?")) return;
    try {
      await request(`/api/finance-inventory/${kind}/${id}`, { method: "DELETE" });
      toast({ title: "Record deleted safely" });
      await load();
    } catch (error: any) {
      if (kind === "transactions" && /stock has already been used/i.test(error.message || "")) {
        const force = window.confirm(
          "Some stock from this purchase has already been used.\n\nSPECIAL OWNER DELETE: remove the purchase from Finance anyway? Current physical stock will be kept unchanged to avoid corrupting inventory."
        );
        if (!force) return;
        try {
          await request(`/api/finance-inventory/transactions/${id}?force=1`, { method: "DELETE" });
          toast({ title: "Purchase force-deleted", description: "Finance entry removed; current physical stock was preserved." });
          await load();
          return;
        } catch (forceError: any) {
          toast({ title: "Could not force-delete purchase", description: forceError.message, variant: "destructive" });
          return;
        }
      }
      toast({ title: "Could not delete record", description: error.message, variant: "destructive" });
    }
  };

  const linkedProject = (id?: string) => projects.find(p => String(p.projectId) === String(id));
  const categoryLabels: Record<string, string> = { general: "General Expense", material_purchase: "Material Purchase", project_cost: "Project Cost", invoice_cost: "Invoice Cost", sales: "Sales / Revenue", other_income: "Other Income" };
  const categoryLabel = (value: string) => categoryLabels[value] || value;
  const selectedMaterial = useMemo(() => inventory.find(item => String(item.id) === transactionForm.inventoryItemId), [inventory, transactionForm.inventoryItemId]);
  const purchasedUnits = transactionForm.purchaseMode === "pack" ? Number(transactionForm.packCount || 0) * Number(transactionForm.unitsPerPack || 0) : Number(transactionForm.inventoryQuantity || 0);
  const purchaseUnitCost = purchasedUnits > 0 ? Number(transactionForm.amount || 0) / purchasedUnits : 0;
  const costingMaterial = inventory.find(item => String(item.id) === costMaterialId);
  const materialUsageCost = Number(costingMaterial?.cost || 0) * Number(costMaterialQty || 0);
  const productionUsageCost = costValues.reduce((sum,item)=>sum + Number(item.unit_cost||0) * Number(costQuantities[item.id]||0),0);
  const calculatedProjectCost = materialUsageCost + productionUsageCost;
  const applyProjectCost = () => setTransactionForm(p=>({...p, amount: calculatedProjectCost ? String(calculatedProjectCost) : p.amount}));
  const reportMonthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-LK", { month: "long", year: "numeric" });
  const reportIncome = transactions.filter(row=>row.type==="income").reduce((sum,row)=>sum+Number(row.amount||0),0);
  const reportExpenses = transactions.filter(row=>row.type==="expense").reduce((sum,row)=>sum+Number(row.amount||0),0);

  const cards = [
    { label: "Month-end Cash Balance", value: summary?.currentBalance, icon: Wallet, tone: "from-blue-500 to-indigo-600" },
    { label: "Monthly Income", value: summary?.income, icon: ArrowDownLeft, tone: "from-emerald-500 to-teal-600" },
    { label: "Monthly Expenses", value: summary?.expenses, icon: ArrowUpRight, tone: "from-rose-500 to-pink-600" },
    { label: "Monthly Net Profit", value: summary?.netProfit, icon: TrendingUp, tone: (summary?.netProfit || 0) >= 0 ? "from-violet-500 to-purple-600" : "from-orange-500 to-red-600" },
  ];

  return <div className="min-h-screen space-y-5 bg-gray-50 p-3 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-black text-gray-950">Finance & Inventory</h1><p className="mt-1 text-sm text-gray-500">Cash flow, project costing, material purchases and waste in one place.</p><span className="mt-2 inline-flex rounded-full bg-pink-50 px-3 py-1 text-[11px] font-black text-pink-600">Viewing {reportMonthLabel}</span></div>
      <div className="flex flex-wrap items-center gap-2"><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className={`${input} w-auto`}/><button onClick={load} title="Refresh month" className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-100"><RefreshCw size={17}/></button><button onClick={printA4} className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-black text-white"><Printer size={16}/>Print Monthly Report</button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(card=><div key={card.label} className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm"><div className={`h-1 bg-gradient-to-r ${card.tone}`}/><div className="p-4"><card.icon size={18} className="mb-3 text-gray-400"/><div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{card.label}</div><div className="mt-1 text-lg font-black text-gray-900 sm:text-xl">{loading?"—":money(card.value)}</div></div></div>)}</div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="text-xs font-bold uppercase text-gray-400">Initial Account Balance</div><div className="mt-3 flex gap-2"><input type="number" step="0.01" value={balance} onChange={e=>setBalance(e.target.value)} className={input}/><button onClick={saveBalance} disabled={saving} className="rounded-xl bg-gray-900 px-4 text-white disabled:opacity-50"><Save size={16}/></button></div></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><Boxes size={18} className="text-blue-500"/><div className="mt-2 text-xs font-bold uppercase text-gray-400">Inventory Value</div><div className="mt-1 text-xl font-black">{money(summary?.inventoryValue)}</div></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><AlertTriangle size={18} className="text-amber-500"/><div className="mt-2 text-xs font-bold uppercase text-gray-400">Low Stock Items</div><div className="mt-1 text-xl font-black">{summary?.lowStockItems || 0}</div><Link href="/admin/raw-materials" className="mt-2 inline-block text-xs font-bold text-pink-600">Manage raw materials →</Link></div>
    </div>

    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">{[
      ["overview","Overview & Add Entry"],["cash","Cash Flow Ledger"],["waste","Project Waste"],["costs","Cost Values"]
    ].map(([value,label])=><button key={value} onClick={()=>setTab(value as any)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${tab===value?"bg-gray-900 text-white":"text-gray-500 hover:bg-gray-50"}`}>{label}</button>)}</div>

    {loading?<div className="flex justify-center py-24"><Loader2 className="animate-spin text-pink-500"/></div>:tab==="overview"?<div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black"><Plus size={19} className="text-pink-500"/>Add Cash Entry</h2>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2"><button onClick={()=>setTransactionForm(p=>({...p,type:"income",category:"sales"}))} className={`rounded-xl border p-3 text-xs font-bold ${transactionForm.type==="income"?"border-emerald-300 bg-emerald-50 text-emerald-700":"border-gray-200"}`}>Income</button><button onClick={()=>setTransactionForm(p=>({...p,type:"expense",category:"general"}))} className={`rounded-xl border p-3 text-xs font-bold ${transactionForm.type==="expense"?"border-rose-300 bg-rose-50 text-rose-700":"border-gray-200"}`}>Expense</button></div>
          <label className="block text-xs font-bold text-gray-500">Category<select value={transactionForm.category} onChange={e=>setTransactionForm(p=>({...p,category:e.target.value,type:e.target.value==="sales"||e.target.value==="other_income"?"income":"expense"}))} className={`mt-1 ${input}`}><option value="general">General Expense</option><option value="material_purchase">Material Purchase + Add Stock</option><option value="project_cost">Project Cost</option><option value="invoice_cost">Invoice Cost</option><option value="sales">Sales / Revenue</option><option value="other_income">Other Income</option></select></label>
          <label className="block text-xs font-bold text-gray-500">Description<input value={transactionForm.description} onChange={e=>setTransactionForm(p=>({...p,description:e.target.value}))} placeholder="Paper purchase, customer payment..." className={`mt-1 ${input}`}/></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-gray-500">Amount (LKR)<input type="number" min="0" step="0.01" value={transactionForm.amount} onChange={e=>setTransactionForm(p=>({...p,amount:e.target.value}))} className={`mt-1 ${input}`}/></label><label className="text-xs font-bold text-gray-500">Date<input type="date" value={transactionForm.transactionDate} onChange={e=>setTransactionForm(p=>({...p,transactionDate:e.target.value}))} className={`mt-1 ${input}`}/></label></div>
          <label className="block text-xs font-bold text-gray-500">Link Project (optional)<select value={transactionForm.projectId} onChange={e=>setTransactionForm(p=>({...p,projectId:e.target.value}))} className={`mt-1 ${input}`}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.projectId}>{p.projectId} · {p.title}</option>)}</select></label>
          <label className="block text-xs font-bold text-gray-500">Link Invoice (optional)<select value={transactionForm.invoiceId} onChange={e=>setTransactionForm(p=>({...p,invoiceId:e.target.value}))} className={`mt-1 ${input}`}><option value="">No invoice</option>{invoices.map(i=><option key={i.id} value={i.invoiceNumber}>{i.invoiceNumber} · {i.clientName}</option>)}</select></label>
          {transactionForm.category==="material_purchase"&&<div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex items-center gap-2 text-xs font-black text-blue-700"><PackagePlus size={15}/>Pack purchase → inventory auto-update</div>
            <select value={transactionForm.inventoryItemId} onChange={e=>setTransactionForm(p=>({...p,inventoryItemId:e.target.value}))} className={input}><option value="">Select raw material</option>{inventory.map(item=><option key={item.id} value={item.id}>{item.name} · Current {item.quantity} {item.unit}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setTransactionForm(p=>({...p,purchaseMode:"pack"}))} className={`rounded-xl border p-2 text-xs font-bold ${transactionForm.purchaseMode==="pack"?"border-blue-400 bg-white text-blue-700":"border-blue-100 text-gray-500"}`}>Buy as packs</button><button type="button" onClick={()=>setTransactionForm(p=>({...p,purchaseMode:"direct"}))} className={`rounded-xl border p-2 text-xs font-bold ${transactionForm.purchaseMode==="direct"?"border-blue-400 bg-white text-blue-700":"border-blue-100 text-gray-500"}`}>Direct quantity</button></div>
            {transactionForm.purchaseMode==="pack"?<div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-blue-700">Number of Packs<input type="number" min="1" value={transactionForm.packCount} onChange={e=>setTransactionForm(p=>({...p,packCount:e.target.value}))} className={`mt-1 ${input}`}/></label><label className="text-xs font-bold text-blue-700">{selectedMaterial?.unit==="sheet"?"Sheets":"Items"} per Pack<input type="number" min="1" value={transactionForm.unitsPerPack} onChange={e=>setTransactionForm(p=>({...p,unitsPerPack:e.target.value}))} className={`mt-1 ${input}`}/></label></div>:<label className="block text-xs font-bold text-blue-700">Purchased Quantity ({selectedMaterial?.unit || "units"})<input type="number" min="1" value={transactionForm.inventoryQuantity} onChange={e=>setTransactionForm(p=>({...p,inventoryQuantity:e.target.value}))} className={`mt-1 ${input}`}/></label>}
            {purchasedUnits>0&&<div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-xs"><div><span className="text-gray-400">Stock added</span><div className="font-black text-gray-900">{purchasedUnits} {selectedMaterial?.unit||"units"}</div></div><div><span className="text-gray-400">Cost per {selectedMaterial?.unit||"unit"}</span><div className="font-black text-blue-700">{money(purchaseUnitCost)}</div></div></div>}
          </div>}
          {transactionForm.category==="project_cost"&&<div className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
            <div><div className="text-xs font-black text-violet-700">Project Cost Builder</div><p className="mt-1 text-[11px] text-gray-500">Material cost + printing/cutting values are added automatically.</p></div>
            <select value={costMaterialId} onChange={e=>setCostMaterialId(e.target.value)} className={input}><option value="">No raw material</option>{inventory.map(item=><option key={item.id} value={item.id}>{item.name} · {money(item.cost)} per {item.unit}</option>)}</select>
            {costMaterialId&&<label className="block text-xs font-bold text-violet-700">Material Used ({costingMaterial?.unit||"units"})<input type="number" min="0" value={costMaterialQty} onChange={e=>setCostMaterialQty(e.target.value)} className={`mt-1 ${input}`}/></label>}
            <div className="max-h-52 space-y-2 overflow-y-auto">{costValues.map(item=><div key={item.id} className="grid grid-cols-[1fr_90px] items-center gap-2 rounded-xl bg-white p-2"><div><div className="text-xs font-bold text-gray-800">{item.name}</div><div className="text-[10px] text-gray-400">{money(item.unit_cost)} / {item.unit}</div></div><input type="number" min="0" placeholder="Qty" value={costQuantities[item.id]||""} onChange={e=>setCostQuantities(p=>({...p,[item.id]:e.target.value}))} className={input}/></div>)}</div>
            <div className="rounded-xl bg-white p-3"><div className="flex justify-between text-xs text-gray-500"><span>Material</span><b>{money(materialUsageCost)}</b></div><div className="mt-1 flex justify-between text-xs text-gray-500"><span>Print / Cut / Other</span><b>{money(productionUsageCost)}</b></div><div className="mt-2 flex justify-between border-t pt-2 text-sm font-black"><span>Total Project Cost</span><span className="text-violet-700">{money(calculatedProjectCost)}</span></div></div>
            <button type="button" onClick={applyProjectCost} disabled={!calculatedProjectCost} className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white disabled:opacity-40">Use This Total as Expense Amount</button>
          </div>}
          <button onClick={saveTransaction} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 text-sm font-black text-white disabled:opacity-50">{saving?<Loader2 size={16} className="animate-spin"/>:<Plus size={16}/>}Save Entry</button>
        </div>
      </div>
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Recent Monthly Entries</h2><div className="mt-4 space-y-2">{transactions.length===0?<div className="rounded-2xl bg-gray-50 py-16 text-center text-sm text-gray-400">No entries for this month</div>:transactions.slice(0,10).map(row=><TransactionRow key={row.id} row={row} project={linkedProject(row.project_id)} onDelete={()=>remove("transactions",row.id)} categoryLabel={categoryLabel}/>)}</div></div>
    </div>:tab==="cash"?<div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-black">Cash Flow Ledger · {month}</h2><div className="mt-4 space-y-2">{transactions.map(row=><TransactionRow key={row.id} row={row} project={linkedProject(row.project_id)} onDelete={()=>remove("transactions",row.id)} categoryLabel={categoryLabel}/>)}</div></div>:tab==="waste"?<div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black"><Recycle size={19} className="text-orange-500"/>Record Project Waste</h2><div className="mt-4 space-y-3">
        <label className="block text-xs font-bold text-gray-500">Project<select value={wasteForm.projectId} onChange={e=>setWasteForm(p=>({...p,projectId:e.target.value}))} className={`mt-1 ${input}`}><option value="">General / No project</option>{projects.map(p=><option key={p.id} value={p.projectId}>{p.projectId} · {p.title}</option>)}</select></label>
        <label className="block text-xs font-bold text-gray-500">Raw Material<select value={wasteForm.inventoryItemId} onChange={e=>setWasteForm(p=>({...p,inventoryItemId:e.target.value}))} className={`mt-1 ${input}`}><option value="">Select material</option>{inventory.map(item=><option key={item.id} value={item.id}>{item.name} · Available {item.quantity} {item.unit}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-gray-500">Waste Quantity<input type="number" min="1" value={wasteForm.quantity} onChange={e=>setWasteForm(p=>({...p,quantity:e.target.value}))} className={`mt-1 ${input}`}/></label><label className="text-xs font-bold text-gray-500">Date<input type="date" value={wasteForm.wasteDate} onChange={e=>setWasteForm(p=>({...p,wasteDate:e.target.value}))} className={`mt-1 ${input}`}/></label></div>
        <label className="block text-xs font-bold text-gray-500">Reason / Note<textarea rows={3} value={wasteForm.note} onChange={e=>setWasteForm(p=>({...p,note:e.target.value}))} className={`mt-1 resize-none ${input}`} placeholder="Cutting waste, damaged sheets..."/></label>
        <button onClick={saveWaste} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 py-3 text-sm font-black text-white disabled:opacity-50">{saving?<Loader2 size={16} className="animate-spin"/>:<Recycle size={16}/>}Save Waste & Deduct Stock</button>
      </div></div>
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Waste Records · {month}</h2><div className="mt-4 space-y-2">{wasteRecords.length===0?<div className="rounded-2xl bg-gray-50 py-16 text-center text-sm text-gray-400">No waste recorded this month</div>:wasteRecords.map(row=><div key={row.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Recycle size={17}/></div><div className="min-w-0 flex-1"><div className="font-bold text-gray-900">{row.inventory_name} · {row.quantity} {row.unit}</div><div className="text-xs text-gray-400">{row.project_id||"General"} · {String(row.waste_date).slice(0,10)}{row.note?` · ${row.note}`:""}</div></div><button onClick={()=>remove("waste",row.id)} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={15}/></button></div>)}</div></div>
    </div>:<div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Add Production Cost Value</h2>
        <p className="mt-1 text-xs text-gray-500">Printing, cutting, lamination, labour or any reusable cost.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold text-gray-500">Value Name<input value={costForm.name} onChange={e=>setCostForm(p=>({...p,name:e.target.value}))} placeholder="Full colour print" className={`mt-1 ${input}`}/></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-gray-500">Category<select value={costForm.category} onChange={e=>setCostForm(p=>({...p,category:e.target.value}))} className={`mt-1 ${input}`}><option value="printing">Printing</option><option value="cutting">Cutting</option><option value="lamination">Lamination</option><option value="labour">Labour</option><option value="other">Other</option></select></label><label className="text-xs font-bold text-gray-500">Charge Unit<input value={costForm.unit} onChange={e=>setCostForm(p=>({...p,unit:e.target.value}))} placeholder="sheet / item" className={`mt-1 ${input}`}/></label></div>
          <label className="block text-xs font-bold text-gray-500">Cost per Unit (LKR)<input type="number" min="0" step="0.01" value={costForm.unitCost} onChange={e=>setCostForm(p=>({...p,unitCost:e.target.value}))} className={`mt-1 ${input}`}/></label>
          <label className="block text-xs font-bold text-gray-500">Notes (optional)<textarea rows={2} value={costForm.notes} onChange={e=>setCostForm(p=>({...p,notes:e.target.value}))} className={`mt-1 resize-none ${input}`}/></label>
          <button onClick={saveCostValue} disabled={saving||!costForm.name||costForm.unitCost===""} className="w-full rounded-xl bg-gray-900 py-3 text-sm font-black text-white disabled:opacity-40">Add Cost Value</button>
        </div>
      </div>
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Saved Cost Values</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{costValues.length===0?<div className="col-span-full rounded-2xl bg-gray-50 py-16 text-center text-sm text-gray-400">No cost values yet</div>:costValues.map(item=><div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3"><div className="min-w-0 flex-1"><div className="font-bold text-gray-900">{item.name}</div><div className="text-xs text-gray-400">{item.category} · per {item.unit}</div><div className="mt-1 text-sm font-black text-violet-600">{money(item.unit_cost)}</div></div><button onClick={()=>removeCostValue(item.id)} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={15}/></button></div>)}</div></div>
    </div>}

    <A4PrintPortal active={printActive}><section id="monthly-cashflow-report" className="pb-print-flow bg-white p-2 text-gray-900">
      <div className="border-b-2 border-gray-900 pb-4">
        <div className="text-2xl font-black">PrintBloom</div>
        <div className="mt-1 text-lg font-bold">Monthly Cash Flow Report</div>
        <div className="mt-1 text-sm text-gray-500">{reportMonthLabel} · Generated {new Date().toLocaleDateString("en-LK")}</div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[["Monthly Income",reportIncome,"text-emerald-700"],["Monthly Expenses",reportExpenses,"text-rose-700"],["Net Profit",reportIncome-reportExpenses,(reportIncome-reportExpenses)>=0?"text-emerald-700":"text-rose-700"],["Month-end Cash Balance",summary?.currentBalance||0,"text-gray-900"]].map(([label,value,tone])=><div key={String(label)} className="rounded-xl border border-gray-200 p-3"><div className="text-[11px] font-bold uppercase text-gray-500">{String(label)}</div><div className={`mt-1 text-lg font-black ${tone}`}>{money(value)}</div></div>)}
      </div>
      <table className="mt-6 w-full border-collapse text-xs">
        <thead><tr className="border-y-2 border-gray-900 text-left"><th className="py-2 pr-2">Date</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2">Category / Reference</th><th className="py-2 text-right">Income</th><th className="py-2 text-right">Expense</th></tr></thead>
        <tbody>{transactions.map(row=><tr key={row.id} className="border-b border-gray-200 align-top"><td className="py-2 pr-2 whitespace-nowrap">{String(row.transaction_date).slice(0,10)}</td><td className="py-2 pr-2 font-semibold">{row.description}</td><td className="py-2 pr-2 text-gray-500">{categoryLabel(row.category)}{row.invoice_id?<><br/>{row.invoice_id}</>:null}{row.project_id?<><br/>{row.project_id}</>:null}</td><td className="py-2 text-right text-emerald-700">{row.type==="income"?money(row.amount):"—"}</td><td className="py-2 text-right text-rose-700">{row.type==="expense"?money(row.amount):"—"}</td></tr>)}</tbody>
        <tfoot><tr className="border-t-2 border-gray-900 font-black"><td colSpan={3} className="py-3">MONTH TOTAL</td><td className="py-3 text-right text-emerald-700">{money(reportIncome)}</td><td className="py-3 text-right text-rose-700">{money(reportExpenses)}</td></tr></tfoot>
      </table>
      {transactions.length===0&&<div className="py-12 text-center text-sm text-gray-500">No cash-flow entries for {reportMonthLabel}.</div>}
      <div className="mt-8 border-t border-gray-300 pt-3 text-[10px] text-gray-500">Private admin report · PrintBloom Finance & Inventory</div>
    </section></A4PrintPortal>

  </div>;
}

function TransactionRow({ row, project, onDelete, categoryLabel }: { row: Transaction; project?: any; onDelete: () => void; categoryLabel: (value: string) => string }) {
  const income = row.type === "income";
  return <div className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${income?"bg-emerald-50 text-emerald-600":"bg-rose-50 text-rose-600"}`}>{income?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</div>
    <div className="min-w-0 flex-1"><div className="truncate font-bold text-gray-900">{row.description}</div><div className="flex flex-wrap gap-x-2 text-[11px] text-gray-400"><span>{categoryLabel(row.category)}</span><span>{String(row.transaction_date).slice(0,10)}</span>{project&&<span>{project.projectId} · {project.title}</span>}{row.invoice_id&&<span>{row.invoice_id}</span>}{row.inventory_name&&<span>{row.inventory_name} +{row.inventory_quantity}</span>}</div></div>
    <div className={`shrink-0 text-sm font-black ${income?"text-emerald-600":"text-rose-600"}`}>{income?"+":"−"}{money(row.amount)}</div>
    <button onClick={onDelete} className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 size={15}/></button>
  </div>;
}
