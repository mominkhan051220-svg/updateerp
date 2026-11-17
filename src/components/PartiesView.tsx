import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  DueSettlement,
  Language,
  Party,
  PartyType,
  PurchaseBill,
  PurchaseReturn,
  SaleInvoice,
  SaleReturn,
} from '../types';
import { computePartyPayable, computePartyReceivable } from '../utils/accounting';
import { formatCurrency } from '../utils/i18n';

interface PartiesViewProps {
  lang: Language;
  shopId: string;
  parties: Party[];
  sales: SaleInvoice[];
  saleReturns: SaleReturn[];
  purchases: PurchaseBill[];
  purchaseReturns: PurchaseReturn[];
  dueSettlements: DueSettlement[];
  onSaveParty: (party: Party) => void;
}

export const PartiesView: React.FC<PartiesViewProps> = ({
  lang,
  shopId,
  parties,
  sales,
  saleReturns,
  purchases,
  purchaseReturns,
  dueSettlements,
  onSaveParty,
}) => {
  const [filterType, setFilterType] = useState<'all' | PartyType>('all');
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<PartyType>('customer');
  const [previousDue, setPreviousDue] = useState('0');
  const [previousAdvance, setPreviousAdvance] = useState('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveParty({
      id: `party_${Date.now()}`,
      shopId,
      name: name.trim(),
      phone: phone.trim() || '01700-000000',
      address: address.trim(),
      type,
      previousDue: type === 'customer' ? Number(previousDue) || 0 : 0,
      previousAdvance: type === 'supplier' ? Number(previousAdvance) || 0 : 0,
    });
    setName('');
    setPhone('');
    setAddress('');
    setPreviousDue('0');
    setPreviousAdvance('0');
  };

  const visible = parties.filter(
    (p) =>
      (filterType === 'all' || p.type === filterType) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search))
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">
        {lang === 'bn' ? 'পার্টি সমূহ (Customers & Suppliers)' : 'Parties (Customers & Suppliers)'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handleSubmit} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            {lang === 'bn' ? 'নতুন পার্টি যোগ করুন' : 'Add Customer / Supplier'}
          </h2>
          <div>
            <label htmlFor="pty-type" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'পার্টি টাইপ' : 'Party Type'}
            </label>
            <select
              id="pty-type"
              value={type}
              onChange={(e) => setType(e.target.value as PartyType)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              <option value="customer">{lang === 'bn' ? 'কাস্টমার (Customer)' : 'Customer'}</option>
              <option value="supplier">{lang === 'bn' ? 'সাপ্লায়ার (Supplier)' : 'Supplier'}</option>
            </select>
          </div>
          <div>
            <label htmlFor="pty-name" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'পার্টির নাম' : 'Name'}
            </label>
            <input
              id="pty-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              required
            />
          </div>
          <div>
            <label htmlFor="pty-phone" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
            </label>
            <input
              id="pty-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              required
            />
          </div>
          <div>
            <label htmlFor="pty-address" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'ঠিকানা' : 'Address'}
            </label>
            <input
              id="pty-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          {type === 'customer' ? (
            <div>
              <label htmlFor="pty-prev-due" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'আগের পাওনা (Previous Due)' : 'Previous Due'}
              </label>
              <input
                id="pty-prev-due"
                type="number"
                min={0}
                value={previousDue}
                onChange={(e) => setPreviousDue(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="pty-prev-adv" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'আগের দেনা (Previous Payable)' : 'Previous Payable / Advance'}
              </label>
              <input
                id="pty-prev-adv"
                type="number"
                min={0}
                value={previousAdvance}
                onChange={(e) => setPreviousAdvance(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'পার্টি সংরক্ষণ করুন' : 'Save Party'}</span>
          </button>
        </form>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
              {(
                [
                  { id: 'all', bn: 'সবাই', en: 'All' },
                  { id: 'customer', bn: 'কাস্টমার', en: 'Customers' },
                  { id: 'supplier', bn: 'সাপ্লায়ার', en: 'Suppliers' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterType(t.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    filterType === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {t[lang]}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === 'bn' ? 'নাম বা ফোন...' : 'Name or phone...'}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'নাম ও ঠিকানা' : 'Name & Address'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'টাইপ' : 'Type'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'মোবাইল' : 'Phone'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Balance'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => {
                  const balance =
                    p.type === 'customer'
                      ? computePartyReceivable(p, sales, saleReturns, dueSettlements)
                      : computePartyPayable(p, purchases, purchaseReturns, dueSettlements);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-slate-500">{p.address || '-'}</div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold uppercase">
                        <span className={p.type === 'customer' ? 'text-emerald-700' : 'text-blue-700'}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono">{p.phone}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">
                        {formatCurrency(balance, lang)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
