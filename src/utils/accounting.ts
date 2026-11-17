import {
  ALL_MENU_KEYS,
  AppState,
  BankAccount,
  BankTransaction,
  CashAdjustment,
  DateRange,
  DueSettlement,
  Expense,
  LineItem,
  MenuKey,
  Party,
  Product,
  PurchaseBill,
  PurchaseReturn,
  SaleInvoice,
  SaleReturn,
  TimeframeFilter,
  UserAccount,
} from '../types';

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  dueAmount: number;
  status: 'paid' | 'partial' | 'due';
}

export function calculateInvoiceTotals(
  items: LineItem[],
  discountPercent: number,
  vatPercent: number,
  paidAmount: number
): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const safeDiscount = Math.max(0, Math.min(100, discountPercent || 0));
  const safeVat = Math.max(0, Math.min(100, vatPercent || 0));
  const discountAmount = Number(((subtotal * safeDiscount) / 100).toFixed(2));
  const taxable = Math.max(0, subtotal - discountAmount);
  const vatAmount = Number(((taxable * safeVat) / 100).toFixed(2));
  const grandTotal = Number((taxable + vatAmount).toFixed(2));
  const clampedPaid = Math.max(0, Math.min(grandTotal, paidAmount || 0));
  const dueAmount = Number((grandTotal - clampedPaid).toFixed(2));

  let status: 'paid' | 'partial' | 'due' = 'due';
  if (dueAmount <= 0.001) {
    status = 'paid';
  } else if (clampedPaid > 0) {
    status = 'partial';
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount,
    vatAmount,
    grandTotal,
    dueAmount,
    status,
  };
}

export function getDateRangeForFilter(
  filter: TimeframeFilter,
  referenceDate: string,
  customRange?: DateRange
): DateRange {
  const ref = new Date(`${referenceDate}T00:00:00`);
  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

  if (filter === 'today') {
    return { start: referenceDate, end: referenceDate };
  }
  if (filter === 'week') {
    const start = new Date(ref);
    start.setDate(ref.getDate() - 6);
    return { start: toIsoDate(start), end: referenceDate };
  }
  if (filter === 'month') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    return { start: toIsoDate(start), end: referenceDate };
  }
  return {
    start: customRange?.start || referenceDate,
    end: customRange?.end || referenceDate,
  };
}

export function isDateInRange(dateStr: string, range: DateRange): boolean {
  const d = dateStr.slice(0, 10);
  return d >= range.start && d <= range.end;
}

export function computePartyReceivable(
  party: Party,
  sales: SaleInvoice[],
  saleReturns: SaleReturn[],
  dueSettlements: DueSettlement[]
): number {
  if (party.type !== 'customer') return 0;
  const salesDue = sales
    .filter((s) => s.customerId === party.id)
    .reduce((sum, s) => sum + s.dueAmount, 0);
  const dueAdjustedByReturn = saleReturns
    .filter((r) => r.customerName === party.name && r.refundMethod === 'due_adjust')
    .reduce((sum, r) => sum + r.totalReturnAmount, 0);
  const collected = dueSettlements
    .filter((d) => d.partyId === party.id && d.partyType === 'customer')
    .reduce((sum, d) => sum + d.amount, 0);

  return Math.max(0, Number((party.previousDue + salesDue - dueAdjustedByReturn - collected).toFixed(2)));
}

export function computePartyPayable(
  party: Party,
  purchases: PurchaseBill[],
  purchaseReturns: PurchaseReturn[],
  dueSettlements: DueSettlement[]
): number {
  if (party.type !== 'supplier') return 0;
  const purchaseDue = purchases
    .filter((p) => p.supplierId === party.id)
    .reduce((sum, p) => sum + p.dueAmount, 0);
  const returns = purchaseReturns
    .filter((r) => r.supplierName === party.name)
    .reduce((sum, r) => sum + r.totalReturnAmount, 0);
  const paid = dueSettlements
    .filter((d) => d.partyId === party.id && d.partyType === 'supplier')
    .reduce((sum, d) => sum + d.amount, 0);

  return Math.max(0, Number((party.previousAdvance + purchaseDue - returns - paid).toFixed(2)));
}

