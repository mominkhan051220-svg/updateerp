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
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function hashPasswordWeb(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const derivedHex = bytesToHex(new Uint8Array(bits));
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt}$${derivedHex}`;
}

export async function verifyPasswordWeb(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || iterations < 10000 || !salt || !expectedHex) {
    return false;
  }

  const expectedBytes = hexToBytes(expectedHex);
  if (!expectedBytes) return false;

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    expectedBytes.length * 8
  );

  return timingSafeEqualBytes(new Uint8Array(bits), expectedBytes);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionTokenWeb(payload: SessionPayload, secret: string): Promise<string> {
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(encoded));
  const sig = bytesToBase64Url(new Uint8Array(sigBuf));
  return `${encoded}.${sig}`;
}

export async function verifySessionTokenWeb(token: string, secret: string): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const sigBytes = base64UrlToBytes(sig);
  if (!sigBytes) return null;

  const key = await importHmacKey(secret);
  const valid = await globalThis.crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(sigBytes),
    encoder.encode(encoded)
  );
  if (!valid) return null;

  try {
    const payloadBytes = base64UrlToBytes(encoded);
    if (!payloadBytes) return null;
    const parsed = JSON.parse(decoder.decode(payloadBytes)) as SessionPayload;
    if (!parsed || !parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateShopSecretWeb(): string {
  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  return `hk_shop_${bytesToHex(bytes)}`;
}

export function generateSessionSecretWeb(): string {
  const bytes = new Uint8Array(48);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function isValidAppsScriptUrlWeb(rawUrl: string): boolean {
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

export function maskSecretValueWeb(value: string, visibleEnd = 4): string {
  if (!value) return '';
  if (value.length <= visibleEnd + 4) return '••••••••';
  return `${value.slice(0, 6)}••••••••${value.slice(-visibleEnd)}`;
}

export function maskWebhookUrlWeb(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    const tail = parsed.pathname.slice(-6);
    return `https://${parsed.hostname}/macros/s/••••${tail}`;
  } catch {
    return 'https://script.google.com/••••';
  }
}
