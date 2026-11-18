import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { createSeedState, FULL_PERMISSIONS } from './src/data/seedData.ts';
import { ALL_MENU_KEYS, type BankAccount, type MenuKey, type Shop } from './src/types.ts';
import { canAccessShop } from './src/utils/accounting.ts';
import { type ShopDataSnapshot } from './src/utils/googleSheetsApi.ts';
import {
  generateShopSecret,
  hashPassword,
  isValidAppsScriptUrl,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  type SessionPayload,
} from './src/utils/securityCore.ts';
import { applyRestoredShopSnapshot } from './src/utils/shopSnapshot.ts';
import { canDeleteUser } from './src/utils/userManagement.ts';
import {
  applyVaultMutation,
  buildFullShopSnapshotFromVault,
  buildSanitizedStateForUser,
  createInitialVaultData,
  forwardToGoogleSheetWeb,
  toPublicUser,
  type ServerVault,
  type StoredUser,
} from './src/utils/vaultCore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SECURE_DIR = path.join(__dirname, '.hishabkhata-secure');
const VAULT_FILE = path.join(SECURE_DIR, 'vault.json');
const SESSION_KEY_FILE = path.join(SECURE_DIR, 'session.key');
const SESSION_COOKIE_NAME = 'hk_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function ensureSecureDir() {
  if (!fs.existsSync(SECURE_DIR)) {
    fs.mkdirSync(SECURE_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadOrCreateSessionSecret(): string {
  if (process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length >= 32) {
    return process.env.AUTH_SESSION_SECRET;
  }
  ensureSecureDir();
  if (fs.existsSync(SESSION_KEY_FILE)) {
    const existing = fs.readFileSync(SESSION_KEY_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SESSION_KEY_FILE, generated, { mode: 0o600 });
  return generated;
}

const SESSION_SECRET = loadOrCreateSessionSecret();

function loadVault(): ServerVault {
  ensureSecureDir();
  if (fs.existsSync(VAULT_FILE)) {
    try {
      const raw = fs.readFileSync(VAULT_FILE, 'utf8');
      const parsed = JSON.parse(raw) as ServerVault;
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0 && parsed.appData?.shops?.length > 0) {
        return parsed;
      }
    } catch {
      // Corrupt vault falls back to clean seed vault
    }
  }
  const initial = createInitialVaultData({
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  });
  saveVault(initial);
  return initial;
}

function saveVault(vault: ServerVault) {
  ensureSecureDir();
  fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), { mode: 0o600 });
}

let vault = loadVault();

