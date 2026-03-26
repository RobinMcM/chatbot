export function normalizeApiBase(apiBase) {
  if (typeof apiBase !== 'string') return '';
  const trimmed = apiBase.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function apiUrl(apiBase, path) {
  const base = normalizeApiBase(apiBase);
  if (!base) return path;
  return `${base}${path}`;
}
