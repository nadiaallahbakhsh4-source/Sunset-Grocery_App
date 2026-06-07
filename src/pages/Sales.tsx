import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, Plus, Calendar, Trash2, Tag, Wallet, CreditCard, Smartphone, 
  Minus, Search, ArrowRight, User, Package, Check, ArrowLeft, RefreshCw, AlertCircle, ShoppingBag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Item, Sale, Settings } from '../types';
import { cn } from '../lib/utils';
import { translations } from '../lib/translations';
import { useFirebase } from '../components/FirebaseProvider';
import { saveData, deleteData } from '../lib/dataService';

interface SalesProps {
  items: Item[];
  sales: Sale[];
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
  costPrice: number;
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

export const Sales: React.FC<SalesProps> = ({ items, sales, formatPrice, settings }) => {
  const { user } = useFirebase();
  const t = translations[settings.language] || translations.en;
  
  // States
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('sales_cart');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('sales_customerName') || '');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Mobile Payment'>(() => {
    const saved = localStorage.getItem('sales_paymentMethod');
    return (saved as any) || 'Cash';
  });
  const [productSearch, setProductSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sales_selectedUnits');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Advanced features states
  const [purchaseModes, setPurchaseModes] = useState<Record<string, 'quantity' | 'amount'>>(() => {
    const saved = localStorage.getItem('sales_purchaseModes');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [targetAmounts, setTargetAmounts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sales_targetAmounts');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  React.useEffect(() => {
    localStorage.setItem('sales_cart', JSON.stringify(cart));
  }, [cart]);

  React.useEffect(() => {
    localStorage.setItem('sales_customerName', customerName);
  }, [customerName]);

  React.useEffect(() => {
    localStorage.setItem('sales_paymentMethod', paymentMethod);
  }, [paymentMethod]);

  React.useEffect(() => {
    localStorage.setItem('sales_selectedUnits', JSON.stringify(selectedUnits));
  }, [selectedUnits]);

  React.useEffect(() => {
    localStorage.setItem('sales_purchaseModes', JSON.stringify(purchaseModes));
  }, [purchaseModes]);

  React.useEffect(() => {
    localStorage.setItem('sales_targetAmounts', JSON.stringify(targetAmounts));
  }, [targetAmounts]);

  const resetSales = () => {
    setCart([]);
    setCustomerName('');
    setPaymentMethod('Cash');
    localStorage.removeItem('sales_cart');
    localStorage.removeItem('sales_customerName');
    localStorage.removeItem('sales_paymentMethod');
    localStorage.removeItem('sales_selectedUnits');
    localStorage.removeItem('sales_purchaseModes');
    localStorage.removeItem('sales_targetAmounts');
  };

  const getSalesLabels = (lang: string) => {
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
        quickFavoritesSubtitle: "عام طور پر فروخت ہونے والی چیزیں۔ فوری شامل کرنے کے لیے ٹیप کریں۔",
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

  const salesLabels = getSalesLabels(settings.language);

  // Sync amount changes to quantities
  const handleTargetAmountChange = (itemId: string, amountStr: string, item: Item, unit: string) => {
    const amount = parseFloat(amountStr) || 0;
    const unitPrice = getSellPriceForUnit(item, unit);
    const calculatedQty = unitPrice > 0 ? Number((amount / unitPrice).toFixed(3)) : 0;
    setTargetAmounts(prev => ({ ...prev, [itemId]: amountStr }));
    setQuantities(prev => ({ ...prev, [itemId]: calculatedQty }));
  };

  // Sync unit changes to quantities
  const handleUnitChange = (itemId: string, unit: string, item: Item) => {
    setSelectedUnits(prev => ({ ...prev, [itemId]: unit }));
    const mode = item.isFixedRatio ? 'quantity' : (purchaseModes[itemId] || 'quantity');
    if (mode === 'amount') {
      const amountStr = targetAmounts[itemId] || '';
      const amount = parseFloat(amountStr) || 0;
      const unitPrice = getSellPriceForUnit(item, unit);
      const calculatedQty = unitPrice > 0 ? Number((amount / unitPrice).toFixed(3)) : 0;
      setQuantities(prev => ({ ...prev, [itemId]: calculatedQty }));
    }
  };

  // Switch quantity/amount modes
  const handleTogglePurchaseMode = (itemId: string, mode: 'quantity' | 'amount', item: Item, unit: string) => {
    setPurchaseModes(prev => ({ ...prev, [itemId]: mode }));
    if (mode === 'amount') {
      const qty = quantities[itemId] ?? 1;
      const unitPrice = getSellPriceForUnit(item, unit);
      const amountVal = (qty * unitPrice).toFixed(2);
      setTargetAmounts(prev => ({ ...prev, [itemId]: amountVal }));
    } else {
      const amountStr = targetAmounts[itemId] || '';
      const amount = parseFloat(amountStr) || 0;
      const unitPrice = getSellPriceForUnit(item, unit);
      const calculatedQty = unitPrice > 0 ? Number((amount / unitPrice).toFixed(3)) : 1;
      setQuantities(prev => ({ ...prev, [itemId]: calculatedQty > 0 ? calculatedQty : 1 }));
    }
  };

  // Helper: get standard options list for a product to prevent duplicate units
  const getAvailableUnits = (item: Item) => {
    if (item.isWeightBased) {
      const baseOpt = item.saleUnit || 'kg';
      const subOpt = baseOpt === 'L' ? 'ml' : 'g';
      const list = [baseOpt, subOpt];
      
      if (item.pricePerSack && item.pricePerSack > 0) {
        const sackVal = item.sackUnit && item.sackUnit !== baseOpt ? item.sackUnit : 'sack';
        list.push(sackVal);
      }
      return list;
    } else {
      const list = [item.unit || 'pcs'];
      if (item.sackUnit === 'box' || (item.pricePerSack && item.pricePerSack > 0)) {
        list.push('box');
      }
      return list;
    }
  };

  // Helper: get distinct visual label for pills
  const getUnitDisplayLabel = (opt: string, item?: Item) => {
    if (!item) return opt.toUpperCase();
    const base = item.isWeightBased ? (item.saleUnit || 'kg') : (item.unit || 'pcs');
    if (opt === 'sack' || opt === 'bag' || opt === 'box' || opt === 'tin' || opt === item.sackUnit) {
      if (item.sackUnit && item.sackUnit !== base) {
        return item.sackUnit.toUpperCase();
      }
      return item.isWeightBased ? 'BAG' : 'BOX';
    }
    return opt.toUpperCase();
  };

  // Helper: Calculate base inventory stock reduction quantity
  const getBaseQuantity = (unit: string, qty: number, item?: Item) => {
    if (!item) return qty;
    if (isSackUnit(unit, item)) {
      return qty * (item.capacityPerSack || 1);
    } else if (unit.toLowerCase() === 'g' || unit.toLowerCase() === 'ml') {
      return qty / 1000;
    } else {
      return qty;
    }
  };

  // Helper: Get retail and wholesale prices
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

  const getCostPriceForUnit = (item: Item, unit: string) => {
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

  // Add Item to the Manageable Cart
  const handleAddItemToCart = (item: Item) => {
    const activeUnit = selectedUnits[item.id] || item.unit || 'pcs';
    const localQty = quantities[item.id] ?? 1;

    if (localQty <= 0) {
      alert(settings.language === 'es' ? 'La cantidad debe ser mayor a 0.' : 'Quantity must be greater than 0.');
      return;
    }

    if (item.stock <= 0) {
      const proceed = confirm(settings.language === 'es' 
        ? `Advertencia: ¡Este artículo no tiene existencias! ¿Desea venderlo de todos modos?` 
        : `Warning: This item is out of stock! Do you want to sell it anyway?`
      );
      if (!proceed) return;
    }

    const baseQtyNeeded = getBaseQuantity(activeUnit, localQty, item);

    // Calculate how much we already have of this item in the cart
    const existingUsageInCartBase = cart
      .filter(c => c.itemId === item.id)
      .reduce((sum, c) => sum + getBaseQuantity(c.unit, c.quantity, item), 0);

    if (item.stock < (baseQtyNeeded + existingUsageInCartBase)) {
      const proceed = confirm(settings.language === 'es' 
        ? `No hay suficientes existencias en el inventario (${item.stock} disp). ¿Desea continuar con la venta?` 
        : `There is insufficient stock in inventory (${item.stock} left). Do you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    const sellPrice = getSellPriceForUnit(item, activeUnit);
    const costPrice = getCostPriceForUnit(item, activeUnit);

    const existingCartIndex = cart.findIndex(c => c.itemId === item.id && c.unit === activeUnit);
    if (existingCartIndex !== -1) {
      setCart(cart.map((c, idx) => 
        idx === existingCartIndex 
          ? { ...c, quantity: Number((c.quantity + localQty).toFixed(3)) } 
          : c
      ));
    } else {
      setCart([...cart, {
        id: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        unit: activeUnit,
        quantity: localQty,
        sellPrice: sellPrice,
        costPrice: costPrice
      }]);
    }

    // Reset indicator
    setQuantities(prev => ({ ...prev, [item.id]: 1 }));
    
    // Auto-clear message
    setSuccessMessage(settings.language === 'es' ? 'Producto agregado al carrito' : 'Added to cart!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (cartId: string) => {
    setCart(cart.filter(c => c.id !== cartId));
  };

  // Adjust Quantity inside Cart
  const handleUpdateCartQty = (cartId: string, item: Item | undefined, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === cartId) {
        const newQty = Math.max(1, c.quantity + delta);
        if (item) {
          const baseQtyNeeded = getBaseQuantity(c.unit, newQty, item);
          
          // Sum other cart items targeting same parent item
          const otherUsageBase = cart
            .filter(ci => ci.itemId === item.id && ci.id !== cartId)
            .reduce((sum, ci) => sum + getBaseQuantity(ci.unit, ci.quantity, item), 0);

          if (baseQtyNeeded + otherUsageBase > item.stock) {
            const proceed = confirm(settings.language === 'es'
              ? `Advertencia: Supera el stock disponible (${item.stock}). ¿Proceder?`
              : `Warning: Exceeds available stock (${item.stock}). Proceed anyway?`
            );
            if (!proceed) return c;
          }
        }
        return { ...c, quantity: Number(newQty.toFixed(3)) };
      }
      return c;
    }));
  };

  // Quick instant sale checkout shortcut for a single card
  const handleQuickSale = async (item: Item) => {
    if (!user) return;

    const activeUnit = selectedUnits[item.id] || item.unit || 'pcs';
    const localQty = quantities[item.id] ?? 1;

    if (localQty <= 0) {
      alert(settings.language === 'es' ? 'La cantidad debe ser mayor a 0.' : 'Quantity must be greater than 0.');
      return;
    }

    if (item.stock <= 0) {
      const proceed = confirm(settings.language === 'es' 
        ? `Advertencia: ¡Este artículo no tiene existencias! ¿Desea venderlo de todos modos?` 
        : `Warning: This item is out of stock! Do you want to sell it anyway?`
      );
      if (!proceed) return;
    }

    const baseQty = getBaseQuantity(activeUnit, localQty, item);

    if (item.stock < baseQty) {
      const proceed = confirm(settings.language === 'es' 
        ? `No hay suficientes existencias (${item.stock} disp). ¿Desea continuar con la venta?` 
        : `There is insufficient stock (${item.stock} left). Do you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    setIsProcessing(true);
    const sellPrice = getSellPriceForUnit(item, activeUnit);
    const costPrice = getCostPriceForUnit(item, activeUnit);

    const totalPrice = sellPrice * localQty;
    const profit = (sellPrice - costPrice) * localQty;

    const newSale: Sale = {
      id: crypto.randomUUID(),
      itemId: item.id,
      itemName: item.name,
      unit: activeUnit,
      customerName: settings.language === 'es' ? 'Cliente Casual' : 'Walk-in Customer',
      quantity: localQty,
      totalPrice: Number(totalPrice.toFixed(2)),
      profit: Number(profit.toFixed(2)),
      paymentMethod: 'Cash',
      date: new Date().toISOString(),
      status: 'delivered',
      supplyStatus: 'none'
    };

    const oldStock = item.stock;
    const newStock = Number((item.stock - baseQty).toFixed(3));
    const updatedItem = { 
      ...item, 
      stock: newStock, 
      soldCount: Number((item.soldCount + baseQty).toFixed(3)),
      history: [
        ...(item.history || []),
        {
          id: crypto.randomUUID(),
          date: newSale.date,
          field: 'stock',
          oldValue: oldStock,
          newValue: newStock,
          description: `Sold ${localQty} ${activeUnit} in instant sale ${newSale.id.split('-')[0]}`
        }
      ]
    };

    try {
      await Promise.all([
        saveData(user.uid, 'sales', newSale),
        saveData(user.uid, 'items', updatedItem)
      ]);
      
      // Reset card selection
      setQuantities(prev => ({ ...prev, [item.id]: 1 }));
      setSuccessMessage(settings.language === 'es' ? '¡Venta instantánea registrada!' : 'Instant Sale Registered!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Error recording sale: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Finalize multiple products transaction
  const handleCheckoutCart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !user) return;

    // Double check stock for all items
    for (const c of cart) {
      const dbItem = items.find(i => i.id === c.itemId);
      if (!dbItem) continue;

      const sameItemUsage = cart
        .filter(ci => ci.itemId === c.itemId)
        .reduce((sum, ci) => sum + getBaseQuantity(ci.unit, ci.quantity, dbItem), 0);

      if (dbItem.stock < sameItemUsage) {
        alert(settings.language === 'es'
          ? `No hay suficiente stock para el artículo ${dbItem.name}. Solicitado: ${sameItemUsage}, Stock actual: ${dbItem.stock}`
          : `Not enough stock for ${dbItem.name}. Requested: ${sameItemUsage}, Current stock: ${dbItem.stock}`
        );
        return;
      }
    }

    setIsProcessing(true);
    const saleDate = new Date().toISOString();
    const finalCustomer = customerName.trim() || (settings.language === 'es' ? 'Cliente Casual' : 'Walk-in Customer');

    const promises: Promise<void>[] = [];

    cart.forEach(cItem => {
      const dbItem = items.find(i => i.id === cItem.itemId);
      const baseReduction = getBaseQuantity(cItem.unit, cItem.quantity, dbItem);

      const totalPrice = cItem.sellPrice * cItem.quantity;
      const profit = (cItem.sellPrice - cItem.costPrice) * cItem.quantity;

      const newSale: Sale = {
        id: crypto.randomUUID(),
        itemId: dbItem?.id || cItem.itemId,
        itemName: dbItem?.name || cItem.name,
        unit: cItem.unit,
        customerName: finalCustomer,
        quantity: cItem.quantity,
        totalPrice: Number(totalPrice.toFixed(2)),
        profit: Number(profit.toFixed(2)),
        paymentMethod,
        date: saleDate,
        status: 'delivered',
        supplyStatus: 'none'
      };

      promises.push(saveData(user.uid, 'sales', newSale));

      if (dbItem) {
        const oldStock = dbItem.stock;
        const newStock = Number((dbItem.stock - baseReduction).toFixed(3));
        const updatedItem = {
          ...dbItem,
          stock: newStock,
          soldCount: Number((dbItem.soldCount + baseReduction).toFixed(3)),
          history: [
            ...(dbItem.history || []),
            {
              id: crypto.randomUUID(),
              date: saleDate,
              field: 'stock',
              oldValue: oldStock,
              newValue: newStock,
              description: `Sold ${cItem.quantity} ${cItem.unit} in cart sale ${newSale.id.split('-')[0]}`
            }
          ]
        };
        promises.push(saveData(user.uid, 'items', updatedItem));
      }
    });

    try {
      await Promise.all(promises);
      
      // Complete resetting
      setCart([]);
      setCustomerName('');
      setPaymentMethod('Cash');
      setSuccessMessage(settings.language === 'es' ? '✓ Venta registrada con éxito' : '✓ Sales Recorded Successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Error during checkout: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteSale = async (id: string) => {
    if (!user) return;
    const text_msg = settings.language === 'es' 
      ? '¿Eliminar este registro de venta? Nota: Esto no revertirá el stock.' 
      : 'Delete this sale record? Note: This will not revert stock.';
    if (confirm(text_msg)) {
      await deleteData(user.uid, 'sales', id);
    }
  };

  // Dynamic categories and high-demand quick tap favorites
  const customCategories = ['All', ...new Set(items.map(item => item.category || 'Others').filter(Boolean))];

  const favoriteProducts = [...items]
    .filter(item => item.stock > 0)
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, 4);

  // Filter lists - ALL PRODUCTS ARE VISIBLE (No stock count check)
  const filteredProducts = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (item.category || '').toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (item.category || 'Others') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredSales = sales
    .slice()
    .reverse()
    .filter(s => 
      s.itemName.toLowerCase().includes(historySearch.toLowerCase()) || 
      (s.customerName || '').toLowerCase().includes(historySearch.toLowerCase())
    );

  // Quick adjust card quantities
  const adjustCardQuantity = (itemId: string, item: Item, delta: number) => {
    const current = quantities[itemId] ?? 1;
    const activeUnit = selectedUnits[item.id] || (item.isWeightBased ? item.saleUnit || 'kg' : item.unit || 'pcs');
    const newQty = Math.max(1, current + delta);
    
    // Check against inventory limits
    const baseQtyNeeded = getBaseQuantity(activeUnit, newQty, item);
    if (baseQtyNeeded > item.stock && delta > 0) {
      alert(settings.language === 'es' 
        ? `No hay suficiente stock para exceder ${item.stock} ${item.unit || 'unidades'}.` 
        : `Cannot exceed available inventory limit of ${item.stock} ${item.unit || 'units'}.`
      );
      return;
    }
    
    setQuantities(prev => ({ ...prev, [itemId]: newQty }));
  };

  // Cart total sum
  const calculateCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  };

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Messages */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-2xl bg-emerald-500/90 py-3.5 px-6 font-bold text-black shadow-xl backdrop-blur-md"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Navigation Link to Inventory */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-light tracking-tight">
            {t.salesTitle.split(' ')[0]} 
            <span className="font-semibold text-orange-400">
              {t.salesTitle.split(' ').slice(1).join(' ') || 'Records'}
            </span>
          </h1>
          <p className="text-white/60">{t.salesSubtitle}</p>
        </div>

        <Link 
          to="/inventory" 
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 px-6 font-bold text-orange-400 hover:bg-white/10 hover:border-orange-500/40 transition-all text-xs uppercase tracking-wider"
        >
          <Package className="h-4 w-4" />
          <span>{settings.language === 'es' ? 'Ver Inventario' : 'Go to Inventory'}</span>
          <ArrowRight className="h-4 w-4 animate-pulse" />
        </Link>
      </header>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 align-start max-w-full">
        
        {/* Left Column: Product Selection Grid (All products visible) */}
        <section className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="rounded-3xl sm:rounded-[40px] border border-white/10 bg-white/5 p-4 sm:p-8 backdrop-blur-xl">
            
            {/* Find Products Header with Search */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-medium flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-orange-400" />
                {settings.language === 'es' ? 'Todos los Productos' : 'Select Product from Inventory'}
              </h2>
              
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                <input 
                  type="text"
                  placeholder={settings.language === 'es' ? 'Buscar producto...' : 'Search any product...'}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-12 pr-4 text-xs outline-none focus:border-orange-500/50"
                />
              </div>
            </div>

            {/* Quick Favorites Row */}
            {favoriteProducts.length > 0 && (
              <div className="mb-6 p-4 rounded-3xl border border-white/5 bg-black/20 space-y-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                    {salesLabels.quickFavorites}
                  </span>
                  <span className="text-[10px] text-white/40 leading-none mt-0.5">
                    {salesLabels.quickFavoritesSubtitle}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {favoriteProducts.map(item => (
                    <button
                      key={`fav-${item.id}`}
                      type="button"
                      onClick={() => handleAddItemToCart(item)}
                      className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs font-semibold text-white/95 hover:border-orange-500/30 hover:bg-orange-500/10 flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Plus className="h-3 w-3 text-orange-400" />
                      <span>{item.name}</span>
                      <span className="text-[10px] text-white/40">({item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))} {item.unit})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category selection scroll bar */}
            <div className="mb-6 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                {salesLabels.categories}
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
                        ? "bg-orange-400 text-slate-950 shadow-md shadow-orange-500/10 font-bold"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {cat === 'All' ? salesLabels.allCategories : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct List/Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[680px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
              
              {filteredProducts.map(item => {
                const activeUnit = selectedUnits[item.id] || item.unit || 'pcs';
                const isWeightUnit = ['kg', 'g', 'L', 'ml', 'lb', 'oz'].includes(activeUnit.toLowerCase());
                const localQty = quantities[item.id] ?? 1;
                const unitPrice = getSellPriceForUnit(item, activeUnit);
                const isOutOfStock = item.stock <= 0;

                // Check if this specific item is in the cart
                const itemsInCartCount = cart.filter(c => c.itemId === item.id).length;

                // Dynamic quantity options based on the active unit type
                const qtyOptions = isWeightUnit 
                  ? [0.25, 0.5, 1, 2, 5, 10, 25, 50] 
                  : [1, 2, 5, 10, 12, 24, 50, 100];

                return (
                  <motion.div
                    layout
                    key={item.id}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-3xl border p-5 transition-all gap-4",
                      isOutOfStock 
                        ? "border-red-500/10 bg-red-500/[0.02] opacity-85"
                        : "border-white/5 bg-white/5 hover:border-orange-500/30 hover:bg-white/10"
                    )}
                  >
                    <div>
                      {/* Name & Category */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-lg tracking-tight uppercase leading-tight truncate text-white/90 group-hover:text-white">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] text-white/40 tracking-wide uppercase">
                              {item.category || 'General'}
                            </span>
                            {item.soldCount !== undefined && item.soldCount > 0 && (
                              <span className="shrink-0 flex items-center gap-1 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-bold px-2 py-0.5">
                                Sold: {item.soldCount} {item.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {itemsInCartCount > 0 && (
                          <span className="shrink-0 flex h-6 px-2 items-center justify-center rounded-full bg-orange-400 text-black text-[10px] font-black">
                            {itemsInCartCount} in cart
                          </span>
                        )}
                      </div>

                      {/* Stock Info */}
                      <div className="mt-3 flex items-center gap-1.5 text-xs">
                        <span className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          isOutOfStock ? "bg-red-500" : item.stock < 10 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                        )} />
                        <span className="text-white/50">
                          {isOutOfStock 
                            ? (settings.language === 'es' ? 'Agotado (0 disp.)' : 'Out of Stock') 
                            : `${item.stock % 1 === 0 ? item.stock : Number(item.stock.toFixed(2))} ${item.unit || 'units'} ${settings.language === 'es' ? 'disponibles' : 'available'}`
                          }
                        </span>
                      </div>

                      {/* Editable Custom Unit & Shortcuts */}
                      <div className="mt-4 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                          {settings.language === 'es' ? 'Unidad de Venta' : 'Selling Unit'}
                        </span>
                        <input
                          type="text"
                          value={activeUnit}
                          onChange={(e) => handleUnitChange(item.id, e.target.value, item)}
                          placeholder={settings.language === 'es' ? 'ej. Kg, Sachet, Pack' : 'e.g. Kg, Sachet, Pack'}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-orange-500/50 uppercase"
                        />
                        <div className="flex flex-wrap items-center gap-1">
                          {['pcs', 'kg', 'g', 'pack', 'sachet', 'bag', 'box', 'L', 'ml'].filter(o => o.toLowerCase() !== activeUnit.toLowerCase()).slice(0, 6).map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleUnitChange(item.id, opt, item)}
                              className="rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                          {item.unit && item.unit !== activeUnit && (
                            <button
                              type="button"
                              onClick={() => handleUnitChange(item.id, item.unit, item)}
                              className="rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-orange-500/20"
                            >
                              Reset ({item.unit})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-3">
                      {/* Purchase Mode Toggle */}
                      {!item.isFixedRatio && (
                        <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/5 text-[9px] font-black uppercase tracking-wider">
                          <button
                            type="button"
                            onClick={() => handleTogglePurchaseMode(item.id, 'quantity', item, activeUnit)}
                            className={cn(
                              "flex-1 py-1 px-2 rounded-md transition-all text-center animate-fade-in",
                              (purchaseModes[item.id] || 'quantity') === 'quantity'
                                ? "bg-orange-500 text-slate-950 font-black"
                                : "text-white/40 hover:text-white"
                            )}
                          >
                            {salesLabels.byQuantity}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePurchaseMode(item.id, 'amount', item, activeUnit)}
                            className={cn(
                              "flex-1 py-1 px-2 rounded-md transition-all text-center animate-fade-in",
                              purchaseModes[item.id] === 'amount'
                                ? "bg-orange-500 text-slate-950 font-black"
                                : "text-white/40 hover:text-white"
                            )}
                          >
                            {salesLabels.byAmount}
                          </button>
                        </div>
                      )}

                      {/* Quantity controls or target cash amount depending on Purchase Mode */}
                      {(item.isFixedRatio || (purchaseModes[item.id] || 'quantity') === 'quantity') ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/40 font-semibold">
                              {settings.language === 'es' ? 'Cantidad' : 'Quantity'}
                            </span>
                            
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const step = isWeightUnit ? 0.25 : 1;
                                  setQuantities(prev => ({ ...prev, [item.id]: Math.max(0.01, Number((localQty - step).toFixed(3))) }));
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 active:scale-95 transition-all"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                value={localQty}
                                onChange={(e) => {
                                  const val = Math.max(0.01, Number(e.target.value));
                                  setQuantities(prev => ({ ...prev, [item.id]: val }));
                                }}
                                className="w-12 text-center bg-transparent outline-none font-black text-sm text-white"
                                step={isWeightUnit ? 0.25 : 1}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const step = isWeightUnit ? 0.25 : 1;
                                  setQuantities(prev => ({ ...prev, [item.id]: Number((localQty + step).toFixed(3)) }));
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 active:scale-95 transition-all"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Quick preset quantity selection */}
                          <div className="flex flex-wrap items-center gap-1">
                            {qtyOptions.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setQuantities(prev => ({ ...prev, [item.id]: opt }))}
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all",
                                  localQty === opt
                                    ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                                    : "bg-black/15 border-white/5 text-white/55 hover:bg-white/5 hover:text-white"
                                )}
                              >
                                {opt} {activeUnit}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">
                              {salesLabels.amountToPay} ({settings.currency})
                            </span>
                            <input
                              type="number"
                              placeholder={salesLabels.enterAmount}
                              value={targetAmounts[item.id] || ''}
                              onChange={(e) => handleTargetAmountChange(item.id, e.target.value, item, activeUnit)}
                              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500/50"
                            />
                          </div>
                          
                          <div className="flex justify-between items-center text-[11px] bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 font-black leading-none">
                            <span className="text-orange-400">{salesLabels.equivalentQty}:</span>
                            <span className="text-white bg-black/40 px-2 py-1 rounded-md text-xs">
                              {localQty} {activeUnit.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Cost estimates */}
                      <div className="flex items-center justify-between text-xs bg-black/40 rounded-xl p-2.5 border border-white/5">
                        <div className="text-left">
                          <p className="text-[9px] text-white/30 uppercase tracking-wider">{settings.language === 'es' ? 'Precio Unitario' : 'Unit Price'}</p>
                          <p className="font-medium text-white/80">{formatPrice(unitPrice)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-white/30 uppercase tracking-wider">{settings.language === 'es' ? 'Subtotal' : 'Total Price'}</p>
                          <p className="font-bold text-orange-400">{formatPrice(unitPrice * localQty)}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleAddItemToCart(item)}
                          className={cn(
                            "w-full flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider transition-colors",
                            isOutOfStock 
                              ? "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
                              : "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 active:scale-[0.98]"
                          )}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          <span>{settings.language === 'es' ? 'Al Carrito' : 'Add to Cart'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing || isOutOfStock}
                          onClick={() => handleQuickSale(item)}
                          className="w-full flex items-center justify-center gap-1 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black py-2 px-3 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-orange-500/10 transition-transform active:scale-[0.98]"
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3 w-3" />
                              <span>{settings.language === 'es' ? 'Venta Rápida' : 'Quick Sale'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {items.length === 0 && (
                <div className="col-span-2 py-20 text-center text-white/40">
                  <ShoppingCart className="mx-auto mb-4 h-12 w-12 opacity-15" />
                  <p>{settings.language === 'es' ? 'No hay productos en inventario.' : 'No products found inside inventory.'}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Manageable Cart Checkout & History */}
        <section className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* Active Cart & Checkout Form */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl sm:rounded-[40px] border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-orange-400" />
                {settings.language === 'es' ? 'Carrito de Ventas' : 'Current Sales Cart'}
              </h3>
              <div className="flex items-center gap-2">
                {(cart.length > 0 || customerName) && (
                  <button 
                    onClick={resetSales}
                    className="text-xs text-red-400 bg-red-400/10 px-2.5 py-1.5 rounded-full hover:bg-red-400/20 transition-all flex items-center gap-1"
                  >
                    {t.cancel}
                  </button>
                )}
                <span className="rounded-full bg-orange-400/20 px-3 py-0.5 text-xs font-bold text-orange-400">
                  {cart.length} {settings.language === 'es' ? 'items' : 'products'}
                </span>
              </div>
            </div>

            {/* Cart Elements List */}
            <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <AnimatePresence initial={false}>
                {cart.map((cartItem, idx) => {
                  const dbItem = items.find(i => i.id === cartItem.itemId)!;
                  return (
                    <motion.div
                      key={cartItem.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/5 bg-black/30 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white uppercase truncate flex items-center gap-1.5">
                          <span className="text-orange-400 font-mono text-[10px]">#{idx + 1}</span>
                          {cartItem.name}
                        </p>
                        <p className="text-[10px] text-white/50 uppercase mt-0.5">
                          {formatPrice(cartItem.sellPrice)} / {cartItem.unit}
                        </p>
                      </div>

                      {/* Quantity Controls inside Cart */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-white/15 bg-black/40">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(cartItem.id, dbItem, -1)}
                            className="p-1 text-white/50 hover:text-white"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-white text-[11px]">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(cartItem.id, dbItem, 1)}
                            className="p-1 text-white/50 hover:text-white"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Subtotal of Cart Item */}
                        <div className="text-right min-w-[70px]">
                          <p className="font-black text-orange-400">
                            {formatPrice(cartItem.sellPrice * cartItem.quantity)}
                          </p>
                        </div>

                        {/* Remove item */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(cartItem.id)}
                          className="text-white/30 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {cart.length === 0 && (
                <div className="py-12 text-center rounded-2xl border border-dashed border-white/5 bg-black/10">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-white/10" />
                  <p className="text-xs text-white/40 leading-relaxed px-4">
                    {settings.language === 'es'
                      ? 'Agrega productos del inventario para iniciar la venta.'
                      : 'Select and add products from the inventory to checkout.'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Checkout Form */}
            {cart.length > 0 && (
              <form onSubmit={handleCheckoutCart} className="space-y-4 pt-2 border-t border-white/5">
                {/* Customer input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    {settings.language === 'es' ? 'Nombre del Cliente' : 'Customer Name'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                    <input 
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder={settings.language === 'es' ? 'ej. Cliente General' : 'e.g. Walk-in Customer'}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-11 pr-4 text-xs outline-none focus:border-orange-500/50"
                    />
                  </div>
                </div>

                {/* Payment selectors */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">{t.paymentMethod}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Cash', icon: Wallet, label: t.cash },
                      { id: 'Card', icon: CreditCard, label: t.card },
                      { id: 'Mobile Payment', icon: Smartphone, label: t.mobilePayment },
                    ].map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl border p-2 transition-all active:scale-[0.98]",
                            paymentMethod === m.id 
                              ? "border-orange-500 bg-orange-500/10 text-orange-400" 
                              : "border-white/5 bg-white/5 text-white/40 hover:text-white/60"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-center">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Final receipt cost */}
                <div className="rounded-2xl bg-black/40 border border-white/5 p-3 flex items-center justify-between">
                  <span className="text-xs text-white/50 font-medium">{t.totalBill}</span>
                  <span className="text-xl font-bold text-orange-400">
                    {formatPrice(calculateCartTotal())}
                  </span>
                </div>

                {/* Record button */}
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 py-3 px-4 font-bold text-black shadow-lg shadow-orange-500/20 transition-transform active:scale-[0.98] text-xs uppercase tracking-wider"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 stroke-[2.5]" />
                      <span>{t.completeSale}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>

          {/* Sales History in the column */}
          <div className="rounded-3xl sm:rounded-[40px] border border-white/10 bg-black/20 p-4 sm:p-6 backdrop-blur-xl">
            <div className="mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t.salesHistory}</h3>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/50">
                  {sales.length} {t.transactions}
                </span>
              </div>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                <input 
                  type="text"
                  placeholder={t.searchSalesPlaceholder}
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-12 pr-4 text-xs outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
            
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
              <AnimatePresence>
                {filteredSales.map((sale) => (
                  <motion.div 
                    key={sale.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 p-3.5 transition-all hover:bg-white/10"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white leading-none truncate uppercase">{sale.itemName}</p>
                      
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                          <span className="font-semibold text-orange-400 truncate max-w-[80px]">
                            {sale.customerName || t.walkInCustomer}
                          </span>
                          <span>•</span>
                          <span>{sale.quantity} {getUnitDisplayLabel(sale.unit, items.find(i => i.id === sale.itemId) || { isWeightBased: false, unit: sale.unit } as Item)}</span>
                        </div>
                        <span className="text-[9px] text-white/30 flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(sale.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-400 leading-none">{formatPrice(sale.totalPrice)}</p>
                        <p className="text-[9px] text-orange-400/70 mt-1">{formatPrice(sale.profit)} {t.profit}</p>
                      </div>

                      <button 
                        onClick={() => deleteSale(sale.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 p-1 text-white/30 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredSales.length === 0 && (
                <div className="py-12 text-center text-white/30">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-10" />
                  <p className="text-xs">{t.noSalesFound}</p>
                </div>
              )}
            </div>
          </div>

        </section>
      </div>
    </div>
  );
};