export function computeBankAccountBalance(
  account: BankAccount,
  sales: SaleInvoice[],
  dueSettlements: DueSettlement[],
  expenses: Expense[],
  bankTransactions: BankTransaction[]
): number {
  const saleInflow = sales
    .filter((s) => s.bankAccountId === account.id && (s.paymentMethod === 'bank' || s.paymentMethod === 'mobile_banking'))
    .reduce((sum, s) => sum + s.paidAmount, 0);

  const dueInflow = dueSettlements
    .filter((d) => d.bankAccountId === account.id && d.method === 'bank' && d.partyType === 'customer')
    .reduce((sum, d) => sum + d.amount, 0);

  const dueOutflow = dueSettlements
    .filter((d) => d.bankAccountId === account.id && d.method === 'bank' && d.partyType === 'supplier')
    .reduce((sum, d) => sum + d.amount, 0);

  const expenseOutflow = expenses
    .filter((e) => e.bankAccountId === account.id && e.paymentMethod === 'bank')
    .reduce((sum, e) => sum + e.amount, 0);

  const deposits = bankTransactions
    .filter((t) => t.accountId === account.id && t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);

  const withdrawals = bankTransactions
    .filter((t) => t.accountId === account.id && t.type === 'withdraw')
    .reduce((sum, t) => sum + t.amount, 0);

  return Number(
    (account.openingBalance + saleInflow + dueInflow + deposits - dueOutflow - expenseOutflow - withdrawals).toFixed(2)
  );
}

