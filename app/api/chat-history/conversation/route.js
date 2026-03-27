import * as db from '../../../../lib/server/persistence/index.js';
import { corsPreflight, jsonWithCors } from '../../../../lib/server/cors.js';
import { clampString } from '../../../../lib/server/http.js';
import { deriveClientId } from '../../../../lib/server/session.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function DELETE(request) {
  const url = new URL(request.url);
  const conversationId = clampString(url.searchParams.get('conversation_id'), 64);
  if (!conversationId) {
    return jsonWithCors(request, { error: 'conversation_id required' }, { status: 400 });
  }
  if (!db.isConfigured()) {
    return jsonWithCors(request, { error: 'Persistence not configured' }, { status: 503 });
  }
  try {
    const clientId = await deriveClientId(request);
    const deleted = await db.deleteConversation(clientId, conversationId);
    return jsonWithCors(request, { ok: true, deleted });
  } catch (err) {
    return jsonWithCors(request, { error: err.message || 'Failed to delete conversation' }, { status: 500 });
  }
}
