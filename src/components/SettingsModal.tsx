import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Sun, Moon, Package, ShoppingCart, TrendingUp, DollarSign, BrainCircuit, Sparkles, Loader2, AlertTriangle, Database, DownloadCloud, RotateCcw, Trash2, Calendar, Download } from 'lucide-react';
import { Settings, Currency, Language, UserRole, Item, Sale } from '../types';
import { cn } from '../lib/utils';
import { translations } from '../lib/translations';
import { useFirebase } from './FirebaseProvider';
import { 
  clearShopRecords,
  createDatabaseBackup,
  fetchDatabaseBackups,
  deleteDatabaseBackup,
  restoreDatabaseFromBackup,
  saveGlobalDoc,
  syncData,
  deleteData,
  saveData
} from '../lib/dataService';

const resetTranslations: Record<string, { title: string; subtitle: string; button: string; confirm: string; success: string; processing: string }> = {
  en: {
    title: "Danger Zone",
    subtitle: "Irreversibly delete all inventory, sales, credits, partners, invoices, blessings, and salaries.",
    button: "Reset All Shop Records",
    confirm: "CRITICAL ACTION REQUIRED!\n\nAre you absolutely sure you want to delete ALL inventory items, sales records, partner histories, invoices, customer debts, and blessing logs?\n\nThis action CANNOT be undone.",
    success: "Success! All records have been permanently deleted.",
    processing: "Clearing records..."
  },
  ur: {
    title: "خطرناک زون",
    subtitle: "تمام انوینٹری، سیلز، ادھار، شراکت دار، انوائسز، برکات، اور تنخواہوں کو ہمیشہ کے لیے حذف کریں۔",
    button: "تمام اسٹور برائے فروخت کا ریکارڈ ری سیٹ کریں",
    confirm: "کیا آپ واقعی تمام انوینٹری اشیاء، فروخت کا ریکارڈ، شراکت داروں کی تاریخ، انوائسز، اور برکات کا ریکارڈ مستقل طور پر حذف کرنا چاہتے ہیں؟\n\nیہ عمل واپس نہیں لیا جا سکتا۔",
    success: "کامیابی! تمام ریکارڈ مستقل طور پر حذف کر دیے گئے ہیں۔",
    processing: "ریکارڈ صاف ہو رہے ہیں..."
  },
  es: {
    title: "Zona de Peligro",
    subtitle: "Eliminar de forma irreversible todo el inventario, ventas, créditos, socios, facturas, bendiciones y salarios.",
    button: "Restablecer todos los registros",
    confirm: "¡ACCIÓN CRÍTICA REQUERIDA!\n\n¿Está absolutamente seguro de que desea eliminar TODOS los artículos del inventario, registros de ventas, historiales de socios, facturas, deudas de clientes y registros de bendiciones?\n\nEsta acción NO se puede deshacer.",
    success: "¡Éxito! Todos los registros han sido eliminados de forma permanente.",
    processing: "Borrando registros..."
  },
  zh: {
    title: "危险区域",
    subtitle: "不可逆地删除所有库存、销售、信用、合作伙伴、发票、祝福和工资记录。",
    button: "重置所有店铺记录",
    confirm: "需要执行关键操作！\n\n您确定要永久删除所有库存商品、销售记录、合作伙伴历史、发票、客户债务和祝福日志吗？\n\n此操作无法撤销。",
    success: "成功！所有记录均已永久删除。",
    processing: "正在清除记录..."
  },
  ar: {
    title: "منطقة الخطر",
    subtitle: "حذف جميع المخزونات والمبيعات والديون والشركاء والفواتير والبركات والرواتب بشكل لا رجعة فيه.",
    button: "إعادة تعيين كافة سجلات المتجر",
    confirm: "مطلوب إجراء حاسم!\n\nهل أنت متأكد تمامًا من رغبتك في حذف جميع عناصر المخزون وسجلات المبيعات وتاريخ الشركاء والفواتير وديون العملاء وسجلات البركات؟\n\nهذا الإجراء لا يمكن التراجع عنه.",
    success: "تم بنجاح! تم حذف جميع السجلات بشكل دائم.",
    processing: "جاري مسح السجلات..."
  },
  hi: {
    title: "खतरनाक क्षेत्र",
    subtitle: "सभी इन्वेंट्री, बिक्री, क्रेडिट, पार्टनर, चालान, आशीर्वाद और वेतन को स्थायी रूप से हटा दें।",
    button: "सभी दुकान रिकॉर्ड रीसेट करें",
    confirm: "महत्वपूर्ण कार्रवाई की आवश्यकता है!\n\nक्या आप वास्तव में सभी इन्वेंट्री आइटम, बिक्री रिकॉर्ड, पार्टनर इतिहास, चालान, ग्राहक ऋण और आशीर्वाद लॉग को स्थायी रूप से हटाना चाहते हैं?\n\nयह कार्रवाई वापस नहीं ली जा सकती।",
    success: "सफलता! सभी रिकॉर्ड स्थायी रूप से हटा दिए गए हैं।",
    processing: "रिकॉर्ड हटाए जा रहे हैं..."
  }
};

