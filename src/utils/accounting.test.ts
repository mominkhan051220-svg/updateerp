import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySaleStockDelta,
  calculateInvoiceTotals,
  canAccessMenu,
  canAccessShop,
  computeDashboardSummary,
  computePartyPayable,
  computePartyReceivable,
  generateCsvContent,
  getAllowedMenusForUser,
  getAllowedShopsForUser,
  getDateRangeForFilter,
} from './accounting';
import { createSeedState, FULL_PERMISSIONS } from '../data/seedData';
import { AppState, UserAccount } from '../types';

function createTestMultiShopState(): AppState {
  const base = createSeedState();
  return {
    ...base,
    shops: [
      {
        ...base.shops[0],
        id: 'shop_a',
        name: 'Store A',
        initialCapital: 100000,
      },
      {
        ...base.shops[0],
        id: 'shop_b',
        name: 'Store B',
        initialCapital: 50000,
      },
    ],
    products: [
      {
        id: 'p_a1',
        shopId: 'shop_a',
        name: 'Rice 25Kg',
        barcode: '1001',
        category: 'Grocery',
        unit: 'Box',
        purchasePrice: 1500,
        sellingPrice: 1800,
        stock: 20,
        alertLimit: 5,
        onlineListed: false,
      },
      {
        id: 'p_b1',
        shopId: 'shop_b',
        name: 'LED Light',
        barcode: '2001',
        category: 'Electronics',
        unit: 'Pcs',
        purchasePrice: 200,
        sellingPrice: 280,
        stock: 15,
        alertLimit: 5,
        onlineListed: false,
      },
    ],
    parties: [
      {
        id: 'c_a1',
        shopId: 'shop_a',
        name: 'Customer A',
        phone: '01700000001',
        address: 'Dhaka',
        type: 'customer',
        previousDue: 1000,
        previousAdvance: 0,
      },
      {
        id: 's_a1',
        shopId: 'shop_a',
        name: 'Supplier A',
        phone: '01700000002',
        address: 'Dhaka',
        type: 'supplier',
        previousDue: 0,
        previousAdvance: 500,
      },
    ],
    sales: [
      {
        id: 'sale_a1',
        shopId: 'shop_a',
        invoiceNo: 'INV-101',
        date: '2026-11-16',
        customerId: 'c_a1',
        customerName: 'Customer A',
        items: [
          {
            productId: 'p_a1',
            productName: 'Rice 25Kg',
            unit: 'Box',
            quantity: 2,
            unitPrice: 1800,
            total: 3600,
          },
        ],
        subtotal: 3600,
        discountPercent: 0,
        discountAmount: 0,
        vatPercent: 0,
        vatAmount: 0,
        grandTotal: 3600,
        paidAmount: 2000,
        dueAmount: 1600,
        paymentMethod: 'cash',
        status: 'partial',
      },
    ],
    purchases: [
      {
        id: 'pur_a1',
        shopId: 'shop_a',
        billNo: 'PUR-501',
        date: '2026-11-15',
        supplierId: 's_a1',
        supplierName: 'Supplier A',
        items: [
          {
            productId: 'p_a1',
            productName: 'Rice 25Kg',
            unit: 'Box',
            quantity: 5,
            unitPrice: 1500,
            total: 7500,
          },
        ],
        grandTotal: 7500,
        paidAmount: 4000,
        dueAmount: 3500,
        paymentStatus: 'partial',
      },
    ],
  };
}

test('createSeedState contains zero demo records and exposes zero plaintext passwords or webhooks', () => {
  const seed = createSeedState();
  assert.equal(seed.isAuthenticated, false);
  assert.equal(seed.shops.length, 1);
  assert.equal(seed.users.length, 1);
  assert.equal(seed.users[0].username, 'mominkhan051220@gmail.com');
  assert.equal('password' in seed.users[0], false);
  assert.equal(seed.shops[0].webhookUrl, undefined);
  assert.equal(seed.users[0].role, 'admin');
  assert.deepEqual(seed.users[0].permissions, FULL_PERMISSIONS);
  assert.equal(seed.products.length, 0);
  assert.equal(seed.parties.length, 0);
  assert.equal(seed.sales.length, 0);
  assert.equal(seed.purchases.length, 0);
  assert.equal(seed.expenses.length, 0);
  assert.equal(seed.bankAccounts.length, 0);
  assert.equal(seed.bankTransactions.length, 0);
});

test('calculateInvoiceTotals handles discount, VAT, partial payment and status', () => {
  const totals = calculateInvoiceTotals(
    [
      { productId: 'p1', productName: 'Rice', unit: 'Kg', quantity: 10, unitPrice: 100, total: 1000 },
    ],
    10,
    5,
    500
  );

  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discountAmount, 100);
  assert.equal(totals.vatAmount, 45);
  assert.equal(totals.grandTotal, 945);
  assert.equal(totals.dueAmount, 445);
  assert.equal(totals.status, 'partial');
});

test('calculateInvoiceTotals marks paid when paidAmount equals grandTotal', () => {
  const totals = calculateInvoiceTotals(
    [{ productId: 'p1', productName: 'Oil', unit: 'Ltr', quantity: 2, unitPrice: 200, total: 400 }],
    0,
    0,
    400
  );
  assert.equal(totals.dueAmount, 0);
  assert.equal(totals.status, 'paid');
});

