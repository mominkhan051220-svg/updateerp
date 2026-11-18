import { AppState } from '../types';
import { ShopDataSnapshot } from './googleSheetsApi';

export function buildShopSnapshot(state: AppState, shopId: string): ShopDataSnapshot | null {
  const shop = state.shops.find((s) => s.id === shopId);
  if (!shop) return null;

  const { webhookUrl: _w, ...safeShop } = shop;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    shop: safeShop,
    products: state.products.filter((x) => x.shopId === shopId),
    stockMovements: state.stockMovements.filter((x) => x.shopId === shopId),
    parties: state.parties.filter((x) => x.shopId === shopId),
    sales: state.sales.filter((x) => x.shopId === shopId),
    saleReturns: state.saleReturns.filter((x) => x.shopId === shopId),
    purchases: state.purchases.filter((x) => x.shopId === shopId),
    purchaseReturns: state.purchaseReturns.filter((x) => x.shopId === shopId),
    salesOrders: state.salesOrders.filter((x) => x.shopId === shopId),
    purchaseOrders: state.purchaseOrders.filter((x) => x.shopId === shopId),
    dueSettlements: state.dueSettlements.filter((x) => x.shopId === shopId),
    expenses: state.expenses.filter((x) => x.shopId === shopId),
    cashAdjustments: state.cashAdjustments.filter((x) => x.shopId === shopId),
    bankAccounts: state.bankAccounts.filter((x) => x.shopId === shopId),
    bankTransactions: state.bankTransactions.filter((x) => x.shopId === shopId),
    onlineOrders: state.onlineOrders.filter((x) => x.shopId === shopId),
  };
}

export function applyRestoredShopSnapshot(
  state: AppState,
  snapshot: ShopDataSnapshot,
  expectedShopId?: string
): AppState {
  const targetShopId = snapshot.shop.id;
  if (expectedShopId && targetShopId !== expectedShopId) {
    throw new Error('Cross-shop restore blocked: Google Sheet belongs to a different shop.');
  }

  const existingShop = state.shops.find((s) => s.id === targetShopId);
  const { webhookUrl: _w, ...restoredSafeShop } = snapshot.shop;

  const mergedShop = {
    ...restoredSafeShop,
    hasWebhookUrl: existingShop?.hasWebhookUrl ?? restoredSafeShop.hasWebhookUrl,
    maskedWebhookUrl: existingShop?.maskedWebhookUrl ?? restoredSafeShop.maskedWebhookUrl,
    hasSheetSecret: existingShop?.hasSheetSecret ?? restoredSafeShop.hasSheetSecret,
    maskedSheetSecret: existingShop?.maskedSheetSecret ?? restoredSafeShop.maskedSheetSecret,
    pinProtected: existingShop?.pinProtected ?? restoredSafeShop.pinProtected,
    lastSyncStatus: 'synced' as const,
    lastSyncedAt: new Date().toISOString(),
    lastSyncMessage: 'Restored from Google Sheet',
  };

  return {
    ...state,
    shops: existingShop
      ? state.shops.map((s) => (s.id === targetShopId ? mergedShop : s))
      : [...state.shops, mergedShop],
    products: [...state.products.filter((x) => x.shopId !== targetShopId), ...snapshot.products],
    stockMovements: [
      ...state.stockMovements.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.stockMovements ?? []),
    ],
    parties: [...state.parties.filter((x) => x.shopId !== targetShopId), ...snapshot.parties],
    sales: [...state.sales.filter((x) => x.shopId !== targetShopId), ...snapshot.sales],
    saleReturns: [
      ...state.saleReturns.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.saleReturns ?? []),
    ],
    purchases: [...state.purchases.filter((x) => x.shopId !== targetShopId), ...snapshot.purchases],
    purchaseReturns: [
      ...state.purchaseReturns.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.purchaseReturns ?? []),
    ],
    salesOrders: [
      ...state.salesOrders.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.salesOrders ?? []),
    ],
    purchaseOrders: [
      ...state.purchaseOrders.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.purchaseOrders ?? []),
    ],
    dueSettlements: [
      ...state.dueSettlements.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.dueSettlements ?? []),
    ],
    expenses: [...state.expenses.filter((x) => x.shopId !== targetShopId), ...snapshot.expenses],
    cashAdjustments: [
      ...state.cashAdjustments.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.cashAdjustments ?? []),
    ],
    bankAccounts: [
      ...state.bankAccounts.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.bankAccounts ?? []),
    ],
    bankTransactions: [
      ...state.bankTransactions.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.bankTransactions ?? []),
    ],
    onlineOrders: [
      ...state.onlineOrders.filter((x) => x.shopId !== targetShopId),
      ...(snapshot.onlineOrders ?? []),
    ],
  };
}
