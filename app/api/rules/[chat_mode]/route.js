import { corsPreflight, jsonWithCors, textWithCors } from '../../../../lib/server/cors.js';
import { loadRules } from '../../../../lib/server/rules.js';

export function OPTIONS(request) {
  return corsPreflight(request);
}

export function GET(request, { params }) {
  const loaded = loadRules(params.chat_mode);
  if (!loaded) {
    return jsonWithCors(request, { error: 'Unknown chat mode' }, { status: 404 });
  }
  return textWithCors(request, loaded.content);
}
