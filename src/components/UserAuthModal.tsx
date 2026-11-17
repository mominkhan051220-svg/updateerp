import React, { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck, UserCheck, X } from 'lucide-react';
import { Language, Shop, UserAccount } from '../types';

interface UserAuthModalProps {
  lang: Language;
  users: UserAccount[];
  shops: Shop[];
  currentUser: UserAccount;
  onLoginUser: (userId: string) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  lang,
  users,
  shops,
  currentUser,
  onLoginUser,
  onLogout,
  onClose,
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
    onLoginUser(matched.id);
    onClose();
  };

  const getShopName = (shopId: string) =>
    shops.find((s) => s.id === shopId)?.name ?? (lang === 'bn' ? 'সকল দোকান' : 'All Shops');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'ইউজার পরিবর্তন ও লগইন' : 'User Profile & Login'}
    >
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            {lang === 'bn' ? 'ইউজার প্রোফাইল ও অ্যাকাউন্ট পরিবর্তন' : 'User Profile & Switch Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">
                {lang === 'bn' ? 'বর্তমান ইউজার' : 'Currently Signed In'}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{currentUser.name}</div>
              <div className="text-xs text-slate-600 mt-0.5 truncate">
                @{currentUser.username} · {currentUser.role.toUpperCase()} ·{' '}
                {currentUser.role === 'admin'
                  ? lang === 'bn'
                    ? 'সকল দোকান'
                    : 'All Shops'
                  : getShopName(currentUser.assignedShopId)}
              </div>
            </div>
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full h-9 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'bn' ? 'সাইন আউট / লগইন পেইজে ফিরুন' : 'Sign Out to Login Page'}</span>
          </button>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-700">
              {lang === 'bn' ? 'পাসওয়ার্ড দিয়ে অন্য ইউজারে লগইন করুন' : 'Sign in with Username & Password'}
            </div>
            <div>
              <label htmlFor="auth-username" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ইউজারনেম (Username)' : 'Username'}
              </label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="admin / salesman / karim_staff"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'পাসওয়ার্ড (Password)' : 'Password'}
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="1234"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">
              {lang === 'bn' ? 'দ্রুত ইউজার সুইচ (ডেমো ও টেস্ট)' : 'Quick Account Switch'}
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      onLoginUser(u.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                      isCurrent
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold truncate">{u.name}</div>
                      <div className="text-slate-500 truncate">
                        @{u.username} · {u.role === 'admin' ? 'Admin' : `Staff (${getShopName(u.assignedShopId)})`}
                      </div>
                    </div>
                    <UserCheck className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

