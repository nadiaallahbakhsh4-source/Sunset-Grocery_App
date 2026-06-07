import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Package, ShoppingCart, TrendingUp, DollarSign, Settings as SettingsIcon, X, Check, BrainCircuit, Sparkles, Loader2, Moon, Sun, AlertTriangle, Search } from 'lucide-react';
import { Item, Sale, Settings, Currency, Language } from '../types';
import { cn } from '../lib/utils';
import { AnimatePresence } from 'motion/react';
import { generateInventoryInsight } from '../services/geminiService';
import { translations } from '../lib/translations';

interface DashboardProps {
  items: Item[];
  sales: Sale[];
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  formatPrice: (amount: number) => string;
  onOpenSettings: () => void;
}

import { useFirebase } from '../components/FirebaseProvider';
import { updateSettings } from '../lib/dataService';
import { OwnerManagement } from '../components/OwnerManagement';

const getLocalLabels = (lang: Language) => {
  const dict = {
    en: {
      specificItemsInStock: "Specific Items in Stock",
      itemizedSubtitle: "A complete list of active stock items, carton/bag breakdowns, and large-scale bulk conversions.",
      searchPlaceholder: "Search by product name or category...",
      columnItem: "Item Details",
      columnQuantity: "Available Stock",
      columnCartons: "Cartons",
      columnBags: "Bags",
      columnBulk: "Large-Scale Qty",
      columnStatus: "Availability",
      statusAvailable: "In Stock",
      statusOutOfStock: "Out of Stock",
      all: "All Items",
      available: "In Stock",
      outOfStock: "Out / Low Stock",
      cartonShorthand: "Cartons",
      bagShorthand: "Bags",
      bulkShorthand: "Large Unit",
    },
    ur: {
      specificItemsInStock: "اسٹاک میں موجود مخصوص اشیاء",
      itemizedSubtitle: "فعال اسٹاک اشیاء کی مکمل فہرست، کارٹن/بیگ کی تفصیل، اور ہول سیل بلک یونٹ کی شرح۔",
      searchPlaceholder: "پروڈکٹ کا نام یا زمرہ تلاش کریں...",
      columnItem: "پروڈکٹ کی تفصیل",
      columnQuantity: "دستیاب اسٹاک",
      columnCartons: "کارٹن",
      columnBags: "بوریاں",
      columnBulk: "بلک مقدار",
      columnStatus: "دستیابی",
      statusAvailable: "دستیاب",
      statusOutOfStock: "ختم",
      all: "تمام اشیاء",
      available: "دستیاب",
      outOfStock: "ختم شدہ اسٹاک",
      cartonShorthand: "کارٹن",
      bagShorthand: "بوریاں",
      bulkShorthand: "بلک یونٹ",
    },
    zh: {
      specificItemsInStock: "库存具体商品",
      itemizedSubtitle: "活动库存商品、纸箱/袋子细分以及大宗散装换算的完整列表。",
      searchPlaceholder: "按产品名称或类别搜索...",
      columnItem: "商品详情",
      columnQuantity: "可用库存",
      columnCartons: "纸箱",
      columnBags: "袋",
      columnBulk: "大宗数量",
      columnStatus: "可用性",
      statusAvailable: "有货",
      statusOutOfStock: "缺货",
      all: "所有商品",
      available: "有货",
      outOfStock: "缺货/低库存",
      cartonShorthand: "纸箱",
      bagShorthand: "袋",
      bulkShorthand: "大宗单位",
    },
    es: {
      specificItemsInStock: "Artículos específicos en existencias",
      itemizedSubtitle: "Lista completa de artículos de stock activos, desglose de cartón/bolsa y conversiones a granel.",
      searchPlaceholder: "Buscar por nombre de producto o categoría...",
      columnItem: "Detalles del artículo",
      columnQuantity: "Existencias disponibles",
      columnCartons: "Cajas de cartón",
      columnBags: "Sacos",
      columnBulk: "Unidad grande",
      columnStatus: "Disponibilidad",
      statusAvailable: "En Stock",
      statusOutOfStock: "Agotado",
      all: "Todos los artículos",
      available: "En Stock",
      outOfStock: "Agotado/Bajo",
      cartonShorthand: "Cartones",
      bagShorthand: "Bolsas",
      bulkShorthand: "Gran escala",
    },
    hi: {
      specificItemsInStock: "स्टॉक में विशिष्ट वस्तुएं",
      itemizedSubtitle: "सक्रिय स्टॉक वस्तुओं, कार्टन/बैग विश्लेषण और बड़े पैमाने पर थोक रूपांतरणों की पूरी सूची।",
      searchPlaceholder: "उत्पाद का नाम या श्रेणी खोजें...",
      columnItem: "उत्पाद विवरण",
      columnQuantity: "उपलब्ध स्टॉक",
      columnCartons: "कार्टन",
      columnBags: "बैग",
      columnBulk: "थोक मात्रा",
      columnStatus: "उपलब्धता",
      statusAvailable: "स्टॉक में",
      statusOutOfStock: "स्टॉक से बाहर",
      all: "सभी वस्तुएं",
      available: "स्टॉक में",
      outOfStock: "आउट ऑफ स्टॉक / कम",
      cartonShorthand: "कार्टन",
      bagShorthand: "बैग",
      bulkShorthand: "बड़ा यूनिट",
    },
    ar: {
      specificItemsInStock: "المنتجات المحددة في المخزون",
      itemizedSubtitle: "قائمة كاملة بمنتجات المخزون النشطة، تفاصيل الكراتين/الأكياس، والتحويلات بالجملة.",
      searchPlaceholder: "البحث عن طريق اسم المنتج أو الفئة...",
      columnItem: "تفاصيل المنتج",
      columnQuantity: "المخزون المتوفر",
      columnCartons: "كراتين",
      columnBags: "أكياس",
      columnBulk: "الكمية بالجملة",
      columnStatus: "حالة التوفر",
      statusAvailable: "متوفر",
      statusOutOfStock: "غير متوفر",
      all: "جميع المنتجات",
      available: "متوفر",
      outOfStock: "غير متوفر / منخفض",
      cartonShorthand: "كراتين",
      bagShorthand: "أكياس",
      bulkShorthand: "وحدة كبيرة",
    }
  };
  return dict[lang] || dict.en;
};

