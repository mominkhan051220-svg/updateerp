import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UserAuthModal } from './components/UserAuthModal';
import { LoginPage } from './components/LoginPage';
import { CreateShopModal } from './components/CreateShopModal';
import { DashboardView } from './components/DashboardView';
import { SalesView } from './components/SalesView';
import { PurchaseView } from './components/PurchaseView';
import { OrdersView } from './components/OrdersView';
import { DueKhataView } from './components/DueKhataView';
import { ExpensesView } from './components/ExpensesView';
import { CashAdjustmentView } from './components/CashAdjustmentView';
import { BankTransactionsView } from './components/BankTransactionsView';
import { OnlineShopView } from './components/OnlineShopView';
import { ReportsView } from './components/ReportsView';
import { ProductsView } from './components/ProductsView';
import { PartiesView } from './components/PartiesView';
import { SettingsView } from './components/SettingsView';
import { createSeedState } from './data/seedData';
import {
  AppState,
  BankAccount,
  BankTransaction,
  CashAdjustment,
  DueSettlement,
  Expense,
  Language,
  MenuKey,
  OnlineOrder,
  OnlineShopConfig,
  Party,
  Product,
  PurchaseBill,
  PurchaseOrder,
  PurchaseReturn,
  SaleInvoice,
  SaleReturn,
  SalesOrder,
  Shop,
  UserAccount,
} from './types';
import {
  applySaleStockDelta,
  canAccessMenu,
  computeShopHandCash,
  getAllowedMenusForUser,
  getAllowedShopsForUser,
} from './utils/accounting';
import { UI_TEXT } from './utils/i18n';
import { syncRecordToGoogleSheet } from './utils/sheetSync';
import {
  connectGoogleSheetsAccount,
  disconnectGoogleSheets,
  initGoogleAuth,
} from './utils/googleAuth';
import {
  createShopSpreadsheet,
  restoreShopFromGoogleSheet,
  syncShopToGoogleSheet,
} from './utils/googleSheetsApi';
import { applyRestoredShopSnapshot, buildShopSnapshot } from './utils/shopSnapshot';

const STORAGE_KEY = 'hishabkhata_pro_state_v1';

