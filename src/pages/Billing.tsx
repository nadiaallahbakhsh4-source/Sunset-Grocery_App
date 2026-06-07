import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, Plus, Minus, Trash2, Printer, User, ShoppingCart, ArrowLeft, CreditCard, Wallet, Smartphone, Share2, History, Phone, Download, Barcode, Camera } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { QRCodeSVG } from 'qrcode.react';
import { Item, Sale, Invoice, InvoiceItem, Settings } from '../types';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

import { translations } from '../lib/translations';

interface BillingProps {
  items: Item[];
  sales: Sale[];
  invoices: Invoice[];
  setItems?: React.Dispatch<React.SetStateAction<Item[]>>;
  setSales?: React.Dispatch<React.SetStateAction<Sale[]>>;
  setInvoices?: React.Dispatch<React.SetStateAction<Invoice[]>>;
  formatPrice: (amount: number) => string;
  settings: Settings;
}

interface CartItem {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  sellPrice: number;
}

const normalizeUnit = (unit: string): string => {
  const u = unit.trim().toLowerCase();
  if (['kg', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['g', 'gram', 'grams'].includes(u)) return 'g';
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(u)) return 'l';
  if (['ml', 'milliliter', 'milliliters'].includes(u)) return 'ml';
  if (['pcs', 'piece', 'pieces', 'unit', 'units'].includes(u)) return 'pcs';
  if (['box', 'boxes'].includes(u)) return 'box';
  if (['bag', 'bags', 'sack', 'sacks'].includes(u)) return 'bag';
  if (['carton', 'cartons'].includes(u)) return 'carton';
  if (['tin', 'tins'].includes(u)) return 'tin';
  return u;
};

const isSackUnit = (unit: string, item?: Item) => {
  if (!item || !item.capacityPerSack || item.capacityPerSack <= 0) return false;
  
  const uNorm = normalizeUnit(unit);
  const baseNorm = normalizeUnit(item.unit || '');
  const saleNorm = normalizeUnit(item.saleUnit || '');
  const sackNorm = normalizeUnit(item.sackUnit || '');

  // If the unit matches a weight or pieces unit, it is NOT a sack/bulk unit
  if (['kg', 'g', 'l', 'ml', 'pcs'].includes(uNorm)) {
    return false;
  }

  // If it matches base unit or sale unit, check if that unit is known as a bulk unit
  if (uNorm === baseNorm || uNorm === saleNorm) {
    if (sackNorm && uNorm === sackNorm) {
      return true;
    }
    return false;
  }

  if (sackNorm && uNorm === sackNorm) {
    return true;
  }

  // Bulk indicators
  const bulkUnits = ['bag', 'box', 'carton', 'tin'];
  if (bulkUnits.includes(uNorm)) {
    return true;
  }

  return false;
};

const getSellPriceForUnit = (item: Item | undefined, unit: string) => {
  if (!item) return 0;
  const uNorm = normalizeUnit(unit);
  const baseNorm = normalizeUnit(item.unit || '');
  const saleNorm = normalizeUnit(item.saleUnit || '');
  const sackNorm = normalizeUnit(item.sackUnit || '');

  const hasCapacity = item.capacityPerSack && item.capacityPerSack > 0;

  // Case 1: Selected unit is a sack/bulk unit (e.g. "box" or "bag")
  if (isSackUnit(unit, item)) {
    if (item.pricePerSack && item.pricePerSack > 0) {
      return item.pricePerSack;
    }
    // If base is a weight/piece unit (like kg or pcs), then bulk price is sellPrice * capacity
    if (['kg', 'l', 'pcs'].includes(baseNorm)) {
      return item.sellPrice * (item.capacityPerSack || 1);
    }
    return item.sellPrice;
  }

  // Case 2: Selected unit is "kg" or "l"
  if (uNorm === 'kg' || uNorm === 'l') {
    // If base is "g" or "ml" (weight unit is stored as gram/ml, sellPrice is per gram/ml)
    if (baseNorm === 'g' || baseNorm === 'ml') {
      return item.sellPrice * 1000;
    }
    // If base is a bulk unit (like box or bag), and sellPrice is for the whole bulk unit,
    // then price per kg is sellPrice / capacity
    if (['box', 'bag', 'carton', 'tin'].includes(baseNorm) && hasCapacity) {
      return item.sellPrice / item.capacityPerSack!;
    }
    return item.sellPrice;
  }

  // Case 3: Selected unit is "g" or "ml"
  if (uNorm === 'g' || uNorm === 'ml') {
    // If base is "kg" or "l"
    if (baseNorm === 'kg' || baseNorm === 'l') {
      return item.sellPrice / 1000;
    }
    // If base is a bulk unit (like box or bag)
    if (['box', 'bag', 'carton', 'tin'].includes(baseNorm) && hasCapacity) {
      return (item.sellPrice / item.capacityPerSack!) / 1000;
    }
    return item.sellPrice;
  }

  // Case 4: Selected unit is "pcs" (pieces)
  if (uNorm === 'pcs') {
    // If base is a bulk unit and we want 1 piece
    if (['box', 'bag', 'carton', 'tin'].includes(baseNorm) && hasCapacity) {
      return item.sellPrice / item.capacityPerSack!;
    }
    return item.sellPrice;
  }

  // Case 5: default
  return item.sellPrice;
};

import { useFirebase } from '../components/FirebaseProvider';
import { saveData, deleteData } from '../lib/dataService';

