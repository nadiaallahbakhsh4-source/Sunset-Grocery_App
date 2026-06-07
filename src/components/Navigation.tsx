import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { Receipt, LayoutDashboard, Package, ShoppingCart, HeartHandshake, Sparkles, Wallet, Settings as SettingsIcon, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';
import { Settings } from '../types';
import { translations } from '../lib/translations';

interface NavigationProps {
  settings: Settings;
  onOpenSettings: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ settings, onOpenSettings }) => {
  const t = translations[settings.language] || translations.en;

  const navItems = [
    { path: '/', label: t.dashboard, icon: LayoutDashboard },
    ...(settings.role === 'owner' || !settings.role ? [
      { path: '/inventory', label: t.inventory, icon: Package },
      { path: '/billing', label: t.salesAndBilling || 'Sales & Billing', icon: Receipt },
      { path: '/partners', label: t.partners, icon: HeartHandshake },
      { path: '/credits', label: t.credits || 'Credits', icon: Wallet },
      { path: '/audit', label: t.dailyAudit || 'Daily Audit', icon: Calculator },
    ] : []),
    ...(settings.role === 'customer' ? [
      { path: '/orders', label: 'My Orders', icon: ShoppingCart },
    ] : []),
    ...(settings.role === 'supplier' ? [
      { path: '/supply-orders', label: 'Supply Orders', icon: Receipt },
    ] : []),
    { path: '/blessings', label: t.blessings, icon: Sparkles },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 flex w-[92%] -translate-x-1/2 items-center gap-1 overflow-x-auto no-scrollbar rounded-3xl border border-white/10 bg-black/80 px-2 py-1.5 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:scale-[1.01] md:top-6 md:bottom-auto md:w-auto md:justify-start md:rounded-full md:px-3 md:py-2 flex-nowrap whitespace-nowrap">
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            cn(
              "relative flex flex-none flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 transition-all duration-300 md:flex-row md:gap-3 md:rounded-full md:px-5 md:py-2.5",
              isActive 
                ? "text-black" 
                : "text-white/40 hover:bg-white/5 hover:text-white"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div 
                  layoutId="nav-bg"
                  className="absolute inset-0 z-0 rounded-[inherit] bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
              )}
              <Icon 
                className={cn(
                  "relative z-10 h-4.5 w-4.5 shrink-0 transition-transform duration-300 md:h-5 md:w-5",
                  isActive ? "scale-110" : "scale-100"
                )} 
              />
              <span className="relative z-10 text-[7px] font-black uppercase tracking-widest md:text-[10px]">
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
      
      <button
        onClick={onOpenSettings}
        className="relative flex flex-none flex-col items-center justify-center gap-1 rounded-2xl px-4 py-2.5 transition-all duration-300 md:flex-row md:gap-3 md:rounded-full md:px-5 md:py-2.5 text-white/40 hover:bg-white/5 hover:text-white"
      >
        <SettingsIcon className="relative z-10 h-4.5 w-4.5 shrink-0" />
        <span className="relative z-10 text-[8px] font-black uppercase tracking-widest md:text-[10px]">
          {t.settings}
        </span>
      </button>
    </nav>
  );
};
