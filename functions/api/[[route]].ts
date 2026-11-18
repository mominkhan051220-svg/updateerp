import { createSeedState, FULL_PERMISSIONS } from '../../src/data/seedData';
import { ALL_MENU_KEYS, type BankAccount, type MenuKey, type Shop } from '../../src/types';
import { canAccessShop } from '../../src/utils/accounting';
import { type ShopDataSnapshot } from '../../src/utils/googleSheetsApi';
import { applyRestoredShopSnapshot } from '../../src/utils/shopSnapshot';
import { canDeleteUser } from '../../src/utils/userManagement';
import {
  applyVaultMutation,
  buildFullShopSnapshotFromVault,
  buildSanitizedStateForUser,
  createInitialVaultData,
  forwardToGoogleSheetWeb,
  toPublicUser,
  type ServerVault,
  type StoredUser,
} from '../../src/utils/vaultCore';
import {
  generateSessionSecretWeb,
  generateShopSecretWeb,
  hashPasswordWeb,
  isValidAppsScriptUrlWeb,
  signSessionTokenWeb,
  verifyPasswordWeb,
  verifySessionTokenWeb,
  type SessionPayload,
} from '../../src/utils/webCryptoSecurity';

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface PagesEnv {
  HISHAB_KV?: KVNamespaceLike;
  AUTH_SESSION_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
}

interface PagesContext {
  request: Request;
  env: PagesEnv;
}

const VAULT_KV_KEY = 'hishabkhata:vault:v1';
const SESSION_KEY_KV = 'hishabkhata:session:secret';
const SESSION_COOKIE_NAME = 'hk_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOGIN_WINDOW_SEC = 15 * 60;

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...BASE_SECURITY_HEADERS,
      ...(extraHeaders ?? {}),
    },
  });
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    try {
      result[k] = decodeURIComponent(v);
    } catch {
      result[k] = v;
    }
  }
  return result;
}

function isHttpsRequest(request: Request): boolean {
  const url = new URL(request.url);
  return (
    url.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  );
}

function buildCookieHeader(request: Request, token: string, maxAgeSec: number): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isHttpsRequest(request)) {
    parts.push('SameSite=None', 'Secure');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

async function getSessionSecret(env: PagesEnv): Promise<string> {
  if (env.AUTH_SESSION_SECRET && env.AUTH_SESSION_SECRET.length >= 32) {
    return env.AUTH_SESSION_SECRET;
  }
  if (!env.HISHAB_KV) {
    throw new Error('HISHAB_KV is not configured.');
  }
  const existing = await env.HISHAB_KV.get(SESSION_KEY_KV);
  if (existing && existing.length >= 32) {
    return existing;
  }
  const generated = generateSessionSecretWeb();
  await env.HISHAB_KV.put(SESSION_KEY_KV, generated);
  return generated;
}

async function loadVaultFromKV(env: PagesEnv): Promise<ServerVault> {
  if (!env.HISHAB_KV) {
    throw new Error('HISHAB_KV is not configured.');
  }
  const raw = await env.HISHAB_KV.get(VAULT_KV_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ServerVault;
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0 && parsed.appData?.shops?.length > 0) {
        return parsed;
      }
    } catch {
      // Fallback to initial seed vault
    }
  }
  const initial = createInitialVaultData({
    ADMIN_EMAIL: env.ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: env.ADMIN_PASSWORD_HASH,
  });
  await env.HISHAB_KV.put(VAULT_KV_KEY, JSON.stringify(initial));
  return initial;
}

async function saveVaultToKV(env: PagesEnv, vault: ServerVault): Promise<void> {
  if (!env.HISHAB_KV) {
    throw new Error('HISHAB_KV is not configured.');
  }
  await env.HISHAB_KV.put(VAULT_KV_KEY, JSON.stringify(vault));
}

