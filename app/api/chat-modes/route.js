import { corsPreflight, jsonWithCors } from '../../../lib/server/cors.js';
import { listChatModesWithMeta } from '../../../lib/server/rules.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export function GET(request) {
  try {
    return jsonWithCors(request, { chat_modes: listChatModesWithMeta() });
  } catch {
    return jsonWithCors(request, { error: 'Failed to list chat modes' }, { status: 500 });
  }
}
