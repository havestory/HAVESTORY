'use client';

/**
 * Multi Prints – Admin Panel
 * List view → click row or "+ Add" → full form wizard per board type.
 * Each section (Print Sides, Laminations, Base Price) supports Unit or Qty-Range pricing.
 * "Save & Add Next" saves and opens a fresh form so admin can enter board types one after another.
 */

import React, { useState, useCallback } from 'react';
import {
  MultiPrintsBoardType,
  PrintSideOption,
  LaminationOption,
  PriceTier,
  PricingMode,
  LaminationName,
} from '@/types/multiPrints';

// ─── helpers ──────────────────────────────────────────────────────────────────

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const emptyTier = (): PriceTier => ({ minQty: 1, maxQty: null, price: 0 });

const emptyPrintSide = (): PrintSideOption => ({
  id: uid(),
  name: 'one-side',
  label: 'One Side Print',
  pricingMode: 'unit',
  unitPrice: 0,
  tiers: [],
});

const emptyLamination = (): LaminationOption => ({
  id: uid(),
  name: 'none',
  label: 'No Lamination',
  pricingMode: 'unit',
  unitPrice: 0,
  tiers: [],
});

const emptyBoard = (): MultiPrintsBoardType => ({
  id: uid(),
  name: '',
  gsm: 300,
  description: '',
  isActive: true,
  basePricingMode: 'unit',
  baseUnitPrice: 0,
  baseTiers: [],
  printSides: [],
  laminations: [],
});

// ─── PricingModeToggle ────────────────────────────────────────────────────────

interface PricingModeToggleProps {
  value: PricingMode;
  onChange: (m: PricingMode) => void;
}
const PricingModeToggle: React.FC<PricingModeToggleProps> = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 text-sm font-medium">
    <button
      type="button"
      onClick={() => onChange('unit')}
      className={`px-3 py-1 transition ${
        value === 'unit'
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      Unit Price
    </button>
    <button
      type="button"
      onClick={() => onChange('qty-range')}
      className={`px-3 py-1 border-l border-gray-300 transition ${
        value === 'qty-range'
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      Qty Range
    </button>
  </div>
);

// ─── TierEditor ───────────────────────────────────────────────────────────────

interface TierEditorProps {
  tiers: PriceTier[];
  onChange: (tiers: PriceTier[]) => void;
}
const TierEditor: React.FC<TierEditorProps> = ({ tiers, onChange }) => {
  const update = (i: number, patch: Partial<PriceTier>) => {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    onChange(next);
  };
  const remove = (i: number) => onChange(tiers.filter((_, idx) => idx !== i));
  const add = () => onChange([...tiers, emptyTier()]);

  return (
    <div className="mt-2">
      {tiers.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 text-xs text-gray-500 mb-1 px-1">
          <span>Min Qty</span><span>Max Qty</span><span>Price ($)</span><span />
        </div>
      )}
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 mb-1">
          <input
            type="number" min={1} value={t.minQty}
            onChange={e => update(i, { minQty: parseInt(e.target.value) || 1 })}
            className="px-2 py-1 border rounded text-sm"
            placeholder="Min"
          />
          <input
            type="number" min={1} value={t.maxQty ?? ''}
            onChange={e => update(i, { maxQty: e.target.value ? parseInt(e.target.value) : null })}
            className="px-2 py-1 border rounded text-sm"
            placeholder="Max (∞)"
          />
          <input
            type="number" min={0} step="0.01" value={t.price}
            onChange={e => update(i, { price: parseFloat(e.target.value) || 0 })}
            className="px-2 py-1 border rounded text-sm"
            placeholder="Price"
          />
          <button type="button" onClick={() => remove(i)}
            className="text-red-400 hover:text-red-600 px-1 text-lg leading-none">×</button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
        + Add Tier
      </button>
    </div>
  );
};

// ─── PriceBlock ───────────────────────────────────────────────────────────────

interface PriceBlockProps {
  mode: PricingMode;
  unitPrice: number;
  tiers: PriceTier[];
  onModeChange: (m: PricingMode) => void;
  onUnitPriceChange: (v: number) => void;
  onTiersChange: (tiers: PriceTier[]) => void;
}
const PriceBlock: React.FC<PriceBlockProps> = ({
  mode, unitPrice, tiers, onModeChange, onUnitPriceChange, onTiersChange,
}) => (
  <div className="mt-2">
    <div className="flex items-center gap-3 mb-2">
      <span className="text-sm font-medium text-gray-700">Pricing Mode</span>
      <PricingModeToggle value={mode} onChange={onModeChange} />
    </div>
    {mode === 'unit' ? (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Price per unit ($)</span>
        <input
          type="number" min={0} step="0.01" value={unitPrice}
          onChange={e => onUnitPriceChange(parseFloat(e.target.value) || 0)}
          className="w-32 px-2 py-1 border rounded text-sm"
        />
      </div>
    ) : (
      <TierEditor tiers={tiers} onChange={onTiersChange} />
    )}
  </div>
);