// Rate-limiter for login brute-force protection
const loginAttempts = new Map<string, { count: number; lockedUntil: number; windowStart: number }>();
const MAX_FAILED_LOGINS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function getClientKey(req: Request, username: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${username.toLowerCase().trim()}`;
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now, lockedUntil: 0 });
    return;
  }
  const nextCount = entry.count + 1;
  loginAttempts.set(key, {
    count: nextCount,
    windowStart: entry.windowStart,
    lockedUntil: nextCount >= MAX_FAILED_LOGINS ? now + LOGIN_WINDOW_MS : 0,
  });
}

function clearFailedLogins(key: string) {
  loginAttempts.delete(key);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
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

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req: Request, res: Response, payload: SessionPayload) {
  const token = signSessionToken(payload, SESSION_SECRET);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttpsRequest(req)) {
    parts.push('SameSite=None', 'Secure');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response) {
  const parts = [`${SESSION_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'Max-Age=0'];
  if (isHttpsRequest(req)) {
    parts.push('SameSite=None', 'Secure');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

interface AuthedRequest extends Request {
  session?: SessionPayload;
  authUser?: StoredUser;
}

function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      res.status(403).json({ status: 'error', message: 'Forbidden: Missing CSRF request header.' });
      return;
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  const session = rawToken ? verifySessionToken(rawToken, SESSION_SECRET) : null;
  if (!session) {
    res.status(401).json({ status: 'error', message: 'Authentication required.' });
    return;
  }

  const user = vault.users.find((u) => u.id === session.userId);
  if (!user) {
    clearSessionCookie(req, res);
    res.status(401).json({ status: 'error', message: 'Session expired or user no longer exists.' });
    return;
  }

  req.session = session;
  req.authUser = user;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  app.use('/api', requireCsrfHeader);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', runtime: 'express-node', timestamp: new Date().toISOString() });
  });

  app.get('/api/auth/session', (req: AuthedRequest, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];
    const session = rawToken ? verifySessionToken(rawToken, SESSION_SECRET) : null;
    if (!session) {
      res.json({ authenticated: false });
      return;
    }

    const user = vault.users.find((u) => u.id === session.userId);
    if (!user) {
      clearSessionCookie(req, res);
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: toPublicUser(user),
      unlockedShopIds: session.unlockedShopIds ?? [],
      state: buildSanitizedStateForUser(vault, user, session.unlockedShopIds ?? []),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    const normalized = String(username ?? '').trim().toLowerCase();
    const rawPass = String(password ?? '');

    if (!normalized || !rawPass) {
      res.status(400).json({ status: 'error', message: 'Email and password are required.' });
      return;
    }

    const clientKey = getClientKey(req, normalized);
    const limit = checkRateLimit(clientKey);
    if (!limit.allowed) {
      res.status(429).json({
        status: 'error',
        message: `Too many failed login attempts. Try again in ${limit.retryAfterSec}s.`,
      });
      return;
    }

    const matched = vault.users.find((u) => u.username.toLowerCase() === normalized);
    if (!matched || !verifyPassword(rawPass, matched.passwordHash)) {
      recordFailedLogin(clientKey);
      res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
      return;
    }

    clearFailedLogins(clientKey);

    const now = Date.now();
    const sessionPayload: SessionPayload = {
      userId: matched.id,
      username: matched.username,
      role: matched.role,
      assignedShopId: matched.assignedShopId,
      unlockedShopIds: [],
      iat: now,
      exp: now + SESSION_TTL_MS,
    };

    setSessionCookie(req, res, sessionPayload);

    res.json({
      authenticated: true,
      user: toPublicUser(matched),
      unlockedShopIds: [],
      state: buildSanitizedStateForUser(vault, matched, []),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ authenticated: false });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { currentPassword, newPassword } = (req.body ?? {}) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      res.status(403).json({ status: 'error', message: 'Current password is incorrect.' });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }

    const nextHash = hashPassword(newPassword);
    vault = {
      ...vault,
      users: vault.users.map((u) => (u.id === user.id ? { ...u, passwordHash: nextHash } : u)),
    };
    saveVault(vault);
    res.json({ status: 'success', message: 'Password updated securely.' });
  });

  app.get('/api/state', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const unlocked = req.session?.unlockedShopIds ?? [];
    res.json({
      state: buildSanitizedStateForUser(vault, user, unlocked),
      unlockedShopIds: unlocked,
    });
  });

  app.post('/api/preferences/language', requireAuth, (req: AuthedRequest, res) => {
    const { language } = (req.body ?? {}) as { language?: 'bn' | 'en' };
    if (language !== 'bn' && language !== 'en') {
      res.status(400).json({ status: 'error', message: 'Invalid language.' });
      return;
    }
    vault = {
      ...vault,
      appData: { ...vault.appData, language },
    };
    saveVault(vault);
    res.json({
      state: buildSanitizedStateForUser(vault, req.authUser!, req.session?.unlockedShopIds ?? []),
    });
  });

  app.post('/api/shops/select', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can switch shops.' });
      return;
    }
    const { shopId } = (req.body ?? {}) as { shopId?: string };
    if (!shopId || !vault.appData.shops.some((s) => s.id === shopId)) {
      res.status(404).json({ status: 'error', message: 'Shop not found.' });
      return;
    }
    vault = {
      ...vault,
      appData: { ...vault.appData, activeShopId: shopId },
    };
    saveVault(vault);
    res.json({
      state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
    });
  });

  app.post('/api/shops', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can create shops.' });
      return;
    }

    const { shop, webhookUrl, securityPin } = (req.body ?? {}) as {
      shop?: Shop;
      webhookUrl?: string;
      securityPin?: string;
    };

    if (!shop || !shop.name?.trim()) {
      res.status(400).json({ status: 'error', message: 'Shop name is required.' });
      return;
    }

    const cleanWebhook = (webhookUrl ?? '').trim();
    if (cleanWebhook && !isValidAppsScriptUrl(cleanWebhook)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid Apps Script URL. Must be https://script.google.com/macros/s/...',
      });
      return;
    }

    const shopSecret = generateShopSecret();
    const cleanPin = (securityPin ?? '').trim();
    const pinHash = cleanPin.length >= 4 ? hashPassword(cleanPin) : undefined;

    const cleanShop: Shop = {
      id: shop.id || `shop_${Date.now()}`,
      name: shop.name.trim(),
      phone: shop.phone?.trim() || '',
      address: shop.address?.trim() || '',
      printerFormat: shop.printerFormat || 'thermal_80',
      initialCapital: Number(shop.initialCapital) || 0,
      onlineShop: shop.onlineShop,
      lastSyncStatus: 'idle',
      createdAt: shop.createdAt || new Date().toISOString().slice(0, 10),
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
        [cleanShop.id]: {
          webhookUrl: cleanWebhook,
          sheetSecret: shopSecret,
          pinHash,
        },
      },
      appData: {
        ...vault.appData,
        shops: [...vault.appData.shops, cleanShop],
        bankAccounts: [...vault.appData.bankAccounts, defaultBank],
        activeShopId: cleanShop.id,
      },
    };
    saveVault(vault);

    const nextUnlocked = Array.from(new Set([...(req.session?.unlockedShopIds ?? []), cleanShop.id]));
    setSessionCookie(req, res, { ...req.session!, unlockedShopIds: nextUnlocked });

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
      saveVault(vault);
    }

    res.json({
      state: buildSanitizedStateForUser(vault, user, nextUnlocked),
      unlockedShopIds: nextUnlocked,
      shopId: cleanShop.id,
    });
  });

  app.post('/api/shops/:shopId/security', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can update shop security settings.' });
      return;
    }

    const { shopId } = req.params;
    if (!vault.appData.shops.some((s) => s.id === shopId)) {
      res.status(404).json({ status: 'error', message: 'Shop not found.' });
      return;
    }

    const { webhookUrl, clearWebhook, rotateSecret, securityPin, removePin } = (req.body ?? {}) as {
      webhookUrl?: string;
      clearWebhook?: boolean;
      rotateSecret?: boolean;
      securityPin?: string;
      removePin?: boolean;
    };

    const existing = vault.shopSecrets[shopId] ?? {
      webhookUrl: '',
      sheetSecret: generateShopSecret(),
    };

    let nextWebhook = existing.webhookUrl;
    if (clearWebhook) {
      nextWebhook = '';
    } else if (typeof webhookUrl === 'string' && webhookUrl.trim()) {
      if (!isValidAppsScriptUrl(webhookUrl.trim())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid Apps Script URL. Must start with https://script.google.com/macros/s/',
        });
        return;
      }
      nextWebhook = webhookUrl.trim();
    }

    let rotatedSecretOnce: string | undefined;
    let nextSecret = existing.sheetSecret;
    if (rotateSecret) {
      nextSecret = generateShopSecret();
      rotatedSecretOnce = nextSecret;
    }

    let nextPinHash = existing.pinHash;
    if (removePin) {
      nextPinHash = undefined;
    } else if (typeof securityPin === 'string' && securityPin.trim()) {
      if (securityPin.trim().length < 4) {
        res.status(400).json({ status: 'error', message: 'Shop Security PIN must be at least 4 characters.' });
        return;
      }
      nextPinHash = hashPassword(securityPin.trim());
    }

    vault = {
      ...vault,
      shopSecrets: {
        ...vault.shopSecrets,
        [shopId]: {
          webhookUrl: nextWebhook,
          sheetSecret: nextSecret,
          pinHash: nextPinHash,
        },
      },
    };
    saveVault(vault);

    res.json({
      state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
      rotatedSecretOnce,
    });
  });

  app.post('/api/shops/:shopId/unlock', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { shopId } = req.params;
    if (!canAccessShop(user, shopId)) {
      res.status(403).json({ status: 'error', message: 'You are not authorized for this shop.' });
      return;
    }

    const sec = vault.shopSecrets[shopId];
    if (!sec?.pinHash) {
      res.json({
        unlocked: true,
        unlockedShopIds: req.session?.unlockedShopIds ?? [],
        state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
      });
      return;
    }

    const { pin } = (req.body ?? {}) as { pin?: string };
    if (!pin || !verifyPassword(pin.trim(), sec.pinHash)) {
      res.status(403).json({ status: 'error', message: 'Invalid shop security PIN.' });
      return;
    }

    const nextUnlocked = Array.from(new Set([...(req.session?.unlockedShopIds ?? []), shopId]));
    setSessionCookie(req, res, { ...req.session!, unlockedShopIds: nextUnlocked });

    res.json({
      unlocked: true,
      unlockedShopIds: nextUnlocked,
      state: buildSanitizedStateForUser(vault, user, nextUnlocked),
    });
  });

  app.post('/api/shops/:shopId/mutate', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { shopId } = req.params;
    const { action, payload } = (req.body ?? {}) as { action?: string; payload?: Record<string, unknown> };

    if (!canAccessShop(user, shopId)) {
      res.status(403).json({ status: 'error', message: 'Forbidden: Shop access denied.' });
      return;
    }

    const targetShop = vault.appData.shops.find((s) => s.id === shopId);
    if (!targetShop) {
      res.status(404).json({ status: 'error', message: 'Shop not found.' });
      return;
    }

    const sec = vault.shopSecrets[shopId];
    const unlockedIds = req.session?.unlockedShopIds ?? [];
    if (sec?.pinHash && !unlockedIds.includes(shopId)) {
      res.status(423).json({ status: 'error', message: 'Shop is locked. Enter shop security PIN first.' });
      return;
    }

    if (!action) {
      res.status(400).json({ status: 'error', message: 'Missing mutation action.' });
      return;
    }

    const result = applyVaultMutation(vault, user, shopId, action, payload);
    if (!result.ok) {
      res.status(result.httpStatus ?? 400).json({ status: 'error', message: result.errorMessage });
      return;
    }

    saveVault(vault);

    if (result.restoredOnly) {
      res.json({
        state: buildSanitizedStateForUser(vault, user, unlockedIds),
        sheetSync: { status: 'synced', message: `Restored ${targetShop.name} from Google Sheet` },
      });
      return;
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
      saveVault(vault);
      sheetSync = syncRes.ok
        ? { status: 'synced', message: `Saved directly to ${targetShop.name} Google Sheet` }
        : {
            status: 'error',
            message: String(syncRes.data?.message || 'Google Sheet webhook sync failed'),
          };
    }

    res.json({
      state: buildSanitizedStateForUser(vault, user, unlockedIds),
      sheetSync,
    });
  });

  app.post('/api/users', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can create users.' });
      return;
    }

    const { name, username, password, role, assignedShopId, permissions } = (req.body ?? {}) as {
      name?: string;
      username?: string;
      password?: string;
      role?: 'admin' | 'staff';
      assignedShopId?: string;
      permissions?: Record<MenuKey, boolean>;
    };

    const cleanUsername = String(username ?? '').trim();
    if (!name?.trim() || !cleanUsername || !password || password.length < 6) {
      res.status(400).json({
        status: 'error',
        message: 'Name, email/username, and password (min 6 chars) are required.',
      });
      return;
    }

    if (vault.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      res.status(409).json({ status: 'error', message: 'Username / Email already exists.' });
      return;
    }

    const validShopId =
      assignedShopId && vault.appData.shops.some((s) => s.id === assignedShopId)
        ? assignedShopId
        : vault.appData.shops[0].id;

    const cleanRole = role === 'admin' ? 'admin' : 'staff';
    const created: StoredUser = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      username: cleanUsername,
      passwordHash: hashPassword(password),
      role: cleanRole,
      assignedShopId: cleanRole === 'admin' ? vault.appData.shops[0].id : validShopId,
      allowedShopIds:
        cleanRole === 'admin' ? vault.appData.shops.map((s) => s.id) : [validShopId],
      permissions:
        cleanRole === 'admin'
          ? { ...FULL_PERMISSIONS }
          : (ALL_MENU_KEYS.reduce(
              (acc, k) => ({ ...acc, [k]: Boolean(permissions?.[k]) }),
              {} as Record<MenuKey, boolean>
            )),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    vault = {
      ...vault,
      users: [...vault.users, created],
    };
    saveVault(vault);

    res.json({
      state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
    });
  });

  app.put('/api/users/:userId/permissions', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can update permissions.' });
      return;
    }

    const { userId } = req.params;
    const { permissions, assignedShopId } = (req.body ?? {}) as {
      permissions?: Record<MenuKey, boolean>;
      assignedShopId?: string;
    };

    const target = vault.users.find((u) => u.id === userId);
    if (!target) {
      res.status(404).json({ status: 'error', message: 'User not found.' });
      return;
    }

    const nextAssigned =
      assignedShopId && vault.appData.shops.some((s) => s.id === assignedShopId)
        ? assignedShopId
        : target.assignedShopId;

    vault = {
      ...vault,
      users: vault.users.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions: permissions ?? u.permissions,
              assignedShopId: nextAssigned,
              allowedShopIds: u.role === 'admin' ? vault.appData.shops.map((s) => s.id) : [nextAssigned],
            }
          : u
      ),
    };
    saveVault(vault);

    res.json({
      state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
    });
  });

  // Delete any user (including default admin email once another admin exists)
  app.delete('/api/users/:userId', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const { userId } = req.params;
    const decision = canDeleteUser(vault.users, actor, userId);

    if (!decision.allowed) {
      const status =
        decision.reason === 'FORBIDDEN'
          ? 403
          : decision.reason === 'NOT_FOUND'
          ? 404
          : 400;
      res.status(status).json({ status: 'error', message: decision.message });
      return;
    }

    vault = {
      ...vault,
      users: vault.users.filter((u) => u.id !== userId),
    };
    saveVault(vault);

    if (userId === actor.id) {
      clearSessionCookie(req, res);
      res.json({ deletedSelf: true });
      return;
    }

    res.json({
      deletedSelf: false,
      state: buildSanitizedStateForUser(vault, actor, req.session?.unlockedShopIds ?? []),
    });
  });

  app.post('/api/sheets/sync-status', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { shopId, spreadsheetId, spreadsheetUrl, lastSyncStatus, lastSyncedAt, lastSyncMessage } =
      (req.body ?? {}) as {
        shopId?: string;
        spreadsheetId?: string;
        spreadsheetUrl?: string;
        lastSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
        lastSyncedAt?: string;
        lastSyncMessage?: string;
      };

    if (!shopId || !canAccessShop(user, shopId)) {
      res.status(403).json({ status: 'error', message: 'Forbidden: Shop access denied.' });
      return;
    }

    vault = {
      ...vault,
      appData: {
        ...vault.appData,
        shops: vault.appData.shops.map((s) =>
          s.id === shopId
            ? {
                ...s,
                spreadsheetId: spreadsheetId ?? s.spreadsheetId,
                spreadsheetUrl: spreadsheetUrl ?? s.spreadsheetUrl,
                lastSyncStatus: lastSyncStatus ?? s.lastSyncStatus,
                lastSyncedAt: lastSyncedAt ?? s.lastSyncedAt,
                lastSyncMessage: lastSyncMessage ?? s.lastSyncMessage,
              }
            : s
        ),
      },
    };
    saveVault(vault);

    res.json({
      state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
    });
  });

  app.post('/api/sheets/sync', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { shopId, action, collection, record, fullSnapshot } = (req.body ?? {}) as {
      shopId?: string;
      action?: string;
      collection?: string;
      record?: unknown;
      fullSnapshot?: unknown;
    };

    if (!shopId || !canAccessShop(user, shopId)) {
      res.status(403).json({ status: 'error', message: 'Forbidden: Shop access denied.' });
      return;
    }

    const shop = vault.appData.shops.find((s) => s.id === shopId);
    const sec = vault.shopSecrets[shopId];
    if (!shop || !sec?.webhookUrl || !isValidAppsScriptUrl(sec.webhookUrl)) {
      res.status(400).json({
        status: 'error',
        message: 'No valid Google Apps Script Webhook URL is configured for this shop.',
      });
      return;
    }

    try {
      const snap = fullSnapshot ?? buildFullShopSnapshotFromVault(vault, shopId);
      const result = await forwardToGoogleSheetWeb(sec.webhookUrl, sec.sheetSecret, {
        source: 'HishabKhataPro',
        shopId: shop.id,
        shopName: shop.name,
        action: action || 'upsert',
        collection: collection || 'general',
        record: record ?? null,
        fullSnapshot: snap,
        syncedAt: new Date().toISOString(),
      });

      if (!result.ok) {
        res.status(502).json({
          status: 'error',
          message: String(result.data?.message || `Google Apps Script returned HTTP ${result.status}`),
          details: result.data,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      vault.appData.shops = vault.appData.shops.map((s) =>
        s.id === shopId
          ? {
              ...s,
              lastSyncStatus: 'synced',
              lastSyncedAt: nowIso,
              lastSyncMessage: 'Synced to Google Sheet',
            }
          : s
      );
      saveVault(vault);

      res.json({
        status: 'success',
        httpStatus: result.status,
        sheetResponse: result.data,
        syncedAt: nowIso,
        state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
      });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to reach Google Sheet Webhook',
      });
    }
  });

  app.post('/api/sheets/test', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can test shop webhooks.' });
      return;
    }

    const { shopId, webhookUrl } = (req.body ?? {}) as { shopId?: string; webhookUrl?: string };
    if (!shopId) {
      res.status(400).json({ status: 'error', message: 'shopId is required.' });
      return;
    }

    const shop = vault.appData.shops.find((s) => s.id === shopId);
    const sec = vault.shopSecrets[shopId];
    const targetUrl = (webhookUrl ?? sec?.webhookUrl ?? '').trim();

    if (!targetUrl || !isValidAppsScriptUrl(targetUrl)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid Google Apps Script URL. Only https://script.google.com/macros/s/... is allowed.',
      });
      return;
    }

    try {
      const result = await forwardToGoogleSheetWeb(targetUrl, sec?.sheetSecret ?? '', {
        source: 'HishabKhataPro',
        action: 'ping',
        shopId,
        shopName: shop?.name ?? shopId,
        syncedAt: new Date().toISOString(),
      });

      if (!result.ok) {
        res.status(502).json({
          status: 'error',
          message: String(result.data?.message || `Webhook responded with HTTP ${result.status}`),
          details: result.data,
        });
        return;
      }

      res.json({
        status: 'success',
        message: 'Google Sheet Webhook verified with per-shop secret.',
        sheetResponse: result.data,
      });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  });

  app.post('/api/sheets/restore', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const { shopId } = (req.body ?? {}) as { shopId?: string };

    if (!shopId || !canAccessShop(user, shopId)) {
      res.status(403).json({ status: 'error', message: 'Forbidden: Shop access denied.' });
      return;
    }

    const shop = vault.appData.shops.find((s) => s.id === shopId);
    const sec = vault.shopSecrets[shopId];
    if (!shop || !sec?.webhookUrl || !isValidAppsScriptUrl(sec.webhookUrl)) {
      res.status(400).json({
        status: 'error',
        message: 'No Google Apps Script Webhook URL is configured for this shop.',
      });
      return;
    }

    try {
      const result = await forwardToGoogleSheetWeb(sec.webhookUrl, sec.sheetSecret, {
        source: 'HishabKhataPro',
        action: 'restore',
        shopId: shop.id,
        shopName: shop.name,
        syncedAt: new Date().toISOString(),
      });

      const snapshot = result.data?.snapshot as ShopDataSnapshot | undefined;
      if (!result.ok || !snapshot || !snapshot.shop) {
        res.status(502).json({
          status: 'error',
          message: String(result.data?.message || 'Could not restore snapshot from Google Sheet.'),
        });
        return;
      }

      if (snapshot.shop.id !== shopId) {
        res.status(403).json({
          status: 'error',
          message: 'Cross-shop restore blocked: Google Sheet belongs to another shop.',
        });
        return;
      }

      const restored = applyRestoredShopSnapshot(
        {
          isAuthenticated: true,
          language: vault.appData.language,
          currentUserId: user.id,
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
        shopId
      );
      const { isAuthenticated: _ia, currentUserId: _cu, users: _u, ...restoredData } = restored;
      vault.appData = restoredData;
      saveVault(vault);

      res.json({
        status: 'success',
        state: buildSanitizedStateForUser(vault, user, req.session?.unlockedShopIds ?? []),
      });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Restore failed.',
      });
    }
  });

  app.post('/api/reset', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'admin') {
      res.status(403).json({ status: 'error', message: 'Only admin can reset account data.' });
      return;
    }

    const seed = createSeedState();
    const { isAuthenticated: _auth, users: _u, currentUserId: _uid, ...rest } = seed;
    vault = {
      ...vault,
      shopSecrets: {
        shop_main: {
          webhookUrl: '',
          sheetSecret: generateShopSecret(),
        },
      },
      appData: rest,
    };
    saveVault(vault);

    res.json({
      state: buildSanitizedStateForUser(vault, user, []),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
