export function formatChatContent(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  const lines = raw.split(/\r?\n/);

  const bulletLike = /^(\s*)([\u2022\u25AA\u2023\u2217\u22C5]|\*\s+)(\s*)/;
  const listMarker = /^(\s*)([-*+])\s+/;
  const orderedMarker = /^(\s*)(\d{1,9})([.)])\s+/;

  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    const prevNonEmpty = out.length > 0 ? out[out.length - 1] : '';
    const bulletMatch = line.match(bulletLike);
    if (bulletMatch) {
      const indent = bulletMatch[1] || '';
      const rest = line.slice(bulletMatch[0].length);
      line = `${indent}- ${rest.trimStart()}`;
    }

    const looksLikeList = listMarker.test(line.trimStart()) || orderedMarker.test(line.trimStart());
    const prevIsNonEmpty = prevNonEmpty.trim().length > 0;
    const prevIsList = listMarker.test(prevNonEmpty.trimStart()) || orderedMarker.test(prevNonEmpty.trimStart());
    const prevEndsWithColonOrPeriod = /[:.]\s*$/.test(prevNonEmpty.trim());
    if (looksLikeList && prevIsNonEmpty && !prevIsList && !prevEndsWithColonOrPeriod && out.length > 0) {
      out.push('');
    }
    out.push(line);
  }

  return out.join('\n');
}
