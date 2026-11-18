import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, LogOut, ShieldCheck, X } from 'lucide-react';
import { AppState, Language, Shop, UserAccount } from '../types';

interface UserAuthModalProps {
  lang: Language;
  shops: Shop[];
  currentUser: UserAccount;
  onLoginSuccess: (payload: {
    user: UserAccount;
    state: AppState;
    unlockedShopIds: string[];
  }) => void;
  onLogout: () => Promise<void>;
  onClose: () => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  lang,
  shops,
  currentUser,
  onLoginSuccess,
  onLogout,
  onClose,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatingPw, setUpdatingPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSwitching(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = (await res.json()) as {
        authenticated?: boolean;
        user?: UserAccount;
        state?: AppState;
        unlockedShopIds?: string[];
        message?: string;
      };

      if (!res.ok || !data.authenticated || !data.user || !data.state) {
        setError(
          data.message ||
            (lang === 'bn' ? 'ভুল ইমেল বা পাসওয়ার্ড দেওয়া হয়েছে।' : 'Invalid email or password.')
        );
        return;
      }

      setPassword('');
      onLoginSuccess({
        user: data.user,
        state: data.state,
        unlockedShopIds: data.unlockedShopIds ?? [],
      });
      onClose();
    } catch {
      setError(lang === 'bn' ? 'লগইন করা যায়নি।' : 'Authentication request failed.');
    } finally {
      setSwitching(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setUpdatingPw(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = (await res.json()) as { status?: string; message?: string };
      if (!res.ok) {
        setPwMsg({
          ok: false,
          text:
            data.message ||
            (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করা যায়নি।' : 'Could not update password.'),
        });
        return;
      }
      setCurrentPw('');
      setNewPw('');
      setPwMsg({
        ok: true,
        text:
          lang === 'bn'
            ? 'পাসওয়ার্ড নিরাপদভাবে পরিবর্তন হয়েছে।'
            : 'Password updated securely.',
      });
    } catch {
      setPwMsg({
        ok: false,
        text: lang === 'bn' ? 'নেটওয়ার্ক ত্রুটি।' : 'Network error.',
      });
    } finally {
      setUpdatingPw(false);
    }
  };

  const getShopName = (shopId: string) =>
    shops.find((s) => s.id === shopId)?.name ?? (lang === 'bn' ? 'সকল দোকান' : 'All Shops');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'ইউজার প্রোফাইল ও লগইন' : 'User Profile & Login'}
    >
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md overflow-hidden shadow-xl my-auto">
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

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">
                {lang === 'bn' ? 'বর্তমান ইউজার' : 'Currently Signed In'}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{currentUser.name}</div>
              <div className="text-xs text-slate-600 mt-0.5 truncate">
                {currentUser.username} · {currentUser.role.toUpperCase()} ·{' '}
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
              void onLogout();
            }}
            className="w-full h-9 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'bn' ? 'সাইন আউট / লগইন পেইজে ফিরুন' : 'Sign Out to Login Page'}</span>
          </button>

          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-2.5 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change Password'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                aria-label={lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder={lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                required
              />
              <input
                type="password"
                aria-label={lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড (৮+ অক্ষর)' : 'New Password (8+ chars)'}
                minLength={8}
                className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                required
              />
            </div>
            {pwMsg && (
              <p className={`text-xs font-medium ${pwMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {pwMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={updatingPw}
              className="h-8 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-60"
            >
              {updatingPw
                ? lang === 'bn'
                  ? 'আপডেট হচ্ছে...'
                  : 'Updating...'
                : lang === 'bn'
                ? 'পাসওয়ার্ড আপডেট করুন'
                : 'Update Password'}
            </button>
          </form>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-700">
              {lang === 'bn' ? 'অন্য অ্যাকাউন্টে লগইন করুন' : 'Sign in to Another Account'}
            </div>
            <div>
              <label htmlFor="auth-username" className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'bn' ? 'ইমেল / ইউজারনেম (Email / Username)' : 'Email / Username'}
              </label>
              <input
                id="auth-username"
                type="text"
                inputMode="email"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="name@example.com"
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
                placeholder="••••••••"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={switching}
              className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
