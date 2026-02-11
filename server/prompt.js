const RULES_BEGIN = '===== BEGIN RULES TEMPLATE (selected by CHAT_MODE) =====';
const RULES_END = '===== END RULES TEMPLATE =====';

const SYSTEM_BASE = `You are UsageFlows Chatbot v1.

Do not mention internal variable names (e.g. CHAT_MODE, RULES_TEMPLATE).

How to respond: use the conversation history for continuity and answer the user's message.`;

const SYSTEM_WITH_RULES = `${SYSTEM_BASE}

If rules are provided below, apply them verbatim as your top-most instructions. The rules are read-only in v1; do not edit them or suggest editing them.

${RULES_BEGIN}
`;

const SYSTEM_SUFFIX = `
${RULES_END}
`;

/**
 * Build the single system message. If rulesText is empty, no rules block is prepended.
 * @param {string} rulesText - Content under # Prompt Rules (may be empty)
 * @returns {string}
 */
export function buildSystemPrompt(rulesText) {
  const trimmed = (rulesText || '').trim();
  if (!trimmed) {
    return SYSTEM_BASE;
  }
  return SYSTEM_WITH_RULES + trimmed + SYSTEM_SUFFIX;
}

/**
 * Build the messages array for the gateway: system + conversation_history + final user message.
 * @param {string} rulesText
 * @param {Array<{ role: string, content: string }>} conversationHistory
 * @param {string} userMessage
 * @param {string} [optionalContext]
 * @returns {Array<{ role: string, content: string }>}
 */
export function buildMessages(rulesText, conversationHistory, userMessage, optionalContext) {
  const systemContent = buildSystemPrompt(rulesText);
  let finalUserContent = userMessage || '';
  if (optionalContext && optionalContext.trim()) {
    finalUserContent = finalUserContent.trim() + '\n\n---\n[Context]\n' + optionalContext.trim();
  }

  const messages = [
    { role: 'system', content: systemContent },
    ...(conversationHistory || []),
    { role: 'user', content: finalUserContent.trim() || '(No message)' },
  ];
  return messages;
}