async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // CSRF Header verification for all mutating API requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (request.headers.get('x-requested-with') !== 'XMLHttpRequest') {
      return jsonResponse({ status: 'error', message: 'Forbidden: Missing CSRF request header.' }, 403);
    }
  }

  if (pathname === '/api/health' && method === 'GET') {
    return jsonResponse({
      status: 'ok',
      runtime: 'cloudflare-pages',
      kvBound: Boolean(env.HISHAB_KV),
      timestamp: new Date().toISOString(),
    });
  }

  if (!env.HISHAB_KV) {
    return jsonResponse(
      {
        status: 'error',
        message:
          'Cloudflare KV (HISHAB_KV) is not bound yet. Bind a KV namespace named HISHAB_KV in Cloudflare Pages -> Settings -> Functions -> KV Namespace Bindings.',
      },
      503
    );
  }

  let sessionSecret: string;
  let vault: ServerVault;
  try {
    sessionSecret = await getSessionSecret(env);
    vault = await loadVaultFromKV(env);
  } catch (err) {
    return jsonResponse(
      {
        status: 'error',
        message: err instanceof Error ? err.message : 'Cloudflare KV storage initialization failed.',
      },
      503
    );
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  const session = rawToken ? await verifySessionTokenWeb(rawToken, sessionSecret) : null;
  const authUser = session ? vault.users.find((u) => u.id === session.userId) : undefined;

  if (pathname === '/api/auth/session' && method === 'GET') {
    if (!session || !authUser) {
      return jsonResponse(
        { authenticated: false },
        200,
        session ? { 'Set-Cookie': buildCookieHeader(request, '', 0) } : undefined
      );
    }
    return jsonResponse({
      authenticated: true,
      user: toPublicUser(authUser),
      unlockedShopIds: session.unlockedShopIds ?? [],
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readJsonBody<{ username?: string; password?: string }>(request);
    const normalized = String(body?.username ?? '').trim().toLowerCase();
    const rawPass = String(body?.password ?? '');
    if (!normalized || !rawPass) {
      return jsonResponse({ status: 'error', message: 'Email and password are required.' }, 400);
    }

    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    const rlKey = `hishabkhata:rl:${clientIp}:${normalized}`;
    const rlRaw = await env.HISHAB_KV.get(rlKey);
    let rlData: { count: number; lockedUntil: number } = { count: 0, lockedUntil: 0 };
    if (rlRaw) {
      try {
        rlData = JSON.parse(rlRaw) as { count: number; lockedUntil: number };
      } catch {
        rlData = { count: 0, lockedUntil: 0 };
      }
    }

    const now = Date.now();
    if (rlData.lockedUntil > now) {
      const retryAfterSec = Math.ceil((rlData.lockedUntil - now) / 1000);
      return jsonResponse(
        {
          status: 'error',
          message: `Too many failed login attempts. Try again in ${retryAfterSec}s.`,
        },
        429
      );
    }

    const matched = vault.users.find((u) => u.username.toLowerCase() === normalized);
    const validPass = matched ? await verifyPasswordWeb(rawPass, matched.passwordHash) : false;
    if (!matched || !validPass) {
      const nextCount = rlData.count + 1;
      await env.HISHAB_KV.put(
        rlKey,
        JSON.stringify({
          count: nextCount,
          lockedUntil: nextCount >= MAX_FAILED_LOGINS ? now + LOGIN_WINDOW_SEC * 1000 : 0,
        }),
        { expirationTtl: LOGIN_WINDOW_SEC }
      );
      return jsonResponse({ status: 'error', message: 'Invalid email or password.' }, 401);
    }

    await env.HISHAB_KV.delete(rlKey);

    const payload: SessionPayload = {
      userId: matched.id,
      username: matched.username,
      role: matched.role,
      assignedShopId: matched.assignedShopId,
      unlockedShopIds: [],
      iat: now,
      exp: now + SESSION_TTL_MS,
    };
    const token = await signSessionTokenWeb(payload, sessionSecret);

    return jsonResponse(
      {
        authenticated: true,
        user: toPublicUser(matched),
        unlockedShopIds: [],
        state: buildSanitizedStateForUser(vault, matched, []),
      },
      200,
      { 'Set-Cookie': buildCookieHeader(request, token, Math.floor(SESSION_TTL_MS / 1000)) }
    );
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return jsonResponse({ authenticated: false }, 200, {
      'Set-Cookie': buildCookieHeader(request, '', 0),
    });
  }

  // All routes below require authenticated session
  if (!session || !authUser) {
    return jsonResponse(
      { status: 'error', message: 'Authentication required.' },
      401,
      session ? { 'Set-Cookie': buildCookieHeader(request, '', 0) } : undefined
    );
  }

  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const body = await readJsonBody<{ currentPassword?: string; newPassword?: string }>(request);
    if (!body?.currentPassword || !(await verifyPasswordWeb(body.currentPassword, authUser.passwordHash))) {
      return jsonResponse({ status: 'error', message: 'Current password is incorrect.' }, 403);
    }
    if (!body?.newPassword || body.newPassword.length < 8) {
      return jsonResponse({ status: 'error', message: 'New password must be at least 8 characters.' }, 400);
    }
    const nextHash = await hashPasswordWeb(body.newPassword);
    vault = {
      ...vault,
      users: vault.users.map((u) => (u.id === authUser.id ? { ...u, passwordHash: nextHash } : u)),
    };
    await saveVaultToKV(env, vault);
    return jsonResponse({ status: 'success', message: 'Password updated securely.' });
  }

  if (pathname === '/api/state' && method === 'GET') {
    const unlocked = session.unlockedShopIds ?? [];
    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, unlocked),
      unlockedShopIds: unlocked,
    });
  }

  if (pathname === '/api/preferences/language' && method === 'POST') {
    const body = await readJsonBody<{ language?: 'bn' | 'en' }>(request);
    if (body?.language !== 'bn' && body?.language !== 'en') {
      return jsonResponse({ status: 'error', message: 'Invalid language.' }, 400);
    }
    vault = { ...vault, appData: { ...vault.appData, language: body.language } };
    await saveVaultToKV(env, vault);
    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/shops/select' && method === 'POST') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can switch shops.' }, 403);
    }
    const body = await readJsonBody<{ shopId?: string }>(request);
    if (!body?.shopId || !vault.appData.shops.some((s) => s.id === body.shopId)) {
      return jsonResponse({ status: 'error', message: 'Shop not found.' }, 404);
    }
    vault = { ...vault, appData: { ...vault.appData, activeShopId: body.shopId } };
    await saveVaultToKV(env, vault);
    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/shops' && method === 'POST') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can create shops.' }, 403);
    }
    const body = await readJsonBody<{ shop?: Shop; webhookUrl?: string; securityPin?: string }>(request);
    if (!body?.shop || !body.shop.name?.trim()) {
      return jsonResponse({ status: 'error', message: 'Shop name is required.' }, 400);
    }
    const cleanWebhook = (body.webhookUrl ?? '').trim();
    if (cleanWebhook && !isValidAppsScriptUrlWeb(cleanWebhook)) {
      return jsonResponse(
        {
          status: 'error',
          message: 'Invalid Apps Script URL. Must be https://script.google.com/macros/s/...',
        },
        400
      );
    }

    const shopSecret = generateShopSecretWeb();
    const cleanPin = (body.securityPin ?? '').trim();
    const pinHash = cleanPin.length >= 4 ? await hashPasswordWeb(cleanPin) : undefined;

    const cleanShop: Shop = {
      id: body.shop.id || `shop_${Date.now()}`,
      name: body.shop.name.trim(),
      phone: body.shop.phone?.trim() || '',
      address: body.shop.address?.trim() || '',
      printerFormat: body.shop.printerFormat || 'thermal_80',
      initialCapital: Number(body.shop.initialCapital) || 0,
      onlineShop: body.shop.onlineShop,
      lastSyncStatus: 'idle',
      createdAt: body.shop.createdAt || new Date().toISOString().slice(0, 10),
    };

    const defaultBank: BankAccount = {
      id: `bank_${Date.now()}`,
      shopId: cleanShop.id,
      name: 'Cash / Merchant bKash',
      accountType: 'bkash',
      accountNumber: cleanShop.phone,
      openingBalance: 0,
    };

    vault = {
      ...vault,
      shopSecrets: {
        ...vault.shopSecrets,
        [cleanShop.id]: { webhookUrl: cleanWebhook, sheetSecret: shopSecret, pinHash },
      },
      appData: {
        ...vault.appData,
        shops: [...vault.appData.shops, cleanShop],
        bankAccounts: [...vault.appData.bankAccounts, defaultBank],
        activeShopId: cleanShop.id,
      },
    };
    await saveVaultToKV(env, vault);

    const nextUnlocked = Array.from(new Set([...(session.unlockedShopIds ?? []), cleanShop.id]));
    const updatedToken = await signSessionTokenWeb(
      { ...session, unlockedShopIds: nextUnlocked },
      sessionSecret
    );

    if (cleanWebhook) {
      const snap = buildFullShopSnapshotFromVault(vault, cleanShop.id);
      const syncRes = await forwardToGoogleSheetWeb(cleanWebhook, shopSecret, {
        source: 'HishabKhataPro',
        shopId: cleanShop.id,
        shopName: cleanShop.name,
        action: 'save_snapshot',
        collection: 'ShopSnapshot',
        fullSnapshot: snap,
        syncedAt: new Date().toISOString(),
      });
      vault.appData.shops = vault.appData.shops.map((s) =>
        s.id === cleanShop.id
          ? {
              ...s,
              lastSyncStatus: syncRes.ok ? 'synced' : 'error',
              lastSyncedAt: new Date().toISOString(),
              lastSyncMessage: syncRes.ok ? 'Synced to Google Sheet' : 'Webhook sync failed',
            }
          : s
      );
      await saveVaultToKV(env, vault);
    }

    return jsonResponse(
      {
        state: buildSanitizedStateForUser(vault, authUser, nextUnlocked),
        unlockedShopIds: nextUnlocked,
        shopId: cleanShop.id,
      },
      200,
      { 'Set-Cookie': buildCookieHeader(request, updatedToken, Math.floor(SESSION_TTL_MS / 1000)) }
    );
  }

  const shopSecMatch = pathname.match(/^\/api\/shops\/([^/]+)\/security$/);
  if (shopSecMatch && method === 'POST') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can update shop security settings.' }, 403);
    }
    const shopId = decodeURIComponent(shopSecMatch[1]);
    if (!vault.appData.shops.some((s) => s.id === shopId)) {
      return jsonResponse({ status: 'error', message: 'Shop not found.' }, 404);
    }

    const body = await readJsonBody<{
      webhookUrl?: string;
      clearWebhook?: boolean;
      rotateSecret?: boolean;
      securityPin?: string;
      removePin?: boolean;
    }>(request);

    const existing = vault.shopSecrets[shopId] ?? {
      webhookUrl: '',
      sheetSecret: generateShopSecretWeb(),
    };

    let nextWebhook = existing.webhookUrl;
    if (body.clearWebhook) {
      nextWebhook = '';
    } else if (typeof body.webhookUrl === 'string' && body.webhookUrl.trim()) {
      if (!isValidAppsScriptUrlWeb(body.webhookUrl.trim())) {
        return jsonResponse(
          {
            status: 'error',
            message: 'Invalid Apps Script URL. Must start with https://script.google.com/macros/s/',
          },
          400
        );
      }
      nextWebhook = body.webhookUrl.trim();
    }

    let rotatedSecretOnce: string | undefined;
    let nextSecret = existing.sheetSecret;
    if (body.rotateSecret) {
      nextSecret = generateShopSecretWeb();
      rotatedSecretOnce = nextSecret;
    }

    let nextPinHash = existing.pinHash;
    if (body.removePin) {
      nextPinHash = undefined;
    } else if (typeof body.securityPin === 'string' && body.securityPin.trim()) {
      if (body.securityPin.trim().length < 4) {
        return jsonResponse({ status: 'error', message: 'Shop Security PIN must be at least 4 characters.' }, 400);
      }
      nextPinHash = await hashPasswordWeb(body.securityPin.trim());
    }

    vault = {
      ...vault,
      shopSecrets: {
        ...vault.shopSecrets,
        [shopId]: { webhookUrl: nextWebhook, sheetSecret: nextSecret, pinHash: nextPinHash },
      },
    };
    await saveVaultToKV(env, vault);

    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
      rotatedSecretOnce,
    });
  }

  const shopUnlockMatch = pathname.match(/^\/api\/shops\/([^/]+)\/unlock$/);
  if (shopUnlockMatch && method === 'POST') {
    const shopId = decodeURIComponent(shopUnlockMatch[1]);
    if (!canAccessShop(authUser, shopId)) {
      return jsonResponse({ status: 'error', message: 'You are not authorized for this shop.' }, 403);
    }
    const sec = vault.shopSecrets[shopId];
    if (!sec?.pinHash) {
      return jsonResponse({
        unlocked: true,
        unlockedShopIds: session.unlockedShopIds ?? [],
        state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
      });
    }

    const body = await readJsonBody<{ pin?: string }>(request);
    if (!body?.pin || !(await verifyPasswordWeb(body.pin.trim(), sec.pinHash))) {
      return jsonResponse({ status: 'error', message: 'Invalid shop security PIN.' }, 403);
    }

    const nextUnlocked = Array.from(new Set([...(session.unlockedShopIds ?? []), shopId]));
    const updatedToken = await signSessionTokenWeb(
      { ...session, unlockedShopIds: nextUnlocked },
      sessionSecret
    );

    return jsonResponse(
      {
        unlocked: true,
        unlockedShopIds: nextUnlocked,
        state: buildSanitizedStateForUser(vault, authUser, nextUnlocked),
      },
      200,
      { 'Set-Cookie': buildCookieHeader(request, updatedToken, Math.floor(SESSION_TTL_MS / 1000)) }
    );
  }

  const shopMutateMatch = pathname.match(/^\/api\/shops\/([^/]+)\/mutate$/);
  if (shopMutateMatch && method === 'POST') {
    const shopId = decodeURIComponent(shopMutateMatch[1]);
    const body = await readJsonBody<{ action?: string; payload?: Record<string, unknown> }>(request);

    if (!canAccessShop(authUser, shopId)) {
      return jsonResponse({ status: 'error', message: 'Forbidden: Shop access denied.' }, 403);
    }
    const targetShop = vault.appData.shops.find((s) => s.id === shopId);
    if (!targetShop) {
      return jsonResponse({ status: 'error', message: 'Shop not found.' }, 404);
    }
    const sec = vault.shopSecrets[shopId];
    const unlockedIds = session.unlockedShopIds ?? [];
    if (sec?.pinHash && !unlockedIds.includes(shopId)) {
      return jsonResponse({ status: 'error', message: 'Shop is locked. Enter shop security PIN first.' }, 423);
    }
    if (!body?.action) {
      return jsonResponse({ status: 'error', message: 'Missing mutation action.' }, 400);
    }

    const result = applyVaultMutation(vault, authUser, shopId, body.action, body.payload);
    if (!result.ok) {
      return jsonResponse({ status: 'error', message: result.errorMessage }, result.httpStatus ?? 400);
    }

    await saveVaultToKV(env, vault);

    if (result.restoredOnly) {
      return jsonResponse({
        state: buildSanitizedStateForUser(vault, authUser, unlockedIds),
        sheetSync: { status: 'synced', message: `Restored ${targetShop.name} from Google Sheet` },
      });
    }

    let sheetSync: { status: 'synced' | 'local_only' | 'error'; message: string } = {
      status: 'local_only',
      message: targetShop.spreadsheetId
        ? 'Syncing to Google Sheet via OAuth...'
        : 'No Google Sheet linked to this shop yet.',
    };

    if (sec?.webhookUrl && result.syncCollection) {
      const snap = buildFullShopSnapshotFromVault(vault, shopId);
      const syncRes = await forwardToGoogleSheetWeb(sec.webhookUrl, sec.sheetSecret, {
        source: 'HishabKhataPro',
        shopId,
        shopName: targetShop.name,
        action: 'upsert',
        collection: result.syncCollection,
        record: result.syncRecord,
        fullSnapshot: snap,
        syncedAt: new Date().toISOString(),
      });
      const nowIso = new Date().toISOString();
      vault.appData.shops = vault.appData.shops.map((s) =>
        s.id === shopId
          ? {
              ...s,
              lastSyncStatus: syncRes.ok ? 'synced' : 'error',
              lastSyncedAt: syncRes.ok ? nowIso : s.lastSyncedAt,
              lastSyncMessage: syncRes.ok
                ? 'Saved directly to Google Sheet'
                : String(syncRes.data?.message || `HTTP ${syncRes.status}`),
            }
          : s
      );
      await saveVaultToKV(env, vault);
      sheetSync = syncRes.ok
        ? { status: 'synced', message: `Saved directly to ${targetShop.name} Google Sheet` }
        : { status: 'error', message: String(syncRes.data?.message || 'Google Sheet webhook sync failed') };
    }

    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, unlockedIds),
      sheetSync,
    });
  }

  if (pathname === '/api/users' && method === 'POST') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can create users.' }, 403);
    }
    const body = await readJsonBody<{
      name?: string;
      username?: string;
      password?: string;
      role?: 'admin' | 'staff';
      assignedShopId?: string;
      permissions?: Record<MenuKey, boolean>;
    }>(request);

    const cleanUsername = String(body?.username ?? '').trim();
    if (!body?.name?.trim() || !cleanUsername || !body.password || body.password.length < 6) {
      return jsonResponse(
        { status: 'error', message: 'Name, email/username, and password (min 6 chars) are required.' },
        400
      );
    }
    if (vault.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return jsonResponse({ status: 'error', message: 'Username / Email already exists.' }, 409);
    }

    const validShopId =
      body.assignedShopId && vault.appData.shops.some((s) => s.id === body.assignedShopId)
        ? body.assignedShopId
        : vault.appData.shops[0].id;
    const cleanRole = body.role === 'admin' ? 'admin' : 'staff';

    const created: StoredUser = {
      id: `user_${Date.now()}`,
      name: body.name.trim(),
      username: cleanUsername,
      passwordHash: await hashPasswordWeb(body.password),
      role: cleanRole,
      assignedShopId: cleanRole === 'admin' ? vault.appData.shops[0].id : validShopId,
      allowedShopIds:
        cleanRole === 'admin' ? vault.appData.shops.map((s) => s.id) : [validShopId],
      permissions:
        cleanRole === 'admin'
          ? { ...FULL_PERMISSIONS }
          : (ALL_MENU_KEYS.reduce(
              (acc, k) => ({ ...acc, [k]: Boolean(body.permissions?.[k]) }),
              {} as Record<MenuKey, boolean>
            )),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    vault = { ...vault, users: [...vault.users, created] };
    await saveVaultToKV(env, vault);

    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  const userPermMatch = pathname.match(/^\/api\/users\/([^/]+)\/permissions$/);
  if (userPermMatch && method === 'PUT') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can update permissions.' }, 403);
    }
    const userId = decodeURIComponent(userPermMatch[1]);
    const body = await readJsonBody<{ permissions?: Record<MenuKey, boolean>; assignedShopId?: string }>(
      request
    );
    const target = vault.users.find((u) => u.id === userId);
    if (!target) {
      return jsonResponse({ status: 'error', message: 'User not found.' }, 404);
    }

    const nextAssigned =
      body.assignedShopId && vault.appData.shops.some((s) => s.id === body.assignedShopId)
        ? body.assignedShopId
        : target.assignedShopId;

    vault = {
      ...vault,
      users: vault.users.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions: body.permissions ?? u.permissions,
              assignedShopId: nextAssigned,
              allowedShopIds: u.role === 'admin' ? vault.appData.shops.map((s) => s.id) : [nextAssigned],
            }
          : u
      ),
    };
    await saveVaultToKV(env, vault);

    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  const userDeleteMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userDeleteMatch && method === 'DELETE') {
    const userId = decodeURIComponent(userDeleteMatch[1]);
    const decision = canDeleteUser(vault.users, authUser, userId);
    if (!decision.allowed) {
      const status =
        decision.reason === 'FORBIDDEN'
          ? 403
          : decision.reason === 'NOT_FOUND'
          ? 404
          : 400;
      return jsonResponse({ status: 'error', message: decision.message }, status);
    }

    vault = {
      ...vault,
      users: vault.users.filter((u) => u.id !== userId),
    };
    await saveVaultToKV(env, vault);

    if (userId === authUser.id) {
      return jsonResponse({ deletedSelf: true }, 200, {
        'Set-Cookie': buildCookieHeader(request, '', 0),
      });
    }

    return jsonResponse({
      deletedSelf: false,
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/sheets/sync-status' && method === 'POST') {
    const body = await readJsonBody<{
      shopId?: string;
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      lastSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
      lastSyncedAt?: string;
      lastSyncMessage?: string;
    }>(request);

    if (!body?.shopId || !canAccessShop(authUser, body.shopId)) {
      return jsonResponse({ status: 'error', message: 'Forbidden: Shop access denied.' }, 403);
    }

    vault = {
      ...vault,
      appData: {
        ...vault.appData,
        shops: vault.appData.shops.map((s) =>
          s.id === body.shopId
            ? {
                ...s,
                spreadsheetId: body.spreadsheetId ?? s.spreadsheetId,
                spreadsheetUrl: body.spreadsheetUrl ?? s.spreadsheetUrl,
                lastSyncStatus: body.lastSyncStatus ?? s.lastSyncStatus,
                lastSyncedAt: body.lastSyncedAt ?? s.lastSyncedAt,
                lastSyncMessage: body.lastSyncMessage ?? s.lastSyncMessage,
              }
            : s
        ),
      },
    };
    await saveVaultToKV(env, vault);

    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/sheets/sync' && method === 'POST') {
    const body = await readJsonBody<{
      shopId?: string;
      action?: string;
      collection?: string;
      record?: unknown;
      fullSnapshot?: unknown;
    }>(request);

    if (!body?.shopId || !canAccessShop(authUser, body.shopId)) {
      return jsonResponse({ status: 'error', message: 'Forbidden: Shop access denied.' }, 403);
    }

    const shop = vault.appData.shops.find((s) => s.id === body.shopId);
    const sec = vault.shopSecrets[body.shopId];
    if (!shop || !sec?.webhookUrl || !isValidAppsScriptUrlWeb(sec.webhookUrl)) {
      return jsonResponse(
        { status: 'error', message: 'No valid Google Apps Script Webhook URL is configured for this shop.' },
        400
      );
    }

    const snap = body.fullSnapshot ?? buildFullShopSnapshotFromVault(vault, body.shopId);
    const result = await forwardToGoogleSheetWeb(sec.webhookUrl, sec.sheetSecret, {
      source: 'HishabKhataPro-CloudflareWorker',
      shopId: shop.id,
      shopName: shop.name,
      action: body.action || 'upsert',
      collection: body.collection || 'general',
      record: body.record ?? null,
      fullSnapshot: snap,
      syncedAt: new Date().toISOString(),
    });

    if (!result.ok) {
      return jsonResponse(
        {
          status: 'error',
          message: String(result.data?.message || `Google Apps Script returned HTTP ${result.status}`),
          details: result.data,
        },
        502
      );
    }

    const nowIso = new Date().toISOString();
    vault.appData.shops = vault.appData.shops.map((s) =>
      s.id === body.shopId
        ? { ...s, lastSyncStatus: 'synced', lastSyncedAt: nowIso, lastSyncMessage: 'Synced to Google Sheet' }
        : s
    );
    await saveVaultToKV(env, vault);

    return jsonResponse({
      status: 'success',
      httpStatus: result.status,
      sheetResponse: result.data,
      syncedAt: nowIso,
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/sheets/test' && method === 'POST') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can test shop webhooks.' }, 403);
    }
    const body = await readJsonBody<{ shopId?: string; webhookUrl?: string }>(request);
    if (!body?.shopId) {
      return jsonResponse({ status: 'error', message: 'shopId is required.' }, 400);
    }

    const shop = vault.appData.shops.find((s) => s.id === body.shopId);
    const sec = vault.shopSecrets[body.shopId];
    const targetUrl = (body.webhookUrl ?? sec?.webhookUrl ?? '').trim();
    if (!targetUrl || !isValidAppsScriptUrlWeb(targetUrl)) {
      return jsonResponse(
        {
          status: 'error',
          message: 'Invalid Google Apps Script URL. Only https://script.google.com/macros/s/... is allowed.',
        },
        400
      );
    }

    const result = await forwardToGoogleSheetWeb(targetUrl, sec?.sheetSecret ?? '', {
      source: 'HishabKhataPro-CloudflareWorker',
      action: 'ping',
      shopId: body.shopId,
      shopName: shop?.name ?? body.shopId,
      syncedAt: new Date().toISOString(),
    });

    if (!result.ok) {
      return jsonResponse(
        {
          status: 'error',
          message: String(result.data?.message || `Webhook responded with HTTP ${result.status}`),
          details: result.data,
        },
        502
      );
    }

    return jsonResponse({
      status: 'success',
      message: 'Google Sheet Webhook verified with per-shop secret.',
      sheetResponse: result.data,
    });
  }

  if (pathname === '/api/sheets/restore' && method === 'POST') {
    const body = await readJsonBody<{ shopId?: string }>(request);
    if (!body?.shopId || !canAccessShop(authUser, body.shopId)) {
      return jsonResponse({ status: 'error', message: 'Forbidden: Shop access denied.' }, 403);
    }

    const shop = vault.appData.shops.find((s) => s.id === body.shopId);
    const sec = vault.shopSecrets[body.shopId];
    if (!shop || !sec?.webhookUrl || !isValidAppsScriptUrlWeb(sec.webhookUrl)) {
      return jsonResponse(
        { status: 'error', message: 'No Google Apps Script Webhook URL is configured for this shop.' },
        400
      );
    }

    const result = await forwardToGoogleSheetWeb(sec.webhookUrl, sec.sheetSecret, {
      source: 'HishabKhataPro-CloudflareWorker',
      action: 'restore',
      shopId: shop.id,
      shopName: shop.name,
      syncedAt: new Date().toISOString(),
    });

    const snapshot = result.data?.snapshot as ShopDataSnapshot | undefined;
    if (!result.ok || !snapshot || !snapshot.shop) {
      return jsonResponse(
        {
          status: 'error',
          message: String(result.data?.message || 'Could not restore snapshot from Google Sheet.'),
        },
        502
      );
    }

    if (snapshot.shop.id !== body.shopId) {
      return jsonResponse(
        { status: 'error', message: 'Cross-shop restore blocked: Google Sheet belongs to another shop.' },
        403
      );
    }

    const restored = applyRestoredShopSnapshot(
      {
        isAuthenticated: true,
        language: vault.appData.language,
        currentUserId: authUser.id,
        activeShopId: vault.appData.activeShopId,
        shops: vault.appData.shops,
        users: [],
        products: vault.appData.products,
        stockMovements: vault.appData.stockMovements,
        parties: vault.appData.parties,
        sales: vault.appData.sales,
        saleReturns: vault.appData.saleReturns,
        purchases: vault.appData.purchases,
        purchaseReturns: vault.appData.purchaseReturns,
        salesOrders: vault.appData.salesOrders,
        purchaseOrders: vault.appData.purchaseOrders,
        dueSettlements: vault.appData.dueSettlements,
        expenses: vault.appData.expenses,
        cashAdjustments: vault.appData.cashAdjustments,
        bankAccounts: vault.appData.bankAccounts,
        bankTransactions: vault.appData.bankTransactions,
        onlineOrders: vault.appData.onlineOrders,
      },
      snapshot,
      body.shopId
    );
    const { isAuthenticated: _ia, currentUserId: _cu, users: _u, ...restoredData } = restored;
    vault.appData = restoredData;
    await saveVaultToKV(env, vault);

    return jsonResponse({
      status: 'success',
      state: buildSanitizedStateForUser(vault, authUser, session.unlockedShopIds ?? []),
    });
  }

  if (pathname === '/api/reset' && method === 'POST') {
    if (authUser.role !== 'admin') {
      return jsonResponse({ status: 'error', message: 'Only admin can reset account data.' }, 403);
    }
    const seed = createSeedState();
    const { isAuthenticated: _auth, users: _u, currentUserId: _uid, ...rest } = seed;
    vault = {
      ...vault,
      shopSecrets: {
        shop_main: {
          webhookUrl: '',
          sheetSecret: generateShopSecretWeb(),
        },
      },
      appData: rest,
    };
    await saveVaultToKV(env, vault);

    return jsonResponse({
      state: buildSanitizedStateForUser(vault, authUser, []),
    });
  }

  return jsonResponse({ status: 'error', message: 'Not Found' }, 404);
}
