import { buildMessages } from '../../../lib/server/prompt.js';
import { loadRules } from '../../../lib/server/rules.js';
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
      model: selectedModel,
    });

    const modelToUse = typeof gatewayModel === 'string' && gatewayModel.trim()
      ? gatewayModel.trim().slice(0, 128)
      : (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const modelForPayload = modelToUse || (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const payload = { content, model: modelForPayload };
    if (usage !== undefined) payload.usage = usage;

    return jsonWithCors(request, payload);
  } catch (err) {
    const status = err.status || 502;
    return jsonWithCors(request, { error: err.message || 'Gateway request failed' }, { status });
  }
}
