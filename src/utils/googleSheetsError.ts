import { Language } from '../types';

export class GoogleSheetsApiError extends Error {
  status: number;
  requiresReauth: boolean;
  reason?: string;

  constructor(
    message: string,
    options: { status: number; requiresReauth?: boolean; reason?: string }
  ) {
    super(message);
    this.name = 'GoogleSheetsApiError';
    this.status = options.status;
    this.requiresReauth = Boolean(options.requiresReauth);
    this.reason = options.reason;
  }
}

interface GoogleApiErrorEnvelope {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      reason?: string;
      metadata?: { activationUrl?: string; service?: string };
    }>;
  };
}

export function formatGoogleSheetsApiError(
  status: number,
  rawBody: string,
  lang: Language = 'bn',
  fallbackProjectId = 'gen-lang-client-0632036924'
): GoogleSheetsApiError {
  let parsedMessage = rawBody;
  let apiStatus = '';
  let reason = '';
  let activationUrl = `https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=${fallbackProjectId}`;

  try {
    const json = JSON.parse(rawBody) as GoogleApiErrorEnvelope;
    if (json.error?.message) parsedMessage = json.error.message;
    if (json.error?.status) apiStatus = json.error.status;
    const detail = json.error?.details?.find((d) => d.reason || d.metadata?.activationUrl);
    if (detail?.reason) reason = detail.reason;
    if (detail?.metadata?.activationUrl) activationUrl = detail.metadata.activationUrl;
  } catch {
    // Non-JSON response body
  }

  const lower = parsedMessage.toLowerCase();

  if (
    reason === 'SERVICE_DISABLED' ||
    lower.includes('has not been used in project') ||
    lower.includes('sheets.googleapis.com') && lower.includes('disabled')
  ) {
    const msg =
      lang === 'bn'
        ? `Google Cloud প্রজেক্টে "Google Sheets API" এখনো Enable করা নেই। এই লিংকে গিয়ে Enable করুন এবং ১ মিনিট পর আবার চেষ্টা করুন: ${activationUrl}`
        : `Google Sheets API is not enabled in your Google Cloud project yet. Enable it here and retry in a minute: ${activationUrl}`;
    return new GoogleSheetsApiError(msg, {
      status,
      requiresReauth: false,
      reason: 'SERVICE_DISABLED',
    });
  }

  if (
    reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    lower.includes('insufficient authentication scopes') ||
    lower.includes('insufficient permission')
  ) {
    const msg =
      lang === 'bn'
        ? 'Google সাইন-ইন স্ক্রিনে Google Sheets-এর পারমিশন টিক (Checkbox) দেওয়া হয়নি। আবার "গুগল শিট যুক্ত করুন" ক্লিক করে Google Sheets পারমিশন বক্সে টিক দিয়ে Allow করুন।'
        : 'Google Sheets permission was not checked on the Google consent screen. Click Connect Google Sheets again and check the Sheets permission box.';
    return new GoogleSheetsApiError(msg, {
      status,
      requiresReauth: true,
      reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
    });
  }

  if (status === 401 || apiStatus === 'UNAUTHENTICATED') {
    const msg =
      lang === 'bn'
        ? 'Google সেশন মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার "গুগল শিট যুক্ত করুন" বাটনে ক্লিক করে অনুমতি দিন।'
        : 'Google access token expired. Please reconnect Google Sheets and try again.';
    return new GoogleSheetsApiError(msg, {
      status,
      requiresReauth: true,
      reason: 'UNAUTHENTICATED',
    });
  }

  const msg =
    lang === 'bn'
      ? `Google Sheet তৈরি/সিঙ্ক ব্যর্থ হয়েছে (${status}): ${parsedMessage}`
      : `Google Sheets request failed (${status}): ${parsedMessage}`;
  return new GoogleSheetsApiError(msg, { status, requiresReauth: false, reason });
}
