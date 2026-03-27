export async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function clampString(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}
