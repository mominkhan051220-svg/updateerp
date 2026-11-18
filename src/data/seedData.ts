import { ALL_MENU_KEYS, AppState, MenuKey } from '../types';

export const FULL_PERMISSIONS: Record<MenuKey, boolean> = ALL_MENU_KEYS.reduce(
  (acc, key) => ({ ...acc, [key]: true }),
  {} as Record<MenuKey, boolean>
);

export const STAFF_DEFAULT_PERMISSIONS: Record<MenuKey, boolean> = {
  dashboard: true,
  sales: true,
  purchase: false,
  sales_order: true,
  purchase_order: false,
  due_khata: true,
  expenses: false,
  cash_adjustment: false,
  bank_transactions: false,
  online_shop: false,
  reports: false,
  products: true,
  parties: true,
  settings: false,
};

export function createSeedState(): AppState {
  const today = new Date().toISOString().slice(0, 10);

  return {
    isAuthenticated: false,
    language: 'bn',
    currentUserId: 'user_admin',
    activeShopId: 'shop_main',
    shops: [
      {
        id: 'shop_main',
        name: 'আমার দোকান (Main Store)',
        phone: '',
        address: '',
        hasWebhookUrl: false,
        hasSheetSecret: true,
        maskedSheetSecret: 'hk_sho••••••••',
        pinProtected: false,
        lastSyncStatus: 'idle',
        printerFormat: 'thermal_80',
        initialCapital: 0,
        onlineShop: {
          enabled: false,
          slug: 'main-store',
          deliveryCharge: 60,
          whatsappNumber: '',
          bannerNote: '',
        },
        createdAt: today,
      },
    ],
    users: [
      {
        id: 'user_admin',
        name: 'Momin Khan',
        username: 'mominkhan051220@gmail.com',
        role: 'admin',
        assignedShopId: 'shop_main',
        allowedShopIds: ['shop_main'],
        permissions: { ...FULL_PERMISSIONS },
        createdAt: today,
      },
    ],
    products: [],
    stockMovements: [],
    parties: [],
    sales: [],
    saleReturns: [],
    purchases: [],
    purchaseReturns: [],
    salesOrders: [],
    purchaseOrders: [],
    dueSettlements: [],
    expenses: [],
    cashAdjustments: [],
    bankAccounts: [],
    bankTransactions: [],
    onlineOrders: [],
  };
}
