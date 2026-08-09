/**
 * Customer Card Configurator
 * Single unified interface for customers to select board type, size, and options
 * with real-time price updates
 */

'use client';

import React, { useState, useMemo } from 'react';
import { BoardType, CustomerCardSelection, PricingBreakdown } from '@/types/cardPrinting';
import { pricingService } from '@/services/pricingService';

interface CardConfiguratorProps {
  boardTypes: BoardType[];
  onSelectionChange?: (selection: CustomerCardSelection, pricing: PricingBreakdown) => void;
}

export const CardConfigurator: React.FC<CardConfiguratorProps> = ({
  boardTypes,
  onSelectionChange,
}) => {
  const [selection, setSelection] = useState<CustomerCardSelection>({
    boardTypeId: boardTypes[0]?.id || '',
    sizeId: '', // NEW: Size selection
    quantity: 100,
    printSideId: '',
    laminationId: '',
    finishOptionId: undefined,
  });

  // Get currently selected board type
  const currentBoardType = useMemo(
    () => boardTypes.find((bt) => bt.id === selection.boardTypeId),
    [selection.boardTypeId, boardTypes]
  );

  // Get available options
  const availableSizes = useMemo(() => currentBoardType?.sizes || [], [currentBoardType]);
  const availablePrintSides = useMemo(() => currentBoardType?.printSides || [], [currentBoardType]);
  const availableLaminations = useMemo(
    () => currentBoardType?.laminations || [],
    [currentBoardType]
  );
  const availableFinishOptions = useMemo(
    () => currentBoardType?.finishOptions || [],
    [currentBoardType]
  );

  // Initialize selections if not set
  React.useEffect(() => {
    if (currentBoardType) {
      if (!selection.sizeId && availableSizes.length > 0) {
        setSelection((prev) => ({
          ...prev,
          sizeId: availableSizes[0].id,
        }));
      }
      if (!selection.printSideId && availablePrintSides.length > 0) {
        setSelection((prev) => ({
          ...prev,
          printSideId: availablePrintSides[0].id,
        }));
      }
      if (!selection.laminationId && availableLaminations.length > 0) {
        setSelection((prev) => ({
          ...prev,
          laminationId: availableLaminations[0].id,
        }));
      }
    }
  }, [currentBoardType, availableSizes, availablePrintSides, availableLaminations, selection.sizeId, selection.printSideId, selection.laminationId]);

  // Calculate pricing
  const pricing = useMemo(() => {
    if (
      !currentBoardType ||
      !selection.sizeId ||
      !selection.printSideId ||
      !selection.laminationId
    ) {
      return null;
    }

    const size = currentBoardType.sizes.find((s) => s.id === selection.sizeId);
    const printSide = currentBoardType.printSides.find((ps) => ps.id === selection.printSideId);
    const lamination = currentBoardType.laminations.find(
      (lam) => lam.id === selection.laminationId
    );
    const finishOption = selection.finishOptionId
      ? currentBoardType.finishOptions.find((fo) => fo.id === selection.finishOptionId)
      : undefined;

    if (!size || !printSide || !lamination) return null;

    return pricingService.calculatePriceBreakdown(
      selection,
      currentBoardType,
      size,
      printSide,
      lamination,
      finishOption
    );
  }, [selection, currentBoardType]);

  // Notify parent of changes
  React.useEffect(() => {
    if (pricing && onSelectionChange) {
      onSelectionChange(selection, pricing);
    }
  }, [selection, pricing, onSelectionChange]);

  const handleBoardTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBoardType = boardTypes.find((bt) => bt.id === e.target.value);
    setSelection({
      boardTypeId: e.target.value,
      sizeId: newBoardType?.sizes[0]?.id || '',
      quantity: selection.quantity,
      printSideId: newBoardType?.printSides[0]?.id || '',
      laminationId: newBoardType?.laminations[0]?.id || '',
      finishOptionId: undefined,
    });
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelection({ ...selection, sizeId: e.target.value });
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = parseInt(e.target.value) || 1;
    setSelection({ ...selection, quantity: qty });
  };

  const handlePrintSideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelection({ ...selection, printSideId: e.target.value });
  };

  const handleLaminationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelection({ ...selection, laminationId: e.target.value });
  };

  const handleFinishOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelection({
      ...selection,
      finishOptionId: value ? value : undefined,
    });
  };

  const currentSize = useMemo(
    () => availableSizes.find((s) => s.id === selection.sizeId),
    [availableSizes, selection.sizeId]
  );

  if (!currentBoardType || !pricing) {
    return <div className="text-center py-8">Loading configurator...</div>;
  }

  return (
    <div className="card-configurator max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Card Configurator</h2>

      <div className="space-y-6">
        {/* Board Type Selection */}
        <div>
          <label className="block text-lg font-semibold mb-2">Board Type</label>
          <select
            value={selection.boardTypeId}
            onChange={handleBoardTypeChange}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            {boardTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>
                {bt.label} - {bt.description}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mt-2">{currentBoardType.description}</p>
        </div>

        {/* Board Type Details */}
        <div className="bg-gray-50 p-4 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Weight</p>
              <p className="text-lg font-semibold">{currentBoardType.gsm} GSM</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Base Price</p>
              <p className="text-lg font-semibold">${currentBoardType.basePrice.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Size Selection */}
        {availableSizes.length > 0 && (
          <div>
            <label className="block text-lg font-semibold mb-2">Card Size</label>
            <select
              value={selection.sizeId}
              onChange={handleSizeChange}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              {availableSizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label} ({pricingService.getSizeDimensions(size)}) +${size.basePrice.toFixed(2)}
                </option>
              ))}
            </select>
            {currentSize && (
              <p className="text-sm text-gray-600 mt-2">
                Dimensions: {pricingService.getSizeDimensions(currentSize)}
              </p>
            )}
          </div>
        )}

        {/* Quantity Selection */}
        <div>
          <label className="block text-lg font-semibold mb-2">Quantity</label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              step="10"
              value={selection.quantity}
              onChange={handleQuantityChange}
              className="w-32 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <span className="text-sm text-gray-600">units</span>
          </div>
        </div>

        {/* Print Sides */}
        <div>
          <label className="block text-lg font-semibold mb-2">Print Sides</label>
          <div className="grid grid-cols-1 gap-2">
            {availablePrintSides.map((ps) => (
              <label key={ps.id} className="flex items-center p-3 border rounded cursor-pointer hover:bg-blue-50">
                <input
                  type="radio"
                  name="printSide"
                  value={ps.id}
                  checked={selection.printSideId === ps.id}
                  onChange={handlePrintSideChange}
                  className="w-4 h-4 mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium">{ps.label}</p>
                  <p className="text-sm text-gray-600">+${ps.basePrice.toFixed(2)}/unit</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Laminations */}
        <div>
          <label className="block text-lg font-semibold mb-2">Lamination</label>
          <div className="grid grid-cols-1 gap-2">
            {availableLaminations.map((lam) => (
              <label key={lam.id} className="flex items-center p-3 border rounded cursor-pointer hover:bg-purple-50">
                <input
                  type="radio"
                  name="lamination"
                  value={lam.id}
                  checked={selection.laminationId === lam.id}
                  onChange={handleLaminationChange}
                  className="w-4 h-4 mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium">{lam.label}</p>
                  <p className="text-sm text-gray-600">+${lam.basePrice.toFixed(2)}/unit</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Finish Options */}
        {availableFinishOptions.length > 0 && (
          <div>
            <label className="block text-lg font-semibold mb-2">Finish Options (Optional)</label>
            <div className="grid grid-cols-1 gap-2">
              <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-orange-50">
                <input
                  type="radio"
                  name="finishOption"
                  value=""
                  checked={!selection.finishOptionId}
                  onChange={handleFinishOptionChange}
                  className="w-4 h-4 mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium">No Additional Finish</p>
                </div>
              </label>

              {availableFinishOptions.map((fo) => (
                <label key={fo.id} className="flex items-center p-3 border rounded cursor-pointer hover:bg-orange-50">
                  <input
                    type="radio"
                    name="finishOption"
                    value={fo.id}
                    checked={selection.finishOptionId === fo.id}
                    onChange={handleFinishOptionChange}
                    className="w-4 h-4 mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{fo.label}</p>
                    <p className="text-sm text-gray-600">+${fo.basePrice.toFixed(2)}/unit</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
          <h3 className="text-lg font-semibold mb-4">Price Breakdown</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Board Type:</span>
              <span>${pricing.boardTypePrice.toFixed(2)}/unit</span>
            </div>
            {pricing.sizePrice > 0 && (
              <div className="flex justify-between">
                <span>Size:</span>
                <span>${pricing.sizePrice.toFixed(2)}/unit</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Print Sides:</span>
              <span>${pricing.printSidePrice.toFixed(2)}/unit</span>
            </div>
            <div className="flex justify-between">
              <span>Lamination:</span>
              <span>${pricing.laminationPrice.toFixed(2)}/unit</span>
            </div>
            {pricing.finishOptionPrice > 0 && (
              <div className="flex justify-between">
                <span>Finish Options:</span>
                <span>${pricing.finishOptionPrice.toFixed(2)}/unit</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-semibold text-base">
              <span>Price per Unit:</span>
              <span>${pricing.totalUnitPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Total Price */}
          <div className="mt-4 p-4 bg-white rounded border-2 border-blue-300">
            <div className="text-center">
              <p className="text-gray-600">Total for {selection.quantity} units</p>
              <p className="text-3xl font-bold text-blue-600">${pricing.totalPrice.toFixed(2)}</p>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button className="w-full mt-4 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
            Add to Cart
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gray-100 p-4 rounded text-sm text-gray-700">
          <p>
            <strong>Your Selection:</strong> {selection.quantity} × {currentBoardType.label}{' '}
            {currentSize && `(${pricingService.getSizeDimensions(currentSize)}) `}
            with {availablePrintSides.find((ps) => ps.id === selection.printSideId)?.label},{' '}
            {availableLaminations.find((lam) => lam.id === selection.laminationId)?.label}
            {selection.finishOptionId &&
              ` and ${availableFinishOptions.find((fo) => fo.id === selection.finishOptionId)?.label}`}
          </p>
        </div>
      </div>
    </div>
  );
};
