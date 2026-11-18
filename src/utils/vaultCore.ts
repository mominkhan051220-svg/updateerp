import { createSeedState } from '../data/seedData';
import {
  type AppState,
  type BankAccount,
  type BankTransaction,
  type CashAdjustment,
  type DueSettlement,
  type Expense,
  type MenuKey,
  type OnlineOrder,
  type OnlineShopConfig,
  type Party,
  type Product,
  type PurchaseBill,
  type PurchaseOrder,
  type PurchaseReturn,
  type SaleInvoice,
  type SaleReturn,
  type SalesOrder,
  type Shop,
  type UserAccount,
} from '../types';
import { applySaleStockDelta, canAccessMenu } from './accounting';
import { type ShopDataSnapshot } from './googleSheetsApi';
import { applyRestoredShopSnapshot, buildShopSnapshot } from './shopSnapshot';
import {
  generateShopSecretWeb,
  isValidAppsScriptUrlWeb,
  maskSecretValueWeb,
  maskWebhookUrlWeb,
} from './webCryptoSecurity';

export const DEFAULT_BOOTSTRAP_EMAIL = 'mominkhan051220@gmail.com';
export const DEFAULT_BOOTSTRAP_PASSWORD_HASH =
  'pbkdf2_sha256$100000$a7f39c2e8b14d056e91a4c7d2f830b6e$f54cd440b7989f459e4fefbb55f775bb18ea2785e30b96e6ffc56f9b1f4ebce8';

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface StoredShopSecurity {
  webhookUrl: string;
  sheetSecret: string;
  pinHash?: string;
}

export interface ServerVault {
  version: 1;
  users: StoredUser[];
  shopSecrets: Record<string, StoredShopSecurity>;
  appData: Omit<AppState, 'isAuthenticated' | 'users' | 'currentUserId' | 'activeShopId'> & {
    activeShopId: string;
  };
}

export function createInitialVaultData(env?: {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
}): ServerVault {
  const seed = createSeedState();
  const { isAuthenticated: _auth, users, currentUserId: _uid, ...rest } = seed;
  const adminUser = users[0];

  const shopSecrets: Record<string, StoredShopSecurity> = {};
  for (const shop of rest.shops) {
    shopSecrets[shop.id] = {
      webhookUrl: '',
      sheetSecret: generateShopSecretWeb(),
    };
  }

  const email = (env?.ADMIN_EMAIL || DEFAULT_BOOTSTRAP_EMAIL).trim().toLowerCase();
  const passwordHash = env?.ADMIN_PASSWORD_HASH || DEFAULT_BOOTSTRAP_PASSWORD_HASH;

  return {
    version: 1,
    users: [
      {
        ...adminUser,
        username: email,
        passwordHash,
      },
    ],
    shopSecrets,
    appData: rest,
  };
}

export function toPublicUser(u: StoredUser): UserAccount {
  const { passwordHash: _ph, ...publicUser } = u;
  return publicUser;
}

export function toSanitizedShop(shop: Shop, sec?: StoredShopSecurity): Shop {
  const { webhookUrl: _w, ...rest } = shop;
  return {
    ...rest,
    hasWebhookUrl: Boolean(sec?.webhookUrl),
    maskedWebhookUrl: sec?.webhookUrl ? maskWebhookUrlWeb(sec.webhookUrl) : undefined,
    hasSheetSecret: Boolean(sec?.sheetSecret),
    maskedSheetSecret: sec?.sheetSecret ? maskSecretValueWeb(sec.sheetSecret) : undefined,
    pinProtected: Boolean(sec?.pinHash),
  };
}