const voiceSettingsTranslations: Record<Language, { sectionTitle: string; title: string; desc: string }> = {
  en: {
    sectionTitle: "Shop Features",
    title: "Voice-To-Text Inputs",
    desc: "Show microphone hands-free input buttons beside product names and descriptions"
  },
  ur: {
    sectionTitle: "اسٹور کی خصوصیات",
    title: "وائس ٹو ٹیکسٹ ان پٹس",
    desc: "پروڈکٹ کے ناموں اور تفصیلات کے پاس ہینڈز فری مائیکروفون بٹن دکھائیں"
  },
  zh: {
    sectionTitle: "店铺功能",
    title: "语音转文字输入",
    desc: "在商品名称和描述旁显示免提麦克风输入按钮"
  },
  es: {
    sectionTitle: "Funciones de la Tienda",
    title: "Entradas de Voz a Texto",
    desc: "Mostrar botones de entrada de micrófono manos libres junto a los nombres y descripciones de los productos"
  },
  ar: {
    sectionTitle: "ميزات المتجر",
    title: "إدخالات الصوت إلى نص",
    desc: "عرض أزرار ميكروفون الإدخال اللايدوي بجوار أسماء المنتجات وأوصافها"
  },
  hi: {
    sectionTitle: "दुकान की विशेषताएं",
    title: "वॉयस-टू-टेक्स्ट इनपुट",
    desc: "उत्पाद के नामों और विवरणों के पास हैंड्स-फ्री माइक्रोफ़ोन इनपुट बटन दिखाएं"
  }
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  items?: Item[];
  sales?: Sale[];
  onLogout?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings,
  items = [],
  sales = [],
  onLogout
}) => {
  const { user, logout, updateUserName, updateUserPassword, updateUserEmail } = useFirebase();
  const t = translations[settings.language] || translations.en;

  const [isChangingRole, setIsChangingRole] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const resetT = resetTranslations[settings.language] || resetTranslations.en;

  const [localShopName, setLocalShopName] = useState(settings.shopName || '');
  const [localShopPhone, setLocalShopPhone] = useState(settings.shopPhone || '');
  const [localShopAddress, setLocalShopAddress] = useState(settings.shopAddress || '');
  const [localBrightness, setLocalBrightness] = useState(settings.brightness || 100);
  const [localPin, setLocalPin] = useState(settings.pinCode || '');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [backups, setBackups] = useState<any[]>([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);

  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const unsub = syncData(user.uid, 'devices', setDevices);
    return unsub;
  }, [isOpen, user]);

  const exportToCSV = (filename: string, headers: string[], rows: string[][]) => {
    const escapeCell = (cell: any) => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map(row => row.map(escapeCell).join(','))
    ].join('\n');

    // BOM for Excel compatibility with UTF-8
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportInventory = () => {
    if (!items || items.length === 0) {
      alert("No active inventory item records found to export.");
      return;
    }

    const headers = [
      "Item ID",
      "Item Name",
      "Category",
      "Stock Qty",
      "Unit",
      "Cost Price",
      "Sell Price",
      "Total Cost Value",
      "Total Sell Value",
      "Sold Count",
      "Barcode",
      "Description"
    ];

    const rows = items.map(item => [
      item.id,
      item.name,
      item.category,
      item.stock,
      item.unit,
      item.costPrice,
      item.sellPrice,
      (item.stock * item.costPrice).toFixed(2),
      (item.stock * item.sellPrice).toFixed(2),
      item.soldCount,
      item.barcode || '',
      item.description || ''
    ].map(String));

    const shopLabel = settings.shopName ? settings.shopName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'sunset_shop';
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(`${shopLabel}_inventory_${timestamp}.csv`, headers, rows);
  };

  const handleExportSales = () => {
    if (!sales || sales.length === 0) {
      alert("No sales transactions found in sales log to export.");
      return;
    }

    const headers = [
      "Sale ID",
      "Transaction Date",
      "Item ID",
      "Item Name",
      "Quantity Sold",
      "Unit",
      "Total Revenue",
      "Net Profit",
      "Payment Method",
      "Customer Name",
      "Customer Phone",
      "Status"
    ];

    const rows = sales.map(sale => [
      sale.id,
      sale.date ? new Date(sale.date).toLocaleString() : '',
      sale.itemId || '',
      sale.itemName || '',
      sale.quantity,
      sale.unit || '',
      sale.totalPrice,
      sale.profit,
      sale.paymentMethod || '',
      sale.customerName || '',
      sale.customerPhone || '',
      sale.status || ''
    ].map(String));

    const shopLabel = settings.shopName ? settings.shopName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'sunset_shop';
    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(`${shopLabel}_sales_report_${timestamp}.csv`, headers, rows);
  };

  const loadBackups = async () => {
    if (!user) return;
    try {
      const list = await fetchDatabaseBackups(user.uid);
      setBackups(list);
    } catch (err: any) {
      console.error("Failed to load backups:", err);
    }
  };

  React.useEffect(() => {
    if (isOpen && user) {
      loadBackups();
    }
  }, [isOpen, user]);

  React.useEffect(() => {
    if (isOpen) {
      setLocalShopName(settings.shopName || '');
      setLocalShopPhone(settings.shopPhone || '');
      setLocalShopAddress(settings.shopAddress || '');
      setLocalBrightness(settings.brightness || 100);
      setLocalPin(settings.pinCode || '');
    }
  }, [settings.shopName, settings.shopPhone, settings.shopAddress, settings.brightness, settings.pinCode, isOpen]);

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

  const handleUpdate = async (update: Partial<Settings>) => {
    try {
      await onUpdateSettings(update);
    } catch (err) {
      console.error("Failed to update user settings:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "relative w-full max-w-2xl overflow-hidden rounded-[40px] border shadow-2xl transition-all",
              settings.theme === 'light' ? "border-slate-200 bg-white" : "border-white/10 bg-[#0a0a0a]"
            )}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/5 p-8">
                <div>
                  <h2 className={cn(
                    "text-3xl font-serif",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>{t.settings}</h2>
                  <p className="mt-1 text-xs text-white/40 uppercase font-black tracking-widest">Personalize your shop</p>
                </div>
                <button 
                  onClick={onClose}
                  className="rounded-full p-3 text-white/20 hover:bg-white/5 hover:text-white transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40">{t.appearance}</label>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleUpdate({ theme: 'dark' })}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded-2xl border p-4 transition-all",
                          settings.theme === 'dark' 
                           ? "border-orange-500/50 bg-orange-500/10 text-orange-400" 
                           : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <Moon className="h-4 w-4" />
                        {t.dark}
                      </button>
                      <button 
                        onClick={() => handleUpdate({ theme: 'light' })}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded-2xl border p-4 transition-all",
                          settings.theme === 'light' 
                           ? "border-orange-500/50 bg-orange-500/10 text-orange-600" 
                           : "border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        <Sun className="h-4 w-4" />
                        {t.light}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40">{t.brightness}</label>
                    <div className="px-2 pt-2">
                      <input 
                        type="range"
                        min="50"
                        max="150"
                        value={localBrightness}
                        onChange={(e) => setLocalBrightness(Number(e.target.value))}
                        onMouseUp={() => handleUpdate({ brightness: localBrightness })}
                        onTouchEnd={() => handleUpdate({ brightness: localBrightness })}
                        className="w-full h-2 bg-orange-500/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="mt-2 flex justify-between text-[10px] text-white/40 uppercase font-black">
                        <span>{t.dim}</span>
                        <span>{localBrightness}%</span>
                        <span>{t.bright}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">{t.currency}</label>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => handleUpdate({ currency: curr.code })}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-2xl border p-4 transition-all",
                          settings.currency === curr.code
                            ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
                            : "border-white/5 bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        <p className="text-sm font-bold">{curr.code}</p>
                        {settings.currency === curr.code && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice Input Toggle Settings section */}
                <div className="space-y-4 pt-6 border-t border-white/10">
                  <h3 className={cn(
                    "text-xl font-serif",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>
                    {(voiceSettingsTranslations[settings.language] || voiceSettingsTranslations.en).sectionTitle}
                  </h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-white/40">
                    {settings.language === 'es' ? 'Alternar herramientas de entrada activa' : 'Toggle active input tools'}
                  </p>
                  
                  <div className={cn(
                    "flex items-center justify-between rounded-3xl border p-5 transition-all",
                    settings.theme === 'light' 
                      ? "border-slate-100 bg-slate-50/50" 
                      : "border-white/5 bg-white/5"
                  )}>
                    <div className="space-y-1 pr-4">
                      <h4 className={cn(
                        "text-sm font-bold",
                        settings.theme === 'light' ? "text-slate-900" : "text-white"
                      )}>
                        {(voiceSettingsTranslations[settings.language] || voiceSettingsTranslations.en).title}
                      </h4>
                      <p className="text-xs text-white/40 leading-relaxed">
                        {(voiceSettingsTranslations[settings.language] || voiceSettingsTranslations.en).desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdate({ enableVoiceInput: !settings.enableVoiceInput })}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        settings.enableVoiceInput ? "bg-orange-500" : "bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          settings.enableVoiceInput ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/10">
                  <h3 className={cn(
                    "text-xl font-serif",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>Shop Branding</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-white/40">These details appear on your printed & shared receipts</p>
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Shop Name</label>
                      <input 
                        type="text"
                        value={localShopName}
                        onChange={(e) => setLocalShopName(e.target.value)}
                        onBlur={() => handleUpdate({ shopName: localShopName })}
                        placeholder="e.g. Sunset Grocery"
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm",
                          settings.theme === 'light' 
                            ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                            : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Shop Phone Number</label>
                      <input 
                        type="text"
                        value={localShopPhone}
                        onChange={(e) => setLocalShopPhone(e.target.value)}
                        onBlur={() => handleUpdate({ shopPhone: localShopPhone })}
                        placeholder="e.g. +1 234 567 8900"
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm",
                          settings.theme === 'light' 
                            ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                            : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                        )}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Shop Address (Optional)</label>
                    <input 
                      type="text"
                      value={localShopAddress}
                      onChange={(e) => setLocalShopAddress(e.target.value)}
                      onBlur={() => handleUpdate({ shopAddress: localShopAddress })}
                      placeholder="e.g. 123 Main Street, Cityville"
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm",
                        settings.theme === 'light' 
                          ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                          : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                      )}
                    />
                  </div>
                </div>

                {/* Security PIN code updating section */}
                <div className="space-y-4 pt-6 border-t border-white/10">
                  <h3 className={cn(
                    "text-xl font-serif",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>Security PIN Lock</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-white/40">Used to lock the app upon inactivity or tab switcher backgrounding</p>
                  
                  <div className="grid gap-4 sm:flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                       <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">4-Digit Security PIN</label>
                      <input 
                        type="password"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        value={localPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setLocalPin(val);
                        }}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm font-mono tracking-widest",
                          settings.theme === 'light' 
                            ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                            : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (localPin.length !== 4) {
                          alert("PIN must be exactly 4 numeric digits (e.g., 5831).");
                          return;
                        }
                        await handleUpdate({ pinCode: localPin });
                        setPinSuccess(true);
                        setTimeout(() => setPinSuccess(false), 3000);
                      }}
                      className={cn(
                        "sm:mt-6 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-95",
                        settings.theme === 'light'
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-white text-black hover:bg-orange-50"
                      )}
                    >
                      Change PIN
                    </button>
                  </div>
                  {pinSuccess && (
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest px-2">✓ PIN updated successfully!</p>
                  )}
                </div>

                {/* Trusted Devices Management System */}
                <div className="space-y-4 pt-6 border-t border-white/10">
                  <h3 className={cn(
                    "text-xl font-serif",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>Trusted Devices</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-[#f97316]/75">
                    Monitor and manage active devices. Click "Revoke Access" to remotely remove any device immediately.
                  </p>

                  <div className="space-y-3">
                    {devices.length === 0 ? (
                      <p className="text-xs text-white/40 italic">No trusted device records found.</p>
                    ) : (
                      devices.map((dev) => {
                        const isCurrent = dev.id === localStorage.getItem('sunset_device_id');
                        const lastActiveDate = dev.lastActive ? new Date(dev.lastActive).toLocaleString() : 'Just now';
                        
                        return (
                          <div 
                            key={dev.id} 
                            className={cn(
                              "flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border p-4 gap-4 transition-all",
                              settings.theme === 'light' 
                                ? "border-slate-100 bg-slate-50/50 text-slate-800" 
                                : "border-white/5 bg-white/5 text-white"
                            )}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className={cn(
                                  "text-sm font-semibold",
                                  settings.theme === 'light' ? "text-slate-900" : "text-white"
                                )}>
                                  {dev.name || 'Unknown Device'}
                                </h4>
                                {isCurrent ? (
                                  <span className="text-[8px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
                                    Current Device
                                  </span>
                                ) : !dev.authorized ? (
                                  <span className="text-[8px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                                    Revoked
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 animate-pulse">
                                    Trusted
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/50">
                                <span className="font-mono text-[9px] text-orange-500 font-bold uppercase mr-1">Platform:</span>{dev.platform || 'Unknown'}
                              </p>
                              <p className="text-xs text-white/50">
                                <span className="font-mono text-[9px] text-orange-500 font-bold uppercase mr-1">Last Sync:</span>{lastActiveDate}
                              </p>
                            </div>

                            {!isCurrent && dev.authorized && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Are you absolutely sure you want to revoke access for ${dev.name}? This device will be instantly signed out and require full identity re-verification to regain access.`)) {
                                    try {
                                      await saveData(user!.uid, 'devices', {
                                        ...dev,
                                        authorized: false,
                                        lastActive: new Date().toISOString()
                                      });
                                    } catch (err: any) {
                                      alert("Failed to remote log out: " + err.message);
                                    }
                                  }
                                }}
                                className="px-3 py-1.5 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[9px] uppercase font-black tracking-wider rounded-xl transition-all cursor-pointer"
                              >
                                Revoke Access
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Feedback / Suggestion directly to Developer */}
                <div className="space-y-4 pt-6 border-t border-white/10">
                  <h3 className={cn(
                    "text-xl font-serif",
                    settings.theme === 'light' ? "text-slate-900" : "text-white"
                  )}>Send Feedback & Suggestions</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-white/40">Send detailed ideas, suggestions, or bugs directly to our engineering team</p>
                  
                  <div className="space-y-3">
                    <textarea
                      rows={4}
                      placeholder="Tell us what you would like to be improved, any suggestions for new features, or any issues you have faced..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className={cn(
                        "w-full rounded-2xl border p-4 outline-none transition-all text-sm leading-relaxed",
                        settings.theme === 'light' 
                          ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                          : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                      )}
                    />
                    <button
                      type="button"
                      disabled={isSubmittingFeedback || !feedbackText.trim()}
                      onClick={async () => {
                        if (!feedbackText.trim()) return;
                        setIsSubmittingFeedback(true);
                        setFeedbackSuccess(false);
                        setFeedbackError(null);
                        
                        const feedbackId = 'fb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                        const feedbackPayload = {
                          id: feedbackId,
                          userId: user?.uid || 'anonymous',
                          userEmail: user?.email || 'no-email@example.com',
                          message: feedbackText,
                          timestamp: new Date().toISOString()
                         };

                        try {
                          await saveGlobalDoc('feedback', feedbackPayload);
                          setFeedbackSuccess(true);
                          setFeedbackText('');
                        } catch (err: any) {
                          setFeedbackError(err.message || "Failed to submit feedback.");
                        } finally {
                          setIsSubmittingFeedback(false);
                        }
                      }}
                      className={cn(
                        "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none",
                        settings.theme === 'light'
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "bg-orange-500 text-black hover:bg-orange-400"
                      )}
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Sending feedback...</span>
                        </>
                      ) : (
                        <span>Submit Feedback Directly</span>
                      )}
                    </button>
                    {feedbackSuccess && (
                      <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest px-2">✓ Feedback sent directly to developer!</p>
                    )}
                    {feedbackError && (
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-2 font-mono">✗ {feedbackError}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className={cn(
                      "text-xl font-serif",
                      settings.theme === 'light' ? "text-slate-900" : "text-white"
                    )}>{t.account}</h3>
                    <button 
                      onClick={() => {
                        if (window.confirm(t.confirmLogout)) {
                          if (onLogout) {
                            onLogout();
                          } else {
                            logout();
                          }
                        }
                      }}
                      className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest"
                    >
                      {t.logout}
                    </button>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">{t.userName}</label>
                       <input 
                         type="text"
                         defaultValue={user?.displayName || ''}
                         id="accountNameInput"
                         placeholder="Enter your name"
                         className={cn(
                           "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm",
                           settings.theme === 'light' 
                             ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                             : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                         )}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">{t.userEmail}</label>
                       <input 
                         type="email"
                         id="accountEmailInput"
                         defaultValue={user?.email || ''}
                         placeholder="Enter your email"
                         className={cn(
                           "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm",
                           settings.theme === 'light' 
                             ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                             : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                         )}
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">{t.newPassword}</label>
                     <input 
                       type="password"
                       id="newPasswordInput"
                       placeholder="Min 6 characters"
                       className={cn(
                         "w-full rounded-2xl border px-4 py-3 outline-none transition-all text-sm",
                         settings.theme === 'light' 
                           ? "border-slate-200 bg-slate-50 text-slate-900 focus:border-orange-500/50" 
                           : "border-white/10 bg-black/40 text-white focus:border-orange-500/50"
                       )}
                     />
                  </div>

                  <button 
                    onClick={async (e) => {
                      const nameInput = document.getElementById('accountNameInput') as HTMLInputElement;
                      const emailInput = document.getElementById('accountEmailInput') as HTMLInputElement;
                      const passInput = document.getElementById('newPasswordInput') as HTMLInputElement;
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      const originalText = btn.innerText;
                      btn.innerText = '...';

                      try {
                        if (nameInput.value && nameInput.value !== user?.displayName) {
                          await updateUserName(nameInput.value);
                          alert(t.accountUpdated);
                        }
                        if (emailInput.value && emailInput.value !== user?.email) {
                          await updateUserEmail(emailInput.value);
                          alert(t.emailUpdated);
                        }
                        if (passInput.value) {
                           if (passInput.value.length < 6) throw new Error("Password too short");
                           await updateUserPassword(passInput.value);
                           alert(t.passwordUpdated);
                           passInput.value = '';
                        }
                      } catch (err: any) {
                        if (err.code === 'auth/requires-recent-login') {
                          alert("Sensitive operation. Please sign out and back in.");
                        } else {
                          alert(err.message);
                        }
                      } finally {
                        btn.disabled = false;
                        btn.innerText = originalText;
                      }
                    }}
                    className={cn(
                      "w-full rounded-2xl py-3 text-xs font-bold uppercase tracking-widest transition-all active:scale-95",
                      settings.theme === 'light' 
                        ? "bg-slate-900 text-white hover:bg-slate-800" 
                        : "bg-white text-black hover:bg-orange-50"
                    )}
                  >
                    {t.updateAccount}
                  </button>
                </div>

                <div className="space-y-6 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={cn(
                        "text-xl font-serif",
                        settings.theme === 'light' ? "text-slate-900" : "text-white"
                      )}>Role Settings</h3>
                      <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">Manage your dashboard access</p>
                    </div>
                    <span className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-[10px] font-black tracking-widest uppercase border border-orange-500/20">
                      {settings.role || 'Not Set'}
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <p className="text-white/60 text-xs leading-relaxed">
                      Your role is configured as <span className="text-orange-500 font-bold">{settings.role || 'Not Set'}</span>. For security and system alignment, role selections are permanent and cannot be modified.
                    </p>
                  </div>
                </div>

                {/* Offline Export Data Section */}
                <div className="space-y-6 pt-6 border-t border-white/10">
                  <div>
                    <h3 className={cn(
                      "text-xl font-serif flex items-center gap-2",
                      settings.theme === 'light' ? "text-slate-900" : "text-white"
                    )}>
                      <Download className="h-5 w-5 text-orange-500" />
                      Export Store Data
                    </h3>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest mt-1",
                      settings.theme === 'light' ? "text-slate-400" : "text-white/20"
                    )}>
                      Download structured CSV files of your inventory & sales log for offline record-keeping
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleExportInventory}
                      className={cn(
                        "p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-between gap-4 cursor-pointer group",
                        settings.theme === 'light'
                          ? "bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800"
                          : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                      )}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-black uppercase tracking-widest text-orange-500">Inventory Catalog</span>
                        <h4 className="text-sm font-bold mt-1">Export Items CSV</h4>
                        <p className={cn(
                          "text-[11px] leading-relaxed mt-1",
                          settings.theme === 'light' ? "text-slate-500" : "text-white/40"
                        )}>
                          Generates flat sheet containing all custom stock levels, units, costs, and selling values.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-orange-500 group-hover:translate-x-1 transition-transform">
                        <span>Download CSV</span>
                        <Download className="h-3 w-3" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportSales}
                      className={cn(
                        "p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex flex-col justify-between gap-4 cursor-pointer group",
                        settings.theme === 'light'
                          ? "bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800"
                          : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                      )}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-black uppercase tracking-widest text-orange-500">Sales Register</span>
                        <h4 className="text-sm font-bold mt-1">Export Sales CSV</h4>
                        <p className={cn(
                          "text-[11px] leading-relaxed mt-1",
                          settings.theme === 'light' ? "text-slate-500" : "text-white/40"
                        )}>
                          Generates structured columns of past user orders, gross total pricing, profits, and statuses.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-orange-500 group-hover:translate-x-1 transition-transform">
                        <span>Download CSV</span>
                        <Download className="h-3 w-3" />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Backup & Disaster Recovery */}
                <div className="space-y-6 pt-6 border-t border-white/10">
                  <div>
                    <h3 className={cn(
                      "text-xl font-serif flex items-center gap-2",
                      settings.theme === 'light' ? "text-slate-900" : "text-white"
                    )}>
                      <Database className="h-5 w-5 text-orange-500" />
                      Database Backup & Recovery
                    </h3>
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest mt-1",
                      settings.theme === 'light' ? "text-slate-400" : "text-white/20"
                    )}>
                      Snapshot entire catalog, sales log, & partners list for disaster recovery
                    </p>
                  </div>

                  <div className="space-y-4">
                    <button
                      type="button"
                      disabled={isBackupLoading || !user}
                      onClick={async () => {
                        if (!user) return;
                        setIsBackupLoading(true);
                        setBackupSuccessMessage(null);
                        setBackupErrorMessage(null);
                        try {
                          await createDatabaseBackup(user.uid);
                          setBackupSuccessMessage("Backup saved completely!");
                          loadBackups();
                        } catch (err: any) {
                          setBackupErrorMessage(err?.message || "Backup failed to save.");
                        } finally {
                          setIsBackupLoading(false);
                        }
                      }}
                      className={cn(
                        "w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all active:scale-95 border cursor-pointer",
                        settings.theme === 'light'
                          ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                          : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                      )}
                    >
                      {isBackupLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                          <span>Creating Snapshot...</span>
                        </>
                      ) : (
                        <>
                          <DownloadCloud className="h-4 w-4 text-orange-500" />
                          <span>Backup Database Now</span>
                        </>
                      )}
                    </button>

                    {backupSuccessMessage && (
                      <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest text-center">
                        ✓ {backupSuccessMessage}
                      </p>
                    )}

                    {backupErrorMessage && (
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center font-mono">
                        ✗ {backupErrorMessage}
                      </p>
                    )}

                    {backups.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          settings.theme === 'light' ? "text-slate-400" : "text-white/30"
                        )}>
                          Available Restore Points ({backups.length})
                        </p>
                        
                        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-2 pr-2">
                          {backups.map((bak) => (
                            <div 
                              key={bak.id} 
                              className={cn(
                                "border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all text-xs",
                                settings.theme === 'light'
                                  ? "bg-slate-50 border-slate-200 text-slate-700"
                                  : "bg-white/2 border-white/5 text-white/80"
                              )}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-orange-500" />
                                  <span className={cn(
                                    "font-bold",
                                    settings.theme === 'light' ? "text-slate-800" : "text-white/80"
                                  )}>
                                    {new Date(bak.timestamp).toLocaleString(undefined, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short'
                                    })}
                                  </span>
                                </div>
                                <div className={cn(
                                  "flex gap-3 text-[10px] font-mono uppercase tracking-wider",
                                  settings.theme === 'light' ? "text-slate-400" : "text-white/40"
                                )}>
                                  <span>{bak.itemsCount || 0} items</span>
                                  <span>•</span>
                                  <span>{bak.salesCount || 0} sales</span>
                                  <span>•</span>
                                  <span>{bak.partnersCount || 0} partners</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button
                                  type="button"
                                  disabled={isRestoring || isBackupLoading}
                                  onClick={async () => {
                                    if (!user) return;
                                    const confirmMsg = "CRITICALLY IMPORTANT DESTRUCTIVE RESTORE!\n\nThis will completely replace all your current items, sales, and partners with the records from this backup point.\n\nAre you absolutely sure?";
                                    if (window.confirm(confirmMsg)) {
                                      setIsRestoring(true);
                                      setBackupSuccessMessage(null);
                                      setBackupErrorMessage(null);
                                      try {
                                        await restoreDatabaseFromBackup(user.uid, bak);
                                        setBackupSuccessMessage("Database restored successfully!");
                                        alert("Success! Your database collections have been completely restored to the selected snapshot.");
                                        onClose();
                                      } catch (err: any) {
                                        setBackupErrorMessage(err?.message || "Restoring failed.");
                                      } finally {
                                        setIsRestoring(false);
                                      }
                                    }
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
                                    settings.theme === 'light'
                                      ? "bg-slate-900 hover:bg-slate-850 text-white"
                                      : "bg-white hover:bg-orange-50 text-black"
                                  )}
                                >
                                  {isRestoring ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                  <span>Restore</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isRestoring || isBackupLoading}
                                  onClick={async () => {
                                    if (!user) return;
                                    if (window.confirm("Delete this backup permanently? This cannot be undone.")) {
                                      try {
                                        await deleteDatabaseBackup(user.uid, bak.id);
                                        loadBackups();
                                      } catch (err: any) {
                                        alert("Failed to delete backup: " + (err?.message || err));
                                      }
                                    }
                                  }}
                                  className={cn(
                                    "p-2 rounded-xl border transition-all hover:scale-110 hover:text-red-500 disabled:opacity-40 cursor-pointer",
                                    settings.theme === 'light'
                                      ? "border-slate-200 text-slate-400 hover:bg-slate-100"
                                      : "border-white/5 text-white/35 hover:bg-white/5"
                                  )}
                                  title="Delete Backup"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="space-y-6 pt-6 border-t border-red-500/10">
                  <div>
                    <h3 className="text-xl font-serif text-red-500 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      {resetT.title}
                    </h3>
                    <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mt-1">
                      {resetT.subtitle}
                    </p>
                  </div>

                  <button 
                    disabled={isResetting || !user}
                    onClick={async () => {
                      if (!user) return;
                      if (window.confirm(resetT.confirm)) {
                        setIsResetting(true);
                        try {
                          await clearShopRecords(user.uid);
                          
                          // Clear localized cart storages
                          localStorage.removeItem('billing_cart');
                          localStorage.removeItem('billing_selectedUnits');
                          localStorage.removeItem('billing_cartPurchaseModes');
                          localStorage.removeItem('billing_cartTargetAmounts');
                          localStorage.removeItem('sales_cart');
                          localStorage.removeItem('sales_selectedUnits');
                          localStorage.removeItem('sales_purchaseModes');
                          localStorage.removeItem('sales_targetAmounts');
                          
                          alert(resetT.success);
                          onClose();
                        } catch (err: any) {
                          alert(`Error: ${err.message || err}`);
                        } finally {
                          setIsResetting(false);
                        }
                      }
                    }}
                    className={cn(
                      "w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2",
                      isResetting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                        <span>{resetT.processing}</span>
                      </>
                    ) : (
                      <>
                        <span>{resetT.button}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-8 bg-white/5 border-t border-white/5">
                <button 
                  onClick={onClose}
                  className={cn(
                    "w-full rounded-2xl py-4 font-black transition-all active:scale-95 shadow-xl",
                    settings.theme === 'light' 
                      ? "bg-slate-900 text-white" 
                      : "bg-white text-black"
                  )}
                >
                  {t.saveChanges}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
