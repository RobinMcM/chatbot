import * as db from '../../../../lib/server/persistence/index.js';
import { corsPreflight, jsonWithCors } from '../../../../lib/server/cors.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function GET(request) {
  if (!db.isConfigured()) {
    return jsonWithCors(request, { error: 'Persistence not configured' }, { status: 503 });
  }
  try {
    const url = new URL(request.url);
    const clientId = typeof url.searchParams.get('client_id') === 'string' ? url.searchParams.get('client_id').trim() || null : null;
    const email = typeof url.searchParams.get('email') === 'string' ? url.searchParams.get('email').trim() || null : null;
    const chatMode = typeof url.searchParams.get('chat_mode') === 'string' ? url.searchParams.get('chat_mode').trim() || null : null;
    const limitParam = url.searchParams.get('limit');
    const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : 200;
    const conversations = await db.getConversationsForAdmin({ clientId, email, chatMode, limit });
    return jsonWithCors(request, { conversations });
  } catch (err) {
    return jsonWithCors(request, { error: err.message || 'Failed to list history' }, { status: 500 });
  }
}
