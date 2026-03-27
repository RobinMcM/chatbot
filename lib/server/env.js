export const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'https://models.rapidmvp.io';
export const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || process.env.GATEWAY_INTERNAL_API_KEY;
export const CHAT_MODEL = process.env.CHAT_MODEL || 'openai/gpt-5-pro';
export const GATEWAY_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS) || 120000;
export const CHATBOT_FRAME_ANCESTORS = process.env.CHATBOT_FRAME_ANCESTORS
  || "'self' https://rapidmvp.io https://www.rapidmvp.io https://*.sharepoint.com";
export const CHATBOT_CORS_ALLOWED_ORIGINS = process.env.CHATBOT_CORS_ALLOWED_ORIGINS
  || 'https://rapidmvp.io,https://www.rapidmvp.io,https://taxflow.uk';

export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}
