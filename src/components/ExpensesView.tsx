import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BankAccount, Expense, ExpenseCategory, Language } from '../types';
import { formatCurrency } from '../utils/i18n';

interface ExpensesViewProps {
  lang: Language;
  shopId: string;
  expenses: Expense[];
  bankAccounts: BankAccount[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; bn: string; en: string }> = [
  { value: 'Shop Rent', bn: 'দোকান ভাড়া', en: 'Shop Rent' },
  { value: 'Electricity Bill', bn: 'বিদ্যুৎ বিল', en: 'Electricity Bill' },
  { value: 'Transport', bn: 'যাতায়াত ও পরিবহন', en: 'Transport' },
  { value: 'Staff Salary', bn: 'কর্মচারী বেতন', en: 'Staff Salary' },
  { value: 'Hospitality', bn: 'আপ্যায়ন', en: 'Hospitality' },
  { value: 'Maintenance', bn: 'মেরামত', en: 'Maintenance' },
  { value: 'Other', bn: 'অন্যান্য', en: 'Other' },
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  lang,
  shopId,
  expenses,
  bankAccounts,
  onAddExpense,
  onDeleteExpense,
}) => {
  const [category, setCategory] = useState<ExpenseCategory>('Shop Rent');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-11-16');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;
    onAddExpense({
      id: `exp_${Date.now()}`,
      shopId,
      category,
      amount: num,
      date,
      paymentMethod,
      bankAccountId: paymentMethod === 'bank' ? bankAccountId : undefined,
      note: note.trim() || category,
    });
    setAmount('');
    setNote('');
  };

  const visibleExpenses = expenses.filter((e) => filterCat === 'all' || e.category === filterCat);
  const totalFiltered = visibleExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">
        {lang === 'bn' ? 'খরচ ব্যবস্থাপনা (Expenses)' : 'Expense Management'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handleSubmit} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            {lang === 'bn' ? 'নতুন খরচ এন্ট্রি' : 'Add New Expense'}
          </h2>

          <div>
            <label htmlFor="exp-cat" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'খরচ খাতের ক্যাটাগরি' : 'Expense Category'}
            </label>
            <select
              id="exp-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c[lang]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'পরিমাণ' : 'Amount'}
              </label>
              <input
                id="exp-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                required
              />
            </div>
            <div>
              <label htmlFor="exp-date" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'তারিখ' : 'Date'}
              </label>
              <input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="exp-method" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
            </label>
            <select
              id="exp-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'bank')}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              <option value="cash">{lang === 'bn' ? 'নগদ ক্যাশ' : 'Cash'}</option>
              <option value="bank">{lang === 'bn' ? 'ব্যাংক / মোবাইল' : 'Bank / Mobile'}</option>
            </select>
          </div>

          {paymentMethod === 'bank' && (
            <select
              aria-label="Bank account"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <div>
            <label htmlFor="exp-note" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'নোট / বিবরণ' : 'Note / Description'}
            </label>
            <input
              id="exp-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={lang === 'bn' ? 'বিস্তারিত লিখুন...' : 'Expense details...'}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'খরচ সেভ করুন' : 'Save Expense'}</span>
          </button>
        </form>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'bn' ? 'খরচের তালিকা' : 'Expense History'}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {lang === 'bn' ? 'মোট:' : 'Total:'} {formatCurrency(totalFiltered, lang)}
              </p>
            </div>

            <select
              aria-label="Filter expenses by category"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs"
            >
              <option value="all">{lang === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c[lang]}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'বিবরণ' : 'Note'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                  <th className="px-4 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-600">{exp.date}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{exp.category}</td>
                    <td className="px-4 py-2.5 text-slate-600">{exp.note}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-red-600">
                      {formatCurrency(exp.amount, lang)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        aria-label={`Delete expense ${exp.note}`}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