function loadInitialState(): AppState {
  const seed = createSeedState();
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed && Array.isArray(parsed.shops) && parsed.shops.length > 0 && Array.isArray(parsed.users)) {
        const normalizedUsers = parsed.users.map((u) => ({
          ...u,
          assignedShopId: u.assignedShopId || u.allowedShopIds?.[0] || parsed.shops![0].id,
          allowedShopIds:
            u.allowedShopIds && u.allowedShopIds.length > 0
              ? u.allowedShopIds
              : [u.assignedShopId || parsed.shops![0].id],
        }));

        return {
          ...seed,
          ...parsed,
          isAuthenticated: autostart ? true : Boolean(parsed.isAuthenticated),
          users: normalizedUsers,
          shops: parsed.shops,
        };
      }
    }
  } catch {
    // Fallback to seed data
  }

  return autostart ? { ...seed, isAuthenticated: true } : seed;
}

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [createShopOpen, setCreateShopOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    status: 'synced' | 'local_only' | 'error';
    message: string;
  } | null>(null);

  // Google Sheets OAuth in-memory session (never stored in localStorage/sessionStorage)
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const googleAccessTokenRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSnapshotHashRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        googleAccessTokenRef.current = token;
        setGoogleConnected(true);
        setGoogleEmail(user.email);
      },
      () => {
        googleAccessTokenRef.current = null;
        setGoogleConnected(false);
        setGoogleEmail(null);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId]
  );

  const allowedShops = useMemo(
    () => getAllowedShopsForUser(currentUser, state.shops),
    [currentUser, state.shops]
  );

  const activeShop = useMemo(
    () => allowedShops.find((s) => s.id === state.activeShopId) ?? allowedShops[0],
    [allowedShops, state.activeShopId]
  );

  const allowedMenus = useMemo(() => getAllowedMenusForUser(currentUser), [currentUser]);
  const effectiveMenu: MenuKey = canAccessMenu(currentUser, activeMenu)
    ? activeMenu
    : allowedMenus[0] ?? 'dashboard';

  // Ensure staff activeShopId stays locked to assignedShopId even after permission edits
  useEffect(() => {
    if (
      state.isAuthenticated &&
      currentUser.role !== 'admin' &&
      allowedShops.length > 0 &&
      state.activeShopId !== allowedShops[0].id
    ) {
      setState((prev) => ({ ...prev, activeShopId: allowedShops[0].id }));
    }
  }, [state.isAuthenticated, currentUser.role, allowedShops, state.activeShopId]);

  const handleConnectGoogle = useCallback(async (): Promise<string> => {
    const { user, accessToken } = await connectGoogleSheetsAccount();
    googleAccessTokenRef.current = accessToken;
    setGoogleConnected(true);
    setGoogleEmail(user.email);
    return accessToken;
  }, []);

  const handleDisconnectGoogle = useCallback(async () => {
    await disconnectGoogleSheets();
    googleAccessTokenRef.current = null;
    setGoogleConnected(false);
    setGoogleEmail(null);
  }, []);

  // Debounced real-time Google Sheets sync whenever the active shop's data changes
  const activeShopDataSignature = useMemo(() => {
    if (!activeShop.spreadsheetId) return '';
    const snap = buildShopSnapshot(state, activeShop.id);
    if (!snap) return '';
    const { exportedAt: _e, shop, ...rest } = snap;
    const { lastSyncedAt: _ls, lastSyncStatus: _lss, lastSyncMessage: _lsm, ...stableShop } = shop;
    return JSON.stringify({ shop: stableShop, ...rest });
  }, [state, activeShop.id, activeShop.spreadsheetId]);

  useEffect(() => {
    const token = googleAccessTokenRef.current;
    if (!token || !activeShop.spreadsheetId || !activeShopDataSignature) return;
    if (lastSnapshotHashRef.current[activeShop.id] === activeShopDataSignature) return;

    const timer = window.setTimeout(async () => {
      const snap = buildShopSnapshot(stateRef.current, activeShop.id);
      const latestToken = googleAccessTokenRef.current;
      if (!snap || !snap.shop.spreadsheetId || !latestToken) return;

      lastSnapshotHashRef.current[activeShop.id] = activeShopDataSignature;
      try {
        const res = await syncShopToGoogleSheet(latestToken, snap.shop.spreadsheetId, snap);
        setState((prev) => ({
          ...prev,
          shops: prev.shops.map((s) =>
            s.id === activeShop.id
              ? {
                  ...s,
                  lastSyncStatus: 'synced',
                  lastSyncedAt: res.updatedAt,
                  lastSyncMessage: 'Synced to Google Sheet',
                }
              : s
          ),
        }));
        setSyncFeedback({ status: 'synced', message: 'Synced to Google Sheet' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Google Sheet sync error';
        setState((prev) => ({
          ...prev,
          shops: prev.shops.map((s) =>
            s.id === activeShop.id
              ? { ...s, lastSyncStatus: 'error', lastSyncMessage: msg }
              : s
          ),
        }));
        setSyncFeedback({ status: 'error', message: msg });
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeShop.id, activeShop.spreadsheetId, activeShopDataSignature, googleConnected]);

  const triggerSheetSync = async (collection: string, record: unknown, shopOverride?: Shop) => {
    const targetShop = shopOverride ?? activeShop;
    if (!targetShop.webhookUrl) {
      if (targetShop.spreadsheetId && googleAccessTokenRef.current) {
        setSyncFeedback({ status: 'synced', message: 'Real-time Google Sheet sync active' });
      }
      return;
    }
    const res = await syncRecordToGoogleSheet(targetShop, collection, 'upsert', record);
    setSyncFeedback({ status: res.status, message: res.message });
  };

  // Shop-scoped slices
  const shopId = activeShop.id;
  const shopProducts = useMemo(() => state.products.filter((p) => p.shopId === shopId), [state.products, shopId]);
  const shopStockMovements = useMemo(
    () => state.stockMovements.filter((m) => m.shopId === shopId),
    [state.stockMovements, shopId]
  );
  const shopParties = useMemo(() => state.parties.filter((p) => p.shopId === shopId), [state.parties, shopId]);
  const shopCustomers = useMemo(() => shopParties.filter((p) => p.type === 'customer'), [shopParties]);
  const shopSuppliers = useMemo(() => shopParties.filter((p) => p.type === 'supplier'), [shopParties]);
  const shopSales = useMemo(() => state.sales.filter((s) => s.shopId === shopId), [state.sales, shopId]);
  const shopSaleReturns = useMemo(
    () => state.saleReturns.filter((r) => r.shopId === shopId),
    [state.saleReturns, shopId]
  );
  const shopPurchases = useMemo(() => state.purchases.filter((p) => p.shopId === shopId), [state.purchases, shopId]);
  const shopPurchaseReturns = useMemo(
    () => state.purchaseReturns.filter((r) => r.shopId === shopId),
    [state.purchaseReturns, shopId]
  );
  const shopSalesOrders = useMemo(
    () => state.salesOrders.filter((o) => o.shopId === shopId),
    [state.salesOrders, shopId]
  );
  const shopPurchaseOrders = useMemo(
    () => state.purchaseOrders.filter((o) => o.shopId === shopId),
    [state.purchaseOrders, shopId]
  );
  const shopSettlements = useMemo(
    () => state.dueSettlements.filter((d) => d.shopId === shopId),
    [state.dueSettlements, shopId]
  );
  const shopExpenses = useMemo(() => state.expenses.filter((e) => e.shopId === shopId), [state.expenses, shopId]);
  const shopAdjustments = useMemo(
    () => state.cashAdjustments.filter((c) => c.shopId === shopId),
    [state.cashAdjustments, shopId]
  );
  const shopBankAccounts = useMemo(
    () => state.bankAccounts.filter((b) => b.shopId === shopId),
    [state.bankAccounts, shopId]
  );
  const shopBankTransactions = useMemo(
    () => state.bankTransactions.filter((t) => t.shopId === shopId),
    [state.bankTransactions, shopId]
  );
  const shopOnlineOrders = useMemo(
    () => state.onlineOrders.filter((o) => o.shopId === shopId),
    [state.onlineOrders, shopId]
  );

  const handCash = useMemo(
    () =>
      computeShopHandCash(
        activeShop.initialCapital,
        shopSales,
        shopSaleReturns,
        shopPurchases,
        shopSettlements,
        shopExpenses,
        shopAdjustments,
        shopBankTransactions
      ),
    [
      activeShop.initialCapital,
      shopSales,
      shopSaleReturns,
      shopPurchases,
      shopSettlements,
      shopExpenses,
      shopAdjustments,
      shopBankTransactions,
    ]
  );

  // Handlers
  const handleSelectShop = (nextShopId: string) => {
    if (currentUser.role !== 'admin') return;
    setState((prev) => ({ ...prev, activeShopId: nextShopId }));
  };

  const handleChangeLang = (lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  };

  const applyAuthenticatedUser = (targetUser: UserAccount) => {
    const userAllowedShops = getAllowedShopsForUser(targetUser, state.shops);
    const nextShopId =
      targetUser.role === 'admin'
        ? userAllowedShops.some((s) => s.id === state.activeShopId)
          ? state.activeShopId
          : userAllowedShops[0]?.id ?? state.activeShopId
        : userAllowedShops[0]?.id ?? targetUser.assignedShopId;

    const nextMenus = getAllowedMenusForUser(targetUser);
    const nextMenu = canAccessMenu(targetUser, 'dashboard')
      ? 'dashboard'
      : nextMenus[0] ?? 'dashboard';
    setActiveMenu(nextMenu);

    setState((prev) => ({
      ...prev,
      isAuthenticated: true,
      currentUserId: targetUser.id,
      activeShopId: nextShopId,
    }));
  };

  const handleLoginUser = (userId: string) => {
    const targetUser = state.users.find((u) => u.id === userId);
    if (!targetUser) return;
    applyAuthenticatedUser(targetUser);
  };

  const handleLoginSuccess = (user: UserAccount) => {
    applyAuthenticatedUser(user);
  };

  const handleLogout = () => {
    setUserModalOpen(false);
    setMobileMenuOpen(false);
    setCreateShopOpen(false);
    setState((prev) => ({ ...prev, isAuthenticated: false }));
  };

  const handleCreateSale = (sale: SaleInvoice) => {
    setState((prev) => ({
      ...prev,
      sales: [sale, ...prev.sales],
      products: applySaleStockDelta(prev.products, sale.items, 'deduct'),
    }));
    void triggerSheetSync('sales', sale);
  };

  const handleQuickAddParty = (party: Party) => {
    setState((prev) => ({
      ...prev,
      parties: [party, ...prev.parties],
    }));
    void triggerSheetSync('parties', party);
  };

  const handleCreateSaleReturn = (ret: SaleReturn) => {
    setState((prev) => ({
      ...prev,
      saleReturns: [ret, ...prev.saleReturns],
      products: applySaleStockDelta(prev.products, ret.items, 'restore'),
    }));
    void triggerSheetSync('saleReturns', ret);
  };

  const handleCreatePurchase = (bill: PurchaseBill) => {
    setState((prev) => ({
      ...prev,
      purchases: [bill, ...prev.purchases],
      products: applySaleStockDelta(prev.products, bill.items, 'restore'),
    }));
    void triggerSheetSync('purchases', bill);
  };

  const handleCreatePurchaseReturn = (ret: PurchaseReturn) => {
    setState((prev) => ({
      ...prev,
      purchaseReturns: [ret, ...prev.purchaseReturns],
      products: applySaleStockDelta(prev.products, ret.items, 'deduct'),
    }));
    void triggerSheetSync('purchaseReturns', ret);
  };

  const handleCreateSalesOrder = (order: SalesOrder) => {
    setState((prev) => ({ ...prev, salesOrders: [order, ...prev.salesOrders] }));
    void triggerSheetSync('salesOrders', order);
  };

  const handleConvertSalesOrder = (orderId: string) => {
    const ord = state.salesOrders.find((o) => o.id === orderId);
    if (!ord) return;
    const sale: SaleInvoice = {
      id: `sale_${Date.now()}`,
      shopId: ord.shopId,
      invoiceNo: `INV-${new Date().getFullYear()}-${shopSales.length + 101}`,
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
    setState((prev) => ({
      ...prev,
      salesOrders: prev.salesOrders.map((o) => (o.id === orderId ? { ...o, status: 'delivered' } : o)),
      sales: [sale, ...prev.sales],
      products: applySaleStockDelta(prev.products, sale.items, 'deduct'),
    }));
    void triggerSheetSync('sales', sale);
  };

  const handleCreatePurchaseOrder = (order: PurchaseOrder) => {
    setState((prev) => ({ ...prev, purchaseOrders: [order, ...prev.purchaseOrders] }));
    void triggerSheetSync('purchaseOrders', order);
  };

  const handleConvertPurchaseOrder = (orderId: string) => {
    const ord = state.purchaseOrders.find((o) => o.id === orderId);
    if (!ord) return;
    const bill: PurchaseBill = {
      id: `pur_${Date.now()}`,
      shopId: ord.shopId,
      billNo: `PUR-${new Date().getFullYear()}-${shopPurchases.length + 501}`,
      date: new Date().toISOString().slice(0, 10),
      supplierId: ord.supplierId,
      supplierName: ord.supplierName,
      items: ord.items,
      grandTotal: ord.totalAmount,
      paidAmount: ord.totalAmount,
      dueAmount: 0,
      paymentStatus: 'paid',
    };
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((o) => (o.id === orderId ? { ...o, status: 'received' } : o)),
      purchases: [bill, ...prev.purchases],
      products: applySaleStockDelta(prev.products, bill.items, 'restore'),
    }));
    void triggerSheetSync('purchases', bill);
  };

  const handleSettleDue = (settlement: DueSettlement) => {
    setState((prev) => ({ ...prev, dueSettlements: [settlement, ...prev.dueSettlements] }));
    void triggerSheetSync('dueSettlements', settlement);
  };

  const handleAddExpense = (expense: Expense) => {
    setState((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
    void triggerSheetSync('expenses', expense);
  };

  const handleDeleteExpense = (id: string) => {
    setState((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }));
  };

  const handleUpdateInitialCapital = (amount: number) => {
    setState((prev) => ({
      ...prev,
      shops: prev.shops.map((s) => (s.id === shopId ? { ...s, initialCapital: amount } : s)),
    }));
  };

  const handleAddAdjustment = (adj: CashAdjustment) => {
    setState((prev) => ({ ...prev, cashAdjustments: [adj, ...prev.cashAdjustments] }));
    void triggerSheetSync('cashAdjustments', adj);
  };

  const handleAddBankTx = (tx: BankTransaction) => {
    setState((prev) => ({ ...prev, bankTransactions: [tx, ...prev.bankTransactions] }));
    void triggerSheetSync('bankTransactions', tx);
  };

  const handleAddBankAccount = (acc: BankAccount) => {
    setState((prev) => ({ ...prev, bankAccounts: [...prev.bankAccounts, acc] }));
    void triggerSheetSync('bankAccounts', acc);
  };

  const handleUpdateOnlineConfig = (config: OnlineShopConfig) => {
    setState((prev) => ({
      ...prev,
      shops: prev.shops.map((s) => (s.id === shopId ? { ...s, onlineShop: config } : s)),
    }));
  };

  const handleToggleProductOnline = (productId: string) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === productId ? { ...p, onlineListed: !p.onlineListed } : p)),
    }));
  };

  const handleUpdateOrderStatus = (orderId: string, status: OnlineOrder['status']) => {
    setState((prev) => ({
      ...prev,
      onlineOrders: prev.onlineOrders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    }));
  };

  const handleSaveProduct = (product: Product, isNew: boolean) => {
    setState((prev) => ({
      ...prev,
      products: isNew
        ? [product, ...prev.products]
        : prev.products.map((p) => (p.id === product.id ? product : p)),
    }));
    void triggerSheetSync('products', product);
  };

  const handleAdjustStock = (productId: string, type: 'in' | 'out', qty: number, reason: string) => {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    const movement = {
      id: `stk_${Date.now()}`,
      shopId,
      productId,
      productName: prod.name,
      type,
      quantity: qty,
      reason,
      date: new Date().toISOString().slice(0, 10),
    };
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId
          ? { ...p, stock: type === 'in' ? p.stock + qty : Math.max(0, p.stock - qty) }
          : p
      ),
      stockMovements: [movement, ...prev.stockMovements],
    }));
    void triggerSheetSync('stockMovements', movement);
  };

  const handleCreateShop = async (newShop: Shop) => {
    const defaultBank: BankAccount = {
      id: `bank_${Date.now()}`,
      shopId: newShop.id,
      name: 'Cash / Merchant bKash',
      accountType: 'bkash',
      accountNumber: newShop.phone,
      openingBalance: 0,
    };

    const nextState: AppState = {
      ...stateRef.current,
      shops: [...stateRef.current.shops, newShop],
      bankAccounts: [...stateRef.current.bankAccounts, defaultBank],
      activeShopId: newShop.id,
    };
    setState(nextState);

    const token = googleAccessTokenRef.current;
    if (token) {
      const snapshot = buildShopSnapshot(nextState, newShop.id);
      if (snapshot) {
        const created = await createShopSpreadsheet(token, newShop, snapshot);
        const nowIso = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          shops: prev.shops.map((s) =>
            s.id === newShop.id
              ? {
                  ...s,
                  spreadsheetId: created.spreadsheetId,
                  spreadsheetUrl: created.spreadsheetUrl,
                  lastSyncStatus: 'synced',
                  lastSyncedAt: nowIso,
                  lastSyncMessage: 'Auto-created Google Sheet',
                }
              : s
          ),
        }));
      }
    }
  };

  const handleCreateSheetForShop = async (targetShop: Shop) => {
    const token = googleAccessTokenRef.current ?? (await handleConnectGoogle());
    const snapshot = buildShopSnapshot(stateRef.current, targetShop.id);
    if (!snapshot) throw new Error('Shop not found');
    const created = await createShopSpreadsheet(token, targetShop, snapshot);
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      shops: prev.shops.map((s) =>
        s.id === targetShop.id
          ? {
              ...s,
              spreadsheetId: created.spreadsheetId,
              spreadsheetUrl: created.spreadsheetUrl,
              lastSyncStatus: 'synced',
              lastSyncedAt: nowIso,
              lastSyncMessage: 'Google Sheet created & synced',
            }
          : s
      ),
    }));
  };

  const handleUpdateShop = (updated: Shop) => {
    setState((prev) => ({
      ...prev,
      shops: prev.shops.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  const handleCreateUser = (newUser: UserAccount) => {
    setState((prev) => ({ ...prev, users: [...prev.users, newUser] }));
  };

  const handleUpdateUserPermissions = (
    userId: string,
    permissions: Record<MenuKey, boolean>,
    allowedShopIds: string[],
    assignedShopId?: string
  ) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions,
              allowedShopIds,
              assignedShopId: assignedShopId ?? u.assignedShopId,
            }
          : u
      ),
    }));
  };

  const handleSyncShopNow = async (targetShop: Shop) => {
    const snapshot = buildShopSnapshot(stateRef.current, targetShop.id);
    if (!snapshot) return;

    const token = googleAccessTokenRef.current;
    if (token && targetShop.spreadsheetId) {
      const res = await syncShopToGoogleSheet(token, targetShop.spreadsheetId, snapshot);
      setState((prev) => ({
        ...prev,
        shops: prev.shops.map((s) =>
          s.id === targetShop.id
            ? {
                ...s,
                lastSyncStatus: 'synced',
                lastSyncedAt: res.updatedAt,
                lastSyncMessage: 'Manual sync completed',
              }
            : s
        ),
      }));
      setSyncFeedback({ status: 'synced', message: 'Synced to Google Sheet' });
    }

    if (targetShop.webhookUrl) {
      await triggerSheetSync('full_snapshot', snapshot, targetShop);
    }

    if (!token && !targetShop.webhookUrl && targetShop.spreadsheetId) {
      const freshToken = await handleConnectGoogle();
      const res = await syncShopToGoogleSheet(freshToken, targetShop.spreadsheetId, snapshot);
      setState((prev) => ({
        ...prev,
        shops: prev.shops.map((s) =>
          s.id === targetShop.id
            ? {
                ...s,
                lastSyncStatus: 'synced',
                lastSyncedAt: res.updatedAt,
                lastSyncMessage: 'Synced to Google Sheet',
              }
            : s
        ),
      }));
    }
  };

  const handleRestoreShopFromSheet = async (targetShop: Shop) => {
    if (!targetShop.spreadsheetId) {
      throw new Error('No Google Sheet is linked to this shop yet.');
    }
    const token = googleAccessTokenRef.current ?? (await handleConnectGoogle());
    const snapshot = await restoreShopFromGoogleSheet(token, targetShop.spreadsheetId);
    setState((prev) => applyRestoredShopSnapshot(prev, snapshot));
    setSyncFeedback({ status: 'synced', message: `Restored ${targetShop.name} from Google Sheet` });
  };

  const handleResetAllData = () => {
    const fresh = { ...createSeedState(), isAuthenticated: true };
    setState(fresh);
    setActiveMenu('dashboard');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  };

  if (!state.isAuthenticated) {
    return (
      <LoginPage
        lang={state.language}
        onChangeLang={handleChangeLang}
        users={state.users}
        shops={state.shops}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        lang={state.language}
        activeMenu={effectiveMenu}
        onSelectMenu={setActiveMenu}
        currentUser={currentUser}
        shopName={activeShop.name}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          lang={state.language}
          onChangeLang={handleChangeLang}
          shops={allowedShops}
          activeShop={activeShop}
          onSelectShop={handleSelectShop}
          currentUser={currentUser}
          activeMenu={effectiveMenu}
          onNavigate={(menu) => {
            if (canAccessMenu(currentUser, menu)) {
              setActiveMenu(menu);
            }
          }}
          onOpenUserModal={() => setUserModalOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCreateShop={() => setCreateShopOpen(true)}
          onLogout={handleLogout}
          googleConnected={googleConnected}
          onConnectGoogle={async () => {
            await handleConnectGoogle();
          }}
          syncFeedback={syncFeedback}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {!canAccessMenu(currentUser, effectiveMenu) ? (
            <div className="bg-white border border-red-200 rounded-xl p-8 text-center text-sm text-red-700 font-medium">
              {UI_TEXT.accessDenied[state.language]}
            </div>
          ) : (
            <>
              {effectiveMenu === 'dashboard' && (
                <DashboardView
                  lang={state.language}
                  state={state}
                  shopId={shopId}
                  onNavigate={(m) => {
                    if (canAccessMenu(currentUser, m)) setActiveMenu(m);
                  }}
                />
              )}

              {effectiveMenu === 'sales' && (
                <SalesView
                  lang={state.language}
                  shop={activeShop}
                  products={shopProducts}
                  customers={shopCustomers}
                  bankAccounts={shopBankAccounts}
                  sales={shopSales}
                  saleReturns={shopSaleReturns}
                  onCreateSale={handleCreateSale}
                  onQuickAddCustomer={handleQuickAddParty}
                  onCreateSaleReturn={handleCreateSaleReturn}
                />
              )}

              {effectiveMenu === 'purchase' && (
                <PurchaseView
                  lang={state.language}
                  shop={activeShop}
                  products={shopProducts}
                  suppliers={shopSuppliers}
                  purchases={shopPurchases}
                  purchaseReturns={shopPurchaseReturns}
                  onCreatePurchase={handleCreatePurchase}
                  onQuickAddSupplier={handleQuickAddParty}
                  onCreatePurchaseReturn={handleCreatePurchaseReturn}
                />
              )}

              {(effectiveMenu === 'sales_order' || effectiveMenu === 'purchase_order') && (
                <OrdersView
                  mode={effectiveMenu}
                  lang={state.language}
                  shopId={shopId}
                  products={shopProducts}
                  parties={shopParties}
                  salesOrders={shopSalesOrders}
                  purchaseOrders={shopPurchaseOrders}
                  onCreateSalesOrder={handleCreateSalesOrder}
                  onConvertSalesOrder={handleConvertSalesOrder}
                  onCreatePurchaseOrder={handleCreatePurchaseOrder}
                  onConvertPurchaseOrder={handleConvertPurchaseOrder}
                />
              )}

              {effectiveMenu === 'due_khata' && (
                <DueKhataView
                  lang={state.language}
                  shop={activeShop}
                  parties={shopParties}
                  sales={shopSales}
                  saleReturns={shopSaleReturns}
                  purchases={shopPurchases}
                  purchaseReturns={shopPurchaseReturns}
                  dueSettlements={shopSettlements}
                  bankAccounts={shopBankAccounts}
                  onSettleDue={handleSettleDue}
                />
              )}

              {effectiveMenu === 'expenses' && (
                <ExpensesView
                  lang={state.language}
                  shopId={shopId}
                  expenses={shopExpenses}
                  bankAccounts={shopBankAccounts}
                  onAddExpense={handleAddExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {effectiveMenu === 'cash_adjustment' && (
                <CashAdjustmentView
                  lang={state.language}
                  shop={activeShop}
                  handCash={handCash}
                  adjustments={shopAdjustments}
                  onUpdateInitialCapital={handleUpdateInitialCapital}
                  onAddAdjustment={handleAddAdjustment}
                />
              )}

              {effectiveMenu === 'bank_transactions' && (
                <BankTransactionsView
                  lang={state.language}
                  shopId={shopId}
                  accounts={shopBankAccounts}
                  transactions={shopBankTransactions}
                  sales={shopSales}
                  dueSettlements={shopSettlements}
                  expenses={shopExpenses}
                  onAddTransaction={handleAddBankTx}
                  onAddAccount={handleAddBankAccount}
                />
              )}

              {effectiveMenu === 'online_shop' && (
                <OnlineShopView
                  lang={state.language}
                  shop={activeShop}
                  products={shopProducts}
                  onlineOrders={shopOnlineOrders}
                  onUpdateOnlineConfig={handleUpdateOnlineConfig}
                  onToggleProductOnline={handleToggleProductOnline}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                />
              )}

              {effectiveMenu === 'reports' && (
                <ReportsView lang={state.language} state={state} shopId={shopId} />
              )}

              {effectiveMenu === 'products' && (
                <ProductsView
                  lang={state.language}
                  shopId={shopId}
                  products={shopProducts}
                  stockMovements={shopStockMovements}
                  onSaveProduct={handleSaveProduct}
                  onAdjustStock={handleAdjustStock}
                />
              )}

              {effectiveMenu === 'parties' && (
                <PartiesView
                  lang={state.language}
                  shopId={shopId}
                  parties={shopParties}
                  sales={shopSales}
                  saleReturns={shopSaleReturns}
                  purchases={shopPurchases}
                  purchaseReturns={shopPurchaseReturns}
                  dueSettlements={shopSettlements}
                  onSaveParty={handleQuickAddParty}
                />
              )}

              {effectiveMenu === 'settings' && (
                <SettingsView
                  lang={state.language}
                  onChangeLang={handleChangeLang}
                  shops={state.shops}
                  activeShop={activeShop}
                  users={state.users}
                  googleConnected={googleConnected}
                  googleEmail={googleEmail}
                  onConnectGoogle={async () => {
                    await handleConnectGoogle();
                  }}
                  onDisconnectGoogle={handleDisconnectGoogle}
                  onCreateShop={handleCreateShop}
                  onUpdateShop={handleUpdateShop}
                  onCreateSheetForShop={handleCreateSheetForShop}
                  onRestoreShopFromSheet={handleRestoreShopFromSheet}
                  onCreateUser={handleCreateUser}
                  onUpdateUserPermissions={handleUpdateUserPermissions}
                  onSyncShopNow={handleSyncShopNow}
                  onResetAllData={handleResetAllData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {userModalOpen && (
        <UserAuthModal
          lang={state.language}
          users={state.users}
          shops={state.shops}
          currentUser={currentUser}
          onLoginUser={handleLoginUser}
          onLogout={handleLogout}
          onClose={() => setUserModalOpen(false)}
        />
      )}

      {createShopOpen && currentUser.role === 'admin' && (
        <CreateShopModal
          lang={state.language}
          googleConnected={googleConnected}
          googleEmail={googleEmail}
          onConnectGoogle={async () => {
            await handleConnectGoogle();
          }}
          onCreateShop={handleCreateShop}
          onClose={() => setCreateShopOpen(false)}
        />
      )}
    </div>
  );
}

