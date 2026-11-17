import React, { useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { CashAdjustment, CashAdjustmentType, Language, Shop } from '../types';
import { formatCurrency } from '../utils/i18n';

interface CashAdjustmentViewProps {
  lang: Language;
  shop: Shop;
  handCash: number;
  adjustments: CashAdjustment[];
  onUpdateInitialCapital: (amount: number) => void;
  onAddAdjustment: (adj: CashAdjustment) => void;
}

export const CashAdjustmentView: React.FC<CashAdjustmentViewProps> = ({
  lang,
  shop,
  handCash,
  adjustments,
  onUpdateInitialCapital,
  onAddAdjustment,
}) => {
  const [initialCap, setInitialCap] = useState(String(shop.initialCapital));
  const [capSaved, setCapSaved] = useState(false);

  const [adjType, setAdjType] = useState<CashAdjustmentType>('investment');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-11-16');
  const [note, setNote] = useState('');

  const handleSaveInitial = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, Number(initialCap) || 0);
    onUpdateInitialCapital(val);
    setCapSaved(true);
    setTimeout(() => setCapSaved(false), 2000);
  };

  const handleAddAdj = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;
    onAddAdjustment({
      id: `ca_${Date.now()}`,
      shopId: shop.id,
      type: adjType,
      amount: num,
      date,
      note:
        note.trim() ||
        (adjType === 'investment' ? 'অতিরিক্ত ক্যাশ ইনভেস্টমেন্ট' : 'ব্যক্তিগত ক্যাশ উত্তোলন'),
    });
    setAmount('');
    setNote('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? 'ক্যাশ মিলাই (Cash Adjustment)' : 'Cash Adjustment & Capital'}
        </h1>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-3">
          <Wallet className="w-4 h-4 text-emerald-600" />
          <span className="text-xs text-slate-500">{lang === 'bn' ? 'বর্তমান হাতে আছে:' : 'Current Hand Cash:'}</span>
          <span className="font-mono tabular-nums font-bold text-emerald-700 text-sm">
            {formatCurrency(handCash, lang)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleSaveInitial} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'প্রারম্ভিক মূলধন (Initial Capital) সেটআপ' : 'Initial Capital Setup'}
            </h2>
            <div>
              <label htmlFor="init-cap" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'মূলধনের পরিমাণ' : 'Initial Capital Amount'}
              </label>
              <div className="flex gap-2">
                <input
                  id="init-cap"
                  type="number"
                  min={0}
                  value={initialCap}
                  onChange={(e) => setInitialCap(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  {lang === 'bn' ? 'আপডেট' : 'Update'}
                </button>
              </div>
              {capSaved && (
                <p className="text-xs text-emerald-700 mt-1.5 font-medium">
                  {lang === 'bn' ? 'প্রারম্ভিক মূলধন আপডেট হয়েছে।' : 'Initial capital updated.'}
                </p>
              )}
            </div>
          </form>

          <form onSubmit={handleAddAdj} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'ক্যাশ ইনভেস্টমেন্ট বা ব্যক্তিগত উত্তোলন' : 'Cash Investment / Withdrawal'}
            </h2>
            <div>
              <label htmlFor="ca-type" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'লেনদেনের ধরন' : 'Adjustment Type'}
              </label>
              <select
                id="ca-type"
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as CashAdjustmentType)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              >
                <option value="investment">
                  {lang === 'bn' ? 'অতিরিক্ত ক্যাশ ইনভেস্টমেন্ট (+)' : 'Additional Cash Investment (+)'}
                </option>
                <option value="withdrawal">
                  {lang === 'bn' ? 'ক্যাশ উইথড্রয়াল / ব্যক্তিগত উত্তোলন (-)' : 'Personal Cash Withdrawal (-)'}
                </option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ca-amount" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পরিমাণ' : 'Amount'}
                </label>
                <input
                  id="ca-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  required
                />
              </div>
              <div>
                <label htmlFor="ca-date" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'তারিখ' : 'Date'}
                </label>
                <input
                  id="ca-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ca-note" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'বিবরণ' : 'Note'}
              </label>
              <input
                id="ca-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? 'এন্ট্রি সেভ করুন' : 'Save Adjustment'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
            {lang === 'bn' ? 'ক্যাশ সমন্বয় ইতিহাস' : 'Cash Adjustment Ledger'}
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'ধরন' : 'Type'}</th>
                <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'নোট' : 'Note'}</th>
                <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{adj.date}</td>
                  <td className="px-4 py-2.5 font-semibold">
                    {adj.type === 'withdrawal' ? (
                      <span className="text-red-600">{lang === 'bn' ? 'উত্তোলন' : 'Withdrawal'}</span>
                    ) : (
                      <span className="text-emerald-700">{lang === 'bn' ? 'বিনিয়োগ' : 'Investment'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{adj.note}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold">
                    {formatCurrency(adj.amount, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
