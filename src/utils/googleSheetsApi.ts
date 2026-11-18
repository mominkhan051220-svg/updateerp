import {
  BankAccount,
  BankTransaction,
  CashAdjustment,
  DueSettlement,
  Expense,
  Language,
  OnlineOrder,
  Party,
  Product,
  PurchaseBill,
  PurchaseOrder,
  PurchaseReturn,
  SaleInvoice,
  SaleReturn,
  SalesOrder,
  Shop,
  StockMovement,
} from '../types';
import { formatGoogleSheetsApiError } from './googleSheetsError';

export interface ShopDataSnapshot {
  version: 1;
  exportedAt: string;
  shop: Shop;
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

const SHEET_TABS = [
  'ShopSnapshot',
  'Products',
  'Parties',
  'Sales',
  'Purchases',
  'DueSettlements',
  'Expenses',
  'BankTransactions',
  'CashAdjustments',
  'Orders',
];

const MAX_CELL_CHARS = 40000;

function chunkJsonString(json: string): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < json.length; i += MAX_CELL_CHARS) {
    chunks.push([String(chunks.length + 1), json.slice(i, i + MAX_CELL_CHARS)]);
  }
  return chunks.length > 0 ? chunks : [['1', '{}']];
}

function sanitizeCell(val: string | number): string | number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const str = String(val ?? '');
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function buildSheetValueRanges(snapshot: ShopDataSnapshot) {
  const snapshotJson = JSON.stringify(snapshot);
  const jsonChunks = chunkJsonString(snapshotJson);

  return [
    {
      range: 'ShopSnapshot!A1:C1',
      values: [['ChunkIndex', 'SnapshotJSON', `UpdatedAt:${snapshot.exportedAt}`]],
    },
    {
      range: `ShopSnapshot!A2:B${1 + jsonChunks.length}`,
      values: jsonChunks,
    },
    {
      range: 'Products!A1:G' + Math.max(1, snapshot.products.length + 1),
      values: [
        ['ID', 'Name', 'Barcode', 'Category', 'Unit', 'PurchasePrice', 'SellingPrice', 'Stock'].slice(0, 7),
        ...snapshot.products.map((p) => [
          sanitizeCell(p.id),
          sanitizeCell(p.name),
          sanitizeCell(p.barcode),
          sanitizeCell(p.category),
          sanitizeCell(`${p.stock} ${p.unit}`),
          p.purchasePrice,
          p.sellingPrice,
        ]),
      ],
    },
    {
      range: 'Parties!A1:F' + Math.max(1, snapshot.parties.length + 1),
      values: [
        ['ID', 'Name', 'Type', 'Phone', 'Address', 'PrevDueOrAdv'],
        ...snapshot.parties.map((p) => [
          sanitizeCell(p.id),
          sanitizeCell(p.name),
          sanitizeCell(p.type),
          sanitizeCell(p.phone),
          sanitizeCell(p.address),
          p.type === 'customer' ? p.previousDue : p.previousAdvance,
        ]),
      ],
    },
    {
      range: 'Sales!A1:G' + Math.max(1, snapshot.sales.length + 1),
      values: [
        ['InvoiceNo', 'Date', 'Customer', 'GrandTotal', 'Paid', 'Due', 'Status'],
        ...snapshot.sales.map((s) => [
          sanitizeCell(s.invoiceNo),
          sanitizeCell(s.date),
          sanitizeCell(s.customerName),
          s.grandTotal,
          s.paidAmount,
          s.dueAmount,
          sanitizeCell(s.status),
        ]),
      ],
    },
    {
      range: 'Purchases!A1:F' + Math.max(1, snapshot.purchases.length + 1),
      values: [
        ['BillNo', 'Date', 'Supplier', 'GrandTotal', 'Paid', 'Due'],
        ...snapshot.purchases.map((p) => [
          sanitizeCell(p.billNo),
          sanitizeCell(p.date),
          sanitizeCell(p.supplierName),
          p.grandTotal,
          p.paidAmount,
          p.dueAmount,
        ]),
      ],
    },
    {
      range: 'DueSettlements!A1:F' + Math.max(1, snapshot.dueSettlements.length + 1),
      values: [
        ['Date', 'PartyName', 'Type', 'Amount', 'Method', 'Note'],
        ...snapshot.dueSettlements.map((d) => [
          sanitizeCell(d.date),
          sanitizeCell(d.partyName),
          sanitizeCell(d.partyType),
          d.amount,
          sanitizeCell(d.method),
          sanitizeCell(d.note),
        ]),
      ],
    },
    {
      range: 'Expenses!A1:E' + Math.max(1, snapshot.expenses.length + 1),
      values: [
        ['Date', 'Category', 'Amount', 'Method', 'Note'],
        ...snapshot.expenses.map((e) => [
          sanitizeCell(e.date),
          sanitizeCell(e.category),
          e.amount,
          sanitizeCell(e.paymentMethod),
          sanitizeCell(e.note),
        ]),
      ],
    },
    {
      range: 'BankTransactions!A1:F' + Math.max(1, snapshot.bankTransactions.length + 1),
      values: [
        ['Date', 'Account', 'Type', 'Amount', 'ReferenceID', 'Note'],
        ...snapshot.bankTransactions.map((t) => [
          sanitizeCell(t.date),
          sanitizeCell(t.accountName),
          sanitizeCell(t.type),
          t.amount,
          sanitizeCell(t.referenceId),
          sanitizeCell(t.note),
        ]),
      ],
    },
    {
      range: 'CashAdjustments!A1:D' + Math.max(1, snapshot.cashAdjustments.length + 1),
      values: [
        ['Date', 'Type', 'Amount', 'Note'],
        ...snapshot.cashAdjustments.map((c) => [
          sanitizeCell(c.date),
          sanitizeCell(c.type),
          c.amount,
          sanitizeCell(c.note),
        ]),
      ],
    },
    {
      range: 'Orders!A1:F' + Math.max(1, snapshot.salesOrders.length + snapshot.purchaseOrders.length + 1),
      values: [
        ['OrderNo', 'OrderType', 'Date', 'Party', 'Total', 'Status'],
        ...snapshot.salesOrders.map((o) => [
          sanitizeCell(o.orderNo),
          'SalesOrder',
          sanitizeCell(o.date),
          sanitizeCell(o.customerName),
          o.totalAmount,
          sanitizeCell(o.status),
        ]),
        ...snapshot.purchaseOrders.map((o) => [
          sanitizeCell(o.orderNo),
          'PurchaseOrder',
          sanitizeCell(o.date),
          sanitizeCell(o.supplierName),
          o.totalAmount,
          sanitizeCell(o.status),
        ]),
      ],
    },
  ];
}

