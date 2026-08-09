'use client';

/**
 * Multi Prints – Customer Configurator
 * Single unified view: board type dropdown → print side → lamination → quantity.
 * Real-time price updates. Sticky price bar on mobile, inline card on desktop.
 */

import React, { useState, useMemo } from 'react';
import {
  MultiPrintsBoardType,
  MultiPrintsSelection,
  MultiPrintsPriceBreakdown,
  PriceTier,
  PricingMode,
} from '@/types/multiPrints';

// ─── Pricing helpers (inline — no extra import needed) ────────────────────────

function resolvePrice(qty: number, mode: PricingMode, unitPrice: number, tiers: PriceTier[]): number {
  if (mode === 'unit') return unitPrice;
  if (!tiers || tiers.length === 0) return unitPrice;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let match = sorted[0];
  for (const tier of sorted) {
    if (qty >= tier.minQty) match = tier;
  }
  return match.price;
}

function calcBreakdown(
  qty: number,
  board: MultiPrintsBoardType,
  printSideId: string,
  laminationId: string
): MultiPrintsPriceBreakdown {
  const ps = board.printSides.find(p => p.id === printSideId);
  const lam = board.laminations.find(l => l.id === laminationId);

  const boardBasePrice = resolvePrice(qty, board.basePricingMode, board.baseUnitPrice, board.baseTiers);
  const printSidePrice = ps ? resolvePrice(qty, ps.pricingMode, ps.unitPrice, ps.tiers) : 0;
  const laminationPrice = lam ? resolvePrice(qty, lam.pricingMode, lam.unitPrice, lam.tiers) : 0;
  const unitTotal = boardBasePrice + printSidePrice + laminationPrice;

  return {
    boardBasePrice,
    printSidePrice,
    laminationPrice,
    unitTotal,
    grandTotal: unitTotal * qty,
  };
}

