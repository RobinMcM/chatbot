/**
 * MovieShaker Chatbot — prompt builder.
 *
 * Builds the message array for the gateway.
 * System prompt comes from the mode config (modes.js), not from files.
 */

/**
 * Build the full message array for a chat request.
 *
 * @param {string} systemPrompt - from the matched mode in modes.js
 * @param {Array}  conversationHistory - prior messages [{role, content}]
 * @param {string} userMessage - current user message
 * @param {string} [pageContext] - optional context from the current MovieShaker page
 */
export function buildMessages(systemPrompt, conversationHistory, userMessage, pageContext) {
  let finalUserContent = (userMessage || '').trim() || '(No message)';

  if (pageContext && typeof pageContext === 'string' && pageContext.trim()) {
    finalUserContent = `${finalUserContent}\n\n---\n[Page Context]\n${pageContext.trim()}`;
  }

  return [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(conversationHistory) ? conversationHistory : []),
    { role: 'user', content: finalUserContent },
  ];
}
