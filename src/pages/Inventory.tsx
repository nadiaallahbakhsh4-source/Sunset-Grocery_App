import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Edit2, Trash2, X, Package, Sparkles, Loader2, History, ArrowRight, Mic, MicOff, Barcode, Camera } from 'lucide-react';
import { Item, Settings, ItemHistoryEntry } from '../types';
import { cn } from '../lib/utils';
import { predictCategory } from '../services/geminiService';
import { translations } from '../lib/translations';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

interface InventoryProps {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  formatPrice: (amount: number) => string;
  settings: Settings;
}

const GROCERY_CATEGORIES = [
  "Atta, Dal & Rice",
  "Cooking Oil & Ghee",
  "Spices & Masala",
  "Sugar, Salt & Tea",
  "Snacks & Biscuits",
  "Beverages & Drinks",
  "Dairy & Bread",
  "Soaps & Shampoos",
  "Detergents & Cleaners",
  "Instant Noodles & Pasta",
  "Chocolates & Candies",
  "Dry Fruits & Nuts",
  "Others"
];

const UNIT_TYPES = [
  "pcs",
  "kg",
  "L",
  "g",
  "ml",
  "pkt",
  "btl",
  "box"
];

import { useFirebase } from '../components/FirebaseProvider';
import { saveData, deleteData } from '../lib/dataService';

