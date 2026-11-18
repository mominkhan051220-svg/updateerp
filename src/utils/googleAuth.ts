import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Language } from '../types';
import { formatGoogleAuthError } from './googleAuthError';

export { formatGoogleAuthError };

export const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GOOGLE_SHEETS_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'consent select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

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

export async function connectGoogleSheetsAccount(
  lang: Language = 'bn'
): Promise<{ user: User; accessToken: string }> {
  isSigningIn = true;
  try {
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
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
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
  await auth.signOut();
}
