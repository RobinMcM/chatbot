import crypto from 'node:crypto';

export async function deriveClientId(request) {
  let body = null;
  try {
    if (request.method !== 'GET' && request.method !== 'DELETE' && request.method !== 'HEAD') {
      body = await request.clone().json();
    }
  } catch {
    body = null;
  }

  const url = new URL(request.url);
  const sessionId = body?.session_id
    ?? request.headers.get('x-session-id')
    ?? url.searchParams.get('session_id');

  if (typeof sessionId === 'string' && sessionId.trim() !== '') {
    return sessionId.trim().slice(0, 256);
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = (forwardedFor ? forwardedFor.split(',')[0] : null)
    || request.headers.get('x-real-ip')
    || 'unknown';

  return crypto.createHash('sha256').update(ip).digest('hex');
}
