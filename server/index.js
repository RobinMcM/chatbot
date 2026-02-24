import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listChatModesWithMeta, loadRules } from './rules.js';
import { executeChat } from './gateway.js';
import { buildMessages } from './prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || 'https://usageflows.info';
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || 'openai/gpt-5-pro';
const GATEWAY_TIMEOUT_MS = Number(process.env.GATEWAY_TIMEOUT_MS) || 120000; // 2 min
const PORT = Number(process.env.PORT) || 3000;

if (!GATEWAY_API_KEY) {
  console.error('GATEWAY_API_KEY is required. Set it in .env or environment.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Serve built frontend under /chatbot (must run after npm run build)
const distPath = path.join(PROJECT_ROOT, 'web', 'dist');
app.use('/chatbot', express.static(distPath, { index: false }));

// GET /api/chat-modes – returns id, displayName, promptInfo per mode (from template headers)
app.get('/api/chat-modes', (req, res) => {
  try {
    const chat_modes = listChatModesWithMeta();
    res.json({ chat_modes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list chat modes' });
  }
});

// GET /api/rules/:chat_mode
app.get('/api/rules/:chat_mode', (req, res) => {
  const result = loadRules(req.params.chat_mode);
  if (!result) {
    return res.status(404).json({ error: 'Unknown chat mode' });
  }
  res.type('text/plain').send(result.content);
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { chat_mode, conversation_history, user_message, optional_context } = req.body ?? {};

  console.log('[chat] Request: chat_mode=', chat_mode, 'history_length=', conversation_history?.length ?? 0, 'gateway=', GATEWAY_BASE_URL);

  if (!chat_mode || typeof chat_mode !== 'string') {
    return res.status(400).json({ error: 'chat_mode is required' });
  }
  if (!Array.isArray(conversation_history)) {
    return res.status(400).json({ error: 'conversation_history must be an array' });
  }
  if (typeof user_message !== 'string') {
    return res.status(400).json({ error: 'user_message is required' });
  }

  const rulesResult = loadRules(chat_mode);
  if (!rulesResult) {
    console.log('[chat] Unknown chat_mode:', chat_mode);
    return res.status(404).json({ error: 'Unknown chat mode' });
  }

  const rulesText = rulesResult.meta?.rulesOnly ?? rulesResult.content;
  const messages = buildMessages(
    rulesText,
    conversation_history,
    user_message,
    optional_context
  );

  try {
    console.log('[chat] Calling gateway...');
    const { content, usage } = await executeChat({
      baseUrl: GATEWAY_BASE_URL,
      apiKey: GATEWAY_API_KEY,
      model: CHAT_MODEL,
      messages,
      timeoutMs: GATEWAY_TIMEOUT_MS,
    });
    console.log('[chat] Gateway replied, content length=', content?.length ?? 0, 'usage=', usage !== undefined ? 'present' : 'missing');
    const payload = { content };
    if (usage !== undefined) payload.usage = usage;
    res.json(payload);
  } catch (err) {
    console.error('[chat] Gateway error:', err.code || err.errno || '(none)', err.message);
    if (err.code) console.error('[chat] err.code=', err.code, '- ECONNREFUSED=server down/unreachable, ETIMEDOUT=firewall or slow network');
    const status = err.status || 502;
    res.status(status).json({ error: err.message || 'Gateway request failed' });
  }
});

// SPA fallback: serve index.html for /chatbot and /chatbot/* when dist exists
app.get('/chatbot', (req, res) => {
  const indexHtml = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
  else res.status(404).send('Not found. Run npm run build then npm run start.');
});
app.get('/chatbot/*', (req, res) => {
  const indexHtml = path.join(distPath, 'index.html');
  if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
  else res.status(404).send('Not found. Run npm run build then npm run start.');
});

const server = app.listen(PORT, () => {
  console.log(`UsageFlows Chatbot server on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process (e.g. kill $(lsof -t -i:${PORT}) 2>/dev/null) or set PORT to another value.`);
    process.exit(1);
  }
  throw err;
});
