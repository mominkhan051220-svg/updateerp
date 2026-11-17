import React from 'react';
import { Printer, X } from 'lucide-react';
import { Language, PrinterFormat, SaleInvoice, Shop } from '../types';
import { formatCurrency } from '../utils/i18n';

interface InvoicePrintModalProps {
  lang: Language;
  invoice: SaleInvoice;
  shop: Shop;
  format: PrinterFormat;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  lang,
  invoice,
  shop,
  format,
  onClose,
}) => {
  const isThermal = format !== 'a4';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Invoice Print Preview"
    >
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 no-print">
          <div className="text-sm font-bold text-slate-900">
            {lang === 'bn' ? 'ইনভয়েস প্রিভিউ' : 'Invoice Preview'} ({format.toUpperCase()})
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'প্রিন্ট করুন' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice preview"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 flex justify-center bg-slate-100">
          <div
            className={`bg-white border border-slate-200 p-6 text-slate-900 ${
              isThermal ? (format === 'thermal_58' ? 'w-[280px] text-xs' : 'w-[340px] text-xs') : 'w-full text-sm'
            }`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="font-bold text-base">{shop.name}</div>
              <div className="text-slate-600 text-xs mt-0.5">{shop.address}</div>
              <div className="text-slate-600 text-xs">{shop.phone}</div>
            </div>

            <div className="flex justify-between text-xs mb-3">
              <div>
                <div>
                  <span className="text-slate-500">{lang === 'bn' ? 'ইনভয়েস:' : 'Invoice:'}</span>{' '}
                  <span className="font-mono font-semibold">{invoice.invoiceNo}</span>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'bn' ? 'ক্রেতা:' : 'Customer:'}</span>{' '}
                  <span className="font-medium">{invoice.customerName}</span>
                </div>
              </div>
              <div className="text-right font-mono">
                <div>{invoice.date}</div>
                <div className="uppercase">{invoice.paymentMethod}</div>
              </div>
            </div>

            <table className="w-full border-collapse mb-3">
              <thead>
                <tr className="border-y border-slate-300 text-xs text-slate-600">
                  <th className="py-1.5 text-left">{lang === 'bn' ? 'পণ্য' : 'Item'}</th>
                  <th className="py-1.5 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
                  <th className="py-1.5 text-right">{lang === 'bn' ? 'দর' : 'Rate'}</th>
                  <th className="py-1.5 text-right">{lang === 'bn' ? 'মোট' : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">{item.productName}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{item.unitPrice}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums font-medium">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-xs border-t border-slate-300 pt-2">
              <div className="flex justify-between">
                <span className="text-slate-600">{lang === 'bn' ? 'সাব-টোটাল' : 'Subtotal'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(invoice.subtotal, lang)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'} ({invoice.discountPercent}%)
                  </span>
                  <span className="font-mono tabular-nums">-{formatCurrency(invoice.discountAmount, lang)}</span>
                </div>
              )}
              {invoice.vatAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {lang === 'bn' ? 'ভ্যাট/ট্যাক্স' : 'VAT/Tax'} ({invoice.vatPercent}%)
                  </span>
                  <span className="font-mono tabular-nums">+{formatCurrency(invoice.vatAmount, lang)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-slate-200 pt-1.5">
                <span>{lang === 'bn' ? 'সর্বমোট' : 'Grand Total'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(invoice.grandTotal, lang)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(invoice.paidAmount, lang)}</span>
              </div>
              <div className="flex justify-between font-semibold text-red-600">
                <span>{lang === 'bn' ? 'বাকি' : 'Due'}</span>
                <span className="font-mono tabular-nums">{formatCurrency(invoice.dueAmount, lang)}</span>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-500 mt-4 pt-3 border-t border-dashed border-slate-300">
              {lang === 'bn' ? 'ধন্যবাদ, আবার আসবেন!' : 'Thank you for your business!'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
