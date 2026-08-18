import { useState, useEffect, useRef } from 'react';
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
import { useGetSettings } from '@workspace/api-client-react';
import { captureElement } from '@/lib/html2canvas-capture';

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
  const { data: settings } = useGetSettings();
  const printRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<'A4' | 'A5'>('A4');
  
  const [supplier, setSupplier] = useState({
    name: '',
    address: '',
    contact: ''
  });

  // Keep this blank until the Settings query resolves so no hardcoded business
  // address or contact details flash before the saved values arrive.
  const [business, setBusiness] = useState({
    name: '',
    address: '',
    contact: ''
  });

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    const contactParts = [s.phone, s.email].filter((value: unknown): value is string => Boolean(value));
    setBusiness({
      name: typeof s.businessName === 'string' ? s.businessName : '',
      address: typeof s.address === 'string' ? s.address : '',
      contact: contactParts.join(' / ')
    });
  }, [settings]);

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
    { id: crypto.randomUUID(), values: { desc: '', qty: '', price: '', total: '' } }
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
    columns.forEach(c => newValues[c.id] = '');
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
        
        // Only calculate the total when both source fields are filled.
        // Leaving either field empty keeps the total empty for handwriting.
        if (colId === 'qty' || colId === 'price') {
          const qty = updatedValues['qty']?.trim() ?? '';
          const price = updatedValues['price']?.trim() ?? '';
          if (qty !== '' && price !== '' && Number.isFinite(Number(qty)) && Number.isFinite(Number(price))) {
            updatedValues['total'] = (Number(qty) * Number(price)).toFixed(2);
          } else {
            updatedValues['total'] = '';
          }
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
    const documentElement = printRef.current;
    if (!documentElement) return;

    try {
      toast({ title: "Generating Image", description: "Please wait while we prepare your order request..." });

      documentElement.classList.add('is-capturing');
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      const width = format === 'A4' ? 794 : 559;
      const baseHeight = format === 'A4' ? 1123 : 794;
      const height = Math.max(baseHeight, documentElement.scrollHeight);
      const canvas = await captureElement(documentElement, {
        width,
        height,
        scale: 2,
        backgroundColor: '#ffffff',
        overflowVisible: true,
      });

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('The browser could not encode the generated canvas as a JPG.');

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${orderInfo.orderNo}_${supplier.name || 'Order'}.jpg`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      toast({ title: "Success", description: "Order request downloaded as JPG." });
    } catch (error) {
      console.error('JPG generation failed:', error);
      toast({ title: "Error", description: "Failed to generate image. Please try again.", variant: "destructive" });
    } finally {
      documentElement.classList.remove('is-capturing');
    }
  };

  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block";
  const inputClass = "rounded-none border-border h-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-secondary";
  const isFilled = (value?: string) => Boolean(value?.trim());
  const renderWritingLines = (count: number, className = '') => (
    <div className={`procurement-ruled-area ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <span key={index} />)}
    </div>
  );
  const businessHasDetails = Object.values(business).some(isFilled);

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
                padding: '0',
                backgroundColor: 'white',
                color: '#0F1B2D',
                boxShadow: '0 4px 32px rgba(0,0,0,0.13)',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                fontFamily: 'Arial, Helvetica, sans-serif',
                border: '1px solid #E2E8F0',
              }}
              className={`procurement-document procurement-document--${format.toLowerCase()} text-black`}
            >
              {/* Gold top accent bar */}
              <div style={{ height: '4px', backgroundColor: '#C9A84C', width: '100%', flexShrink: 0 }} />

              {/* Inner padded area */}
              <div style={{ padding: format === 'A4' ? '40px 44px 36px' : '28px 30px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>

              {/* Document Header */}
              <div className="procurement-document__header grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8 mb-8">
                <div className="min-w-0">
                  {businessHasDetails ? (
                    <>
                      {isFilled(business.name) ? (
                        <h2 className="procurement-brand-mark mb-1 break-words" style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0F1B2D' }}>{business.name}</h2>
                      ) : (
                        <div className="procurement-field-line procurement-field-line--brand mb-2" />
                      )}
                      <div className="break-words" style={{ fontSize: '10.5px', color: '#64748B', lineHeight: 1.65 }}>
                        {isFilled(business.address) ? <p>{business.address}</p> : <div className="procurement-field-line" />}
                        {isFilled(business.contact) ? <p>{business.contact}</p> : <div className="procurement-field-line" />}
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '6px' }}>Business / Shop details</p>
                      {renderWritingLines(5, 'procurement-ruled-area--header')}
                    </>
                  )}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {/* ORDER REQUEST badge */}
                  <div style={{ display: 'inline-block', backgroundColor: '#0F1B2D', padding: '6px 14px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#C9A84C' }}>Order Request</span>
                  </div>
                  <div style={{ fontSize: '10.5px', lineHeight: 1.8, color: '#64748B' }}>
                    <p><span style={{ fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '6px', fontSize: '9px' }}>No:</span><span style={{ color: '#0F1B2D', fontWeight: 600 }}>{orderInfo.orderNo || '—'}</span></p>
                    <p><span style={{ fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '6px', fontSize: '9px' }}>Date:</span><span style={{ color: '#0F1B2D', fontWeight: 600 }}>{orderInfo.date || '—'}</span></p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: '#E2E8F0', marginBottom: '20px' }} />

              {/* Supplier / Shop header */}
              <div className="procurement-supplier-card" style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', marginBottom: '24px', borderLeft: '3px solid #C9A84C' }}>
                <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '10px' }}>Shop Name / Address / Contact</p>
                <div className="procurement-supplier-fields" style={{ fontSize: '12px' }}>
                  {isFilled(supplier.name) ? (
                    <p className="procurement-supplier-line" style={{ fontWeight: 700, color: '#0F1B2D' }}>{supplier.name}</p>
                  ) : (
                    <div className="procurement-field-line" aria-label="Shop name handwriting line" />
                  )}
                  {isFilled(supplier.address) ? (
                    <p className="procurement-supplier-line" style={{ color: '#475569' }}>{supplier.address}</p>
                  ) : (
                    <div className="procurement-field-line" aria-label="Address handwriting line" />
                  )}
                  <div className="procurement-field-line" aria-label="Additional address handwriting line" />
                  {isFilled(supplier.contact) ? (
                    <p className="procurement-supplier-line" style={{ color: '#475569' }}>{supplier.contact}</p>
                  ) : (
                    <div className="procurement-field-line" aria-label="Contact handwriting line" />
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: '#0F1B2D' }}>
                      <th className="text-left w-12" style={{ padding: '10px 8px 10px 0', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9A84C' }}>#</th>
                      {columns.map(col => (
                        <th
                          key={col.id}
                          style={{ width: col.id === 'desc' ? '42%' : undefined, padding: '10px 8px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9A84C', textAlign: col.isNumeric ? 'right' : 'left' }}
                          className={`group/col relative ${col.id === 'desc' ? 'min-w-[148px]' : ''}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: col.isNumeric ? 'flex-end' : 'flex-start' }}>
                            <Input
                              aria-label={`${col.label || (col.id === 'desc' ? 'Item Description' : 'Column')} header`}
                              value={col.label}
                              placeholder={col.id === 'desc' ? 'Item Description' : 'New Column'}
                              onChange={e => updateColumnLabel(col.id, e.target.value)}
                              className={`h-6 min-w-0 border-none focus-visible:ring-0 bg-transparent px-0 text-[9px] font-bold uppercase tracking-widest w-full ${col.isNumeric ? 'text-right' : 'text-left'}`}
                              style={{ color: '#C9A84C', letterSpacing: '0.12em' }}
                            />
                            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover/col:opacity-100 no-print-capture transition-opacity">
                              <button type="button" aria-label={`Duplicate ${col.label || 'column'}`} onClick={() => duplicateColumn(col.id)} style={{ color: '#C9A84C', opacity: 0.6 }}>
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                              <button type="button" aria-label={`Remove ${col.label || 'column'}`} onClick={() => removeColumn(col.id)} style={{ color: '#ef4444' }}>
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="w-8 no-print-capture" style={{ backgroundColor: '#0F1B2D' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="group" style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '8px 8px 8px 0', fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{index + 1}</td>
                        {columns.map(col => {
                          const value = item.values[col.id] ?? '';
                          return (
                            <td key={col.id} style={{ padding: '4px 8px' }} className={col.id === 'desc' ? 'min-w-[148px]' : ''}>
                              <div className={`procurement-cell-field ${col.isNumeric ? 'procurement-cell-field--numeric' : ''}`}>
                                <Input
                                  type="text"
                                  inputMode={col.isNumeric ? 'decimal' : 'text'}
                                  value={value}
                                  onChange={e => updateItem(item.id, col.id, e.target.value)}
                                  placeholder=""
                                  aria-label={`${col.label || (col.id === 'desc' ? 'Item Description' : 'Item field')} row ${index + 1}`}
                                  className={`h-7 border-none focus-visible:ring-0 bg-transparent px-0 text-[11px] font-bold ${col.isNumeric ? 'text-right tabular-nums' : 'text-left'}`}
                                  style={{ color: '#0F1B2D' }}
                                />
                                {!isFilled(value) && <div className="procurement-field-line" aria-hidden="true" />}
                              </div>
                            </td>
                          );
                        })}
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
              <div className="procurement-document__footer" style={{ marginTop: '28px', borderTop: '2px solid #0F1B2D', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{ maxWidth: '55%' }}>
                    {orderInfo.note && (
                      <>
                        <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '4px' }}>Notes</p>
                        <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5, fontStyle: 'italic' }}>"{orderInfo.note}"</p>
                      </>
                    )}
                  </div>
                  {/* Grand Total box */}
                  <div style={{ minWidth: '180px', border: '1.5px solid #0F1B2D', padding: '12px 16px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '6px' }}>Grand Total</p>
                    {grandTotal > 0 ? (
                      <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F1B2D', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        Rs. {grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <div className="procurement-grand-total-line" aria-label="Grand total handwriting line" style={{ marginTop: '8px' }} />
                    )}
                  </div>
                </div>

                <div className="procurement-handwriting-panel" style={{ marginTop: '20px', border: '1px dashed #CBD5E1', padding: '14px 16px', backgroundColor: '#FAFBFC' }}>
                  <p style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B', marginBottom: '4px' }}>Shop Notes</p>
                  <p style={{ fontSize: '9px', color: '#94A3B8', marginBottom: '8px' }}>Additional notes for handwriting</p>
                  {renderWritingLines(4, 'procurement-ruled-area--notes')}
                </div>

                {/* Footer bar */}
                <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ height: '1px', flex: 1, backgroundColor: '#E2E8F0' }} />
                  <p style={{ fontSize: '7.5px', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#CBD5E1' }}>Powered by HAVESTORY Studio OS</p>
                  <div style={{ height: '1px', flex: 1, backgroundColor: '#E2E8F0' }} />
                </div>
              </div>

              </div>{/* end inner padded area */}
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
