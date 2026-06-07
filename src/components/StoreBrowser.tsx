import React from 'react';
import { motion } from 'motion/react';
import { Store as StoreIcon, MapPin, ArrowRight, Star } from 'lucide-react';
import { Store, Settings } from '../types';
import { updateSettings } from '../lib/dataService';
import { cn } from '../lib/utils';

interface StoreBrowserProps {
  userId: string;
  settings: Settings;
  stores: Store[];
}

export const StoreBrowser: React.FC<StoreBrowserProps> = ({ userId, settings, stores }) => {
  const handleSelectStore = async (storeId: string) => {
    await updateSettings(userId, {
      ...settings,
      storeId: storeId
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0502] p-6 pt-24 md:pt-32">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-serif text-white mb-4 tracking-tight"
          >
            Find Local Stores
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/40 text-lg max-w-2xl"
          >
            Browse high-quality grocery stores in your neighborhood and order directly to your door.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stores.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <StoreIcon className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white/40 font-medium">No stores available in your area yet.</p>
            </div>
          ) : (
            stores.map((store, index) => (
              <motion.div
                key={store.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-white/5 border border-white/10 rounded-[32px] p-6 hover:bg-white/[0.08] transition-all cursor-pointer"
                onClick={() => handleSelectStore(store.id)}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500">
                    <StoreIcon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">New</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-medium text-white mb-1 group-hover:text-orange-400 transition-colors">
                      {store.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-white/40">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-sm">{store.location}</span>
                    </div>
                  </div>

                  <p className="text-white/40 text-sm line-clamp-2 min-h-[40px]">
                    {store.description || "Fresh groceries directly from the owner's inventory."}
                  </p>

                  <div className="pt-4 flex items-center justify-between">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-6 h-6 rounded-full border border-black bg-blue-500/20" />
                       ))}
                       <div className="w-6 h-6 rounded-full border border-black bg-white/5 flex items-center justify-center text-[8px] text-white/40 font-bold">
                         +5
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Shop Now
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
