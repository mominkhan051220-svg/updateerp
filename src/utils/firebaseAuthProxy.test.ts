import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFirebaseProxyRequestHeaders,
  buildFirebaseProxyTargetUrl,
  getEffectiveFirebaseConfig,
  isLikelyMobileBrowser,
  isLocalOrPreviewHostname,
  shouldUseFirebaseProxyPath,
} from './firebaseAuthProxy';

test('shouldUseFirebaseProxyPath matches only Firebase auth helper paths', () => {
  assert.equal(shouldUseFirebaseProxyPath('/__/auth/handler'), true);
  assert.equal(shouldUseFirebaseProxyPath('/__/auth/iframe'), true);
  assert.equal(shouldUseFirebaseProxyPath('/__/firebase/init.json'), true);
  assert.equal(shouldUseFirebaseProxyPath('/api/auth/login'), false);
  assert.equal(shouldUseFirebaseProxyPath('/'), false);
});

test('buildFirebaseProxyTargetUrl preserves pathname and query string', () => {
  const target = buildFirebaseProxyTargetUrl(
    'https://hishabkhatapro.pages.dev/__/auth/handler?apiKey=abc&providerId=google.com',
    'gen-lang-client-0632036924.firebaseapp.com'
  );
  assert.equal(
    target,
    'https://gen-lang-client-0632036924.firebaseapp.com/__/auth/handler?apiKey=abc&providerId=google.com'
  );
});

test('buildFirebaseProxyRequestHeaders strips host and Cloudflare forwarding headers', () => {
  const incoming = new Headers({
    Host: 'hishabkhatapro.pages.dev',
    'CF-Connecting-IP': '1.2.3.4',
    'X-Forwarded-Host': 'hishabkhatapro.pages.dev',
    'User-Agent': 'Mozilla/5.0',
    Accept: 'text/html',
  });
  const cleaned = buildFirebaseProxyRequestHeaders(incoming);
  assert.equal(cleaned.has('host'), false);
  assert.equal(cleaned.has('cf-connecting-ip'), false);
  assert.equal(cleaned.has('x-forwarded-host'), false);
  assert.equal(cleaned.get('user-agent'), 'Mozilla/5.0');
  assert.equal(cleaned.get('accept'), 'text/html');
});

test('getEffectiveFirebaseConfig uses same-origin authDomain on Cloudflare Pages and keeps firebaseapp.com on local/preview', () => {
  const base = {
    projectId: 'p1',
    appId: 'a1',
    apiKey: 'k1',
    authDomain: 'p1.firebaseapp.com',
  };

  assert.equal(isLocalOrPreviewHostname('localhost'), true);
  assert.equal(isLocalOrPreviewHostname('ais-dev-xyz.asia-east1.run.app'), true);
  assert.equal(isLocalOrPreviewHostname('hishabkhatapro.pages.dev'), false);

  assert.equal(
    getEffectiveFirebaseConfig(base, { hostname: 'localhost', host: 'localhost:3000' }).authDomain,
    'p1.firebaseapp.com'
  );
  assert.equal(
    getEffectiveFirebaseConfig(base, {
      hostname: 'hishabkhatapro.pages.dev',
      host: 'hishabkhatapro.pages.dev',
    }).authDomain,
    'hishabkhatapro.pages.dev'
  );
});

test('isLikelyMobileBrowser detects Android/iOS browsers cleanly', () => {
  assert.equal(
    isLikelyMobileBrowser(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
    ),
    true
  );
  assert.equal(
    isLikelyMobileBrowser(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
    ),
    false
  );
});
