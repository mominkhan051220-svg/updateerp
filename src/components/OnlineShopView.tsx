import React, { useState } from 'react';
import { CheckCircle2, Globe, PackageCheck } from 'lucide-react';
import { Language, OnlineOrder, OnlineShopConfig, Product, Shop } from '../types';
import { formatCurrency } from '../utils/i18n';

interface OnlineShopViewProps {
  lang: Language;
  shop: Shop;
  products: Product[];
  onlineOrders: OnlineOrder[];
  onUpdateOnlineConfig: (config: OnlineShopConfig) => void;
  onToggleProductOnline: (productId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OnlineOrder['status']) => void;
}

export const OnlineShopView: React.FC<OnlineShopViewProps> = ({
  lang,
  shop,
  products,
  onlineOrders,
  onUpdateOnlineConfig,
  onToggleProductOnline,
  onUpdateOrderStatus,
}) => {
  const [tab, setTab] = useState<'orders' | 'sync' | 'settings'>('orders');
  const [config, setConfig] = useState<OnlineShopConfig>(shop.onlineShop);
  const [savedMsg, setSavedMsg] = useState('');

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateOnlineConfig(config);
    setSavedMsg(lang === 'bn' ? 'ই-কমার্স সেটিংস সংরক্ষিত হয়েছে।' : 'Storefront settings saved.');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {lang === 'bn' ? 'অনলাইন শপ (Online Shop)' : 'Online Shop & E-Commerce'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {shop.onlineShop.enabled
                ? lang === 'bn'
                  ? `স্টোর চালু আছে: /store/${shop.onlineShop.slug}`
                  : `Store Live: /store/${shop.onlineShop.slug}`
                : lang === 'bn'
                ? 'অনলাইন স্টোর বর্তমানে বন্ধ রয়েছে'
                : 'Store currently offline'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap sm:inline-flex bg-white border border-slate-200 p-1 rounded-lg gap-1 max-w-full">
          {(
            [
              { id: 'orders', bn: 'অনলাইন অর্ডার', en: 'Orders' },
              { id: 'sync', bn: 'প্রোডাক্ট সিঙ্ক', en: 'Product Sync' },
              { id: 'settings', bn: 'ই-কমার্স সেটিংস', en: 'Store Settings' },
            ] as const
          ).map((tItem) => (
            <button
              key={tItem.id}
              type="button"
              onClick={() => setTab(tItem.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                tab === tItem.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tItem[lang]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
            {lang === 'bn' ? 'অনলাইন অর্ডার ম্যানেজমেন্ট' : 'Online Order Queue'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'অর্ডার নং' : 'Order No'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'ক্রেতা ও ঠিকানা' : 'Customer & Address'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'মোট বিল' : 'Total'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'আপডেট' : 'Update'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {onlineOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {lang === 'bn' ? 'কোনো অনলাইন অর্ডার নেই' : 'No online orders yet'}
                    </td>
                  </tr>
                ) : (
                  onlineOrders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold">{ord.orderNo}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{ord.customerName}</div>
                        <div className="text-slate-500">
                          {ord.customerPhone} · {ord.address}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">
                        {formatCurrency(ord.totalAmount, lang)}
                      </td>
                      <td className="px-4 py-2.5 uppercase font-semibold text-emerald-700">{ord.status}</td>
                      <td className="px-4 py-2.5 text-right">
                        <select
                          aria-label={`Order status for ${ord.orderNo}`}
                          value={ord.status}
                          onChange={(e) =>
                            onUpdateOrderStatus(ord.id, e.target.value as OnlineOrder['status'])
                          }
                          className="h-8 px-2 rounded border border-slate-300 text-xs"
                        >
                          <option value="new">New</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sync' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'অনলাইন শপ প্রোডাক্ট সিঙ্ক' : 'Sync Inventory to Online Store'}
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              {products.filter((p) => p.onlineListed).length} / {products.length} published
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {products.map((prod) => (
              <div key={prod.id} className="px-4 py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{prod.name}</div>
                  <div className="text-slate-500 font-mono">
                    {formatCurrency(prod.sellingPrice, lang)} · Stock: {prod.stock} {prod.unit}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleProductOnline(prod.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                    prod.onlineListed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {prod.onlineListed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PackageCheck className="w-3.5 h-3.5" />}
                  <span>
                    {prod.onlineListed
                      ? lang === 'bn'
                        ? 'অনলাইনে যুক্ত'
                        : 'Published'
                      : lang === 'bn'
                      ? 'অফলাইন'
                      : 'Hidden'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-xl p-5 max-w-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'অনলাইন স্টোর চালু রাখুন' : 'Enable Online Storefront'}
            </span>
            <input
              type="checkbox"
              aria-label="Enable Online Storefront"
              checked={config.enabled}
              onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600"
            />
          </div>
          <div>
            <label htmlFor="on-slug" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'স্টোর URL স্লাগ' : 'Store URL Slug'}
            </label>
            <input
              id="on-slug"
              type="text"
              value={config.slug}
              onChange={(e) => setConfig((c) => ({ ...c, slug: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="on-del" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ডেলিভারি চার্জ' : 'Delivery Charge'}
              </label>
              <input
                id="on-del"
                type="number"
                value={config.deliveryCharge}
                onChange={(e) => setConfig((c) => ({ ...c, deliveryCharge: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="on-wa" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'হোয়াটসঅ্যাপ অর্ডার নম্বর' : 'WhatsApp Number'}
              </label>
              <input
                id="on-wa"
                type="text"
                value={config.whatsappNumber}
                onChange={(e) => setConfig((c) => ({ ...c, whatsappNumber: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="on-banner" className="block text-xs font-medium text-slate-600 mb-1">
              {lang === 'bn' ? 'স্টোর ব্যানার নোট' : 'Store Banner Note'}
            </label>
            <input
              id="on-banner"
              type="text"
              value={config.bannerNote}
              onChange={(e) => setConfig((c) => ({ ...c, bannerNote: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
          </div>
          {savedMsg && <p className="text-xs font-medium text-emerald-700">{savedMsg}</p>}
          <button
            type="submit"
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            {lang === 'bn' ? 'সেটিংস সেভ করুন' : 'Save Store Settings'}
          </button>
        </form>
      )}
    </div>
  );
};