export const Dashboard: React.FC<DashboardProps> = ({ items, sales, settings, formatPrice, onOpenSettings }) => {
  const { user, logout, updateUserName, updateUserPassword, updateUserEmail } = useFirebase();
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'outOfStock'>('all');
  
  const t = translations[settings.language] || translations.en;
  const labels = getLocalLabels(settings.language);

  const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    await updateSettings(user.uid, updated);
  };

  const rawTotalStock = items.reduce((acc, item) => acc + item.stock, 0);
  const totalStock = rawTotalStock % 1 === 0 ? rawTotalStock : Number(rawTotalStock.toFixed(2));
  const rawTotalSold = sales.reduce((acc, sale) => acc + sale.quantity, 0);
  const totalSold = rawTotalSold % 1 === 0 ? rawTotalSold : Number(rawTotalSold.toFixed(2));
  const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalPrice, 0);
  const totalProfit = sales.reduce((acc, sale) => acc + sale.profit, 0);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) || 
                          item.category.toLowerCase().includes(itemSearchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterMode === 'available') {
      return item.stock > 0;
    } else if (filterMode === 'outOfStock') {
      return item.stock === 0 || item.stock <= 5;
    }
    return true;
  });

  const getItemPackagingStats = (item: Item) => {
    const capacity = item.capacityPerSack || 0;
    const hasBulk = capacity > 0;
    const sUnit = (item.sackUnit || '').trim().toLowerCase();

    // Classify standard packaging
    const isCartonStyle = ['box', 'boxes', 'carton', 'cartons', 'tin', 'tins', 'case', 'cases'].includes(sUnit) || (!item.isWeightBased && hasBulk);
    const isBagStyle = ['bag', 'bags', 'sack', 'sacks', 'pack', 'packs'].includes(sUnit) || (item.isWeightBased && hasBulk && !isCartonStyle);

    let numCartons = 0;
    let numBags = 0;
    let largeScaleQty = 0;
    let largeScaleUnitLabel = item.sackUnit || (isCartonStyle ? 'carton' : 'bag');

    if (hasBulk) {
      largeScaleQty = Number((item.stock / capacity).toFixed(2));
      if (isCartonStyle) {
        numCartons = largeScaleQty;
      }
      if (isBagStyle) {
        numBags = largeScaleQty;
      }
    }

    return {
      numCartons,
      numBags,
      largeScaleQty,
      largeScaleUnitLabel,
      hasBulk
    };
  };

  const stats = [
    { label: t.totalStock, value: totalStock, icon: Package, color: 'text-blue-400' },
    { label: t.totalSold, value: totalSold, icon: ShoppingCart, color: 'text-orange-400' },
    { label: t.totalRevenue, value: formatPrice(totalRevenue), icon: DollarSign, color: 'text-green-400' },
    { label: t.netProfit, value: formatPrice(totalProfit), icon: TrendingUp, color: 'text-yellow-400' },
  ];

  const currencies: { code: Currency; name: string }[] = [
    { code: 'PKR', name: 'Pakistani Rupee (PKR)' },
    { code: 'USD', name: 'US Dollar (USD)' },
    { code: 'CNY', name: 'Chinese Yuan (CNY)' },
    { code: 'EUR', name: 'Euro (EUR)' },
    { code: 'GBP', name: 'British Pound (GBP)' },
    { code: 'INR', name: 'Indian Rupee (INR)' },
    { code: 'JPY', name: 'Japanese Yen (JPY)' },
    { code: 'CAD', name: 'Canadian Dollar (CAD)' },
    { code: 'AUD', name: 'Australian Dollar (AUD)' },
    { code: 'AED', name: 'UAE Dirham (AED)' },
    { code: 'SAR', name: 'Saudi Riyal (SAR)' },
  ];

  const languages: { code: Language; name: string; native: string }[] = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'ur', name: 'Urdu', native: 'اردو' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  ];

  const fetchInsight = async () => {
    setIsLoadingInsight(true);
    const result = await generateInventoryInsight(items, sales);
    if (result) setInsight(result);
    setIsLoadingInsight(false);
  };

  useEffect(() => {
    // Optional: Auto fetch on load if not present
    if (!insight && items.length > 0) {
      // We don't want to spam the API on every render, so maybe just once or on demand
    }
  }, [items]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-start justify-between">
        <div className="space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "text-4xl font-light tracking-tight md:text-6xl",
              settings.theme === 'light' ? "text-slate-900" : "text-white"
            )}
          >
            {settings.shopName.split(' ')[0]} <span className="font-medium text-orange-400">{settings.shopName.split(' ').slice(1).join(' ') || t.dashboardOverview}</span>
          </motion.h1>
          <p className={cn(
            "text-white/60",
            settings.theme === 'light' && "text-slate-600/60"
          )}>{t.dashboardSubtitle}</p>
        </div>
        
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchInsight}
            disabled={isLoadingInsight}
            className={cn(
              "rounded-2xl border p-4 transition-all disabled:opacity-50",
              settings.theme === 'light' 
                ? "border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20" 
                : "border-orange-500/20 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10"
            )}
          >
            {isLoadingInsight ? <Loader2 className="h-6 w-6 animate-spin" /> : <BrainCircuit className="h-6 w-6" />}
          </motion.button>
          <motion.button
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onOpenSettings}
            className={cn(
              "rounded-2xl border p-4 transition-all",
              settings.theme === 'light'
                ? "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 shadow-sm"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            )}
          >
            <SettingsIcon className="h-6 w-6" />
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {insight && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "relative overflow-hidden rounded-[32px] border p-8 backdrop-blur-xl",
              settings.theme === 'light'
               ? "border-orange-200 bg-white/80 shadow-lg shadow-orange-500/5"
                : "border-orange-500/30 bg-orange-500/5 shadow-2xl"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-orange-500/20 p-2 shrink-0 mt-1">
                <Sparkles className="h-4 w-4 text-orange-400" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className={cn(
                    "text-xl font-medium mb-1",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>{t.aiInsightsTitle}</h3>
                  <p className={cn(
                    "text-xs opacity-60 mb-4",
                    settings.theme === 'light' ? "text-slate-600" : "text-white/60"
                  )}>{t.aiInsightsSubtitle}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-400/60">English</p>
                  <p className={cn(
                    "text-sm italic leading-relaxed",
                    settings.theme === 'light' ? "text-slate-700" : "text-white/90"
                  )}>
                    {insight.split('---')[0].trim()}
                  </p>
                </div>
                {insight.includes('---') && (
                  <div className="space-y-1 border-t border-orange-500/10 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-400/60 text-right">Urdu</p>
                    <p className={cn(
                      "text-lg leading-relaxed text-right font-medium",
                      settings.theme === 'light' ? "text-slate-900" : "text-white/95"
                    )} dir="rtl">
                      {insight.split('---')[1].trim()}
                    </p>
                  </div>
                )}
                <div className="pt-2">
                   <button 
                     onClick={fetchInsight}
                     disabled={isLoadingInsight}
                     className={cn(
                       "flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all",
                       settings.theme === 'light' ? "text-orange-600 hover:text-orange-700" : "text-orange-400 hover:text-orange-300",
                       isLoadingInsight && "opacity-50 cursor-not-allowed"
                     )}
                   >
                     {isLoadingInsight ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                     {t.generateNew}
                   </button>
                </div>
              </div>
              <button 
                onClick={() => setInsight(null)}
                className={cn(
                  "ml-auto transition-colors p-2",
                  settings.theme === 'light' ? "text-slate-300 hover:text-slate-600" : "text-white/20 hover:text-white"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "group relative shrink-0 w-[240px] overflow-hidden rounded-3xl border p-6 backdrop-blur-md transition-all sm:w-full",
              settings.theme === 'light'
                ? "border-slate-200 bg-white hover:bg-slate-50 shadow-sm shadow-slate-200/50"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            )}
          >
            <div className={cn("mb-4 inline-flex rounded-2xl p-3 shadow-inner", 
              stat.color.replace('text-', 'bg-').replace('400', '400/10'))}>
              <stat.icon className={cn("h-6 w-6", stat.color)} />
            </div>
            <div className="space-y-1">
              <p className={cn(
                "text-sm font-medium uppercase tracking-wider",
                settings.theme === 'light' ? "text-slate-400" : "text-white/40"
              )}>{stat.label}</p>
              <p className={cn(
                "text-3xl font-bold tracking-tight",
                settings.theme === 'light' ? "text-slate-900" : "text-white"
              )}>{stat.value}</p>
            </div>
            
            {/* Subtle glow effect */}
            <div className={cn(
              "absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl transition-opacity group-hover:opacity-100",
              settings.theme === 'light' ? "bg-slate-200/40" : "bg-white/5"
            )} />
          </motion.div>
        ))}
      </div>

      <OwnerManagement 
        settings={settings} 
        formatPrice={formatPrice} 
        sales={sales}
        items={items}
        userId={user.uid}
      />

      {/* Specific Items Stock & Packaging Breakdown */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-[32px] border p-8 backdrop-blur-md space-y-6",
          settings.theme === 'light'
            ? "border-slate-200 bg-white/80 shadow-sm"
            : "border-white/10 bg-black/20"
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className={cn(
              "text-2xl font-light tracking-tight",
              settings.theme === 'light' ? "text-slate-900" : "text-white"
            )}>
              {labels.specificItemsInStock}
            </h2>
            <p className={cn(
              "text-xs leading-relaxed max-w-2xl",
              settings.theme === 'light' ? "text-slate-500" : "text-white/40"
            )}>
              {labels.itemizedSubtitle}
            </p>
          </div>
          
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'available', 'outOfStock'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                  filterMode === mode
                    ? (settings.theme === 'light'
                        ? "bg-slate-900 text-white"
                        : "bg-orange-400 text-slate-950 shadow-md shadow-orange-500/10")
                    : (settings.theme === 'light'
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-white/5 text-white/60 hover:bg-white/10")
                )}
              >
                {labels[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className={cn(
            "absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2",
            settings.theme === 'light' ? "text-slate-400" : "text-white/30"
          )} />
          <input
            type="text"
            value={itemSearchQuery}
            onChange={(e) => setItemSearchQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className={cn(
              "w-full rounded-2xl border py-3.5 pl-11 pr-4 text-sm outline-none transition-all",
              settings.theme === 'light'
                ? "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-sm"
                : "border-white/10 bg-white/5 text-white placeholder-white/30 focus:border-orange-500/50 focus:bg-white/10"
            )}
          />
        </div>

        {/* Items Grid & Tables */}
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/5">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto animate-fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={cn(
                  "border-b text-xs font-semibold uppercase tracking-wider",
                  settings.theme === 'light' ? "border-slate-200/50 bg-slate-50 text-slate-500" : "border-white/5 bg-white/5 text-white/40"
                )}>
                  <th className="p-4 pl-6">{labels.columnItem}</th>
                  <th className="p-4">{labels.columnQuantity}</th>
                  <th className="p-4 text-center">{labels.columnCartons}</th>
                  <th className="p-4 text-center">{labels.columnBags}</th>
                  <th className="p-4 text-right pr-6">{labels.columnBulk}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredItems.map((item) => {
                  const stats = getItemPackagingStats(item);
                  const isAvailable = item.stock > 0;
                  
                  return (
                    <tr 
                      key={item.id}
                      className={cn(
                        "transition-all",
                        settings.theme === 'light' 
                          ? "hover:bg-slate-50/50 text-slate-700" 
                          : "hover:bg-white/5 text-white/80"
                      )}
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center p-2.5",
                            settings.theme === 'light'
                              ? "bg-slate-100 text-slate-600"
                              : "bg-white/5 text-white/70",
                            !isAvailable && "bg-red-500/10 text-red-500"
                          )}>
                            <Package className="h-full w-full" />
                          </div>
                          <div>
                            <p className={cn(
                              "font-medium",
                              settings.theme === 'light' ? "text-slate-900" : "text-white",
                              !isAvailable && "text-red-500/50 line-through"
                            )}>{item.name}</p>
                            <span className={cn(
                              "text-[10px] font-semibold uppercase tracking-wider block",
                              settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                            )}>{item.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-base",
                            settings.theme === 'light' ? "text-slate-800" : "text-white/90",
                            !isAvailable && "text-red-500"
                          )}>
                            {item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded",
                            settings.theme === 'light' ? "bg-slate-100 text-slate-500" : "bg-white/10 text-white/50"
                          )}>
                            {item.saleUnit || item.unit || 'units'}
                          </span>
                          <span className={cn(
                            "ml-2 h-2 w-2 rounded-full inline-block",
                            isAvailable ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                          )} />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {stats.numCartons > 0 ? (
                          <span className="font-mono text-xs px-2.5 py-1 rounded-lg font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-sm animate-fade-in">
                            {stats.numCartons} {labels.cartonShorthand}
                          </span>
                        ) : (
                          <span className={cn("text-xs font-mono opacity-20", settings.theme === 'light' ? "text-slate-400" : "text-white")}>0</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {stats.numBags > 0 ? (
                          <span className="font-mono text-xs px-2.5 py-1 rounded-lg font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-sm animate-fade-in">
                            {stats.numBags} {labels.bagShorthand}
                          </span>
                        ) : (
                          <span className={cn("text-xs font-mono opacity-20", settings.theme === 'light' ? "text-slate-400" : "text-white")}>0</span>
                        )}
                      </td>
                      <td className="p-4 text-right pr-6">
                        {stats.hasBulk ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-sm font-bold text-orange-400">
                              {stats.largeScaleQty}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                            )}>
                              {stats.largeScaleUnitLabel}s
                            </span>
                          </div>
                        ) : (
                          <span className={cn("text-xs italic opacity-25", settings.theme === 'light' ? "text-slate-400" : "text-white")}>N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className={cn(
                      "p-12 text-center text-sm italic",
                      settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                    )}>
                      {t.noItems || "No matching items found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile High-Fidelity Card List View */}
          <div className="block md:hidden divide-y divide-white/5">
            {filteredItems.map((item) => {
              const stats = getItemPackagingStats(item);
              const isAvailable = item.stock > 0;
              
              return (
                <div 
                  key={item.id}
                  className={cn(
                    "p-5 space-y-4 transition-all",
                    settings.theme === 'light' ? "hover:bg-slate-50/55" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center p-2",
                        settings.theme === 'light' ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/70",
                        !isAvailable && "bg-red-500/10 text-red-500"
                      )}>
                        <Package className="h-full w-full" />
                      </div>
                      <div>
                        <h4 className={cn(
                          "font-medium text-sm",
                          settings.theme === 'light' ? "text-slate-900" : "text-white",
                          !isAvailable && "text-red-500/50 line-through"
                        )}>{item.name}</h4>
                        <span className={cn(
                          "text-[10px] uppercase font-bold tracking-wider block",
                          settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                        )}>{item.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                        isAvailable 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                      )}>
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isAvailable ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                        )} />
                        {isAvailable ? labels.statusAvailable : labels.statusOutOfStock}
                      </span>
                    </div>
                  </div>

                  {/* Stock Counts Row */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className={cn(
                      "rounded-xl p-3 border",
                      settings.theme === 'light' ? "bg-slate-50/50 border-slate-100" : "bg-white/5 border-white/5"
                    )}>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-wider mb-1",
                        settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                      )}>{labels.columnQuantity}</p>
                      <div className="flex items-baseline gap-1">
                        <span className={cn(
                          "text-xl font-bold",
                          settings.theme === 'light' ? "text-slate-800" : "text-white"
                        )}>{item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))}</span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase",
                          settings.theme === 'light' ? "text-slate-400" : "text-white/40"
                        )}>{item.saleUnit || item.unit || 'units'}</span>
                      </div>
                    </div>

                    <div className={cn(
                      "rounded-xl p-3 border",
                      settings.theme === 'light' ? "bg-slate-50/50 border-slate-100" : "bg-white/5 border-white/5"
                    )}>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-wider mb-1",
                        settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                      )}>{labels.columnBulk}</p>
                      {stats.hasBulk ? (
                        <div className="flex items-baseline gap-1 animate-fade-in">
                          <span className="text-xl font-bold text-orange-400">{stats.largeScaleQty}</span>
                          <span className="text-[10px] font-bold uppercase text-orange-400/80">{stats.largeScaleUnitLabel}s</span>
                        </div>
                      ) : (
                        <p className={cn("text-xs font-semibold italic opacity-40", settings.theme === 'light' ? "text-slate-400" : "text-white")}>N/A</p>
                      )}
                    </div>
                  </div>

                  {/* Cartons and Bags break out for mobile */}
                  {(stats.numCartons > 0 || stats.numBags > 0) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {stats.numCartons > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <span>📦 {stats.numCartons} {labels.cartonShorthand}</span>
                        </div>
                      )}
                      {stats.numBags > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span>🛍️ {stats.numBags} {labels.bagShorthand}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className={cn(
                "p-12 text-center text-sm italic",
                settings.theme === 'light' ? "text-slate-400" : "text-white/30"
              )}>
                {t.noItems || "No matching items found."}
              </div>
            )}
          </div>
        </div>
      </motion.section>


      <div className="grid gap-8 lg:grid-cols-2">
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "rounded-3xl border p-8 backdrop-blur-md",
            settings.theme === 'light'
              ? "border-slate-200 bg-white/80 shadow-sm"
              : "border-white/10 bg-black/20"
          )}
        >
          <h2 className={cn(
            "mb-6 text-xl font-medium",
            settings.theme === 'light' ? "text-slate-900" : "text-white"
          )}>{t.recentSales}</h2>
          <div className="space-y-4">
            {sales.slice(-5).reverse().map((sale) => (
              <div key={sale.id} className={cn(
                "flex items-center justify-between border-b pb-4 last:border-0",
                settings.theme === 'light' ? "border-slate-100" : "border-white/5"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center",
                    settings.theme === 'light' ? "bg-orange-500/5" : "bg-white/5"
                  )}>
                    <ShoppingCart className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium",
                      settings.theme === 'light' ? "text-slate-900" : "text-white"
                    )}>{sale.itemName}</p>
                    <div className="flex items-center gap-2">
                       <p className={cn(
                         "text-[10px]",
                         settings.theme === 'light' ? "text-slate-400" : "text-white/40"
                       )}>{new Date(sale.date).toLocaleDateString()}</p>
                       <span className="text-[10px] text-white/20">•</span>
                       <span className="text-[10px] text-blue-400/60 font-medium uppercase tracking-tighter">{t.payment}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-semibold",
                    settings.theme === 'light' ? "text-green-600" : "text-green-400"
                  )}>{sale.totalPrice >= 0 ? '+' : ''}{formatPrice(sale.totalPrice)}</p>
                  <p className={cn(
                    "text-[10px]",
                    settings.theme === 'light' ? "text-slate-400" : "text-white/40"
                  )}>{sale.quantity} {t.units}</p>
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className={cn(
              "text-center py-8",
              settings.theme === 'light' ? "text-slate-300 italic" : "text-white/40"
            )}>{t.noSalesRecorded}</p>}
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "rounded-3xl border p-8 backdrop-blur-md",
            settings.theme === 'light'
              ? "border-slate-200 bg-white/80 shadow-sm"
              : "border-white/10 bg-black/20"
          )}
        >
          <div className="mb-6 flex items-center gap-2">
            <AlertTriangle className={cn(
              "h-5 w-5",
               items.some(i => i.stock === 0) ? "text-red-500 animate-pulse" : "text-yellow-500"
            )} />
            <h2 className={cn(
              "text-xl font-medium",
              settings.theme === 'light' ? "text-slate-900" : "text-white"
            )}>{t.lowStockAlerts}</h2>
          </div>
          <div className="space-y-4">
            {items
              .filter(item => item.stock <= 5)
              .sort((a, b) => a.stock - b.stock)
              .map((item) => (
              <div key={item.id} className={cn(
                "flex items-center justify-between border-b pb-4 last:border-0",
                settings.theme === 'light' ? "border-slate-100" : "border-white/5"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center bg-black/20",
                    item.stock === 0 && "bg-red-500/10"
                  )}>
                    <Package className={cn("h-4 w-4", item.stock === 0 ? "text-red-500" : "text-blue-400")} />
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium",
                      settings.theme === 'light' ? "text-slate-900" : "text-white",
                      item.stock === 0 && "text-red-500 font-bold"
                    )}>{item.name}</p>
                    <p className={cn(
                      "text-xs",
                      settings.theme === 'light' ? "text-slate-400" : "text-white/40"
                    )}>{item.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                    item.stock === 0 
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                      : "bg-yellow-500/20 text-yellow-500"
                  )}>
                    {item.stock === 0 ? t.critical : `${item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))} ${t.stock}`}
                  </span>
                </div>
              </div>
            ))}
            {items.filter(item => item.stock <= 5).length === 0 && (
              <p className={cn(
                "text-center py-8",
                settings.theme === 'light' ? "text-slate-300 italic" : "text-white/40"
              )}>{t.allStockHealthy}</p>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};
