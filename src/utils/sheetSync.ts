import { Shop } from '../types';

export interface SheetSyncResult {
  synced: boolean;
  status: 'synced' | 'local_only' | 'error';
  message: string;
}

export async function syncRecordToGoogleSheet(
  shop: Shop | undefined,
  collection: string,
  action: 'upsert' | 'delete' | 'ping' | 'full_sync',
  record: unknown
): Promise<SheetSyncResult> {
  if (!shop || !shop.webhookUrl.trim()) {
    return {
      synced: false,
      status: 'local_only',
      message: 'No Google Sheet Webhook URL bound to this shop yet (saved locally).',
    };
  }

  try {
    const res = await fetch('/api/sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: shop.webhookUrl.trim(),
        shopId: shop.id,
        shopName: shop.name,
        action,
        collection,
        record,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      return {
        synced: false,
        status: 'error',
        message: data.message || 'Google Sheet sync failed',
      };
    }

    return {
      synced: true,
      status: 'synced',
      message: `Synced to ${shop.name} Google Sheet`,
    };
  } catch (err) {
    return {
      synced: false,
      status: 'error',
      message: err instanceof Error ? err.message : 'Network error syncing Google Sheet',
    };
  }
}

export async function testGoogleSheetWebhook(shop: Shop): Promise<SheetSyncResult> {
  if (!shop.webhookUrl.trim()) {
    return {
      synced: false,
      status: 'error',
      message: 'Please enter a valid Google Apps Script Web App URL first.',
    };
  }

  try {
    const res = await fetch('/api/sheets/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: shop.webhookUrl.trim(),
        shopId: shop.id,
        shopName: shop.name,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      return {
        synced: false,
        status: 'error',
        message: data.message || 'Webhook test failed',
      };
    }
    return {
      synced: true,
      status: 'synced',
      message: data.message || 'Connected to Google Sheet',
    };
  } catch (err) {
    return {
      synced: false,
      status: 'error',
      message: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
