import React, { useState } from 'react';
import { Building2, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { Language, Shop, UserAccount } from '../types';
import { UI_TEXT } from '../utils/i18n';

interface LoginPageProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  users: UserAccount[];
  shops: Shop[];
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  lang,
  onChangeLang,
  users,
  shops,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!matched) {
      setError(
        lang === 'bn'
          ? 'ভুল ইউজারনেম বা পাসওয়ার্ড দেওয়া হয়েছে।'
          : 'Invalid username or password.'
      );
      return;
    }
    setError('');
    onLoginSuccess(matched);
  };

  const getShopName = (shopId: string) =>
    shops.find((s) => s.id === shopId)?.name ?? (lang === 'bn' ? 'সকল দোকান' : 'All Shops');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              হ
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight text-slate-900 leading-tight">
                {UI_TEXT.appName[lang]}
              </div>
              <div className="text-xs text-slate-500">
                {lang === 'bn' ? 'মাল্টি-শপ বিজনেস অ্যাকাউন্টিং' : 'Multi-Shop Business Accounting'}
              </div>
            </div>
          </div>

          <div
            className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200"
            role="group"
            aria-label="Language toggle"
          >
            <button
              type="button"
              onClick={() => onChangeLang('bn')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                lang === 'bn' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BN
            </button>
            <button
              type="button"
              onClick={() => onChangeLang('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                lang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {lang === 'bn' ? 'অ্যাকাউন্টে লগইন করুন' : 'Sign In to Your Account'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'bn'
                ? 'এডমিন সকল দোকান পরিবর্তন করতে পারবেন। স্টাফ ইউজার কেবল তার নির্ধারিত দোকানে লগইন হবেন।'
                : 'Admins can manage and switch all shops. Staff members sign directly into their assigned shop.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'bn' ? 'ইউজারনেম (Username)' : 'Username'}
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="admin / salesman / karim_staff"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'bn' ? 'পাসওয়ার্ড (Password)' : 'Password'}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-600">
              {lang === 'bn' ? 'ইউজার তালিকা (দ্রুত লগইন ও টেস্ট)' : 'Available Accounts (Quick Login)'}
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onLoginSuccess(u)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-left transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {u.role === 'admin' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">{u.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="font-mono">@{u.username}</span>
                      <span>·</span>
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {u.role === 'admin'
                          ? lang === 'bn'
                            ? 'সকল দোকান (Admin)'
                            : 'All Shops (Admin)'
                          : getShopName(u.assignedShopId)}
                      </span>
                    </div>
                  </div>
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
