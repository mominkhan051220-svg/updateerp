import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Language } from '../types';
import { getEffectiveFirebaseConfig, isLikelyMobileBrowser } from './firebaseAuthProxy';
import { formatGoogleAuthError } from './googleAuthError';

export { formatGoogleAuthError };

export const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const PENDING_REDIRECT_SHOP_KEY = 'hk_pending_google_sheet_shop_id';

const effectiveConfig = getEffectiveFirebaseConfig(
  firebaseConfig,
  typeof window !== 'undefined' ? window.location : undefined
);

const app = getApps().length > 0 ? getApps()[0] : initializeApp(effectiveConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GOOGLE_SHEETS_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'consent select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function canUseSameOriginRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  if (isRunningInIframe()) return false;
  return effectiveConfig.authDomain === window.location.host;
}

export function shouldPreferGoogleRedirect(): boolean {
  if (!canUseSameOriginRedirect() || typeof navigator === 'undefined') return false;
  return isLikelyMobileBrowser(navigator.userAgent || '', navigator.maxTouchPoints || 0);
}

export function setPendingRedirectShopId(shopId?: string): void {
  try {
    if (shopId) {
      sessionStorage.setItem(PENDING_REDIRECT_SHOP_KEY, shopId);
    } else {
      sessionStorage.removeItem(PENDING_REDIRECT_SHOP_KEY);
    }
  } catch {
    // Ignore storage unavailability
  }
}

export function consumePendingRedirectShopId(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_REDIRECT_SHOP_KEY);
    if (id) sessionStorage.removeItem(PENDING_REDIRECT_SHOP_KEY);
    return id;
  } catch {
    return null;
  }
}

export function initGoogleAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthCleared?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      cachedGoogleUser = user;
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      cachedGoogleUser = user;
      onAuthCleared?.();
    }
  });
}

export async function consumeGoogleRedirectResult(
  lang: Language = 'bn'
): Promise<{ user: User; accessToken: string } | null> {
  isSigningIn = true;
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        lang === 'bn'
          ? 'Google Sheets অ্যাক্সেস টোকেন পাওয়া যায়নি। আবার চেষ্টা করে Google Sheets পারমিশন বক্সে টিক দিন।'
          : 'Could not obtain Google Sheets access token. Please try again and check the Sheets permission box.'
      );
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    consumePendingRedirectShopId();
    throw new Error(formatGoogleAuthError(err, lang));
  } finally {
    isSigningIn = false;
  }
}

export type ConnectGoogleResult =
  | { redirected: true }
  | { redirected: false; user: User; accessToken: string };

export async function connectGoogleSheetsAccount(
  lang: Language = 'bn',
  options?: { pendingShopId?: string; forcePopup?: boolean; forceRedirect?: boolean }
): Promise<ConnectGoogleResult> {
  isSigningIn = true;
  try {
    const useRedirect =
      Boolean(options?.forceRedirect && !isRunningInIframe()) ||
      (!options?.forcePopup && shouldPreferGoogleRedirect());

    if (useRedirect) {
      setPendingRedirectShopId(options?.pendingShopId);
      await signInWithRedirect(auth, provider);
      return { redirected: true };
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        lang === 'bn'
          ? 'Google Sheets অ্যাক্সেস টোকেন পাওয়া যায়নি। আবার চেষ্টা করে শীট পারমিশন দিন।'
          : 'Could not obtain Google Sheets access token. Please try again and grant Sheets permission.'
      );
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { redirected: false, user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    consumePendingRedirectShopId();
    throw new Error(formatGoogleAuthError(err, lang));
  } finally {
    isSigningIn = false;
  }
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function getConnectedGoogleUser(): User | null {
  return cachedGoogleUser;
}

export function clearCachedGoogleAuth(): void {
  cachedAccessToken = null;
  cachedGoogleUser = null;
}

export async function disconnectGoogleSheets(): Promise<void> {
  clearCachedGoogleAuth();
  consumePendingRedirectShopId();
  await auth.signOut();
}