// ─── PrintSideCard ────────────────────────────────────────────────────────────

interface PrintSideCardProps {
  ps: PrintSideOption;
  onChange: (ps: PrintSideOption) => void;
  onRemove: () => void;
}
const PrintSideCard: React.FC<PrintSideCardProps> = ({ ps, onChange, onRemove }) => (
  <div className="mb-3 p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-semibold text-blue-700">Print Side Option</span>
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
    </div>
    <div className="grid grid-cols-2 gap-2 mb-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Type</label>
        <select
          value={ps.name}
          onChange={e => onChange({ ...ps, name: e.target.value as PrintSideOption['name'] })}
          className="w-full px-2 py-1 border rounded text-sm"
        >
          <option value="one-side">One Side Print</option>
          <option value="double-side">Double Side Print</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Label</label>
        <input
          type="text" value={ps.label}
          onChange={e => onChange({ ...ps, label: e.target.value })}
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Display label"
        />
      </div>
    </div>
    <PriceBlock
      mode={ps.pricingMode} unitPrice={ps.unitPrice} tiers={ps.tiers}
      onModeChange={m => onChange({ ...ps, pricingMode: m })}
      onUnitPriceChange={v => onChange({ ...ps, unitPrice: v })}
      onTiersChange={t => onChange({ ...ps, tiers: t })}
    />
  </div>
);

// ─── LaminationCard ───────────────────────────────────────────────────────────

