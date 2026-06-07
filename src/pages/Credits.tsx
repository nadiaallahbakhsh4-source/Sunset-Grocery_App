import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Plus, 
  Search, 
  Trash2, 
  X, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  User,
  Phone,
  Edit2
} from 'lucide-react';
import { CustomerCredit, Transaction, Settings } from '../types';
import { translations } from '../lib/translations';
import { cn } from '../lib/utils';
import { saveData, deleteData } from '../lib/dataService';
import { useFirebase } from '../components/FirebaseProvider';

interface CreditsProps {
  credits: CustomerCredit[];
  formatPrice: (amount: number) => string;
  settings: Settings;
}

export const Credits: React.FC<CreditsProps> = ({ credits, formatPrice, settings }) => {
  const { user } = useFirebase();
  const t = translations[settings.language] || translations.en;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CustomerCredit | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    initialDebt: 0
  });

  const [transactionData, setTransactionData] = useState({
    type: 'given' as 'given' | 'returned',
    amount: 0,
    note: ''
  });

  const filteredCredits = credits.filter(c => 
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customerPhone?.includes(searchQuery)
  );

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: 'given',
      amount: formData.initialDebt,
      date: new Date().toISOString(),
      note: 'Initial credit'
    };

    const newCredit: CustomerCredit = {
      id: crypto.randomUUID(),
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      totalDebt: formData.initialDebt,
      totalPaid: 0,
      history: [newTransaction],
      lastUpdated: new Date().toISOString()
    };

    await saveData(user.uid, 'credits', newCredit);
    setShowAddModal(false);
    setFormData({ customerName: '', customerPhone: '', initialDebt: 0 });
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCredit) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      type: transactionData.type,
      amount: transactionData.amount,
      date: new Date().toISOString(),
      note: transactionData.note
    };

    const updatedHistory = [...selectedCredit.history, newTransaction];
    const totalDebt = updatedHistory
      .filter(h => h.type === 'given')
      .reduce((sum, h) => sum + h.amount, 0);
    const totalPaid = updatedHistory
      .filter(h => h.type === 'returned')
      .reduce((sum, h) => sum + h.amount, 0);

    const updatedCredit: CustomerCredit = {
      ...selectedCredit,
      history: updatedHistory,
      totalDebt,
      totalPaid,
      lastUpdated: new Date().toISOString()
    };

    await saveData(user.uid, 'credits', updatedCredit);
    setSelectedCredit(updatedCredit);
    setShowTransactionModal(false);
    setTransactionData({ type: 'given', amount: 0, note: '' });
  };

  const handleDeleteCredit = async (id: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this credit record?')) return;
    await deleteData(user.uid, 'credits', id);
    if (selectedCredit?.id === id) setSelectedCredit(null);
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-serif text-white">{t.credits}</h1>
          <p className="text-white/60">{t.creditsSubtitle}</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-black transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={20} />
          {t.addCredit}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
        <input 
          type="text"
          placeholder={t.searchSalesPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-3xl border border-white/10 bg-white/5 py-4 pl-12 pr-6 text-white backdrop-blur-xl outline-none focus:border-white/20 transition-all"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCredits.map((credit) => (
          <motion.button
            layoutId={credit.id}
            key={credit.id}
            onClick={() => setSelectedCredit(credit)}
            className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6 text-left backdrop-blur-xl transition-all hover:bg-white/10"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-500">
                <User size={24} />
              </div>
              <div className="text-right text-xs font-black uppercase tracking-widest text-white/40">
                {new Date(credit.lastUpdated).toLocaleDateString()}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-medium text-white">{credit.customerName}</h3>
              {credit.customerPhone && (
                <p className="text-sm text-white/40">{credit.customerPhone}</p>
              )}
            </div>

            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{t.balanceDue}</p>
                <p className={cn(
                  "text-2xl font-bold",
                  (credit.totalDebt - credit.totalPaid) > 0 ? "text-red-400" : "text-green-400"
                )}>
                  {formatPrice(credit.totalDebt - credit.totalPaid)}
                </p>
              </div>
              <ChevronRight className="text-white/20 transition-transform group-hover:translate-x-1" />
            </div>
          </motion.button>
        ))}
      </div>

      {filteredCredits.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[40px] border border-dashed border-white/10 py-20 text-center">
          <Wallet size={48} className="mb-4 text-white/10" />
          <p className="text-xl text-white/40">No credit records found.</p>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-[40px] border border-white/20 bg-[#1a0b00] p-8 shadow-2xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-medium text-white">{t.newCredit}</h2>
                <button onClick={() => setShowAddModal(false)} className="rounded-full bg-white/5 p-2 text-white/40 hover:bg-white/10 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCredit} className="space-y-6">
                <div className="space-y-2">
                  <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40">{t.customerName}</label>
                  <input 
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                    placeholder="Enter customer name..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40">{t.phoneNumber}</label>
                  <input 
                    type="text"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                    placeholder="Optional phone number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40">{t.amount}</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    value={formData.initialDebt}
                    onChange={(e) => setFormData({ ...formData, initialDebt: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full rounded-2xl bg-white py-4 font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {t.addCredit}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details View */}
      <AnimatePresence>
        {selectedCredit && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCredit(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              layoutId={selectedCredit.id}
              className="relative h-[90vh] w-full max-w-2xl overflow-hidden rounded-t-[40px] border border-white/20 bg-[#1a0b00] shadow-2xl sm:h-auto sm:rounded-[40px]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between bg-[#1a0b00] p-8 pb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-500">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif text-white">{selectedCredit.customerName}</h2>
                    <p className="text-sm text-white/40">{selectedCredit.customerPhone || 'No phone recorded'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDeleteCredit(selectedCredit.id)}
                    className="rounded-full bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button onClick={() => setSelectedCredit(null)} className="rounded-full bg-white/5 p-2 text-white/40 hover:bg-white/10 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-8 pt-4">
                <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{t.customerDebt}</p>
                  <p className="text-2xl font-bold text-red-400">{formatPrice(selectedCredit.totalDebt)}</p>
                </div>
                <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{t.customerPaid}</p>
                  <p className="text-2xl font-bold text-green-400">{formatPrice(selectedCredit.totalPaid)}</p>
                </div>
              </div>

              <div className="p-8 pt-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">{t.history}</h3>
                  <button 
                    onClick={() => setShowTransactionModal(true)}
                    className="flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-400"
                  >
                    <Plus size={16} />
                    {t.recordTransaction}
                  </button>
                </div>

                <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2 no-scrollbar">
                  {[...selectedCredit.history].reverse().map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          tx.type === 'given' ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                        )}>
                          {tx.type === 'given' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{tx.note || (tx.type === 'given' ? t.moneyGiven : t.moneyReturned)}</p>
                          <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase font-black">
                            <Calendar size={12} />
                            {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "text-lg font-bold",
                        tx.type === 'given' ? "text-red-400" : "text-green-400"
                      )}>
                        {tx.type === 'given' ? '-' : '+'}{formatPrice(tx.amount)}
                      </div>
                    </div>
                  ))}

                  {selectedCredit.history.length === 0 && (
                    <p className="text-center py-8 text-white/20">No transactions recorded.</p>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-[#1a0b00] p-8 pt-0 flex gap-4">
                <button 
                  onClick={() => {
                    setTransactionData({ type: 'returned', amount: 0, note: '' });
                    setShowTransactionModal(true);
                  }}
                  className="flex-1 rounded-2xl bg-green-500/10 py-4 font-bold text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all"
                >
                  <ArrowDownLeft size={20} className="inline mr-2" />
                  {t.repay}
                </button>
                <button 
                  onClick={() => {
                    setTransactionData({ type: 'given', amount: 0, note: '' });
                    setShowTransactionModal(true);
                  }}
                  className="flex-1 rounded-2xl bg-red-500/10 py-4 font-bold text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <ArrowUpRight size={20} className="inline mr-2" />
                  {t.adjust}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTransactionModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-[40px] border border-white/20 bg-[#1a0b00] p-8 shadow-2xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-medium text-white">{t.recordTransaction}</h2>
                <button onClick={() => setShowTransactionModal(false)} className="rounded-full bg-white/5 p-2 text-white/40 hover:bg-white/10 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setTransactionData({ ...transactionData, type: 'given' })}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      transactionData.type === 'given' ? "bg-red-500 text-white" : "text-white/40"
                    )}
                  >
                    Credit Given
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionData({ ...transactionData, type: 'returned' })}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      transactionData.type === 'returned' ? "bg-green-500 text-white" : "text-white/40"
                    )}
                  >
                    Payment Received
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40">{t.amount}</label>
                  <input 
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={transactionData.amount || ''}
                    onChange={(e) => setTransactionData({ ...transactionData, amount: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40">{t.note}</label>
                  <input 
                    type="text"
                    value={transactionData.note}
                    onChange={(e) => setTransactionData({ ...transactionData, note: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                    placeholder={t.notePlaceholder}
                  />
                </div>

                <button 
                  type="submit"
                  className={cn(
                    "w-full rounded-2xl py-4 font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]",
                    transactionData.type === 'given' ? "bg-red-500" : "bg-green-500"
                  )}
                >
                  {t.addTransaction}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
