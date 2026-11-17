import React, { useState } from 'react';
import { AlertTriangle, ArrowDownUp, Edit3, Plus, Search } from 'lucide-react';
import { Language, Product, StockMovement } from '../types';
import { formatCurrency } from '../utils/i18n';

interface ProductsViewProps {
  lang: Language;
  shopId: string;
  products: Product[];
  stockMovements: StockMovement[];
  onSaveProduct: (product: Product, isNew: boolean) => void;
  onAdjustStock: (productId: string, type: 'in' | 'out', qty: number, reason: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  lang,
  shopId,
  products,
  stockMovements,
  onSaveProduct,
  onAdjustStock,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('খাদ্যশস্য / Grocery');
  const [unit, setUnit] = useState<Product['unit']>('Pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stock, setStock] = useState('');
  const [alertLimit, setAlertLimit] = useState('5');

  // Stock In/Out dedicated state
  const [stkProdId, setStkProdId] = useState(products[0]?.id ?? '');
  const [stkType, setStkType] = useState<'in' | 'out'>('in');
  const [stkQty, setStkQty] = useState('');
  const [stkReason, setStkReason] = useState('');

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setBarcode(p.barcode);
    setCategory(p.category);
    setUnit(p.unit);
    setPurchasePrice(String(p.purchasePrice));
    setSellingPrice(String(p.sellingPrice));
    setStock(String(p.stock));
    setAlertLimit(String(p.alertLimit));
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBarcode('');
    setPurchasePrice('');
    setSellingPrice('');
    setStock('');
    setAlertLimit('5');
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const product: Product = {
      id: editingId ?? `prod_${Date.now()}`,
      shopId,
      name: name.trim(),
      barcode: barcode.trim() || String(Math.floor(100000 + Math.random() * 900000)),
      category: category.trim() || 'General',
      unit,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stock: Number(stock) || 0,
      alertLimit: Number(alertLimit) || 5,
      onlineListed: true,
    };
    onSaveProduct(product, !editingId);
    resetForm();
  };

  const handleStockUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = products.find((p) => p.id === stkProdId)?.id ?? products[0]?.id;
    const qty = Number(stkQty);
    if (!targetId || !qty || qty <= 0) return;
    onAdjustStock(targetId, stkType, qty, stkReason.trim() || (stkType === 'in' ? 'Stock In' : 'Stock Out'));
    setStkQty('');
    setStkReason('');
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">
        {lang === 'bn' ? 'পণ্য ও ইনভেন্টরি (Products)' : 'Products & Inventory'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 space-y-4">
          <form onSubmit={handleSaveProduct} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              {editingId
                ? lang === 'bn'
                  ? 'পণ্য সম্পাদনা (Edit Product)'
                  : 'Edit Product'
                : lang === 'bn'
                ? 'নতুন পণ্য যোগ (Add Product)'
                : 'Add New Product'}
            </h2>

            <div>
              <label htmlFor="prod-name" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'পণ্যের নাম (Product Name)' : 'Product Name'}
              </label>
              <input
                id="prod-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="prod-barcode" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'বারকোড / SKU' : 'Barcode'}
                </label>
                <input
                  id="prod-barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="prod-unit" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'ইউনিট (Unit)' : 'Unit'}
                </label>
                <select
                  id="prod-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Product['unit'])}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Kg">Kg</option>
                  <option value="Box">Box</option>
                  <option value="Ltr">Ltr</option>
                  <option value="Dozen">Dozen</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="prod-cat" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
              </label>
              <input
                id="prod-cat"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="prod-buy" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'ক্রয়মূল্য' : 'Purchase Price'}
                </label>
                <input
                  id="prod-buy"
                  type="number"
                  min={0}
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label htmlFor="prod-sell" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'বিক্রয়মূল্য' : 'Selling Price'}
                </label>
                <input
                  id="prod-sell"
                  type="number"
                  min={0}
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="prod-stock" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'প্রারম্ভিক স্টক' : 'Opening Stock'}
                </label>
                <input
                  id="prod-stock"
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label htmlFor="prod-alert" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'অ্যালার্ট স্টক লিমিট' : 'Alert Limit'}
                </label>
                <input
                  id="prod-alert"
                  type="number"
                  min={0}
                  value={alertLimit}
                  onChange={(e) => setAlertLimit(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? (lang === 'bn' ? 'আপডেট' : 'Update') : (lang === 'bn' ? 'পণ্য সেভ' : 'Save Product')}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 h-9 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
              )}
            </div>
          </form>

          {/* Dedicated Stock In / Stock Out panel */}
          <form onSubmit={handleStockUpdate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownUp className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'bn' ? 'স্টক ইন / স্টক আউট আপডেট' : 'Quick Stock In / Out'}</span>
            </h2>
            <select
              aria-label="Select product for stock adjustment"
              value={stkProdId}
              onChange={(e) => setStkProdId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.stock} {p.unit})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2.5">
              <select
                aria-label="Stock adjustment direction"
                value={stkType}
                onChange={(e) => setStkType(e.target.value as 'in' | 'out')}
                className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
              >
                <option value="in">{lang === 'bn' ? 'স্টক ইন (+)' : 'Stock In (+)'}</option>
                <option value="out">{lang === 'bn' ? 'স্টক আউট (-)' : 'Stock Out (-)'}</option>
              </select>
              <input
                type="number"
                min={1}
                placeholder={lang === 'bn' ? 'পরিমাণ' : 'Qty'}
                value={stkQty}
                onChange={(e) => setStkQty(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                required
              />
            </div>
            <input
              type="text"
              placeholder={lang === 'bn' ? 'কারণ (যেমন: ড্যামেজ বা সমন্বয়)' : 'Reason (optional)'}
              value={stkReason}
              onChange={(e) => setStkReason(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              {lang === 'bn' ? 'স্টক আপডেট করুন' : 'Update Stock'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'bn' ? 'পণ্য তালিকা' : 'Product Catalog'} ({filtered.length})
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === 'bn' ? 'পণ্য বা বারকোড খুঁজুন...' : 'Search name or barcode...'}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'পণ্য' : 'Product'}</th>
                    <th className="px-3 py-2.5 text-right">{lang === 'bn' ? 'ক্রয়' : 'Cost'}</th>
                    <th className="px-3 py-2.5 text-right">{lang === 'bn' ? 'বিক্রয়' : 'Sell'}</th>
                    <th className="px-3 py-2.5 text-right">{lang === 'bn' ? 'স্টক' : 'Stock'}</th>
                    <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'সম্পাদনা' : 'Edit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => {
                    const isLow = p.stock <= p.alertLimit;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-slate-500 font-mono">
                            #{p.barcode} · {p.category}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(p.purchasePrice, lang)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">
                          {formatCurrency(p.sellingPrice, lang)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          <span className={isLow ? 'text-amber-700 font-bold inline-flex items-center gap-1' : ''}>
                            {isLow && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            {p.stock} {p.unit}
                          </span>
                          {isLow && (
                            <div className="text-[10px] text-amber-700 font-semibold">
                              {lang === 'bn' ? 'লো-স্টক' : 'Low Stock'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            aria-label={`Edit ${p.name}`}
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'সাম্প্রতিক স্টক পরিবর্তন' : 'Recent Stock Movements'}
            </div>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {stockMovements.map((m) => (
                <div key={m.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{m.productName}</span>
                    <span className="text-slate-500 ml-2">
                      {m.date} · {m.reason}
                    </span>
                  </div>
                  <span className={`font-mono font-bold ${m.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {m.type === 'in' ? `+${m.quantity}` : `-${m.quantity}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
