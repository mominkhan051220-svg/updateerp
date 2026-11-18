import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateShopSecret,
  hashPassword,
  isValidAppsScriptUrl,
  maskSecretValue,
  maskWebhookUrl,
  sanitizeSheetCell,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './securityCore';
import {
  hashPasswordWeb,
  signSessionTokenWeb,
  verifyPasswordWeb,
  verifySessionTokenWeb,
} from './webCryptoSecurity';
import { canDeleteUser } from './userManagement';
import { applyRestoredShopSnapshot, buildShopSnapshot } from './shopSnapshot';
import { createSeedState } from '../data/seedData';
import { DEFAULT_BOOTSTRAP_EMAIL, DEFAULT_BOOTSTRAP_PASSWORD_HASH } from './vaultCore';

test('PBKDF2-SHA256 password hashing and constant-time verification', () => {
  const hash = hashPassword('StrongPass!987');
  assert.ok(hash.startsWith('pbkdf2_sha256$100000$'));
  assert.equal(verifyPassword('StrongPass!987', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
  assert.equal(verifyPassword('', hash), false);
});

test('WebCrypto PBKDF2 and HMAC tokens match Node securityCore for Cloudflare Workers', async () => {
  const nodeHash = hashPassword('Cloudflare!2026');
  assert.equal(await verifyPasswordWeb('Cloudflare!2026', nodeHash), true);
  assert.equal(await verifyPasswordWeb('wrong', nodeHash), false);

  const webHash = await hashPasswordWeb('EdgeAdmin!99');
  assert.equal(verifyPassword('EdgeAdmin!99', webHash), true);

  assert.equal(await verifyPasswordWeb('Momin1234@', DEFAULT_BOOTSTRAP_PASSWORD_HASH), true);

  const secret = 'cloudflare-edge-session-secret-32chars!';
  const payload = {
    userId: 'user_1',
    username: 'owner@shop.com',
    role: 'admin' as const,
    assignedShopId: 'shop_main',
    unlockedShopIds: ['shop_main'],
    iat: Date.now(),
    exp: Date.now() + 60_000,
  };
  const webToken = await signSessionTokenWeb(payload, secret);
  assert.equal(verifySessionToken(webToken, secret)?.username, 'owner@shop.com');

  const nodeToken = signSessionToken(payload, secret);
  assert.equal((await verifySessionTokenWeb(nodeToken, secret))?.userId, 'user_1');
});

test('HMAC-SHA256 session tokens reject tampering and expiration', () => {
  const secret = 'test-hmac-secret-at-least-32-bytes-long';
  const token = signSessionToken(
    {
      userId: 'user_admin',
      username: 'owner@example.com',
      role: 'admin',
      assignedShopId: 'shop_main',
      unlockedShopIds: [],
      iat: Date.now(),
      exp: Date.now() + 60_000,
    },
    secret
  );

  const verified = verifySessionToken(token, secret);
  assert.ok(verified);
  assert.equal(verified.userId, 'user_admin');

  // Tampered payload must be rejected
  const tampered = `x${token.slice(1)}`;
  assert.equal(verifySessionToken(tampered, secret), null);

  // Wrong secret must be rejected
  assert.equal(verifySessionToken(token, 'wrong-secret'), null);

  // Expired token must be rejected
  const expired = signSessionToken(
    {
      userId: 'user_admin',
      username: 'owner@example.com',
      role: 'admin',
      assignedShopId: 'shop_main',
      unlockedShopIds: [],
      iat: Date.now() - 120_000,
      exp: Date.now() - 10_000,
    },
    secret
  );
  assert.equal(verifySessionToken(expired, secret), null);
});

test('isValidAppsScriptUrl prevents SSRF by allowing only official Google Apps Script HTTPS URLs', () => {
  assert.equal(isValidAppsScriptUrl('https://script.google.com/macros/s/AKfycb1234567890abcdef/exec'), true);
  assert.equal(isValidAppsScriptUrl('https://script.googleusercontent.com/macros/s/AKfycb1234567890abcdef/exec'), true);

  assert.equal(isValidAppsScriptUrl('http://script.google.com/macros/s/AKfycb1234567890abcdef/exec'), false);
  assert.equal(isValidAppsScriptUrl('https://127.0.0.1/macros/s/AKfycb1234567890/exec'), false);
  assert.equal(isValidAppsScriptUrl('https://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isValidAppsScriptUrl('https://evil.example.com/macros/s/1234567890123456/exec'), false);
});

test('per-shop secret generation, masking, and formula injection sanitization', () => {
  const sec = generateShopSecret();
  assert.ok(sec.startsWith('hk_shop_'));
  assert.ok(maskSecretValue(sec).includes('••••••••'));
  assert.equal(
    maskWebhookUrl('https://script.google.com/macros/s/AKfycbSECRET/exec'),
    'https://script.google.com/macros/s/••••T/exec'
  );
  assert.equal(sanitizeSheetCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  assert.equal(sanitizeSheetCell('+1234'), "'+1234");
  assert.equal(sanitizeSheetCell('Normal Item'), 'Normal Item');
});

test('applyRestoredShopSnapshot blocks cross-shop restores', () => {
  const base = createSeedState();
  const stateWithTwo = {
    ...base,
    shops: [
      { ...base.shops[0], id: 'shop_a', name: 'Shop A' },
      { ...base.shops[0], id: 'shop_b', name: 'Shop B' },
    ],
  };

  const snapB = buildShopSnapshot(stateWithTwo, 'shop_b')!;
  assert.throws(
    () => applyRestoredShopSnapshot(stateWithTwo, snapB, 'shop_a'),
    /Cross-shop restore blocked/
  );
});

test('canDeleteUser allows deleting staff and default admin email once another admin exists', () => {
  const defaultAdmin = { id: 'user_admin', role: 'admin' as const, username: DEFAULT_BOOTSTRAP_EMAIL };
  const secondAdmin = { id: 'user_admin_2', role: 'admin' as const, username: 'owner@newshop.com' };
  const staffUser = { id: 'user_staff_1', role: 'staff' as const, username: 'sales@newshop.com' };

  // Cannot delete the sole remaining admin
  const onlyOneAdmin = canDeleteUser([defaultAdmin, staffUser], defaultAdmin, 'user_admin');
  assert.equal(onlyOneAdmin.allowed, false);
  assert.equal(onlyOneAdmin.reason, 'AT_LEAST_ONE_ADMIN_REQUIRED');

  // Admin can delete staff user
  assert.equal(canDeleteUser([defaultAdmin, staffUser], defaultAdmin, 'user_staff_1').allowed, true);

  // Staff cannot delete anyone
  const staffAttempt = canDeleteUser([defaultAdmin, staffUser], staffUser, 'user_admin');
  assert.equal(staffAttempt.allowed, false);
  assert.equal(staffAttempt.reason, 'FORBIDDEN');

  // Once a second admin exists, default email can be deleted by the new admin OR by itself
  assert.equal(
    canDeleteUser([defaultAdmin, secondAdmin], secondAdmin, 'user_admin').allowed,
    true
  );
  assert.equal(
    canDeleteUser([defaultAdmin, secondAdmin], defaultAdmin, 'user_admin').allowed,
    true
  );
});

test('Cloudflare Pages Function handles login, user creation, and deleting default admin email via KV', async () => {
  const { onRequest } = await import('../../functions/api/[[route]]');

  const store = new Map<string, string>();
  const mockKv = {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  const env = { HISHAB_KV: mockKv };

  // 1. Health check
  const healthRes = await onRequest({
    request: new Request('https://hishabkhata.pages.dev/api/health', { method: 'GET' }),
    env,
  });
  assert.equal(healthRes.status, 200);
  const healthData = (await healthRes.json()) as { runtime: string; kvBound: boolean };
  assert.equal(healthData.runtime, 'cloudflare-pages');
  assert.equal(healthData.kvBound, true);

  // 2. Login with default admin
  const loginRes = await onRequest({
    request: new Request('https://hishabkhata.pages.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ username: DEFAULT_BOOTSTRAP_EMAIL, password: 'Momin1234@' }),
    }),
    env,
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  assert.ok(setCookie.includes('hk_session='));
  const cookiePair = setCookie.split(';')[0];

  // 3. Create second admin
  const createRes = await onRequest({
    request: new Request('https://hishabkhata.pages.dev/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookiePair,
      },
      body: JSON.stringify({
        name: 'CF Owner',
        username: 'cf@owner.com',
        password: 'CfPassword123!',
        role: 'admin',
        assignedShopId: 'shop_main',
        permissions: {},
      }),
    }),
    env,
  });
  assert.equal(createRes.status, 200);

  // 4. Delete default admin email (user_admin) while signed in
  const delRes = await onRequest({
    request: new Request('https://hishabkhata.pages.dev/api/users/user_admin', {
      method: 'DELETE',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookiePair,
      },
    }),
    env,
  });
  assert.equal(delRes.status, 200);
  const delData = (await delRes.json()) as { deletedSelf: boolean };
  assert.equal(delData.deletedSelf, true);

  // 5. Default admin email cannot log in anymore; new CF admin logs in cleanly
  const oldLoginRes = await onRequest({
    request: new Request('https://hishabkhata.pages.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ username: DEFAULT_BOOTSTRAP_EMAIL, password: 'Momin1234@' }),
    }),
    env,
  });
  assert.equal(oldLoginRes.status, 401);

  const newLoginRes = await onRequest({
    request: new Request('https://hishabkhata.pages.dev/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ username: 'cf@owner.com', password: 'CfPassword123!' }),
    }),
    env,
  });
  assert.equal(newLoginRes.status, 200);
});
