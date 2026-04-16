import { corsPreflight, jsonWithCors } from '../../../lib/server/cors.js';
import { listModesForClient } from '../../../lib/server/modes.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export function GET(request) {
  try {
    return jsonWithCors(request, { chat_modes: listModesForClient() });
  } catch {
    return jsonWithCors(request, { error: 'Failed to list chat modes' }, { status: 500 });
  }
}
