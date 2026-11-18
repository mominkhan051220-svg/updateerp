import { Shop } from '../types';

export interface SheetSyncResult {
  synced: boolean;
  status: 'synced' | 'local_only' | 'error';
  message: string;
}

export async function syncRecordToGoogleSheet(
  shop: Shop | undefined,
  collection: string,
  action: 'upsert' | 'delete' | 'ping' | 'full_sync' | 'save_snapshot',
  record: unknown,
  fullSnapshot?: unknown
): Promise<SheetSyncResult> {
  if (!shop || (!shop.hasWebhookUrl && !shop.webhookUrl?.trim())) {
    return {
      synced: false,
      status: 'local_only',
      message: 'No Google Sheet Webhook URL bound to this shop yet.',
    };
  }

  try {
    const res = await fetch('/api/sheets/sync', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        shopId: shop.id,
        shopName: shop.name,
        action,
        collection,
        record,
        fullSnapshot,
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

export async function testGoogleSheetWebhook(
  shop: Shop,
  candidateWebhookUrl?: string
): Promise<SheetSyncResult> {
  if (!candidateWebhookUrl?.trim() && !shop.hasWebhookUrl) {
    return {
      synced: false,
      status: 'error',
      message: 'Please enter a valid Google Apps Script Web App URL first.',
    };
  }

  try {
    const res = await fetch('/api/sheets/test', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        shopId: shop.id,
        shopName: shop.name,
        webhookUrl: candidateWebhookUrl?.trim() || undefined,
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
