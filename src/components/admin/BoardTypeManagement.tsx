/**
 * Admin Panel: Board Type Configuration with Sizes
 * Allows admin to manage board types with sizes, print sides, laminations, and finish options
 */

'use client';

import React, { useState } from 'react';
import { BoardType, PrintSide, Lamination, FinishOption, SizeOption, PriceOption } from '@/types/cardPrinting';
import { AdminBoardTypeConfig } from '@/types/adminCardPrinting';

interface BoardTypeManagementProps {
  boardTypes: BoardType[];
  onSave: (config: AdminBoardTypeConfig) => Promise<void>;
  onAddNew: (config: AdminBoardTypeConfig) => Promise<void>;
}

export const BoardTypeManagement: React.FC<BoardTypeManagementProps> = ({
  boardTypes,
  onSave,
  onAddNew,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'edit' | 'create'>('list');
  const [selectedBoardType, setSelectedBoardType] = useState<BoardType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState<AdminBoardTypeConfig>({
    boardType: {
      name: '',
      label: '',
      description: '',
      gsm: 300,
      basePrice: 0,
      quantityPricing: [],
      isActive: true,
    },
    sizes: [],
    printSides: [],
    laminations: [],
    finishOptions: [],
  });

  const handleEditBoardType = (boardType: BoardType) => {
    setSelectedBoardType(boardType);
    setFormData({
      boardType: {
        id: boardType.id,
        name: boardType.name,
        label: boardType.label,
        description: boardType.description,
        gsm: boardType.gsm,
        basePrice: boardType.basePrice,
        quantityPricing: boardType.quantityPricing,
        isActive: boardType.isActive,
      },
      sizes: boardType.sizes,
      printSides: boardType.printSides,
      laminations: boardType.laminations,
      finishOptions: boardType.finishOptions,
    });
    setActiveTab('edit');
  };

  const handleCreateNew = () => {
    setSelectedBoardType(null);
    setFormData({
      boardType: {
        name: '',
        label: '',
        description: '',
        gsm: 300,
        basePrice: 0,
        quantityPricing: [],
        isActive: true,
      },
      sizes: [],
      printSides: [],
      laminations: [],
      finishOptions: [],
    });
    setActiveTab('create');
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (selectedBoardType) {
        await onSave(formData);
        setMessage({ type: 'success', text: 'Board type updated successfully!' });
      } else {
        await onAddNew(formData);
        setMessage({ type: 'success', text: 'Board type created successfully!' });
      }
      setActiveTab('list');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Size management handlers
  const addSize = () => {
    const newSize: SizeOption = {
      id: `size-${Date.now()}`,
      name: '',
      label: '',
      dimensions: { width: 89, height: 51, unit: 'mm' },
      basePrice: 0,
      quantityPricing: [],
    };
    setFormData({
      ...formData,
      sizes: [...formData.sizes, newSize],
    });
  };

  const updateSize = (index: number, updates: Partial<SizeOption>) => {
    const updated = [...formData.sizes];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, sizes: updated });
  };

  const removeSize = (index: number) => {
    setFormData({
      ...formData,
      sizes: formData.sizes.filter((_, i) => i !== index),
    });
  };

  const addPrintSide = () => {
    const newPrintSide: PrintSide = {
      id: `ps-${Date.now()}`,
      name: 'one-side',
      label: 'One Side Print',
      basePrice: 0,
      quantityPricing: [],
    };
    setFormData({
      ...formData,
      printSides: [...formData.printSides, newPrintSide],
    });
  };

  const updatePrintSide = (index: number, updates: Partial<PrintSide>) => {
    const updated = [...formData.printSides];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, printSides: updated });
  };

  const removePrintSide = (index: number) => {
    setFormData({
      ...formData,
      printSides: formData.printSides.filter((_, i) => i !== index),
    });
  };

  const addLamination = () => {
    const newLamination: Lamination = {
      id: `lam-${Date.now()}`,
      name: 'none',
      label: 'No Lamination',
      basePrice: 0,
      quantityPricing: [],
    };
    setFormData({
      ...formData,
      laminations: [...formData.laminations, newLamination],
    });
  };

  const updateLamination = (index: number, updates: Partial<Lamination>) => {
    const updated = [...formData.laminations];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, laminations: updated });
  };

  const removeLamination = (index: number) => {
    setFormData({
      ...formData,
      laminations: formData.laminations.filter((_, i) => i !== index),
    });
  };

  const addFinishOption = () => {
    const newFinish: FinishOption = {
      id: `fin-${Date.now()}`,
      name: '',
      label: '',
      basePrice: 0,
      quantityPricing: [],
    };
    setFormData({
      ...formData,
      finishOptions: [...formData.finishOptions, newFinish],
    });
  };

  const updateFinishOption = (index: number, updates: Partial<FinishOption>) => {
    const updated = [...formData.finishOptions];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, finishOptions: updated });
  };

  const removeFinishOption = (index: number) => {
    setFormData({
      ...formData,
      finishOptions: formData.finishOptions.filter((_, i) => i !== index),
    });
  };

  const addQuantityPricing = (section: 'boardType' | 'size' | 'printSide' | 'lamination' | 'finish', index?: number) => {
    const newPricing: PriceOption = {
      minQuantity: 100,
      maxQuantity: null,
      price: 0,
    };

    if (section === 'boardType') {
      setFormData({
        ...formData,
        boardType: {
          ...formData.boardType,
          quantityPricing: [...formData.boardType.quantityPricing, newPricing],
        },
      });
    } else if (section === 'size' && index !== undefined) {
      updateSize(index, {
        quantityPricing: [...formData.sizes[index].quantityPricing, newPricing],
      });
    } else if (section === 'printSide' && index !== undefined) {
      updatePrintSide(index, {
        quantityPricing: [...formData.printSides[index].quantityPricing, newPricing],
      });
    } else if (section === 'lamination' && index !== undefined) {
      updateLamination(index, {
        quantityPricing: [...formData.laminations[index].quantityPricing, newPricing],
      });
    } else if (section === 'finish' && index !== undefined) {
      updateFinishOption(index, {
        quantityPricing: [...formData.finishOptions[index].quantityPricing, newPricing],
      });
    }
  };

  return (
    <div className="admin-board-type-management p-6">
      {message && (
        <div
          className={`mb-4 p-4 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="tabs mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded ${
            activeTab === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          Board Types
        </button>
      </div>

      {activeTab === 'list' && (
        <div>
          <button
            onClick={handleCreateNew}
            className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            + Add New Board Type
          </button>

          <div className="grid gap-4">
            {boardTypes.map((bt) => (
              <div
                key={bt.id}
                className="p-4 border rounded hover:shadow-lg transition cursor-pointer"
                onClick={() => handleEditBoardType(bt)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{bt.label}</h3>
                    <p className="text-gray-600">{bt.gsm}gsm - {bt.description}</p>
                    <div className="text-sm text-gray-500 mt-2">
                      Base Price: ${bt.basePrice.toFixed(2)} | Sizes: {bt.sizes.length} |
                      Print Sides: {bt.printSides.length} | Laminations: {bt.laminations.length} | Finishes: {bt.finishOptions.length}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded ${bt.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {bt.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'edit' || activeTab === 'create') && (
        <div className="form-container max-w-4xl">
          <h2 className="text-2xl font-bold mb-6">
            {selectedBoardType ? 'Edit Board Type' : 'Create New Board Type'}
          </h2>

          {/* Board Type Basic Info */}
          <section className="mb-8 p-4 border rounded bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Board Type Details</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2 font-medium">Name</label>
                <input
                  type="text"
                  value={formData.boardType.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      boardType: { ...formData.boardType, name: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., art-board-300"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Display Label</label>
                <input
                  type="text"
                  value={formData.boardType.label}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      boardType: { ...formData.boardType, label: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., 300gsm Art Board"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Description</label>
              <textarea
                value={formData.boardType.description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    boardType: { ...formData.boardType, description: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border rounded"
                rows={2}
                placeholder="Board characteristics and details"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 font-medium">GSM</label>
                <input
                  type="number"
                  value={formData.boardType.gsm}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      boardType: { ...formData.boardType, gsm: parseInt(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Base Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.boardType.basePrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      boardType: { ...formData.boardType, basePrice: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium">Status</label>
                <select
                  value={formData.boardType.isActive ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      boardType: { ...formData.boardType, isActive: e.target.value === 'active' },
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Quantity Pricing for Board Type */}
            <div className="mt-4">
              <h4 className="font-medium mb-2">Quantity-based Pricing</h4>
              {formData.boardType.quantityPricing.map((pricing, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    type="number"
                    value={pricing.minQuantity}
                    onChange={(e) => {
                      const updated = [...formData.boardType.quantityPricing];
                      updated[idx].minQuantity = parseInt(e.target.value);
                      setFormData({
                        ...formData,
                        boardType: { ...formData.boardType, quantityPricing: updated },
                      });
                    }}
                    className="w-24 px-2 py-1 border rounded"
                    placeholder="Min Qty"
                  />
                  <input
                    type="number"
                    value={pricing.maxQuantity || ''}
                    onChange={(e) => {
                      const updated = [...formData.boardType.quantityPricing];
                      updated[idx].maxQuantity = e.target.value ? parseInt(e.target.value) : null;
                      setFormData({
                        ...formData,
                        boardType: { ...formData.boardType, quantityPricing: updated },
                      });
                    }}
                    className="w-24 px-2 py-1 border rounded"
                    placeholder="Max Qty"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={pricing.price}
                    onChange={(e) => {
                      const updated = [...formData.boardType.quantityPricing];
                      updated[idx].price = parseFloat(e.target.value);
                      setFormData({
                        ...formData,
                        boardType: { ...formData.boardType, quantityPricing: updated },
                      });
                    }}
                    className="flex-1 px-2 py-1 border rounded"
                    placeholder="Price ($)"
                  />
                  <button
                    onClick={() => {
                      const updated = formData.boardType.quantityPricing.filter(
                        (_, i) => i !== idx
                      );
                      setFormData({
                        ...formData,
                        boardType: { ...formData.boardType, quantityPricing: updated },
                      });
                    }}
                    className="px-2 py-1 bg-red-500 text-white rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => addQuantityPricing('boardType')}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
              >
                + Add Price Tier
              </button>
            </div>
          </section>

          {/* Sizes */}
          <section className="mb-8 p-4 border rounded bg-teal-50">
            <h3 className="text-lg font-semibold mb-4">Card Sizes</h3>
            {formData.sizes.map((size, idx) => (
              <div key={idx} className="mb-4 p-3 border rounded bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Size {idx + 1}</h4>
                  <button
                    onClick={() => removeSize(idx)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-sm mb-1">Size Name</label>
                    <input
                      type="text"
                      value={size.name}
                      onChange={(e) => updateSize(idx, { name: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="e.g., standard"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Display Label</label>
                    <input
                      type="text"
                      value={size.label}
                      onChange={(e) => updateSize(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="e.g., Standard (89×51mm)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-sm mb-1">Width</label>
                    <input
                      type="number"
                      value={size.dimensions.width}
                      onChange={(e) =>
                        updateSize(idx, {
                          dimensions: { ...size.dimensions, width: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Height</label>
                    <input
                      type="number"
                      value={size.dimensions.height}
                      onChange={(e) =>
                        updateSize(idx, {
                          dimensions: { ...size.dimensions, height: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Unit</label>
                    <select
                      value={size.dimensions.unit}
                      onChange={(e) =>
                        updateSize(idx, {
                          dimensions: {
                            ...size.dimensions,
                            unit: e.target.value as 'mm' | 'inch' | 'cm',
                          },
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="block text-sm mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={size.basePrice}
                    onChange={(e) => updateSize(idx, { basePrice: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>

                {/* Quantity Pricing */}
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">Quantity Pricing</label>
                  {size.quantityPricing.map((pricing, priceIdx) => (
                    <div key={priceIdx} className="flex gap-1 mb-1">
                      <input
                        type="number"
                        value={pricing.minQuantity}
                        onChange={(e) => {
                          const updated = [...formData.sizes];
                          updated[idx].quantityPricing[priceIdx].minQuantity = parseInt(
                            e.target.value
                          );
                          setFormData({ ...formData, sizes: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Min"
                      />
                      <input
                        type="number"
                        value={pricing.maxQuantity || ''}
                        onChange={(e) => {
                          const updated = [...formData.sizes];
                          updated[idx].quantityPricing[priceIdx].maxQuantity = e.target.value
                            ? parseInt(e.target.value)
                            : null;
                          setFormData({ ...formData, sizes: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Max"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.price}
                        onChange={(e) => {
                          const updated = [...formData.sizes];
                          updated[idx].quantityPricing[priceIdx].price = parseFloat(e.target.value);
                          setFormData({ ...formData, sizes: updated });
                        }}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="Price"
                      />
                      <button
                        onClick={() => {
                          const updated = [...formData.sizes];
                          updated[idx].quantityPricing = updated[idx].quantityPricing.filter(
                            (_, i) => i !== priceIdx
                          );
                          setFormData({ ...formData, sizes: updated });
                        }}
                        className="px-2 py-1 text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addQuantityPricing('size', idx)}
                    className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                  >
                    + Add Tier
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addSize}
              className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              + Add Size Option
            </button>
          </section>

          {/* Print Sides */}
          <section className="mb-8 p-4 border rounded bg-blue-50">
            <h3 className="text-lg font-semibold mb-4">Print Sides</h3>
            {formData.printSides.map((printSide, idx) => (
              <div key={idx} className="mb-4 p-3 border rounded bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Print Side {idx + 1}</h4>
                  <button
                    onClick={() => removePrintSide(idx)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-sm mb-1">Type</label>
                    <select
                      value={printSide.name}
                      onChange={(e) =>
                        updatePrintSide(idx, {
                          name: e.target.value as 'one-side' | 'double-side',
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="one-side">One Side</option>
                      <option value="double-side">Double Side</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Label</label>
                    <input
                      type="text"
                      value={printSide.label}
                      onChange={(e) => updatePrintSide(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={printSide.basePrice}
                    onChange={(e) =>
                      updatePrintSide(idx, { basePrice: parseFloat(e.target.value) })
                    }
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>

                {/* Quantity Pricing */}
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">Quantity Pricing</label>
                  {printSide.quantityPricing.map((pricing, priceIdx) => (
                    <div key={priceIdx} className="flex gap-1 mb-1">
                      <input
                        type="number"
                        value={pricing.minQuantity}
                        onChange={(e) => {
                          const updated = [...formData.printSides];
                          updated[idx].quantityPricing[priceIdx].minQuantity = parseInt(
                            e.target.value
                          );
                          setFormData({ ...formData, printSides: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Min"
                      />
                      <input
                        type="number"
                        value={pricing.maxQuantity || ''}
                        onChange={(e) => {
                          const updated = [...formData.printSides];
                          updated[idx].quantityPricing[priceIdx].maxQuantity = e.target.value
                            ? parseInt(e.target.value)
                            : null;
                          setFormData({ ...formData, printSides: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Max"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.price}
                        onChange={(e) => {
                          const updated = [...formData.printSides];
                          updated[idx].quantityPricing[priceIdx].price = parseFloat(e.target.value);
                          setFormData({ ...formData, printSides: updated });
                        }}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="Price"
                      />
                      <button
                        onClick={() => {
                          const updated = [...formData.printSides];
                          updated[idx].quantityPricing = updated[idx].quantityPricing.filter(
                            (_, i) => i !== priceIdx
                          );
                          setFormData({ ...formData, printSides: updated });
                        }}
                        className="px-2 py-1 text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addQuantityPricing('printSide', idx)}
                    className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                  >
                    + Add Tier
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addPrintSide}
              className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              + Add Print Side Option
            </button>
          </section>

          {/* Laminations */}
          <section className="mb-8 p-4 border rounded bg-purple-50">
            <h3 className="text-lg font-semibold mb-4">Laminations</h3>
            {formData.laminations.map((lamination, idx) => (
              <div key={idx} className="mb-4 p-3 border rounded bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Lamination {idx + 1}</h4>
                  <button
                    onClick={() => removeLamination(idx)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-sm mb-1">Type</label>
                    <select
                      value={lamination.name}
                      onChange={(e) =>
                        updateLamination(idx, {
                          name: e.target.value as Lamination['name'],
                        })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="none">None</option>
                      <option value="one-side-gloss">One Side - Gloss</option>
                      <option value="one-side-matte">One Side - Matte</option>
                      <option value="double-side-gloss">Both Sides - Gloss</option>
                      <option value="double-side-matte">Both Sides - Matte</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Label</label>
                    <input
                      type="text"
                      value={lamination.label}
                      onChange={(e) => updateLamination(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lamination.basePrice}
                    onChange={(e) =>
                      updateLamination(idx, { basePrice: parseFloat(e.target.value) })
                    }
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>

                {/* Quantity Pricing */}
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">Quantity Pricing</label>
                  {lamination.quantityPricing.map((pricing, priceIdx) => (
                    <div key={priceIdx} className="flex gap-1 mb-1">
                      <input
                        type="number"
                        value={pricing.minQuantity}
                        onChange={(e) => {
                          const updated = [...formData.laminations];
                          updated[idx].quantityPricing[priceIdx].minQuantity = parseInt(
                            e.target.value
                          );
                          setFormData({ ...formData, laminations: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Min"
                      />
                      <input
                        type="number"
                        value={pricing.maxQuantity || ''}
                        onChange={(e) => {
                          const updated = [...formData.laminations];
                          updated[idx].quantityPricing[priceIdx].maxQuantity = e.target.value
                            ? parseInt(e.target.value)
                            : null;
                          setFormData({ ...formData, laminations: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Max"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.price}
                        onChange={(e) => {
                          const updated = [...formData.laminations];
                          updated[idx].quantityPricing[priceIdx].price = parseFloat(e.target.value);
                          setFormData({ ...formData, laminations: updated });
                        }}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="Price"
                      />
                      <button
                        onClick={() => {
                          const updated = [...formData.laminations];
                          updated[idx].quantityPricing = updated[idx].quantityPricing.filter(
                            (_, i) => i !== priceIdx
                          );
                          setFormData({ ...formData, laminations: updated });
                        }}
                        className="px-2 py-1 text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addQuantityPricing('lamination', idx)}
                    className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                  >
                    + Add Tier
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addLamination}
              className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              + Add Lamination Option
            </button>
          </section>

          {/* Finish Options */}
          <section className="mb-8 p-4 border rounded bg-orange-50">
            <h3 className="text-lg font-semibold mb-4">Finish Options</h3>
            {formData.finishOptions.map((finish, idx) => (
              <div key={idx} className="mb-4 p-3 border rounded bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Finish Option {idx + 1}</h4>
                  <button
                    onClick={() => removeFinishOption(idx)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-sm mb-1">Name</label>
                    <input
                      type="text"
                      value={finish.name}
                      onChange={(e) => updateFinishOption(idx, { name: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="e.g., emboss-edges"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Label</label>
                    <input
                      type="text"
                      value={finish.label}
                      onChange={(e) => updateFinishOption(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="e.g., Embossed Edges"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={finish.basePrice}
                    onChange={(e) =>
                      updateFinishOption(idx, { basePrice: parseFloat(e.target.value) })
                    }
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>

                {/* Quantity Pricing */}
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">Quantity Pricing</label>
                  {finish.quantityPricing.map((pricing, priceIdx) => (
                    <div key={priceIdx} className="flex gap-1 mb-1">
                      <input
                        type="number"
                        value={pricing.minQuantity}
                        onChange={(e) => {
                          const updated = [...formData.finishOptions];
                          updated[idx].quantityPricing[priceIdx].minQuantity = parseInt(
                            e.target.value
                          );
                          setFormData({ ...formData, finishOptions: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Min"
                      />
                      <input
                        type="number"
                        value={pricing.maxQuantity || ''}
                        onChange={(e) => {
                          const updated = [...formData.finishOptions];
                          updated[idx].quantityPricing[priceIdx].maxQuantity = e.target.value
                            ? parseInt(e.target.value)
                            : null;
                          setFormData({ ...formData, finishOptions: updated });
                        }}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Max"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={pricing.price}
                        onChange={(e) => {
                          const updated = [...formData.finishOptions];
                          updated[idx].quantityPricing[priceIdx].price = parseFloat(e.target.value);
                          setFormData({ ...formData, finishOptions: updated });
                        }}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="Price"
                      />
                      <button
                        onClick={() => {
                          const updated = [...formData.finishOptions];
                          updated[idx].quantityPricing = updated[idx].quantityPricing.filter(
                            (_, i) => i !== priceIdx
                          );
                          setFormData({ ...formData, finishOptions: updated });
                        }}
                        className="px-2 py-1 text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addQuantityPricing('finish', idx)}
                    className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                  >
                    + Add Tier
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addFinishOption}
              className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              + Add Finish Option
            </button>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => setActiveTab('list')}
              className="px-6 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isLoading ? 'Saving...' : selectedBoardType ? 'Update Board Type' : 'Create Board Type'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
