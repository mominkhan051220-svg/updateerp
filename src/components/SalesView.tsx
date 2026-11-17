import React, { useMemo, useState } from 'react';
import { Download, Plus, Printer, RotateCcw, Search, Trash2, UserPlus } from 'lucide-react';
import {
  BankAccount,
  Language,
  LineItem,
  Party,
  PaymentMethod,
  Product,
  SaleInvoice,
  SaleReturn,
  Shop,
} from '../types';
import { calculateInvoiceTotals, generateCsvContent } from '../utils/accounting';
import { formatCurrency } from '../utils/i18n';
import { InvoicePrintModal } from './InvoicePrintModal';

interface SalesViewProps {
  lang: Language;
  shop: Shop;
  products: Product[];
  customers: Party[];
  bankAccounts: BankAccount[];
  sales: SaleInvoice[];
  saleReturns: SaleReturn[];
  onCreateSale: (sale: SaleInvoice) => void;
  onQuickAddCustomer: (customer: Party) => void;
  onCreateSaleReturn: (ret: SaleReturn) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  lang,
  shop,
  products,
  customers,
  bankAccounts,
  sales,
  saleReturns,
  onCreateSale,
  onQuickAddCustomer,
  onCreateSaleReturn,
}) => {
  const [activeTab, setActiveTab] = useState<'new' | 'list' | 'return'>('new');

  // POS / New Sale state
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id ?? '');
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [productQuery, setProductQuery] = useState('');
  const [cart, setCart] = useState<LineItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [vatPercent, setVatPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [bankAccountId, setBankAccountId] = useState<string>(bankAccounts[0]?.id ?? '');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>('2026-11-16');
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // List & Print
  const [listSearch, setListSearch] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState<SaleInvoice | null>(null);

  // Sales Return state
  const [returnInvoiceNo, setReturnInvoiceNo] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState<'cash' | 'due_adjust'>('cash');
  const [returnMessage, setReturnMessage] = useState<string>('');

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  }, [products, productQuery]);

  const effectiveTotals = useMemo(() => {
    const rawPaid =
      paymentMethod === 'due'
        ? 0
        : paidAmountInput === ''
        ? cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        : Number(paidAmountInput) || 0;
    return calculateInvoiceTotals(cart, discountPercent, vatPercent, rawPaid);
  }, [cart, discountPercent, vatPercent, paymentMethod, paidAmountInput]);

  const addProductToCart = (product: Product) => {
    setFormMessage(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 1,
          unitPrice: product.sellingPrice,
          total: product.sellingPrice,
        },
      ];
    });
  };

  const updateCartItem = (productId: string, field: 'quantity' | 'unitPrice', value: number) => {
    const safeVal = Math.max(0, value);
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const qty = field === 'quantity' ? Math.max(1, safeVal) : item.quantity;
        const price = field === 'unitPrice' ? safeVal : item.unitPrice;
        return { ...item, quantity: qty, unitPrice: price, total: Number((qty * price).toFixed(2)) };
      })
    );
  };

  const handleQuickCustomerSave = () => {
    if (!newCustomerName.trim()) return;
    const created: Party = {
      id: `party_${Date.now()}`,
      shopId: shop.id,
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || '01700-000000',
      address: '',
      type: 'customer',
      previousDue: 0,
      previousAdvance: 0,
    };
    onQuickAddCustomer(created);
    setCustomerId(created.id);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowQuickCustomer(false);
  };

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setFormMessage({
        type: 'error',
        text: lang === 'bn' ? 'অন্তত একটি পণ্য যোগ করুন।' : 'Please add at least one product.',
      });
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === customerId) ?? {
      id: 'walk_in',
      name: lang === 'bn' ? 'নগদ ক্রেতা (Walk-in)' : 'Walk-in Customer',
    };

    const rawPaid =
      paymentMethod === 'due'
        ? 0
        : paidAmountInput === ''
        ? effectiveTotals.grandTotal
        : Math.min(effectiveTotals.grandTotal, Math.max(0, Number(paidAmountInput) || 0));

    const finalTotals = calculateInvoiceTotals(cart, discountPercent, vatPercent, rawPaid);

    const newSale: SaleInvoice = {
      id: `sale_${Date.now()}`,
      shopId: shop.id,
      invoiceNo: `INV-${new Date().getFullYear()}-${String(sales.length + 101)}`,
      date: saleDate,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      items: cart,
      subtotal: finalTotals.subtotal,
      discountPercent,
      discountAmount: finalTotals.discountAmount,
      vatPercent,
      vatAmount: finalTotals.vatAmount,
      grandTotal: finalTotals.grandTotal,
      paidAmount: Number((finalTotals.grandTotal - finalTotals.dueAmount).toFixed(2)),
      dueAmount: finalTotals.dueAmount,
      paymentMethod,
      bankAccountId: paymentMethod === 'mobile_banking' || paymentMethod === 'bank' ? bankAccountId : undefined,
      status: finalTotals.status,
    };

    onCreateSale(newSale);
    setPreviewInvoice(newSale);
    setCart([]);
    setDiscountPercent(0);
    setVatPercent(0);
    setPaidAmountInput('');
    setFormMessage({
      type: 'success',
      text:
        lang === 'bn'
          ? `বিক্রয় সম্পন্ন হয়েছে (${newSale.invoiceNo})`
          : `Sale saved (${newSale.invoiceNo})`,
    });
  };

  const handleDownloadInvoiceCsv = (inv: SaleInvoice) => {
    const csv = generateCsvContent(
      ['Invoice No', 'Date', 'Customer', 'Product', 'Qty', 'Price', 'Total', 'Paid', 'Due'],
      inv.items.map((i) => [
        inv.invoiceNo,
        inv.date,
        inv.customerName,
        i.productName,
        i.quantity,
        i.unitPrice,
        i.total,
        inv.paidAmount,
        inv.dueAmount,
      ])
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoiceNo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchedReturnInvoice = sales.find(
    (s) => s.invoiceNo.toLowerCase() === returnInvoiceNo.trim().toLowerCase()
  );

  const handleProcessReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedReturnInvoice) {
      setReturnMessage(
        lang === 'bn' ? 'সঠিক ইনভয়েস নম্বর পাওয়া যায়নি।' : 'Invoice number not found.'
      );
      return;
    }

    const ret: SaleReturn = {
      id: `sret_${Date.now()}`,
      shopId: shop.id,
      invoiceId: matchedReturnInvoice.id,
      invoiceNo: matchedReturnInvoice.invoiceNo,
      customerName: matchedReturnInvoice.customerName,
      date: '2026-11-16',
      items: matchedReturnInvoice.items,
      totalReturnAmount: matchedReturnInvoice.grandTotal,
      refundMethod: returnRefundMethod,
      reason: returnReason.trim() || 'Customer Return',
    };
    onCreateSaleReturn(ret);
    setReturnInvoiceNo('');
    setReturnReason('');
    setReturnMessage(
      lang === 'bn'
        ? `${matchedReturnInvoice.invoiceNo} রিটার্ন সফলভাবে সম্পন্ন হয়েছে ও স্টক আপডেট হয়েছে।`
        : `Return processed for ${matchedReturnInvoice.invoiceNo} and stock restored.`
    );
  };

  const filteredSales = sales.filter(
    (s) =>
      s.invoiceNo.toLowerCase().includes(listSearch.toLowerCase()) ||
      s.customerName.toLowerCase().includes(listSearch.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? 'বিক্রয় ব্যবস্থাপনা (Sales & POS)' : 'Sales & POS Management'}
        </h1>
        <div className="flex flex-wrap sm:inline-flex bg-white border border-slate-200 p-1 rounded-lg gap-1 max-w-full">
          {(
            [
              { id: 'new', bn: 'নতুন বিক্রয় (POS)', en: 'New Sale (POS)' },
              { id: 'list', bn: 'বিক্রয় তালিকা', en: 'Sales List' },
              { id: 'return', bn: 'বিক্রয় রিটার্ন', en: 'Sales Return' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab[lang]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'new' && (
        <form onSubmit={handleSaveSale} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Product search + Cart */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <label htmlFor="pos-product-search" className="block text-xs font-semibold text-slate-700">
                {lang === 'bn' ? 'পণ্যের বারকোড বা নাম দিয়ে খুঁজুন' : 'Search Product by Barcode or Name'}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="pos-product-search"
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={lang === 'bn' ? 'বারকোড বা পণ্যের নাম লিখুন...' : 'Type barcode or product name...'}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {matchingProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToCart(product)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold text-slate-800 truncate">{product.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        #{product.barcode} · {lang === 'bn' ? 'স্টক' : 'Stock'}: {product.stock} {product.unit}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-emerald-700 font-mono tabular-nums shrink-0">
                      {formatCurrency(product.sellingPrice, lang)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  {lang === 'bn' ? 'বিক্রয় কার্ট (আইটেম তালিকা)' : 'Sale Cart Items'}
                </h2>
                <span className="text-xs text-slate-500 font-mono">{cart.length} items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left">{lang === 'bn' ? 'পণ্য' : 'Product'}</th>
                      <th className="px-3 py-2 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
                      <th className="px-3 py-2 text-right">{lang === 'bn' ? 'বিক্রয়মূল্য' : 'Price'}</th>
                      <th className="px-4 py-2 text-right">{lang === 'bn' ? 'মোট' : 'Total'}</th>
                      <th className="px-2 py-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                          {lang === 'bn'
                            ? 'উপর থেকে পণ্য সিলেক্ট করে বিক্রয় শুরু করুন'
                            : 'Select products above to add to invoice'}
                        </td>
                      </tr>
                    ) : (
                      cart.map((item) => (
                        <tr key={item.productId}>
                          <td className="px-4 py-2 text-xs font-medium text-slate-800">{item.productName}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              aria-label={`Quantity for ${item.productName}`}
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.productId, 'quantity', Number(e.target.value))}
                              className="w-16 h-8 px-2 text-right rounded border border-slate-300 text-xs font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              aria-label={`Price for ${item.productName}`}
                              value={item.unitPrice}
                              onChange={(e) => updateCartItem(item.productId, 'unitPrice', Number(e.target.value))}
                              className="w-24 h-8 px-2 text-right rounded border border-slate-300 text-xs font-mono tabular-nums"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-xs font-semibold">
                            {formatCurrency(item.total, lang)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              aria-label={`Remove ${item.productName}`}
                              onClick={() => setCart((p) => p.filter((x) => x.productId !== item.productId))}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Customer & Payment Summary */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="sale-customer" className="text-xs font-semibold text-slate-700">
                  {lang === 'bn' ? 'কাস্টমার নির্বাচন করুন' : 'Select Customer'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomer((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'নতুন কাস্টমার' : 'New Customer'}</span>
                </button>
              </div>

              <select
                id="sale-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm"
              >
                <option value="walk_in">
                  {lang === 'bn' ? 'নগদ ক্রেতা (Walk-in)' : 'Walk-in Customer'}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>

              {showQuickCustomer && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? 'কাস্টমারের নাম' : 'Customer Name'}
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="flex-1 h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleQuickCustomerSave}
                      className="px-3 h-8 rounded bg-emerald-600 text-white text-xs font-semibold"
                    >
                      {lang === 'bn' ? 'যোগ করুন' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sale-date" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'তারিখ' : 'Date'}
                  </label>
                  <input
                    id="sale-date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="sale-payment-method" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                  </label>
                  <select
                    id="sale-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                  >
                    <option value="cash">{lang === 'bn' ? 'নগদ (Cash)' : 'Cash'}</option>
                    <option value="mobile_banking">
                      {lang === 'bn' ? 'মোবাইল ব্যাংকিং' : 'Mobile Banking'}
                    </option>
                    <option value="due">{lang === 'bn' ? 'বাকি (Due)' : 'Due'}</option>
                  </select>
                </div>
              </div>

              {(paymentMethod === 'mobile_banking' || paymentMethod === 'bank') && (
                <div>
                  <label htmlFor="sale-bank" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'ব্যাংক / বিকাশ অ্যাকাউন্ট' : 'Select Account'}
                  </label>
                  <select
                    id="sale-bank"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.accountNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sale-discount" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'ডিসকাউন্ট (%)' : 'Discount (%)'}
                  </label>
                  <input
                    id="sale-discount"
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="sale-vat" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'ভ্যাট / ট্যাক্স (%)' : 'VAT / Tax (%)'}
                  </label>
                  <input
                    id="sale-vat"
                    type="number"
                    min={0}
                    max={100}
                    value={vatPercent}
                    onChange={(e) => setVatPercent(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              {paymentMethod !== 'due' && (
                <div>
                  <label htmlFor="sale-paid" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'নগদ জমা / পরিশোধিত টাকা' : 'Paid Amount'}
                  </label>
                  <input
                    id="sale-paid"
                    type="number"
                    min={0}
                    placeholder={String(effectiveTotals.grandTotal)}
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'সাব-টোটাল' : 'Subtotal'}</span>
                  <span className="font-mono tabular-nums">{formatCurrency(effectiveTotals.subtotal, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'}</span>
                  <span className="font-mono tabular-nums">-{formatCurrency(effectiveTotals.discountAmount, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'ভ্যাট/ট্যাক্স' : 'VAT/Tax'}</span>
                  <span className="font-mono tabular-nums">+{formatCurrency(effectiveTotals.vatAmount, lang)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>{lang === 'bn' ? 'সর্বমোট বিল' : 'Grand Total'}</span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    {formatCurrency(effectiveTotals.grandTotal, lang)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>{lang === 'bn' ? 'বাকি থাকবে' : 'Due Amount'}</span>
                  <span className="font-mono tabular-nums">{formatCurrency(effectiveTotals.dueAmount, lang)}</span>
                </div>
              </div>

              {formMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium ${
                    formMessage.type === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {formMessage.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'বিক্রয় সম্পন্ন ও ইনভয়েস সেভ' : 'Complete Sale & Save Invoice'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'list' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'সকল বিক্রয় তালিকা' : 'Sales Invoice List'}
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder={lang === 'bn' ? 'ইনভয়েস বা কাস্টমার...' : 'Invoice or customer...'}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'ইনভয়েস নং' : 'Invoice No'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'কাস্টমার' : 'Customer'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'মোট বিল' : 'Total'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'বাকি' : 'Due'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">{inv.invoiceNo}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{inv.date}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-800">{inv.customerName}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs font-semibold">
                      {formatCurrency(inv.grandTotal, lang)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs text-red-600">
                      {formatCurrency(inv.dueAmount, lang)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span
                        className={`font-semibold ${
                          inv.status === 'paid'
                            ? 'text-emerald-700'
                            : inv.status === 'partial'
                            ? 'text-amber-700'
                            : 'text-red-600'
                        }`}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          aria-label={`Print ${inv.invoiceNo}`}
                          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoiceCsv(inv)}
                          aria-label={`Download ${inv.invoiceNo}`}
                          className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
          <form onSubmit={handleProcessReturn} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'ইনভয়েস নম্বর দিয়ে পণ্য রিটার্ন' : 'Process Sales Return by Invoice'}
            </h2>
            <div>
              <label htmlFor="return-inv-no" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ইনভয়েস নম্বর' : 'Invoice Number'}
              </label>
              <input
                id="return-inv-no"
                type="text"
                value={returnInvoiceNo}
                onChange={(e) => setReturnInvoiceNo(e.target.value)}
                placeholder="INV-2026-101"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono"
                required
              />
            </div>

            {matchedReturnInvoice && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-900">{matchedReturnInvoice.customerName}</div>
                <div className="text-slate-600">
                  {matchedReturnInvoice.items.length} items · {formatCurrency(matchedReturnInvoice.grandTotal, lang)}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="return-refund-method" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'রিফান্ড মাধ্যম' : 'Refund Method'}
              </label>
              <select
                id="return-refund-method"
                value={returnRefundMethod}
                onChange={(e) => setReturnRefundMethod(e.target.value as 'cash' | 'due_adjust')}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              >
                <option value="cash">{lang === 'bn' ? 'নগদ ফেরত (Cash Refund)' : 'Cash Refund'}</option>
                <option value="due_adjust">{lang === 'bn' ? 'বাকি সমন্বয় (Adjust Due)' : 'Adjust Due'}</option>
              </select>
            </div>

            <div>
              <label htmlFor="return-reason" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'রিটার্নের কারণ' : 'Return Reason'}
              </label>
              <input
                id="return-reason"
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: পণ্য ক্ষতিগ্রস্ত বা পরিবর্তন' : 'e.g., Damaged or exchange'}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            {returnMessage && (
              <p className="text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded-lg">{returnMessage}</p>
            )}

            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'রিটার্ন নিশ্চিত করুন' : 'Confirm Sales Return'}</span>
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'রিটার্ন ইতিহাস' : 'Sales Return History'}
            </div>
            <div className="divide-y divide-slate-100">
              {saleReturns.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {lang === 'bn' ? 'এখনো কোনো বিক্রয় রিটার্ন নেই' : 'No sales returns yet'}
                </div>
              ) : (
                saleReturns.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-semibold text-slate-900">{r.invoiceNo}</div>
                      <div className="text-slate-600">{r.customerName} · {r.reason}</div>
                    </div>
                    <div className="font-mono font-bold text-red-600">
                      {formatCurrency(r.totalReturnAmount, lang)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {previewInvoice && (
        <InvoicePrintModal
          lang={lang}
          invoice={previewInvoice}
          shop={shop}
          format={shop.printerFormat}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
};
