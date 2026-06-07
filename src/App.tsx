import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SunsetBackdrop } from './components/SunsetBackdrop';
import { Navigation } from './components/Navigation';
import { Menu, LogIn, Sparkles } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Partners } from './pages/Partners';
import { Blessings } from './pages/Blessings';
import { Billing } from './pages/Billing';
import { Credits } from './pages/Credits';
import { DailyAudit } from './pages/DailyAudit';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { SupplierDashboard } from './pages/SupplierDashboard';
import { RoleSelector } from './components/RoleSelector';
import { StoreSetup } from './components/StoreSetup';
import { StoreBrowser } from './components/StoreBrowser';
import { SettingsModal } from './components/SettingsModal';
import { PinLockModal } from './components/PinLockModal';
import { UserRole, Item, Sale, Partner, DailyBlessing, Invoice, Settings, CustomerCredit, Store, SupplyOrder, DailySalary } from './types';
import { cn } from './lib/utils';
import { useFirebase } from './components/FirebaseProvider';
import { syncData, syncDoc, migrateFromLocalStorage, updateSettings, syncGlobalCollection, saveData } from './lib/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from './lib/translations';
import { db, auth } from './lib/firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

const DEFAULT_SETTINGS: Settings = {
  currency: 'USD',
  shopName: 'Sunset Grocery',
  language: 'en',
  theme: 'dark',
  brightness: 100,
  enableVoiceInput: true
};

