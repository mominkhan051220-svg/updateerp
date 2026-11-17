import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Cloud,
  CloudOff,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Users,
} from 'lucide-react';
import {
  ALL_MENU_KEYS,
  Language,
  MenuKey,
  PrinterFormat,
  Shop,
  UserAccount,
  UserRole,
} from '../types';
import { FULL_PERMISSIONS, STAFF_DEFAULT_PERMISSIONS } from '../data/seedData';
import { MENU_LABELS } from '../utils/i18n';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '../utils/appsScriptTemplate';
import { testGoogleSheetWebhook } from '../utils/sheetSync';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SettingsViewProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  shops: Shop[];
  activeShop: Shop;
  users: UserAccount[];
  googleConnected: boolean;
  googleEmail?: string | null;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onCreateShop: (shop: Shop) => Promise<void>;
  onUpdateShop: (shop: Shop) => void;
  onCreateSheetForShop: (shop: Shop) => Promise<void>;
  onRestoreShopFromSheet: (shop: Shop) => Promise<void>;
  onCreateUser: (user: UserAccount) => void;
  onUpdateUserPermissions: (
    userId: string,
    permissions: Record<MenuKey, boolean>,
    allowedShopIds: string[],
    assignedShopId?: string
  ) => void;
  onSyncShopNow: (shop: Shop) => Promise<void>;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  onChangeLang,
  shops,
  activeShop,
  users,
  googleConnected,
  googleEmail,
  onConnectGoogle,
  onDisconnectGoogle,
  onCreateShop,
  onUpdateShop,
  onCreateSheetForShop,
  onRestoreShopFromSheet,
  onCreateUser,
  onUpdateUserPermissions,
  onSyncShopNow,
  onResetAllData,
}) => {
  const [tab, setTab] = useState<'shops' | 'users' | 'general'>('shops');

  // New Shop Form
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopWebhook, setShopWebhook] = useState('');
  const [shopCap, setShopCap] = useState('50000');
  const [creatingShop, setCreatingShop] = useState(false);
  const [shopNotice, setShopNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  // Apps Script Modal & Webhook / Sheet operations
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [webhookEdits, setWebhookEdits] = useState<Record<string, string>>({});
  const [testingShopId, setTestingShopId] = useState<string | null>(null);
  const [busyShopId, setBusyShopId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ shopId: string; ok: boolean; msg: string } | null>(null);
  const [restoreConfirmShop, setRestoreConfirmShop] = useState<Shop | null>(null);
  const [restoring, setRestoring] = useState(false);

  // User Management & Granular Permissions
  const [uName, setUName] = useState('');
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<UserRole>('staff');
  const [uAssignedShopId, setUAssignedShopId] = useState<string>(activeShop.id);
  const [uPermissions, setUPermissions] = useState<Record<MenuKey, boolean>>({
    ...STAFF_DEFAULT_PERMISSIONS,
  });
  const [userNotice, setUserNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  // Confirm Reset Dialog
  const [confirmReset, setConfirmReset] = useState(false);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setShopNotice({
        ok: false,
        msg: lang === 'bn' ? 'দোকানের নাম লিখুন।' : 'Please enter a shop name.',
      });
      return;
    }

    setCreatingShop(true);
    setShopNotice(null);
    try {
      const slug =
        shopName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `shop-${Date.now().toString().slice(-4)}`;

      const newShop: Shop = {
        id: `shop_${Date.now()}`,
        name: shopName.trim(),
        phone: shopPhone.trim() || '01700-000000',
        address: shopAddress.trim() || 'Dhaka, Bangladesh',
        webhookUrl: shopWebhook.trim(),
        lastSyncStatus: 'idle',
        printerFormat: 'thermal_80',
        initialCapital: Number(shopCap) || 0,
        onlineShop: {
          enabled: false,
          slug,
          deliveryCharge: 60,
          whatsappNumber: shopPhone.trim(),
          bannerNote: shopName.trim(),
        },
        createdAt: new Date().toISOString().slice(0, 10),
      };
      await onCreateShop(newShop);
      setShopName('');
      setShopPhone('');
      setShopAddress('');
      setShopWebhook('');
      setShopNotice({
        ok: true,
        msg: googleConnected
          ? lang === 'bn'
            ? `"${newShop.name}" তৈরি হয়েছে এবং এর নিজস্ব Google Sheet যুক্ত হয়েছে।`
            : `"${newShop.name}" created with its dedicated Google Sheet.`
          : lang === 'bn'
          ? `"${newShop.name}" সফলভাবে তৈরি হয়েছে।`
          : `"${newShop.name}" created successfully.`,
      });
    } catch (err) {
      setShopNotice({
        ok: false,
        msg: err instanceof Error ? err.message : 'Failed to create shop.',
      });
    } finally {
      setCreatingShop(false);
    }
  };

  const handleTestWebhook = async (shop: Shop) => {
    const url = webhookEdits[shop.id] ?? shop.webhookUrl;
    const updatedShop = { ...shop, webhookUrl: url };
    onUpdateShop(updatedShop);
    setTestingShopId(shop.id);
    const res = await testGoogleSheetWebhook(updatedShop);
    setTestingShopId(null);
    setTestResult({ shopId: shop.id, ok: res.synced, msg: res.message });
  };

  const handleCreateSheet = async (shop: Shop) => {
    setBusyShopId(shop.id);
    setTestResult(null);
    try {
      await onCreateSheetForShop(shop);
      setTestResult({
        shopId: shop.id,
        ok: true,
        msg:
          lang === 'bn'
            ? 'নতুন গুগল শিট তৈরি করে এই দোকানের সাথে যুক্ত ও সিঙ্ক করা হয়েছে।'
            : 'Created, linked, and synced a new Google Sheet for this shop.',
      });
    } catch (err) {
      setTestResult({
        shopId: shop.id,
        ok: false,
        msg: err instanceof Error ? err.message : 'Failed to create Google Sheet.',
      });
    } finally {
      setBusyShopId(null);
    }
  };

  const handleSyncClick = async (shop: Shop) => {
    const currentUrl = webhookEdits[shop.id] ?? shop.webhookUrl;
    setBusyShopId(shop.id);
    setTestResult(null);
    try {
      await onSyncShopNow({ ...shop, webhookUrl: currentUrl.trim() });
      setTestResult({
        shopId: shop.id,
        ok: true,
        msg:
          lang === 'bn'
            ? 'দোকানের ডেটা গুগল শিটে রিয়েল-টাইম সিঙ্ক হয়েছে।'
            : 'Shop data synced to Google Sheet successfully.',
      });
    } catch (err) {
      setTestResult({
        shopId: shop.id,
        ok: false,
        msg: err instanceof Error ? err.message : 'Sync failed.',
      });
    } finally {
      setBusyShopId(null);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmShop) return;
    setRestoring(true);
    try {
      await onRestoreShopFromSheet(restoreConfirmShop);
      setTestResult({
        shopId: restoreConfirmShop.id,
        ok: true,
        msg:
          lang === 'bn'
            ? `"${restoreConfirmShop.name}"-এর ডেটা গুগল শিট থেকে সফলভাবে রিস্টোর হয়েছে।`
            : `Restored "${restoreConfirmShop.name}" data from Google Sheet.`,
      });
      setRestoreConfirmShop(null);
    } catch (err) {
      setTestResult({
        shopId: restoreConfirmShop.id,
        ok: false,
        msg: err instanceof Error ? err.message : 'Restore failed.',
      });
      setRestoreConfirmShop(null);
    } finally {
      setRestoring(false);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = uUsername.trim();
    if (!uName.trim() || !trimmedUsername || !uPassword.trim()) return;

    if (users.some((u) => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
      setUserNotice({
        ok: false,
        msg:
          lang === 'bn'
            ? 'এই ইউজারনেমটি ইতোমধ্যে ব্যবহৃত হয়েছে।'
            : 'Username already exists.',
      });
      return;
    }

    const assignedId = uRole === 'admin' ? shops[0]?.id ?? activeShop.id : uAssignedShopId || activeShop.id;
    const created: UserAccount = {
      id: `user_${Date.now()}`,
      name: uName.trim(),
      username: trimmedUsername,
      password: uPassword,
      role: uRole,
      assignedShopId: assignedId,
      allowedShopIds: uRole === 'admin' ? shops.map((s) => s.id) : [assignedId],
      permissions: uRole === 'admin' ? { ...FULL_PERMISSIONS } : { ...uPermissions },
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onCreateUser(created);
    setUName('');
    setUUsername('');
    setUPassword('');
    const targetShopName = shops.find((s) => s.id === assignedId)?.name ?? assignedId;
    setUserNotice({
      ok: true,
      msg:
        lang === 'bn'
          ? `ইউজার "${created.username}" (${targetShopName}) তৈরি হয়েছে।`
          : `User "${created.username}" assigned to "${targetShopName}" created.`,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          {lang === 'bn' ? 'সেটিংস ও অ্যাক্সেস কন্ট্রোল (Settings)' : 'Settings & Access Control'}
        </h1>
        <div className="flex flex-wrap sm:inline-flex bg-white border border-slate-200 p-1 rounded-lg gap-1 max-w-full">
          <button
            type="button"
            onClick={() => setTab('shops')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'shops' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'দোকান ও গুগল শিট' : 'Shops & Google Sheets'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'users' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'ইউজার ও পারমিশন' : 'Users & Permissions'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('general')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'general' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'অন্যান্য সেটিংস' : 'Printer & Reset'}</span>
          </button>
        </div>
      </div>

      {tab === 'shops' && (
        <div className="space-y-5">
          {/* Google Sheets OAuth Integration Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {googleConnected ? (
                  <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <CloudOff className="w-5 h-5 text-slate-400 shrink-0" />
                )}
                <h2 className="text-sm font-bold text-slate-900">
                  {lang === 'bn'
                    ? 'Google Sheets অটো-সিঙ্ক ও রিস্টোর ইন্টিগ্রেশন'
                    : 'Google Sheets Auto-Create, Real-Time Sync & Restore'}
                </h2>
              </div>
              <p className="text-xs text-slate-600">
                {googleConnected
                  ? lang === 'bn'
                    ? `যুক্ত অ্যাকাউন্ট: ${googleEmail || 'Google Account'} — নতুন দোকান বানালেই অটো গুগল শিট তৈরি হবে এবং প্রতিটি লেনদেন রিয়েল-টাইমে সিঙ্ক হবে।`
                    : `Connected as ${googleEmail || 'Google Account'} — New shops auto-create a dedicated Google Sheet with real-time sync and 1-click restore.`
                  : lang === 'bn'
                  ? 'প্রতিটি দোকানের জন্য অটোমেটিক নতুন গুগল শিট তৈরি, রিয়েল-টাইম সিঙ্ক ও রিস্টোর সুবিধা চালু করতে গুগল অ্যাকাউন্ট যুক্ত করুন।'
                  : 'Connect your Google account to automatically create per-shop Google Sheets, sync in real time, and restore anytime.'}
              </p>
            </div>
            <div className="shrink-0">
              {googleConnected ? (
                <button
                  type="button"
                  onClick={() => void onDisconnectGoogle()}
                  className="h-9 px-3.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  {lang === 'bn' ? 'গুগল ডিসকানেক্ট' : 'Disconnect Google'}
                </button>
              ) : (
                <GoogleSignInButton
                  onClick={() => void onConnectGoogle()}
                  label={lang === 'bn' ? 'গুগল শিট যুক্ত করুন' : 'Sign in with Google'}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form onSubmit={handleAddShop} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit">
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'bn' ? 'নতুন শপ / দোকান যোগ করুন' : 'Add Unlimited Shop'}
              </h2>
              <div>
                <label htmlFor="set-shop-name" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'দোকানের নাম *' : 'Shop Name *'}
                </label>
                <input
                  id="set-shop-name"
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: মদিনা ট্রেডার্স' : 'e.g., Madina Traders'}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="set-shop-phone" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'ফোন' : 'Phone'}
                  </label>
                  <input
                    id="set-shop-phone"
                    type="text"
                    value={shopPhone}
                    onChange={(e) => setShopPhone(e.target.value)}
                    placeholder="01711-000000"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="set-shop-cap" className="block text-xs font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'প্রারম্ভিক মূলধন' : 'Initial Capital'}
                  </label>
                  <input
                    id="set-shop-cap"
                    type="number"
                    min={0}
                    value={shopCap}
                    onChange={(e) => setShopCap(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="set-shop-addr" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'ঠিকানা' : 'Address'}
                </label>
                <input
                  id="set-shop-addr"
                  type="text"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder={lang === 'bn' ? 'দোকানের ঠিকানা' : 'Shop address'}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label htmlFor="set-shop-webhook" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'ঐচ্ছিক: Apps Script Webhook URL' : 'Optional: Apps Script Webhook URL'}
                </label>
                <input
                  id="set-shop-webhook"
                  type="text"
                  value={shopWebhook}
                  onChange={(e) => setShopWebhook(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              {shopNotice && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium ${
                    shopNotice.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {shopNotice.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={creatingShop}
                className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {creatingShop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>
                  {creatingShop
                    ? lang === 'bn'
                      ? 'তৈরি হচ্ছে...'
                      : 'Creating...'
                    : lang === 'bn'
                    ? 'নতুন দোকান যুক্ত করুন'
                    : 'Create Shop'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowScriptModal(true)}
                className="w-full h-9 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Code2 className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'bn' ? 'Google Apps Script কোড দেখুন' : 'View Google Apps Script Code'}</span>
              </button>
            </form>

            <div className="lg:col-span-8 space-y-3">
              {shops.map((s) => {
                const currentUrl = webhookEdits[s.id] ?? s.webhookUrl;
                const isBusy = busyShopId === s.id;
                return (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {s.phone} · {s.address}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.spreadsheetId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Cloud className="w-3 h-3" />
                            <span>
                              {s.lastSyncStatus === 'syncing'
                                ? lang === 'bn'
                                  ? 'সিঙ্ক হচ্ছে...'
                                  : 'Syncing...'
                                : s.lastSyncStatus === 'error'
                                ? lang === 'bn'
                                  ? 'সিঙ্ক ত্রুটি'
                                  : 'Sync Error'
                                : lang === 'bn'
                                ? 'Google Sheet যুক্ত'
                                : 'Google Sheet Linked'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {lang === 'bn' ? 'লোকাল' : 'Local Only'}
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-400">ID: {s.id}</span>
                      </div>
                    </div>

                    {/* Google Sheet Actions Row */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="text-xs min-w-0">
                        {s.spreadsheetUrl ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={s.spreadsheetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'দোকানের Google Sheet খুলুন' : 'Open Shop Google Sheet'}</span>
                            </a>
                            {s.lastSyncedAt && (
                              <span className="text-slate-500 font-mono text-[11px]">
                                ({new Date(s.lastSyncedAt).toLocaleTimeString()})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">
                            {lang === 'bn'
                              ? 'এই দোকানের জন্য এখনো কোনো Google Sheet তৈরি হয়নি।'
                              : 'No dedicated Google Sheet linked to this shop yet.'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!s.spreadsheetId && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleCreateSheet(s)}
                            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            <span>
                              {lang === 'bn' ? 'গুগল শিট তৈরি ও যুক্ত করুন' : 'Create & Link Google Sheet'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSyncClick(s)}
                          className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                          <span>{lang === 'bn' ? 'সিঙ্ক' : 'Sync Now'}</span>
                        </button>

                        {s.spreadsheetId && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setRestoreConfirmShop(s)}
                            className="h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'রিস্টোর (Restore)' : 'Restore from Sheet'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional Apps Script Webhook Row */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <label htmlFor={`wh-${s.id}`} className="block text-[11px] font-medium text-slate-600 mb-1">
                          {lang === 'bn'
                            ? 'ঐচ্ছিক: Apps Script Webhook URL (Cloudflare / Script)'
                            : 'Optional: Apps Script Webhook URL'}
                        </label>
                        <input
                          id={`wh-${s.id}`}
                          type="text"
                          value={currentUrl}
                          onChange={(e) => setWebhookEdits((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateShop({ ...s, webhookUrl: currentUrl.trim() })}
                          className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          {lang === 'bn' ? 'বাইন্ড সেভ' : 'Save URL'}
                        </button>
                        <button
                          type="button"
                          disabled={testingShopId === s.id}
                          onClick={() => handleTestWebhook(s)}
                          className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Database className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{testingShopId === s.id ? '...' : (lang === 'bn' ? 'টেস্ট' : 'Test')}</span>
                        </button>
                      </div>
                    </div>

                    {testResult && testResult.shopId === s.id && (
                      <div
                        className={`text-xs p-2.5 rounded-lg font-medium ${
                          testResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {testResult.msg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleCreateUser} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'নতুন ইউজার ও গ্রানুলার পারমিশন' : 'Create User & Menu Permissions'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="usr-name" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                </label>
                <input
                  id="usr-name"
                  type="text"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  required
                />
              </div>
              <div>
                <label htmlFor="usr-role" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'রোল (Role)' : 'Role'}
                </label>
                <select
                  id="usr-role"
                  value={uRole}
                  onChange={(e) => setURole(e.target.value as UserRole)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                >
                  <option value="staff">{lang === 'bn' ? 'সেলসম্যান / স্টাফ' : 'Salesman / Staff'}</option>
                  <option value="admin">{lang === 'bn' ? 'এডমিন (Admin)' : 'Admin'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="usr-uname" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'ইউজারনেম (Username)' : 'Username'}
                </label>
                <input
                  id="usr-uname"
                  type="text"
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  required
                />
              </div>
              <div>
                <label htmlFor="usr-pass" className="block text-xs font-medium text-slate-600 mb-1">
                  {lang === 'bn' ? 'পাসওয়ার্ড (Password)' : 'Password'}
                </label>
                <input
                  id="usr-pass"
                  type="password"
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  required
                />
              </div>
            </div>

            {uRole === 'staff' && (
              <>
                <div>
                  <label htmlFor="usr-assigned-shop" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn'
                      ? 'নির্ধারিত দোকান (লগইন করলে শুধু এই দোকানে ঢুকবে)'
                      : 'Assigned Shop (User logs directly into this shop)'}
                  </label>
                  <select
                    id="usr-assigned-shop"
                    value={uAssignedShopId}
                    onChange={(e) => setUAssignedShopId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">
                    {lang === 'bn'
                      ? 'মেনু পারমিশন (টিক দেওয়া মেনুগুলো ইউজার দেখতে পারবে)'
                      : 'Menu Permissions (Checked menus only)'}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                    {ALL_MENU_KEYS.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={Boolean(uPermissions[key])}
                          onChange={(e) =>
                            setUPermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                          className="accent-emerald-600"
                        />
                        <span className="truncate">{MENU_LABELS[key][lang]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {userNotice && (
              <p
                className={`text-xs font-medium p-2.5 rounded ${
                  userNotice.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                }`}
              >
                {userNotice.msg}
              </p>
            )}

            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ইউজার তৈরি করুন' : 'Create User'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {users.map((u) => {
              const assignedShop = shops.find((s) => s.id === u.assignedShopId);
              return (
                <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        @{u.username} · {u.role.toUpperCase()}
                        {u.role === 'staff' && assignedShop ? ` · ${assignedShop.name}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">
                      {u.role === 'admin'
                        ? lang === 'bn'
                          ? 'সকল মেনু ও সকল দোকান'
                          : 'All Menus & All Shops'
                        : `${ALL_MENU_KEYS.filter((k) => u.permissions[k]).length} / ${ALL_MENU_KEYS.length} menus`}
                    </span>
                  </div>

                  {u.role === 'staff' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-100">
                        <label
                          htmlFor={`assign-${u.id}`}
                          className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                        >
                          {lang === 'bn' ? 'নির্ধারিত দোকান:' : 'Assigned Shop:'}
                        </label>
                        <select
                          id={`assign-${u.id}`}
                          value={u.assignedShopId}
                          onChange={(e) => {
                            const nextShopId = e.target.value;
                            onUpdateUserPermissions(u.id, u.permissions, [nextShopId], nextShopId);
                          }}
                          className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-medium bg-slate-50"
                        >
                          {shops.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                        {ALL_MENU_KEYS.map((key) => (
                          <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(u.permissions[key])}
                              onChange={(e) =>
                                onUpdateUserPermissions(
                                  u.id,
                                  { ...u.permissions, [key]: e.target.checked },
                                  [u.assignedShopId],
                                  u.assignedShopId
                                )
                              }
                              className="accent-emerald-600"
                            />
                            <span className="truncate">{MENU_LABELS[key][lang]}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'প্রিন্টার ও ভাষা সেটিংস' : 'Printer & Language Settings'}
            </h2>
            <div>
              <label htmlFor="set-printer" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ইনভয়েস প্রিন্টার ফরম্যাট (A4 / Thermal POS)' : 'Invoice Printer Format'}
              </label>
              <select
                id="set-printer"
                value={activeShop.printerFormat}
                onChange={(e) =>
                  onUpdateShop({ ...activeShop, printerFormat: e.target.value as PrinterFormat })
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
              >
                <option value="thermal_80">Thermal POS (80mm)</option>
                <option value="thermal_58">Thermal POS (58mm)</option>
                <option value="a4">Standard A4 Invoice</option>
              </select>
            </div>
            <div>
              <div className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'অ্যাপের ভাষা (Bangla / English)' : 'Interface Language'}
              </div>
              <div className="inline-flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChangeLang('bn')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    lang === 'bn' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  বাংলা (Bangla)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLang('en')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    lang === 'en' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">
              {lang === 'bn' ? 'অ্যাকাউন্ট রিসেট (Reset Data)' : 'Account Reset'}
            </h2>
            <p className="text-xs text-slate-600">
              {lang === 'bn'
                ? 'সকল লোকাল লেনদেন রিসেট করে প্রারম্ভিক ডেমো অবস্থায় ফিরে যেতে নিচের বাটন ব্যবহার করুন।'
                : 'Reset all local transactions and restore initial multi-shop demo data.'}
            </p>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="h-9 px-4 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'অ্যাকাউন্ট রিসেট করুন' : 'Reset Account Data'}</span>
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                <div className="text-xs font-semibold text-red-800">
                  {lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে সব ডেটা রিসেট করতে চান?' : 'Are you sure you want to reset all data?'}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllData();
                      setConfirmReset(false);
                    }}
                    className="h-8 px-3 rounded bg-red-600 text-white text-xs font-semibold"
                  >
                    {lang === 'bn' ? 'হ্যাঁ, রিসেট করুন' : 'Yes, Reset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="h-8 px-3 rounded border border-slate-300 bg-white text-xs font-semibold"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      {restoreConfirmShop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'bn' ? 'রিস্টোর নিশ্চিতকরণ' : 'Confirm Restore from Google Sheet'}
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'bn'
                    ? `"${restoreConfirmShop.name}"-এর ডেটা রিস্টোর করবেন?`
                    : `Restore "${restoreConfirmShop.name}" from Google Sheet?`}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {lang === 'bn'
                    ? 'এই দোকানের লোকাল ডেটা (পণ্য, পার্টি, বিক্রয়, ক্রয়, খরচ ও হিসাব) এর নিজস্ব Google Sheet-এ থাকা সর্বশেষ ব্যাকআপ দিয়ে প্রতিস্থাপন করা হবে।'
                    : 'Local data for this shop (products, parties, sales, purchases, expenses, and accounts) will be replaced with the backup stored in its dedicated Google Sheet.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setRestoreConfirmShop(null)}
                className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={() => void handleConfirmRestore()}
                className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>
                  {restoring
                    ? lang === 'bn'
                      ? 'রিস্টোর হচ্ছে...'
                      : 'Restoring...'
                    : lang === 'bn'
                    ? 'হ্যাঁ, রিস্টোর করুন'
                    : 'Confirm Restore'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showScriptModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Google Apps Script Code"
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'bn'
                  ? 'প্রতিটি দোকানের Google Sheet-এর জন্য Apps Script (Code.gs)'
                  : 'Google Apps Script (Code.gs) for Per-Shop Sheet'}
              </h3>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
            <pre className="p-3.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-80">
              {GOOGLE_APPS_SCRIPT_TEMPLATE}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2000);
                }}
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedScript ? 'Copied!' : 'Copy Code.gs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

