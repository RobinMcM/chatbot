import * as db from '../../../../lib/server/persistence/index.js';
import { corsPreflight, jsonWithCors } from '../../../../lib/server/cors.js';
import { clampString } from '../../../../lib/server/http.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function GET(request) {
  const url = new URL(request.url);
  const clientId = clampString(url.searchParams.get('client_id'), 256);
  const conversationId = clampString(url.searchParams.get('conversation_id'), 64);

  if (!clientId || !conversationId) {
    return jsonWithCors(request, { error: 'client_id and conversation_id required' }, { status: 400 });
  }
  if (!db.isConfigured()) {
    return jsonWithCors(request, { error: 'Persistence not configured' }, { status: 503 });
  }

  try {
    const messages = await db.getMessages(clientId, conversationId);
    return jsonWithCors(request, { messages });
  } catch (err) {
    return jsonWithCors(request, { error: err.message || 'Failed to load messages' }, { status: 500 });
  }
}
