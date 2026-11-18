import { Language } from '../types';

export function formatGoogleAuthError(
  err: unknown,
  lang: Language = 'bn',
  hostname?: string
): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  const rawMessage = err instanceof Error ? err.message : String(err ?? '');
  const host =
    hostname ||
    (typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'your-domain.pages.dev');

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('unauthorized-domain')) {
    return lang === 'bn'
      ? `এই ডোমেইনটি (${host}) Firebase Authorized Domains-এ যুক্ত করা নেই। Firebase Console → Authentication → Settings → Authorized domains-এ গিয়ে "${host}" যুক্ত করুন। অথবা বিকল্প হিসেবে নিচের Apps Script Webhook URL দিয়েও সরাসরি গুগল শিট কানেক্ট করতে পারেন।`
      : `Domain "${host}" is not authorized in Firebase Authentication. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains, or use the per-shop Apps Script Webhook URL below.`;
  }

  if (code === 'auth/popup-blocked' || rawMessage.includes('popup-blocked')) {
    return lang === 'bn'
      ? 'ব্রাউজার গুগল সাইন-ইন পপ-আপ ব্লক করেছে। পপ-আপ Allow করে আবার চেষ্টা করুন, অথবা Apps Script Webhook URL ব্যবহার করুন।'
      : 'Browser blocked the Google sign-in popup. Please allow popups and try again, or use an Apps Script Webhook URL.';
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    rawMessage.includes('popup-closed-by-user')
  ) {
    return lang === 'bn'
      ? `গুগল সাইন-ইন পপ-আপ (${host}) সম্পন্ন হওয়ার আগেই বন্ধ হয়ে গেছে। মোবাইল ব্রাউজারে পপ-আপ কাজ না করলে নিচের "Redirect দিয়ে যুক্ত করুন" অপশনটি ব্যবহার করুন অথবা পপ-আপ Allow করে আবার চেষ্টা করুন।`
      : `Google sign-in popup closed before completing on "${host}". On mobile browsers, use the Redirect sign-in option or allow popups and try again.`;
  }

  if (
    code === 'auth/operation-not-supported-in-this-environment' ||
    rawMessage.includes('operation-not-supported-in-this-environment')
  ) {
    return lang === 'bn'
      ? 'এই ব্রাউজার পরিবেশে পপ-আপ সাইন-ইন সাপোর্ট করছে না। Chrome/Safari ব্রাউজারে খুলুন অথবা Apps Script Webhook URL ব্যবহার করুন।'
      : 'Popup sign-in is not supported in this browser environment. Open in Chrome/Safari or use an Apps Script Webhook URL.';
  }

  if (code === 'auth/network-request-failed' || rawMessage.includes('network-request-failed')) {
    return lang === 'bn'
      ? 'নেটওয়ার্ক সমস্যার কারণে গুগল কানেক্ট করা যায়নি। ইন্টারনেট সংযোগ যাচাই করে আবার চেষ্টা করুন।'
      : 'Network error while connecting to Google. Check your connection and try again.';
  }

  if (rawMessage.trim()) {
    return rawMessage;
  }

  return lang === 'bn'
    ? 'গুগল অ্যাকাউন্ট কানেক্ট করা যায়নি। আবার চেষ্টা করুন।'
    : 'Failed to connect Google account. Please try again.';
}