export function computeShopHandCash(
  initialCapital: number,
  sales: SaleInvoice[],
  saleReturns: SaleReturn[],
  purchases: PurchaseBill[],
  dueSettlements: DueSettlement[],
  expenses: Expense[],
  cashAdjustments: CashAdjustment[],
  bankTransactions: BankTransaction[]
): number {
  const adjustmentCapital = cashAdjustments
    .filter((c) => c.type === 'initial_capital' || c.type === 'investment')
    .reduce((sum, c) => sum + c.amount, 0);

  const adjustmentWithdrawals = cashAdjustments
    .filter((c) => c.type === 'withdrawal')
    .reduce((sum, c) => sum + c.amount, 0);

  const cashSales = sales
    .filter((s) => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + s.paidAmount, 0);

  const cashRefunds = saleReturns
    .filter((r) => r.refundMethod === 'cash')
    .reduce((sum, r) => sum + r.totalReturnAmount, 0);

  const cashPurchases = purchases.reduce((sum, p) => sum + p.paidAmount, 0);

  const cashCustomerDueCollected = dueSettlements
    .filter((d) => d.method === 'cash' && d.partyType === 'customer')
    .reduce((sum, d) => sum + d.amount, 0);

  const cashSupplierDuePaid = dueSettlements
    .filter((d) => d.method === 'cash' && d.partyType === 'supplier')
    .reduce((sum, d) => sum + d.amount, 0);

  const cashExpenses = expenses
    .filter((e) => e.paymentMethod === 'cash')
    .reduce((sum, e) => sum + e.amount, 0);

  // Depositing cash into bank decreases hand cash; withdrawing from bank increases hand cash
  const bankDeposits = bankTransactions
    .filter((t) => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
  const bankWithdraws = bankTransactions
    .filter((t) => t.type === 'withdraw')
    .reduce((sum, t) => sum + t.amount, 0);

  return Number(
    (
      initialCapital +
      adjustmentCapital +
      cashSales +
      cashCustomerDueCollected +
      bankWithdraws -
      adjustmentWithdrawals -
      cashRefunds -
      cashPurchases -
      cashSupplierDuePaid -
      cashExpenses -
      bankDeposits
    ).toFixed(2)
  );
}

export interface ProductSalesRank {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  stock: number;
}

export interface DashboardSummary {
  cashIn: number;
  cashOut: number;
  totalReceivable: number;
  totalPayable: number;
  handCash: number;
  bankBalance: number;
  totalExpense: number;
  inventoryValuation: number;
  totalStockUnits: number;
  lowStockCount: number;
  topSellingProducts: ProductSalesRank[];
  lowestSellingProducts: ProductSalesRank[];
  totalSalesRevenue: number;
  totalPurchaseCost: number;
  estimatedProfit: number;
}

export function computeDashboardSummary(
  state: AppState,
  shopId: string,
  range: DateRange
): DashboardSummary {
  const shop = state.shops.find((s) => s.id === shopId);
  const products = state.products.filter((p) => p.shopId === shopId);
  const parties = state.parties.filter((p) => p.shopId === shopId);
  const allSales = state.sales.filter((s) => s.shopId === shopId);
  const allSaleReturns = state.saleReturns.filter((r) => r.shopId === shopId);
  const allPurchases = state.purchases.filter((p) => p.shopId === shopId);
  const allPurchaseReturns = state.purchaseReturns.filter((r) => r.shopId === shopId);
  const allSettlements = state.dueSettlements.filter((d) => d.shopId === shopId);
  const allExpenses = state.expenses.filter((e) => e.shopId === shopId);
  const allAdjustments = state.cashAdjustments.filter((c) => c.shopId === shopId);
  const bankAccounts = state.bankAccounts.filter((b) => b.shopId === shopId);
  const allBankTx = state.bankTransactions.filter((t) => t.shopId === shopId);

  const rangeSales = allSales.filter((s) => isDateInRange(s.date, range));
  const rangeSaleReturns = allSaleReturns.filter((r) => isDateInRange(r.date, range));
  const rangePurchases = allPurchases.filter((p) => isDateInRange(p.date, range));
  const rangeSettlements = allSettlements.filter((d) => isDateInRange(d.date, range));
  const rangeExpenses = allExpenses.filter((e) => isDateInRange(e.date, range));
  const rangeAdjustments = allAdjustments.filter((c) => isDateInRange(c.date, range));

  const cashIn = Number(
    (
      rangeSales.reduce((s, x) => s + x.paidAmount, 0) +
      rangeSettlements.filter((d) => d.partyType === 'customer').reduce((s, d) => s + d.amount, 0) +
      rangeAdjustments
        .filter((c) => c.type === 'investment' || c.type === 'initial_capital')
        .reduce((s, c) => s + c.amount, 0)
    ).toFixed(2)
  );

  const cashOut = Number(
    (
      rangePurchases.reduce((s, p) => s + p.paidAmount, 0) +
      rangeExpenses.reduce((s, e) => s + e.amount, 0) +
      rangeSettlements.filter((d) => d.partyType === 'supplier').reduce((s, d) => s + d.amount, 0) +
      rangeSaleReturns.filter((r) => r.refundMethod === 'cash').reduce((s, r) => s + r.totalReturnAmount, 0) +
      rangeAdjustments.filter((c) => c.type === 'withdrawal').reduce((s, c) => s + c.amount, 0)
    ).toFixed(2)
  );

  const totalReceivable = Number(
    parties
      .filter((p) => p.type === 'customer')
      .reduce((sum, p) => sum + computePartyReceivable(p, allSales, allSaleReturns, allSettlements), 0)
      .toFixed(2)
  );

  const totalPayable = Number(
    parties
      .filter((p) => p.type === 'supplier')
      .reduce((sum, p) => sum + computePartyPayable(p, allPurchases, allPurchaseReturns, allSettlements), 0)
      .toFixed(2)
  );

  const handCash = computeShopHandCash(
    shop?.initialCapital ?? 0,
    allSales,
    allSaleReturns,
    allPurchases,
    allSettlements,
    allExpenses,
    allAdjustments,
    allBankTx
  );

  const bankBalance = Number(
    bankAccounts
      .reduce((sum, acc) => sum + computeBankAccountBalance(acc, allSales, allSettlements, allExpenses, allBankTx), 0)
      .toFixed(2)
  );

  const totalExpense = Number(rangeExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2));
  const totalSalesRevenue = Number(rangeSales.reduce((s, x) => s + x.grandTotal, 0).toFixed(2));
  const totalPurchaseCost = Number(rangePurchases.reduce((s, x) => s + x.grandTotal, 0).toFixed(2));

  // COGS estimation using current product purchasePrice for Profit & Loss
  const productCostMap = new Map(products.map((p) => [p.id, p.purchasePrice]));
  const cogs = rangeSales.reduce((sum, sale) => {
    return (
      sum +
      sale.items.reduce((itemSum, item) => {
        const cost = productCostMap.get(item.productId) ?? item.unitPrice * 0.8;
        return itemSum + cost * item.quantity;
      }, 0)
    );
  }, 0);
  const estimatedProfit = Number((totalSalesRevenue - cogs - totalExpense).toFixed(2));

  const inventoryValuation = Number(
    products.reduce((sum, p) => sum + Math.max(0, p.stock) * p.purchasePrice, 0).toFixed(2)
  );
  const totalStockUnits = products.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
  const lowStockCount = products.filter((p) => p.stock <= p.alertLimit).length;

  // Product sales rankings
  const salesByProduct = new Map<string, { qty: number; rev: number }>();
  for (const sale of rangeSales) {
    for (const item of sale.items) {
      const prev = salesByProduct.get(item.productId) ?? { qty: 0, rev: 0 };
      salesByProduct.set(item.productId, {
        qty: prev.qty + item.quantity,
        rev: prev.rev + item.total,
      });
    }
  }

  const ranked: ProductSalesRank[] = products.map((p) => {
    const agg = salesByProduct.get(p.id) ?? { qty: 0, rev: 0 };
    return {
      productId: p.id,
      productName: p.name,
      quantitySold: agg.qty,
      revenue: Number(agg.rev.toFixed(2)),
      stock: p.stock,
    };
  });

  const topSellingProducts = [...ranked]
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
    .slice(0, 5);

  const lowestSellingProducts = [...ranked]
    .sort((a, b) => a.quantitySold - b.quantitySold || a.revenue - b.revenue)
    .slice(0, 5);

  return {
    cashIn,
    cashOut,
    totalReceivable,
    totalPayable,
    handCash,
    bankBalance,
    totalExpense,
    inventoryValuation,
    totalStockUnits,
    lowStockCount,
    topSellingProducts,
    lowestSellingProducts,
    totalSalesRevenue,
    totalPurchaseCost,
    estimatedProfit,
  };
}