export const Inventory: React.FC<InventoryProps> = ({ items, formatPrice, settings }) => {
  const { user } = useFirebase();
  const t = translations[settings.language] || translations.en;
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<Item | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  // Optical scanning state indicators
  const [isMainScannerOpen, setIsMainScannerOpen] = useState(false);
  const [isFormScannerOpen, setIsFormScannerOpen] = useState(false);
  const [isCameraCaptureOpen, setIsCameraCaptureOpen] = useState(false);
  const [scanAlert, setScanAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Item>>({
    name: '',
    description: '',
    category: GROCERY_CATEGORIES[0],
    stock: 0,
    costPrice: 0,
    sellPrice: 0,
    unit: UNIT_TYPES[0],
    isWeightBased: false,
    sackCount: 0,
    capacityPerSack: 0,
    sackUnit: 'kg',
    saleUnit: 'kg',
    pricePerSack: 0,
    isFixedRatio: false,
    allowBothModes: false,
    barcode: '',
  });

  const [packagingType, setPackagingType] = useState<'sack' | 'box' | 'loose'>('loose');
  const [isPredicting, setIsPredicting] = useState(false);

  const AUTO_POPULATE_MAP: Record<string, { category: string, unit: string, isWeightBased?: boolean, capacityPerSack?: number, sackUnit?: string, saleUnit?: string }> = {
    'Rice': { category: 'Atta, Dal & Rice', unit: 'kg', isWeightBased: true, capacityPerSack: 50, sackUnit: 'kg', saleUnit: 'kg' },
    'Basmati': { category: 'Atta, Dal & Rice', unit: 'kg', isWeightBased: true, capacityPerSack: 50, sackUnit: 'kg', saleUnit: 'kg' },
    'Flour': { category: 'Atta, Dal & Rice', unit: 'kg', isWeightBased: true, capacityPerSack: 20, sackUnit: 'kg', saleUnit: 'kg' },
    'Atta': { category: 'Atta, Dal & Rice', unit: 'kg', isWeightBased: true, capacityPerSack: 20, sackUnit: 'kg', saleUnit: 'kg' },
    'Sugar': { category: 'Sugar, Salt & Tea', unit: 'kg', isWeightBased: true, capacityPerSack: 50, sackUnit: 'kg', saleUnit: 'kg' },
    'Dal': { category: 'Atta, Dal & Rice', unit: 'kg', isWeightBased: true, capacityPerSack: 50, sackUnit: 'kg', saleUnit: 'kg' },
    'Oil': { category: 'Cooking Oil & Ghee', unit: 'L', isWeightBased: true, capacityPerSack: 16, sackUnit: 'L', saleUnit: 'L' },
    'Ghee': { category: 'Cooking Oil & Ghee', unit: 'kg', isWeightBased: true, capacityPerSack: 16, sackUnit: 'kg', saleUnit: 'kg' },
  };

  const handlePredictCategory = async () => {
    if (!formData.name || formData.name.length < 2) return;
    
    // Check local map first
    const nameLower = formData.name.toLowerCase();
    const matchedKey = Object.keys(AUTO_POPULATE_MAP).find(k => nameLower.includes(k.toLowerCase()));
    
    if (matchedKey) {
      const match = AUTO_POPULATE_MAP[matchedKey];
      setFormData(prev => ({ 
        ...prev, 
        category: match.category,
        unit: match.unit,
        isWeightBased: match.isWeightBased,
        capacityPerSack: match.capacityPerSack,
        sackUnit: match.sackUnit,
        saleUnit: match.saleUnit
      }));
      return;
    }

    setIsPredicting(true);
    const suggestedCategory = await predictCategory(formData.name, GROCERY_CATEGORIES);
    if (suggestedCategory) {
      setFormData(prev => ({ ...prev, category: suggestedCategory }));
    }
    setIsPredicting(false);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let stock = Number(formData.stock) || 0;
    let costPrice = Number(formData.costPrice) || 0;
    let sellPrice = Number(formData.sellPrice) || 0;
    let isWeightBased = packagingType !== 'loose';
    let sackCount = Number(formData.sackCount) || 0;
    let capacityPerSack = Number(formData.capacityPerSack) || 0;
    let sackUnit = formData.sackUnit || (packagingType === 'box' ? 'box' : 'sack');
    let saleUnit = formData.saleUnit || (packagingType === 'box' ? 'pcs' : 'kg');
    let pricePerSack = Number(formData.pricePerSack) || 0;
    let unit = formData.unit || (isWeightBased ? saleUnit : UNIT_TYPES[0]);

    if (isWeightBased) {
      stock = sackCount * capacityPerSack;
      unit = saleUnit;
    } else {
      sackCount = 0;
      capacityPerSack = 0;
      pricePerSack = 0;
      sackUnit = '';
      saleUnit = '';
    }

    const newItem: Item = {
      id: crypto.randomUUID(),
      name: formData.name || '',
      category: formData.category || GROCERY_CATEGORIES[0],
      stock,
      costPrice,
      sellPrice,
      soldCount: 0,
      unit,
      description: formData.description || '',
      isWeightBased,
      sackCount,
      capacityPerSack,
      sackUnit,
      saleUnit,
      pricePerSack,
      isFixedRatio: !!formData.isFixedRatio,
      allowBothModes: !!formData.allowBothModes,
      barcode: formData.barcode || '',
      history: [{
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        field: 'stock',
        oldValue: 0,
        newValue: stock,
        description: 'Initial stock'
      }]
    };
    await saveData(user.uid, 'items', newItem);
    setIsAdding(false);
    resetForm();
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !user) return;

    let stock = Number(formData.stock) || 0;
    let isWeightBased = packagingType !== 'loose';
    let sackCount = Number(formData.sackCount) || 0;
    let capacityPerSack = Number(formData.capacityPerSack) || 0;
    let sackUnit = formData.sackUnit || (packagingType === 'box' ? 'box' : 'sack');
    let saleUnit = formData.saleUnit || (packagingType === 'box' ? 'pcs' : 'kg');
    let pricePerSack = Number(formData.pricePerSack) || 0;
    let unit = formData.unit || (isWeightBased ? saleUnit : UNIT_TYPES[0]);

    if (isWeightBased) {
      stock = sackCount * capacityPerSack;
      unit = saleUnit;
    } else {
      sackCount = 0;
      capacityPerSack = 0;
      pricePerSack = 0;
      sackUnit = '';
      saleUnit = '';
    }

    const newHistory: ItemHistoryEntry[] = [...(editingItem.history || [])];
    const now = new Date().toISOString();

    if (stock !== editingItem.stock) {
      newHistory.push({
        id: crypto.randomUUID(),
        date: now,
        field: 'stock',
        oldValue: editingItem.stock,
        newValue: stock,
      });
    }

    if (Number(formData.costPrice) !== editingItem.costPrice) {
      newHistory.push({
        id: crypto.randomUUID(),
        date: now,
        field: 'costPrice',
        oldValue: editingItem.costPrice,
        newValue: Number(formData.costPrice),
      });
    }

    if (Number(formData.sellPrice) !== editingItem.sellPrice) {
      newHistory.push({
        id: crypto.randomUUID(),
        date: now,
        field: 'sellPrice',
        oldValue: editingItem.sellPrice,
        newValue: Number(formData.sellPrice),
      });
    }

    const updatedItem = { 
      ...editingItem, 
      ...formData, 
      stock,
      unit,
      isWeightBased,
      sackCount,
      capacityPerSack,
      sackUnit,
      saleUnit,
      pricePerSack,
      isFixedRatio: !!formData.isFixedRatio,
      allowBothModes: !!formData.allowBothModes,
      costPrice: Number(formData.costPrice),
      sellPrice: Number(formData.sellPrice),
      history: newHistory 
    } as Item;
    await saveData(user.uid, 'items', updatedItem);
    setEditingItem(null);
    resetForm();
  };

  const handleDeleteItem = (item: Item) => {
    setItemToDelete(item);
  };

  const confirmDelete = async () => {
    if (!user || !itemToDelete) return;
    try {
      if (!itemToDelete.id) {
        throw new Error("Item ID is undefined; cannot delete from database.");
      }
      await deleteData(user.uid, 'items', itemToDelete.id);
      setItemToDelete(null);
    } catch (error: any) {
      console.error("Failed to delete item:", error);
      alert(settings.language === 'es' ? `No se pudo eliminar el producto: ${error.message}` : `Failed to delete product: ${error.message}`);
      setItemToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      description: '',
      category: GROCERY_CATEGORIES[0], 
      stock: 0, 
      costPrice: 0, 
      sellPrice: 0, 
      unit: UNIT_TYPES[0],
      isWeightBased: false,
      sackCount: 0,
      capacityPerSack: 0,
      sackUnit: 'kg',
      saleUnit: 'kg',
      pricePerSack: 0,
      isFixedRatio: false,
      allowBothModes: false,
      barcode: '',
    });
    setPackagingType('loose');
  };

  const startEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: '',
      description: '',
      category: GROCERY_CATEGORIES[0],
      stock: 0,
      costPrice: 0,
      sellPrice: 0,
      unit: UNIT_TYPES[0],
      isWeightBased: false,
      sackCount: 0,
      capacityPerSack: 0,
      sackUnit: 'kg',
      saleUnit: 'kg',
      pricePerSack: 0,
      isFixedRatio: false,
      allowBothModes: false,
      ...item
    });
    if (!item.isWeightBased) {
      setPackagingType('loose');
    } else if (item.sackUnit === 'box' || item.sackUnit === 'carton') {
      setPackagingType('box');
    } else {
      setPackagingType('sack');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-light tracking-tight">{t.inventoryTitle.split(' ')[0]} <span className="font-medium text-blue-400">{t.inventoryTitle.split(' ').slice(1).join(' ')}</span></h1>
          <p className="text-white/60">{t.inventorySubtitle}</p>
        </div>
        <div className="flex flex-row gap-3 items-center">
          <button 
            onClick={() => setIsCameraCaptureOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 px-6 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition-transform active:scale-95 cursor-pointer"
          >
            <Camera className="h-5 w-5 text-orange-200" />
            <span>Add via Camera</span>
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            {t.addNewItem}
          </button>
        </div>
      </header>

      {/* Search & Barcode Scan Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input 
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 backdrop-blur-md outline-none transition-all focus:border-blue-500/50 focus:bg-white/10 text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setScanAlert(null);
            setIsMainScannerOpen(true);
          }}
          className="rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/15 px-6 py-4 flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 transition-all active:scale-95 text-sm font-bold uppercase tracking-widest cursor-pointer shadow-md shadow-orange-500/5"
        >
          <Barcode className="h-5 w-5" />
          <span>Scan to Lookup</span>
        </button>
      </div>

      {scanAlert && (
        <div className={cn(
          "rounded-2xl p-4 border flex items-center justify-between gap-3 text-xs font-medium animate-fade-in",
          scanAlert.type === 'success' 
            ? "bg-green-500/10 border-green-500/20 text-green-400" 
            : "bg-blue-500/10 border-blue-500/20 text-blue-400"
        )}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
            <span>{scanAlert.message}</span>
          </div>
          <button 
            onClick={() => setScanAlert(null)}
            className="text-[10px] uppercase tracking-widest font-black underline hover:no-underline opacity-65 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inventory List */}
      <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-white/40">
                <th className="px-6 py-4">{t.tableItem}</th>
                <th className="px-6 py-4">{t.tableCategory}</th>
                <th className="px-6 py-4">{t.tableStock}</th>
                <th className="px-6 py-4">{t.tableCostSell}</th>
                <th className="px-6 py-4 text-right">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <motion.tr 
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-white/5"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white/5 p-2 transition-colors group-hover:bg-blue-500/20">
                          <Package className={cn("h-5 w-5", item.stock <= 5 ? "text-yellow-500" : "text-blue-400")} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium flex flex-wrap items-center gap-1.5">
                            {item.name}
                            {item.isFixedRatio && (
                              <span className="px-1 text-[7px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                                Ratio Fixed
                              </span>
                            )}
                            {item.allowBothModes && (
                              <span className="px-1 text-[7px] font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                                Dual Mode
                              </span>
                            )}
                          </span>
                          {item.description && (
                            <span className="text-[10px] text-white/40 italic mt-0.5 truncate max-w-[220px]" title={item.description}>
                              {item.description}
                            </span>
                          )}
                          {item.barcode && (
                            <span className="text-[9px] font-mono tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-lg w-max mt-1 flex items-center gap-1">
                              <Barcode className="h-3 w-3" />
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={cn("font-bold", item.stock === 0 ? "text-red-500" : item.stock <= 5 ? "text-yellow-500" : "text-white")}>
                          {item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))} <span className="text-[10px] font-normal text-white/40">{item.unit}</span>
                        </span>
                        <span className="text-[10px] text-white/40">
                          {item.soldCount % 1 === 0 ? item.soldCount : Number(item.soldCount.toFixed(2))} {t.sold}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-white/40">{formatPrice(item.costPrice)} {t.historyCost}</span>
                        <span className="font-semibold text-green-400">{formatPrice(item.sellPrice)} {t.historyPrice}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setViewingHistoryItem(item)}
                          className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-orange-400"
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => startEdit(item)}
                          className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item)}
                          className="rounded-lg p-2 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-px divide-y divide-white/5">
          {filteredItems.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/5 p-3">
                  <Package className={cn("h-6 w-6", item.stock <= 5 ? "text-yellow-500" : "text-blue-400")} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold flex items-center gap-1.5 flex-wrap">
                    {item.name}
                    {item.isFixedRatio && (
                      <span className="px-1 py-px text-[7px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                        Ratio Fixed
                      </span>
                    )}
                    {item.allowBothModes && (
                      <span className="px-1 py-px text-[7px] font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                        Dual Mode
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 leading-none mb-1">{item.category}</p>
                  {item.description && (
                    <p className="text-[10px] text-white/30 italic truncate max-w-[150px]">{item.description}</p>
                  )}
                  {item.barcode && (
                    <div className="text-[9px] font-mono tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 rounded-md w-max mt-1 flex items-center gap-1">
                      <Barcode className="h-2.5 w-2.5" />
                      {item.barcode}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className={cn("text-lg font-black italic", item.stock === 0 ? "text-red-500" : item.stock <= 5 ? "text-yellow-500" : "text-white")}>
                    {item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))}<span className="text-[10px] font-normal opacity-40 ml-0.5">{item.unit}</span>
                  </p>
                  <p className="text-[10px] text-green-400 font-bold">{formatPrice(item.sellPrice)}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewingHistoryItem(item)} className="p-2 text-white/40"><History className="h-4 w-4" /></button>
                    <button onClick={() => startEdit(item)} className="p-2 text-white/40"><Edit2 className="h-4 w-4" /></button>
                  </div>
                  <button onClick={() => handleDeleteItem(item)} className="p-2 text-white/40 text-right"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="py-20 text-center text-white/40">
            <Package className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>{t.noItemsFound}</p>
          </div>
        )}
      </div>

      {/* Centered Scrollable Modal for Add/Edit */}
      <AnimatePresence>
        {(isAdding || editingItem) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAdding(false); setEditingItem(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a0b00] rounded-3xl sm:rounded-[40px] border border-white/20 p-5 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-medium">
                  {editingItem ? t.editProduct : t.newProduct}
                </h2>
                <button 
                  onClick={() => { setIsAdding(false); setEditingItem(null); }}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={editingItem ? handleUpdateItem : handleAddItem} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{t.productName}</label>
                  <div className="relative">
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Fresh Milk, Brown Bread..."
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      onBlur={() => { if (!formData.category || formData.category === GROCERY_CATEGORIES[0]) handlePredictCategory(); }}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 pr-24 outline-none transition-all focus:border-blue-500/50"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {settings.enableVoiceInput && (
                        <VoiceInputButton 
                          onTranscript={(text) => setFormData(prev => ({ ...prev, name: text }))}
                          language={settings.language}
                        />
                      )}
                      <button
                        type="button"
                        onClick={handlePredictCategory}
                        disabled={isPredicting || !formData.name}
                        className="rounded-xl bg-blue-500/10 p-2 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 flex items-center justify-center h-8.5 w-8.5"
                        title={t.autoSuggest}
                      >
                        {isPredicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">
                    {settings.language === 'es' ? 'Descripción (Opcional)' : 'Description (Optional)'}
                  </label>
                  <div className="relative">
                    <textarea 
                      placeholder={settings.language === 'es' ? 'p. ej. Dulce, alta calidad, origen orgánico...' : 'e.g. Sweet, premium quality, organic origin...'}
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 pr-12 outline-none transition-all focus:border-blue-500/50 min-h-[90px] resize-none text-white text-sm"
                    />
                    {settings.enableVoiceInput && (
                      <div className="absolute right-3 bottom-3">
                        <VoiceInputButton 
                          onTranscript={(text) => setFormData(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text }))} 
                          language={settings.language}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Barcode / SKU Config Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">
                    {settings.language === 'es' ? 'Código de barras / SKU (Opcional)' : 'Barcode / SKU (Optional)'}
                  </label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                      <input 
                        type="text"
                        placeholder="e.g. 7410010041, SUN-101..."
                        value={formData.barcode || ''}
                        onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 outline-none transition-all focus:border-blue-500/50 text-white text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFormScannerOpen(true)}
                      className="rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/15 text-orange-400 p-4 shrink-0 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
                      title="Scan barcode with camera"
                    >
                      <Camera className="h-5 w-5" />
                      <span className="hidden sm:inline">Scan</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white/60">{t.tableCategory}</label>
                    {isPredicting && <span className="text-[10px] animate-pulse text-blue-400 font-bold uppercase tracking-widest">{t.predicting}</span>}
                  </div>
                  <select 
                    required
                    value={formData.category || GROCERY_CATEGORIES[0]}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 outline-none transition-all focus:border-blue-500/50 appearance-none text-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    {GROCERY_CATEGORIES.map(cat => (
                      <option key={cat} value={cat} className="bg-[#1a0b00] text-white">{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Stock Packaging Type Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold tracking-wide text-white/60">How is this stocked?</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPackagingType('loose');
                        setFormData(prev => ({
                          ...prev,
                          isWeightBased: false,
                          unit: 'kg',
                          sackUnit: '',
                          saleUnit: '',
                          sackCount: 0,
                          capacityPerSack: 0,
                          pricePerSack: 0,
                          stock: 0
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1",
                        packagingType === 'loose'
                          ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <span className="text-lg">⚖️</span>
                      <span className="text-[10px] font-black uppercase tracking-tight">Loose / Bulk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPackagingType('sack');
                        setFormData(prev => ({
                          ...prev,
                          isWeightBased: true,
                          sackUnit: 'bag',
                          saleUnit: 'kg',
                          unit: 'kg',
                          sackCount: prev.sackCount || 1,
                          capacityPerSack: prev.capacityPerSack || 50,
                          pricePerSack: 0
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1",
                        packagingType === 'sack'
                          ? "bg-amber-600/30 border-amber-500 text-amber-200 shadow-lg shadow-amber-500/5"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <span className="text-lg">👝</span>
                      <span className="text-[10px] font-black uppercase tracking-tight">Bags / Sacks</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPackagingType('box');
                        setFormData(prev => ({
                          ...prev,
                          isWeightBased: true,
                          sackUnit: 'box',
                          saleUnit: 'pcs',
                          unit: 'pcs',
                          sackCount: prev.sackCount || 1,
                          capacityPerSack: prev.capacityPerSack || 24,
                          pricePerSack: 0
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1",
                        packagingType === 'box'
                          ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-lg shadow-indigo-500/5"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <span className="text-lg">📦</span>
                      <span className="text-[10px] font-black uppercase tracking-tight">Boxes / Cartons</span>
                    </button>
                  </div>
                </div>

                {/* Packaging Details Fields */}
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                  {packagingType === 'loose' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Loose Unit</label>
                          <select 
                            value={formData.unit || 'kg'}
                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs focus:ring-1 focus:ring-blue-500/50"
                          >
                            <option value="kg">Kilograms (kg)</option>
                            <option value="g">Grams (g)</option>
                            <option value="L">Liters (L)</option>
                            <option value="ml">Milliliters (ml)</option>
                            <option value="pcs">Pieces (pcs)</option>
                            <option value="pkt">Packet (pkt)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Current Loose Stock</label>
                          <input 
                            required
                            type="number"
                            placeholder="e.g. 25"
                            value={formData.stock === 0 ? '' : formData.stock}
                            onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Cost Price (per {formData.unit || 'kg'})</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.costPrice === 0 ? '' : formData.costPrice}
                            onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Sell Price (per {formData.unit || 'kg'})</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.sellPrice === 0 ? '' : formData.sellPrice}
                            onChange={e => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {packagingType === 'sack' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Number of Bags / Sacks</label>
                          <input 
                            required
                            type="number"
                            placeholder="e.g. 10"
                            value={formData.sackCount === 0 ? '' : formData.sackCount}
                            onChange={e => setFormData({ ...formData, sackCount: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Bag Capacity & Unit</label>
                          <div className="flex gap-2 min-w-0">
                            <input 
                              required
                              type="number"
                              placeholder="e.g. 50"
                              value={formData.capacityPerSack === 0 ? '' : formData.capacityPerSack}
                              onChange={e => setFormData({ ...formData, capacityPerSack: Number(e.target.value) })}
                              className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                            />
                            <select 
                              value={formData.sackUnit || 'bag'}
                              onChange={e => setFormData({ ...formData, sackUnit: e.target.value })}
                              className="w-24 shrink-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs"
                            >
                              <option value="bag">bag</option>
                              <option value="sack">sack</option>
                              <option value="tin">tin</option>
                              <option value="kg">kg</option>
                              <option value="L">L</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Customer Sales Unit</label>
                        <select 
                          value={formData.saleUnit || 'kg'}
                          onChange={e => setFormData({ ...formData, saleUnit: e.target.value, unit: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs focus:ring-1 focus:ring-blue-500/50"
                        >
                          <option value="kg">Kilograms (kg)</option>
                          <option value="g">Grams (g)</option>
                          <option value="L">Liters (L)</option>
                          <option value="ml">Milliliters (ml)</option>
                          <option value="pcs">Pieces (pcs)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Cost Price (per Bag)</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="Cost of 1 Bag"
                            value={formData.costPrice === 0 ? '' : formData.costPrice}
                            onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Sell Price (per {formData.saleUnit || 'kg'})</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="Retail per unit"
                            value={formData.sellPrice === 0 ? '' : formData.sellPrice}
                            onChange={e => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Whole Bag Sell Price (Optional)</label>
                        <p className="text-[8px] text-white/30 uppercase m-0 leading-tight">If buyer takes a full bag, charge this amount instead of calculating per Unit</p>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 5800"
                          value={formData.pricePerSack === 0 ? '' : formData.pricePerSack}
                          onChange={e => setFormData({ ...formData, pricePerSack: Number(e.target.value) })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm focus:ring-1 focus:ring-blue-500/50"
                        />
                      </div>

                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-xs">
                        <p className="text-amber-300 font-medium">
                          Total Stock: <span className="font-bold">{(formData.sackCount || 0) * (formData.capacityPerSack || 0)} {formData.saleUnit || 'kg'}</span>
                        </p>
                        {formData.costPrice && formData.capacityPerSack ? (
                          <p className="text-white/40">
                            Estimated cost per {formData.saleUnit || 'kg'}: <span className="font-semibold">{formatPrice(formData.costPrice / formData.capacityPerSack)}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {packagingType === 'box' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Number of Boxes / Cartons</label>
                          <input 
                            required
                            type="number"
                            placeholder="e.g. 5"
                            value={formData.sackCount === 0 ? '' : formData.sackCount}
                            onChange={e => setFormData({ ...formData, sackCount: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Box Capacity & Unit</label>
                          <div className="flex gap-2 min-w-0">
                            <input 
                              required
                              type="number"
                              placeholder="e.g. 24"
                              value={formData.capacityPerSack === 0 ? '' : formData.capacityPerSack}
                              onChange={e => setFormData({ ...formData, capacityPerSack: Number(e.target.value) })}
                              className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                            />
                            <select 
                              value={formData.sackUnit || 'box'}
                              onChange={e => setFormData({ ...formData, sackUnit: e.target.value })}
                              className="w-24 shrink-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs"
                            >
                              <option value="box">box</option>
                              <option value="carton">carton</option>
                              <option value="pack">pack</option>
                              <option value="pcs">pcs</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Customer Sales Unit</label>
                        <select 
                          value={formData.saleUnit || 'pcs'}
                          onChange={e => setFormData({ ...formData, saleUnit: e.target.value, unit: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs focus:ring-1 focus:ring-blue-500/50"
                        >
                          <option value="pcs">Pieces (pcs)</option>
                          <option value="pkt">Packet (pkt)</option>
                          <option value="box">Box (box)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Cost Price (per Box)</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="Cost of 1 Box"
                            value={formData.costPrice === 0 ? '' : formData.costPrice}
                            onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Sell Price (per {formData.saleUnit || 'pcs'})</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            placeholder="Retail per Piece"
                            value={formData.sellPrice === 0 ? '' : formData.sellPrice}
                            onChange={e => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Whole Box Sell Price (Optional)</label>
                        <p className="text-[8px] text-white/30 uppercase m-0 leading-tight">If buyer takes a full box, charge this amount instead of calculating per Piece</p>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 1350"
                          value={formData.pricePerSack === 0 ? '' : formData.pricePerSack}
                          onChange={e => setFormData({ ...formData, pricePerSack: Number(e.target.value) })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                        />
                      </div>

                      <div className="p-3 bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 rounded-xl space-y-1 text-xs">
                        <p className="text-indigo-300 font-medium">
                          Total Stock: <span className="font-bold">{(formData.sackCount || 0) * (formData.capacityPerSack || 0)} {formData.saleUnit || 'pcs'}</span>
                        </p>
                        {formData.costPrice && formData.capacityPerSack ? (
                          <p className="text-white/40">
                            Estimated cost per {formData.saleUnit || 'pcs'}: <span className="font-semibold">{formatPrice(formData.costPrice / formData.capacityPerSack)}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {/* Advanced Settings: Ratio & Dual Mode */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50 block">Advanced Options</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Fixed Ratio Button Toggle */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isFixedRatio: !prev.isFixedRatio }))}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                        formData.isFixedRatio
                          ? "bg-blue-500/25 border-blue-500/50 text-blue-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                        formData.isFixedRatio ? "bg-blue-500 text-white shadow-xl" : "bg-white/10"
                      )}>
                        %
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight">Fixed Ratio</p>
                        <p className="text-[10px] text-white/40">Constant pack/bulk capacity</p>
                      </div>
                    </button>

                    {/* Dual Mode Button Toggle */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, allowBothModes: !prev.allowBothModes }))}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all",
                        formData.allowBothModes
                          ? "bg-indigo-500/25 border-indigo-500/50 text-indigo-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                        formData.allowBothModes ? "bg-indigo-500 text-white shadow-xl" : "bg-white/10"
                      )}>
                        ⇄
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight">Dual Mode</p>
                        <p className="text-[10px] text-white/40">Sell by both weight & pcs</p>
                      </div>
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full rounded-2xl bg-blue-500 py-4 font-bold shadow-lg shadow-blue-500/20 transition-transform active:scale-[0.98]"
                >
                  {editingItem ? t.saveChanges : t.createItem}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {viewingHistoryItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingHistoryItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-2xl rounded-3xl sm:rounded-[40px] border p-5 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar",
                settings.theme === 'light' ? "bg-white border-slate-200" : "bg-[#1a0b00] border-white/20"
              )}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className={cn(
                    "text-2xl font-medium",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>{t.history} - {viewingHistoryItem.name}</h2>
                  <p className="text-xs text-white/40 uppercase tracking-widest">{t.changeLog}</p>
                </div>
                <button 
                  onClick={() => setViewingHistoryItem(null)}
                  className={cn(
                    "rounded-full p-2 transition-colors",
                    settings.theme === 'light' ? "text-slate-400 hover:bg-slate-100" : "text-white/40 hover:bg-white/10"
                  )}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {(viewingHistoryItem.history || []).slice().reverse().map((entry) => (
                  <div key={entry.id} className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4",
                    settings.theme === 'light' ? "border-slate-100 bg-slate-50" : "border-white/5 bg-white/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tighter",
                        entry.field === 'stock' ? "text-blue-400" : entry.field === 'sellPrice' ? "text-green-400" : "text-orange-400"
                      )}>
                        {entry.field === 'stock' ? t.stockLevel : entry.field === 'sellPrice' ? t.historyPrice : t.historyCost}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {new Date(entry.date).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] text-white/40 uppercase font-bold">{t.oldValue}</p>
                        <p className={cn(
                          "text-lg font-medium",
                          settings.theme === 'light' ? "text-slate-400" : "text-white/40"
                        )}>
                          {entry.field === 'stock' ? `${entry.oldValue % 1 === 0 ? entry.oldValue : Number(entry.oldValue.toFixed(1))} ${viewingHistoryItem.unit}` : formatPrice(entry.oldValue)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/20" />
                      <div className="flex-1">
                        <p className="text-[10px] text-white/40 uppercase font-bold">{t.newValue}</p>
                        <p className={cn(
                          "text-xl font-bold",
                          settings.theme === 'light' ? "text-slate-900" : "text-white"
                        )}>
                           {entry.field === 'stock' ? `${entry.newValue % 1 === 0 ? entry.newValue : Number(entry.newValue.toFixed(1))} ${viewingHistoryItem.unit}` : formatPrice(entry.newValue)}
                        </p>
                      </div>
                    </div>

                    {entry.description && (
                      <p className="text-xs italic text-white/40 border-t border-white/5 pt-2 mt-1">
                        {entry.description}
                      </p>
                    )}
                  </div>
                ))}

                {(viewingHistoryItem.history || []).length === 0 && (
                  <div className="py-20 text-center text-white/40">
                    <History className="mx-auto mb-4 h-12 w-12 opacity-10" />
                    <p>{t.noHistory || 'No history entries found for this item.'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-sm rounded-[32px] border p-6 shadow-2xl",
                settings.theme === 'light' ? "bg-white border-slate-200" : "bg-[#1a0b00] border-white/20"
              )}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                  <Trash2 className="h-6 w-6" />
                </div>
                
                <div className="space-y-2">
                  <h3 className={cn(
                    "text-xl font-medium",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>
                    {settings.language === 'es' ? '¿Eliminar producto?' : 'Delete Product?'}
                  </h3>
                  <p className={cn(
                    "text-sm leading-relaxed",
                    settings.theme === 'light' ? "text-slate-500" : "text-white/60"
                  )}>
                    {settings.language === 'es' 
                      ? `¿Estás seguro de que deseas eliminar "${itemToDelete.name}" del inventario? Esta acción no se puede deshacer.` 
                      : `Are you sure you want to delete "${itemToDelete.name}" from the inventory? This action cannot be undone.`
                    }
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setItemToDelete(null)}
                    className={cn(
                      "flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors",
                      settings.theme === 'light' 
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700" 
                        : "bg-white/5 hover:bg-white/10 text-white"
                    )}
                  >
                    {t.cancel || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="flex-1 rounded-2xl bg-red-500 hover:bg-red-600 py-3 text-sm font-semibold text-white transition-colors shadow-lg shadow-red-500/10"
                  >
                    {settings.language === 'es' ? 'Eliminar' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reusable Barcode Scanner Modals */}
      <BarcodeScannerModal
        isOpen={isMainScannerOpen}
        onClose={() => setIsMainScannerOpen(false)}
        title="Lookup Product Barcode"
        placeholder="Enter barcode..."
        onScan={(code) => {
          const matched = items.find(it => it.barcode?.trim() === code.trim());
          if (matched) {
            setScanAlert({
              message: `Matched product: "${matched.name}" (Code: ${code})`,
              type: 'success'
            });
            startEdit(matched);
          } else {
            setSearchTerm(code);
            setScanAlert({
              message: `No item found for barcode "${code}". We've prefilled the Add Form. Click "Add New Item" to register it!`,
              type: 'info'
            });
            // Auto open adding form with prefilled state
            setFormData(prev => ({
              ...prev,
              name: '',
              description: '',
              stock: 0,
              costPrice: 0,
              sellPrice: 0,
              barcode: code
            }));
            setIsAdding(true);
          }
        }}
      />

      <BarcodeScannerModal
        isOpen={isFormScannerOpen}
        onClose={() => setIsFormScannerOpen(false)}
        title="Scan Item Barcode"
        placeholder="Scan barcode for form..."
        onScan={(code) => {
          setFormData(prev => ({ ...prev, barcode: code }));
        }}
      />

      <CameraCaptureModal
        isOpen={isCameraCaptureOpen}
        onClose={() => setIsCameraCaptureOpen(false)}
        categories={GROCERY_CATEGORIES}
        units={UNIT_TYPES}
        formatPrice={formatPrice}
        onItemAdded={async (newItem) => {
          if (user) {
            await saveData(user.uid, 'items', newItem);
            setScanAlert({
              message: `AI Camera: Registered "${newItem.name}". Est. Cost: ${formatPrice(newItem.costPrice)}, Selling Price Set: ${formatPrice(newItem.sellPrice)}.`,
              type: 'success'
            });
          }
        }}
      />
    </div>
  );
};
