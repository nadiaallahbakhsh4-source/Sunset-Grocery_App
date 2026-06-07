import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Plus, 
  Minus, 
  X,
  Building2,
  Info,
  Settings as SettingsIcon
} from 'lucide-react';
import { Settings, Item, Sale, Store } from '../types';
import { saveData, updateSettings } from '../lib/dataService';
import { cn } from '../lib/utils';

interface CustomerDashboardProps {
  settings: Settings;
  items: Item[];
  sales: Sale[];
  currentStore: Store | null;
  formatPrice: (amount: number) => string;
  userId: string;
  onOpenSettings: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ 
  settings, 
  items, 
  sales, 
  currentStore,
  formatPrice,
  userId,
  onOpenSettings
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isOrdering, setIsOrdering] = useState(false);
  const [activeUnit, setActiveUnit] = useState<string>('pcs');
  const [purchaseMode, setPurchaseMode] = useState<'weight' | 'pieces' | 'fixed-ratio'>('pieces');

  const getSellPriceForUnit = (item: Item, unit: string) => {
    const uNorm = unit.toLowerCase();
    const baseNorm = (item.unit || '').toLowerCase();
    
    // Sacks / bulk conversion
    const hasCapacity = item.capacityPerSack && item.capacityPerSack > 0;
    
    const isBulk = ['sack', 'bag', 'box', 'carton', 'tin'].includes(uNorm) || (item.sackUnit && uNorm === item.sackUnit.toLowerCase());
    if (isBulk) {
      if (item.pricePerSack && item.pricePerSack > 0) {
        return item.pricePerSack;
      }
      if (['kg', 'l', 'pcs'].includes(baseNorm)) {
        return item.sellPrice * (item.capacityPerSack || 1);
      }
      return item.sellPrice;
    }

    if (uNorm === 'kg' || uNorm === 'l') {
      if (baseNorm === 'g' || baseNorm === 'ml') {
        return item.sellPrice * 1000;
      }
      if (['box', 'bag', 'carton', 'tin'].includes(baseNorm) && hasCapacity) {
        return item.sellPrice / item.capacityPerSack!;
      }
      return item.sellPrice;
    }

    if (uNorm === 'g' || uNorm === 'ml') {
      if (baseNorm === 'kg' || baseNorm === 'l') {
        return item.sellPrice / 1000;
      }
      if (['box', 'bag', 'carton', 'tin'].includes(baseNorm) && hasCapacity) {
        return (item.sellPrice / item.capacityPerSack!) / 1000;
      }
      return item.sellPrice;
    }

    if (uNorm === 'pcs' || uNorm === 'pkt' || uNorm === 'piece' || uNorm === 'pieces' || uNorm === 'packed' || uNorm === 'bed' || uNorm === 'beds') {
      if (['box', 'bag', 'carton', 'tin'].includes(baseNorm) && hasCapacity) {
        return item.sellPrice / item.capacityPerSack!;
      }
      return item.sellPrice;
    }

    return item.sellPrice;
  };

  const getUnitCostForSelectedUnit = (item: Item, unit: string) => {
    const uNorm = unit.toLowerCase();
    const isSack = ['sack', 'bag', 'box', 'carton', 'tin'].includes(uNorm) || (item.sackUnit && uNorm === item.sackUnit.toLowerCase());
    if (isSack) {
      return item.costPrice;
    }
    if (item.capacityPerSack && item.capacityPerSack > 0) {
      return item.costPrice / item.capacityPerSack;
    }
    return item.costPrice;
  };

  React.useEffect(() => {
    if (selectedItem) {
      if (selectedItem.isWeightBased) {
        setActiveUnit(selectedItem.saleUnit || 'kg');
        setPurchaseMode('weight');
      } else {
        setActiveUnit(selectedItem.unit || 'pcs');
        setPurchaseMode('pieces');
      }
      setQuantity(1);
    }
  }, [selectedItem]);

  const activeSellPrice = selectedItem ? getSellPriceForUnit(selectedItem, activeUnit) : 0;
  const activeCostPrice = selectedItem ? getUnitCostForSelectedUnit(selectedItem, activeUnit) : 0;
  const activeTotalPrice = activeSellPrice * quantity;
  const activeProfit = (activeSellPrice - activeCostPrice) * quantity;

  // Filter sales for this customer
  const myOrders = sales.filter(s => s.customerId === userId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handlePlaceOrder = async () => {
    if (!selectedItem || !currentStore) return;

    setIsOrdering(true);
    const saleId = `order_${Date.now()}`;
    const newOrder: Sale = {
      id: saleId,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      unit: activeUnit,
      customerId: userId,
      customerName: settings.shopName || 'Guest User', // Using settings name if available
      customerPhone: '',
      quantity: quantity,
      totalPrice: activeTotalPrice,
      profit: activeProfit,
      paymentMethod: 'Cash on Delivery',
      date: new Date().toISOString(),
      status: 'pending',
      supplyStatus: 'none'
    };

    try {
      // We save to the OWNER'S collection (dataService syncData logic handles this via targetUserId)
      await saveData(currentStore.ownerId, 'sales', newOrder);
      setSelectedItem(null);
      setQuantity(1);
    } catch (err) {
      console.error("Failed to place order:", err);
    } finally {
      setIsOrdering(false);
    }
  };

  const getOrderStatusDisplay = (order: Sale) => {
    if (order.supplyStatus && order.supplyStatus !== 'none') {
      return {
        label: `Supplier: ${order.supplyStatus}`,
        color: 'text-purple-400 bg-purple-500/20'
      };
    }
    return {
      label: order.status,
      color: order.status === 'pending' ? 'text-orange-400 bg-orange-500/20' :
             order.status === 'delivered' ? 'text-green-400 bg-green-500/20' :
             'text-blue-400 bg-blue-500/20'
    };
  };

  return (
    <div className="space-y-10">
      {/* Store Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 border border-white/10 rounded-[40px] p-8 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-serif text-white">{currentStore?.name}</h1>
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest">Open Now</span>
            </div>
            <div className="flex items-center gap-2 text-white/40 mt-1">
              <MapPin className="w-4 h-4" />
              <p className="text-sm">{currentStore?.location}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onOpenSettings}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/60 transition-all"
          >
            <SettingsIcon size={20} />
          </button>
          <button 
            onClick={async () => {
               await updateSettings(userId, { ...settings, storeId: undefined });
            }}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white/60 transition-all"
          >
            Change Store
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Inventory Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-white">Browsing Inventory</h2>
            <div className="flex gap-2">
              <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                {items.length} Products
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -4 }}
                className="group bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/[0.08] transition-all cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-white/20 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{formatPrice(item.sellPrice)}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">per {item.unit}</p>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-1 flex items-center gap-1.5 flex-wrap">
                  {item.name}
                  {item.isFixedRatio && (
                    <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                      Fixed Ratio
                    </span>
                  )}
                  {item.allowBothModes && (
                    <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                      Dual Mode
                    </span>
                  )}
                </h3>
                <p className="text-sm text-white/40 mb-4">{item.category}</p>
                <div className="flex items-center justify-between">
                  {item.stock > 0 ? (
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-500">In Stock</span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Out of Stock</span>
                  )}
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Orders Sidebar */}
        <div className="space-y-8">
          <section className="space-y-6">
            <h2 className="text-2xl font-serif text-white">Your Orders</h2>
            <div className="space-y-4">
              {myOrders.length === 0 ? (
                <div className="p-8 text-center bg-white/2 border border-dashed border-white/10 rounded-[32px]">
                  <p className="text-white/20 text-sm">No orders yet. Start shopping!</p>
                </div>
              ) : (
                myOrders.map((order) => {
                  const status = getOrderStatusDisplay(order);
                  return (
                    <motion.div 
                      key={order.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-white text-sm">{order.itemName}</h4>
                          <p className="text-[10px] text-white/30 uppercase tracking-widest">Qty: {order.quantity}</p>
                        </div>
                        <p className="font-bold text-white text-sm">{formatPrice(order.totalPrice)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest", status.color)}>
                          {status.label}
                        </div>
                        <p className="text-[9px] text-white/20 uppercase font-black">{new Date(order.date).toLocaleDateString()}</p>
                      </div>

                      {order.supplyStatus && order.supplyStatus !== 'none' && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[9px] text-orange-500/80 italic">
                          <Info className="w-3 h-3" />
                          Order being fulfilled by specialized supplier
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Order Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a0b02] border border-white/10 rounded-[40px] p-8 overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="mb-8">
                <div className="w-16 h-16 rounded-3xl bg-orange-500/20 text-orange-500 flex items-center justify-center mb-6">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-serif text-white mb-2">{selectedItem.name}</h2>
                <p className="text-white/40 text-sm">Review your order and select quantity.</p>
              </div>

              <div className="space-y-6">
                {/* 1. Mode Selector Buttons */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block">Select Purchasing Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Weight Mode Button */}
                    <button
                      type="button"
                      disabled={!selectedItem.isWeightBased && !selectedItem.allowBothModes}
                      onClick={() => {
                        setPurchaseMode('weight');
                        setActiveUnit(selectedItem.saleUnit || 'kg');
                        setQuantity(1);
                      }}
                      className={cn(
                        "p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center",
                        purchaseMode === 'weight'
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-200 shadow-lg shadow-blue-500/10"
                          : (!selectedItem.isWeightBased && !selectedItem.allowBothModes)
                            ? "opacity-25 cursor-not-allowed bg-black/25 border-transparent text-white/20"
                            : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}
                    >
                      <span className="text-base">⚖️</span>
                      <span className="text-[9px] font-black uppercase tracking-tight w-full truncate">Weight (Kg)</span>
                    </button>

                    {/* Pieces Mode Button */}
                    <button
                      type="button"
                      disabled={selectedItem.isWeightBased && !selectedItem.allowBothModes}
                      onClick={() => {
                        setPurchaseMode('pieces');
                        setActiveUnit(selectedItem.unit || 'pcs');
                        setQuantity(1);
                      }}
                      className={cn(
                        "p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center",
                        purchaseMode === 'pieces'
                          ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 shadow-lg shadow-indigo-500/10"
                          : (selectedItem.isWeightBased && !selectedItem.allowBothModes)
                            ? "opacity-25 cursor-not-allowed bg-black/25 border-transparent text-white/20"
                            : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}
                    >
                      <span className="text-base">🍎</span>
                      <span className="text-[9px] font-black uppercase tracking-tight w-full truncate">Pieces</span>
                    </button>

                    {/* Fixed Ratio Bulk Button */}
                    <button
                      type="button"
                      disabled={!selectedItem.capacityPerSack || selectedItem.capacityPerSack <= 0}
                      onClick={() => {
                        setPurchaseMode('fixed-ratio');
                        setActiveUnit(selectedItem.sackUnit || 'bag');
                        setQuantity(1);
                      }}
                      className={cn(
                        "p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center",
                        purchaseMode === 'fixed-ratio'
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-lg shadow-amber-500/10"
                          : (!selectedItem.capacityPerSack || selectedItem.capacityPerSack <= 0)
                            ? "opacity-25 cursor-not-allowed bg-black/25 border-transparent text-white/20"
                            : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                      )}
                    >
                      <span className="text-base">📦</span>
                      <span className="text-[9px] font-black uppercase tracking-tight w-full truncate">Bulk Pack</span>
                    </button>
                  </div>
                </div>

                {/* 2. Quantity Adjuster Board */}
                <div className="space-y-4 bg-black/40 border border-white/10 rounded-3xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-black mb-1">Price per {activeUnit}</p>
                      <p className="text-2xl font-bold text-white">{formatPrice(activeSellPrice)}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        type="button"
                        onClick={() => {
                          const step = purchaseMode === 'weight' ? 0.25 : 1;
                          setQuantity(q => Math.max(step, Number((q - step).toFixed(2))));
                        }}
                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-lg font-mono font-bold text-white w-14 text-center">{quantity}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const step = purchaseMode === 'weight' ? 0.25 : 1;
                          setQuantity(q => Number((q + step).toFixed(2)));
                        }}
                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preset buttons */}
                  <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 block text-left">Quick Options:</span>
                    <div className="flex flex-wrap gap-1.5 justify-start">
                      {purchaseMode === 'weight' && [0.25, 0.5, 1, 2, 5].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQuantity(val)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                            quantity === val
                              ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                              : "bg-black/20 border-white/5 text-white/50 hover:bg-white/5"
                          )}
                        >
                          {val} kg
                        </button>
                      ))}

                      {purchaseMode === 'pieces' && [1, 2, 6, 12, 24].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQuantity(val)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                            quantity === val
                              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                              : "bg-black/20 border-white/5 text-white/50 hover:bg-white/5"
                          )}
                        >
                          {val} {val === 1 ? 'pc' : 'pcs'}
                        </button>
                      ))}

                      {purchaseMode === 'fixed-ratio' && [1, 2, 5, 10].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setQuantity(val)}
                          className={cn(
                            "px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all",
                            quantity === val
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-black/20 border-white/5 text-white/50 hover:bg-white/5"
                          )}
                        >
                          {val} {selectedItem.sackUnit || 'Pack'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Pricing invoice outline */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-white/40 font-medium text-sm">
                    <span>Subtotal ({quantity} x {activeUnit})</span>
                    <span>{formatPrice(activeTotalPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center text-white/40 font-medium text-sm pb-4 border-b border-white/5">
                    <span>Delivery Fee</span>
                    <span className="text-green-500 font-bold uppercase tracking-widest text-[10px]">FREE</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-serif text-white">Total</span>
                    <span className="text-2xl font-bold text-orange-500">{formatPrice(activeTotalPrice)}</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isOrdering}
                  className="w-full bg-white text-black h-16 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-orange-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isOrdering ? (
                    <Clock className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Place Order
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
