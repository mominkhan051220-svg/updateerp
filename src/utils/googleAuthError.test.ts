import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGoogleAuthError } from './googleAuthError';

test('formats auth/unauthorized-domain with exact hostname in bn and en', () => {
  const err = Object.assign(new Error('Firebase: Error (auth/unauthorized-domain).'), {
    code: 'auth/unauthorized-domain',
  });

  const bn = formatGoogleAuthError(err, 'bn', 'hishabkhatapro.pages.dev');
  assert.match(bn, /hishabkhatapro\.pages\.dev/);
  assert.match(bn, /Authorized domains/);

  const en = formatGoogleAuthError(err, 'en', 'hishabkhatapro.pages.dev');
  assert.match(en, /hishabkhatapro\.pages\.dev/);
  assert.match(en, /Firebase Console/);
});

test('formats popup-closed-by-user and popup-blocked clearly', () => {
  const closedErr = { code: 'auth/popup-closed-by-user' };
  const blockedErr = { code: 'auth/popup-blocked' };

  assert.match(
    formatGoogleAuthError(closedErr, 'bn', 'hishabkhatapro.pages.dev'),
    /Authorized Domains/
  );
  assert.match(formatGoogleAuthError(blockedErr, 'en', 'hishabkhatapro.pages.dev'), /allow popups/i);
});

test('falls back to error message when unknown error occurs', () => {
  const err = new Error('Custom OAuth failure');
  assert.equal(formatGoogleAuthError(err, 'en', 'example.com'), 'Custom OAuth failure');
});