interface LaminationCardProps {
  lam: LaminationOption;
  onChange: (lam: LaminationOption) => void;
  onRemove: () => void;
}
const LaminationCard: React.FC<LaminationCardProps> = ({ lam, onChange, onRemove }) => (
  <div className="mb-3 p-3 bg-white rounded-lg border border-purple-200 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-semibold text-purple-700">Lamination Option</span>
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
    </div>
    <div className="grid grid-cols-2 gap-2 mb-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Type</label>
        <select
          value={lam.name}
          onChange={e => onChange({ ...lam, name: e.target.value as LaminationName })}
          className="w-full px-2 py-1 border rounded text-sm"
        >
          <option value="none">No Lamination</option>
          <option value="one-side-gloss">One Side Gloss</option>
          <option value="one-side-matte">One Side Matte</option>
          <option value="double-side-gloss">Double Side Gloss</option>
          <option value="double-side-matte">Double Side Matte</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Label</label>
        <input
          type="text" value={lam.label}
          onChange={e => onChange({ ...lam, label: e.target.value })}
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Display label"
        />
      </div>
    </div>
    <PriceBlock
      mode={lam.pricingMode} unitPrice={lam.unitPrice} tiers={lam.tiers}
      onModeChange={m => onChange({ ...lam, pricingMode: m })}
      onUnitPriceChange={v => onChange({ ...lam, unitPrice: v })}
      onTiersChange={t => onChange({ ...lam, tiers: t })}
    />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface MultiPrintsAdminProps {
  boardTypes: MultiPrintsBoardType[];
  onSave: (bt: MultiPrintsBoardType) => void;
  onDelete?: (id: string) => void;
}

export const MultiPrintsAdmin: React.FC<MultiPrintsAdminProps> = ({
  boardTypes,
  onSave,
  onDelete,
}) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState<MultiPrintsBoardType>(emptyBoard());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openEdit = (bt: MultiPrintsBoardType) => {
    setForm({ ...bt });
    setView('form');
  };

  const openCreate = () => {
    setForm(emptyBoard());
    setView('form');
  };

  const save = useCallback(
    (andAddNext: boolean) => {
      const record: MultiPrintsBoardType = {
        ...form,
        updatedAt: new Date().toISOString(),
        createdAt: form.createdAt ?? new Date().toISOString(),
      };
      onSave(record);
      if (andAddNext) {
        setForm(emptyBoard());
        showToast('Board type saved! Add your next one.');
      } else {
        setView('list');
      }
    },
    [form, onSave]
  );

  // ─── section helpers ─────────────────────────────────────────────────────────

  const setPrintSide = (i: number, ps: PrintSideOption) => {
    const arr = [...form.printSides];
    arr[i] = ps;
    setForm({ ...form, printSides: arr });
  };
  const removePrintSide = (i: number) =>
    setForm({ ...form, printSides: form.printSides.filter((_, idx) => idx !== i) });

  const setLamination = (i: number, lam: LaminationOption) => {
    const arr = [...form.laminations];
    arr[i] = lam;
    setForm({ ...form, laminations: arr });
  };
  const removeLamination = (i: number) =>
    setForm({ ...form, laminations: form.laminations.filter((_, idx) => idx !== i) });

  // ─── list view ───────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Multi Prints</h2>
            <p className="text-sm text-gray-500">Manage board types, print sides, laminations and pricing</p>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm shadow"
          >
            + Add New Board Type
          </button>
        </div>

        {boardTypes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No board types yet.</p>
            <p className="text-sm mt-1">Click "+ Add New Board Type" to get started.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Board Type</th>
                  <th className="px-4 py-3 text-left">GSM</th>
                  <th className="px-4 py-3 text-left">Print Sides</th>
                  <th className="px-4 py-3 text-left">Laminations</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {boardTypes.map((bt) => (
                  <tr
                    key={bt.id}
                    onClick={() => openEdit(bt)}
                    className="hover:bg-indigo-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{bt.name}</td>
                    <td className="px-4 py-3 text-gray-600">{bt.gsm}gsm</td>
                    <td className="px-4 py-3 text-gray-600">{bt.printSides.length} option{bt.printSides.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-gray-600">{bt.laminations.length} option{bt.laminations.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bt.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {bt.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(bt); }}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(bt.id); }}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ─── form view ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          ✓ {toast}
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-800 mb-1">
        {form.createdAt ? 'Edit Board Type' : 'New Board Type'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">Fill in each section, then save or continue adding more board types.</p>

      {/* ── 1. Board Type Details ─────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-base font-bold text-gray-700 mb-4">① Board Type Details</h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="e.g. 300gsm Art Board"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">GSM</label>
            <input
              type="number" min={1} value={form.gsm}
              onChange={e => setForm({ ...form, gsm: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={form.description} rows={2}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
            placeholder="Brief description of this board type"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">Status</span>
          <button
            type="button"
            onClick={() => setForm({ ...form, isActive: !form.isActive })}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
              form.isActive
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-500 border-gray-300'
            }`}
          >
            {form.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>
      </section>

      {/* ── 2. Print Sides ────────────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-blue-800">② Print Sides</h3>
          <button
            type="button"
            onClick={() => setForm({ ...form, printSides: [...form.printSides, emptyPrintSide()] })}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
          >
            + Add Option
          </button>
        </div>
        {form.printSides.length === 0 && (
          <p className="text-sm text-blue-400 text-center py-4">No print side options yet. Click "+ Add Option".</p>
        )}
        {form.printSides.map((ps, i) => (
          <PrintSideCard
            key={ps.id} ps={ps}
            onChange={updated => setPrintSide(i, updated)}
            onRemove={() => removePrintSide(i)}
          />
        ))}
      </section>

      {/* ── 3. Laminations ───────────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-purple-50 rounded-xl border border-purple-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-purple-800">③ Laminations</h3>
          <button
            type="button"
            onClick={() => setForm({ ...form, laminations: [...form.laminations, emptyLamination()] })}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700"
          >
            + Add Option
          </button>
        </div>
        {form.laminations.length === 0 && (
          <p className="text-sm text-purple-400 text-center py-4">No lamination options yet. Click "+ Add Option".</p>
        )}
        {form.laminations.map((lam, i) => (
          <LaminationCard
            key={lam.id} lam={lam}
            onChange={updated => setLamination(i, updated)}
            onRemove={() => removeLamination(i)}
          />
        ))}
      </section>

      {/* ── 4. Base Price ─────────────────────────────────────────────────────── */}
      <section className="mb-8 p-5 bg-green-50 rounded-xl border border-green-200">
        <h3 className="text-base font-bold text-green-800 mb-3">④ Base Price (Board Material)</h3>
        <p className="text-xs text-green-600 mb-3">The base cost for this board type, before any options are added.</p>
        <PriceBlock
          mode={form.basePricingMode}
          unitPrice={form.baseUnitPrice}
          tiers={form.baseTiers}
          onModeChange={m => setForm({ ...form, basePricingMode: m })}
          onUnitPriceChange={v => setForm({ ...form, baseUnitPrice: v })}
          onTiersChange={t => setForm({ ...form, baseTiers: t })}
        />
      </section>

      {/* ── Action Bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setView('list')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Back to List
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => save(false)}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow"
          >
            Save Board Type
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow"
          >
            Save &amp; Add Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiPrintsAdmin;
