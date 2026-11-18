export interface FirebaseAppConfigLike {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export function shouldUseFirebaseProxyPath(pathname: string): boolean {
  return pathname.startsWith('/__/auth/') || pathname.startsWith('/__/firebase/');
}

export function buildFirebaseProxyTargetUrl(requestUrl: string, upstreamAuthDomain: string): string {
  const url = new URL(requestUrl);
  const normalizedDomain = upstreamAuthDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${normalizedDomain}${url.pathname}${url.search}`;
}

const STRIPPED_PROXY_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'x-forwarded-host',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
]);

export function buildFirebaseProxyRequestHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  incoming.forEach((value, key) => {
    if (!STRIPPED_PROXY_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

export function isLocalOrPreviewHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '[::1]' ||
    lower.endsWith('.run.app') ||
    lower.endsWith('.local')
  );
}

export function getEffectiveFirebaseConfig<T extends FirebaseAppConfigLike>(
  baseConfig: T,
  locationLike?: { hostname?: string; host?: string }
): T {
  const hostname = locationLike?.hostname?.trim() ?? '';
  const host = locationLike?.host?.trim() ?? hostname;
  if (!hostname || isLocalOrPreviewHostname(hostname)) {
    return baseConfig;
  }
  return {
    ...baseConfig,
    authDomain: host,
  };
}

export function isLikelyMobileBrowser(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent)) {
    return true;
  }
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) {
    return true;
  }
  return false;
}
