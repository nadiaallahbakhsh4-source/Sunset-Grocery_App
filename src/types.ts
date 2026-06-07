export interface ItemHistoryEntry {
  id: string;
  date: string;
  field: 'stock' | 'costPrice' | 'sellPrice';
  oldValue: number;
  newValue: number;
  description?: string;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  stock: number;
  costPrice: number;
  sellPrice: number;
  soldCount: number;
  unit: string;
  barcode?: string;
  description?: string;
  history?: ItemHistoryEntry[];
  isWeightBased?: boolean;
  sackCount?: number;
  capacityPerSack?: number;
  sackUnit?: string;
  saleUnit?: string;
  pricePerSack?: number;
  isFixedRatio?: boolean;
  allowBothModes?: boolean;
}

export type Currency = 'PKR' | 'USD' | 'CNY' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD' | 'AED' | 'SAR';
export type Language = 'en' | 'ur' | 'zh' | 'es' | 'ar' | 'hi';

export type UserRole = 'owner' | 'customer' | 'supplier';

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  description: string;
  imageUrl?: string;
  createdAt: string;
}

export interface SupplyOrder {
  id: string;
  storeId: string;
  parentSaleId?: string;
  supplierId: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    unit: string;
  }[];
  status: 'pending' | 'processing' | 'shipped' | 'completed';
  totalCost: number;
  date: string;
  updatedAt: string;
  notes?: string;
}

export interface RoleChangeRequest {
  oldRole: UserRole;
  newRole?: UserRole;
  reason: string;
  timestamp: string;
}

export interface Settings {
  currency: Currency;
  shopName: string;
  shopPhone?: string;
  shopAddress?: string;
  language: Language;
  theme: 'dark' | 'light';
  brightness: number;
  role?: UserRole;
  roleConfirmed?: boolean;
  roleChangeHistory?: RoleChangeRequest[];
  storeId?: string; // Links owner to their specific store
  enableVoiceInput?: boolean;
  pinCode?: string;
}

export interface Feedback {
  id: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  customerName: string;
  address: string;
  status: 'pending' | 'in-transit' | 'delivered';
  assignedDriver?: string;
  date: string;
}

export interface BudgetItem {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface Sale {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  quantity: number;
  totalPrice: number;
  profit: number;
  paymentMethod: string;
  date: string;
  invoiceId?: string;
  status: 'pending' | 'processing' | 'ready' | 'delivered' | 'cancelled';
  supplyStatus?: 'none' | 'ordered' | 'shipped' | 'arrived';
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
}

export interface Invoice {
  id: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  totalAmount: number;
  paymentMethod: string;
  date: string;
}

export interface Transaction {
  id: string;
  type: 'given' | 'returned';
  amount: number;
  date: string;
  note: string;
}

export interface CustomerCredit {
  id: string;
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  totalPaid: number;
  history: Transaction[];
  lastUpdated: string;
}

export interface Partner {
  id: string;
  name: string;
  totalGiven: number;
  totalReturned: number;
  history: Transaction[];
}

export interface DailyBlessing {
  id: string;
  text: string;
  offering: string;
  date: string;
}

export interface DailySalary {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}