// ─── RadioCard ────────────────────────────────────────────────────────────────

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  sublabel?: string;
  onChange: (v: string) => void;
}
const RadioCard: React.FC<RadioCardProps> = ({ name, value, checked, label, sublabel, onChange }) => (
  <label
    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition select-none ${
      checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
    }`}
  >
    <input
      type="radio" name={name} value={value} checked={checked}
      onChange={() => onChange(value)}
      className="w-4 h-4 accent-indigo-600"
    />
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium ${checked ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
    {checked && <span className="text-indigo-500 text-xs font-semibold">✓ Selected</span>}
  </label>
);

// ─── Main Configurator ────────────────────────────────────────────────────────

interface MultiPrintsConfiguratorProps {
  boardTypes: MultiPrintsBoardType[];
  onAddToCart?: (selection: MultiPrintsSelection, breakdown: MultiPrintsPriceBreakdown) => void;
}

export const MultiPrintsConfigurator: React.FC<MultiPrintsConfiguratorProps> = ({
  boardTypes,
  onAddToCart,
}) => {
  const activeBoards = boardTypes.filter(b => b.isActive);

  const [selection, setSelection] = useState<MultiPrintsSelection>(() => {
    const first = activeBoards[0];
    return {
      boardTypeId: first?.id ?? '',
      printSideId: first?.printSides[0]?.id ?? '',
      laminationId: first?.laminations[0]?.id ?? '',
      quantity: 100,
    };
  });

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const currentBoard = useMemo(
    () => activeBoards.find(b => b.id === selection.boardTypeId),
    [activeBoards, selection.boardTypeId]
  );

  const pricing = useMemo<MultiPrintsPriceBreakdown | null>(() => {
    if (!currentBoard || !selection.printSideId || !selection.laminationId) return null;
    return calcBreakdown(selection.quantity, currentBoard, selection.printSideId, selection.laminationId);
  }, [selection, currentBoard]);

  const handleBoardChange = (boardTypeId: string) => {
    const board = activeBoards.find(b => b.id === boardTypeId);
    setSelection({
      boardTypeId,
      printSideId: board?.printSides[0]?.id ?? '',
      laminationId: board?.laminations[0]?.id ?? '',
      quantity: selection.quantity,
    });
  };

  const setQty = (qty: number) => setSelection({ ...selection, quantity: Math.max(1, qty) });

  if (activeBoards.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center text-gray-400">
        <p className="text-lg font-medium">No board types available</p>
        <p className="text-sm mt-1">Check back soon or contact us for a custom quote.</p>
      </div>
    );
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Multi Prints</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Choose your board type, printing options and lamination. Price updates instantly.
        </p>
      </div>

      <div className="px-5 pb-32 md:pb-6 space-y-7">

        {/* ── Board Type ──────────────────────────────────────────────────── */}
        <section>
          <label className="block text-sm font-bold text-gray-700 mb-2">Board Type</label>
          <select
            value={selection.boardTypeId}
            onChange={e => handleBoardChange(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 bg-white shadow-sm"
          >
            {activeBoards.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.gsm}gsm
              </option>
            ))}
          </select>
          {currentBoard?.description && (
            <p className="text-xs text-gray-400 mt-1.5">{currentBoard.description}</p>
          )}
        </section>

        {/* ── Print Sides ─────────────────────────────────────────────────── */}
        <section>
          <p className="text-sm font-bold text-gray-700 mb-2">Print Sides</p>
          {!currentBoard || currentBoard.printSides.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No print side options for this board type.</p>
          ) : (
            <div className="space-y-2">
              {currentBoard.printSides.map(ps => {
                const price = pricing
                  ? resolvePrice(selection.quantity, ps.pricingMode, ps.unitPrice, ps.tiers)
                  : null;
                return (
                  <RadioCard
                    key={ps.id}
                    name="printSide"
                    value={ps.id}
                    checked={selection.printSideId === ps.id}
                    label={ps.label}
                    sublabel={price !== null ? `+${fmt(price)} per unit` : undefined}
                    onChange={v => setSelection({ ...selection, printSideId: v })}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── Lamination ──────────────────────────────────────────────────── */}
        <section>
          <p className="text-sm font-bold text-gray-700 mb-2">Lamination</p>
          {!currentBoard || currentBoard.laminations.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No lamination options for this board type.</p>
          ) : (
            <div className="space-y-2">
              {currentBoard.laminations.map(lam => {
                const price = pricing
                  ? resolvePrice(selection.quantity, lam.pricingMode, lam.unitPrice, lam.tiers)
                  : null;
                return (
                  <RadioCard
                    key={lam.id}
                    name="lamination"
                    value={lam.id}
                    checked={selection.laminationId === lam.id}
                    label={lam.label}
                    sublabel={price !== null ? `+${fmt(price)} per unit` : undefined}
                    onChange={v => setSelection({ ...selection, laminationId: v })}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── Quantity ────────────────────────────────────────────────────── */}
        <section>
          <p className="text-sm font-bold text-gray-700 mb-2">Quantity</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty(selection.quantity - 10)}
              className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition"
            >
              −
            </button>
            <input
              type="number" min={1} value={selection.quantity}
              onChange={e => setQty(parseInt(e.target.value) || 1)}
              className="w-24 text-center px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={() => setQty(selection.quantity + 10)}
              className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition"
            >
              +
            </button>
            <span className="text-sm text-gray-400">units</span>
          </div>
        </section>

        {/* ── Inline price card (md+) ──────────────────────────────────────── */}
        {pricing && (
          <div className="hidden md:block mt-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6">
            <PricePanel
              pricing={pricing}
              quantity={selection.quantity}
              breakdownOpen={breakdownOpen}
              setBreakdownOpen={setBreakdownOpen}
              board={currentBoard}
              selection={selection}
              onAddToCart={onAddToCart}
            />
          </div>
        )}
      </div>

      {/* ── Sticky mobile price bar ──────────────────────────────────────────── */}
      {pricing && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-indigo-200 shadow-2xl z-40 px-4 pt-3 pb-safe">
          <PricePanel
            pricing={pricing}
            quantity={selection.quantity}
            breakdownOpen={breakdownOpen}
            setBreakdownOpen={setBreakdownOpen}
            board={currentBoard}
            selection={selection}
            onAddToCart={onAddToCart}
          />
        </div>
      )}
    </div>
  );
};

// ─── PricePanel (shared between mobile sticky + desktop inline) ───────────────

interface PricePanelProps {
  pricing: MultiPrintsPriceBreakdown;
  quantity: number;
  breakdownOpen: boolean;
  setBreakdownOpen: (v: boolean) => void;
  board?: MultiPrintsBoardType;
  selection: MultiPrintsSelection;
  onAddToCart?: (selection: MultiPrintsSelection, breakdown: MultiPrintsPriceBreakdown) => void;
}

const PricePanel: React.FC<PricePanelProps> = ({
  pricing, quantity, breakdownOpen, setBreakdownOpen, board, selection, onAddToCart,
}) => {
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const ps = board?.printSides.find(p => p.id === selection.printSideId);
  const lam = board?.laminations.find(l => l.id === selection.laminationId);

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm text-indigo-600 font-medium">
          Price per unit: <span className="font-bold">{fmt(pricing.unitTotal)}</span>
        </span>
        <span className="text-xs text-gray-400">{quantity} units</span>
      </div>
      <p className="text-3xl font-extrabold text-indigo-700 mb-3">{fmt(pricing.grandTotal)}</p>

      {/* Accordion breakdown */}
      <button
        type="button"
        onClick={() => setBreakdownOpen(!breakdownOpen)}
        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium mb-2 flex items-center gap-1"
      >
        {breakdownOpen ? '▾' : '▸'} {breakdownOpen ? 'Hide' : 'Show'} breakdown
      </button>
      {breakdownOpen && (
        <div className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 mb-3 border border-indigo-100 space-y-1">
          <div className="flex justify-between">
            <span>Board ({board?.name})</span>
            <span>{fmt(pricing.boardBasePrice)}/unit</span>
          </div>
          <div className="flex justify-between">
            <span>{ps?.label ?? 'Print Side'}</span>
            <span>{fmt(pricing.printSidePrice)}/unit</span>
          </div>
          <div className="flex justify-between">
            <span>{lam?.label ?? 'Lamination'}</span>
            <span>{fmt(pricing.laminationPrice)}/unit</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-gray-100 pt-1 mt-1">
            <span>Unit total</span>
            <span>{fmt(pricing.unitTotal)}</span>
          </div>
          <div className="flex justify-between font-bold text-indigo-700">
            <span>Grand total ({quantity} units)</span>
            <span>{fmt(pricing.grandTotal)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onAddToCart?.(selection, pricing)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition text-sm"
      >
        Add to Cart
      </button>
    </div>
  );
};

export default MultiPrintsConfigurator;
