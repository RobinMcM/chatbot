import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listChatModesWithMeta, loadRules } from './rules.js';
import { executeChat } from './gateway.js';
import { buildMessages } from './prompt.js';
import * as db from './db.js';

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

function deriveClientId(req) {
  const sessionId = req.body?.session_id ?? req.headers['x-session-id'] ?? req.query?.session_id;
  if (typeof sessionId === 'string' && sessionId.trim() !== '') {
    return sessionId.trim().slice(0, 256);
  }
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex');
}

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
  const { chat_mode, conversation_history, user_message, optional_context, conversation_id: bodyConversationId, email: bodyEmail } = req.body ?? {};
  const email = typeof bodyEmail === 'string' && bodyEmail.trim() !== '' && bodyEmail.length <= 320 ? bodyEmail.trim() : null;

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
    const { content, usage, model: gatewayModel } = await executeChat({
      baseUrl: GATEWAY_BASE_URL,
      apiKey: GATEWAY_API_KEY,
      model: CHAT_MODEL,
      messages,
      timeoutMs: GATEWAY_TIMEOUT_MS,
    });
    const modelToUse = typeof gatewayModel === 'string' && gatewayModel.trim() !== ''
      ? gatewayModel.trim().slice(0, 128)
      : (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() !== '' ? CHAT_MODEL.trim() : null);
    const modelForPayload = modelToUse || (typeof CHAT_MODEL === 'string' && CHAT_MODEL.trim() !== '' ? CHAT_MODEL.trim() : null);
    const modelForDb = modelForPayload || 'unknown';
    console.log('[chat] Gateway replied, content length=', content?.length ?? 0, 'usage=', usage !== undefined ? 'present' : 'missing', 'model=', modelForPayload ?? 'none');
    const payload = { content, model: modelForPayload };
    if (usage !== undefined) payload.usage = usage;

    if (db.isConfigured()) {
      try {
        await db.ensureTables();
        const clientId = deriveClientId(req);
        const conversationId = typeof bodyConversationId === 'string' && bodyConversationId.trim() !== ''
          ? bodyConversationId.trim().slice(0, 64) : crypto.randomUUID();
        let emailForMessages = await db.getSessionEmail(clientId);
        if (email) {
          await db.upsertSession(clientId, email);
          await db.backfillEmailForClient(clientId, email);
          emailForMessages = email;
        }
        await db.insertMessages(
          clientId,
          conversationId,
          chat_mode,
          [
            { role: 'user', content: user_message },
            { role: 'assistant', content: payload.content || '', model: modelForDb, usage: payload.usage },
          ],
          emailForMessages
        );
        payload.conversation_id = conversationId;
      } catch (dbErr) {
        console.error('[chat] Persist error:', dbErr.message);
      }
    }
    res.json(payload);
  } catch (err) {
    console.error('[chat] Gateway error:', err.code || err.errno || '(none)', err.message);
    if (err.code) console.error('[chat] err.code=', err.code, '- ECONNREFUSED=server down/unreachable, ETIMEDOUT=firewall or slow network');
    const status = err.status || 502;
    res.status(status).json({ error: err.message || 'Gateway request failed' });
  }
});

// POST /api/sessions/email – link email to current client_id and backfill existing messages
app.post('/api/sessions/email', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email || email.length > 320) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!db.isConfigured()) {
    return res.status(503).json({ error: 'Persistence not configured' });
  }
  try {
    await db.ensureTables();
    const clientId = deriveClientId(req);
    await db.upsertSession(clientId, email);
    const backfilled = await db.backfillEmailForClient(clientId, email);
    res.json({ ok: true, backfilled });
  } catch (err) {
    console.error('[sessions/email]', err.message);
    res.status(500).json({ error: err.message || 'Failed to link email' });
  }
});