export function buildSanitizedStateForUser(
  currentVault: ServerVault,
  user: StoredUser,
  unlockedShopIds: string[]
): AppState {
  const isAdmin = user.role === 'admin';
  const assignedShopId = user.assignedShopId || user.allowedShopIds[0];

  const visibleShops = (isAdmin
    ? currentVault.appData.shops
    : currentVault.appData.shops.filter((s) => s.id === assignedShopId)
  ).map((s) => toSanitizedShop(s, currentVault.shopSecrets[s.id]));

  const allowedShopSet = new Set(visibleShops.map((s) => s.id));
  const filterByShop = <T extends { shopId: string }>(arr: T[]) =>
    arr.filter((item) => allowedShopSet.has(item.shopId));

  const activeShopId =
    isAdmin && allowedShopSet.has(currentVault.appData.activeShopId)
      ? currentVault.appData.activeShopId
      : visibleShops[0]?.id ?? assignedShopId;

  const unlockedSet = new Set(unlockedShopIds);
  const canReadShopData = (sId: string) => {
    if (!allowedShopSet.has(sId)) return false;
    const sec = currentVault.shopSecrets[sId];
    if (sec?.pinHash && !unlockedSet.has(sId)) return false;
    return true;
  };
  const filterUnlocked = <T extends { shopId: string }>(arr: T[]) =>
    filterByShop(arr).filter((item) => canReadShopData(item.shopId));

  return {
    isAuthenticated: true,
    language: currentVault.appData.language,
    currentUserId: user.id,
    activeShopId,
    shops: visibleShops,
    users: isAdmin ? currentVault.users.map(toPublicUser) : [toPublicUser(user)],
    products: filterUnlocked(currentVault.appData.products),
    stockMovements: filterUnlocked(currentVault.appData.stockMovements),
    parties: filterUnlocked(currentVault.appData.parties),
    sales: filterUnlocked(currentVault.appData.sales),
    saleReturns: filterUnlocked(currentVault.appData.saleReturns),
    purchases: filterUnlocked(currentVault.appData.purchases),
    purchaseReturns: filterUnlocked(currentVault.appData.purchaseReturns),
    salesOrders: filterUnlocked(currentVault.appData.salesOrders),
    purchaseOrders: filterUnlocked(currentVault.appData.purchaseOrders),
    dueSettlements: filterUnlocked(currentVault.appData.dueSettlements),
    expenses: filterUnlocked(currentVault.appData.expenses),
    cashAdjustments: filterUnlocked(currentVault.appData.cashAdjustments),
    bankAccounts: filterUnlocked(currentVault.appData.bankAccounts),
    bankTransactions: filterUnlocked(currentVault.appData.bankTransactions),
    onlineOrders: filterUnlocked(currentVault.appData.onlineOrders),
  };
}

export function buildFullShopSnapshotFromVault(
  currentVault: ServerVault,
  shopId: string
): ShopDataSnapshot | null {
  const fullState: AppState = {
    isAuthenticated: true,
    language: currentVault.appData.language,
    currentUserId: currentVault.users[0]?.id ?? 'user_admin',
    activeShopId: shopId,
    shops: currentVault.appData.shops.map((s) => toSanitizedShop(s, currentVault.shopSecrets[s.id])),
    users: [],
    products: currentVault.appData.products,
    stockMovements: currentVault.appData.stockMovements,
    parties: currentVault.appData.parties,
    sales: currentVault.appData.sales,
    saleReturns: currentVault.appData.saleReturns,
    purchases: currentVault.appData.purchases,
    purchaseReturns: currentVault.appData.purchaseReturns,
    salesOrders: currentVault.appData.salesOrders,
    purchaseOrders: currentVault.appData.purchaseOrders,
    dueSettlements: currentVault.appData.dueSettlements,
    expenses: currentVault.appData.expenses,
    cashAdjustments: currentVault.appData.cashAdjustments,
    bankAccounts: currentVault.appData.bankAccounts,
    bankTransactions: currentVault.appData.bankTransactions,
    onlineOrders: currentVault.appData.onlineOrders,
  };
  return buildShopSnapshot(fullState, shopId);
}

export async function forwardToGoogleSheetWeb(
  webhookUrl: string,
  shopSecret: string,
  payload: Record<string, unknown>
) {
  if (!isValidAppsScriptUrlWeb(webhookUrl)) {
    return {
      ok: false,
      status: 400,
      data: { status: 'error', message: 'Disallowed webhook host.' } as Record<string, unknown>,
    };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(shopSecret ? { 'X-Shop-Secret': shopSecret } : {}),
    },
    body: JSON.stringify({
      ...payload,
      shopSecret,
    }),
    redirect: 'follow',
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }

  const appError = parsed && parsed.status === 'error';
  return {
    ok: response.ok && !appError,
    status: response.status,
    data: parsed,
  };
}

