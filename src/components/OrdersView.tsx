import React, { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import {
  Language,
  LineItem,
  Party,
  Product,
  PurchaseOrder,
  SalesOrder,
} from '../types';
import { formatCurrency } from '../utils/i18n';

interface OrdersViewProps {
  mode: 'sales_order' | 'purchase_order';
  lang: Language;
  shopId: string;
  products: Product[];
  parties: Party[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  onCreateSalesOrder: (order: SalesOrder) => void;
  onConvertSalesOrder: (orderId: string) => void;
  onCreatePurchaseOrder: (order: PurchaseOrder) => void;
  onConvertPurchaseOrder: (orderId: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  mode,
  lang,
  shopId,
  products,
  parties,
  salesOrders,
  purchaseOrders,
  onCreateSalesOrder,
  onConvertSalesOrder,
  onCreatePurchaseOrder,
  onConvertPurchaseOrder,
}) => {
  const isSales = mode === 'sales_order';
  const filteredParties = parties.filter((p) => p.type === (isSales ? 'customer' : 'supplier'));

  const [partyName, setPartyName] = useState(filteredParties[0]?.name ?? '');
  const [partyId, setPartyId] = useState(filteredParties[0]?.id ?? '');
  const [phone, setPhone] = useState(filteredParties[0]?.phone ?? '');
  const [deliveryDate, setDeliveryDate] = useState('2026-11-20');
  const [advancePayment, setAdvancePayment] = useState(0);

  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState<LineItem[]>([]);

  const addItem = () => {
    const p = products.find((x) => x.id === selectedProdId);
    if (!p || qty <= 0) return;
    const price = isSales ? p.sellingPrice : p.purchasePrice;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        unit: p.unit,
        quantity: qty,
        unitPrice: price,
        total: qty * price,
      },
    ]);
  };

  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (isSales) {
      onCreateSalesOrder({
        id: `so_${Date.now()}`,
        shopId,
        orderNo: `SO-${salesOrders.length + 1001}`,
        date: '2026-11-16',
        deliveryDate,
        customerId: partyId || undefined,
        customerName: partyName.trim() || 'Customer',
        customerPhone: phone.trim() || '01700-000000',
        items,
        totalAmount,
        advancePayment,
        status: 'confirmed',
      });
    } else {
      const sup = filteredParties.find((s) => s.id === partyId);
      onCreatePurchaseOrder({
        id: `po_${Date.now()}`,
        shopId,
        orderNo: `PO-${purchaseOrders.length + 2001}`,
        date: '2026-11-16',
        expectedDate: deliveryDate,
        supplierId: partyId,
        supplierName: sup?.name ?? 'Supplier',
        items,
        totalAmount,
        status: 'ordered',
      });
    }
    setItems([]);
    setAdvancePayment(0);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">
        {isSales
          ? lang === 'bn'
            ? 'বিক্রয় অর্ডার ও প্রি-বুকিং (Sales Order)'
            : 'Sales Orders & Pre-Bookings'
          : lang === 'bn'
          ? 'ক্রয় অর্ডার ও রিকুইজিশন (Purchase Order)'
          : 'Purchase Orders & Requisitions'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            {isSales
              ? lang === 'bn'
                ? 'নতুন বিক্রয় অর্ডার এন্ট্রি'
                : 'New Sales Order'
              : lang === 'bn'
              ? 'নতুন ক্রয় অর্ডার তৈরি'
              : 'New Purchase Requisition'}
          </h2>

          {isSales ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ord-cname" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'কাস্টমার নাম' : 'Customer Name'}
                </label>
                <input
                  id="ord-cname"
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  required
                />
              </div>
              <div>
                <label htmlFor="ord-phone" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
                </label>
                <input
                  id="ord-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="ord-sup" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'সাপ্লায়ার' : 'Supplier'}
              </label>
              <select
                id="ord-sup"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              >
                {filteredParties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ord-date" className="block text-xs font-medium text-slate-600 mb-1">
                {isSales
                  ? lang === 'bn'
                    ? 'ডেলিভারি তারিখ'
                    : 'Delivery Date'
                  : lang === 'bn'
                  ? 'সম্ভাব্য তারিখ'
                  : 'Expected Date'}
              </label>
              <input
                id="ord-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            {isSales && (
              <div>
                <label htmlFor="ord-adv" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'অগ্রিম পেমেন্ট' : 'Advance Payment'}
                </label>
                <input
                  id="ord-adv"
                  type="number"
                  min={0}
                  value={advancePayment}
                  onChange={(e) => setAdvancePayment(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="ord-prod" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'পণ্য' : 'Product'}
              </label>
              <select
                id="ord-prod"
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label htmlFor="ord-qty" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'পরিমাণ' : 'Qty'}
              </label>
              <input
                id="ord-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
              />
            </div>
            <button
              type="button"
              onClick={addItem}
              className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              {lang === 'bn' ? 'যোগ' : 'Add'}
            </button>
          </div>

          {items.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>
                    {it.productName} × {it.quantity}
                  </span>
                  <span className="font-mono font-semibold">{formatCurrency(it.total, lang)}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold">
                <span>{lang === 'bn' ? 'মোট' : 'Total'}</span>
                <span className="font-mono">{formatCurrency(totalAmount, lang)}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'অর্ডার সেভ করুন' : 'Save Order'}</span>
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
            {isSales
              ? lang === 'bn'
                ? 'সকল বিক্রয় অর্ডার'
                : 'Sales Orders List'
              : lang === 'bn'
              ? 'সকল ক্রয় অর্ডার'
              : 'Purchase Orders List'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'অর্ডার নং' : 'Order No'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'পার্টি' : 'Party'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'ডেলিভারি' : 'Date'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'মোট' : 'Total'}</th>
                  <th className="px-4 py-2.5 text-left">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="px-4 py-2.5 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isSales
                  ? salesOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-2.5 font-mono font-semibold">{o.orderNo}</td>
                        <td className="px-4 py-2.5">
                          <div>{o.customerName}</div>
                          <div className="text-slate-500">{o.customerPhone}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono">{o.deliveryDate}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {formatCurrency(o.totalAmount, lang)}
                        </td>
                        <td className="px-4 py-2.5 uppercase font-semibold text-emerald-700">{o.status}</td>
                        <td className="px-4 py-2.5 text-right">
                          {o.status !== 'delivered' && (
                            <button
                              type="button"
                              onClick={() => onConvertSalesOrder(o.id)}
                              className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                            >
                              <span>{lang === 'bn' ? 'বিক্রয়ে রূপান্তর' : 'Convert to Sale'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  : purchaseOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-2.5 font-mono font-semibold">{o.orderNo}</td>
                        <td className="px-4 py-2.5">{o.supplierName}</td>
                        <td className="px-4 py-2.5 font-mono">{o.expectedDate}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {formatCurrency(o.totalAmount, lang)}
                        </td>
                        <td className="px-4 py-2.5 uppercase font-semibold text-blue-700">{o.status}</td>
                        <td className="px-4 py-2.5 text-right">
                          {o.status !== 'received' && (
                            <button
                              type="button"
                              onClick={() => onConvertPurchaseOrder(o.id)}
                              className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
                            >
                              <span>{lang === 'bn' ? 'ক্রয়ে রূপান্তর' : 'Receive Bill'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
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
