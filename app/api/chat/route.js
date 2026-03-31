import { buildMessages } from '../../../lib/server/prompt.js';
import { DEFAULT_RULE_ID, loadRulesWithFallback } from '../../../lib/server/rules.js';
import { executeGatewayChat } from '../../../lib/server/gateway-client.js';
import { corsPreflight, jsonWithCors } from '../../../lib/server/cors.js';
import { safeJson } from '../../../lib/server/http.js';
import { CHAT_MODEL, CHAT_MODEL_ALLOWLIST } from '../../../lib/server/env.js';

const INSUFFICIENT_CREDITS_FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

function isInsufficientCreditsError(message) {
  const text = typeof message === 'string' ? message.toLowerCase() : '';
  if (!text) return false;
  return (
    text.includes('requires more credits') ||
    text.includes('not enough credits') ||
    text.includes('insufficient credits') ||
    (text.includes('402') && text.includes('credit'))
  );
}

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
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  try {
    let gatewayResponse;
    let usedInsufficientCreditsFallback = false;
    try {
      gatewayResponse = await executeGatewayChat({
        messages,
        requestId,
        model: selectedModel,
      });
    } catch (primaryErr) {
      const primaryMessage = primaryErr?.message || '';
      const requestedOrDefaultModel = selectedModel
        || (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : '');
      const canFallback = requestedOrDefaultModel.toLowerCase() !== INSUFFICIENT_CREDITS_FALLBACK_MODEL.toLowerCase();
      if (!isInsufficientCreditsError(primaryMessage) || !canFallback) {
        throw primaryErr;
      }
      gatewayResponse = await executeGatewayChat({
        messages,
        requestId,
        model: INSUFFICIENT_CREDITS_FALLBACK_MODEL,
      });
      usedInsufficientCreditsFallback = true;
    }
    const { content, usage, model: gatewayModel } = gatewayResponse;

    const modelToUse = typeof gatewayModel === 'string' && gatewayModel.trim()
      ? gatewayModel.trim().slice(0, 128)
      : (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const modelForPayload = modelToUse || (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() ? CHAT_MODEL.trim() : null);
    const payload = { content, model: modelForPayload, chat_mode: rulesResolution.ruleId };
    if (usage !== undefined) payload.usage = usage;
    if (usedInsufficientCreditsFallback) payload.model_fallback_used = true;

    return jsonWithCors(request, payload);
  } catch (err) {
    const status = err.status || 502;
    return jsonWithCors(request, { error: err.message || 'Gateway request failed' }, { status });
  }
}
