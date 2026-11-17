import { Language, MenuKey } from '../types';

export const MENU_LABELS: Record<MenuKey, { bn: string; en: string }> = {
  dashboard: { bn: 'ড্যাশবোর্ড', en: 'Dashboard' },
  sales: { bn: 'বিক্রয়', en: 'Sales' },
  purchase: { bn: 'ক্রয়', en: 'Purchase' },
  sales_order: { bn: 'বিক্রয় অর্ডার', en: 'Sales Order' },
  purchase_order: { bn: 'ক্রয় অর্ডার', en: 'Purchase Order' },
  due_khata: { bn: 'বাকির হিসাব', en: 'Due Khata' },
  expenses: { bn: 'খরচ', en: 'Expenses' },
  cash_adjustment: { bn: 'ক্যাশ মিলাই', en: 'Cash Adjustment' },
  bank_transactions: { bn: 'ব্যাংকে লেনদেন', en: 'Bank Transactions' },
  online_shop: { bn: 'অনলাইন শপ', en: 'Online Shop' },
  reports: { bn: 'রিপোর্টস', en: 'Reports' },
  products: { bn: 'পণ্য সমূহ', en: 'Products' },
  parties: { bn: 'পার্টি সমূহ', en: 'Parties' },
  settings: { bn: 'সেটিংস', en: 'Settings' },
};

export const UI_TEXT = {
  appName: { bn: 'হিসাবখাতা প্রো', en: 'HishabKhata Pro' },
  buyBtn: { bn: 'কিনুন', en: 'Purchase' },
  sellBtn: { bn: 'বিক্রি করুন', en: 'Sale' },
  settings: { bn: 'সেটিংস', en: 'Settings' },
  switchUser: { bn: 'ইউজার পরিবর্তন', en: 'Switch User' },
  logout: { bn: 'সাইন আউট', en: 'Sign Out' },
  today: { bn: 'আজ', en: 'Today' },
  thisWeek: { bn: 'এই সপ্তাহ', en: 'This Week' },
  thisMonth: { bn: 'এই মাস', en: 'This Month' },
  customRange: { bn: 'কাস্টম তারিখ', en: 'Custom Date Range' },
  cashIn: { bn: 'নগদ প্রাপ্তি', en: 'Cash In' },
  cashOut: { bn: 'নগদ প্রদান', en: 'Cash Out' },
  totalReceivable: { bn: 'মোট পাওনা', en: 'Total Receivable' },
  totalPayable: { bn: 'মোট দেনা', en: 'Total Payable' },
  handCash: { bn: 'হাতে আছে', en: 'Total Hand Cash' },
  bankBalance: { bn: 'ব্যাংকে আছে', en: 'Bank Balance' },
  totalExpense: { bn: 'মোট খরচ', en: 'Total Expense' },
  viewAll: { bn: 'সব দেখুন', en: 'View All' },
  topSelling: { bn: 'সর্বাধিক বিক্রিত পণ্য', en: 'Top Selling Products' },
  lowestSelling: { bn: 'সর্বনিম্ন বিক্রিত পণ্য', en: 'Lowest Selling Products' },
  stockSummary: { bn: 'স্টক সামারি ও স্টক মূল্য', en: 'Stock Summary & Valuation' },
  totalStockUnits: { bn: 'মোট মজুদ পরিমাণ', en: 'Total Stock Units' },
  stockValuation: { bn: 'মোট স্টক মূল্য', en: 'Inventory Valuation' },
  lowStockItems: { bn: 'লো-স্টক সতর্কতা', en: 'Low Stock Alerts' },
  save: { bn: 'সংরক্ষণ করুন', en: 'Save' },
  cancel: { bn: 'বাতিল', en: 'Cancel' },
  delete: { bn: 'মুছুন', en: 'Delete' },
  print: { bn: 'প্রিন্ট', en: 'Print' },
  download: { bn: 'ডাউনলোড', en: 'Download' },
  search: { bn: 'সার্চ করুন...', en: 'Search...' },
  noData: { bn: 'কোনো তথ্য পাওয়া যায়নি', en: 'No records found' },
  accessDenied: {
    bn: 'এই মেনুতে আপনার প্রবেশাধিকার নেই। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।',
    en: 'You do not have permission to access this module. Please contact your Admin.',
  },
} as const;

export function t(lang: Language, key: keyof typeof UI_TEXT): string {
  return UI_TEXT[key][lang];
}

export function formatCurrency(amount: number, lang: Language = 'bn'): string {
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return lang === 'bn' ? `৳${formatted}` : `৳${formatted}`;
}
