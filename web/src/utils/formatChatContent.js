/**
 * Normalise agent/assistant chat content so it renders correctly as markdown
 * (e.g. bullet characters and list spacing for ReactMarkdown + remark-gfm).
 * @param {string} raw - Raw content from the chat API
 * @returns {string} Content suitable for ReactMarkdown
 */
export function formatChatContent(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  const text = raw;
  const lines = text.split(/\r?\n/);

  const bulletLike = /^(\s*)([\u2022\u25AA\u2023\u2217\u22C5]|\*\s+)(\s*)/; // • ▪ ‣ ∗ · * 
  const listMarker = /^(\s*)([-*+])\s+/; // - * + (GFM unordered)
  const orderedMarker = /^(\s*)(\d{1,9})([.)])\s+/; // 1. 1)

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';
    const prevNonEmpty = out.length > 0 ? out[out.length - 1] : '';

    // Normalise common bullet characters at line start to markdown "- "
    const bulletMatch = line.match(bulletLike);
    if (bulletMatch) {
      const indent = bulletMatch[1] || '';
      const rest = line.slice(bulletMatch[0].length);
      line = `${indent}- ${rest.trimStart()}`;
    }

    // Ensure blank line before a list when preceding line is non-empty and not itself a list (helps GFM parse lists)
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
