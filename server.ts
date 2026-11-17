import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function isValidAppsScriptUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

async function forwardToGoogleSheet(webhookUrl: string, payload: unknown) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', runtime: 'express-node', timestamp: new Date().toISOString() });
  });

  app.post('/api/sheets/sync', async (req, res) => {
    const { webhookUrl, shopId, shopName, action, collection, record, fullSnapshot } = req.body ?? {};

    if (!webhookUrl || typeof webhookUrl !== 'string' || !isValidAppsScriptUrl(webhookUrl)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid or missing HTTPS Google Apps Script Webhook URL.',
      });
      return;
    }

    try {
      const result = await forwardToGoogleSheet(webhookUrl, {
        source: 'HishabKhataPro',
        shopId,
        shopName,
        action: action || 'upsert',
        collection: collection || 'general',
        record: record ?? null,
        fullSnapshot: fullSnapshot ?? null,
        syncedAt: new Date().toISOString(),
      });

      if (!result.ok) {
        res.status(502).json({
          status: 'error',
          message: `Google Apps Script returned HTTP ${result.status}`,
          details: result.data,
        });
        return;
      }

      res.json({
        status: 'success',
        httpStatus: result.status,
        sheetResponse: result.data,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to reach Google Sheet Webhook',
      });
    }
  });

  app.post('/api/sheets/test', async (req, res) => {
    const { webhookUrl, shopId, shopName } = req.body ?? {};
    if (!webhookUrl || typeof webhookUrl !== 'string' || !isValidAppsScriptUrl(webhookUrl)) {
      res.status(400).json({
        status: 'error',
        message: 'Please provide a valid https:// Google Apps Script Web App URL.',
      });
      return;
    }

    try {
      const result = await forwardToGoogleSheet(webhookUrl, {
        source: 'HishabKhataPro',
        action: 'ping',
        shopId,
        shopName,
        syncedAt: new Date().toISOString(),
      });

      if (!result.ok) {
        res.status(502).json({
          status: 'error',
          message: `Webhook responded with HTTP ${result.status}`,
          details: result.data,
        });
        return;
      }

      res.json({
        status: 'success',
        message: 'Google Sheet Webhook connected and verified.',
        sheetResponse: result.data,
      });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    }
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
