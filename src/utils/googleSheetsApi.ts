import {
  BankAccount,
  BankTransaction,
  CashAdjustment,
  DueSettlement,
  Expense,
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
      range: 'Products!A1:G' + Math.max(2, snapshot.products.length + 1),
      values: [
        ['ID', 'Name', 'Barcode', 'Category', 'Unit', 'PurchasePrice', 'SellingPrice', 'Stock'].slice(0, 7),
        ...snapshot.products.map((p) => [
          p.id,
          p.name,
          p.barcode,
          p.category,
          `${p.stock} ${p.unit}`,
          p.purchasePrice,
          p.sellingPrice,
        ]),
      ],
    },
    {
      range: 'Parties!A1:F' + Math.max(2, snapshot.parties.length + 1),
      values: [
        ['ID', 'Name', 'Type', 'Phone', 'Address', 'PrevDueOrAdv'],
        ...snapshot.parties.map((p) => [
          p.id,
          p.name,
          p.type,
          p.phone,
          p.address,
          p.type === 'customer' ? p.previousDue : p.previousAdvance,
        ]),
      ],
    },
    {
      range: 'Sales!A1:G' + Math.max(2, snapshot.sales.length + 1),
      values: [
        ['InvoiceNo', 'Date', 'Customer', 'GrandTotal', 'Paid', 'Due', 'Status'],
        ...snapshot.sales.map((s) => [
          s.invoiceNo,
          s.date,
          s.customerName,
          s.grandTotal,
          s.paidAmount,
          s.dueAmount,
          s.status,
        ]),
      ],
    },
    {
      range: 'Purchases!A1:F' + Math.max(2, snapshot.purchases.length + 1),
      values: [
        ['BillNo', 'Date', 'Supplier', 'GrandTotal', 'Paid', 'Due'],
        ...snapshot.purchases.map((p) => [
          p.billNo,
          p.date,
          p.supplierName,
          p.grandTotal,
          p.paidAmount,
          p.dueAmount,
        ]),
      ],
    },
    {
      range: 'DueSettlements!A1:F' + Math.max(2, snapshot.dueSettlements.length + 1),
      values: [
        ['Date', 'PartyName', 'Type', 'Amount', 'Method', 'Note'],
        ...snapshot.dueSettlements.map((d) => [d.date, d.partyName, d.partyType, d.amount, d.method, d.note]),
      ],
    },
    {
      range: 'Expenses!A1:E' + Math.max(2, snapshot.expenses.length + 1),
      values: [
        ['Date', 'Category', 'Amount', 'Method', 'Note'],
        ...snapshot.expenses.map((e) => [e.date, e.category, e.amount, e.paymentMethod, e.note]),
      ],
    },
    {
      range: 'BankTransactions!A1:F' + Math.max(2, snapshot.bankTransactions.length + 1),
      values: [
        ['Date', 'Account', 'Type', 'Amount', 'ReferenceID', 'Note'],
        ...snapshot.bankTransactions.map((t) => [t.date, t.accountName, t.type, t.amount, t.referenceId, t.note]),
      ],
    },
    {
      range: 'CashAdjustments!A1:D' + Math.max(2, snapshot.cashAdjustments.length + 1),
      values: [
        ['Date', 'Type', 'Amount', 'Note'],
        ...snapshot.cashAdjustments.map((c) => [c.date, c.type, c.amount, c.note]),
      ],
    },
    {
      range: 'Orders!A1:F' + Math.max(2, snapshot.salesOrders.length + snapshot.purchaseOrders.length + 1),
      values: [
        ['OrderNo', 'OrderType', 'Date', 'Party', 'Total', 'Status'],
        ...snapshot.salesOrders.map((o) => [o.orderNo, 'SalesOrder', o.date, o.customerName, o.totalAmount, o.status]),
        ...snapshot.purchaseOrders.map((o) => [
          o.orderNo,
          'PurchaseOrder',
          o.date,
          o.supplierName,
          o.totalAmount,
          o.status,
        ]),
      ],
    },
  ];
}

export async function createShopSpreadsheet(
  accessToken: string,
  shop: Shop,
  snapshot: ShopDataSnapshot
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
    throw new Error(`Google Sheets creation failed (${createRes.status}): ${errText}`);
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

  await syncShopToGoogleSheet(accessToken, created.spreadsheetId, boundSnapshot);
  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
  };
}

export async function syncShopToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  snapshot: ShopDataSnapshot
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
    throw new Error(`Google Sheet sync failed (${res.status}): ${errText}`);
  }

  return { updatedAt: new Date().toISOString() };
}

export async function restoreShopFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string
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
    throw new Error(`Could not open Google Sheet (${metaRes.status}): ${errText}`);
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
    throw new Error(`Failed reading Google Sheet data (${valuesRes.status}): ${errText}`);
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
