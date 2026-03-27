import * as db from '../../../../lib/server/persistence/index.js';
import { corsPreflight, jsonWithCors } from '../../../../lib/server/cors.js';
import { deriveClientId } from '../../../../lib/server/session.js';
import { safeJson } from '../../../../lib/server/http.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function POST(request) {
  const body = await safeJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > 320) {
    return jsonWithCors(request, { error: 'Valid email required' }, { status: 400 });
  }
  if (!db.isConfigured()) {
    return jsonWithCors(request, { error: 'Persistence not configured' }, { status: 503 });
  }
  try {
    await db.ensureTables();
    const clientId = await deriveClientId(request);
    await db.upsertSession(clientId, email);
    const backfilled = await db.backfillEmailForClient(clientId, email);
    return jsonWithCors(request, { ok: true, backfilled });
  } catch (err) {
    return jsonWithCors(request, { error: err.message || 'Failed to link email' }, { status: 500 });
  }
}
