import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Store, MapPin, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { saveGlobalDoc, updateSettings } from '../lib/dataService';
import { Settings, Store as StoreType } from '../types';

interface StoreSetupProps {
  userId: string;
  settings: Settings;
  onComplete: () => void;
}

export const StoreSetup: React.FC<StoreSetupProps> = ({ userId, settings, onComplete }) => {
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !location) return;

    setIsSubmitting(true);
    const storeId = `store_${Date.now()}`;
    
    const newStore: StoreType = {
      id: storeId,
      ownerId: userId,
      name: storeName,
      location: location,
      description: description,
      createdAt: new Date().toISOString()
    };

    try {
      await saveGlobalDoc('stores', newStore);
      await updateSettings(userId, {
        ...settings,
        storeId: storeId,
        shopName: storeName
      });
      onComplete();
    } catch (error) {
      console.error("Store setup failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0502] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 backdrop-blur-xl"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-orange-500/20 text-orange-500 mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif text-white mb-2">Setup Your Store</h1>
          <p className="text-white/40">Enter your store details to start managing your inventory.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-2">Store Name</label>
            <div className="relative">
              <input 
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Sunset Fresh Grocery"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-orange-500/50 transition-all pl-12"
              />
              <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-2">Location</label>
            <div className="relative">
              <input 
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Block 4, North Hills"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-orange-500/50 transition-all pl-12"
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-2">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell your customers what makes your store special..."
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-orange-500/50 transition-all h-32 resize-none"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black h-16 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-orange-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Create Store
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
