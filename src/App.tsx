import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Cloud, Loader2, Lock, X } from 'lucide-react';
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
  UserRole,
} from './types';
import {
  canAccessMenu,
  computeShopHandCash,
  getAllowedMenusForUser,
  getAllowedShopsForUser,
} from './utils/accounting';
import { UI_TEXT } from './utils/i18n';
import {
  canUseSameOriginRedirect,
  connectGoogleSheetsAccount,
  consumeGoogleRedirectResult,
  consumePendingRedirectShopId,
  disconnectGoogleSheets,
  initGoogleAuth,
} from './utils/googleAuth';
import {
  createShopSpreadsheet,
  restoreShopFromGoogleSheet,
  syncShopToGoogleSheet,
} from './utils/googleSheetsApi';
import { GoogleSheetsApiError } from './utils/googleSheetsError';
import { applyRestoredShopSnapshot, buildShopSnapshot } from './utils/shopSnapshot';

const LANG_PREF_KEY = 'hishabkhata_lang';

function readSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_PREF_KEY);
    return saved === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options?.headers ?? {}),
    },
  });

  const data = (await res.json()) as T & { message?: string; status?: string };
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => ({
    ...createSeedState(),
    language: readSavedLanguage(),
  }));
  const [authChecked, setAuthChecked] = useState(false);
  const [unlockedShopIds, setUnlockedShopIds] = useState<string[]>([]);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlockingPin, setUnlockingPin] = useState(false);

  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [createShopOpen, setCreateShopOpen] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    status: 'synced' | 'local_only' | 'error';
    message: string;
  } | null>(null);

  // Google Sheets OAuth in-memory session (never persisted in browser storage)
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const googleAccessTokenRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Verify authoritative server session + consume any pending Google OAuth redirect result on startup
  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const savedLang = readSavedLanguage();
      let redirectAuth: { user: { email: string | null }; accessToken: string } | null = null;
      let redirectErrorMsg = '';
      try {
        redirectAuth = await consumeGoogleRedirectResult(savedLang);
      } catch (err) {
        redirectErrorMsg = err instanceof Error ? err.message : 'Google sign-in failed.';
      }

      try {
        if (window.location.pathname !== '/' || window.location.search) {
          window.history.replaceState({}, '', '/');
        }
        const data = await apiJson<{
          authenticated: boolean;
          user?: UserAccount;
          state?: AppState;
          unlockedShopIds?: string[];
        }>('/api/auth/session', { method: 'GET' });

        if (!active) return;
        if (data.authenticated && data.state) {
          let nextState: AppState = { ...data.state, isAuthenticated: true };
          setUnlockedShopIds(data.unlockedShopIds ?? []);

          if (redirectAuth) {
            googleAccessTokenRef.current = redirectAuth.accessToken;
            setGoogleConnected(true);
            setGoogleEmail(redirectAuth.user.email);

            const pendingShopId = consumePendingRedirectShopId();
            const pendingShop = pendingShopId
              ? nextState.shops.find((s) => s.id === pendingShopId)
              : undefined;
            if (pendingShop && !pendingShop.spreadsheetId) {
              const snapshot = buildShopSnapshot(nextState, pendingShop.id);
              if (snapshot) {
                try {
                  const created = await createShopSpreadsheet(
                    redirectAuth.accessToken,
                    pendingShop,
                    snapshot,
                    nextState.language
                  );
                  const nowIso = new Date().toISOString();
                  const statusRes = await apiJson<{ state: AppState }>('/api/sheets/sync-status', {
                    method: 'POST',
                    body: JSON.stringify({
                      shopId: pendingShop.id,
                      spreadsheetId: created.spreadsheetId,
                      spreadsheetUrl: created.spreadsheetUrl,
                      lastSyncStatus: 'synced',
                      lastSyncedAt: nowIso,
                      lastSyncMessage: 'Google Sheet created & synced',
                    }),
                  });
                  nextState = { ...statusRes.state, isAuthenticated: true };
                  setSyncFeedback({
                    status: 'synced',
                    message:
                      nextState.language === 'bn'
                        ? `"${pendingShop.name}"-এর জন্য নতুন Google Sheet তৈরি হয়ে যুক্ত হয়েছে।`
                        : `Google Sheet created and linked to "${pendingShop.name}".`,
                  });
                } catch (sheetErr) {
                  setSyncFeedback({
                    status: 'error',
                    message:
                      sheetErr instanceof Error
                        ? sheetErr.message
                        : 'Failed to create Google Sheet.',
                  });
                }
              }
            } else {
              setSyncFeedback({
                status: 'synced',
                message:
                  nextState.language === 'bn'
                    ? `গুগল অ্যাকাউন্ট যুক্ত হয়েছে (${redirectAuth.user.email || 'Connected'})`
                    : `Google connected (${redirectAuth.user.email || 'Active'})`,
              });
            }
          } else if (redirectErrorMsg) {
            setSyncFeedback({ status: 'error', message: redirectErrorMsg });
          }

          setState(nextState);
        } else {
          setState({ ...createSeedState(), language: savedLang, isAuthenticated: false });
          setUnlockedShopIds([]);
        }
      } catch {
        if (!active) return;
        setState({ ...createSeedState(), language: savedLang, isAuthenticated: false });
      } finally {
        if (active) setAuthChecked(true);
      }
    };
    void checkSession();
    return () => {
      active = false;
    };
  }, []);

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

  const isShopPinLocked = Boolean(
    activeShop.pinProtected && !unlockedShopIds.includes(activeShop.id)
  );

  const handleConnectGoogle = useCallback(
    async (options?: {
      pendingShopId?: string;
      forcePopup?: boolean;
      forceRedirect?: boolean;
    }): Promise<string | null> => {
      const res = await connectGoogleSheetsAccount(stateRef.current.language, options);
      if (res.redirected) {
        return null;
      }
      googleAccessTokenRef.current = res.accessToken;
      setGoogleConnected(true);
      setGoogleEmail(res.user.email);
      setSyncFeedback(null);
      return res.accessToken;
    },
    []
  );

  const handleDisconnectGoogle = useCallback(async () => {
    await disconnectGoogleSheets();
    googleAccessTokenRef.current = null;
    setGoogleConnected(false);
    setGoogleEmail(null);
  }, []);

  const pushOAuthSnapshotNow = useCallback(async (nextState: AppState, targetShopId: string) => {
    const token = googleAccessTokenRef.current;
    const targetShop = nextState.shops.find((s) => s.id === targetShopId);
    if (!token || !targetShop?.spreadsheetId) return false;

    const snap = buildShopSnapshot(nextState, targetShopId);
    if (!snap) return false;

    try {
      const res = await syncShopToGoogleSheet(token, targetShop.spreadsheetId, snap);
      const statusRes = await apiJson<{ state: AppState }>('/api/sheets/sync-status', {
        method: 'POST',
        body: JSON.stringify({
          shopId: targetShopId,
          lastSyncStatus: 'synced',
          lastSyncedAt: res.updatedAt,
          lastSyncMessage: 'Saved directly to Google Sheet',
        }),
      });
      setState(statusRes.state);
      setSyncFeedback({ status: 'synced', message: 'Saved directly to Google Sheet' });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sheet sync error';
      try {
        const statusRes = await apiJson<{ state: AppState }>('/api/sheets/sync-status', {
          method: 'POST',
          body: JSON.stringify({
            shopId: targetShopId,
            lastSyncStatus: 'error',
            lastSyncMessage: msg,
          }),
        });
        setState(statusRes.state);
      } catch {
        // Ignore secondary status update failure
      }
      setSyncFeedback({ status: 'error', message: msg });
      return false;
    }
  }, []);

  const mutateShopOnServer = useCallback(
    async (action: string, payload: Record<string, unknown>, targetShopId?: string) => {
      const targetId = targetShopId ?? activeShop.id;
      try {
        const res = await apiJson<{
          state: AppState;
          sheetSync?: { status: 'synced' | 'local_only' | 'error'; message: string };
        }>(`/api/shops/${encodeURIComponent(targetId)}/mutate`, {
          method: 'POST',
          body: JSON.stringify({ action, payload }),
        });

        setState(res.state);

        // If OAuth Google Sheet is linked & connected, flush immediately (no temporary delay!)
        const updatedShop = res.state.shops.find((s) => s.id === targetId);
        if (updatedShop?.spreadsheetId && googleAccessTokenRef.current) {
          await pushOAuthSnapshotNow(res.state, targetId);
        } else if (res.sheetSync) {
          setSyncFeedback(res.sheetSync);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Save failed';
        if (msg.toLowerCase().includes('authentication')) {
          setState({ ...createSeedState(), language: stateRef.current.language, isAuthenticated: false });
          return;
        }
        setSyncFeedback({ status: 'error', message: msg });
      }
    },
    [activeShop.id, pushOAuthSnapshotNow]
  );

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
  const handleSelectShop = async (nextShopId: string) => {
    if (currentUser.role !== 'admin') return;
    setPinInput('');
    setPinError('');
    try {
      const res = await apiJson<{ state: AppState }>('/api/shops/select', {
        method: 'POST',
        body: JSON.stringify({ shopId: nextShopId }),
      });
      setState(res.state);
    } catch {
      // Ignore invalid selection
    }
  };

  const handleChangeLang = (lang: Language) => {
    try {
      localStorage.setItem(LANG_PREF_KEY, lang);
    } catch {
      // Ignore storage errors
    }
    setState((prev) => ({ ...prev, language: lang }));
    if (stateRef.current.isAuthenticated) {
      void apiJson<{ state: AppState }>('/api/preferences/language', {
        method: 'POST',
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  const handleLoginSuccess = (payload: {
    user: UserAccount;
    state: AppState;
    unlockedShopIds: string[];
  }) => {
    const nextMenus = getAllowedMenusForUser(payload.user);
    const nextMenu = canAccessMenu(payload.user, 'dashboard')
      ? 'dashboard'
      : nextMenus[0] ?? 'dashboard';
    setActiveMenu(nextMenu);
    setUnlockedShopIds(payload.unlockedShopIds);
    setPinInput('');
    setPinError('');
    setState({ ...payload.state, isAuthenticated: true });
  };

  const handleLogout = async () => {
    setUserModalOpen(false);
    setMobileMenuOpen(false);
    setCreateShopOpen(false);
    setUnlockedShopIds([]);
    setSyncFeedback(null);
    try {
      await apiJson('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    if (googleConnected) {
      await handleDisconnectGoogle().catch(() => {});
    }
    setState({
      ...createSeedState(),
      language: readSavedLanguage(),
      isAuthenticated: false,
    });
  };

  const handleUnlockShopPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setUnlockingPin(true);
    try {
      const res = await apiJson<{
        unlocked: boolean;
        unlockedShopIds: string[];
        state: AppState;
      }>(`/api/shops/${encodeURIComponent(activeShop.id)}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ pin: pinInput }),
      });
      setPinInput('');
      setUnlockedShopIds(res.unlockedShopIds);
      setState(res.state);
    } catch (err) {
      setPinError(
        err instanceof Error
          ? err.message
          : state.language === 'bn'
          ? 'ভুল সিকিউরিটি পিন।'
          : 'Invalid shop PIN.'
      );
    } finally {
      setUnlockingPin(false);
    }
  };

  const handleCreateSale = (sale: SaleInvoice) => {
    void mutateShopOnServer('create_sale', { sale });
  };

  const handleQuickAddParty = (party: Party) => {
    void mutateShopOnServer('quick_add_party', { party });
  };

  const handleCreateSaleReturn = (ret: SaleReturn) => {
    void mutateShopOnServer('create_sale_return', { saleReturn: ret });
  };

  const handleCreatePurchase = (bill: PurchaseBill) => {
    void mutateShopOnServer('create_purchase', { purchase: bill });
  };

  const handleCreatePurchaseReturn = (ret: PurchaseReturn) => {
    void mutateShopOnServer('create_purchase_return', { purchaseReturn: ret });
  };

  const handleCreateSalesOrder = (order: SalesOrder) => {
    void mutateShopOnServer('create_sales_order', { order });
  };

  const handleConvertSalesOrder = (orderId: string) => {
    void mutateShopOnServer('convert_sales_order', { orderId });
  };

  const handleCreatePurchaseOrder = (order: PurchaseOrder) => {
    void mutateShopOnServer('create_purchase_order', { order });
  };

  const handleConvertPurchaseOrder = (orderId: string) => {
    void mutateShopOnServer('convert_purchase_order', { orderId });
  };

  const handleSettleDue = (settlement: DueSettlement) => {
    void mutateShopOnServer('settle_due', { settlement });
  };

  const handleAddExpense = (expense: Expense) => {
    void mutateShopOnServer('add_expense', { expense });
  };

  const handleDeleteExpense = (id: string) => {
    void mutateShopOnServer('delete_expense', { id });
  };

  const handleUpdateInitialCapital = (amount: number) => {
    void mutateShopOnServer('update_initial_capital', { amount });
  };

  const handleAddAdjustment = (adj: CashAdjustment) => {
    void mutateShopOnServer('add_adjustment', { adjustment: adj });
  };

  const handleAddBankTx = (tx: BankTransaction) => {
    void mutateShopOnServer('add_bank_tx', { tx });
  };

  const handleAddBankAccount = (acc: BankAccount) => {
    void mutateShopOnServer('add_bank_account', { account: acc });
  };

  const handleUpdateOnlineConfig = (config: OnlineShopConfig) => {
    void mutateShopOnServer('update_online_config', { config });
  };

  const handleToggleProductOnline = (productId: string) => {
    void mutateShopOnServer('toggle_product_online', { productId });
  };

  const handleUpdateOrderStatus = (orderId: string, status: OnlineOrder['status']) => {
    void mutateShopOnServer('update_order_status', { orderId, status });
  };

  const handleSaveProduct = (product: Product, isNew: boolean) => {
    void mutateShopOnServer('save_product', { product, isNew });
  };

  const handleAdjustStock = (productId: string, type: 'in' | 'out', qty: number, reason: string) => {
    void mutateShopOnServer('adjust_stock', { productId, type, qty, reason });
  };

  const handleCreateShop = async (
    newShop: Shop,
    options?: { webhookUrl?: string; securityPin?: string }
  ) => {
    const res = await apiJson<{
      state: AppState;
      unlockedShopIds: string[];
      shopId: string;
    }>('/api/shops', {
      method: 'POST',
      body: JSON.stringify({
        shop: newShop,
        webhookUrl: options?.webhookUrl,
        securityPin: options?.securityPin,
      }),
    });
    setState(res.state);
    setUnlockedShopIds(res.unlockedShopIds ?? []);

    const token = googleAccessTokenRef.current;
    if (token) {
      const createdShop = res.state.shops.find((s) => s.id === res.shopId) ?? newShop;
      const snapshot = buildShopSnapshot(res.state, res.shopId);
      if (snapshot) {
        const created = await createShopSpreadsheet(token, createdShop, snapshot);
        const nowIso = new Date().toISOString();
        const statusRes = await apiJson<{ state: AppState }>('/api/sheets/sync-status', {
          method: 'POST',
          body: JSON.stringify({
            shopId: res.shopId,
            spreadsheetId: created.spreadsheetId,
            spreadsheetUrl: created.spreadsheetUrl,
            lastSyncStatus: 'synced',
            lastSyncedAt: nowIso,
            lastSyncMessage: 'Auto-created Google Sheet',
          }),
        });
        setState(statusRes.state);
      }
    }
  };

  const handleCreateSheetForShop = async (targetShop: Shop) => {
    const token =
      googleAccessTokenRef.current ??
      (await handleConnectGoogle({ pendingShopId: targetShop.id }));
    if (!token) return;

    const snapshot = buildShopSnapshot(stateRef.current, targetShop.id);
    if (!snapshot) throw new Error('Shop not found');
    const lang = stateRef.current.language;

    try {
      const created = await createShopSpreadsheet(token, targetShop, snapshot, lang);
      const nowIso = new Date().toISOString();
      const statusRes = await apiJson<{ state: AppState }>('/api/sheets/sync-status', {
        method: 'POST',
        body: JSON.stringify({
          shopId: targetShop.id,
          spreadsheetId: created.spreadsheetId,
          spreadsheetUrl: created.spreadsheetUrl,
          lastSyncStatus: 'synced',
          lastSyncedAt: nowIso,
          lastSyncMessage: 'Google Sheet created & synced',
        }),
      });
      setState(statusRes.state);
      setSyncFeedback({
        status: 'synced',
        message:
          lang === 'bn'
            ? `"${targetShop.name}"-এর জন্য নতুন Google Sheet তৈরি হয়ে যুক্ত হয়েছে।`
            : `Google Sheet created and linked to "${targetShop.name}".`,
      });
    } catch (err) {
      if (err instanceof GoogleSheetsApiError && err.requiresReauth) {
        await handleDisconnectGoogle().catch(() => {});
      }
      throw err;
    }
  };

  const handleUpdateShop = async (updated: Shop) => {
    await mutateShopOnServer('update_shop', { shop: updated }, updated.id);
  };

  const handleUpdateShopSecurity = async (
    targetShopId: string,
    updates: {
      webhookUrl?: string;
      clearWebhook?: boolean;
      rotateSecret?: boolean;
      securityPin?: string;
      removePin?: boolean;
    }
  ) => {
    const res = await apiJson<{ state: AppState; rotatedSecretOnce?: string }>(
      `/api/shops/${encodeURIComponent(targetShopId)}/security`,
      {
        method: 'POST',
        body: JSON.stringify(updates),
      }
    );
    setState(res.state);
    return { rotatedSecretOnce: res.rotatedSecretOnce };
  };

  const handleCreateUser = async (payload: {
    name: string;
    username: string;
    password: string;
    role: UserRole;
    assignedShopId: string;
    permissions: Record<MenuKey, boolean>;
  }) => {
    const res = await apiJson<{ state: AppState }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setState(res.state);
  };

  const handleUpdateUserPermissions = async (
    userId: string,
    permissions: Record<MenuKey, boolean>,
    _allowedShopIds: string[],
    assignedShopId?: string
  ) => {
    const res = await apiJson<{ state: AppState }>(
      `/api/users/${encodeURIComponent(userId)}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissions, assignedShopId }),
      }
    );
    setState(res.state);
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await apiJson<{ deletedSelf?: boolean; state?: AppState }>(
      `/api/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    if (res.deletedSelf) {
      setUserModalOpen(false);
      setMobileMenuOpen(false);
      setCreateShopOpen(false);
      setUnlockedShopIds([]);
      setSyncFeedback(null);
      if (googleConnected) {
        await handleDisconnectGoogle().catch(() => {});
      }
      setState({
        ...createSeedState(),
        language: readSavedLanguage(),
        isAuthenticated: false,
      });
      return;
    }
    if (res.state) {
      setState(res.state);
    }
  };

  const handleSyncShopNow = async (targetShop: Shop) => {
    const snapshot = buildShopSnapshot(stateRef.current, targetShop.id);
    if (!snapshot) return;

    let syncedAny = false;
    const token = googleAccessTokenRef.current;

    if (targetShop.spreadsheetId) {
      const freshToken = token ?? (await handleConnectGoogle());
      if (!freshToken) return;
      const res = await syncShopToGoogleSheet(
        freshToken,
        targetShop.spreadsheetId,
        snapshot,
        stateRef.current.language
      );
      const statusRes = await apiJson<{ state: AppState }>('/api/sheets/sync-status', {
        method: 'POST',
        body: JSON.stringify({
          shopId: targetShop.id,
          lastSyncStatus: 'synced',
          lastSyncedAt: res.updatedAt,
          lastSyncMessage: 'Manual sync completed',
        }),
      });
      setState(statusRes.state);
      syncedAny = true;
    }

    if (targetShop.hasWebhookUrl) {
      const res = await apiJson<{ state: AppState }>('/api/sheets/sync', {
        method: 'POST',
        body: JSON.stringify({
          shopId: targetShop.id,
          action: 'save_snapshot',
          collection: 'ShopSnapshot',
          fullSnapshot: snapshot,
        }),
      });
      setState(res.state);
      syncedAny = true;
    }

    if (!syncedAny) {
      throw new Error(
        state.language === 'bn'
          ? 'প্রথমে এই দোকানের জন্য Google Sheet যুক্ত করুন বা Webhook URL সেভ করুন।'
          : 'Please create a Google Sheet or bind a Webhook URL for this shop first.'
      );
    }

    setSyncFeedback({ status: 'synced', message: 'Synced to Google Sheet' });
  };

  const handleRestoreShopFromSheet = async (targetShop: Shop) => {
    if (targetShop.spreadsheetId) {
      const token = googleAccessTokenRef.current ?? (await handleConnectGoogle());
      if (!token) return;
      const snapshot = await restoreShopFromGoogleSheet(
        token,
        targetShop.spreadsheetId,
        stateRef.current.language
      );
      const validated = applyRestoredShopSnapshot(stateRef.current, snapshot, targetShop.id);
      void validated;
      await mutateShopOnServer('restore_snapshot', { snapshot }, targetShop.id);
      setSyncFeedback({ status: 'synced', message: `Restored ${targetShop.name} from Google Sheet` });
      return;
    }

    if (targetShop.hasWebhookUrl) {
      const res = await apiJson<{ state: AppState }>('/api/sheets/restore', {
        method: 'POST',
        body: JSON.stringify({ shopId: targetShop.id }),
      });
      setState(res.state);
      setSyncFeedback({ status: 'synced', message: `Restored ${targetShop.name} from Google Sheet` });
      return;
    }

    throw new Error('No Google Sheet or Webhook is linked to this shop yet.');
  };

  const handleResetAllData = async () => {
    const res = await apiJson<{ state: AppState }>('/api/reset', { method: 'POST' });
    setState(res.state);
    setUnlockedShopIds([]);
    setActiveMenu('dashboard');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span>{state.language === 'bn' ? 'সিকিউরিটি যাচাই হচ্ছে...' : 'Verifying session...'}</span>
        </div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return (
      <LoginPage
        lang={state.language}
        onChangeLang={handleChangeLang}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const hasSheetConnected = Boolean(activeShop.spreadsheetId || activeShop.hasWebhookUrl);

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
        onLogout={() => void handleLogout()}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          lang={state.language}
          onChangeLang={handleChangeLang}
          shops={allowedShops}
          activeShop={activeShop}
          onSelectShop={(id) => void handleSelectShop(id)}
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
          onLogout={() => void handleLogout()}
          googleConnected={googleConnected}
          onConnectGoogle={async () => {
            try {
              const token = await handleConnectGoogle({ pendingShopId: activeShop.id });
              if (token && !activeShop.spreadsheetId) {
                await handleCreateSheetForShop(activeShop);
              }
            } catch (err) {
              setSyncFeedback({
                status: 'error',
                message: err instanceof Error ? err.message : 'Failed to connect Google Sheets',
              });
            }
          }}
          syncFeedback={syncFeedback}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto space-y-4">
          {syncFeedback?.status === 'error' && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3 no-print"
            >
              <div className="space-y-2 text-xs text-red-800 font-medium min-w-0">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed break-all">{syncFeedback.message}</span>
                </div>
                {canUseSameOriginRedirect() && !googleConnected && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleConnectGoogle({
                        pendingShopId: activeShop.id,
                        forceRedirect: true,
                      }).catch((err) =>
                        setSyncFeedback({
                          status: 'error',
                          message:
                            err instanceof Error ? err.message : 'Redirect sign-in failed',
                        })
                      )
                    }
                    className="h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold"
                  >
                    {state.language === 'bn'
                      ? 'Redirect দিয়ে যুক্ত করুন (মোবাইল বান্ধব)'
                      : 'Connect via Redirect (Mobile Friendly)'}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label={state.language === 'bn' ? 'বার্তা বন্ধ করুন' : 'Dismiss error'}
                onClick={() => setSyncFeedback(null)}
                className="p-1 rounded-md text-red-600 hover:bg-red-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {syncFeedback?.status === 'synced' && (
            <div
              role="status"
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 no-print"
            >
              <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium">
                <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncFeedback.message}</span>
              </div>
              <button
                type="button"
                aria-label={state.language === 'bn' ? 'বার্তা বন্ধ করুন' : 'Dismiss'}
                onClick={() => setSyncFeedback(null)}
                className="p-1 rounded-md text-emerald-700 hover:bg-emerald-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!hasSheetConnected && !isShopPinLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
              <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <Cloud className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  {state.language === 'bn'
                    ? `"${activeShop.name}"-এ সরাসরি Google Sheet ডাটাবেজ সংযুক্ত করতে Google Sheet তৈরি বা Webhook URL যুক্ত করুন।`
                    : `Link a dedicated Google Sheet or Webhook to "${activeShop.name}" so every input saves directly to Google Sheets.`}
                </span>
              </div>
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  disabled={creatingSheet}
                  onClick={async () => {
                    setCreatingSheet(true);
                    try {
                      await handleCreateSheetForShop(activeShop);
                    } catch (err) {
                      setSyncFeedback({
                        status: 'error',
                        message:
                          err instanceof Error ? err.message : 'Failed to create Google Sheet',
                      });
                    } finally {
                      setCreatingSheet(false);
                    }
                  }}
                  className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {creatingSheet && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {creatingSheet
                      ? state.language === 'bn'
                        ? 'যুক্ত হচ্ছে...'
                        : 'Connecting...'
                      : state.language === 'bn'
                      ? 'গুগল শিট তৈরি ও যুক্ত করুন'
                      : 'Create & Link Google Sheet'}
                  </span>
                </button>
              )}
            </div>
          )}

          {isShopPinLocked ? (
            <div className="max-w-sm mx-auto mt-10 bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{activeShop.name}</h2>
                  <p className="text-xs text-slate-500">
                    {state.language === 'bn'
                      ? 'এই দোকানের নিজস্ব সিকিউরিটি পিন দিয়ে আনলক করুন'
                      : 'Enter this shop’s individual security PIN to unlock'}
                  </p>
                </div>
              </div>
              <form onSubmit={(e) => void handleUnlockShopPin(e)} className="space-y-3">
                <input
                  type="password"
                  aria-label={state.language === 'bn' ? 'দোকানের সিকিউরিটি পিন' : 'Shop Security PIN'}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="••••"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />
                {pinError && <p className="text-xs text-red-600 font-medium">{pinError}</p>}
                <button
                  type="submit"
                  disabled={unlockingPin}
                  className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {unlockingPin
                    ? state.language === 'bn'
                      ? 'যাচাই হচ্ছে...'
                      : 'Verifying...'
                    : state.language === 'bn'
                    ? 'দোকান আনলক করুন'
                    : 'Unlock Shop'}
                </button>
              </form>
            </div>
          ) : !canAccessMenu(currentUser, effectiveMenu) ? (
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
                  currentUserId={currentUser.id}
                  googleConnected={googleConnected}
                  googleEmail={googleEmail}
                  canUseRedirect={canUseSameOriginRedirect()}
                  onConnectGoogle={(opts) =>
                    handleConnectGoogle({
                      pendingShopId: activeShop.id,
                      forceRedirect: opts?.forceRedirect,
                    })
                  }
                  onDisconnectGoogle={handleDisconnectGoogle}
                  onCreateShop={handleCreateShop}
                  onUpdateShop={handleUpdateShop}
                  onUpdateShopSecurity={handleUpdateShopSecurity}
                  onCreateSheetForShop={handleCreateSheetForShop}
                  onRestoreShopFromSheet={handleRestoreShopFromSheet}
                  onCreateUser={handleCreateUser}
                  onUpdateUserPermissions={handleUpdateUserPermissions}
                  onDeleteUser={handleDeleteUser}
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
          shops={state.shops}
          currentUser={currentUser}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
          onClose={() => setUserModalOpen(false)}
        />
      )}

      {createShopOpen && currentUser.role === 'admin' && (
        <CreateShopModal
          lang={state.language}
          googleConnected={googleConnected}
          googleEmail={googleEmail}
          onConnectGoogle={handleConnectGoogle}
          onCreateShop={handleCreateShop}
          onClose={() => setCreateShopOpen(false)}
        />
      )}
    </div>
  );
}