export async function createShopSpreadsheet(
  accessToken: string,
  shop: Shop,
  snapshot: ShopDataSnapshot,
  lang: Language = 'bn'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `HishabKhata - ${shop.name}`,
      },
      sheets: SHEET_TABS.map((title) => ({ properties: { title } })),
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw formatGoogleSheetsApiError(createRes.status, errText, lang);
  }

  const created = (await createRes.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
  };

  const boundSnapshot: ShopDataSnapshot = {
    ...snapshot,
    shop: {
      ...snapshot.shop,
      spreadsheetId: created.spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl,
    },
  };

  await syncShopToGoogleSheet(accessToken, created.spreadsheetId, boundSnapshot, lang);
  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
  };
}

export async function syncShopToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  snapshot: ShopDataSnapshot,
  lang: Language = 'bn'
): Promise<{ updatedAt: string }> {
  // Clear ShopSnapshot tab first so stale chunks from a larger prior snapshot never remain
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/ShopSnapshot!A1:C100:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = buildSheetValueRanges(snapshot);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data,
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw formatGoogleSheetsApiError(res.status, errText, lang);
  }

  return { updatedAt: new Date().toISOString() };
}

export async function restoreShopFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  lang: Language = 'bn'
): Promise<ShopDataSnapshot> {
  // Inspect spreadsheet metadata first to verify tab existence per sheets.md best practices
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw formatGoogleSheetsApiError(metaRes.status, errText, lang);
  }

  const meta = (await metaRes.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  const tabTitles = (meta.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[];
  const snapshotTab = tabTitles.includes('ShopSnapshot') ? 'ShopSnapshot' : tabTitles[0];

  if (!snapshotTab) {
    throw new Error('This Google Sheet contains no worksheets to restore.');
  }

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      snapshotTab
    )}!A2:B100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!valuesRes.ok) {
    const errText = await valuesRes.text();
    throw formatGoogleSheetsApiError(valuesRes.status, errText, lang);
  }

  const body = (await valuesRes.json()) as { values?: string[][] };
  const rows = body.values ?? [];
  if (rows.length === 0) {
    throw new Error('No snapshot backup rows found inside this Google Sheet yet.');
  }

  const combinedJson = rows.map((r) => r[1] ?? '').join('');
  const parsed = JSON.parse(combinedJson) as ShopDataSnapshot;
  if (!parsed || !parsed.shop || !Array.isArray(parsed.products)) {
    throw new Error('Google Sheet snapshot format is invalid.');
  }

  return parsed;
}
