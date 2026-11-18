import crypto from 'node:crypto';

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'admin' | 'staff';
  assignedShopId: string;
  unlockedShopIds: string[];
  iat: number;
  exp: number;
}

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || iterations < 10000 || !salt || !expectedHex) {
    return false;
  }

  const derived = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function signSessionToken(payload: SessionPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || !parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isValidAppsScriptUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    const isAllowedHost =
      host === 'script.google.com' || host === 'script.googleusercontent.com';
    if (!isAllowedHost) return false;
    return parsed.pathname.startsWith('/macros/s/') && parsed.pathname.length > 16;
  } catch {
    return false;
  }
}

export function generateShopSecret(): string {
  return `hk_shop_${crypto.randomBytes(20).toString('hex')}`;
}

export function maskSecretValue(value: string, visibleEnd = 4): string {
  if (!value) return '';
  if (value.length <= visibleEnd + 4) return '••••••••';
  return `${value.slice(0, 6)}••••••••${value.slice(-visibleEnd)}`;
}

export function maskWebhookUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    const tail = parsed.pathname.slice(-6);
    return `https://${parsed.hostname}/macros/s/••••${tail}`;
  } catch {
    return 'https://script.google.com/••••';
  }
}

export function sanitizeSheetCell(val: string | number): string | number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const str = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