// GET /api/chat-history – list conversations for client (or by email); optional chat_mode filter; with question_preview when chat_mode present
app.get('/api/chat-history', async (req, res) => {
  if (!db.isConfigured()) {
    return res.status(503).json({ error: 'Persistence not configured' });
  }
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : null;
    const chatMode = typeof req.query.chat_mode === 'string' ? req.query.chat_mode.trim() || null : null;
    const clientId = email ? await db.getClientIdByEmail(email) : deriveClientId(req);
    if (!clientId && !email) {
      return res.json({ conversations: [] });
    }
    const usePreview = !!chatMode;
    const conversations = usePreview
      ? await db.getConversationsWithPreview(clientId || '', email || undefined, chatMode)
      : await db.getConversations(clientId, email || undefined, chatMode);
    res.json({ conversations });
  } catch (err) {
    console.error('[chat-history]', err.message);
    res.status(500).json({ error: err.message || 'Failed to list history' });
  }
});

// GET /api/chat-history/admin – admin list conversations with optional filters (client_id, email, chat_mode, limit)
app.get('/api/chat-history/admin', async (req, res) => {
  if (!db.isConfigured()) {
    return res.status(503).json({ error: 'Persistence not configured' });
  }
  try {
    const clientId = typeof req.query.client_id === 'string' ? req.query.client_id.trim() || null : null;
    const email = typeof req.query.email === 'string' ? req.query.email.trim() || null : null;
    const chatMode = typeof req.query.chat_mode === 'string' ? req.query.chat_mode.trim() || null : null;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 200;
    const conversations = await db.getConversationsForAdmin({ clientId, email, chatMode, limit });
    res.json({ conversations });
  } catch (err) {
    console.error('[chat-history/admin]', err.message);
    res.status(500).json({ error: err.message || 'Failed to list history' });
  }
});

// GET /api/chat-history/messages?client_id=...&conversation_id=... – load one conversation
app.get('/api/chat-history/messages', async (req, res) => {
  const clientId = typeof req.query.client_id === 'string' ? req.query.client_id.trim().slice(0, 256) : null;
  const conversationId = typeof req.query.conversation_id === 'string' ? req.query.conversation_id.trim().slice(0, 64) : null;
  if (!clientId || !conversationId) {
    return res.status(400).json({ error: 'client_id and conversation_id required' });
  }
  if (!db.isConfigured()) {
    return res.status(503).json({ error: 'Persistence not configured' });
  }
  try {
    const messages = await db.getMessages(clientId, conversationId);
    res.json({ messages });
  } catch (err) {
    console.error('[chat-history/messages]', err.message);
    res.status(500).json({ error: err.message || 'Failed to load messages' });
  }
});

// DELETE /api/chat-history/conversation?conversation_id=... – delete conversation hierarchy (client from session)
app.delete('/api/chat-history/conversation', async (req, res) => {
  const conversationId = typeof req.query.conversation_id === 'string' ? req.query.conversation_id.trim().slice(0, 64) : null;
  if (!conversationId) {
    return res.status(400).json({ error: 'conversation_id required' });
  }
  if (!db.isConfigured()) {
    return res.status(503).json({ error: 'Persistence not configured' });
  }
  try {
    const clientId = deriveClientId(req);
    const deleted = await db.deleteConversation(clientId, conversationId);
    res.json({ ok: true, deleted });
  } catch (err) {
    console.error('[chat-history/conversation DELETE]', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete conversation' });
  }
});

// DELETE /api/chat-history/admin/conversation?client_id=...&conversation_id=... – admin: delete conversation hierarchy
app.delete('/api/chat-history/admin/conversation', async (req, res) => {
  const clientId = typeof req.query.client_id === 'string' ? req.query.client_id.trim().slice(0, 256) : null;
  const conversationId = typeof req.query.conversation_id === 'string' ? req.query.conversation_id.trim().slice(0, 64) : null;
  if (!clientId || !conversationId) {
    return res.status(400).json({ error: 'client_id and conversation_id required' });
  }
  if (!db.isConfigured()) {
    return res.status(503).json({ error: 'Persistence not configured' });
  }
  try {
    const deleted = await db.deleteConversation(clientId, conversationId);
    res.json({ ok: true, deleted });
  } catch (err) {
    console.error('[chat-history/admin/conversation DELETE]', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete conversation' });
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

async function start() {
  if (db.isConfigured()) {
    try {
      await db.ensureTables();
      console.log('[db] Tables ensured at startup');
    } catch (err) {
      console.error('[db] ensureTables at startup failed:', err.message);
    }
  }
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
}

start();

