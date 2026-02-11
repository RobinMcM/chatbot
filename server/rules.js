import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.join(__dirname, '..', 'rules');

const CHAT_MODE_REGEX = /^[a-z0-9_-]+$/i;
const ALLOWED_EXTENSIONS = ['.md', '.txt'];

const PROMPT_SELECTION_HEADER = /^#\s*Prompt Selection\s*$/i;
const PROMPT_INFO_HEADER = /^#\s*Prompt Information\s*$/i;
const PROMPT_RULES_HEADER = /^#\s*Prompt Rules\s*$/i;

/**
 * Parse template metadata from rules file content.
 * File format: three sections only — # Prompt Selection, # Prompt Information, # Prompt Rules.
 * Prompt Rules content is prepended to the chat prompt; if empty, no rules are prepended.
 * @param {string} content - Full file content
 * @returns {{ displayName: string, promptInfo: string, rulesOnly: string }}
 */
export function parseTemplateMeta(content) {
  const lines = (content || '').split(/\r?\n/);
  let displayName = '';
  let promptInfo = '';
  let rulesOnly = '';
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (PROMPT_SELECTION_HEADER.test(t)) {
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next.startsWith('#')) break;
        if (next) {
          displayName = next;
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (PROMPT_INFO_HEADER.test(t)) {
      i++;
      const parts = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next.startsWith('#')) break;
        if (next) parts.push(next);
        i++;
      }
      promptInfo = parts.join(' ');
      continue;
    }
    if (PROMPT_RULES_HEADER.test(t)) {
      i++;
      const rulesLines = [];
      while (i < lines.length) {
        rulesLines.push(lines[i]);
        i++;
      }
      rulesOnly = rulesLines.join('\n').trim();
      break;
    }
    i++;
  }
  return {
    displayName,
    promptInfo,
    rulesOnly,
  };
}

/**
 * List chat mode ids by scanning rules/ for .md and .txt files.
 * @returns {string[]} Sorted list of mode ids (filename without extension)
 */
export function listChatModes() {
  if (!fs.existsSync(RULES_DIR)) return [];
  const names = new Set();
  for (const name of fs.readdirSync(RULES_DIR)) {
    const ext = path.extname(name).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      names.add(path.basename(name, ext));
    }
  }
  return [...names].sort();
}

/**
 * List chat modes with template metadata (displayName, promptInfo) for the UI.
 * @returns {Array<{ id: string, displayName: string, promptInfo: string }>}
 */
export function listChatModesWithMeta() {
  const ids = listChatModes();
  const rulesDirResolved = path.resolve(RULES_DIR);
  const result = [];
  for (const id of ids) {
    const loaded = loadRules(id);
    if (!loaded) continue;
    const meta = parseTemplateMeta(loaded.content);
    result.push({
      id,
      displayName: meta.displayName || id,
      promptInfo: meta.promptInfo || '',
    });
  }
  return result;
}

/**
 * Validate chat_mode and resolve to a file under rules/. No path traversal.
 * Returns full content plus parsed meta; use meta.rulesOnly for the LLM system prompt.
 * @param {string} chatMode
 * @returns {{ path: string, content: string, meta: { displayName: string, promptInfo: string, rulesOnly: string } } | null}
 */
export function loadRules(chatMode) {
  if (!chatMode || typeof chatMode !== 'string') return null;
  if (!CHAT_MODE_REGEX.test(chatMode)) return null;

  const rulesDirResolved = path.resolve(RULES_DIR);
  for (const ext of ALLOWED_EXTENSIONS) {
    const candidate = path.join(RULES_DIR, chatMode + ext);
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(rulesDirResolved)) continue;
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue;
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      const meta = parseTemplateMeta(content);
      return { path: resolved, content, meta };
    } catch {
      return null;
    }
  }
  return null;
}
