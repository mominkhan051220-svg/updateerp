import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { AppState, Language } from '../types';
import {
  computeDashboardSummary,
  computePartyPayable,
  computePartyReceivable,
  generateCsvContent,
  isDateInRange,
} from '../utils/accounting';
import { formatCurrency } from '../utils/i18n';

interface ReportsViewProps {
  lang: Language;
  state: AppState;
  shopId: string;
}

type ReportGroup = 'transaction' | 'stock' | 'party' | 'expense';
type TransactionSubReport =
  | 'sales'
  | 'purchase'
  | 'profit_loss'
  | 'cash_flow'
  | 'day_book'
  | 'mobile_banking'
  | 'balance_sheet';
type StockSubReport = 'stock_summary' | 'stock_change' | 'item_detailed';

export const ReportsView: React.FC<ReportsViewProps> = ({ lang, state, shopId }) => {
  const [group, setGroup] = useState<ReportGroup>('transaction');
  const [txSub, setTxSub] = useState<TransactionSubReport>('sales');
  const [stockSub, setStockSub] = useState<StockSubReport>('stock_summary');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-16');

  const range = { start: startDate, end: endDate };
  const summary = useMemo(() => computeDashboardSummary(state, shopId, range), [state, shopId, startDate, endDate]);

  const shopSales = state.sales.filter((s) => s.shopId === shopId && isDateInRange(s.date, range));
  const shopPurchases = state.purchases.filter((p) => p.shopId === shopId && isDateInRange(p.date, range));
  const shopExpenses = state.expenses.filter((e) => e.shopId === shopId && isDateInRange(e.date, range));
  const shopProducts = state.products.filter((p) => p.shopId === shopId);
  const shopMovements = state.stockMovements.filter((m) => m.shopId === shopId && isDateInRange(m.date, range));
  const shopParties = state.parties.filter((p) => p.shopId === shopId);
  const shopBankTx = state.bankTransactions.filter((t) => t.shopId === shopId && isDateInRange(t.date, range));

  const handleExportExcel = () => {
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    if (group === 'transaction' && txSub === 'sales') {
      headers = ['Invoice', 'Date', 'Customer', 'Total', 'Paid', 'Due'];
      rows = shopSales.map((s) => [s.invoiceNo, s.date, s.customerName, s.grandTotal, s.paidAmount, s.dueAmount]);
    } else if (group === 'transaction' && txSub === 'purchase') {
      headers = ['Bill', 'Date', 'Supplier', 'Total', 'Paid', 'Due'];
      rows = shopPurchases.map((p) => [p.billNo, p.date, p.supplierName, p.grandTotal, p.paidAmount, p.dueAmount]);
    } else if (group === 'stock') {
      headers = ['Product', 'Category', 'Stock', 'Purchase Price', 'Selling Price', 'Valuation'];
      rows = shopProducts.map((p) => [
        p.name,
        p.category,
        p.stock,
        p.purchasePrice,
        p.sellingPrice,
        p.stock * p.purchasePrice,
      ]);
    } else if (group === 'party') {
      headers = ['Party', 'Type', 'Phone', 'Receivable/Payable'];
      rows = shopParties.map((p) => [
        p.name,
        p.type,
        p.phone,
        p.type === 'customer'
          ? computePartyReceivable(
              p,
              state.sales.filter((s) => s.shopId === shopId),
              state.saleReturns.filter((r) => r.shopId === shopId),
              state.dueSettlements.filter((d) => d.shopId === shopId)
            )
          : computePartyPayable(
              p,
              state.purchases.filter((x) => x.shopId === shopId),
              state.purchaseReturns.filter((r) => r.shopId === shopId),
              state.dueSettlements.filter((d) => d.shopId === shopId)
            ),
      ]);
    } else {
      headers = ['Date', 'Category', 'Note', 'Amount'];
      rows = shopExpenses.map((e) => [e.date, e.category, e.note, e.amount]);
    }

    const csv = generateCsvContent(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${group}-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? 'ব্যবসায়িক রিপোর্টস (Reports)' : 'Business Reports'}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <label htmlFor="rep-start" className="text-xs text-slate-500">
              {lang === 'bn' ? 'শুরু:' : 'Start:'}
            </label>
            <input
              id="rep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-mono"
            />
            <span className="text-slate-300">|</span>
            <label htmlFor="rep-end" className="text-xs text-slate-500">
              {lang === 'bn' ? 'শেষ:' : 'End:'}
            </label>
            <input
              id="rep-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'PDF প্রিন্ট' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'Excel / CSV' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 no-print">
        {(
          [
            { id: 'transaction', bn: 'লেনদেন রিপোর্ট', en: 'Transaction Reports' },
            { id: 'stock', bn: 'স্টক রিপোর্ট', en: 'Stock Reports' },
            { id: 'party', bn: 'পার্টি রিপোর্ট', en: 'Party Reports' },
            { id: 'expense', bn: 'খরচ রিপোর্ট', en: 'Expense Reports' },
          ] as const
        ).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup(g.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              group === g.id
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {g[lang]}
          </button>
        ))}
      </div>

      {group === 'transaction' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 no-print">
            {(
              [
                { id: 'sales', bn: 'বিক্রয় রিপোর্ট', en: 'Sales Report' },
                { id: 'purchase', bn: 'ক্রয় রিপোর্ট', en: 'Purchase Report' },
                { id: 'profit_loss', bn: 'লাভ-ক্ষতি (P&L)', en: 'Profit & Loss' },
                { id: 'cash_flow', bn: 'ক্যাশ ফ্লো', en: 'Cash Flow' },
                { id: 'day_book', bn: 'ডে-বুক', en: 'Day-Book' },
                { id: 'mobile_banking', bn: 'মোবাইল ব্যাংকিং', en: 'Mobile Banking' },
                { id: 'balance_sheet', bn: 'ব্যালেন্স শিট', en: 'Balance Sheet' },
              ] as const
            ).map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setTxSub(sub.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  txSub === sub.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {sub[lang]}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {txSub === 'sales' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Invoice</th>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Customer</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Paid</th>
                    <th className="py-2 px-3 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopSales.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 px-3 font-mono font-semibold">{s.invoiceNo}</td>
                      <td className="py-2 px-3 font-mono">{s.date}</td>
                      <td className="py-2 px-3">{s.customerName}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(s.grandTotal, lang)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatCurrency(s.paidAmount, lang)}</td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">{formatCurrency(s.dueAmount, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {txSub === 'purchase' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Bill</th>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Supplier</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopPurchases.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-mono font-semibold">{p.billNo}</td>
                      <td className="py-2 px-3 font-mono">{p.date}</td>
                      <td className="py-2 px-3">{p.supplierName}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(p.grandTotal, lang)}</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-700">{formatCurrency(p.dueAmount, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {txSub === 'profit_loss' && (
              <div className="max-w-lg space-y-3 text-sm">
                <h2 className="font-bold text-slate-900">
                  {lang === 'bn' ? 'লাভ-ক্ষতি বিবরণী (Profit & Loss)' : 'Profit & Loss Statement'}
                </h2>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>{lang === 'bn' ? 'মোট বিক্রয় আয়' : 'Total Sales Revenue'}</span>
                  <span className="font-mono font-semibold">{formatCurrency(summary.totalSalesRevenue, lang)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>{lang === 'bn' ? 'মোট ক্রয় ব্যয়' : 'Total Purchase Cost'}</span>
                  <span className="font-mono">{formatCurrency(summary.totalPurchaseCost, lang)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span>{lang === 'bn' ? 'অপারেটিং খরচ' : 'Operating Expenses'}</span>
                  <span className="font-mono text-red-600">{formatCurrency(summary.totalExpense, lang)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-base">
                  <span>{lang === 'bn' ? 'আনুমানিক নিট লাভ' : 'Estimated Net Profit'}</span>
                  <span className={`font-mono ${summary.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatCurrency(summary.estimatedProfit, lang)}
                  </span>
                </div>
              </div>
            )}

            {(txSub === 'cash_flow' || txSub === 'day_book') && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">{lang === 'bn' ? 'নগদ প্রাপ্তি (Cash In)' : 'Cash In'}</div>
                    <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                      {formatCurrency(summary.cashIn, lang)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">{lang === 'bn' ? 'নগদ প্রদান (Cash Out)' : 'Cash Out'}</div>
                    <div className="text-lg font-bold font-mono text-red-600 mt-1">
                      {formatCurrency(summary.cashOut, lang)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500">{lang === 'bn' ? 'হাতে নগদ ব্যালেন্স' : 'Hand Cash'}</div>
                    <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {formatCurrency(summary.handCash, lang)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {txSub === 'mobile_banking' && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Account</th>
                    <th className="py-2 px-3 text-left">TxID</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopBankTx.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 px-3 font-mono">{t.date}</td>
                      <td className="py-2 px-3">{t.accountName}</td>
                      <td className="py-2 px-3 font-mono">{t.referenceId}</td>
                      <td className="py-2 px-3 uppercase">{t.type}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{formatCurrency(t.amount, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {txSub === 'balance_sheet' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1.5">
                    {lang === 'bn' ? 'সম্পদ (Assets)' : 'Assets'}
                  </h3>
                  <div className="flex justify-between">
                    <span>{lang === 'bn' ? 'হাতে নগদ' : 'Hand Cash'}</span>
                    <span className="font-mono font-semibold">{formatCurrency(summary.handCash, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'bn' ? 'ব্যাংক ব্যালেন্স' : 'Bank Balance'}</span>
                    <span className="font-mono font-semibold">{formatCurrency(summary.bankBalance, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'bn' ? 'মোট পাওনা (Receivable)' : 'Receivables'}</span>
                    <span className="font-mono font-semibold">{formatCurrency(summary.totalReceivable, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'bn' ? 'স্টক মূল্য (Inventory)' : 'Inventory Valuation'}</span>
                    <span className="font-mono font-semibold">{formatCurrency(summary.inventoryValuation, lang)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1.5">
                    {lang === 'bn' ? 'দায় ও মূলধন (Liabilities & Equity)' : 'Liabilities & Equity'}
                  </h3>
                  <div className="flex justify-between">
                    <span>{lang === 'bn' ? 'মোট দেনা (Payable)' : 'Accounts Payable'}</span>
                    <span className="font-mono font-semibold text-amber-700">
                      {formatCurrency(summary.totalPayable, lang)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'bn' ? 'নিট সম্পদ (Net Worth)' : 'Net Worth'}</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {formatCurrency(
                        summary.handCash +
                          summary.bankBalance +
                          summary.totalReceivable +
                          summary.inventoryValuation -
                          summary.totalPayable,
                        lang
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {group === 'stock' && (
        <div className="space-y-4">
          <div className="flex gap-1.5 no-print">
            {(
              [
                { id: 'stock_summary', bn: 'স্টক সামারি', en: 'Stock Summary' },
                { id: 'stock_change', bn: 'স্টক পরিবর্তন', en: 'Stock Movement' },
                { id: 'item_detailed', bn: 'আইটেম বিস্তারিত', en: 'Item Detailed' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStockSub(s.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  stockSub === s.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {s[lang]}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {stockSub === 'stock_change' ? (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopMovements.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 px-3 font-mono">{m.date}</td>
                      <td className="py-2 px-3">{m.productName}</td>
                      <td className="py-2 px-3 uppercase font-semibold">{m.type}</td>
                      <td className="py-2 px-3 text-right font-mono">{m.quantity}</td>
                      <td className="py-2 px-3 text-slate-600">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-3 text-left">Category</th>
                    <th className="py-2 px-3 text-right">Stock</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="py-2 px-3 text-slate-600">{p.category}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {p.stock} {p.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(p.purchasePrice, lang)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {formatCurrency(p.stock * p.purchasePrice, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {group === 'party' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left">Party</th>
                <th className="py-2 px-3 text-left">Type</th>
                <th className="py-2 px-3 text-left">Phone</th>
                <th className="py-2 px-3 text-right">Due Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shopParties.map((p) => {
                const bal =
                  p.type === 'customer'
                    ? computePartyReceivable(
                        p,
                        state.sales.filter((s) => s.shopId === shopId),
                        state.saleReturns.filter((r) => r.shopId === shopId),
                        state.dueSettlements.filter((d) => d.shopId === shopId)
                      )
                    : computePartyPayable(
                        p,
                        state.purchases.filter((x) => x.shopId === shopId),
                        state.purchaseReturns.filter((r) => r.shopId === shopId),
                        state.dueSettlements.filter((d) => d.shopId === shopId)
                      );
                return (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-medium">{p.name}</td>
                    <td className="py-2 px-3 uppercase">{p.type}</td>
                    <td className="py-2 px-3 font-mono">{p.phone}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(bal, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {group === 'expense' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left">Date</th>
                <th className="py-2 px-3 text-left">Category</th>
                <th className="py-2 px-3 text-left">Note</th>
                <th className="py-2 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shopExpenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 px-3 font-mono">{e.date}</td>
                  <td className="py-2 px-3 font-semibold">{e.category}</td>
                  <td className="py-2 px-3">{e.note}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-600">
                    {formatCurrency(e.amount, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
