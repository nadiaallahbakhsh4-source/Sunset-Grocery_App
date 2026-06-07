import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Calculator, TrendingUp, ShoppingBag, ChevronRight, ChevronLeft, Plus, Save, Clock, Receipt } from 'lucide-react';
import { Sale, DailySalary, Settings } from '../types';
import { saveData } from '../lib/dataService';
import { cn } from '../lib/utils';

interface DailyAuditProps {
  sales: Sale[];
  salaries: DailySalary[];
  settings: Settings;
  formatPrice: (amount: number) => string;
  userId: string;
}

export const DailyAudit: React.FC<DailyAuditProps> = ({ sales, salaries, settings, formatPrice, userId }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salaryInput, setSalaryInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Group sales by date
  const salesByDate = useMemo(() => {
    const groups: Record<string, Sale[]> = {};
    sales.forEach(sale => {
      const date = sale.date.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(sale);
    });
    return groups;
  }, [sales]);

  // Map salaries by date
  const salariesByDate = useMemo(() => {
    const map: Record<string, DailySalary> = {};
    salaries.forEach(s => {
      map[s.date] = s;
    });
    return map;
  }, [salaries]);

  // Generate last 30 days
  const dates = useMemo(() => {
    const list = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }, []);

  const handleSaveSalary = async () => {
    if (!salaryInput || isNaN(Number(salaryInput))) return;
    
    setIsSaving(true);
    try {
      const salary: DailySalary = {
        id: selectedDate,
        amount: Number(salaryInput),
        date: selectedDate,
        notes: `Recorded on ${new Date().toLocaleString()}`
      };
      await saveData(userId, 'salaries', salary);
      setSalaryInput('');
    } catch (error) {
      console.error("Failed to save salary", error);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedDaySales = salesByDate[selectedDate] || [];
  const selectedDaySalary = salariesByDate[selectedDate];

  const totalRevenue = selectedDaySales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfit = selectedDaySales.reduce((sum, s) => sum + s.profit, 0);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-serif text-white">Daily Audit</h1>
        <p className="text-white/40">Track daily salaries and review sales distribution.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Dates Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 overflow-hidden">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4 px-2">Recent Dates</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
              {dates.map(date => {
                const daySales = salesByDate[date] || [];
                const daySalary = salariesByDate[date];
                const isActive = selectedDate === date;

                return (
                  <motion.button
                    key={date}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                      isActive 
                        ? "bg-white text-black border-white" 
                        : "bg-white/5 border-white/5 text-white hover:bg-white/10"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">
                        {new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <span className="font-bold">{date}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "text-[10px] font-black uppercase",
                        isActive ? "text-black/60" : "text-white/40"
                      )}>
                        {daySales.length} items sold
                      </span>
                      {daySalary && (
                        <span className="text-[10px] font-black text-orange-500">
                          Paid {formatPrice(daySalary.amount)}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Audit Panel */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] space-y-2">
                  <div className="flex items-center gap-3 text-white/40">
                    <TrendingUp size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Day Revenue</span>
                  </div>
                  <div className="text-3xl font-serif text-white">{formatPrice(totalRevenue)}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] space-y-2">
                  <div className="flex items-center gap-3 text-white/40">
                    <Calculator size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Day Profit</span>
                  </div>
                  <div className="text-3xl font-serif text-orange-500">{formatPrice(totalProfit)}</div>
                </div>
              </div>

              {/* Salary Section */}
              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-serif text-white">Daily Salary</h3>
                  {selectedDaySalary && (
                    <span className="bg-orange-500/20 text-orange-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                      Recorded
                    </span>
                  )}
                </div>

                {selectedDaySalary ? (
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/10">
                    <div className="space-y-1">
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Amount Paid</p>
                      <p className="text-2xl font-bold text-white">{formatPrice(selectedDaySalary.amount)}</p>
                    </div>
                    <div className="text-right">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 ml-auto">
                        <Clock size={20} />
                      </div>
                      <p className="text-[10px] text-white/40 mt-2 font-mono">{selectedDaySalary.notes}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">
                        Enter Daily Salary for {selectedDate}
                      </label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            value={salaryInput}
                            onChange={(e) => setSalaryInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xl outline-none focus:border-orange-500 transition-colors"
                          />
                        </div>
                        <button
                          onClick={handleSaveSalary}
                          disabled={!salaryInput || isSaving}
                          className="px-8 bg-orange-500 text-black rounded-2xl font-black uppercase text-xs hover:bg-orange-400 transition-all disabled:opacity-50 disabled:scale-95"
                        >
                          {isSaving ? '...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Items Sold Section */}
              <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="text-orange-500" />
                    <h3 className="text-xl font-serif text-white">Items Sold</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {selectedDaySales.length} Transactions
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedDaySales.length > 0 ? (
                    selectedDaySales.map((sale) => (
                      <div 
                        key={sale.id}
                        className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-white/20 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                            <Receipt size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-white leading-tight">{sale.itemName}</p>
                            <p className="text-[10px] font-black uppercase tracking-tighter text-white/40">
                              {sale.quantity} units • {sale.customerName || 'Walk-in'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{formatPrice(sale.totalPrice)}</p>
                          <p className="text-[10px] font-bold text-orange-500/80">+{formatPrice(sale.profit)} profit</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white/2 rounded-[24px] border border-dashed border-white/10">
                      <ShoppingBag className="mx-auto w-8 h-8 text-white/10 mb-4" />
                      <p className="text-white/40 text-xs italic">No items were sold on this day.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
