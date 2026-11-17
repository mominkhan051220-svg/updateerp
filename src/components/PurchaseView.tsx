import React, { useState } from 'react';
import { Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import {
  Language,
  LineItem,
  Party,
  Product,
  PurchaseBill,
  PurchaseReturn,
  Shop,
} from '../types';
import { formatCurrency } from '../utils/i18n';

interface PurchaseViewProps {
  lang: Language;
  shop: Shop;
  products: Product[];
  suppliers: Party[];
  purchases: PurchaseBill[];
  purchaseReturns: PurchaseReturn[];
  onCreatePurchase: (bill: PurchaseBill) => void;
  onQuickAddSupplier: (supplier: Party) => void;
  onCreatePurchaseReturn: (ret: PurchaseReturn) => void;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  lang,
  shop,
  products,
  suppliers,
  purchases,
  purchaseReturns,
  onCreatePurchase,
  onQuickAddSupplier,
  onCreatePurchaseReturn,
}) => {
  const [activeTab, setActiveTab] = useState<'new' | 'list' | 'return'>('new');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');

  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [costPrice, setCostPrice] = useState(products[0]?.purchasePrice ?? 0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'due'>('paid');
  const [purchaseDate, setPurchaseDate] = useState('2026-11-16');
  const [message, setMessage] = useState('');

  const [returnBillNo, setReturnBillNo] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const handleProductChange = (prodId: string) => {
    setSelectedProdId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) setCostPrice(prod.purchasePrice);
  };

  const addItem = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod || qty <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        unit: prod.unit,
        quantity: qty,
        unitPrice: costPrice,
        total: Number((qty * costPrice).toFixed(2)),
      },
    ]);
  };

  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);

  const handleQuickSupplier = () => {
    if (!supName.trim()) return;
    const created: Party = {
      id: `party_${Date.now()}`,
      shopId: shop.id,
      name: supName.trim(),
      phone: supPhone.trim() || '01700-000000',
      address: '',
      type: 'supplier',
      previousDue: 0,
      previousAdvance: 0,
    };
    onQuickAddSupplier(created);
    setSupplierId(created.id);
    setSupName('');
    setSupPhone('');
    setShowAddSupplier(false);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !supplierId) {
      setMessage(lang === 'bn' ? 'সাপ্লায়ার ও পণ্য যোগ করুন।' : 'Select supplier and add items.');
      return;
    }
    const sup = suppliers.find((s) => s.id === supplierId);
    const paidAmount = paymentStatus === 'paid' ? grandTotal : 0;
    const bill: PurchaseBill = {
      id: `pur_${Date.now()}`,
      shopId: shop.id,
      billNo: `PUR-${new Date().getFullYear()}-${purchases.length + 501}`,
      date: purchaseDate,
      supplierId,
      supplierName: sup?.name ?? 'Supplier',
      items,
      grandTotal,
      paidAmount,
      dueAmount: grandTotal - paidAmount,
      paymentStatus,
    };
    onCreatePurchase(bill);
    setItems([]);
    setMessage(lang === 'bn' ? `ক্রয় এন্ট্রি সেভ হয়েছে (${bill.billNo})` : `Purchase saved (${bill.billNo})`);
  };

  const handlePurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const target = purchases.find((p) => p.billNo.toLowerCase() === returnBillNo.trim().toLowerCase());
    if (!target) return;
    onCreatePurchaseReturn({
      id: `pret_${Date.now()}`,
      shopId: shop.id,
      billId: target.id,
      billNo: target.billNo,
      supplierName: target.supplierName,
      date: '2026-11-16',
      items: target.items,
      totalReturnAmount: target.grandTotal,
      reason: returnReason.trim() || 'Supplier Return',
    });
    setReturnBillNo('');
    setReturnReason('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? 'ক্রয় ব্যবস্থাপনা (Purchase)' : 'Purchase Management'}
        </h1>
        <div className="flex flex-wrap sm:inline-flex bg-white border border-slate-200 p-1 rounded-lg gap-1 max-w-full">
          {(
            [
              { id: 'new', bn: 'নতুন ক্রয় এন্ট্রি', en: 'New Purchase' },
              { id: 'list', bn: 'ক্রয় তালিকা', en: 'Purchase List' },
              { id: 'return', bn: 'ক্রয় রিটার্ন', en: 'Purchase Return' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab[lang]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'new' && (
        <form onSubmit={handleSavePurchase} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'পণ্য ও ক্রয়মূল্য যোগ করুন' : 'Add Products to Purchase'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label htmlFor="pur-product" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পণ্যের নাম' : 'Product'}
                </label>
                <select
                  id="pur-product"
                  value={selectedProdId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="pur-price" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'ক্রয়মূল্য' : 'Purchase Price'}
                </label>
                <input
                  id="pur-price"
                  type="number"
                  min={0}
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pur-qty" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পরিমাণ' : 'Qty'}
                </label>
                <input
                  id="pur-qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="w-full h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  {lang === 'bn' ? 'যোগ' : 'Add'}
                </button>
              </div>
            </div>

            <table className="w-full text-xs border-t border-slate-200 mt-2">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="py-2 px-3 text-left">{lang === 'bn' ? 'পণ্য' : 'Product'}</th>
                  <th className="py-2 px-3 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
                  <th className="py-2 px-3 text-right">{lang === 'bn' ? 'দর' : 'Cost'}</th>
                  <th className="py-2 px-3 text-right">{lang === 'bn' ? 'মোট' : 'Total'}</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-medium">{item.productName}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{item.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{item.unitPrice}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(item.total, lang)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                        className="text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="pur-supplier" className="text-xs font-semibold text-slate-700">
                {lang === 'bn' ? 'সাপ্লায়ার নির্বাচন করুন' : 'Select Supplier'}
              </label>
              <button
                type="button"
                onClick={() => setShowAddSupplier((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'নতুন সাপ্লায়ার' : 'New Supplier'}</span>
              </button>
            </div>

            <select
              id="pur-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone})
                </option>
              ))}
            </select>

            {showAddSupplier && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'সাপ্লায়ারের নাম' : 'Supplier Name'}
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? 'মোবাইল' : 'Phone'}
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="flex-1 h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleQuickSupplier}
                    className="px-3 h-8 rounded bg-emerald-600 text-white text-xs font-semibold"
                  >
                    {lang === 'bn' ? 'যোগ' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pur-date" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'তারিখ' : 'Date'}
                </label>
                <input
                  id="pur-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="pur-status" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পেমেন্ট স্ট্যাটাস' : 'Payment Status'}
                </label>
                <select
                  id="pur-status"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'paid' | 'due')}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                >
                  <option value="paid">{lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid'}</option>
                  <option value="due">{lang === 'bn' ? 'বাকি (Due)' : 'Due'}</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-900">
              <span>{lang === 'bn' ? 'মোট ক্রয় খরচ' : 'Total Purchase Cost'}</span>
              <span className="font-mono tabular-nums text-blue-700">{formatCurrency(grandTotal, lang)}</span>
            </div>

            {message && <p className="text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded">{message}</p>}

            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ক্রয় এন্ট্রি সংরক্ষণ করুন' : 'Save Purchase'}</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'list' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'বিল নম্বর' : 'Bill No'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'সাপ্লায়ার' : 'Supplier'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'মোট খরচ' : 'Total Cost'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'বাকি' : 'Due'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'অপশন' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{bill.billNo}</td>
                    <td className="px-4 py-2.5 text-xs">{bill.supplierName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{bill.date}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs font-semibold">
                      {formatCurrency(bill.grandTotal, lang)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs text-amber-700">
                      {formatCurrency(bill.dueAmount, lang)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnBillNo(bill.billNo);
                          setActiveTab('return');
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {lang === 'bn' ? 'রিটার্ন' : 'Return'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'return' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={handlePurchaseReturn} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'ক্রয় রিটার্ন এন্ট্রি' : 'Purchase Return Entry'}
            </h2>
            <div>
              <label htmlFor="pret-bill" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'বিল নম্বর' : 'Bill Number'}
              </label>
              <input
                id="pret-bill"
                type="text"
                value={returnBillNo}
                onChange={(e) => setReturnBillNo(e.target.value)}
                placeholder="PUR-2026-501"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="pret-reason" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'কারণ' : 'Reason'}
              </label>
              <input
                id="pret-reason"
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ক্রয় রিটার্ন করুন' : 'Confirm Purchase Return'}</span>
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'ক্রয় রিটার্ন তালিকা' : 'Purchase Returns'}
            </div>
            <div className="divide-y divide-slate-100">
              {purchaseReturns.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {lang === 'bn' ? 'কোনো ক্রয় রিটার্ন নেই' : 'No purchase returns yet'}
                </div>
              ) : (
                purchaseReturns.map((r) => (
                  <div key={r.id} className="p-4 flex justify-between text-xs">
                    <div>
                      <div className="font-mono font-semibold">{r.billNo}</div>
                      <div className="text-slate-600">{r.supplierName}</div>
                    </div>
                    <div className="font-mono font-semibold">{formatCurrency(r.totalReturnAmount, lang)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
