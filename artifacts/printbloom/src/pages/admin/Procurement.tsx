import { useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  FileText, 
  Building2, 
  User, 
  Calendar,
  Calculator,
  ChevronLeft,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface OrderItem {
  id: string;
  values: Record<string, string>;
}

interface Column {
  id: string;
  label: string;
  isNumeric: boolean;
}

export default function Procurement() {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<'A4' | 'A5'>('A4');
  
  const [supplier, setSupplier] = useState({
    name: '',
    address: '',
    contact: ''
  });

  const [business, setBusiness] = useState({
    name: 'HAVESTORY',
    address: 'No. 123, Studio Lane, Colombo, Sri Lanka',
    contact: '+94 77 123 4567 / info@havestory.lk'
  });

  const [orderInfo, setOrderInfo] = useState({
    orderNo: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const [columns, setColumns] = useState<Column[]>([
    { id: 'desc', label: 'Item Description', isNumeric: false },
    { id: 'qty', label: 'Qty', isNumeric: true },
    { id: 'price', label: 'Price', isNumeric: true },
    { id: 'total', label: 'Total', isNumeric: true },
  ]);

  const [items, setItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), values: { desc: '', qty: '1', price: '0', total: '0.00' } }
  ]);

  const addColumn = () => {
    const newId = `col_${Date.now()}`;
    setColumns([...columns, { id: newId, label: 'New Column', isNumeric: false }]);
    setItems(items.map(item => ({ ...item, values: { ...item.values, [newId]: '' } })));
  };

  const removeColumn = (id: string) => {
    if (columns.length > 1) {
      setColumns(columns.filter(c => c.id !== id));
      setItems(items.map(item => {
        const newValues = { ...item.values };
        delete newValues[id];
        return { ...item, values: newValues };
      }));
    }
  };

  const duplicateColumn = (id: string) => {
    const colToClone = columns.find(c => c.id === id);
    if (colToClone) {
      const index = columns.findIndex(c => c.id === id);
      const newId = `col_${Date.now()}`;
      const newCols = [...columns];
      newCols.splice(index + 1, 0, {
        ...colToClone,
        id: newId,
        label: `${colToClone.label} (Copy)`
      });
      setColumns(newCols);
      setItems(items.map(item => ({
        ...item,
        values: { ...item.values, [newId]: item.values[id] }
      })));
    }
  };

  const updateColumnLabel = (id: string, label: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, label } : c));
  };

  const addItem = () => {
    const newValues: Record<string, string> = {};
    columns.forEach(c => newValues[c.id] = c.isNumeric ? '0' : '');
    setItems([...items, { id: crypto.randomUUID(), values: newValues }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const duplicateRow = (id: string) => {
    const itemToClone = items.find(i => i.id === id);
    if (itemToClone) {
      const index = items.findIndex(i => i.id === id);
      const newItems = [...items];
      newItems.splice(index + 1, 0, {
        id: crypto.randomUUID(),
        values: { ...itemToClone.values }
      });
      setItems(newItems);
    }
  };

  const updateItem = (id: string, colId: string, value: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedValues = { ...item.values, [colId]: value };
        
        // Auto-calc total if qty and price exist
        if (colId === 'qty' || colId === 'price') {
          const q = parseFloat(updatedValues['qty']) || 0;
          const p = parseFloat(updatedValues['price']) || 0;
          updatedValues['total'] = (q * p).toFixed(2);
        }
        
        return { ...item, values: updatedValues };
      }
      return item;
    }));
  };

  const grandTotal = items.reduce((sum, item) => {
    const val = parseFloat(item.values['total']) || 0;
    return sum + val;
  }, 0);

  const downloadJPG = async () => {
    if (!printRef.current) return;
    
    try {
      toast({ title: "Generating Image", description: "Please wait while we prepare your order request..." });
      
      printRef.current.classList.add('is-capturing');
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `${orderInfo.orderNo}_${supplier.name || 'Order'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
      
      toast({ title: "Success", description: "Order request downloaded as JPG." });
    } catch (error) {
      console.error('Download error:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate image." });
    } finally {
      printRef.current?.classList.remove('is-capturing');
    }
  };

  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block";
  const inputClass = "rounded-none border-border h-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-secondary";

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Procurement Order</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate and download order requests for your suppliers.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-none border border-border">
            <Button 
              variant={format === 'A4' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setFormat('A4')}
              className="rounded-none h-8 text-[10px] font-bold uppercase tracking-widest px-4"
            >
              A4 Format
            </Button>
            <Button 
              variant={format === 'A5' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setFormat('A5')}
              className="rounded-none h-8 text-[10px] font-bold uppercase tracking-widest px-4"
            >
              A5 Format
            </Button>
          </div>
          <Button onClick={downloadJPG} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-bold uppercase tracking-widest text-xs px-6 gap-2">
            <Download className="w-4 h-4" /> Download JPG
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Editor Side */}
        <div className="xl:col-span-5 space-y-6">
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Building2 className="w-4 h-4 text-secondary" /> Supplier Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={labelClass}>Shop / Supplier Name</Label>
                <Input value={supplier.name} onChange={e => setSupplier({...supplier, name: e.target.value})} placeholder="e.g. Paper World Lanka" className={inputClass} />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Address</Label>
                <Input value={supplier.address} onChange={e => setSupplier({...supplier, address: e.target.value})} placeholder="123, Main St, Pettah" className={inputClass} />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Contact Info</Label>
                <Input value={supplier.contact} onChange={e => setSupplier({...supplier, contact: e.target.value})} placeholder="Phone or Email" className={inputClass} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-secondary" /> Order Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Order No</Label>
                  <Input value={orderInfo.orderNo} onChange={e => setOrderInfo({...orderInfo, orderNo: e.target.value})} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Date</Label>
                  <Input type="date" value={orderInfo.date} onChange={e => setOrderInfo({...orderInfo, date: e.target.value})} className={inputClass} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Special Note</Label>
                <Input value={orderInfo.note} onChange={e => setOrderInfo({...orderInfo, note: e.target.value})} placeholder="e.g. Please deliver by tomorrow morning" className={inputClass} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <User className="w-4 h-4 text-secondary" /> Your Business Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={labelClass}>Business Name</Label>
                <Input value={business.name} onChange={e => setBusiness({...business, name: e.target.value})} className={inputClass} />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Address</Label>
                <Input value={business.address} onChange={e => setBusiness({...business, address: e.target.value})} className={inputClass} />
              </div>
              <div className="space-y-2">
                <Label className={labelClass}>Contact</Label>
                <Input value={business.contact} onChange={e => setBusiness({...business, contact: e.target.value})} className={inputClass} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Side */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Document Preview</h3>
            <span className="text-[10px] text-muted-foreground font-medium">Auto-calculating totals</span>
          </div>
          
          <div className="bg-muted p-4 md:p-8 flex justify-center overflow-x-auto min-h-[800px]">
            {/* The Document to Capture */}
            <div 
              ref={printRef}
              style={{ 
                width: format === 'A4' ? '794px' : '559px', 
                minHeight: format === 'A4' ? '1123px' : '794px',
                padding: format === 'A4' ? '40px' : '28px',
                backgroundColor: 'white',
                color: '#1c1917',
                boxShadow: '0 0 40px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                fontFamily: 'Arial, Helvetica, sans-serif'
              }}
              className={`procurement-document procurement-document--${format.toLowerCase()} text-black`}
            >
              {/* Document Header */}
              <div className="procurement-document__header grid grid-cols-[1fr_auto] items-start gap-8 mb-10">
                <div className="min-w-0">
                  <h2 className="procurement-brand-mark text-2xl font-bold text-primary mb-2 tracking-tight">{business.name || 'Your Business'}</h2>
                  <div className="text-[11px] text-gray-600 leading-relaxed break-words">
                    <p>{business.address || 'Business address'}</p>
                    <p>{business.contact || 'Business contact'}</p>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <h1 className="text-xl font-bold uppercase tracking-[0.16em] text-gray-900 mb-4">Order Request</h1>
                  <div className="text-[11px] space-y-1 leading-relaxed">
                    <p><span className="font-bold text-gray-500 uppercase mr-2">No:</span>{orderInfo.orderNo || '—'}</p>
                    <p><span className="font-bold text-gray-500 uppercase mr-2">Date:</span>{orderInfo.date || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="procurement-supplier-card bg-gray-50 p-5 mb-8 border-l-4 border-primary">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Supplier / Shop</h3>
                <div className="grid grid-cols-[1.1fr_1fr] gap-6 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 break-words">{supplier.name || '(Shop Name)'}</p>
                    <p className="text-gray-600 mt-1 break-words">{supplier.address || '(Address)'}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-gray-600 break-words">{supplier.contact || '(Contact)'}</p>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-2">Please complete the handwriting fields below</p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-900">
                      <th className="text-left py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-12">#</th>
                      {columns.map(col => (
                        <th key={col.id} className={`${col.isNumeric ? 'text-right' : 'text-left'} py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 px-2 group/col relative`}>
                          <div className={`flex items-center gap-1 ${col.isNumeric ? 'justify-end' : 'justify-start'}`}>
                            <Input 
                              value={col.label} 
                              onChange={e => updateColumnLabel(col.id, e.target.value)}
                              className={`h-6 border-none focus-visible:ring-0 bg-transparent px-0 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-full ${col.isNumeric ? 'text-right' : 'text-left'}`}
                            />
                            <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 no-print-capture transition-opacity">
                            <button type="button" aria-label={`Duplicate ${col.label || 'column'}`} onClick={() => duplicateColumn(col.id)} className="text-gray-300 hover:text-primary">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <button type="button" aria-label={`Remove ${col.label || 'column'}`} onClick={() => removeColumn(col.id)} className="text-gray-300 hover:text-red-400">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="w-8 no-print-capture"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b border-gray-100 group">
                        <td className="py-3 text-xs text-gray-500">{index + 1}</td>
                        {columns.map(col => (
                          <td key={col.id} className="py-1 px-2">
                            <Input 
                              type="text"
                              inputMode={col.isNumeric ? 'decimal' : 'text'}
                              value={item.values[col.id]}
                              onChange={e => updateItem(item.id, col.id, e.target.value)}
                              placeholder={!col.isNumeric ? "Type..." : "0"}
                              className={`h-8 border-none focus-visible:ring-0 bg-transparent px-0 text-sm text-gray-900 ${col.isNumeric ? 'text-right font-bold tabular-nums' : 'text-left font-medium'} placeholder:text-gray-300`}
                            />
                          </td>
                        ))}
                        <td className="w-16 no-print-capture">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" aria-label="Duplicate row" onClick={() => duplicateRow(item.id)} className="text-gray-400 hover:text-primary">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" aria-label="Remove row" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="flex items-center gap-4 mt-4 no-print-capture">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={addItem}
                    className="rounded-none h-8 text-[9px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 hover:bg-primary/5"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Line Item
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={addColumn}
                    className="rounded-none h-8 text-[9px] font-bold uppercase tracking-widest text-secondary hover:text-secondary/80 hover:bg-secondary/5"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Add Column
                  </Button>
                </div>
              </div>

              {/* Totals & Footer */}
              <div className="procurement-document__footer mt-10 border-t-2 border-gray-900 pt-6">
                <div className="flex justify-between items-center mb-8">
                  <div className="max-w-[60%]">
                    {orderInfo.note && (
                      <>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes</h4>
                        <p className="text-xs text-gray-600 leading-relaxed italic">"{orderInfo.note}"</p>
                      </>
                    )}
                  </div>
                  <div className="w-48 space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 uppercase tracking-widest font-bold">
                      <span>Grand Total</span>
                      <span className="text-gray-900 text-lg font-serif">Rs. {grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="procurement-handwriting-panel mt-10 border border-dashed border-gray-300 p-4">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Supplier Confirmation</h4>
                    <span className="text-[9px] uppercase tracking-widest text-gray-400">For shop use</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[10px] text-gray-500">
                    <div><span className="font-bold uppercase tracking-widest">Received by</span><div className="procurement-write-line" /></div>
                    <div><span className="font-bold uppercase tracking-widest">Delivery date</span><div className="procurement-write-line" /></div>
                    <div><span className="font-bold uppercase tracking-widest">Shop contact</span><div className="procurement-write-line" /></div>
                    <div><span className="font-bold uppercase tracking-widest">Supplier ref.</span><div className="procurement-write-line" /></div>
                  </div>
                  <div className="mt-4 text-[10px] text-gray-500">
                    <span className="font-bold uppercase tracking-widest">Shop notes / handwriting</span>
                    <div className="procurement-ruled-area"><span /><span /><span /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mt-12">
                  <div className="border-t border-gray-300 pt-2 text-center">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Requested By</p>
                  </div>
                  <div className="border-t border-gray-300 pt-2 text-center">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">Authorized Signature</p>
                  </div>
                </div>
                
                <div className="mt-10 text-center">
                  <p className="text-[8px] uppercase tracking-[0.3em] text-gray-300 font-bold">Powered by HAVESTORY Studio OS</p>
                </div>
              </div>
            </div>
          </div>
          
          <style>{`
            @media screen {
              .no-print-capture {
                /* These buttons shouldn't be in the JPG but we need them in the UI */
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
