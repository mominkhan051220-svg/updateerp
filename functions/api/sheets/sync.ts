export async function onRequestPost(context: { request: Request }) {
  try {
    const body = (await context.request.json()) as {
      webhookUrl?: string;
      shopId?: string;
      shopName?: string;
      action?: string;
      collection?: string;
      record?: unknown;
      fullSnapshot?: unknown;
    };

    const webhookUrl = body?.webhookUrl;
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid or missing HTTPS Google Apps Script Webhook URL.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'HishabKhataPro-CloudflareWorker',
        shopId: body.shopId,
        shopName: body.shopName,
        action: body.action || 'upsert',
        collection: body.collection || 'general',
        record: body.record ?? null,
        fullSnapshot: body.fullSnapshot ?? null,
        syncedAt: new Date().toISOString(),
      }),
      redirect: 'follow',
    });

    const text = await upstream.text();
    let sheetResponse: unknown = text;
    try {
      sheetResponse = JSON.parse(text);
    } catch {
      // Keep plain text response
    }

    return new Response(
      JSON.stringify({
        status: upstream.ok ? 'success' : 'error',
        httpStatus: upstream.status,
        sheetResponse,
        syncedAt: new Date().toISOString(),
      }),
      {
        status: upstream.ok ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: err instanceof Error ? err.message : 'Cloudflare Worker proxy error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
