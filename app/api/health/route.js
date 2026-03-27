import { jsonWithCors, corsPreflight } from '../../../lib/server/cors.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export function GET(request) {
  return jsonWithCors(request, { status: 'ok' });
}
