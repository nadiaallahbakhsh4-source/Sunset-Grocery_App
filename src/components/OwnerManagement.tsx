import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Truck, 
  PieChart, 
  MessageSquare, 
  HeartHandshake, 
  Plus, 
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Star,
  Package,
  ArrowRight,
  AlertCircle,
  X
} from 'lucide-react';
import { Settings, Partner, Delivery, BudgetItem, Feedback, Sale, Item, SupplyOrder } from '../types';
import { cn } from '../lib/utils';
import { translations } from '../lib/translations';
import { saveData, fetchUsersByRole, saveGlobalDoc } from '../lib/dataService';

interface OwnerManagementProps {
  settings: Settings;
  formatPrice: (amount: number) => string;
  sales: Sale[];
  items: Item[];
  userId: string;
}

type ManagementTab = 'orders' | 'suppliers' | 'crm' | 'budget';

export const OwnerManagement: React.FC<OwnerManagementProps> = ({ settings, formatPrice, sales, items, userId }) => {
  const t = translations[settings.language] || translations.en;
  const [activeTab, setActiveTab] = useState<ManagementTab>('orders');

  const tabs: { id: ManagementTab; label: string; icon: any }[] = [
    { id: 'orders', label: 'Customer Orders', icon: Package },
    { id: 'suppliers', label: 'Suppliers', icon: HeartHandshake },
    { id: 'crm', label: 'CRM', icon: Users },
    { id: 'budget', label: 'Budget', icon: PieChart },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap transition-all text-xs font-black uppercase tracking-widest",
                isActive 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[400px] rounded-[40px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
      >
        {activeTab === 'orders' && <OrdersView sales={sales} formatPrice={formatPrice} userId={userId} />}
        {activeTab === 'suppliers' && <SuppliersView items={items} sales={sales} formatPrice={formatPrice} userId={userId} settings={settings} />}
        {activeTab === 'crm' && <CRMView sales={sales} formatPrice={formatPrice} />}
        {activeTab === 'budget' && <BudgetView sales={sales} formatPrice={formatPrice} />}
      </motion.div>
    </div>
  );
};

const OrdersView = ({ sales, formatPrice, userId }: { sales: Sale[], formatPrice: (n: number) => string, userId: string }) => {
  const pendingOrders = sales.filter(s => s.status !== 'delivered' && s.status !== 'cancelled').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const updateStatus = async (order: Sale, status: Sale['status']) => {
    await saveData(userId, 'sales', { ...order, status });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-serif text-white">Active Customer Orders</h3>
        <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-[10px] font-black uppercase tracking-widest">{pendingOrders.length} Pending</span>
      </div>

      <div className="grid gap-4">
        {pendingOrders.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl">
             <p className="text-white/20">No active orders from customers yet.</p>
          </div>
        ) : (
          pendingOrders.map((order) => (
            <div key={order.id} className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-white text-lg">{order.itemName}</h4>
                  <p className="text-sm text-white/40">Ordered by {order.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{formatPrice(order.totalPrice)}</p>
                  <p className="text-[10px] text-white/20 uppercase font-black">Qty: {order.quantity}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                  order.status === 'pending' ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                )}>
                  Status: {order.status}
                </div>

                <div className="flex gap-2">
                   {order.status === 'pending' && (!order.supplyStatus || order.supplyStatus === 'none') && (
                     <button 
                       onClick={() => updateStatus(order, 'processing')}
                       className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
                     >
                       Confirm Order
                     </button>
                   )}
                   {order.status === 'pending' && (!order.supplyStatus || order.supplyStatus === 'none') && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-500/20">
                       <AlertCircle size={14} />
                       Low Stock? Request from Supplier
                     </div>
                   )}
                   {order.status === 'processing' && (
                     <button 
                       onClick={() => updateStatus(order, 'ready')}
                       className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all"
                     >
                       Mark Ready
                     </button>
                   )}
                   {order.status === 'ready' && (
                     <button 
                       onClick={() => updateStatus(order, 'delivered')}
                       className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-500 transition-all"
                     >
                       Deliver
                     </button>
                   )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const SuppliersView = ({ items, sales, formatPrice, userId, settings }: { items: Item[], sales: Sale[], formatPrice: (n: number) => string, userId: string, settings: Settings }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsersByRole('supplier').then(setSuppliers);
  }, []);

  const handlePlaceSupplyOrder = async () => {
    if (!selectedSupplier || !selectedItem || !settings.storeId) return;

    setIsSubmitting(true);
    const orderId = `supply_${Date.now()}`;
    const newSupplyOrder: SupplyOrder = {
      id: orderId,
      storeId: settings.storeId,
      supplierId: selectedSupplier.id,
      parentSaleId: selectedParentOrder?.id,
      status: 'pending',
      totalCost: selectedItem.costPrice * quantity,
      date: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [{
        itemId: selectedItem.id,
        name: selectedItem.name,
        quantity: quantity,
        unit: selectedItem.unit
      }]
    };

    try {
      await saveGlobalDoc('supplyOrders', newSupplyOrder);
      
      // Update parent order if exists
      if (selectedParentOrder) {
        await saveData(userId, 'sales', {
          ...selectedParentOrder,
          supplyStatus: 'ordered'
        });
      }
      
      setSelectedSupplier(null);
      setSelectedItem(null);
      setSelectedParentOrder(null);
      setQuantity(1);
      alert("Supply request sent to " + selectedSupplier.shopName);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [selectedParentOrder, setSelectedParentOrder] = useState<Sale | null>(null);

  // Filter items that actually need restocking (optional improvement)
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-serif text-white">Stock Supply Chain</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-white/40">Available Suppliers</h4>
          {/* ... existing suppliers mapping ... */}
          <div className="space-y-3">
            {suppliers.map((s) => (
              <div 
                key={s.id} 
                onClick={() => setSelectedSupplier(s)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer",
                  selectedSupplier?.id === s.id 
                    ? "bg-orange-500/10 border-orange-500/50 text-orange-400" 
                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <HeartHandshake className="w-5 h-5 text-white/20" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{s.shopName || "Grocery Partner"}</p>
                      <p className="text-[10px] uppercase font-black opacity-40">Verified Supplier</p>
                    </div>
                  </div>
                  {selectedSupplier?.id === s.id && <CheckCircle2 className="w-5 h-5" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedSupplier && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6"
          >
            <h4 className="text-xs font-black uppercase tracking-widest text-orange-400">Request Stock from {selectedSupplier.shopName}</h4>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/40 ml-2">Link to Customer Order (Optional)</label>
                <select 
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500/50"
                  onChange={(e) => setSelectedParentOrder(sales.find(s => s.id === e.target.value) || null)}
                >
                  <option value="">Specific customer waiting?</option>
                  {sales.filter(s => s.status === 'pending').map(s => (
                    <option key={s.id} value={s.id}>{s.itemName} for {s.customerName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/40 ml-2">Select Item to Restock</label>
                <select 
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500/50"
                  onChange={(e) => setSelectedItem(items.find(i => i.id === e.target.value) || null)}
                >
                  <option value="">Select an item...</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Current: {i.stock % 1 === 0 ? i.stock : Number(i.stock.toFixed(1))} {i.unit})</option>
                  ))}
                </select>
              </div>

              {selectedItem && (
                <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between bg-black/40 rounded-2xl p-4 border border-white/5">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-black">Restock Quantity</p>
                      <input 
                        type="number" 
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="bg-transparent text-xl font-bold text-white outline-none w-20"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase font-black">Total Cost</p>
                      <p className="text-lg font-bold text-white">{formatPrice(selectedItem.costPrice * quantity)}</p>
                    </div>
                  </div>

                  <button 
                    onClick={handlePlaceSupplyOrder}
                    disabled={isSubmitting}
                    className="w-full bg-orange-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Send Supply Request
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const CRMView = ({ sales, formatPrice }: { sales: Sale[], formatPrice: (n: number) => string }) => {
  // Aggregate sales by customer
  const customerMap = sales.reduce((acc, sale) => {
    const key = sale.customerId || sale.customerName;
    if (!acc[key]) {
      acc[key] = { name: sale.customerName, totalSpent: 0, orderCount: 0, lastOrder: sale.date };
    }
    acc[key].totalSpent += sale.totalPrice;
    acc[key].orderCount += 1;
    if (new Date(sale.date) > new Date(acc[key].lastOrder)) acc[key].lastOrder = sale.date;
    return acc;
  }, {} as Record<string, any>);

  const customers = Object.values(customerMap).sort((a,b) => b.totalSpent - a.totalSpent);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-serif text-white">Customer Insights</h3>
      </div>
      <div className="grid gap-4">
        {customers.map((c, i) => (
          <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-orange-400 font-bold border border-white/10">
                {c.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-white">{c.name}</h4>
                <p className="text-xs text-white/40">{c.orderCount} Orders • Last: {new Date(c.lastOrder).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-orange-400">{formatPrice(c.totalSpent)}</p>
              <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">Lifetime Value</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BudgetView = ({ sales, formatPrice }: { sales: Sale[], formatPrice: (n: number) => string }) => {
  const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalPrice, 0);
  const totalProfit = sales.reduce((acc, sale) => acc + sale.profit, 0);
  const totalExpenses = totalRevenue - totalProfit;

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif text-white">Financial Statistics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-[32px] bg-green-500/10 border border-green-500/10">
           <ArrowDownLeft size={32} className="mb-4 text-green-500" />
           <p className="text-[10px] font-black uppercase text-green-500/60 tracking-widest">Total Income</p>
           <p className="text-4xl font-bold text-white">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="p-8 rounded-[32px] bg-red-500/10 border border-red-500/10">
           <ArrowUpRight size={32} className="mb-4 text-red-500" />
           <p className="text-[10px] font-black uppercase text-red-500/60 tracking-widest">Direct Expenses (COGS)</p>
           <p className="text-4xl font-bold text-white">{formatPrice(totalExpenses)}</p>
        </div>
      </div>
      <div className="p-8 rounded-[40px] bg-orange-500 text-white shadow-2xl shadow-orange-500/20">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest opacity-60">Net Profit Margin</p>
            <p className="text-5xl font-bold">{formatPrice(totalProfit)}</p>
          </div>
          <PieChart size={64} className="opacity-20" />
        </div>
      </div>
    </div>
  );
};
