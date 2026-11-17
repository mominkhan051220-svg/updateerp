import React, { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import {
  BankAccount,
  BankTransaction,
  DueSettlement,
  Expense,
  Language,
  SaleInvoice,
} from '../types';
import { computeBankAccountBalance } from '../utils/accounting';
import { formatCurrency } from '../utils/i18n';

interface BankTransactionsViewProps {
  lang: Language;
  shopId: string;
  accounts: BankAccount[];
  transactions: BankTransaction[];
  sales: SaleInvoice[];
  dueSettlements: DueSettlement[];
  expenses: Expense[];
  onAddTransaction: (tx: BankTransaction) => void;
  onAddAccount: (acc: BankAccount) => void;
}

export const BankTransactionsView: React.FC<BankTransactionsViewProps> = ({
  lang,
  shopId,
  accounts,
  transactions,
  sales,
  dueSettlements,
  expenses,
  onAddTransaction,
  onAddAccount,
}) => {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [txType, setTxType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [date, setDate] = useState('2026-11-16');
  const [note, setNote] = useState('');

  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'bkash' | 'nagad' | 'rocket'>('bkash');
  const [newAccNo, setNewAccNo] = useState('');
  const [newAccBal, setNewAccBal] = useState('0');

  const activeAccountId = accounts.find((a) => a.id === accountId)?.id ?? accounts[0]?.id ?? '';

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    const acc = accounts.find((a) => a.id === activeAccountId);
    if (!acc || !num || num <= 0) return;

    onAddTransaction({
      id: `btx_${Date.now()}`,
      shopId,
      accountId: acc.id,
      accountName: acc.name,
      type: txType,
      amount: num,
      referenceId: referenceId.trim() || `TX-${Date.now().toString().slice(-5)}`,
      date,
      note: note.trim() || (txType === 'deposit' ? 'Deposit' : 'Withdraw'),
    });
    setAmount('');
    setReferenceId('');
    setNote('');
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const acc: BankAccount = {
      id: `bank_${Date.now()}`,
      shopId,
      name: newAccName.trim(),
      accountType: newAccType,
      accountNumber: newAccNo.trim() || '-',
      openingBalance: Number(newAccBal) || 0,
    };
    onAddAccount(acc);
    setAccountId(acc.id);
    setNewAccName('');
    setNewAccNo('');
    setNewAccBal('0');
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">
        {lang === 'bn' ? 'ব্যাংক ও মোবাইল ব্যাংকিং লেনদেন' : 'Bank & Mobile Banking Transactions'}
      </h1>

      {/* Account Balance Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const bal = computeBankAccountBalance(acc, sales, dueSettlements, expenses, transactions);
          return (
            <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">{acc.name}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {acc.accountType.toUpperCase()} · {acc.accountNumber}
                </div>
                <div className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-2">
                  {formatCurrency(bal, lang)}
                </div>
              </div>
              <Building2 className="w-6 h-6 text-slate-300" />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleTxSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'জমা বা উত্তোলন এন্ট্রি' : 'Deposit / Withdraw Entry'}
            </h2>
            <div>
              <label htmlFor="btx-acc" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ব্যাংক / বিকাশ / নগদ অ্যাকাউন্ট' : 'Select Account'}
              </label>
              <select
                id="btx-acc"
                value={activeAccountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.accountNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="btx-type" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'লেনদেন ধরন' : 'Type'}
                </label>
                <select
                  id="btx-type"
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as 'deposit' | 'withdraw')}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                >
                  <option value="deposit">{lang === 'bn' ? 'জমা (Deposit)' : 'Deposit'}</option>
                  <option value="withdraw">{lang === 'bn' ? 'উত্তোলন (Withdraw)' : 'Withdraw'}</option>
                </select>
              </div>
              <div>
                <label htmlFor="btx-amt" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পরিমাণ' : 'Amount'}
                </label>
                <input
                  id="btx-amt"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="btx-ref" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'রেফারেন্স / ট্রানজেকশন আইডি' : 'Reference / TxID'}
                </label>
                <input
                  id="btx-ref"
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="TXN-99102"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="btx-date" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'তারিখ' : 'Date'}
                </label>
                <input
                  id="btx-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label htmlFor="btx-note" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'নোট' : 'Note'}
              </label>
              <input
                id="btx-note"
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
              <span>{lang === 'bn' ? 'লেনদেন সেভ করুন' : 'Save Transaction'}</span>
            </button>
          </form>

          <form onSubmit={handleAddAccount} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'নতুন ব্যাংক / মোবাইল অ্যাকাউন্ট যোগ' : 'Add Bank / MFS Account'}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={lang === 'bn' ? 'অ্যাকাউন্ট নাম' : 'Account Name'}
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                required
              />
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as 'bank' | 'bkash' | 'nagad' | 'rocket')}
                className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="rocket">Rocket</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={lang === 'bn' ? 'নম্বর' : 'Account Number'}
                value={newAccNo}
                onChange={(e) => setNewAccNo(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
              <input
                type="number"
                placeholder={lang === 'bn' ? 'প্রারম্ভিক ব্যালেন্স' : 'Opening Balance'}
                value={newAccBal}
                onChange={(e) => setNewAccBal(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full h-9 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
            >
              {lang === 'bn' ? 'অ্যাকাউন্ট যোগ করুন' : 'Add Account'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
            {lang === 'bn' ? 'ব্যাংক লেনদেন ইতিহাস' : 'Bank Transaction Ledger'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'অ্যাকাউন্ট' : 'Account'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'রেফারেন্স' : 'TxID'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'ধরন' : 'Type'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{tx.date}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{tx.accountName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{tx.referenceId}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {tx.type === 'deposit' ? (
                        <span className="text-emerald-700">{lang === 'bn' ? 'জমা' : 'Deposit'}</span>
                      ) : (
                        <span className="text-red-600">{lang === 'bn' ? 'উত্তোলন' : 'Withdraw'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold">
                      {formatCurrency(tx.amount, lang)}
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
