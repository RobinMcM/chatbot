import { buildMessages } from '../../../lib/server/prompt.js';
import { DEFAULT_RULE_ID, loadRulesWithFallback } from '../../../lib/server/rules.js';
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
    optional_context,
    model: bodyModel,
  } = body ?? {};
  const modelOverride = typeof bodyModel === 'string' && bodyModel.trim() !== ''
    ? bodyModel.trim().slice(0, 128)
    : null;
  const normalizedAllowlist = Array.isArray(CHAT_MODEL_ALLOWLIST)
    ? CHAT_MODEL_ALLOWLIST.map((item) => item.toLowerCase())
    : [];
  if (modelOverride && normalizedAllowlist.length > 0 && !normalizedAllowlist.includes(modelOverride.toLowerCase())) {
    return jsonWithCors(request, { error: 'Requested model is not allowed' }, { status: 400 });
  }
  const selectedModel = modelOverride && normalizedAllowlist.length > 0
    ? (normalizedAllowlist.includes(modelOverride.toLowerCase()) ? modelOverride : null)
    : modelOverride;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  console.log('[chatbot-api] request received', {
    requestId,
    requestedMode: typeof chat_mode === 'string' ? chat_mode : null,
    selectedModel: selectedModel || null,
    allowlistCount: normalizedAllowlist.length,
    conversationCount: Array.isArray(conversation_history) ? conversation_history.length : null,
    userMessageLength: typeof user_message === 'string' ? user_message.length : null,
  });

  const requestedMode = typeof chat_mode === 'string' && chat_mode.trim() ? chat_mode.trim() : DEFAULT_RULE_ID;
  if (!Array.isArray(conversation_history)) {
    return jsonWithCors(request, { error: 'conversation_history must be an array' }, { status: 400 });
  }
  if (typeof user_message !== 'string') {
    return jsonWithCors(request, { error: 'user_message is required' }, { status: 400 });
  }

  const rulesResolution = loadRulesWithFallback(requestedMode);
  if (!rulesResolution) {
    return jsonWithCors(request, { error: 'No rules template available (including fallback)' }, { status: 500 });
  }

  const rulesText = rulesResolution.loaded.meta?.rulesOnly ?? rulesResolution.loaded.content;
  const messages = buildMessages(rulesText, conversation_history, user_message, optional_context);
  try {
    const { content, usage, model: gatewayModel } = await executeGatewayChat({
      messages,
      requestId,
      model: selectedModel,
    });

    const modelToUse = typeof gatewayModel === 'string' && gatewayModel.trim()
      ? gatewayModel.trim().slice(0, 128)
      : (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const modelForPayload = modelToUse || (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const payload = { content, model: modelForPayload, chat_mode: rulesResolution.ruleId };
    if (usage !== undefined) payload.usage = usage;
    console.log('[chatbot-api] response success', {
      requestId,
      resolvedRule: rulesResolution.ruleId,
      model: payload.model || null,
      contentLength: typeof payload.content === 'string' ? payload.content.length : 0,
    });

    return jsonWithCors(request, payload);
  } catch (err) {
    const status = err.status || 502;
    console.error('[chatbot-api] response error', {
      requestId,
      status,
      message: err.message || 'Gateway request failed',
      resolvedRule: rulesResolution.ruleId,
      selectedModel: selectedModel || null,
    });
    return jsonWithCors(request, { error: err.message || 'Gateway request failed' }, { status });
  }
}
