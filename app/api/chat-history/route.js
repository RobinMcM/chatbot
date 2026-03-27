import * as db from '../../../lib/server/persistence/index.js';
import { corsPreflight, jsonWithCors } from '../../../lib/server/cors.js';
import { deriveClientId } from '../../../lib/server/session.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function GET(request) {
  if (!db.isConfigured()) {
    return jsonWithCors(request, { error: 'Persistence not configured' }, { status: 503 });
  }
  try {
    const url = new URL(request.url);
    const email = typeof url.searchParams.get('email') === 'string'
      ? url.searchParams.get('email').trim()
      : null;
    const chatMode = typeof url.searchParams.get('chat_mode') === 'string'
      ? url.searchParams.get('chat_mode').trim() || null
      : null;
    const clientId = email ? await db.getClientIdByEmail(email) : await deriveClientId(request);
    if (!clientId && !email) return jsonWithCors(request, { conversations: [] });

    const usePreview = !!chatMode;
    const conversations = usePreview
      ? await db.getConversationsWithPreview(clientId || '', email || undefined, chatMode)
      : await db.getConversations(clientId, email || undefined, chatMode);
    return jsonWithCors(request, { conversations });
  } catch (err) {
    return jsonWithCors(request, { error: err.message || 'Failed to list history' }, { status: 500 });
  }
}
