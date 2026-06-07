import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, ArrowDownCircle, ArrowUpCircle, History, X, Trash2 } from 'lucide-react';
import { Partner, Transaction } from '../types';
import { cn } from '../lib/utils';

import { translations } from '../lib/translations';

interface PartnersProps {
  partners: Partner[];
  setPartners: React.Dispatch<React.SetStateAction<Partner[]>>;
  formatPrice: (amount: number) => string;
}

import { useFirebase } from '../components/FirebaseProvider';
import { saveData, deleteData } from '../lib/dataService';

export const Partners: React.FC<PartnersProps> = ({ partners, formatPrice, settings }) => {
  const { user } = useFirebase();
  const t = translations[settings.language] || translations.en;
  const [isAdding, setIsAdding] = useState(false);
  const [activePartner, setActivePartner] = useState<Partner | null>(null);
  const [partnerName, setPartnerName] = useState('');
  
  // Transaction Form
  const [txData, setTxData] = useState({
    type: 'given' as 'given' | 'returned',
    amount: 0,
    note: ''
  });

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newPartner: Partner = {
      id: crypto.randomUUID(),
      name: partnerName,
      totalGiven: 0,
      totalReturned: 0,
      history: []
    };
    await saveData(user.uid, 'partners', newPartner);
    setPartnerName('');
    setIsAdding(false);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePartner || !user) return;

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: txData.type,
      amount: txData.amount,
      note: txData.note,
      date: new Date().toISOString()
    };

    const updatedPartner: Partner = {
      ...activePartner,
      history: [...activePartner.history, newTx],
      totalGiven: txData.type === 'given' ? activePartner.totalGiven + txData.amount : activePartner.totalGiven,
      totalReturned: txData.type === 'returned' ? activePartner.totalReturned + txData.amount : activePartner.totalReturned
    };

    await saveData(user.uid, 'partners', updatedPartner);
    setActivePartner(updatedPartner);
    setTxData({ type: 'given', amount: 0, note: '' });
  };

  const handleDeletePartner = async (partner: Partner) => {
    if (!user) return;
    if (confirm(`Delete ${partner.name} and all their records?`)) {
      await deleteData(user.uid, 'partners', partner.id);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-light tracking-tight">{t.partners.split(' ')[0]} <span className="font-medium text-pink-400">{t.partners.split(' ').slice(1).join(' ') || 'Records'}</span></h1>
          <p className="text-white/60">{t.partnersSubtitle}</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 rounded-2xl bg-pink-500 px-6 py-3 font-semibold shadow-lg shadow-pink-500/20 active:scale-95 transition-all"
        >
          <Plus className="h-5 w-5" />
          {t.addPartner}
        </button>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {partners.map((partner) => (
          <motion.div 
            key={partner.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-pink-500/20 p-3">
                <Users className="h-6 w-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold">{partner.name}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-[10px] uppercase text-white/40">{t.totalGiven}</p>
                <p className="font-bold text-green-400">{formatPrice(partner.totalGiven)}</p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-[10px] uppercase text-white/40">{t.totalReturned}</p>
                <p className="font-bold text-yellow-400">{formatPrice(partner.totalReturned)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                <span className="text-xs text-white/40">{t.balanceDue}</span>
                <span className={cn(
                  "font-bold",
                  partner.totalGiven - partner.totalReturned > 0 ? "text-pink-400" : "text-green-400"
                )}>
                  {formatPrice(Math.max(0, partner.totalGiven - partner.totalReturned))}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActivePartner(partner)}
                  className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-white/20"
                >
                  {t.manageLedger}
                </button>
                <button 
                  onClick={() => handleDeletePartner(partner)}
                  className="rounded-xl bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {partners.length === 0 && (
          <div className="col-span-full py-20 text-center text-white/40">
            <Users className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>{t.noPartnersFound}</p>
          </div>
        )}
      </div>

      {/* Add Partner centered modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#1a0b00] p-8 rounded-[32px] border border-white/20 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8 sticky top-0 bg-[#1a0b00] z-10 pb-2">
                <h2 className="text-2xl font-medium">{t.newPartner}</h2>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleAddPartner} className="space-y-6 pb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{t.partnerName}</label>
                  <input 
                    required autoFocus
                    type="text"
                    value={partnerName}
                    onChange={e => setPartnerName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 outline-none focus:border-pink-500/50"
                    placeholder={t.partnerNamePlaceholder}
                  />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-pink-500 py-4 font-bold active:scale-95 transition-all shadow-lg shadow-pink-500/20">
                  {t.createPartner}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ledger Management View (Centered Modal) */}
      <AnimatePresence>
        {activePartner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActivePartner(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-xl bg-[#0a0502] rounded-[40px] border border-white/10 p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="bg-[#0a0502] pb-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <button 
                    onClick={() => setActivePartner(null)}
                    className="flex items-center gap-2 text-white/40 hover:text-white"
                  >
                    <X className="h-6 w-6" />
                    <span>{t.closeLedger}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold">{activePartner.name}</h2>
                    <p className="text-white/40">{t.partnerLedgerSubtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-white/40">{t.totalBalance}</p>
                    <p className="text-2xl font-bold text-pink-400">
                      {formatPrice(Math.max(0, activePartner.totalGiven - activePartner.totalReturned))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Transaction Form */}
              <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-4 font-medium text-lg">{t.recordTransaction}</h3>
                <form onSubmit={handleAddTransaction} className="space-y-4">
                  <div className="flex gap-2 p-1 bg-black/40 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setTxData({ ...txData, type: 'given' })}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all",
                        txData.type === 'given' ? "bg-green-500 text-white" : "text-white/40"
                      )}
                    >
                      {t.moneyGiven}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setTxData({ ...txData, type: 'returned' })}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all",
                        txData.type === 'returned' ? "bg-yellow-500 text-white" : "text-white/40"
                      )}
                    >
                      {t.moneyReturned}
                    </button>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-white/40 ml-2">{t.amount}</label>
                      <input 
                        required type="number"
                        inputMode="decimal"
                        onFocus={(e) => e.target.select()}
                        value={txData.amount === 0 ? '' : txData.amount}
                        onChange={e => setTxData({ ...txData, amount: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-white/10 bg-black/40 p-4 outline-none focus:border-pink-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-white/40 ml-2">{t.note}</label>
                      <input 
                        type="text"
                        value={txData.note}
                        onChange={e => setTxData({ ...txData, note: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 p-4 outline-none focus:border-pink-500/50"
                        placeholder={t.notePlaceholder}
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full rounded-2xl bg-pink-500 py-4 font-bold active:scale-95 transition-all shadow-lg shadow-pink-500/20">
                    {t.addTransaction}
                  </button>
                </form>
              </div>

              {/* History List */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-medium border-b border-white/10 pb-4">
                  <History className="h-4 w-4 text-white/40" />
                  {t.pastRecords}
                </h3>
                <div className="max-h-[400px] overflow-y-auto pr-2 no-scrollbar space-y-4">
                  {activePartner.history.slice().reverse().map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                        {tx.type === 'given' ? (
                          <ArrowDownCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <ArrowUpCircle className="h-5 w-5 text-yellow-400" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{tx.note || (tx.type === 'given' ? t.moneyGiven : t.moneyReturned)}</p>
                          <p className="text-[10px] text-white/40">{new Date(tx.date).toLocaleString()}</p>
                        </div>
                      </div>
                      <p className={cn("font-bold", tx.type === 'given' ? "text-green-400" : "text-yellow-400")}>
                        {tx.type === 'given' ? '+' : '-'}{formatPrice(tx.amount)}
                      </p>
                    </div>
                  ))}
                  {activePartner.history.length === 0 && (
                    <p className="text-center text-white/40 py-8 italic text-sm">{t.noTransactions}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
