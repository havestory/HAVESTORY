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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useGetSettings } from '@workspace/api-client-react';
import { captureElement } from '@/lib/html2canvas-capture';
import JSZip from 'jszip';

interface OrderItem {
  id: string;
  values: Record<string, string>;
}

interface Column {
  id: string;
  label: string;
  isNumeric: boolean;
}

interface ProcurementTypography {
  headerSize: number;
  valueSize: number;
  footerSize: number;
}

const PROCUREMENT_TYPOGRAPHY_KEY = 'havestory.procurement.typography';
const DEFAULT_PROCUREMENT_TYPOGRAPHY: ProcurementTypography = {
  headerSize: 8,
  valueSize: 10,
  footerSize: 9,
};

export default function Procurement() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const printRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<'A4' | 'A5'>('A4');
  const [typography, setTypography] = useState<ProcurementTypography>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROCUREMENT_TYPOGRAPHY;
    try {
      const saved = window.localStorage.getItem(PROCUREMENT_TYPOGRAPHY_KEY);
      if (!saved) return DEFAULT_PROCUREMENT_TYPOGRAPHY;
      const parsed = JSON.parse(saved) as Partial<ProcurementTypography>;
      return {
        headerSize: Number.isFinite(parsed.headerSize) ? Number(parsed.headerSize) : DEFAULT_PROCUREMENT_TYPOGRAPHY.headerSize,
        valueSize: Number.isFinite(parsed.valueSize) ? Number(parsed.valueSize) : DEFAULT_PROCUREMENT_TYPOGRAPHY.valueSize,
        footerSize: Number.isFinite(parsed.footerSize) ? Number(parsed.footerSize) : DEFAULT_PROCUREMENT_TYPOGRAPHY.footerSize,
      };
    } catch {
      return DEFAULT_PROCUREMENT_TYPOGRAPHY;
    }
  });
  
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

  const saveTypography = () => {
    try {
      window.localStorage.setItem(PROCUREMENT_TYPOGRAPHY_KEY, JSON.stringify(typography));
      toast({ title: 'Font sizes saved', description: 'Your Procurement table font sizes will be used in future previews and JPG exports.' });
    } catch {
      toast({ title: 'Could not save font sizes', description: 'The current sizes will still apply to this document.', variant: 'destructive' });
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

    // Collect every .no-print-capture element so we can zero them out before
    // capture. CSS display:none is unreliable on <col> elements and leaves a
    // ghost gap in table-layout:fixed tables, causing alignment shifts in the
    // downloaded image. We manually collapse width/padding and restore after.
    const noPrint = Array.from(
      documentElement.querySelectorAll<HTMLElement>('.no-print-capture')
    );
    type SavedStyle = { el: HTMLElement; display: string; width: string; padding: string; overflow: string; minWidth: string };
    const saved: SavedStyle[] = noPrint.map(el => ({
      el,
      display: el.style.display,
      width: el.style.width,
      padding: el.style.padding,
      overflow: el.style.overflow,
      minWidth: el.style.minWidth,
    }));

    const restoreNoPrint = () => {
      saved.forEach(({ el, display, width, padding, overflow, minWidth }) => {
        el.style.display = display;
        el.style.width = width;
        el.style.padding = padding;
        el.style.overflow = overflow;
        el.style.minWidth = minWidth;
      });
    };

    const downloadBlob = (blob: Blob, filename: string) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    };

    const canvasToJpg = (source: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
      source.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the generated canvas as a JPG.'));
      }, 'image/jpeg', 0.92);
    });

    try {
      toast({ title: "Generating Image", description: "Please wait while we prepare your order request..." });

      // Collapse all UI-only elements before is-capturing so their space
      // is gone before scrollHeight is measured and the clone is made.
      noPrint.forEach(el => {
        el.style.display = 'none';
        el.style.width = '0';
        el.style.minWidth = '0';
        el.style.padding = '0';
        el.style.overflow = 'hidden';
      });

      documentElement.classList.add('is-capturing');
      
      // Ensure all input and textarea values are mirrored to HTML attributes
      // so html2canvas correctly serializes and renders them without truncation.
      documentElement.querySelectorAll<HTMLInputElement>('input').forEach(input => {
        input.setAttribute('value', input.value);
      });
      documentElement.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(textarea => {
        textarea.textContent = textarea.value;
      });

      // Two frames: first lets layout recalculate after collapsing no-print
      // elements, second lets any CSS transitions settle.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const width = format === 'A4' ? 794 : 559;
      const baseHeight = format === 'A4' ? 1123 : 794;
      const documentHeight = Math.max(baseHeight, documentElement.scrollHeight);
      const canvas = await captureElement(documentElement, {
        width,
        height: documentHeight,
        scale: 2,
        backgroundColor: '#ffffff',
        overflowVisible: true,
      });
      if (!canvas.width || !canvas.height) throw new Error('The generated canvas is empty.');

      const scaleFactor = canvas.width / width;
      const pageHeight = Math.max(1, Math.round(baseHeight * scaleFactor));
      const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeight));
      const safeName = `${orderInfo.orderNo}_${(supplier.name || 'Order').replace(/[^a-z0-9_-]+/gi, '_')}`;

      if (pageCount === 1) {
        downloadBlob(await canvasToJpg(canvas), `${safeName}.jpg`);
        toast({ title: "Success", description: "Order request downloaded as JPG." });
      } else {
        const zip = new JSZip();
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = pageHeight;
          const pageContext = pageCanvas.getContext('2d');
          if (!pageContext) throw new Error('The browser could not prepare a page canvas.');
          pageContext.fillStyle = '#ffffff';
          pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageContext.drawImage(canvas, 0, -pageIndex * pageHeight);
          const pageBlob = await canvasToJpg(pageCanvas);
          zip.file(`${safeName}_page_${pageIndex + 1}.jpg`, pageBlob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        downloadBlob(zipBlob, `${safeName}_${format}_${pageCount}_pages.zip`);
        toast({ title: "Success", description: `Long order downloaded as a ZIP with ${pageCount} ${format} JPG pages.` });
      }
    } catch (error) {
      console.error('JPG generation failed:', error);
      toast({ title: "Error", description: "Failed to generate image. Please try again.", variant: "destructive" });
    } finally {
      documentElement.classList.remove('is-capturing');
      restoreNoPrint();
    }
  };

  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block";
  const inputClass = "rounded-none border-border h-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-secondary";
  const isFilled = (value?: string) => Boolean(value?.trim());
  const supplierAddressLineCount = isFilled(supplier.address)
    ? supplier.address.split(/\r?\n/).length
    : 0;
  const remainingAddressLines = Math.max(0, 2 - Math.min(2, supplierAddressLineCount));
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
                <Textarea
                  value={supplier.address}
                  onChange={e => setSupplier({...supplier, address: e.target.value})}
                  placeholder="123, Main St, Pettah"
                  rows={2}
                  className={`${inputClass} h-auto min-h-[72px] resize-y py-2 leading-relaxed`}
                />
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

          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Calculator className="w-4 h-4 text-secondary" /> Table Typography
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Adjust the table headings, typed entries, and footer text. Save to keep these sizes for future orders and JPG exports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className={labelClass}>Headings (px)</Label>
                  <Input
                    type="number"
                    min={6}
                    max={20}
                    step={1}
                    value={typography.headerSize}
                    onChange={e => setTypography(current => ({ ...current, headerSize: Math.min(20, Math.max(6, Number(e.target.value) || 6)) }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Typed entries (px)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={24}
                    step={1}
                    value={typography.valueSize}
                    onChange={e => setTypography(current => ({ ...current, valueSize: Math.min(24, Math.max(7, Number(e.target.value) || 7)) }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={labelClass}>Footer text (px)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={18}
                    step={1}
                    value={typography.footerSize}
                    onChange={e => setTypography(current => ({ ...current, footerSize: Math.min(18, Math.max(7, Number(e.target.value) || 7)) }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-[10px] text-muted-foreground leading-relaxed">Recommended: 8px headings, 10px entries, and 9px footer text.</p>
                <Button type="button" onClick={saveTypography} className="rounded-none h-9 px-4 text-[10px] font-bold uppercase tracking-widest">
                  Save Font Sizes
                </Button>
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
                <div className="procurement-order-meta" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {/* ORDER REQUEST badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px', backgroundColor: '#0F1B2D', padding: '6px 14px', marginBottom: '14px', lineHeight: 1 }}>
                    <span style={{ fontSize: '11px', lineHeight: 1, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#C9A84C' }}>Order Request</span>
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
                  {Array.from({ length: remainingAddressLines }, (_, index) => (
                    <div key={`address-guide-${index}`} className="procurement-field-line" aria-label="Additional address handwriting line" />
                  ))}
                  {isFilled(supplier.contact) ? (
                    <p className="procurement-supplier-line" style={{ color: '#475569' }}>{supplier.contact}</p>
                  ) : (
                    <div className="procurement-field-line" aria-label="Contact handwriting line" />
                  )}
                </div>
              </div>

              {/* Items Table — bordered spreadsheet grid */}
              <div className="flex-1">
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    {/* # column */}
                    <col style={{ width: '26px' }} />
                    {columns.map(col => (
                      <col key={col.id} style={{ width: col.id === 'desc' ? '42%' : undefined }} />
                    ))}
                    {/* actions column — NO width set so display:none fully collapses it */}
                    <col className="no-print-capture" />
                  </colgroup>
                  <thead>
                    {/* Clean light header — no dark background */}
                    <tr style={{ backgroundColor: '#F8FAFC' }}>
                      <th style={{ padding: '6px 4px', fontSize: '7px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', border: '1px solid #CBD5E1', textAlign: 'center' }}>#</th>
                      {columns.map(col => (
                        <th
                          key={col.id}
                          style={{ padding: '6px 6px', fontSize: `${typography.headerSize}px`, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', textAlign: col.isNumeric ? 'right' : 'left', border: '1px solid #CBD5E1' }}
                          className="group/col relative"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: col.isNumeric ? 'flex-end' : 'flex-start' }}>
                            <div
                              role="textbox"
                              aria-label={`${col.label || 'Column'} header`}
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={e => updateColumnLabel(col.id, e.currentTarget.textContent?.trim() ?? '')}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
                              style={{ color: '#0F1B2D', fontSize: `${typography.headerSize}px`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: col.isNumeric ? 'right' : 'left', outline: 'none', cursor: 'text', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                              {col.label}
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover/col:opacity-100 no-print-capture transition-opacity">
                              <button type="button" aria-label={`Duplicate ${col.label || 'column'}`} onClick={() => duplicateColumn(col.id)} style={{ color: '#0F1B2D', opacity: 0.4 }}>
                                <Copy className="w-2 h-2" />
                              </button>
                              <button type="button" aria-label={`Remove ${col.label || 'column'}`} onClick={() => removeColumn(col.id)} style={{ color: '#ef4444' }}>
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="no-print-capture" style={{ width: '40px', border: '1px solid #CBD5E1' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="group">
                        {/* Row number */}
                        <td style={{ padding: '3px 4px', fontSize: `${typography.valueSize}px`, lineHeight: 1.5, color: '#94A3B8', fontWeight: 600, border: '1px solid #E2E8F0', textAlign: 'center', verticalAlign: 'top' }}>
                          {index + 1}
                        </td>
                        {columns.map(col => {
                          const value = item.values[col.id] ?? '';
                          const isDesc = col.id === 'desc';
                          return (
                            <td key={col.id} style={{ padding: '2px 5px', border: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                              {isDesc ? (
                                /* Textarea for description — supports up to 75 000 characters,
                                   grows vertically with content */
                                <>
                                  <textarea
                                    value={value}
                                    onChange={e => {
                                      updateItem(item.id, col.id, e.target.value);
                                      // auto-resize: reset then expand to scrollHeight
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onFocus={e => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    maxLength={75000}
                                    rows={1}
                                    aria-label={`Description row ${index + 1}`}
                                    style={{ color: '#0F1B2D', WebkitTextFillColor: '#0F1B2D', backgroundColor: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', fontSize: `${typography.valueSize}px`, fontFamily: 'inherit', lineHeight: 1.5, minHeight: `${Math.ceil(typography.valueSize * 1.5)}px`, padding: 0, overflow: 'hidden', display: 'block' }}
                                  />
                                  <span
                                    className="procurement-capture-value procurement-capture-value--description"
                                    aria-hidden="true"
                                    style={{ fontSize: `${typography.valueSize}px`, lineHeight: 1.5 }}
                                  >
                                    {value}
                                  </span>
                                </>
                              ) : (
                                /* Plain <input> with WebkitTextFillColor to prevent browser/Tailwind
                                   -webkit-text-fill-color from making text invisible */
                                <>
                                  <input
                                    type="text"
                                    inputMode={col.isNumeric ? 'decimal' : 'text'}
                                    value={value}
                                    onChange={e => updateItem(item.id, col.id, e.target.value)}
                                    aria-label={`${col.label || 'Field'} row ${index + 1}`}
                                    style={{ color: '#0F1B2D', WebkitTextFillColor: '#0F1B2D', backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', width: '100%', fontSize: `${typography.valueSize}px`, fontFamily: 'inherit', padding: 0, textAlign: col.isNumeric ? 'right' : 'left', display: 'block' }}
                                  />
                                  <span
                                    className={`procurement-capture-value${col.isNumeric ? ' procurement-capture-value--numeric' : ''}`}
                                    aria-hidden="true"
                                    style={{ fontSize: `${typography.valueSize}px`, lineHeight: 1.5, textAlign: col.isNumeric ? 'right' : 'left' }}
                                  >
                                    {value}
                                  </span>
                                </>
                              )}
                            </td>
                          );
                        })}
                        <td className="no-print-capture" style={{ border: '1px solid #E2E8F0', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                            <button type="button" aria-label="Duplicate row" onClick={() => duplicateRow(item.id)} className="text-gray-400 hover:text-primary">
                              <Copy className="w-3 h-3" />
                            </button>
                            <button type="button" aria-label="Remove row" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3 h-3" />
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
                        <p style={{ fontSize: `${typography.footerSize}px`, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '4px' }}>Notes</p>
                        <p style={{ fontSize: `${typography.footerSize}px`, color: '#475569', lineHeight: 1.5, fontStyle: 'italic' }}>"{orderInfo.note}"</p>
                      </>
                    )}
                  </div>
                  {/* Grand Total box */}
                  <div className="procurement-grand-total-box" style={{ minWidth: '180px', border: '1.5px solid #0F1B2D', padding: '12px 16px' }}>
                    <p style={{ fontSize: `${typography.footerSize}px`, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#000000', marginBottom: '8px' }}>Grand Total</p>
                    {grandTotal > 0 ? (
                      <p style={{ fontSize: '22px', fontWeight: 900, color: '#000000', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        Rs. {grandTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <div className="procurement-grand-total-line" aria-label="Grand total handwriting line" style={{ marginTop: '10px' }} />
                    )}
                  </div>
                </div>

                <div className="procurement-handwriting-panel" style={{ marginTop: '20px', border: '1px dashed #CBD5E1', padding: '14px 16px', backgroundColor: '#FAFBFC' }}>
                  <p style={{ fontSize: `${typography.footerSize}px`, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B', marginBottom: '4px' }}>Shop Notes</p>
                  <p style={{ fontSize: `${typography.footerSize}px`, color: '#94A3B8', marginBottom: '8px' }}>Additional notes for handwriting</p>
                  {renderWritingLines(4, 'procurement-ruled-area--notes')}
                </div>

                {/* Footer bar */}
                <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ height: '1px', flex: 1, backgroundColor: '#E2E8F0' }} />
                  <p style={{ fontSize: `${Math.max(7, typography.footerSize - 1)}px`, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#CBD5E1' }}>Powered by HAVESTORY Studio OS</p>
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
