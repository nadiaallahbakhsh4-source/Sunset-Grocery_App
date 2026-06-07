import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, User, Truck, Check, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { UserRole, Settings } from '../types';
import { cn } from '../lib/utils';
import { SunsetBackdrop } from './SunsetBackdrop';

interface RoleSelectorProps {
  onConfirm: (role: UserRole) => void;
  settings: Settings;
}

const roles: { role: UserRole; title: string; description: string; icon: any; color: string }[] = [
  {
    role: 'owner',
    title: 'Shop Owner',
    description: 'Manage inventory, tracking suppliers, deliveries, and business growth.',
    icon: Store,
    color: 'bg-orange-500'
  },
  {
    role: 'customer',
    title: 'Customer',
    description: 'Browse products, track your orders, and get personalized offers.',
    icon: User,
    color: 'bg-blue-500'
  },
  {
    role: 'supplier',
    title: 'Supplier',
    description: 'Manage supply orders, receive inventory notifications, and update delivery status.',
    icon: Truck,
    color: 'bg-green-500'
  }
];

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onConfirm, settings }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [step, setStep] = useState<'selection' | 'confirmation'>('selection');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep('confirmation');
  };

  const handleConfirm = () => {
    if (selectedRole) {
      onConfirm(selectedRole);
    }
  };

  const selectedRoleData = roles.find(r => r.role === selectedRole);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center bg-[#0a0502] overflow-y-auto no-scrollbar">
      <SunsetBackdrop isLight={settings.theme === 'light'} />
      
      <div className="w-full max-w-7xl px-4 py-12 md:py-20 relative z-10">
        <AnimatePresence mode="wait">
          {step === 'selection' ? (
            <motion.div 
              key="selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full"
            >
              <div className="text-center mb-20 md:mb-32">
                <motion.h1 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-6xl md:text-9xl font-serif text-white mb-8 tracking-tighter"
                >
                  Choose Your Path
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/60 text-xl md:text-2xl max-w-3xl mx-auto font-light leading-relaxed"
                >
                  Your experience will be tailored precisely to your role in the Sunset Grocery ecosystem.
                </motion.p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {roles.map((role, index) => {
                  const Icon = role.icon;
                  return (
                    <motion.button
                      key={role.role}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleRoleSelect(role.role)}
                      className="group relative flex flex-col items-center text-center p-10 rounded-[56px] bg-white/5 border border-white/10 backdrop-blur-2xl hover:bg-white/10 transition-all hover:-translate-y-4 active:scale-95 shadow-2xl"
                    >
                      <div className={cn(
                        "w-28 h-28 rounded-[36px] flex items-center justify-center mb-10 transition-all group-hover:scale-110 group-hover:rotate-3 shadow-xl",
                        role.color,
                        "ring-8 ring-white/5"
                      )}>
                        <Icon className="w-14 h-14 text-white" />
                      </div>
                      <h3 className="text-3xl font-bold text-white mb-4">{role.title}</h3>
                      <p className="text-white/40 text-base leading-relaxed mb-10">
                        {role.description}
                      </p>
                      <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3 text-orange-500 font-black uppercase text-[10px] tracking-[0.3em] bg-orange-500/10 px-6 py-2 rounded-full">
                          Select Role <ArrowRight size={14} />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <div className="flex justify-center">
              <motion.div 
                key="confirmation"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-xl bg-white/5 border border-white/10 backdrop-blur-3xl p-10 md:p-14 rounded-[64px] text-center shadow-2xl"
              >
                <div className="mb-12">
                  <div className="mx-auto w-28 h-28 bg-orange-500/20 rounded-full flex items-center justify-center mb-8 ring-8 ring-orange-500/10">
                    <AlertCircle className="w-14 h-14 text-orange-500" />
                  </div>
                  <h2 className="text-4xl font-serif text-white mb-4">Finalize Entry</h2>
                  <p className="text-white/60 text-lg">Please confirm that you want to proceed as a <span className="text-white font-bold">{selectedRoleData?.title}</span>.</p>
                </div>

                <div className="bg-white/5 rounded-[40px] p-8 mb-12 border border-white/10 text-left">
                  <div className="flex items-center gap-6 mb-6">
                    <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center shadow-2xl", selectedRoleData?.color)}>
                      {selectedRoleData && <selectedRoleData.icon className="w-8 h-8 text-white" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Identity</p>
                      <p className="text-2xl font-bold text-white">{selectedRoleData?.title}</p>
                    </div>
                  </div>
                  <p className="text-white/40 text-sm leading-relaxed italic border-l-2 border-orange-500/20 pl-4">
                    {selectedRoleData?.description}
                  </p>
                </div>

                <div className="flex flex-col gap-5">
                  <button 
                    onClick={handleConfirm}
                    className="w-full py-6 bg-orange-500 text-[#0a0502] rounded-[28px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-orange-400 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-orange-500/20"
                  >
                    <Check size={24} />
                    Confirm My Role
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
