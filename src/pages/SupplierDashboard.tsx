import React from 'react';
import { motion } from 'motion/react';
import { Package, Truck, CheckCircle, Clock, AlertCircle, ArrowRight, MapPin, Settings as SettingsIcon } from 'lucide-react';
import { SupplyOrder, Settings } from '../types';
import { saveGlobalDoc } from '../lib/dataService';
import { cn } from '../lib/utils';

interface SupplierDashboardProps {
  supplyOrders: SupplyOrder[];
  settings: Settings;
  onOpenSettings: () => void;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ supplyOrders, settings, onOpenSettings }) => {
  const updateOrderStatus = async (order: SupplyOrder, newStatus: SupplyOrder['status']) => {
    await saveGlobalDoc('supplyOrders', {
      ...order,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
  };

  const getStatusIcon = (status: SupplyOrder['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-orange-400" />;
      case 'processing': return <Package className="w-5 h-5 text-blue-400" />;
      case 'shipped': return <Truck className="w-5 h-5 text-purple-400" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
  };

  const pendingOrders = supplyOrders.filter(o => o.status !== 'completed');
  const completedOrders = supplyOrders.filter(o => o.status === 'completed');

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-white mb-2">Supplier Portal</h1>
          <p className="text-white/40">Fulfill stock requests from grocery shop owners.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button 
            onClick={onOpenSettings}
            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white/60 hover:bg-white/10 transition-all"
          >
            <SettingsIcon size={24} />
          </button>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-white/20">Pending</p>
              <p className="text-xl font-bold text-white">{pendingOrders.length}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-white/20">Fulfilled</p>
              <p className="text-xl font-bold text-white">{completedOrders.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Active Requests
          </h2>

          <div className="space-y-4">
            {pendingOrders.length === 0 ? (
              <div className="bg-white/2 border border-dashed border-white/10 rounded-3xl p-12 text-center">
                <p className="text-white/20 font-medium">No active stock requests at the moment.</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/[0.08] transition-all"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-bold">Order #{order.id.slice(-6)}</span>
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1",
                          order.status === 'pending' ? "bg-orange-500/20 text-orange-400" :
                          order.status === 'processing' ? "bg-blue-500/20 text-blue-400" :
                          "bg-purple-500/20 text-purple-400"
                        )}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </div>
                      </div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">{new Date(order.date).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">${order.totalCost.toFixed(2)}</p>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">Store ID: {order.storeId}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 bg-black/20 rounded-2xl p-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-white/60">{item.name}</span>
                        <span className="text-white font-medium">x{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <button 
                        onClick={() => updateOrderStatus(order, 'processing')}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
                      >
                        Start Processing
                      </button>
                    )}
                    {order.status === 'processing' && (
                      <button 
                        onClick={() => updateOrderStatus(order, 'shipped')}
                        className="flex-1 bg-purple-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-500 transition-all"
                      >
                        Ship Order
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button 
                        onClick={() => updateOrderStatus(order, 'completed')}
                        className="flex-1 bg-green-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-500 transition-all"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Recently Completed
          </h2>

          <div className="space-y-4">
            {completedOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="bg-white/2 border border-white/5 rounded-2xl p-4 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Order #{order.id.slice(-6)}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">{order.storeId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">${order.totalCost.toFixed(2)}</p>
                  <ArrowRight className="w-4 h-4 ml-auto text-white/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