export function getMenuForMutationAction(action: string): MenuKey | null {
  switch (action) {
    case 'create_sale':
    case 'create_sale_return':
      return 'sales';
    case 'create_purchase':
    case 'create_purchase_return':
      return 'purchase';
    case 'create_sales_order':
    case 'convert_sales_order':
      return 'sales_order';
    case 'create_purchase_order':
    case 'convert_purchase_order':
      return 'purchase_order';
    case 'settle_due':
      return 'due_khata';
    case 'add_expense':
    case 'delete_expense':
      return 'expenses';
    case 'update_initial_capital':
    case 'add_adjustment':
      return 'cash_adjustment';
    case 'add_bank_tx':
    case 'add_bank_account':
      return 'bank_transactions';
    case 'update_online_config':
    case 'toggle_product_online':
    case 'update_order_status':
      return 'online_shop';
    case 'save_product':
    case 'adjust_stock':
      return 'products';
    case 'quick_add_party':
      return 'parties';
    case 'update_shop':
    case 'restore_snapshot':
      return 'settings';
    default:
      return null;
  }
}

export interface VaultMutationResult {
  ok: boolean;
  httpStatus?: number;
  errorMessage?: string;
  restoredOnly?: boolean;
  syncCollection: string | null;
  syncRecord: unknown;
}

