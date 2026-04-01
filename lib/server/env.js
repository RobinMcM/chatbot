export const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'https://models.rapidmvp.io';
export const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || process.env.GATEWAY_INTERNAL_API_KEY;
export const CHAT_MODEL = process.env.CHAT_MODEL || 'openai/gpt-5-mini';
export const CHAT_MODEL_ALLOWLIST = String(process.env.CHAT_MODEL_ALLOWLIST || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
export const GATEWAY_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS) || 120000;
export const CHATBOT_FRAME_ANCESTORS = process.env.CHATBOT_FRAME_ANCESTORS
  || "'self' https://rapidmvp.io https://www.rapidmvp.io https://*.sharepoint.com";
export const CHATBOT_CORS_ALLOWED_ORIGINS = process.env.CHATBOT_CORS_ALLOWED_ORIGINS
  || 'https://rapidmvp.io,https://www.rapidmvp.io,https://chatbot.rapidmvp.io,https://chatbot.openrouter.io';

export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}
