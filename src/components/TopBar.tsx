import React from 'react';
import {
  Cloud,
  CloudOff,
  Lock,
  Menu,
  Plus,
  Settings,
  ShoppingBag,
  ShoppingCart,
  UserCircle2,
} from 'lucide-react';
import { Language, MenuKey, Shop, UserAccount } from '../types';
import { canAccessMenu } from '../utils/accounting';
import { MENU_LABELS, UI_TEXT } from '../utils/i18n';

interface TopBarProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  shops: Shop[];
  activeShop: Shop;
  onSelectShop: (shopId: string) => void;
  currentUser: UserAccount;
  activeMenu: MenuKey;
  onNavigate: (menu: MenuKey) => void;
  onOpenUserModal: () => void;
  onOpenMobileMenu: () => void;
  onOpenCreateShop: () => void;
  onLogout: () => void;
  googleConnected: boolean;
  onConnectGoogle: () => Promise<void>;
  syncFeedback?: { status: 'synced' | 'local_only' | 'error'; message: string } | null;
}

export const TopBar: React.FC<TopBarProps> = ({
  lang,
  onChangeLang,
  shops,
  activeShop,
  onSelectShop,
  currentUser,
  activeMenu,
  onNavigate,
  onOpenUserModal,
  onOpenMobileMenu,
  onOpenCreateShop,
  googleConnected,
  onConnectGoogle,
  syncFeedback,
}) => {
  const canPurchase = canAccessMenu(currentUser, 'purchase');
  const canSale = canAccessMenu(currentUser, 'sales');
  const canSettings = canAccessMenu(currentUser, 'settings');
  const isAdmin = currentUser.role === 'admin';
  const hasSheetBound = Boolean(activeShop.spreadsheetId || activeShop.hasWebhookUrl);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-2.5 sm:px-4 lg:px-6 flex items-center justify-between gap-1.5 sm:gap-4 no-print">
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          {isAdmin ? (
            <>
              <label htmlFor="shop-switcher" className="sr-only">
                {lang === 'bn' ? 'দোকান নির্বাচন করুন' : 'Select Shop'}
              </label>
              <select
                id="shop-switcher"
                aria-label={lang === 'bn' ? 'দোকান নির্বাচন করুন' : 'Select Shop'}
                value={activeShop.id}
                onChange={(e) => onSelectShop(e.target.value)}
                className="h-9 w-full min-w-0 max-w-[112px] sm:max-w-[210px] rounded-lg border border-slate-300 bg-slate-50 px-2 sm:px-3 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 truncate"
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onOpenCreateShop}
                aria-label={lang === 'bn' ? 'নতুন দোকান যোগ করুন' : 'Add New Shop'}
                title={lang === 'bn' ? 'নতুন দোকান যোগ করুন' : 'Add New Shop'}
                className="h-9 px-2 sm:px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{lang === 'bn' ? 'নতুন দোকান' : 'Add Shop'}</span>
              </button>
            </>
          ) : (
            <div
              data-testid="locked-shop-badge"
              title={
                lang === 'bn'
                  ? 'স্টাফ ইউজারের জন্য দোকান নির্ধারিত'
                  : 'Shop locked for staff account'
              }
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-slate-200 bg-slate-100 text-xs sm:text-sm font-semibold text-slate-800 max-w-[150px] sm:max-w-[240px] truncate"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{activeShop.name}</span>
            </div>
          )}

          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-slate-500 pl-2 border-l border-slate-200 whitespace-nowrap">
            {hasSheetBound ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {activeShop.lastSyncStatus === 'syncing'
                    ? lang === 'bn'
                      ? 'সিঙ্ক হচ্ছে...'
                      : 'Syncing...'
                    : syncFeedback?.status === 'error' || activeShop.lastSyncStatus === 'error'
                    ? lang === 'bn'
                      ? 'সিঙ্ক ত্রুটি'
                      : 'Sync Error'
                    : lang === 'bn'
                    ? 'গুগল শিট যুক্ত'
                    : 'Sheet Connected'}
                </span>
              </>
            ) : googleConnected ? (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'bn' ? 'শিট যুক্ত নেই' : 'No Sheet Linked'}</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => void onConnectGoogle()}
                    className="text-emerald-700 hover:underline font-medium"
                  >
                    {lang === 'bn' ? 'গুগল শিট যুক্ত করুন' : 'Connect Google Sheets'}
                  </button>
                ) : (
                  <span>{lang === 'bn' ? 'শিট সংযুক্ত নেই' : 'Sheet Pending'}</span>
                )}
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-slate-700 font-medium">{MENU_LABELS[activeMenu][lang]}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div
          className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200"
          role="group"
          aria-label="Language toggle"
        >
          <button
            type="button"
            onClick={() => onChangeLang('bn')}
            className={`px-1.5 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              lang === 'bn' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            BN
          </button>
          <button
            type="button"
            onClick={() => onChangeLang('en')}
            className={`px-1.5 sm:px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              lang === 'en' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>

        {canPurchase && (
          <button
            type="button"
            onClick={() => onNavigate('purchase')}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            <span>{UI_TEXT.buyBtn[lang]}</span>
          </button>
        )}

        {canSale && (
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="inline-flex items-center gap-1.5 h-9 px-2 sm:px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{UI_TEXT.sellBtn[lang]}</span>
          </button>
        )}

        {canSettings && (
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label={UI_TEXT.settings[lang]}
            title={UI_TEXT.settings[lang]}
            className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenUserModal}
          aria-label="User Profile & Switch Account"
          className="inline-flex items-center gap-2 h-9 px-2 sm:px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shrink-0"
        >
          <UserCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="hidden md:inline max-w-[110px] truncate">{currentUser.username}</span>
        </button>
      </div>
    </header>
  );
};

