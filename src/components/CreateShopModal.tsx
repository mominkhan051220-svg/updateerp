import React, { useState } from 'react';
import { Cloud, Loader2, Lock, Plus, X } from 'lucide-react';
import { Language, Shop } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface CreateShopModalProps {
  lang: Language;
  googleConnected: boolean;
  googleEmail?: string | null;
  onConnectGoogle: () => Promise<string | null>;
  onCreateShop: (shop: Shop, options?: { webhookUrl?: string; securityPin?: string }) => Promise<void>;
  onClose: () => void;
}

export const CreateShopModal: React.FC<CreateShopModalProps> = ({
  lang,
  googleConnected,
  googleEmail,
  onConnectGoogle,
  onCreateShop,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialCapital, setInitialCapital] = useState('0');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [error, setError] = useState('');

  const handleConnectClick = async () => {
    setConnectingGoogle(true);
    setError('');
    try {
      await onConnectGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Google account');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(lang === 'bn' ? 'দোকানের নাম লিখুন।' : 'Please enter a shop name.');
      return;
    }
    if (securityPin.trim() && securityPin.trim().length < 4) {
      setError(
        lang === 'bn'
          ? 'দোকানের সিকিউরিটি পিন কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'Shop security PIN must be at least 4 characters.'
      );
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const slug =
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `shop-${Date.now().toString().slice(-4)}`;

      const newShop: Shop = {
        id: `shop_${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        lastSyncStatus: 'idle',
        printerFormat: 'thermal_80',
        initialCapital: Number(initialCapital) || 0,
        onlineShop: {
          enabled: false,
          slug,
          deliveryCharge: 60,
          whatsappNumber: phone.trim(),
          bannerNote: name.trim(),
        },
        createdAt: new Date().toISOString().slice(0, 10),
      };

      await onCreateShop(newShop, {
        webhookUrl: webhookUrl.trim() || undefined,
        securityPin: securityPin.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'নতুন দোকান তৈরি' : 'Create New Shop'}
    >
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            {lang === 'bn' ? 'নতুন দোকান যোগ ও গুগল শিট তৈরি' : 'Create New Shop & Auto-Create Google Sheet'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create shop modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Cloud className={`w-4 h-4 ${googleConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>
                  {googleConnected
                    ? lang === 'bn'
                      ? `গুগল যুক্ত (${googleEmail || 'Connected'})`
                      : `Google Connected (${googleEmail || 'Active'})`
                    : lang === 'bn'
                    ? 'অটো গুগল শিট তৈরির জন্য গুগল যুক্ত করুন'
                    : 'Connect Google to auto-create a Google Sheet'}
                </span>
              </div>
              <p className="text-slate-500 mt-0.5">
                {googleConnected
                  ? lang === 'bn'
                    ? 'দোকান তৈরি করার সাথে সাথে নতুন গুগল শিট তৈরি হয়ে যুক্ত হবে।'
                    : 'A dedicated Google Sheet will be created and linked automatically.'
                  : lang === 'bn'
                  ? 'যুক্ত না করলে পরে সেটিংস থেকেও গুগল শিট তৈরি করা যাবে।'
                  : 'You can connect now or create the Google Sheet later from Settings.'}
              </p>
            </div>
            {!googleConnected && (
              <GoogleSignInButton
                onClick={() => void handleConnectClick()}
                disabled={connectingGoogle}
                label={
                  connectingGoogle
                    ? lang === 'bn'
                      ? 'যুক্ত হচ্ছে...'
                      : 'Connecting...'
                    : lang === 'bn'
                    ? 'গুগল দিয়ে যুক্ত হন'
                    : 'Sign in with Google'
                }
              />
            )}
          </div>

          <div>
            <label htmlFor="modal-shop-name" className="block text-xs font-semibold text-slate-700 mb-1">
              {lang === 'bn' ? 'দোকানের নাম *' : 'Shop Name *'}
            </label>
            <input
              id="modal-shop-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'bn' ? 'দোকানের নাম লিখুন' : 'Enter shop name'}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="modal-shop-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
              </label>
              <input
                id="modal-shop-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="modal-shop-cap" className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'bn' ? 'প্রারম্ভিক মূলধন' : 'Initial Capital'}
              </label>
              <input
                id="modal-shop-cap"
                type="number"
                min={0}
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modal-shop-addr" className="block text-xs font-semibold text-slate-700 mb-1">
              {lang === 'bn' ? 'ঠিকানা' : 'Address'}
            </label>
            <input
              id="modal-shop-addr"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={lang === 'bn' ? 'দোকানের ঠিকানা' : 'Shop address'}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="modal-shop-pin" className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'bn' ? 'ঐচ্ছিক: দোকানের সিকিউরিটি পিন' : 'Optional: Shop Security PIN'}</span>
                </span>
              </label>
              <input
                id="modal-shop-pin"
                type="password"
                autoComplete="new-password"
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                placeholder={lang === 'bn' ? '৪+ অক্ষরের পিন' : '4+ char PIN'}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label htmlFor="modal-shop-webhook" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn'
                  ? 'ঐচ্ছিক: Apps Script Webhook URL'
                  : 'Optional: Apps Script Webhook URL'}
              </label>
              <input
                id="modal-shop-webhook"
                type="password"
                autoComplete="off"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? lang === 'bn'
                    ? 'তৈরি হচ্ছে...'
                    : 'Creating...'
                  : lang === 'bn'
                  ? 'দোকান তৈরি করুন'
                  : 'Create Shop'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
