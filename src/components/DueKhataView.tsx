import React, { useMemo, useState } from 'react';
import { Check, Copy, MessageSquare, Plus, X } from 'lucide-react';
import {
  BankAccount,
  DueSettlement,
  Language,
  Party,
  PurchaseBill,
  PurchaseReturn,
  SaleInvoice,
  SaleReturn,
  Shop,
} from '../types';
import { computePartyPayable, computePartyReceivable } from '../utils/accounting';
import { formatCurrency } from '../utils/i18n';

interface DueKhataViewProps {
  lang: Language;
  shop: Shop;
  parties: Party[];
  sales: SaleInvoice[];
  saleReturns: SaleReturn[];
  purchases: PurchaseBill[];
  purchaseReturns: PurchaseReturn[];
  dueSettlements: DueSettlement[];
  bankAccounts: BankAccount[];
  onSettleDue: (settlement: DueSettlement) => void;
}

export const DueKhataView: React.FC<DueKhataViewProps> = ({
  lang,
  shop,
  parties,
  sales,
  saleReturns,
  purchases,
  purchaseReturns,
  dueSettlements,
  bankAccounts,
  onSettleDue,
}) => {
  const [tab, setTab] = useState<'receivable' | 'payable'>('receivable');

  const customers = useMemo(
    () =>
      parties
        .filter((p) => p.type === 'customer')
        .map((p) => ({
          party: p,
          balance: computePartyReceivable(p, sales, saleReturns, dueSettlements),
        })),
    [parties, sales, saleReturns, dueSettlements]
  );

  const suppliers = useMemo(
    () =>
      parties
        .filter((p) => p.type === 'supplier')
        .map((p) => ({
          party: p,
          balance: computePartyPayable(p, purchases, purchaseReturns, dueSettlements),
        })),
    [parties, purchases, purchaseReturns, dueSettlements]
  );

  const activeList = tab === 'receivable' ? customers : suppliers;
  const [selectedPartyId, setSelectedPartyId] = useState<string>(activeList[0]?.party.id ?? '');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');

  // SMS reminder modal state
  const [smsParty, setSmsParty] = useState<{ party: Party; balance: number } | null>(null);
  const [copiedSms, setCopiedSms] = useState(false);

  const effectivePartyId =
    activeList.find((x) => x.party.id === selectedPartyId)?.party.id ?? activeList[0]?.party.id ?? '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    const chosen = activeList.find((x) => x.party.id === effectivePartyId);
    if (!chosen || !numericAmount || numericAmount <= 0) return;

    onSettleDue({
      id: `due_${Date.now()}`,
      shopId: shop.id,
      partyId: chosen.party.id,
      partyName: chosen.party.name,
      partyType: chosen.party.type,
      amount: numericAmount,
      method,
      bankAccountId: method === 'bank' ? bankAccountId : undefined,
      date: '2026-11-16',
      note: note.trim() || (tab === 'receivable' ? 'বাকি আদায়' : 'দেনা পরিশোধ'),
    });
    setAmount('');
    setNote('');
    setFeedback(
      lang === 'bn'
        ? `${chosen.party.name}-এর ${formatCurrency(numericAmount, lang)} সমন্বয় হয়েছে।`
        : `Recorded ${formatCurrency(numericAmount, lang)} for ${chosen.party.name}.`
    );
  };

  const buildSmsText = (p: Party, bal: number) =>
    lang === 'bn'
      ? `প্রিয় ${p.name}, ${shop.name}-এ আপনার বর্তমান বকেয়া ${formatCurrency(bal, lang)}। অনুগ্রহ করে সুবিধামত সময়ে পরিশোধ করুন। ধন্যবাদ। (${shop.phone})`
      : `Dear ${p.name}, your current due at ${shop.name} is ${formatCurrency(bal, lang)}. Please settle at your convenience. Thank you. (${shop.phone})`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? 'বাকির হিসাব (Due Khata)' : 'Due Khata (Receivable & Payable)'}
        </h1>

        <div className="flex flex-wrap sm:inline-flex bg-white border border-slate-200 p-1 rounded-lg gap-1 max-w-full">
          <button
            type="button"
            onClick={() => {
              setTab('receivable');
              setFeedback('');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              tab === 'receivable' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {lang === 'bn' ? 'কাস্টমার বকেয়া (পাওনা)' : 'Customer Receivable'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('payable');
              setFeedback('');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              tab === 'payable' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {lang === 'bn' ? 'সাপ্লায়ার বকেয়া (দেনা)' : 'Supplier Payable'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handleSubmit} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            {tab === 'receivable'
              ? lang === 'bn'
                ? 'বাকি আদায় ফর্ম'
                : 'Collect Customer Due'
              : lang === 'bn'
              ? 'সাপ্লায়ার দেনা পরিশোধ'
              : 'Pay Supplier Due'}
          </h2>

          <div>
            <label htmlFor="due-party" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'পার্টি সিলেক্ট করুন' : 'Select Party'}
            </label>
            <select
              id="due-party"
              value={effectivePartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              {activeList.map(({ party, balance }) => (
                <option key={party.id} value={party.id}>
                  {party.name} ({formatCurrency(balance, lang)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="due-amount" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'পরিশোধের পরিমাণ' : 'Amount'}
            </label>
            <input
              id="due-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              required
            />
          </div>

          <div>
            <label htmlFor="due-method" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'মাধ্যম' : 'Payment Method'}
            </label>
            <select
              id="due-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'bank')}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              <option value="cash">{lang === 'bn' ? 'নগদ (Cash)' : 'Cash'}</option>
              <option value="bank">{lang === 'bn' ? 'ব্যাংক / মোবাইল ব্যাংকিং' : 'Bank / Mobile'}</option>
            </select>
          </div>

          {method === 'bank' && (
            <div>
              <label htmlFor="due-bank" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'অ্যাকাউন্ট' : 'Account'}
              </label>
              <select
                id="due-bank"
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
            </div>
          )}

          <div>
            <label htmlFor="due-note" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'নোট' : 'Note'}
            </label>
            <input
              id="due-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          {feedback && <p className="text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded">{feedback}</p>}

          <button
            type="submit"
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{tab === 'receivable' ? (lang === 'bn' ? 'বাকি আদায় সেভ করুন' : 'Save Collection') : (lang === 'bn' ? 'পরিশোধ সেভ করুন' : 'Save Payment')}</span>
          </button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                {tab === 'receivable'
                  ? lang === 'bn'
                    ? 'কাস্টমারদের বকেয়া তালিকা (পাওনা)'
                    : 'Customer Receivables'
                  : lang === 'bn'
                  ? 'সাপ্লায়ারদের বকেয়া তালিকা (দেনা)'
                  : 'Supplier Payables'}
              </h2>
              <span className="font-mono text-xs font-bold text-slate-800">
                {formatCurrency(
                  activeList.reduce((s, x) => s + x.balance, 0),
                  lang
                )}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'পার্টির নাম' : 'Party Name'}</th>
                    <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'মোবাইল' : 'Phone'}</th>
                    <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'মোট বাকি' : 'Due Balance'}</th>
                    <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'রিমাইন্ডার' : 'Reminder'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeList.map(({ party, balance }) => (
                    <tr key={party.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{party.name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{party.phone}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold ${
                          tab === 'receivable' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {formatCurrency(balance, lang)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSmsParty({ party, balance });
                            setCopiedSms(false);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          <MessageSquare className="w-3 h-3 text-emerald-600" />
                          <span>{lang === 'bn' ? 'SMS পাঠান' : 'Send SMS'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'সাম্প্রতিক বাকি লেনদেন' : 'Recent Due Settlements'}
            </div>
            <div className="divide-y divide-slate-100">
              {dueSettlements.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  {lang === 'bn' ? 'কোনো লেনদেন নেই' : 'No settlements yet'}
                </div>
              ) : (
                dueSettlements.map((d) => (
                  <div key={d.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{d.partyName}</div>
                      <div className="text-slate-500">
                        {d.date} · {d.method.toUpperCase()} · {d.note}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-bold text-emerald-700">
                      {formatCurrency(d.amount, lang)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {smsParty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Due Reminder SMS"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'bn' ? 'বাকি রিমাইন্ডার SMS' : 'Due Reminder SMS'}
              </h3>
              <button
                type="button"
                onClick={() => setSmsParty(null)}
                aria-label="Close SMS dialog"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600">
              {lang === 'bn' ? 'প্রাপক:' : 'Recipient:'} <span className="font-semibold">{smsParty.party.name}</span> (
              {smsParty.party.phone})
            </div>
            <textarea
              readOnly
              rows={4}
              value={buildSmsText(smsParty.party, smsParty.balance)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(buildSmsText(smsParty.party, smsParty.balance));
                  setCopiedSms(true);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiedSms ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSms ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'মেসেজ কপি' : 'Copy SMS')}</span>
              </button>
              <a
                href={`sms:${smsParty.party.phone}?body=${encodeURIComponent(
                  buildSmsText(smsParty.party, smsParty.balance)
                )}`}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'SMS অ্যাপে পাঠান' : 'Open SMS App'}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