export const Billing: React.FC<BillingProps> = ({ items, sales, invoices, formatPrice, settings }) => {
  const { user } = useFirebase();
  const receiptRef = useRef<HTMLDivElement>(null);
  const t = translations[settings.language] || translations.en;
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('billing_customerName') || '');
  const [customerPhone, setCustomerPhone] = useState(() => localStorage.getItem('billing_customerPhone') || '');
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('billing_cart');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutScannerOpen, setIsCheckoutScannerOpen] = useState(false);
  const [posScanAlert, setPosScanAlert] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Mobile Payment'>(() => {
    const saved = localStorage.getItem('billing_paymentMethod');
    return (saved as any) || 'Cash';
  });
  const [showPrintView, setShowPrintView] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(() => localStorage.getItem('billing_editingInvoiceId') || null);
  const [activeSaleUnit, setActiveSaleUnit] = useState<string>('kg');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [quickAddPackagingType, setQuickAddPackagingType] = useState<'sack' | 'box' | 'loose'>('loose');
  const [newItemData, setNewItemData] = useState<Partial<Item>>({
    name: '',
    category: 'Others',
    stock: 0,
    costPrice: 0,
    sellPrice: 0,
    unit: 'pcs',
    isWeightBased: false,
    sackCount: 0,
    capacityPerSack: 0,
    sackUnit: 'kg',
    saleUnit: 'kg',
    pricePerSack: 0,
  });

  // Auto-populate logic
  const [showHistory, setShowHistory] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('billing_selectedUnits');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Advanced features states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartPurchaseModes, setCartPurchaseModes] = useState<Record<string, 'quantity' | 'amount'>>(() => {
    const saved = localStorage.getItem('billing_cartPurchaseModes');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [cartTargetAmounts, setCartTargetAmounts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('billing_cartTargetAmounts');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    localStorage.setItem('billing_customerName', customerName);
  }, [customerName]);

  React.useEffect(() => {
    localStorage.setItem('billing_customerPhone', customerPhone);
  }, [customerPhone]);

  React.useEffect(() => {
    localStorage.setItem('billing_cart', JSON.stringify(cart));
  }, [cart]);

  React.useEffect(() => {
    if (editingInvoiceId) {
      localStorage.setItem('billing_editingInvoiceId', editingInvoiceId);
    } else {
      localStorage.removeItem('billing_editingInvoiceId');
    }
  }, [editingInvoiceId]);

  React.useEffect(() => {
    localStorage.setItem('billing_paymentMethod', paymentMethod);
  }, [paymentMethod]);

  React.useEffect(() => {
    localStorage.setItem('billing_selectedUnits', JSON.stringify(selectedUnits));
  }, [selectedUnits]);

  React.useEffect(() => {
    localStorage.setItem('billing_cartPurchaseModes', JSON.stringify(cartPurchaseModes));
  }, [cartPurchaseModes]);

  React.useEffect(() => {
    localStorage.setItem('billing_cartTargetAmounts', JSON.stringify(cartTargetAmounts));
  }, [cartTargetAmounts]);

  const getBillingLabels = (lang: string) => {
    const dict: Record<string, any> = {
      en: {
        quickFavorites: "⭐ Quick Tap / Favorites",
        quickFavoritesSubtitle: "Commonly purchased. Tap to add instantly.",
        categories: "Categories",
        purchaseMode: "Purchase Mode",
        byQuantity: "By Qty / Unit",
        byAmount: "By Cash Amount",
        amountToPay: "Target cash amount",
        equivalentQty: "Equivalent Quantity",
        enterAmount: "e.g. 70, 130 worth",
        unitPriceLabel: "Rate",
        totalPriceLabel: "Total Price",
        allCategories: "All Products"
      },
      ur: {
        quickFavorites: "⭐ کوئک ٹیپ / پسندیدہ اشیاء",
        quickFavoritesSubtitle: "عام طور پر فروخت ہونے والی چیزیں۔ فوری شامل کرنے کے لیے ٹیپ کریں۔",
        categories: "اقسام",
        purchaseMode: "خریداری کا طریقہ",
        byQuantity: "مقدار / یونٹ کے مطابق",
        byAmount: "بل کی نقد رقم کے مطابق",
        amountToPay: "مطلوبہ نقد رقم",
        equivalentQty: "برابر مقدار",
        enterAmount: "مثال کے طور پر 70، 130 روپے مالیت",
        unitPriceLabel: "ریٹ",
        totalPriceLabel: "کل قیمت",
        allCategories: "تمام اشیاء"
      },
      zh: {
        quickFavorites: "⭐ 快捷点击 / 常用商品",
        quickFavoritesSubtitle: "常见购买商品。点击即可立即添加。",
        categories: "商品门类",
        purchaseMode: "购买模式",
        byQuantity: "按数量/单位",
        byAmount: "按账单金额",
        amountToPay: "目标现金金额",
        equivalentQty: "等效数量",
        enterAmount: "例如：价值 70, 130 等",
        unitPriceLabel: "单价",
        totalPriceLabel: "总价",
        allCategories: "所有商品"
      },
      es: {
        quickFavorites: "⭐ Toque Rápido / Favoritos",
        quickFavoritesSubtitle: "Comunes. Toque para agregar al instante.",
        categories: "Categorías",
        purchaseMode: "Modo de Compra",
        byQuantity: "Por Cantidad / Unidad",
        byAmount: "Por Importe de Factura",
        amountToPay: "Monto en efectivo objetivo",
        equivalentQty: "Cantidad Equivalente",
        enterAmount: "ej. 70 o 130 de valor",
        unitPriceLabel: "Tarifa",
        totalPriceLabel: "Precio Total",
        allCategories: "Todos los productos"
      },
      hi: {
        quickFavorites: "⭐ त्वरित टैप / पसंदीदा उत्पाद",
        quickFavoritesSubtitle: "आमतौर पर खरीदे जाने वाले। तुरंत जोड़ने के लिए टैप करें।",
        categories: "श्रेणियाँ",
        purchaseMode: "खरीद मोड",
        byQuantity: "मात्रा / इकाई",
        byAmount: "बिल राशि द्वारा",
        amountToPay: "लक्ष्य नकद राशि",
        equivalentQty: "समतुल्य मात्रा",
        enterAmount: "उदा. 70, 130 मूल्य",
        unitPriceLabel: "दर",
        totalPriceLabel: "कुल मूल्य",
        allCategories: "सभी उत्पाद"
      },
      ar: {
        quickFavorites: "⭐ نقرة سريعة / المفضلة",
        quickFavoritesSubtitle: "الأكثر مبيعاً. انقر للإضافة الفورية.",
        categories: "الفئات",
        purchaseMode: "طريقة الشراء",
        byQuantity: "حسب الكمية / الوحدة",
        byAmount: "حسب قيمة الفاتورة",
        amountToPay: "المبلغ النقدي المستهدف",
        equivalentQty: "الكمية المعادلة",
        enterAmount: "مثال: بقيمة 70 أو 130",
        unitPriceLabel: "السعر",
        totalPriceLabel: "السعر الإجمالي",
        allCategories: "جميع المنتجات"
      }
    };
    return dict[lang] || dict.en;
  };

  const billingLabels = getBillingLabels(settings.language);

  // Sync amount changes to cart items list
  const handleCartTargetAmountChange = (cartId: string, amountStr: string, sellPrice: number) => {
    const amount = parseFloat(amountStr) || 0;
    const calculatedQty = sellPrice > 0 ? Number((amount / sellPrice).toFixed(3)) : 0;
    setCartTargetAmounts(prev => ({ ...prev, [cartId]: amountStr }));
    updateCartQuantityDirect(cartId, calculatedQty);
  };

  // Switch cart purchase modes
  const handleCartTogglePurchaseMode = (cartId: string, mode: 'quantity' | 'amount', currentQty: number, sellPrice: number) => {
    setCartPurchaseModes(prev => ({ ...prev, [cartId]: mode }));
    if (mode === 'amount') {
      const amountVal = (currentQty * sellPrice).toFixed(2);
      setCartTargetAmounts(prev => ({ ...prev, [cartId]: amountVal }));
    } else {
      const amountStr = cartTargetAmounts[cartId] || '';
      const amount = parseFloat(amountStr) || 0;
      const calculatedQty = sellPrice > 0 ? Number((amount / sellPrice).toFixed(3)) : 1;
      updateCartQuantityDirect(cartId, calculatedQty > 0 ? calculatedQty : 1);
    }
  };

  // Sync unit changes to keep cash amount intact if in amount mode
  const handleCartUnitChangeSync = (cartId: string, unit: string, sellPriceForUnit: number) => {
    const mode = cartPurchaseModes[cartId] || 'quantity';
    if (mode === 'amount') {
      const amountStr = cartTargetAmounts[cartId] || '';
      const amount = parseFloat(amountStr) || 0;
      const calculatedQty = sellPriceForUnit > 0 ? Number((amount / sellPriceForUnit).toFixed(3)) : 0;
      setCart(prev => prev.map(c => c.id === cartId ? { ...c, unit, sellPrice: sellPriceForUnit, quantity: calculatedQty } : c));
    } else {
      setCart(prev => prev.map(c => c.id === cartId ? { ...c, unit, sellPrice: sellPriceForUnit } : c));
    }
  };

  // Dynamic Categories & Favorites
  const customCategories = ['All', ...new Set(items.map(item => item.category || 'Others').filter(Boolean))];

  const favoriteProducts = [...items]
    .filter(item => item.stock > 0)
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, 4);

  const handleNameChange = (name: string) => {
    setCustomerName(name);
    if (!name.trim()) {
      setCustomerPhone('');
      return;
    }
    
    // Look for last sale with this customer name
    const lastSale = [...sales].reverse().find(s => 
      s.customerName?.toLowerCase() === name.toLowerCase() && s.customerPhone
    );
    
    if (lastSale) {
      setCustomerPhone(lastSale.customerPhone || '');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || (item.category || 'Others') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const setItemQuantity = (itemId: string, newQty: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(1, newQty) }));
  };

  const addItemToCart = (item: Item) => {
    const existingInCart = cart.find(c => c.itemId === item.id);
    const availableStock = item.stock;
    const defaultUnit = item.unit || 'pcs';
    
    if (availableStock <= 0) {
      const proceed = confirm(settings.language === 'es' 
        ? `Advertencia: ¡Este artículo no tiene existencias! ¿Desea venderlo de todos modos?` 
        : `Warning: This item is out of stock! Do you want to sell it anyway?`
      );
      if (!proceed) return;
    }
    
    // Check total base quantity currently in cart
    const currentCartQtyBase = cart
      .filter(c => c.itemId === item.id)
      .reduce((sum, c) => sum + ((c.unit === 'g' || c.unit === 'ml') ? c.quantity / 1000 : (isSackUnit(c.unit, item) ? c.quantity * (item.capacityPerSack || 1) : c.quantity)), 0);

    const qtyToAddBase = (defaultUnit === 'g' || defaultUnit === 'ml') ? 1 / 1000 : (isSackUnit(defaultUnit, item) ? 1 * (item.capacityPerSack || 1) : 1);

    if (qtyToAddBase > availableStock - currentCartQtyBase) {
      const proceed = confirm(settings.language === 'es' 
        ? `No hay suficientes existencias en el inventario (${availableStock} disp). ¿Desea continuar con la venta?` 
        : `There is insufficient stock in inventory (${availableStock} left). Do you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    if (existingInCart && existingInCart.unit === defaultUnit) {
      // Increment existing cart item
      setCart(cart.map(c => 
        (c.id === existingInCart.id) ? { ...c, quantity: Number((c.quantity + 1).toFixed(3)) } : c
      ));
    } else {
      // Add a fresh item to the cart with quantity 1
      const sellPrice = getSellPriceForUnit(item, defaultUnit);
      setCart([...cart, {
        id: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        unit: defaultUnit,
        quantity: 1,
        sellPrice: sellPrice
      }]);
    }
    
    setSearchTerm('');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const item = items.find(i => i.id === c.itemId);
        const newQty = Math.max(0.01, Number((c.quantity + delta).toFixed(3)));
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const updateCartQuantityDirect = (id: string, newQty: number) => {
    setCart(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, quantity: Math.max(0.01, Number(newQty.toFixed(3))) };
      }
      return c;
    }));
  };

  const updateCartItemUnit = (id: string, newUnit: string) => {
    setCart(prev => prev.map(c => {
      if (c.id === id) {
        const item = items.find(i => i.id === c.itemId);
        if (!item) return c;
        const sellPrice = getSellPriceForUnit(item, newUnit);
        
        // If in cash amount mode, we sync the quantity with the rate
        const mode = cartPurchaseModes[id] || 'quantity';
        if (mode === 'amount') {
          const amountStr = cartTargetAmounts[id] || '';
          const amount = parseFloat(amountStr) || 0;
          const calculatedQty = sellPrice > 0 ? Number((amount / sellPrice).toFixed(3)) : 0;
          return { ...c, unit: newUnit, sellPrice: sellPrice, quantity: calculatedQty };
        }
        return { ...c, unit: newUnit, sellPrice: sellPrice };
      }
      return c;
    }));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  };

  const handleFinalizeAndPrint = async () => {
    if (cart.length === 0 || !user) return;

    const invoiceId = editingInvoiceId || crypto.randomUUID();
    const oldInvoice = editingInvoiceId ? invoices.find(inv => inv.id === editingInvoiceId) : null;

    const getBaseQuantity = (unit: string, qty: number, item?: Item) => {
      if (!item) return qty;
      if (isSackUnit(unit, item)) {
        return qty * (item.capacityPerSack || 1);
      } else if (unit === 'g' || unit === 'ml') {
        return qty / 1000;
      } else {
        return qty;
      }
    };

    const getCostPriceForUnit = (item: Item | undefined, unit: string) => {
      if (!item) return 0;
      if (item.isWeightBased && item.capacityPerSack && item.capacityPerSack > 0) {
        if (isSackUnit(unit, item)) {
          return item.costPrice;
        } else if (unit === 'g' || unit === 'ml') {
          return (item.costPrice / item.capacityPerSack) / 1000;
        } else {
          return item.costPrice / item.capacityPerSack;
        }
      } else {
        if (isSackUnit(unit, item)) {
          return item.costPrice;
        } else {
          if (item.capacityPerSack && item.capacityPerSack > 0) {
            return item.costPrice / item.capacityPerSack;
          }
          return item.costPrice;
        }
      }
    };

    // 1. Create Invoice structure
    const newInvoiceItems: InvoiceItem[] = cart.map(c => {
      const originalItem = items.find(i => i.id === c.itemId);
      return {
        itemId: c.itemId,
        name: c.name,
        unit: c.unit,
        quantity: c.quantity,
        sellPrice: c.sellPrice,
        costPrice: getCostPriceForUnit(originalItem, c.unit)
      };
    });

    const newInvoice: Invoice = {
      id: invoiceId,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || '',
      items: newInvoiceItems,
      totalAmount: calculateTotal(),
      paymentMethod,
      date: oldInvoice ? oldInvoice.date : new Date().toISOString()
    };

    // 2. Map to Sales entries
    const newSalesEntries: Sale[] = newInvoiceItems.map(item => ({
      id: crypto.randomUUID(),
      itemId: item.itemId,
      itemName: item.name,
      unit: item.unit,
      customerName: newInvoice.customerName,
      customerPhone: newInvoice.customerPhone,
      quantity: item.quantity,
      totalPrice: item.sellPrice * item.quantity,
      profit: (item.sellPrice - item.costPrice) * item.quantity,
      paymentMethod: newInvoice.paymentMethod,
      date: newInvoice.date,
      invoiceId: newInvoice.id,
      status: 'delivered',
      supplyStatus: 'none'
    }));

    // 3. Update Stock and write to Firestore
    const promises: Promise<void>[] = [];

    // Delete old sales if editing
    if (editingInvoiceId) {
      const oldSales = sales.filter(s => s.invoiceId === editingInvoiceId);
      oldSales.forEach(s => promises.push(deleteData(user.uid, 'sales', s.id)));
    }

    // Save new sales
    newSalesEntries.forEach(s => promises.push(saveData(user.uid, 'sales', s)));

    // Save invoice
    promises.push(saveData(user.uid, 'invoices', newInvoice));

    // Update items stock
    items.forEach(dbItem => {
      const invoiceUsage = newInvoiceItems.filter(i => i.itemId === dbItem.id);
      const oldInvoiceUsage = oldInvoice?.items.filter(i => i.itemId === dbItem.id) || [];
      
      let totalUsageBase = 0;
      invoiceUsage.forEach(iu => {
        totalUsageBase += getBaseQuantity(iu.unit, iu.quantity, dbItem);
      });
      
      let oldUsageBase = 0;
      oldInvoiceUsage.forEach(oiu => {
        oldUsageBase += getBaseQuantity(oiu.unit, oiu.quantity, dbItem);
      });

      const diffBase = oldUsageBase - totalUsageBase;

      if (diffBase !== 0) {
        const updatedItem = {
          ...dbItem,
          stock: Number((dbItem.stock + diffBase).toFixed(3)),
          soldCount: Number((dbItem.soldCount - diffBase).toFixed(3))
        };
        promises.push(saveData(user.uid, 'items', updatedItem));
      }
    });

    await Promise.all(promises);
    setShowPrintView(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadReceiptImage = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `Receipt_${customerName || 'Customer'}_${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading image:', err);
      alert('Failed to download image. Try printing as fallback.');
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          handleShareOriginalText();
          return;
        }
        
        try {
          const file = new File([blob], `Receipt_${customerName || 'Customer'}.jpg`, { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `${settings.shopName || 'Shop'} Receipt`,
              text: `Receipt from ${settings.shopName || 'Shop'}`
            });
          } else {
            downloadReceiptImage();
            const total = formatPrice(calculateTotal());
            const text = `*RECEIPT - ${settings.shopName?.toUpperCase() || 'SHOP'}*\nCustomer: ${customerName || t.walkInCustomer}\nTotal: ${total}`;
            navigator.clipboard.writeText(text);
            alert('Receipt image downloaded to your device, and plain summary copied to clipboard!');
          }
        } catch (shareErr) {
          console.error('Share failed, downloading instead:', shareErr);
          downloadReceiptImage();
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Error generating sharing image:', err);
      handleShareOriginalText();
    }
  };

  const handleShareOriginalText = () => {
    const total = formatPrice(calculateTotal());
    const date = new Date().toLocaleString();
    const itemsList = cart.map(i => `${i.name}: ${i.quantity} x ${formatPrice(i.sellPrice)} = ${formatPrice(i.quantity * i.sellPrice)}`).join('\n');
    const text = `*RECEIPT - ${settings.shopName?.toUpperCase() || 'SUNSET GROCERY'}*\nDate: ${date}\nCustomer: ${customerName || t.walkInCustomer}\n\n*${t.tableItem}:*\n${itemsList}\n\n*${t.total}: ${total}*\n${t.paymentMethod}: ${paymentMethod}\n\n${t.thanksShopping}`;
    if (navigator.share) {
      navigator.share({
        title: `${settings.shopName || 'Shop'} Receipt`,
        text: text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert('Receipt text copied to clipboard!');
    }
  };

  const resetBilling = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('Cash');
    setShowPrintView(false);
    setEditingInvoiceId(null);
    localStorage.removeItem('billing_customerName');
    localStorage.removeItem('billing_customerPhone');
    localStorage.removeItem('billing_cart');
    localStorage.removeItem('billing_editingInvoiceId');
    localStorage.removeItem('billing_paymentMethod');
    localStorage.removeItem('billing_selectedUnits');
    localStorage.removeItem('billing_cartPurchaseModes');
    localStorage.removeItem('billing_cartTargetAmounts');
  };

  const handleQuickAddItem = async () => {
    if (!user || !newItemData.name) return;

    let stock = Number(newItemData.stock) || 0;
    let isWeightBased = quickAddPackagingType !== 'loose';
    let sackCount = Number(newItemData.sackCount) || 0;
    let capacityPerSack = Number(newItemData.capacityPerSack) || 0;
    let sackUnit = newItemData.sackUnit || (quickAddPackagingType === 'box' ? 'box' : 'sack');
    let saleUnit = newItemData.saleUnit || (quickAddPackagingType === 'box' ? 'pcs' : 'kg');
    let pricePerSack = Number(newItemData.pricePerSack) || 0;
    let unit = newItemData.unit || (isWeightBased ? saleUnit : 'pcs');

    if (isWeightBased) {
      stock = sackCount * capacityPerSack;
      unit = saleUnit;
    } else {
      sackCount = 0;
      capacityPerSack = 0;
      pricePerSack = 0;
      sackUnit = '';
      saleUnit = '';
    }

    const newItem: Item = {
      id: crypto.randomUUID(),
      name: newItemData.name,
      category: newItemData.category || 'Others',
      stock,
      costPrice: Number(newItemData.costPrice) || 0,
      sellPrice: Number(newItemData.sellPrice) || 0,
      soldCount: 0,
      unit,
      isWeightBased,
      sackCount,
      capacityPerSack,
      sackUnit,
      saleUnit,
      pricePerSack,
      history: [{
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        field: 'stock',
        oldValue: 0,
        newValue: stock,
        description: 'Added via Billing'
      }]
    };

    await saveData(user.uid, 'items', newItem);
    setIsAddingItem(false);
    setQuickAddPackagingType('loose');
    setNewItemData({
      name: '',
      category: 'Others',
      stock: 0,
      costPrice: 0,
      sellPrice: 0,
      unit: 'pcs',
      isWeightBased: false,
      sackCount: 0,
      capacityPerSack: 0,
      sackUnit: 'kg',
      saleUnit: 'kg',
      pricePerSack: 0
    });
  };
  const startEditInvoice = (invoice: Invoice) => {
    setEditingInvoiceId(invoice.id);
    setCustomerName(invoice.customerName);
    setCustomerPhone(invoice.customerPhone || '');
    setPaymentMethod(invoice.paymentMethod as any);
    
    const restoredCart: CartItem[] = invoice.items.map(item => ({
      id: crypto.randomUUID(),
      itemId: item.itemId,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      sellPrice: item.sellPrice
    }));
    
    setCart(restoredCart);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (showPrintView) {
    return (
      <div className="mx-auto max-w-2xl bg-zinc-950/20 border border-white/5 p-2 sm:p-12 rounded-[40px] shadow-2xl overflow-hidden backdrop-blur-xl space-y-8">
        {/* Buttons above the receipt (ignored by html2canvas save) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden border-b border-white/10 pb-6">
          <button onClick={resetBilling} className="flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm font-bold uppercase tracking-wider">
            <ArrowLeft className="h-4 w-4" /> {t.newBill}
          </button>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={downloadReceiptImage} 
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-2xl transition-all font-bold text-xs uppercase tracking-wider border border-white/10"
            >
              <Download className="h-4 w-4 text-emerald-400" /> Save JPG
            </button>
            <button 
              onClick={handleShare} 
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-2xl transition-all font-bold text-xs uppercase tracking-wider border border-white/10"
            >
              <Share2 className="h-4 w-4 text-orange-400" /> {t.share}
            </button>
            <button 
              onClick={handlePrint} 
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-2xl cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95 transition-all font-bold text-xs uppercase tracking-wider"
            >
              <Printer className="h-4 w-4" /> {t.printBill}
            </button>
          </div>
        </div>

        {/* The Receipt Visual Card wrapped in a gorgeous Sunset/App-style backdrop container (targeted by html2canvas ref) */}
        <div 
          ref={receiptRef}
          className="p-2 sm:p-6 rounded-[40px] shadow-2xl max-w-[540px] w-full mx-auto relative overflow-hidden transition-all print:p-0 print:bg-transparent print:shadow-none"
          style={{ 
            background: settings.theme === 'light'
              ? 'linear-gradient(135deg, #ffcf8a 0%, #fff7ed 50%, #e0f2fe 100%)'
              : 'linear-gradient(135deg, #110500 0%, #1a0b00 30%, #4b0082 70%, #ff8c00 100%)',
          }}
        >
          {/* Ambient atmosphere effect inside download image wrapper */}
          <div className={`absolute rounded-full blur-[40px] pointer-events-none opacity-20 print:hidden ${
            settings.theme === 'light'
              ? 'top-[-40px] left-[-30px] h-[120px] w-[120px] bg-yellow-400'
              : 'bottom-[-40px] right-[-30px] h-[160px] w-[160px] bg-gradient-to-t from-[#ff4e00] to-transparent'
          }`} />

          <div 
            className="bg-white text-black p-4 sm:p-8 rounded-[32px] shadow-2xl border border-gray-100 font-sans relative overflow-hidden"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            {/* Subtle receipt top ornament / paper edge pattern */}
            <div className="absolute top-0 left-0 right-0 flex justify-between overflow-hidden opacity-10">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-4 h-4 bg-black rotate-45 transform -translate-y-2"></div>
              ))}
            </div>

          <div className="text-center mt-4 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-50 border border-gray-100 rounded-full mb-3 text-gray-800">
              <Receipt className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 leading-none">
              {settings.shopName || 'Sunset Grocery'}
            </h1>
            
            {/* Branded Address & Phone Number */}
            {settings.shopAddress && (
              <p className="text-[11px] text-gray-500 mt-2 font-medium max-w-[220px] mx-auto uppercase">
                {settings.shopAddress}
              </p>
            )}
            {settings.shopPhone && (
              <p className="text-[11px] text-gray-500 mt-1 font-semibold flex items-center justify-center gap-1">
                <Phone className="h-3 w-3 inline text-gray-400" /> {settings.shopPhone}
              </p>
            )}

            <div className="my-4 border-t border-dashed border-gray-200"></div>
            
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
              {t.officialReceipt}
            </p>

            <div className="mt-4 border border-gray-100 rounded-2xl bg-gray-50/50 p-3 grid grid-cols-2 gap-2 text-left">
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">{t.billFor}</p>
                <p className="font-bold text-xs text-gray-800 line-clamp-1">{customerName || t.walkInCustomer}</p>
                {customerPhone && <p className="text-[10px] text-gray-500 font-medium">{customerPhone}</p>}
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">{t.paymentMethod}</p>
                <p className="font-bold text-xs text-gray-800">
                  {t[paymentMethod.toLowerCase().replace(' ', '')] || paymentMethod}
                </p>
              </div>
            </div>
          </div>

          {/* Cart items list on the receipt paper */}
          <div className="mb-6">
            <table className="w-full text-left table-auto">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] uppercase font-bold text-gray-400">
                  <th className="py-2.5 font-bold pr-3">{t.tableItem}</th>
                  <th className="py-2.5 font-bold text-center px-2">Qty</th>
                  <th className="py-2.5 font-bold text-right px-2">Price</th>
                  <th className="py-2.5 font-bold text-right pl-3">{t.total}</th>
                </tr>
              </thead>
              <tbody className="text-[11px] sm:text-xs">
                {cart.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-100/50">
                    <td className="py-3 font-medium uppercase text-gray-800 leading-tight pr-3 break-words max-w-[120px] sm:max-w-none">
                      {item.name}
                    </td>
                    <td className="py-3 text-center text-gray-600 font-medium px-2 whitespace-nowrap">
                      {item.quantity % 1 === 0 ? item.quantity : Number(item.quantity.toFixed(2))} {item.unit}
                    </td>
                    <td className="py-3 text-right text-gray-600 font-medium px-2 whitespace-nowrap">
                      {formatPrice(item.sellPrice)}
                    </td>
                    <td className="py-3 text-right font-bold text-gray-900 pl-3 whitespace-nowrap">
                      {formatPrice(item.sellPrice * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-4 text-right font-bold text-[11px] uppercase tracking-wider text-gray-500">
                    {t.totalBalance}
                  </td>
                  <td className="py-4 text-right text-base sm:text-xl font-black text-gray-900 font-sans whitespace-nowrap pl-3">
                    {formatPrice(calculateTotal())}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-5 text-center">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-widest">{t.thanksShopping}</p>
            <p className="text-[9px] font-mono text-gray-400 mt-1">{new Date().toLocaleString()}</p>
            
            {/* Dynamic QR Code at the bottom of receipt card containing full invoice details */}
            <div className="flex flex-col items-center justify-center mt-6 space-y-2">
              <div className="p-3 bg-white border border-gray-100 rounded-3xl shadow-sm inline-block">
                <QRCodeSVG 
                  value={JSON.stringify({
                    prefix: "sunset_invoice",
                    id: editingInvoiceId || "PENDING",
                    customerName: customerName || "Walk-in Customer",
                    customerPhone: customerPhone || "",
                    paymentMethod,
                    totalAmount: calculateTotal(),
                    date: new Date().toISOString().split('T')[0],
                    items: cart.map(item => ({
                      name: item.name,
                      itemId: item.itemId,
                      quantity: item.quantity,
                      unit: item.unit,
                      sellPrice: item.sellPrice
                    }))
                  })} 
                  size={120} 
                  level="M" 
                  includeMargin={true}
                  className="mx-auto"
                />
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-gray-700 font-sans">
                {editingInvoiceId ? `BILL ID: ${editingInvoiceId.slice(0, 8).toUpperCase()}` : 'DRAFT BILL'}
              </span>
              <p className="text-[8px] font-mono text-gray-400 max-w-[180px] mx-auto leading-normal">
                Scan on Dashboard to instantly view, update or modify this receipt.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-12 max-w-full overflow-hidden">
       <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter sm:text-5xl md:text-7xl uppercase">
            {t.billingTitle} <span className="text-blue-500">.</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">{t.billingSubtitle}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowHistory(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-orange-500/10 border border-orange-500/20 px-6 sm:px-8 py-3 text-xs sm:text-sm font-bold text-orange-500 hover:bg-orange-500/20 transition-all shadow-lg shadow-orange-500/5 group"
          >
            <History className="h-4 w-4 group-hover:rotate-[-45deg] transition-transform" /> {t.viewSalesHistory || 'Sales History'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:gap-12 lg:grid-cols-3">
        <section className="space-y-6 md:space-y-8 lg:col-span-1">
          <div className="rounded-3xl sm:rounded-[40px] border border-white/10 bg-white/5 p-4 sm:p-8 backdrop-blur-xl">
            <h2 className="mb-6 text-xl font-medium">
              {editingInvoiceId ? t.updateCustomer : t.customerInfo}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <User className="h-4 w-4" /> {t.productName.split(' ')[0]} {t.tableItem}
                </label>
                <input 
                  type="text"
                  value={customerName || ''}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder={t.enterName}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 outline-none focus:border-blue-500/50 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {t.phoneNumber}
                </label>
                <input 
                  type="tel"
                  value={customerPhone || ''}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder={t.enterPhone}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 outline-none focus:border-blue-500/50 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl sm:rounded-[40px] border border-white/10 bg-white/5 p-4 sm:p-8 backdrop-blur-xl">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={t.searchProducts}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 pl-12 outline-none focus:border-blue-500/50 text-white"
                  />
                  <ShoppingCart className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/20" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPosScanAlert(null);
                    setIsCheckoutScannerOpen(true);
                  }}
                  className="rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/15 px-6 py-4 flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 transition-all active:scale-95 text-xs font-black uppercase tracking-widest cursor-pointer shadow-md shadow-orange-500/5 shrink-0"
                >
                  <Barcode className="h-4 w-4" />
                  <span>Scan checkout</span>
                </button>
              </div>

              {posScanAlert && (
                <div className={cn(
                  "rounded-2xl p-4 border flex items-center justify-between gap-3 text-xs font-medium animate-fade-in",
                  posScanAlert.type === 'success' 
                    ? "bg-green-500/10 border-green-500/20 text-green-400" 
                    : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
                    <span>{posScanAlert.message}</span>
                  </div>
                  <button 
                    onClick={() => setPosScanAlert(null)}
                    className="text-[10px] uppercase tracking-widest font-black underline hover:no-underline opacity-65 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Quick Favorites Row */}
              {favoriteProducts.length > 0 && (
                <div className="p-4 rounded-3xl border border-white/5 bg-black/20 space-y-2 animate-fade-in">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      {billingLabels.quickFavorites}
                    </span>
                    <span className="text-[10px] text-white/40 leading-none mt-0.5">
                      {billingLabels.quickFavoritesSubtitle}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {favoriteProducts.map(item => (
                      <button
                        key={`fav-${item.id}`}
                        type="button"
                        onClick={() => addItemToCart(item)}
                        className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs font-semibold text-white/95 hover:border-blue-500/30 hover:bg-blue-500/10 flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Plus className="h-3 w-3 text-blue-400" />
                        <span>{item.name}</span>
                        <span className="text-[10px] text-white/40">({item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(1))} {item.unit})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category selection scroll bar */}
              <div className="space-y-2 animate-fade-in">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                  {billingLabels.categories}
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {customCategories.map((cat) => (
                    <button
                      key={`cat-${cat}`}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap active:scale-95",
                        selectedCategory === cat
                          ? "bg-blue-500 text-white shadow-md shadow-blue-500/10 font-bold"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      )}
                    >
                      {cat === 'All' ? billingLabels.allCategories : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
                <button 
                  onClick={() => {
                    setNewItemData({ ...newItemData, name: searchTerm });
                    setIsAddingItem(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-3xl border border-dashed border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 transition-all mb-4"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">{searchTerm ? `Add "${searchTerm}" to Inventory` : 'Add New Product'}</span>
                </button>

                {filteredItems.map(item => {
                  const isOutOfStock = item.stock <= 0;

                  return (
                    <motion.div
                      layout
                      key={item.id}
                      className={cn(
                        "flex flex-row items-center justify-between gap-4 rounded-3xl border p-5 transition-all",
                        isOutOfStock 
                          ? "border-red-500/10 bg-red-500/[0.02]" 
                          : "border-white/5 bg-white/5 hover:border-blue-500/30 hover:bg-white/10"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base tracking-tight leading-normal uppercase text-white/90">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-xs text-white/40 font-medium flex items-center gap-1.5">
                            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", isOutOfStock ? "bg-red-500" : item.stock < 10 ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
                            {isOutOfStock ? (settings.language === 'es' ? 'Agotado (0 disp.)' : 'Out of Stock') : `${item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(1))} ${item.unit || 'units'} ${t.inStock}`}
                          </p>
                          {item.category && (
                            <span className="shrink-0 rounded-full bg-white/5 text-white/40 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wider">
                              {item.category}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs font-black text-blue-400">
                          {formatPrice(item.sellPrice)} / {item.unit || 'pcs'}
                        </div>
                      </div>

                      <button
                        onClick={() => addItemToCart(item)}
                        disabled={isOutOfStock}
                        className={cn(
                          "flex h-10 px-5 items-center justify-center gap-1.5 rounded-xl text-xs uppercase tracking-wider font-black transition-all active:scale-95 shadow-md",
                          isOutOfStock
                            ? "bg-white/5 text-white/20 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600 shadow-blue-500/15"
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t.add || 'Add'}</span>
                      </button>
                    </motion.div>
                  );
                })}
                {filteredItems.length === 0 && (
                  <p className="py-8 text-center text-sm text-white/20 w-full">{t.noProductsFound || 'No products found.'}</p>
                )}
              </div>
            </div>

          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="relative h-full min-h-[500px] overflow-hidden rounded-3xl sm:rounded-[40px] border border-white/10 bg-black/20 p-4 sm:p-8 backdrop-blur-md">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-medium flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-400" />
                {editingInvoiceId ? `${t.editingBill}${editingInvoiceId.slice(0, 8)}` : t.currentBill}
              </h2>
              <div className="flex items-center gap-3">
                {(editingInvoiceId || cart.length > 0 || customerName || customerPhone) && (
                  <button 
                    onClick={resetBilling}
                    className="text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full hover:bg-red-400/20 transition-all flex items-center gap-1"
                  >
                    {editingInvoiceId ? t.cancelEdit : t.cancel}
                  </button>
                )}
                <span className="rounded-full bg-blue-500/20 px-4 py-1 text-xs font-bold text-blue-400">
                  {cart.length} {t.transactions}
                </span>
              </div>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
              <AnimatePresence initial={false}>
                {cart.map((cartItem, idx) => {
                  const originalItem = items.find(i => i.id === cartItem.itemId);
                  const isWeightUnit = ['kg', 'g', 'L', 'ml', 'lb', 'oz'].includes(cartItem.unit.toLowerCase());
                  const qtyOptions = isWeightUnit 
                    ? [0.25, 0.5, 1, 2, 5, 10, 25] 
                    : [1, 2, 5, 10, 12, 24, 50];

                  return (
                    <motion.div 
                      key={cartItem.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/5 p-6"
                    >
                      {/* Cart Item Header: Indexed count, Name, Category and Trash Action */}
                      <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                        <p className="text-base font-black italic tracking-tight flex items-center gap-2 text-white/95">
                          <span className="text-blue-500 font-mono text-sm leading-none">#{idx + 1}</span>
                          <span className="truncate uppercase">{cartItem.name}</span>
                        </p>
                        
                        <button 
                          onClick={() => removeFromCart(cartItem.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Flex row for selection and numbers */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* 1. Selling Unit Selector & Quick Buttons */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                            {settings.language === 'es' ? 'Unidad de Venta' : 'Selling Unit'}
                          </span>
                          <input
                            type="text"
                            value={cartItem.unit}
                            onChange={(e) => updateCartItemUnit(cartItem.id, e.target.value)}
                            placeholder={settings.language === 'es' ? 'ej. Kg, Pack, Sachet' : 'e.g. Kg, Pack, Sachet'}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500/50 uppercase"
                          />
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {(() => {
                              const orig = items.find(i => i.id === cartItem.itemId);
                              const availableUnits = new Set<string>();
                              if (orig) {
                                if (orig.unit) availableUnits.add(orig.unit.toLowerCase());
                                if (orig.saleUnit) availableUnits.add(orig.saleUnit.toLowerCase());
                                if (orig.sackUnit) availableUnits.add(orig.sackUnit.toLowerCase());
                                if (orig.allowBothModes) {
                                  availableUnits.add('pcs');
                                  availableUnits.add(orig.saleUnit?.toLowerCase() || 'kg');
                                }
                                if (orig.capacityPerSack && orig.capacityPerSack > 0) {
                                  availableUnits.add(orig.sackUnit?.toLowerCase() || 'bag');
                                }
                              }
                              // Fallback standard units if nothing else
                              if (availableUnits.size === 0) {
                                ['pcs', 'kg', 'g', 'pack', 'bag', 'box'].forEach(u => availableUnits.add(u));
                              }
                              
                              return Array.from(availableUnits)
                                .filter(u => u !== cartItem.unit.toLowerCase())
                                .map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => updateCartItemUnit(cartItem.id, opt)}
                                    className="rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors"
                                  >
                                    {opt}
                                  </button>
                                ));
                            })()}
                          </div>
                        </div>

                        {/* 2. Purchase Mode Toggle & Quantity Controls */}
                        <div className="space-y-1.5 border-t border-white/5 pt-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                            {billingLabels.purchaseMode}
                          </span>
                          <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/5 text-[8px] font-black uppercase tracking-wider mb-2">
                            <button
                              type="button"
                              onClick={() => handleCartTogglePurchaseMode(cartItem.id, 'quantity', cartItem.quantity, cartItem.sellPrice)}
                              className={cn(
                                "flex-1 py-1 px-2 rounded-md transition-all text-center animate-fade-in",
                                (cartPurchaseModes[cartItem.id] || 'quantity') === 'quantity'
                                  ? "bg-blue-500 text-white font-bold"
                                  : "text-white/40 hover:text-white"
                              )}
                            >
                              {billingLabels.byQuantity}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCartTogglePurchaseMode(cartItem.id, 'amount', cartItem.quantity, cartItem.sellPrice)}
                              className={cn(
                                "flex-1 py-1 px-2 rounded-md transition-all text-center animate-fade-in",
                                cartPurchaseModes[cartItem.id] === 'amount'
                                  ? "bg-blue-500 text-white font-bold"
                                  : "text-white/40 hover:text-white"
                              )}
                            >
                              {billingLabels.byAmount}
                            </button>
                          </div>

                          {(cartPurchaseModes[cartItem.id] || 'quantity') === 'quantity' ? (
                            <div className="space-y-1.5 animate-fade-in">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                                {settings.language === 'es' ? 'Cantidad de Producto' : 'Product Quantity'}
                              </span>
                              
                              <div className="flex items-center justify-between rounded-xl bg-black/40 p-0.5 border border-white/5 max-w-[200px]">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const step = isWeightUnit ? 0.25 : 1;
                                    const val = Math.max(0.01, Number((cartItem.quantity - step).toFixed(3)));
                                    updateCartQuantityDirect(cartItem.id, val);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-white/45 hover:text-white transition-colors"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input 
                                  type="number"
                                  value={cartItem.quantity}
                                  onChange={(e) => {
                                    const val = Math.max(0.01, Number(parseFloat(e.target.value) || 1));
                                    updateCartQuantityDirect(cartItem.id, val);
                                  }}
                                  className="w-14 text-center bg-transparent outline-none font-black text-xs text-white"
                                  step={isWeightUnit ? 0.25 : 1}
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const step = isWeightUnit ? 0.25 : 1;
                                    const val = Number((cartItem.quantity + step).toFixed(3));
                                    updateCartQuantityDirect(cartItem.id, val);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg text-white/45 hover:text-white transition-colors"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {qtyOptions.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => updateCartQuantityDirect(cartItem.id, opt)}
                                    className={cn(
                                      "px-1 py-0.5 text-[8px] font-bold rounded-md border transition-all",
                                      cartItem.quantity === opt
                                        ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                        : "bg-black/15 border-white/5 text-white/55 hover:bg-white/5 hover:text-white"
                                    )}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5 animate-fade-in">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                                {billingLabels.amountToPay} ({settings.currency})
                              </span>
                              <input
                                type="number"
                                placeholder={billingLabels.enterAmount}
                                value={cartTargetAmounts[cartItem.id] || ''}
                                onChange={(e) => handleCartTargetAmountChange(cartItem.id, e.target.value, cartItem.sellPrice)}
                                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500/50"
                              />
                              <div className="flex justify-between items-center text-[10px] bg-blue-500/5 border border-blue-500/10 rounded-lg p-2 font-semibold">
                                <span className="text-blue-400">{billingLabels.equivalentQty}:</span>
                                <span className="text-white font-bold bg-black/35 px-1.5 py-0.5 rounded">
                                  {cartItem.quantity} {cartItem.unit.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Display price rate and calculated total amount */}
                      <div className="mt-2 flex justify-between items-center px-3 py-2 bg-black/40 border border-white/5 rounded-2xl text-[11px] font-bold leading-none">
                        <span className="text-blue-400">Rate: {formatPrice(cartItem.sellPrice)} / {cartItem.unit}</span>
                        <span className="text-emerald-400">Total Amount: {formatPrice(cartItem.sellPrice * cartItem.quantity)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-white/20">
                  <ShoppingCart className="h-16 w-16 mb-4 opacity-10" />
                  <p>{t.cartEmpty}</p>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-12 sticky bottom-0 border-t border-white/10 bg-black/40 -mb-5 mx-0 md:-mx-8 md:-mb-8 p-4 md:p-8 backdrop-blur-xl space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 px-2">{t.selectPayment}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Cash', icon: Wallet, label: t.cash },
                      { id: 'Card', icon: CreditCard, label: t.card },
                      { id: 'Mobile Payment', icon: Smartphone, label: t.mobilePayment },
                    ].map((method) => {
                      const Icon = method.icon;
                      const isActive = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all",
                            isActive 
                              ? "border-blue-500 bg-blue-500/20 text-blue-400" 
                              : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-white/20")} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-6">
                  <span className="text-white/40 font-medium">{t.totalBalance}</span>
                  <span className="text-4xl font-black text-white">{formatPrice(calculateTotal())}</span>
                </div>

                <button 
                  onClick={handleFinalizeAndPrint}
                  className="flex w-full items-center justify-center gap-2 rounded-3xl bg-white py-5 text-lg font-black text-black shadow-2xl transition-all hover:bg-blue-50 active:scale-[0.98]"
                >
                  <Printer className="h-5 w-5" />
                  {editingInvoiceId ? t.updatePrintBill : t.recordPrintBill}
                </button>
              </div>
            )}
          </div>

        </section>
      </div>

      <section className="mt-12 rounded-3xl sm:rounded-[40px] border border-white/10 bg-white/5 p-4 sm:p-8 backdrop-blur-xl overflow-hidden">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-black italic tracking-tight flex items-center gap-4 uppercase">
            <History className="h-6 w-6 text-orange-500" />
            {t.recentBills}
          </h2>
          <Link to="/sales" className="text-sm text-blue-400 hover:underline">{t.viewSales}</Link>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar md:grid md:grid-cols-2 lg:grid-cols-3 pb-4">
          {[...invoices].reverse().slice(0, 6).map((invoice) => (
            <motion.div 
              whileTap={{ scale: 0.98 }}
              key={invoice.id} 
              className="group relative shrink-0 w-[280px] rounded-3xl border border-white/5 bg-black/20 p-6 flex flex-col justify-between hover:bg-black/30 transition-all md:w-full"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <p className="text-lg font-black italic tracking-tight truncate max-w-[140px] uppercase">{invoice.customerName}</p>
                  <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">{formatPrice(invoice.totalAmount)}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/40">{invoice.items.length} {t.tableItem}</p>
                  {invoice.customerPhone && <p className="text-[10px] text-white/20 flex items-center gap-2"><Phone className="h-2 w-2" /> {invoice.customerPhone}</p>}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/20">{new Date(invoice.date).toLocaleDateString()}</p>
                <button 
                  onClick={() => startEditInvoice(invoice)}
                  className="text-xs font-bold text-white bg-white/10 hover:bg-white px-3 py-1.5 rounded-xl hover:text-black transition-all md:opacity-0 md:group-hover:opacity-100"
                >
                  {t.editBill}
                </button>
              </div>
            </motion.div>
          ))}
          {invoices.length === 0 && (
            <div className="col-span-full py-12 text-center text-white/20 italic w-full">{t.noBillHistory}</div>
          )}
        </div>

      </section>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingItem(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl sm:rounded-[40px] p-5 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Quick Add Item</h2>
                <button onClick={() => setIsAddingItem(false)} className="text-white/40 hover:text-white"><ArrowLeft className="rotate-180" /></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Product Name</label>
                  <input 
                    type="text"
                    value={newItemData.name || ''}
                    onChange={e => setNewItemData({ ...newItemData, name: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 outline-none focus:border-blue-500/50"
                  />
                </div>

                {/* Stock Packaging Type Selector */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-1">How is this item packed/sold?</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddPackagingType('loose');
                        setNewItemData(prev => ({
                          ...prev,
                          isWeightBased: false,
                          unit: 'kg',
                          sackUnit: '',
                          saleUnit: '',
                          sackCount: 0,
                          capacityPerSack: 0,
                          pricePerSack: 0,
                          stock: 0
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1",
                        quickAddPackagingType === 'loose'
                          ? "bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                      )}
                    >
                      <span className="text-lg">⚖️</span>
                      <span className="text-[9px] font-black uppercase tracking-tight">Loose / Direct</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddPackagingType('sack');
                        setNewItemData(prev => ({
                          ...prev,
                          isWeightBased: true,
                          sackUnit: 'bag',
                          saleUnit: 'kg',
                          unit: 'kg',
                          sackCount: prev.sackCount || 1,
                          capacityPerSack: prev.capacityPerSack || 50,
                          pricePerSack: 0
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1",
                        quickAddPackagingType === 'sack'
                          ? "bg-amber-600/30 border-amber-500 text-amber-200 shadow-lg"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                      )}
                    >
                      <span className="text-lg">👝</span>
                      <span className="text-[9px] font-black uppercase tracking-tight">Bags / Sacks</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddPackagingType('box');
                        setNewItemData(prev => ({
                          ...prev,
                          isWeightBased: true,
                          sackUnit: 'box',
                          saleUnit: 'pcs',
                          unit: 'pcs',
                          sackCount: prev.sackCount || 1,
                          capacityPerSack: prev.capacityPerSack || 24,
                          pricePerSack: 0
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1",
                        quickAddPackagingType === 'box'
                          ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-lg"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                      )}
                    >
                      <span className="text-lg">📦</span>
                      <span className="text-[9px] font-black uppercase tracking-tight">Boxes / Cartons</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Configuration Fields Card */}
                <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                  {quickAddPackagingType === 'loose' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Unit</label>
                          <select 
                            value={newItemData.unit || 'kg'}
                            onChange={e => setNewItemData({ ...newItemData, unit: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs text-white"
                          >
                            <option value="kg">Kilograms (kg)</option>
                            <option value="g">Grams (g)</option>
                            <option value="L">Liters (L)</option>
                            <option value="ml">Milliliters (ml)</option>
                            <option value="pcs">Pieces (pcs)</option>
                            <option value="pkt">Packet (pkt)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Loose Stock</label>
                          <input 
                            type="number"
                            placeholder="e.g. 20"
                            value={newItemData.stock || ''}
                            onChange={e => setNewItemData({ ...newItemData, stock: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {quickAddPackagingType === 'sack' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Bags</label>
                          <input 
                            type="number"
                            placeholder="e.g. 5"
                            value={newItemData.sackCount || ''}
                            onChange={e => setNewItemData({ ...newItemData, sackCount: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Capacity per Bag</label>
                          <div className="flex gap-2 min-w-0">
                            <input 
                              type="number"
                              placeholder="50"
                              value={newItemData.capacityPerSack || ''}
                              onChange={e => setNewItemData({ ...newItemData, capacityPerSack: Number(e.target.value) })}
                              className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                            />
                            <select 
                              value={newItemData.sackUnit || 'bag'}
                              onChange={e => setNewItemData({ ...newItemData, sackUnit: e.target.value })}
                              className="w-20 shrink-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs text-white"
                            >
                              <option value="bag">bag</option>
                              <option value="sack">sack</option>
                              <option value="tin">tin</option>
                              <option value="kg">kg</option>
                              <option value="L">L</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Retail Sale Unit</label>
                        <select 
                          value={newItemData.saleUnit || 'kg'}
                          onChange={e => setNewItemData({ ...newItemData, saleUnit: e.target.value, unit: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs text-white"
                        >
                          <option value="kg">Kilograms (kg)</option>
                          <option value="g">Grams (g)</option>
                          <option value="L">Liters (L)</option>
                          <option value="ml">Milliliters (ml)</option>
                          <option value="pcs">Pieces (pcs)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Whole Bag Sell Price (Optional)</label>
                        <input 
                          type="number"
                          placeholder="e.g. 5800"
                          value={newItemData.pricePerSack || ''}
                          onChange={e => setNewItemData({ ...newItemData, pricePerSack: Number(e.target.value) })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {quickAddPackagingType === 'box' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Boxes</label>
                          <input 
                            type="number"
                            placeholder="e.g. 5"
                            value={newItemData.sackCount || ''}
                            onChange={e => setNewItemData({ ...newItemData, sackCount: Number(e.target.value) })}
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Capacity per Box</label>
                          <div className="flex gap-2 min-w-0">
                            <input 
                              type="number"
                              placeholder="24"
                              value={newItemData.capacityPerSack || ''}
                              onChange={e => setNewItemData({ ...newItemData, capacityPerSack: Number(e.target.value) })}
                              className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                            />
                            <select 
                              value={newItemData.sackUnit || 'box'}
                              onChange={e => setNewItemData({ ...newItemData, sackUnit: e.target.value })}
                              className="w-20 shrink-0 rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs text-white"
                            >
                              <option value="box">box</option>
                              <option value="carton">carton</option>
                              <option value="pack">pack</option>
                              <option value="pcs">pcs</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Retail Sale Unit</label>
                        <select 
                          value={newItemData.saleUnit || 'pcs'}
                          onChange={e => setNewItemData({ ...newItemData, saleUnit: e.target.value, unit: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-xs text-white"
                        >
                          <option value="pcs">Pieces (pcs)</option>
                          <option value="pkt">Packet (pkt)</option>
                          <option value="box">Box (box)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Whole Box Sell Price (Optional)</label>
                        <input 
                          type="number"
                          placeholder="e.g. 1350"
                          value={newItemData.pricePerSack || ''}
                          onChange={e => setNewItemData({ ...newItemData, pricePerSack: Number(e.target.value) })}
                          className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                      {quickAddPackagingType === 'loose' ? `Cost Price (per ${newItemData.unit || 'kg'})` : 'Cost (per Bag/Box)'}
                    </label>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={newItemData.costPrice || ''}
                      onChange={e => setNewItemData({ ...newItemData, costPrice: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 outline-none text-sm text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                      {quickAddPackagingType === 'loose' ? `Sell Price (per ${newItemData.unit || 'kg'})` : `Sell (per ${newItemData.saleUnit || 'pcs'})`}
                    </label>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={newItemData.sellPrice || ''}
                      onChange={e => setNewItemData({ ...newItemData, sellPrice: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 outline-none text-sm text-white"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleQuickAddItem}
                  className="w-full rounded-3xl bg-blue-500 py-4 font-black text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                  SAVE TO INVENTORY
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sales History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-white/10 z-[101] flex flex-col p-5 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                  {t.salesHistory || 'Sales History'} <span className="text-orange-500">.</span>
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"
                >
                  <ArrowLeft className="rotate-180" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
                {[...sales].reverse().slice(0, 20).map((sale) => (
                  <div key={sale.id} className="bg-white/5 border border-white/5 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black italic uppercase text-lg leading-none">{sale.itemName}</p>
                        <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mt-1">
                          {sale.quantity} {sale.unit} • {new Date(sale.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-orange-500">{formatPrice(sale.totalPrice)}</p>
                        <p className="text-[10px] uppercase font-bold text-white/40">{sale.paymentMethod}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-white/40">{sale.customerName}</span>
                      <span className="text-green-500 font-bold">+{formatPrice(sale.profit)} {t.profit}</span>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && (
                  <div className="text-center py-20 text-white/20 italic">No sales recorded yet.</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Point-Of-Sale Barcode Scanner Checkout */}
      <BarcodeScannerModal
        isOpen={isCheckoutScannerOpen}
        onClose={() => setIsCheckoutScannerOpen(false)}
        title="POS Barcode Scanner"
        placeholder="Enter barcode to add to cart..."
        onScan={(code) => {
          const matched = items.find(it => it.barcode?.trim() === code.trim());
          if (matched) {
            addItemToCart(matched);
            setPosScanAlert({
              message: `Successfully added "${matched.name}" to checkout cart!`,
              type: 'success'
            });
          } else {
            setSearchTerm(code);
            setPosScanAlert({
              message: `No item has barcode "${code}". We've set the search query so you can add it or look up similar items.`,
              type: 'info'
            });
          }
        }}
      />
    </div>
  );
};
