import crypto from 'node:crypto';
import { buildMessages } from '../../../lib/server/prompt.js';
import { loadRules } from '../../../lib/server/rules.js';
import { executeGatewayChat } from '../../../lib/server/gateway-client.js';
import * as db from '../../../lib/server/persistence/index.js';
import { corsPreflight, jsonWithCors } from '../../../lib/server/cors.js';
import { safeJson } from '../../../lib/server/http.js';
import { CHAT_MODEL } from '../../../lib/server/env.js';
import { deriveClientId } from '../../../lib/server/session.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function POST(request) {
  const body = await safeJson(request);
  const {
    chat_mode,
    conversation_history,
    user_message,
    optional_context,
    conversation_id: bodyConversationId,
    email: bodyEmail,
  } = body ?? {};

  const email = typeof bodyEmail === 'string' && bodyEmail.trim() !== '' && bodyEmail.length <= 320
    ? bodyEmail.trim()
    : null;

  if (!chat_mode || typeof chat_mode !== 'string') {
    return jsonWithCors(request, { error: 'chat_mode is required' }, { status: 400 });
  }
  if (!Array.isArray(conversation_history)) {
    return jsonWithCors(request, { error: 'conversation_history must be an array' }, { status: 400 });
  }
  if (typeof user_message !== 'string') {
    return jsonWithCors(request, { error: 'user_message is required' }, { status: 400 });
  }

  const rulesResult = loadRules(chat_mode);
  if (!rulesResult) {
    return jsonWithCors(request, { error: 'Unknown chat mode' }, { status: 404 });
  }

  const rulesText = rulesResult.meta?.rulesOnly ?? rulesResult.content;
  const messages = buildMessages(rulesText, conversation_history, user_message, optional_context);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const { content, usage, model: gatewayModel } = await executeGatewayChat({
      messages,
      requestId,
    });

    const modelToUse = typeof gatewayModel === 'string' && gatewayModel.trim()
      ? gatewayModel.trim().slice(0, 128)
      : (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const modelForPayload = modelToUse || (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const modelForDb = modelForPayload || 'unknown';
    const payload = { content, model: modelForPayload };
    if (usage !== undefined) payload.usage = usage;

    if (db.isConfigured()) {
      try {
        await db.ensureTables();
        const clientId = await deriveClientId(request);
        const conversationId = typeof bodyConversationId === 'string' && bodyConversationId.trim() !== ''
          ? bodyConversationId.trim().slice(0, 64)
          : crypto.randomUUID();
        let emailForMessages = await db.getSessionEmail(clientId);
        if (email) {
          await db.upsertSession(clientId, email);
          await db.backfillEmailForClient(clientId, email);
          emailForMessages = email;
        }
        await db.insertMessages(
          clientId,
          conversationId,
          chat_mode,
          [
            { role: 'user', content: user_message },
            { role: 'assistant', content: payload.content || '', model: modelForDb, usage: payload.usage },
          ],
          emailForMessages
        );
        payload.conversation_id = conversationId;
      } catch (dbErr) {
        console.error('[chat] Persist error:', dbErr.message);
      }
    }

    return jsonWithCors(request, payload);
  } catch (err) {
    const status = err.status || 502;
    return jsonWithCors(request, { error: err.message || 'Gateway request failed' }, { status });
  }
}
