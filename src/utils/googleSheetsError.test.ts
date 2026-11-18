import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGoogleSheetsApiError } from './googleSheetsError';

test('detects disabled Google Sheets API and includes activation URL', () => {
  const raw = JSON.stringify({
    error: {
      code: 403,
      status: 'PERMISSION_DENIED',
      message:
        'Google Sheets API has not been used in project 622941525694 before or it is disabled.',
      details: [
        {
          reason: 'SERVICE_DISABLED',
          metadata: {
            activationUrl:
              'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=622941525694',
          },
        },
      ],
    },
  });

  const err = formatGoogleSheetsApiError(403, raw, 'bn');
  assert.equal(err.reason, 'SERVICE_DISABLED');
  assert.equal(err.requiresReauth, false);
  assert.match(err.message, /sheets\.googleapis\.com/);
});

test('detects insufficient OAuth scopes and marks requiresReauth true', () => {
  const raw = JSON.stringify({
    error: {
      code: 403,
      status: 'PERMISSION_DENIED',
      message: 'Request had insufficient authentication scopes.',
      details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
    },
  });

  const err = formatGoogleSheetsApiError(403, raw, 'bn');
  assert.equal(err.reason, 'ACCESS_TOKEN_SCOPE_INSUFFICIENT');
  assert.equal(err.requiresReauth, true);
  assert.match(err.message, /Checkbox|টিক/i);
});

test('detects 401 UNAUTHENTICATED and marks requiresReauth true', () => {
  const err = formatGoogleSheetsApiError(
    401,
    JSON.stringify({ error: { code: 401, status: 'UNAUTHENTICATED', message: 'Invalid Credentials' } }),
    'en'
  );
  assert.equal(err.requiresReauth, true);
  assert.match(err.message, /expired/i);
});