export function applyVaultMutation(
  vault: ServerVault,
  user: StoredUser,
  shopId: string,
  action: string,
  payload: Record<string, unknown> | undefined
): VaultMutationResult {
  const requiredMenu = getMenuForMutationAction(action);
  if (!requiredMenu || !canAccessMenu(user, requiredMenu)) {
    return {
      ok: false,
      httpStatus: 403,
      errorMessage: 'Forbidden: Missing menu permission.',
      syncCollection: null,
      syncRecord: null,
    };
  }

  const data = vault.appData;
  let syncCollection: string | null = null;
  let syncRecord: unknown = null;

  switch (action) {
    case 'create_sale': {
      const sale = { ...(payload?.sale as SaleInvoice), shopId };
      data.sales = [sale, ...data.sales];
      data.products = applySaleStockDelta(data.products, sale.items, 'deduct');
      syncCollection = 'sales';
      syncRecord = sale;
      break;
    }
    case 'quick_add_party': {
      const party = { ...(payload?.party as Party), shopId };
      data.parties = [party, ...data.parties];
      syncCollection = 'parties';
      syncRecord = party;
      break;
    }
    case 'create_sale_return': {
      const ret = { ...(payload?.saleReturn as SaleReturn), shopId };
      data.saleReturns = [ret, ...data.saleReturns];
      data.products = applySaleStockDelta(data.products, ret.items, 'restore');
      syncCollection = 'saleReturns';
      syncRecord = ret;
      break;
    }
    case 'create_purchase': {
      const bill = { ...(payload?.purchase as PurchaseBill), shopId };
      data.purchases = [bill, ...data.purchases];
      data.products = applySaleStockDelta(data.products, bill.items, 'restore');
      syncCollection = 'purchases';
      syncRecord = bill;
      break;
    }
    case 'create_purchase_return': {
      const ret = { ...(payload?.purchaseReturn as PurchaseReturn), shopId };
      data.purchaseReturns = [ret, ...data.purchaseReturns];
      data.products = applySaleStockDelta(data.products, ret.items, 'deduct');
      syncCollection = 'purchaseReturns';
      syncRecord = ret;
      break;
    }
    case 'create_sales_order': {
      const order = { ...(payload?.order as SalesOrder), shopId };
      data.salesOrders = [order, ...data.salesOrders];
      syncCollection = 'salesOrders';
      syncRecord = order;
      break;
    }
    case 'convert_sales_order': {
      const orderId = String(payload?.orderId ?? '');
      const ord = data.salesOrders.find((o) => o.id === orderId && o.shopId === shopId);
      if (!ord) {
        return {
          ok: false,
          httpStatus: 404,
          errorMessage: 'Sales order not found in this shop.',
          syncCollection: null,
          syncRecord: null,
        };
      }
      const shopSalesCount = data.sales.filter((s) => s.shopId === shopId).length;
      const sale: SaleInvoice = {
        id: `sale_${Date.now()}`,
        shopId,
        invoiceNo: `INV-${new Date().getFullYear()}-${shopSalesCount + 101}`,
        date: new Date().toISOString().slice(0, 10),
        customerId: ord.customerId || 'walk_in',
        customerName: ord.customerName,
        items: ord.items,
        subtotal: ord.totalAmount,
        discountPercent: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
        grandTotal: ord.totalAmount,
        paidAmount: ord.advancePayment,
        dueAmount: Math.max(0, ord.totalAmount - ord.advancePayment),
        paymentMethod: 'cash',
        status: ord.advancePayment >= ord.totalAmount ? 'paid' : ord.advancePayment > 0 ? 'partial' : 'due',
      };
      data.salesOrders = data.salesOrders.map((o) =>
        o.id === orderId && o.shopId === shopId ? { ...o, status: 'delivered' } : o
      );
      data.sales = [sale, ...data.sales];
      data.products = applySaleStockDelta(data.products, sale.items, 'deduct');
      syncCollection = 'sales';
      syncRecord = sale;
      break;
    }
    case 'create_purchase_order': {
      const order = { ...(payload?.order as PurchaseOrder), shopId };
      data.purchaseOrders = [order, ...data.purchaseOrders];
      syncCollection = 'purchaseOrders';
      syncRecord = order;
      break;
    }
    case 'convert_purchase_order': {
      const orderId = String(payload?.orderId ?? '');
      const ord = data.purchaseOrders.find((o) => o.id === orderId && o.shopId === shopId);
      if (!ord) {
        return {
          ok: false,
          httpStatus: 404,
          errorMessage: 'Purchase order not found in this shop.',
          syncCollection: null,
          syncRecord: null,
        };
      }
      const shopPurchasesCount = data.purchases.filter((p) => p.shopId === shopId).length;
      const bill: PurchaseBill = {
        id: `pur_${Date.now()}`,
        shopId,
        billNo: `PUR-${new Date().getFullYear()}-${shopPurchasesCount + 501}`,
        date: new Date().toISOString().slice(0, 10),
        supplierId: ord.supplierId,
        supplierName: ord.supplierName,
        items: ord.items,
        grandTotal: ord.totalAmount,
        paidAmount: ord.totalAmount,
        dueAmount: 0,
        paymentStatus: 'paid',
      };
      data.purchaseOrders = data.purchaseOrders.map((o) =>
        o.id === orderId && o.shopId === shopId ? { ...o, status: 'received' } : o
      );
      data.purchases = [bill, ...data.purchases];
      data.products = applySaleStockDelta(data.products, bill.items, 'restore');
      syncCollection = 'purchases';
      syncRecord = bill;
      break;
    }
    case 'settle_due': {
      const settlement = { ...(payload?.settlement as DueSettlement), shopId };
      data.dueSettlements = [settlement, ...data.dueSettlements];
      syncCollection = 'dueSettlements';
      syncRecord = settlement;
      break;
    }
    case 'add_expense': {
      const expense = { ...(payload?.expense as Expense), shopId };
      data.expenses = [expense, ...data.expenses];
      syncCollection = 'expenses';
      syncRecord = expense;
      break;
    }
    case 'delete_expense': {
      const id = String(payload?.id ?? '');
      data.expenses = data.expenses.filter((e) => !(e.id === id && e.shopId === shopId));
      syncCollection = 'expenses';
      syncRecord = { id, deleted: true };
      break;
    }
    case 'update_initial_capital': {
      const amount = Math.max(0, Number(payload?.amount) || 0);
      data.shops = data.shops.map((s) => (s.id === shopId ? { ...s, initialCapital: amount } : s));
      syncCollection = 'shops';
      syncRecord = { shopId, initialCapital: amount };
      break;
    }
    case 'add_adjustment': {
      const adjustment = { ...(payload?.adjustment as CashAdjustment), shopId };
      data.cashAdjustments = [adjustment, ...data.cashAdjustments];
      syncCollection = 'cashAdjustments';
      syncRecord = adjustment;
      break;
    }
    case 'add_bank_tx': {
      const tx = { ...(payload?.tx as BankTransaction), shopId };
      data.bankTransactions = [tx, ...data.bankTransactions];
      syncCollection = 'bankTransactions';
      syncRecord = tx;
      break;
    }
    case 'add_bank_account': {
      const account = { ...(payload?.account as BankAccount), shopId };
      data.bankAccounts = [...data.bankAccounts, account];
      syncCollection = 'bankAccounts';
      syncRecord = account;
      break;
    }
    case 'update_online_config': {
      const config = payload?.config as OnlineShopConfig;
      data.shops = data.shops.map((s) => (s.id === shopId ? { ...s, onlineShop: config } : s));
      syncCollection = 'shops';
      syncRecord = { shopId, onlineShop: config };
      break;
    }
    case 'toggle_product_online': {
      const productId = String(payload?.productId ?? '');
      data.products = data.products.map((p) =>
        p.id === productId && p.shopId === shopId ? { ...p, onlineListed: !p.onlineListed } : p
      );
      syncCollection = 'products';
      syncRecord = data.products.find((p) => p.id === productId && p.shopId === shopId) ?? null;
      break;
    }
    case 'update_order_status': {
      const orderId = String(payload?.orderId ?? '');
      const status = payload?.status as OnlineOrder['status'];
      data.onlineOrders = data.onlineOrders.map((o) =>
        o.id === orderId && o.shopId === shopId ? { ...o, status } : o
      );
      syncCollection = 'onlineOrders';
      syncRecord = { id: orderId, status };
      break;
    }
    case 'save_product': {
      const product = { ...(payload?.product as Product), shopId };
      const isNew = Boolean(payload?.isNew);
      data.products = isNew
        ? [product, ...data.products]
        : data.products.map((p) => (p.id === product.id && p.shopId === shopId ? product : p));
      syncCollection = 'products';
      syncRecord = product;
      break;
    }
    case 'adjust_stock': {
      const productId = String(payload?.productId ?? '');
      const adjType = payload?.type === 'out' ? 'out' : 'in';
      const qty = Math.max(0, Number(payload?.qty) || 0);
      const reason = String(payload?.reason ?? '');
      const prod = data.products.find((p) => p.id === productId && p.shopId === shopId);
      if (!prod) {
        return {
          ok: false,
          httpStatus: 404,
          errorMessage: 'Product not found in this shop.',
          syncCollection: null,
          syncRecord: null,
        };
      }
      const movement = {
        id: `stk_${Date.now()}`,
        shopId,
        productId,
        productName: prod.name,
        type: adjType as 'in' | 'out',
        quantity: qty,
        reason,
        date: new Date().toISOString().slice(0, 10),
      };
      data.products = data.products.map((p) =>
        p.id === productId && p.shopId === shopId
          ? { ...p, stock: adjType === 'in' ? p.stock + qty : Math.max(0, p.stock - qty) }
          : p
      );
      data.stockMovements = [movement, ...data.stockMovements];
      syncCollection = 'stockMovements';
      syncRecord = movement;
      break;
    }
    case 'update_shop': {
      if (user.role !== 'admin') {
        return {
          ok: false,
          httpStatus: 403,
          errorMessage: 'Only admin can update shop settings.',
          syncCollection: null,
          syncRecord: null,
        };
      }
      const updated = payload?.shop as Shop;
      data.shops = data.shops.map((s) =>
        s.id === shopId
          ? {
              ...s,
              name: updated.name ?? s.name,
              phone: updated.phone ?? s.phone,
              address: updated.address ?? s.address,
              printerFormat: updated.printerFormat ?? s.printerFormat,
              initialCapital: updated.initialCapital ?? s.initialCapital,
              onlineShop: updated.onlineShop ?? s.onlineShop,
            }
          : s
      );
      syncCollection = 'shops';
      syncRecord = data.shops.find((s) => s.id === shopId);
      break;
    }
    case 'restore_snapshot': {
      const snapshot = payload?.snapshot as ShopDataSnapshot;
      if (!snapshot || !snapshot.shop || snapshot.shop.id !== shopId) {
        return {
          ok: false,
          httpStatus: 400,
          errorMessage: 'Cross-shop restore blocked: Snapshot belongs to a different shop.',
          syncCollection: null,
          syncRecord: null,
        };
      }
      const tempAppState: AppState = {
        isAuthenticated: true,
        language: data.language,
        currentUserId: user.id,
        activeShopId: data.activeShopId,
        shops: data.shops,
        users: [],
        products: data.products,
        stockMovements: data.stockMovements,
        parties: data.parties,
        sales: data.sales,
        saleReturns: data.saleReturns,
        purchases: data.purchases,
        purchaseReturns: data.purchaseReturns,
        salesOrders: data.salesOrders,
        purchaseOrders: data.purchaseOrders,
        dueSettlements: data.dueSettlements,
        expenses: data.expenses,
        cashAdjustments: data.cashAdjustments,
        bankAccounts: data.bankAccounts,
        bankTransactions: data.bankTransactions,
        onlineOrders: data.onlineOrders,
      };
      const restored = applyRestoredShopSnapshot(tempAppState, snapshot, shopId);
      const { isAuthenticated: _ia, currentUserId: _cu, users: _u, ...restoredData } = restored;
      vault.appData = restoredData;
      return {
        ok: true,
        restoredOnly: true,
        syncCollection: null,
        syncRecord: null,
      };
    }
    default:
      return {
        ok: false,
        httpStatus: 400,
        errorMessage: `Unknown action: ${action}`,
        syncCollection: null,
        syncRecord: null,
      };
  }

  return {
    ok: true,
    syncCollection,
    syncRecord,
  };
}