export default function App() {
  const { user, loading: authLoading, login, loginWithEmail, signupWithEmail, logout, sendPasswordReset } = useFirebase();
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [blessings, setBlessings] = useState<DailyBlessing[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [salaries, setSalaries] = useState<DailySalary[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isMigrating, setIsMigrating] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);

  // Sync and PIN locks
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);

  // Manual auth state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Prefill the last logged in email on the device
  useEffect(() => {
    const lastEmail = localStorage.getItem('sunset_last_logged_in_email');
    if (lastEmail) {
      setEmail(lastEmail);
    }
  }, []);

  // When a user successfully signs in, record their email as last logged in
  useEffect(() => {
    if (user && user.email) {
      localStorage.setItem('sunset_last_logged_in_email', user.email);
    }
  }, [user]);

  // 45-minute Inactivity Auto-Logout Timer Hook
  useEffect(() => {
    if (!user) return;
    
    const TIMEOUT_DURATION = 45 * 60 * 1000; // 45 minutes
    let timeoutId: any;

    const performLock = () => {
      console.log("Inactivity timeout reached (45 minutes). Screen locked with PIN.");
      setIsPinUnlocked(false);
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(performLock, TIMEOUT_DURATION);
    };

    resetTimer();

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => resetTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);

  // Lock PIN when tab is hidden (user opens something else). Keeps Firebase session active but screens locked for privacy.
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log("App backgrounded: Screen locked with PIN.");
        // Lock screen immediately to require PIN
        setIsPinUnlocked(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Handle logout state cleanup
  useEffect(() => {
    if (!user) {
      setIsPinUnlocked(false);
      setSettingsLoaded(false);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      const deviceId = localStorage.getItem('sunset_device_id');
      const deviceRevoked = localStorage.getItem('sunset_device_revoked');
      localStorage.clear();
      if (deviceId) {
        localStorage.setItem('sunset_device_id', deviceId);
      }
      if (deviceRevoked) {
        localStorage.setItem('sunset_device_revoked', deviceRevoked);
      }
      setIsPinUnlocked(false);
      setSettingsLoaded(false);
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  };

  const [isDeviceRevoked, setIsDeviceRevoked] = useState(() => localStorage.getItem('sunset_device_revoked') === 'true');
  const [devices, setDevices] = useState<any[]>([]);

  // Device Re-association states
  const [reverifyEmail, setReverifyEmail] = useState('');
  const [reverifyPassword, setReverifyPassword] = useState('');
  const [reverifyPin, setReverifyPin] = useState('');
  const [reverifyOtp, setReverifyOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [reverifyError, setReverifyError] = useState<string | null>(null);
  const [reverifySuccess, setReverifySuccess] = useState(false);
  const [isReverifying, setIsReverifying] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError("Please fill in your Email Address to receive the password reset link.");
      return;
    }
    setAuthError(null);
    setResetMessage(null);
    setIsResetLoading(true);
    try {
      await sendPasswordReset(email);
      setResetMessage("A secure password reset link has been dispatched to your email address.");
    } catch (err: any) {
      setAuthError(err.message || "Failed to trigger email dispatch.");
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleRequestOtp = () => {
    if (!reverifyEmail) {
      setReverifyError("Please fill in your Registered Email address first.");
      return;
    }
    setReverifyError(null);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpSent(true);
    alert(`📧 [EMAIL VERIFICATION]: [Sunset Grocery Security Alert]\n\nA request has been made to rebind your device to Sunset Grocery. Your secure multi-factor re-association passcode is: ${code}`);
  };

  const handleReverifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReverifyError(null);
    
    if (!reverifyEmail || !reverifyPassword || !reverifyPin || !reverifyOtp) {
      setReverifyError("Please fill in all requested fields: Email, Password, Security PIN, and OTP Code.");
      return;
    }
    
    if (reverifyOtp !== generatedOtp) {
      setReverifyError("Invalid verification OTP. Please request a new code or try again.");
      return;
    }
    
    setIsReverifying(true);
    try {
      await loginWithEmail(reverifyEmail, reverifyPassword);
      
      const userRef = doc(db, `users/${auth.currentUser?.uid}`);
      const userSnap = await getDocFromServer(userRef);
      if (!userSnap.exists()) {
        throw new Error("Specified user profile does not exist in Sunset database.");
      }
      
      const userSettings = userSnap.data() as Settings;
      if (userSettings.pinCode !== reverifyPin) {
        await logout();
        throw new Error("The Security PIN code entered is incorrect. Re-association blocked.");
      }
      
      localStorage.removeItem('sunset_device_revoked');
      setIsDeviceRevoked(false);
      
      const deviceId = localStorage.getItem('sunset_device_id')!;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isMac = /Macintosh/i.test(navigator.userAgent);
      const isWindows = /Windows/i.test(navigator.userAgent);
      const isLinux = /Linux/i.test(navigator.userAgent);
      let platform = 'Web';
      if (isMobile) platform = 'Mobile';
      else if (isMac) platform = 'macOS';
      else if (isWindows) platform = 'Windows';
      else if (isLinux) platform = 'Linux';
      const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' :
                      navigator.userAgent.includes('Safari') ? 'Safari' :
                      navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Browser';
      const deviceName = `${browser} on ${platform}`;

      await saveData(auth.currentUser!.uid, 'devices', {
        id: deviceId,
        name: deviceName,
        platform: platform,
        lastActive: new Date().toISOString(),
        authorized: true
      });
      
      setIsPinUnlocked(true);
      setReverifySuccess(true);
    } catch (err: any) {
      setReverifyError(err.message || "Failed to authenticate or verify credentials.");
    } finally {
      setIsReverifying(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const runMigration = async () => {
      setIsMigrating(true);
      await migrateFromLocalStorage(user.uid);
      setIsMigrating(false);
    };

    runMigration();

    const targetOwnerId = (settings.role === 'customer' && currentStore) ? currentStore.ownerId : user.uid;

    const unsubItems = syncData(user.uid, 'items', setItems, targetOwnerId);
    const unsubSales = syncData(user.uid, 'sales', setSales, targetOwnerId);
    const unsubPartners = syncData(user.uid, 'partners', setPartners);
    const unsubCredits = syncData(user.uid, 'credits', setCredits);
    const unsubBlessings = syncData(user.uid, 'blessings', setBlessings);
    const unsubInvoices = syncData(user.uid, 'invoices', setInvoices);
    const unsubSalaries = syncData(user.uid, 'salaries', setSalaries);

    const unsubDevices = syncData(user.uid, 'devices', (deviceList) => {
      setDevices(deviceList);
      const currentDeviceId = localStorage.getItem('sunset_device_id');
      if (currentDeviceId && deviceList.length > 0) {
        const found = deviceList.find(d => d.id === currentDeviceId);
        // If the device was previously registered and active, but is now deleted or flagged as unauthorized by remote owner
        if (!found || found.authorized === false) {
          console.warn("Device remotely revoked. Triggering lock out...");
          localStorage.setItem('sunset_device_revoked', 'true');
          setIsDeviceRevoked(true);
          logout();
        }
      }
    });

    const unsubSettings = syncDoc(`users/${user.uid}`, (data) => {
      if (data) {
        const fetched = data as Settings;
        setSettings(fetched);
        if (fetched.roleConfirmed && user.email) {
          localStorage.setItem(`sunset_role_confirmed_${user.email}`, 'true');
          localStorage.setItem(`sunset_role_${user.email}`, fetched.role || '');
        }
      } else {
        // Initialize settings if they don't exist
        const cachedRole = user.email ? localStorage.getItem(`sunset_role_${user.email}`) : null;
        const initSettings = cachedRole 
          ? { ...DEFAULT_SETTINGS, role: cachedRole as UserRole, roleConfirmed: true }
          : DEFAULT_SETTINGS;
        updateSettings(user.uid, initSettings);
      }
      setSettingsLoaded(true);
    });

    const unsubStores = syncGlobalCollection('stores', setStores);

    let unsubSupplyOrders = () => {};
    if (settings.role === 'supplier') {
      unsubSupplyOrders = syncGlobalCollection('supplyOrders', setSupplyOrders, { field: 'supplierId', value: user.uid });
    } else if (settings.role === 'owner' && settings.storeId) {
      unsubSupplyOrders = syncGlobalCollection('supplyOrders', setSupplyOrders, { field: 'storeId', value: settings.storeId });
    }

    return () => {
      unsubItems();
      unsubSales();
      unsubPartners();
      unsubCredits();
      unsubBlessings();
      unsubInvoices();
      unsubSalaries();
      unsubDevices();
      unsubSettings();
      unsubStores();
      unsubSupplyOrders();
    };
  }, [user, settings.role, settings.storeId, currentStore]);

  // Register device on boot
  useEffect(() => {
    if (!user) return;

    let deviceId = localStorage.getItem('sunset_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('sunset_device_id', deviceId);
    }

    if (localStorage.getItem('sunset_device_revoked') === 'true') {
      setIsDeviceRevoked(true);
      logout();
      return;
    }

    const registerCurrentDevice = async () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isMac = /Macintosh/i.test(navigator.userAgent);
      const isWindows = /Windows/i.test(navigator.userAgent);
      const isLinux = /Linux/i.test(navigator.userAgent);
      
      let platform = 'Web';
      if (isMobile) platform = 'Mobile';
      else if (isMac) platform = 'macOS';
      else if (isWindows) platform = 'Windows';
      else if (isLinux) platform = 'Linux';
      
      const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' :
                      navigator.userAgent.includes('Safari') ? 'Safari' :
                      navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Browser';

      const deviceName = `${browser} on ${platform}`;

      try {
        await saveData(user.uid, 'devices', {
          id: deviceId,
          name: deviceName,
          platform: platform,
          lastActive: new Date().toISOString(),
          authorized: true
        });
      } catch (err) {
        console.warn("Failed to register device on boot:", err);
      }
    };

    registerCurrentDevice();
  }, [user]);

  useEffect(() => {
    if (settings.role === 'owner' && settings.storeId && supplyOrders.length > 0) {
      // Small helper to sync statuses
      const syncStatuses = async () => {
        for (const sOrder of supplyOrders) {
          if (sOrder.parentSaleId) {
            const sale = sales.find(s => s.id === sOrder.parentSaleId);
            if (sale) {
              let newSupplyStatus: Sale['supplyStatus'] = 'none';
              if (sOrder.status === 'pending') newSupplyStatus = 'ordered';
              if (sOrder.status === 'processing') newSupplyStatus = 'ordered';
              if (sOrder.status === 'shipped') newSupplyStatus = 'shipped';
              if (sOrder.status === 'completed') newSupplyStatus = 'arrived';

              if (sale.supplyStatus !== newSupplyStatus) {
                await saveData(user!.uid, 'sales', {
                  ...sale,
                  supplyStatus: newSupplyStatus
                });
              }
            }
          }
        }
      };
      syncStatuses();
    }
  }, [supplyOrders, sales, settings.role, settings.storeId]);

  useEffect(() => {
    if (user && settings.storeId) {
      const unsub = syncDoc(`stores/${settings.storeId}`, (data) => {
        if (data) setCurrentStore(data as Store);
      });
      return unsub;
    } else {
      setCurrentStore(null);
    }
  }, [user, settings.storeId]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  // Clear auth fields when user logs out
  useEffect(() => {
    if (!user) {
      const lastEmail = localStorage.getItem('sunset_last_logged_in_email');
      setEmail(lastEmail || '');
      setPassword('');
      setName('');
      setConfirmPassword('');
      setAuthError(null);
    }
  }, [user]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthProcessing(true);
    try {
      if (authMode === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!name) throw new Error("Name is required for signup");
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        if (password.length < 6) throw new Error("Secret Code must be at least 6 characters");
        await signupWithEmail(email, password, name);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const formatPrice = (amount: number) => {
    const symbols: Record<string, string> = {
      PKR: 'Rs ',
      USD: '$',
      CNY: '¥',
      EUR: '€',
      GBP: '£',
      INR: '₹ ',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
      AED: 'AED ',
      SAR: 'SR '
    };
    const symbol = symbols[settings.currency] || '$';
    
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleRoleConfirm = async (role: UserRole) => {
    if (!user) return;
    const newSettings = { ...settings, role, roleConfirmed: true };
    if (user.email) {
      localStorage.setItem(`sunset_role_confirmed_${user.email}`, 'true');
      localStorage.setItem(`sunset_role_${user.email}`, role);
    }
    await updateSettings(user.uid, newSettings);
    setSettings(newSettings);
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleUpdateSettings = async (newSettings: Partial<Settings>) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    try {
      await updateSettings(user.uid, updated);
      setSettings(updated);
    } catch (err) {
      console.error("Failed to update settings in Firestore:", err);
    }
  };

  // --- Horizontal Swipe, Key, and Scroll Navigation Setup ---
  const navigate = useNavigate();
  const location = useLocation();
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const lastNavTime = React.useRef<number>(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const getPaths = () => {
    return [
      '/',
      ...(settings.role === 'owner' || !settings.role ? [
        '/inventory',
        '/billing',
        '/partners',
        '/credits',
        '/audit',
      ] : []),
      ...(settings.role === 'customer' ? [
        '/orders',
      ] : []),
      ...(settings.role === 'supplier' ? [
        '/supply-orders',
      ] : []),
      '/blessings',
    ];
  };

  const currentPathIdx = getPaths().indexOf(location.pathname);

  const navigateToPage = (dir: 'prev' | 'next') => {
    if (!user || !settings.roleConfirmed || (settings.role === 'owner' && !settings.storeId)) return;
    if (settings.role === 'customer' && !settings.storeId) return;

    const paths = getPaths();
    if (currentPathIdx === -1) return;

    const now = Date.now();
    if (now - lastNavTime.current < 600) return; // Prevent double triggers / scroll racing

    if (dir === 'next' && currentPathIdx < paths.length - 1) {
      setSlideDirection('right');
      lastNavTime.current = now;
      navigate(paths[currentPathIdx + 1]);
    } else if (dir === 'prev' && currentPathIdx > 0) {
      setSlideDirection('left');
      lastNavTime.current = now;
      navigate(paths[currentPathIdx - 1]);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || activeEl.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (e.key === 'ArrowRight') {
        navigateToPage('next');
      } else if (e.key === 'ArrowLeft') {
        navigateToPage('prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPathIdx, settings.role, user]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;

    // Must be a forceful/intentional swipe: horizontal displacement > 150px
    // and horizontal movement must be at least 2.5x larger than vertical movement
    if (Math.abs(diffX) > Math.abs(diffY) * 2.5 && Math.abs(diffX) > 150) {
      if (diffX > 0) {
        navigateToPage('prev');
      } else {
        navigateToPage('next');
      }
    }
    setTouchStart(null);
  };

  // Wheel handling
  const handleWheel = (e: React.WheelEvent) => {
    let target = e.target as HTMLElement;
    while (target && target !== document.body) {
      if (target.classList && (
        target.classList.contains('overflow-x-auto') || 
        target.classList.contains('overflow-x-scroll') ||
        target.scrollWidth > target.clientWidth
      )) {
        return; // normal scrolling inside a scrollable subcomponent
      }
      target = target.parentElement as HTMLElement;
    }

    // Must be a forceful/intentional scroll: deltaX > 120
    // and horizontal scroll force must be at least 3x larger than vertical scroll force
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 3 && Math.abs(e.deltaX) > 120) {
      if (e.deltaX > 0) {
        navigateToPage('next');
      } else {
        navigateToPage('prev');
      }
    }
  };

  const getPageLabel = (path: string) => {
    const t = translations[settings.language] || translations.en;
    if (path === '/') return settings.role === 'customer' ? 'Shop' : settings.role === 'supplier' ? 'Supplier Hub' : t.dashboard;
    if (path === '/inventory') return t.inventory;
    if (path === '/billing') return t.salesAndBilling || 'Sales & Billing';
    if (path === '/partners') return t.partners;
    if (path === '/credits') return t.credits || 'Credits';
    if (path === '/audit') return t.dailyAudit || 'Daily Audit';
    if (path === '/orders') return 'My Orders';
    if (path === '/supply-orders') return 'Supply Orders';
    if (path === '/blessings') return t.blessings;
    return '';
  };

  if (authLoading || isMigrating) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-8 w-8 text-orange-500" />
        </motion.div>
      </div>
    );
  }

  if (isDeviceRevoked) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center p-4">
        <SunsetBackdrop isLight={false} />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-[32px] max-w-md w-full text-center space-y-6"
        >
          <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
            <span className="text-2xl font-bold">🔒</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-serif text-white">Device Access Revoked</h1>
            <p className="text-white/60 text-xs leading-relaxed uppercase tracking-widest font-black text-orange-500">
              Multi-Factor Identity Verification Required
            </p>
            <p className="text-white/40 text-[11px] leading-relaxed">
              This device was remotely de-authorized by the store owner. To re-associate this device, you must complete full multi-factor credentials verification.
            </p>
          </div>

          <form onSubmit={handleReverifySubmit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Registered Email</label>
              <input 
                type="email"
                required
                placeholder="email@sunset.com"
                value={reverifyEmail}
                onChange={(e) => setReverifyEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Account Password</label>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={reverifyPassword}
                onChange={(e) => setReverifyPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Security PIN</label>
                <input 
                  type="password"
                  required
                  maxLength={4}
                  placeholder="e.g. 1234"
                  value={reverifyPin}
                  onChange={(e) => setReverifyPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500/50 transition-colors font-mono tracking-widest text-center"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Simulated OTP Code</label>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    maxLength={6}
                    placeholder="6-Digit OTP"
                    value={reverifyOtp}
                    onChange={(e) => setReverifyOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-10 py-3 text-white text-sm outline-none focus:border-orange-500/50 transition-colors font-mono text-center"
                  />
                  {otpSent && (
                    <span className="absolute right-3 top-3.5 text-green-400 text-xs font-mono animate-pulse">✓</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center px-1">
              <button
                type="button"
                onClick={handleRequestOtp}
                className="text-[10px] uppercase font-black text-orange-500 hover:text-orange-400 tracking-wider underline cursor-pointer"
              >
                {otpSent ? "Resend OTP Code" : "Request OTP Code"}
              </button>
            </div>

            {reverifyError && (
              <p className="text-red-400 text-xs px-2 italic font-mono">{reverifyError}</p>
            )}

            {reverifySuccess && (
              <p className="text-green-400 text-xs px-2 font-bold font-mono text-center">✓ Device Re-associated Successfully!</p>
            )}

            <button 
              type="submit"
              disabled={isReverifying}
              className="w-full py-4 bg-orange-500 text-black rounded-2xl font-bold hover:bg-orange-400 transition-all disabled:opacity-50 uppercase tracking-widest text-xs"
            >
              {isReverifying ? "Verifying..." : "Verify & Restore Trusted Status"}
            </button>
          </form>

          <div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('sunset_device_revoked');
                setIsDeviceRevoked(false);
              }}
              className="text-white/40 hover:text-white transition-colors text-[9px] uppercase tracking-widest font-black"
            >
              Cancel & Register New Profile
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center p-4">
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed top-8 bg-red-500/20 border border-red-500/50 backdrop-blur-md px-6 py-2 rounded-full z-50"
            >
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Connectivity Issue Detected
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <SunsetBackdrop isLight={false} />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-[32px] max-w-md w-full text-center space-y-6"
        >
          <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-orange-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif text-white">Sunset Grocery</h1>
            <p className="text-white/60 text-sm">Where every shelf tells a story of blessings and growth.</p>
          </div>

          <form onSubmit={handleManualAuth} className="space-y-4 text-left">
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Full Name</label>
                <input 
                  type="text"
                  required
                  placeholder="The Shopkeeper's Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Email Address</label>
              <input 
                type="email"
                required
                placeholder="email@sunset.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Secret Code</label>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            {authMode === 'login' && (
              <div className="flex justify-end px-2">
                <button
                  type="button"
                  disabled={isResetLoading}
                  onClick={handleResetPassword}
                  className="text-[9px] font-black uppercase tracking-wider text-orange-500/70 hover:text-orange-500 transition-all cursor-pointer underline decoration-dotted"
                >
                  {isResetLoading ? "Sending Link..." : "Forgot Password? Reset via Email"}
                </button>
              </div>
            )}

            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Confirm Secret Code</label>
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>
            )}

            {authError && (
              <p className="text-red-400 text-xs px-2 italic">{authError}</p>
            )}

            {resetMessage && (
              <p className="text-green-400 text-xs px-2 font-semibold font-mono">✓ {resetMessage}</p>
            )}

            <button 
              type="submit"
              disabled={isAuthProcessing}
              className="w-full py-4 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all border border-white/10 disabled:opacity-50"
            >
              {isAuthProcessing ? "Processing..." : authMode === 'login' ? "Enter The Shop" : "Register The Shop"}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black text-white/20"><span className="bg-[#0a0502] px-2">or continue with</span></div>
          </div>

          <button 
            type="button"
            onClick={login}
            className="w-full py-4 bg-orange-500 text-[#0a0502] rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-orange-400 transition-colors"
          >
            <LogIn size={20} />
            Google Seamless Entry
          </button>

          <p className="text-white/40 text-[10px] uppercase font-black tracking-widest">
            {authMode === 'login' ? "Need a new account?" : "Already have an account?"}{' '}
            <button 
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError(null);
              }}
              className="text-orange-500 hover:text-orange-400 transition-colors ml-1"
            >
              {authMode === 'login' ? "Register Now" : "Sign In Now"}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  if (user && !settingsLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-8 w-8 text-orange-500" />
        </motion.div>
      </div>
    );
  }

  if (user && !isPinUnlocked) {
    return (
      <PinLockModal 
        storedPin={settings.pinCode}
        onSetPin={async (pin) => {
          await handleUpdateSettings({ pinCode: pin });
        }}
        onUnlock={() => setIsPinUnlocked(true)}
        onLogout={handleLogout}
      />
    );
  }

  const isLocallyConfirmed = user?.email && localStorage.getItem(`sunset_role_confirmed_${user.email}`) === 'true';

  if (user && !settings.roleConfirmed && !isLocallyConfirmed) {
    return <RoleSelector settings={settings} onConfirm={handleRoleConfirm} />;
  }

  if (user && settings.role === 'owner' && !settings.storeId) {
    return <StoreSetup userId={user.uid} settings={settings} onComplete={() => {}} />;
  }

  if (user && settings.role === 'customer' && !settings.storeId) {
    return <StoreBrowser userId={user.uid} settings={settings} stores={stores} />;
  }

  const paths = getPaths();
  const hasPrev = currentPathIdx > 0;
  const hasNext = currentPathIdx < paths.length - 1;

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={cn(
        "min-h-screen max-w-full overflow-x-hidden text-white antialiased transition-colors duration-500",
        settings.theme === 'light' ? "bg-orange-50 text-slate-900" : "bg-[#0a0502] text-white"
      )}
      style={{ filter: `brightness(${settings.brightness}%)` }}
    >
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-red-500 px-4 py-2 flex items-center justify-center gap-2"
          >
            <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Network Disconnected - Shop Operating in Offline Mode
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SunsetBackdrop isLight={settings.theme === 'light'} />

      <main className="mx-auto max-w-7xl px-4 pt-24 pb-32 md:pt-32">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: slideDirection === 'right' ? 80 : -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection === 'right' ? -80 : 80 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={
                settings.role === 'customer' ? (
                  <CustomerDashboard 
                    settings={settings} 
                    items={items}
                    sales={sales}
                    currentStore={currentStore}
                    formatPrice={formatPrice}
                    userId={user.uid}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                ) :
                settings.role === 'supplier' ? (
                  <SupplierDashboard 
                    supplyOrders={supplyOrders}
                    settings={settings}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                ) :
                <Dashboard 
                  items={items} 
                  sales={sales} 
                  invoices={invoices}
                  settings={settings} 
                  formatPrice={formatPrice} 
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              } />
              <Route path="/blessings" element={<Blessings blessings={blessings} settings={settings} />} />
              
              {(settings.role === 'owner' || !settings.role) && (
                <>
                  <Route 
                    path="/inventory" 
                    element={<Inventory items={items} formatPrice={formatPrice} settings={settings} />} 
                  />
                  <Route 
                    path="/sales" 
                    element={<Sales items={items} sales={sales} formatPrice={formatPrice} settings={settings} />} 
                  />
                  <Route 
                    path="/billing" 
                    element={<Billing items={items} sales={sales} invoices={invoices} formatPrice={formatPrice} settings={settings} />} 
                    />
                  <Route 
                    path="/partners" 
                    element={<Partners partners={partners} formatPrice={formatPrice} settings={settings} />} 
                  />
                  <Route 
                    path="/credits" 
                    element={<Credits credits={credits} formatPrice={formatPrice} settings={settings} />} 
                  />
                  <Route 
                    path="/audit" 
                    element={<DailyAudit sales={sales} salaries={salaries} formatPrice={formatPrice} settings={settings} userId={user.uid} />} 
                  />
                </>
              )}

              {settings.role === 'customer' && (
                <>
                  <Route path="/orders" element={<Sales items={items} sales={sales} formatPrice={formatPrice} settings={settings} />} />
                </>
              )}

              {settings.role === 'supplier' && (
                <>
                  <Route path="/supply-orders" element={<Billing items={items} sales={sales} invoices={invoices} formatPrice={formatPrice} settings={settings} />} />
                </>
              )}
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        items={items}
        sales={sales}
        onLogout={handleLogout}
      />
      <Navigation 
        settings={settings} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>
  );
}
