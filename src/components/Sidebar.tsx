import React from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Globe,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Language, MenuKey, UserAccount } from '../types';
import { MENU_LABELS, UI_TEXT } from '../utils/i18n';
import { canAccessMenu } from '../utils/accounting';

interface SidebarProps {
  lang: Language;
  activeMenu: MenuKey;
  onSelectMenu: (menu: MenuKey) => void;
  currentUser: UserAccount;
  shopName: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

const MENU_ITEMS: Array<{ key: MenuKey; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'sales', icon: ShoppingCart },
  { key: 'purchase', icon: ShoppingBag },
  { key: 'sales_order', icon: ClipboardList },
  { key: 'purchase_order', icon: ClipboardCheck },
  { key: 'due_khata', icon: BookOpen },
  { key: 'expenses', icon: Receipt },
  { key: 'cash_adjustment', icon: Wallet },
  { key: 'bank_transactions', icon: ArrowLeftRight },
  { key: 'online_shop', icon: Globe },
  { key: 'reports', icon: BarChart3 },
  { key: 'products', icon: Package },
  { key: 'parties', icon: Users },
  { key: 'settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  lang,
  activeMenu,
  onSelectMenu,
  currentUser,
  shopName,
  mobileOpen,
  onCloseMobile,
  onLogout,
}) => {
  const visibleItems = MENU_ITEMS.filter((item) => canAccessMenu(currentUser, item.key));

  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 w-64">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-base shrink-0">
            হ
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 whitespace-nowrap truncate">
            {UI_TEXT.appName[lang]}
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate font-medium text-slate-700">{shopName}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" aria-label="Primary Sidebar">
        {visibleItems.map(({ key, icon: Icon }) => {
          const isActive = activeMenu === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectMenu(key);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-emerald-600' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{MENU_LABELS[key][lang]}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 text-xs text-slate-500 space-y-2.5">
        <div>
          <div className="truncate font-medium text-slate-700">{currentUser.name}</div>
          <div className="text-slate-500 mt-0.5">
            {currentUser.role === 'admin'
              ? lang === 'bn'
                ? 'এডমিন (পূর্ণ অ্যাক্সেস)'
                : 'Admin (Full Access)'
              : lang === 'bn'
              ? `স্টাফ (${visibleItems.length}টি মেনু অনুমোদিত)`
              : `Staff (${visibleItems.length} menus allowed)`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onLogout();
          }}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'লগআউট করুন' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 no-print">
        {navContent}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};

