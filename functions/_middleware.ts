import firebaseConfig from '../firebase-applet-config.json';
import {
  buildFirebaseProxyRequestHeaders,
  buildFirebaseProxyTargetUrl,
  shouldUseFirebaseProxyPath,
} from '../src/utils/firebaseAuthProxy';

interface PagesMiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const { request, next } = context;
  const url = new URL(request.url);

  if (!shouldUseFirebaseProxyPath(url.pathname)) {
    return next();
  }

  const targetUrl = buildFirebaseProxyTargetUrl(request.url, firebaseConfig.authDomain);
  const method = request.method.toUpperCase();
  const headers = buildFirebaseProxyRequestHeaders(request.headers);

  const upstreamRes = await fetch(targetUrl, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const respHeaders = new Headers(upstreamRes.headers);
  respHeaders.delete('transfer-encoding');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: respHeaders,
  });
}