export function getAllowedMenusForUser(user: UserAccount): MenuKey[] {
  if (user.role === 'admin') {
    return ALL_MENU_KEYS;
  }
  return ALL_MENU_KEYS.filter((key) => Boolean(user.permissions[key]));
}

export function canAccessMenu(user: UserAccount, menu: MenuKey): boolean {
  if (user.role === 'admin') return true;
  return Boolean(user.permissions[menu]);
}

export function getAllowedShopsForUser<T extends { id: string }>(user: UserAccount, shops: T[]): T[] {
  if (user.role === 'admin') return shops;
  const targetId = user.assignedShopId || user.allowedShopIds[0];
  const assigned = shops.filter((s) => s.id === targetId);
  return assigned.length > 0 ? assigned : shops.slice(0, 1);
}

export function applySaleStockDelta(products: Product[], items: LineItem[], direction: 'deduct' | 'restore'): Product[] {
  const deltaMap = new Map<string, number>();
  for (const item of items) {
    deltaMap.set(item.productId, (deltaMap.get(item.productId) ?? 0) + item.quantity);
  }
  return products.map((p) => {
    const qty = deltaMap.get(p.id);
    if (!qty) return p;
    return {
      ...p,
      stock: direction === 'deduct' ? Math.max(0, p.stock - qty) : p.stock + qty,
    };
  });
}

export function generateCsvContent(headers: string[], rows: Array<Array<string | number>>): string {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}
