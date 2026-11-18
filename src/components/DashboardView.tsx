import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building,
  ChevronRight,
  Package,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AppState, DateRange, Language, MenuKey, TimeframeFilter } from '../types';
import { computeDashboardSummary, getDateRangeForFilter } from '../utils/accounting';
import { formatCurrency, UI_TEXT } from '../utils/i18n';

interface DashboardViewProps {
  lang: Language;
  state: AppState;
  shopId: string;
  onNavigate: (menu: MenuKey) => void;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  state,
  shopId,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<TimeframeFilter>('month');
  const [customRange, setCustomRange] = useState<DateRange>({
    start: `${TODAY_ISO.slice(0, 8)}01`,
    end: TODAY_ISO,
  });

  const activeRange = useMemo(
    () => getDateRangeForFilter(filter, TODAY_ISO, customRange),
    [filter, customRange]
  );

  const summary = useMemo(
    () => computeDashboardSummary(state, shopId, activeRange),
    [state, shopId, activeRange]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {lang === 'bn' ? 'ব্যবসার সারসংক্ষেপ' : 'Business Overview'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            {activeRange.start} — {activeRange.end}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center bg-white border border-slate-200 p-1 rounded-lg"
            role="group"
            aria-label="Timeframe filter"
          >
            {(
              [
                { id: 'today', label: UI_TEXT.today[lang] },
                { id: 'week', label: UI_TEXT.thisWeek[lang] },
                { id: 'month', label: UI_TEXT.thisMonth[lang] },
                { id: 'custom', label: UI_TEXT.customRange[lang] },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  filter === opt.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              <input
                type="date"
                aria-label="Start date"
                value={customRange.start}
                onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                className="text-xs text-slate-700 font-mono focus:outline-none"
              />
              <span className="text-slate-400 text-xs">–</span>
              <input
                type="date"
                aria-label="End date"
                value={customRange.end}
                onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                className="text-xs text-slate-700 font-mono focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">{UI_TEXT.cashIn[lang]}</div>
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1.5">
              {formatCurrency(summary.cashIn, lang)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'bn' ? 'নির্বাচিত সময়সীমায় প্রাপ্তি' : 'Cash inflow in selected period'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">{UI_TEXT.cashOut[lang]}</div>
            <div className="text-2xl font-bold text-red-600 font-mono tabular-nums mt-1.5">
              {formatCurrency(summary.cashOut, lang)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'bn' ? 'নির্বাচিত সময়সীমায় প্রদান' : 'Cash outflow in selected period'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('due_khata')}
          className="bg-white border border-slate-200 hover:border-emerald-400 rounded-xl p-5 flex items-start justify-between text-left transition-colors group"
        >
          <div>
            <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <span>{UI_TEXT.totalReceivable[lang]}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {formatCurrency(summary.totalReceivable, lang)}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-1">
              {lang === 'bn' ? 'বাকির খাতায় যান' : 'Open Due Khata'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('due_khata')}
          className="bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-5 flex items-start justify-between text-left transition-colors group"
        >
          <div>
            <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <span>{UI_TEXT.totalPayable[lang]}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1.5">
              {formatCurrency(summary.totalPayable, lang)}
            </div>
            <div className="text-xs text-amber-700 font-medium mt-1">
              {lang === 'bn' ? 'সাপ্লায়ার দেনা দেখুন' : 'View Supplier Payables'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">{UI_TEXT.handCash[lang]}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {formatCurrency(summary.handCash, lang)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'bn' ? 'বর্তমান নগদ ক্যাশ ব্যালেন্স' : 'Available cash in drawer'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">{UI_TEXT.bankBalance[lang]}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {formatCurrency(summary.bankBalance, lang)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {lang === 'bn' ? 'ব্যাংক ও মোবাইল ব্যাংকিং' : 'Bank & Mobile Banking'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Total Expense + Inventory Valuation Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">{UI_TEXT.totalExpense[lang]}</div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {formatCurrency(summary.totalExpense, lang)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {lang === 'bn' ? 'অপারেটিং খরচ ও বিল সমূহ' : 'Operating expenses & bills'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0"
          >
            {UI_TEXT.viewAll[lang]}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">{UI_TEXT.stockSummary[lang]}</div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {formatCurrency(summary.inventoryValuation, lang)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="font-mono tabular-nums">
                  {summary.totalStockUnits} {lang === 'bn' ? 'ইউনিট মজুদ' : 'units in stock'}
                </span>
                <span aria-hidden="true">·</span>
                <span className={summary.lowStockCount > 0 ? 'text-amber-700 font-semibold' : ''}>
                  {summary.lowStockCount} {UI_TEXT.lowStockItems[lang]}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('products')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0"
          >
            {UI_TEXT.viewAll[lang]}
          </button>
        </div>
      </div>

      {/* Top Selling & Lowest Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">{UI_TEXT.topSelling[lang]}</h2>
            <span className="text-xs text-emerald-700 font-medium">
              {lang === 'bn' ? 'বিক্রিত পরিমাণ অনুযায়ী' : 'By units sold'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">{lang === 'bn' ? 'পণ্য' : 'Product'}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{lang === 'bn' ? 'বিক্রিত' : 'Sold'}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{lang === 'bn' ? 'বিক্রয় মূল্য' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.topSellingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-xs text-slate-500">
                      {UI_TEXT.noData[lang]}
                    </td>
                  </tr>
                ) : (
                  summary.topSellingProducts.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-800 font-medium">{item.productName}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {item.quantitySold}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(item.revenue, lang)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">{UI_TEXT.lowestSelling[lang]}</h2>
            <span className="text-xs text-slate-500 font-medium">
              {lang === 'bn' ? 'ধীরগতির পণ্য' : 'Slow moving items'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">{lang === 'bn' ? 'পণ্য' : 'Product'}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{lang === 'bn' ? 'বিক্রিত' : 'Sold'}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{lang === 'bn' ? 'বর্তমান স্টক' : 'Stock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.lowestSellingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-xs text-slate-500">
                      {UI_TEXT.noData[lang]}
                    </td>
                  </tr>
                ) : (
                  summary.lowestSellingProducts.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 text-slate-800 font-medium">{item.productName}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {item.quantitySold}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {item.stock}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
