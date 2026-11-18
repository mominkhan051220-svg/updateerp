import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { AppState, Language, UserAccount } from '../types';
import { UI_TEXT } from '../utils/i18n';

interface LoginPageProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  onLoginSuccess: (payload: {
    user: UserAccount;
    state: AppState;
    unlockedShopIds: string[];
  }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  lang,
  onChangeLang,
  onLoginSuccess,
}) => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          username: emailOrUsername.trim(),
          password,
        }),
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
          res.status >= 500 || res.status === 429
            ? data.message ||
              (lang === 'bn'
                ? 'সাময়িক ত্রুটি হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
                : 'Server error or rate limit reached. Please try again.')
            : lang === 'bn'
            ? 'ভুল ইমেল বা পাসওয়ার্ড দেওয়া হয়েছে।'
            : 'Invalid email or password.'
        );
        return;
      }

      setPassword('');
      onLoginSuccess({
        user: data.user,
        state: data.state,
        unlockedShopIds: data.unlockedShopIds ?? [],
      });
    } catch {
      setError(
        lang === 'bn'
          ? 'সার্ভারের সাথে সংযোগ করা যায়নি। আবার চেষ্টা করুন।'
          : 'Unable to reach authentication server.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              হ
            </div>
            <div className="font-bold text-lg tracking-tight text-slate-900">
              {UI_TEXT.appName[lang]}
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
          <h1 className="text-lg font-bold text-slate-900">
            {lang === 'bn' ? 'লগইন করুন' : 'Sign In'}
          </h1>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'bn' ? 'ইমেল ঠিকানা (Email)' : 'Email'}
              </label>
              <input
                id="login-email"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={emailOrUsername}
                onChange={(e) => {
                  setEmailOrUsername(e.target.value);
                  setError('');
                }}
                placeholder="name@example.com"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
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
              disabled={submitting}
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