test('RBAC permissions restrict staff menus to checked boxes and single assigned shop', () => {
  const state = createTestMultiShopState();
  const staff: UserAccount = {
    id: 'u_staff',
    name: 'Test Staff',
    username: 'staff@example.com',
    role: 'staff',
    assignedShopId: 'shop_b',
    allowedShopIds: ['shop_b'],
    permissions: {
      dashboard: true,
      sales: true,
      purchase: false,
      sales_order: false,
      purchase_order: false,
      due_khata: true,
      expenses: false,
      cash_adjustment: false,
      bank_transactions: false,
      online_shop: false,
      reports: false,
      products: false,
      parties: false,
      settings: false,
    },
    createdAt: '2026-11-16',
  };

  const allowed = getAllowedMenusForUser(staff);
  assert.deepEqual(allowed, ['dashboard', 'sales', 'due_khata']);
  assert.equal(canAccessMenu(staff, 'settings'), false);
  assert.equal(canAccessMenu(staff, 'sales'), true);
  assert.equal(canAccessShop(staff, 'shop_b'), true);
  assert.equal(canAccessShop(staff, 'shop_a'), false);

  const staffShops = getAllowedShopsForUser(staff, state.shops);
  assert.equal(staffShops.length, 1);
  assert.equal(staffShops[0].id, 'shop_b');
});

test('applySaleStockDelta deducts and restores product stock accurately', () => {
  const state = createTestMultiShopState();
  const target = state.products.find((p) => p.shopId === 'shop_a')!;
  const initialStock = target.stock;

  const afterSale = applySaleStockDelta(
    state.products,
    [{ productId: target.id, productName: target.name, unit: target.unit, quantity: 5, unitPrice: target.sellingPrice, total: 0 }],
    'deduct'
  );
  assert.equal(afterSale.find((p) => p.id === target.id)!.stock, initialStock - 5);

  const afterReturn = applySaleStockDelta(
    afterSale,
    [{ productId: target.id, productName: target.name, unit: target.unit, quantity: 2, unitPrice: target.sellingPrice, total: 0 }],
    'restore'
  );
  assert.equal(afterReturn.find((p) => p.id === target.id)!.stock, initialStock - 3);
});

test('computeDashboardSummary aggregates multi-shop metrics and due khata totals', () => {
  const state = createTestMultiShopState();
  const range = getDateRangeForFilter('month', '2026-11-16');
  const summary = computeDashboardSummary(state, 'shop_a', range);

  assert.ok(summary.cashIn > 0);
  assert.ok(summary.totalReceivable > 0);
  assert.ok(summary.inventoryValuation > 0);
  assert.ok(summary.topSellingProducts.length > 0);
  assert.ok(summary.lowestSellingProducts.length > 0);

  const customer = state.parties.find((p) => p.shopId === 'shop_a' && p.type === 'customer')!;
  const rec = computePartyReceivable(
    customer,
    state.sales.filter((s) => s.shopId === 'shop_a'),
    state.saleReturns.filter((r) => r.shopId === 'shop_a'),
    state.dueSettlements.filter((d) => d.shopId === 'shop_a')
  );
  assert.equal(rec, 2600);

  const supplier = state.parties.find((p) => p.shopId === 'shop_a' && p.type === 'supplier')!;
  const pay = computePartyPayable(
    supplier,
    state.purchases.filter((p) => p.shopId === 'shop_a'),
    state.purchaseReturns.filter((r) => r.shopId === 'shop_a'),
    state.dueSettlements.filter((d) => d.shopId === 'shop_a')
  );
  assert.equal(pay, 4000);
});

test('generateCsvContent properly escapes commas, quotes, and formula injection', () => {
  const csv = generateCsvContent(['Name', 'Note'], [['Store, Main', '=HYPERLINK("http://evil")']]);
  assert.equal(csv, 'Name,Note\n"Store, Main","\'\=HYPERLINK(""http://evil"")"'.replace('\\=', '='));
});

test('buildShopSnapshot and applyRestoredShopSnapshot isolate and restore single shop data', async () => {
  const { buildShopSnapshot, applyRestoredShopSnapshot } = await import('./shopSnapshot');
  const state = createTestMultiShopState();
  const shopASnapshot = buildShopSnapshot(state, 'shop_a')!;
  assert.ok(shopASnapshot);
  assert.ok(shopASnapshot.products.length > 0);
  assert.ok(shopASnapshot.sales.length > 0);

  const corruptedState = {
    ...state,
    products: state.products.filter((p) => p.shopId !== 'shop_a'),
    sales: state.sales.filter((s) => s.shopId !== 'shop_a'),
  };
  assert.equal(corruptedState.products.filter((p) => p.shopId === 'shop_a').length, 0);

  const restored = applyRestoredShopSnapshot(corruptedState, shopASnapshot);
  assert.equal(
    restored.products.filter((p) => p.shopId === 'shop_a').length,
    shopASnapshot.products.length
  );
  assert.equal(
    restored.products.filter((p) => p.shopId === 'shop_b').length,
    state.products.filter((p) => p.shopId === 'shop_b').length
  );
});

