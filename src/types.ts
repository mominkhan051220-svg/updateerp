export type Language = 'bn' | 'en';

export type MenuKey =
  | 'dashboard'
  | 'sales'
  | 'purchase'
  | 'sales_order'
  | 'purchase_order'
  | 'due_khata'
  | 'expenses'
  | 'cash_adjustment'
  | 'bank_transactions'
  | 'online_shop'
  | 'reports'
  | 'products'
  | 'parties'
  | 'settings';

export const ALL_MENU_KEYS: MenuKey[] = [
  'dashboard',
  'sales',
  'purchase',
  'sales_order',
  'purchase_order',
  'due_khata',
  'expenses',
  'cash_adjustment',
  'bank_transactions',
  'online_shop',
  'reports',
  'products',
  'parties',
  'settings',
];

export type UserRole = 'admin' | 'staff';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  assignedShopId: string;
  allowedShopIds: string[];
  permissions: Record<MenuKey, boolean>;
  createdAt: string;
}

export type PrinterFormat = 'a4' | 'thermal_80' | 'thermal_58';

export interface OnlineShopConfig {
  enabled: boolean;
  slug: string;
  deliveryCharge: number;
  whatsappNumber: string;
  bannerNote: string;
}

export interface Shop {
  id: string;
  name: string;
  phone: string;
  address: string;
  webhookUrl: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncedAt?: string;
  lastSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncMessage?: string;
  printerFormat: PrinterFormat;
  initialCapital: number;
  onlineShop: OnlineShopConfig;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  barcode: string;
  category: string;
  unit: 'Pcs' | 'Kg' | 'Box' | 'Ltr' | 'Dozen';
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  alertLimit: number;
  onlineListed: boolean;
  onlinePrice?: number;
}

export interface StockMovement {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  date: string;
}

export type PartyType = 'customer' | 'supplier';

export interface Party {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  address: string;
  type: PartyType;
  previousDue: number;
  previousAdvance: number;
}

export type PaymentMethod = 'cash' | 'mobile_banking' | 'bank' | 'due';

export interface LineItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SaleInvoice {
  id: string;
  shopId: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  items: LineItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  vatPercent: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  status: 'paid' | 'partial' | 'due';
  returnedAmount?: number;
  note?: string;
}

export interface SaleReturn {
  id: string;
  shopId: string;
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  date: string;
  items: LineItem[];
  totalReturnAmount: number;
  refundMethod: 'cash' | 'due_adjust';
  reason: string;
}

export interface PurchaseBill {
  id: string;
  shopId: string;
  billNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  items: LineItem[];
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'paid' | 'due' | 'partial';
  returnedAmount?: number;
  note?: string;
}

export interface PurchaseReturn {
  id: string;
  shopId: string;
  billId: string;
  billNo: string;
  supplierName: string;
  date: string;
  items: LineItem[];
  totalReturnAmount: number;
  reason: string;
}

export interface SalesOrder {
  id: string;
  shopId: string;
  orderNo: string;
  date: string;
  deliveryDate: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: LineItem[];
  totalAmount: number;
  advancePayment: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
}

export interface PurchaseOrder {
  id: string;
  shopId: string;
  orderNo: string;
  date: string;
  expectedDate: string;
  supplierId: string;
  supplierName: string;
  items: LineItem[];
  totalAmount: number;
  status: 'draft' | 'ordered' | 'received';
}

export interface DueSettlement {
  id: string;
  shopId: string;
  partyId: string;
  partyName: string;
  partyType: PartyType;
  amount: number;
  method: 'cash' | 'bank';
  bankAccountId?: string;
  date: string;
  note: string;
}

export type ExpenseCategory =
  | 'Shop Rent'
  | 'Electricity Bill'
  | 'Transport'
  | 'Staff Salary'
  | 'Hospitality'
  | 'Maintenance'
  | 'Other';

export interface Expense {
  id: string;
  shopId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'bank';
  bankAccountId?: string;
  note: string;
}

export type CashAdjustmentType = 'initial_capital' | 'investment' | 'withdrawal';

export interface CashAdjustment {
  id: string;
  shopId: string;
  type: CashAdjustmentType;
  amount: number;
  date: string;
  note: string;
}

export interface BankAccount {
  id: string;
  shopId: string;
  name: string;
  accountType: 'bank' | 'bkash' | 'nagad' | 'rocket';
  accountNumber: string;
  openingBalance: number;
}

export interface BankTransaction {
  id: string;
  shopId: string;
  accountId: string;
  accountName: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  referenceId: string;
  date: string;
  note: string;
}

export interface OnlineOrder {
  id: string;
  shopId: string;
  orderNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: LineItem[];
  deliveryCharge: number;
  totalAmount: number;
  status: 'new' | 'processing' | 'shipped' | 'completed';
}

export type TimeframeFilter = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: string;
  end: string;
}

export interface AppState {
  isAuthenticated: boolean;
  language: Language;
  currentUserId: string;
  activeShopId: string;
  shops: Shop[];
  users: UserAccount[];
  products: Product[];
  stockMovements: StockMovement[];
  parties: Party[];
  sales: SaleInvoice[];
  saleReturns: SaleReturn[];
  purchases: PurchaseBill[];
  purchaseReturns: PurchaseReturn[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  dueSettlements: DueSettlement[];
  expenses: Expense[];
  cashAdjustments: CashAdjustment[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  onlineOrders: OnlineOrder[];
}
