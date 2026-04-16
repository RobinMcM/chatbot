import { findMode } from '../../../lib/server/modes.js';
import { buildMessages } from '../../../lib/server/prompt.js';
import { executeGatewayChat } from '../../../lib/server/gateway-client.js';
import { corsPreflight, jsonWithCors } from '../../../lib/server/cors.js';
import { safeJson } from '../../../lib/server/http.js';
import { CHAT_MODEL, CHAT_MODEL_ALLOWLIST } from '../../../lib/server/env.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export async function POST(request) {
  const body = await safeJson(request);
  const {
    chat_mode,
    conversation_history,
    user_message,
    page_context,
    model: bodyModel,
  } = body ?? {};

  if (!Array.isArray(conversation_history)) {
    return jsonWithCors(request, { error: 'conversation_history must be an array' }, { status: 400 });
  }
  if (typeof user_message !== 'string' || !user_message.trim()) {
    return jsonWithCors(request, { error: 'user_message is required' }, { status: 400 });
  }

  const modelOverride = typeof bodyModel === 'string' && bodyModel.trim()
    ? bodyModel.trim().slice(0, 128)
    : null;
  const normalizedAllowlist = Array.isArray(CHAT_MODEL_ALLOWLIST)
    ? CHAT_MODEL_ALLOWLIST.map((m) => m.toLowerCase())
    : [];
  if (modelOverride && normalizedAllowlist.length > 0 && !normalizedAllowlist.includes(modelOverride.toLowerCase())) {
    return jsonWithCors(request, { error: 'Requested model is not allowed' }, { status: 400 });
  }
  const selectedModel = modelOverride || null;

  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const mode = findMode(chat_mode);

  console.log('[movieshaker-chatbot] request', {
    requestId,
    modeId: mode.id,
    selectedModel,
    conversationCount: conversation_history.length,
    userMessageLength: user_message.length,
    hasPageContext: !!(page_context && page_context.trim()),
  });

  const messages = buildMessages(
    mode.systemPrompt,
    conversation_history,
    user_message,
    page_context,
  );

  try {
    const { content, usage, model: gatewayModel } = await executeGatewayChat({
      messages,
      requestId,
      model: selectedModel,
    });

    const resolvedModel = (typeof gatewayModel === 'string' && gatewayModel.trim()
      ? gatewayModel.trim()
      : null) ?? (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);

    const payload = {
      content,
      model: resolvedModel,
      chat_mode: mode.id,
    };
    if (usage !== undefined) payload.usage = usage;

    console.log('[movieshaker-chatbot] response success', {
      requestId,
      modeId: mode.id,
      model: resolvedModel,
      contentLength: typeof content === 'string' ? content.length : 0,
    });

    return jsonWithCors(request, payload);
  } catch (err) {
    const status = err.status || 502;
    console.error('[movieshaker-chatbot] response error', {
      requestId,
      status,
      message: err.message || 'Gateway request failed',
      modeId: mode.id,
    });
    return jsonWithCors(request, { error: err.message || 'Gateway request failed' }, { status });
  }
}
