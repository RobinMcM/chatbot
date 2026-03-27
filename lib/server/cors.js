import { CHATBOT_CORS_ALLOWED_ORIGINS, parseAllowedOrigins } from './env.js';

export function getAllowedOrigin(request) {
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) return null;
  const allowed = parseAllowedOrigins(CHATBOT_CORS_ALLOWED_ORIGINS);
  if (allowed.includes('*')) return '*';
  if (allowed.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function applyCorsHeaders(request, headers = new Headers()) {
  const allowOrigin = getAllowedOrigin(request);
  if (!allowOrigin) return headers;
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
  return headers;
}

export function corsPreflight(request) {
  const headers = applyCorsHeaders(request, new Headers());
  return new Response(null, { status: 204, headers });
}

export function jsonWithCors(request, payload, init = {}) {
  const headers = applyCorsHeaders(request, new Headers(init.headers || {}));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

export function textWithCors(request, text, init = {}) {
  const headers = applyCorsHeaders(request, new Headers(init.headers || {}));
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(text, { ...init, headers });
}
