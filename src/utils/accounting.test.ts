import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySaleStockDelta,
  calculateInvoiceTotals,
  canAccessMenu,
  computeDashboardSummary,
  computePartyPayable,
  computePartyReceivable,
  generateCsvContent,
  getAllowedMenusForUser,
  getAllowedShopsForUser,
  getDateRangeForFilter,
} from './accounting';
import { createSeedState } from '../data/seedData';
import { UserAccount } from '../types';

test('calculateInvoiceTotals handles discount, VAT, partial payment and status', () => {
  const totals = calculateInvoiceTotals(
    [
      { productId: 'p1', productName: 'Rice', unit: 'Kg', quantity: 10, unitPrice: 100, total: 1000 },
    ],
    10, // 10% discount -> 900
    5, // 5% VAT on 900 -> 45 -> 945
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
  const state = createSeedState();
  const staff: UserAccount = {
    id: 'u_staff',
    name: 'Test Staff',
    username: 'staff',
    password: '123',
    role: 'staff',
    assignedShopId: 'shop_karim',
    allowedShopIds: ['shop_karim'],
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

  const staffShops = getAllowedShopsForUser(staff, state.shops);
  assert.equal(staffShops.length, 1);
  assert.equal(staffShops[0].id, 'shop_karim');
});

test('applySaleStockDelta deducts and restores product stock accurately', () => {
  const state = createSeedState();
  const target = state.products.find((p) => p.shopId === 'shop_rahim')!;
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
  const state = createSeedState();
  const range = getDateRangeForFilter('month', '2026-11-16');
  const summary = computeDashboardSummary(state, 'shop_rahim', range);

  assert.ok(summary.cashIn > 0);
  assert.ok(summary.totalReceivable > 0);
  assert.ok(summary.inventoryValuation > 0);
  assert.ok(summary.topSellingProducts.length > 0);
  assert.ok(summary.lowestSellingProducts.length > 0);

  const customer = state.parties.find((p) => p.shopId === 'shop_rahim' && p.type === 'customer')!;
  const rec = computePartyReceivable(
    customer,
    state.sales.filter((s) => s.shopId === 'shop_rahim'),
    state.saleReturns.filter((r) => r.shopId === 'shop_rahim'),
    state.dueSettlements.filter((d) => d.shopId === 'shop_rahim')
  );
  assert.ok(rec >= 0);

  const supplier = state.parties.find((p) => p.shopId === 'shop_rahim' && p.type === 'supplier')!;
  const pay = computePartyPayable(
    supplier,
    state.purchases.filter((p) => p.shopId === 'shop_rahim'),
    state.purchaseReturns.filter((r) => r.shopId === 'shop_rahim'),
    state.dueSettlements.filter((d) => d.shopId === 'shop_rahim')
  );
  assert.ok(pay >= 0);
});

test('generateCsvContent properly escapes commas and quotes', () => {
  const csv = generateCsvContent(['Name', 'Note'], [['Rahim, Store', 'Paid "cash"']]);
  assert.equal(csv, 'Name,Note\n"Rahim, Store","Paid ""cash"""');
});

test('buildShopSnapshot and applyRestoredShopSnapshot isolate and restore single shop data', async () => {
  const { buildShopSnapshot, applyRestoredShopSnapshot } = await import('./shopSnapshot');
  const state = createSeedState();
  const rahimSnapshot = buildShopSnapshot(state, 'shop_rahim')!;
  assert.ok(rahimSnapshot);
  assert.ok(rahimSnapshot.products.length > 0);
  assert.ok(rahimSnapshot.sales.length > 0);

  // Wipe Rahim Store products locally, keep Karim Store intact
  const corruptedState = {
    ...state,
    products: state.products.filter((p) => p.shopId !== 'shop_rahim'),
    sales: state.sales.filter((s) => s.shopId !== 'shop_rahim'),
  };
  assert.equal(corruptedState.products.filter((p) => p.shopId === 'shop_rahim').length, 0);

  const restored = applyRestoredShopSnapshot(corruptedState, rahimSnapshot);
  assert.equal(
    restored.products.filter((p) => p.shopId === 'shop_rahim').length,
    rahimSnapshot.products.length
  );
  assert.equal(
    restored.products.filter((p) => p.shopId === 'shop_karim').length,
    state.products.filter((p) => p.shopId === 'shop_karim').length
  );
});
