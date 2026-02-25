import pg from 'pg';

const POSTGRES_SQL_CONNECTION_STRING = process.env.POSTGRES_SQL_CONNECTION_STRING;

let pool = null;

function getConfig() {
  if (POSTGRES_SQL_CONNECTION_STRING && POSTGRES_SQL_CONNECTION_STRING.trim() !== '') {
    return POSTGRES_SQL_CONNECTION_STRING.trim();
  }
  return null;
}

export function isConfigured() {
  return getConfig() !== null;
}

export async function getPool() {
  if (!isConfigured()) return null;
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString: getConfig(),
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

export async function ensureTables() {
  const p = await getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      client_id VARCHAR(256) NOT NULL PRIMARY KEY,
      email VARCHAR(320) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      client_id VARCHAR(256) NOT NULL,
      conversation_id VARCHAR(64) NOT NULL,
      chat_mode VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      content TEXT NOT NULL,
      model VARCHAR(128) NULL,
      usage TEXT NULL,
      email VARCHAR(320) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS IX_chat_messages_client_conversation
    ON chat_messages (client_id, conversation_id, created_at);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS IX_chat_messages_email
    ON chat_messages (email, created_at) WHERE email IS NOT NULL;
  `);
}

export async function upsertSession(clientId, email) {
  const p = await getPool();
  if (!p) return;
  await p.query(
    `INSERT INTO chat_sessions (client_id, email) VALUES ($1, $2)
     ON CONFLICT (client_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()`,
    [clientId, email || null]
  );
}

export async function insertMessages(clientId, conversationId, chatMode, messages, email = null) {
  const p = await getPool();
  if (!p) return;
  for (const msg of messages) {
    await p.query(
      `INSERT INTO chat_messages (client_id, conversation_id, chat_mode, role, content, model, usage, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clientId,
        conversationId,
        chatMode,
        msg.role,
        msg.content || '',
        msg.model || null,
        msg.usage ? JSON.stringify(msg.usage) : null,
        email || null,
      ]
    );
  }
}

export async function backfillEmailForClient(clientId, email) {
  const p = await getPool();
  if (!p) return 0;
  const result = await p.query(
    `UPDATE chat_messages SET email = $2 WHERE client_id = $1 AND (email IS NULL OR email = '')`,
    [clientId, email]
  );
  return result.rowCount ?? 0;
}

export async function getConversations(clientId, email = null, chatMode = null) {
  const p = await getPool();
  if (!p) return [];
  const hasMode = chatMode && typeof chatMode === 'string' && chatMode.trim() !== '';
  if (email) {
    const params = hasMode ? [email, chatMode.trim()] : [email];
    const modeClause = hasMode ? 'AND m.chat_mode = $2' : '';
    const result = await p.query(
      `SELECT DISTINCT m.client_id, m.conversation_id, m.chat_mode,
        (SELECT MIN(created_at) FROM chat_messages m2 WHERE m2.client_id = m.client_id AND m2.conversation_id = m.conversation_id) AS created_at
       FROM chat_messages m
       WHERE m.email = $1 ${modeClause}
       ORDER BY created_at DESC`,
      params
    );
    return result.rows || [];
  }
  const params = hasMode ? [clientId, chatMode.trim()] : [clientId];
  const modeClause = hasMode ? 'AND chat_mode = $2' : '';
  const result = await p.query(
    `SELECT conversation_id, chat_mode, MIN(created_at) AS created_at
     FROM chat_messages
     WHERE client_id = $1 ${modeClause}
     GROUP BY client_id, conversation_id, chat_mode
     ORDER BY created_at DESC`,
    params
  );
  return (result.rows || []).map((r) => ({ ...r, client_id: clientId }));
}

export async function getConversationsWithPreview(clientId, email = null, chatMode = null) {
  const p = await getPool();
  if (!p) return [];
  const hasMode = chatMode && typeof chatMode === 'string' && chatMode.trim() !== '';
  if (email) {
    const params = hasMode ? [email, chatMode.trim()] : [email];
    const modeClause = hasMode ? 'AND m.chat_mode = $2' : '';
    const result = await p.query(
      `SELECT DISTINCT m.client_id, m.conversation_id, m.chat_mode,
        (SELECT MIN(created_at) FROM chat_messages m2 WHERE m2.client_id = m.client_id AND m2.conversation_id = m.conversation_id) AS created_at,
        (SELECT content FROM chat_messages m3 WHERE m3.client_id = m.client_id AND m3.conversation_id = m.conversation_id AND m3.role = 'user' ORDER BY m3.created_at ASC LIMIT 1) AS question_preview
       FROM chat_messages m
       WHERE m.email = $1 ${modeClause}
       ORDER BY created_at DESC`,
      params
    );
    return result.rows || [];
  }
  const params = hasMode ? [clientId, chatMode.trim()] : [clientId];
  const modeClause = hasMode ? 'AND chat_messages.chat_mode = $2' : '';
  const result = await p.query(
    `SELECT chat_messages.conversation_id, chat_messages.chat_mode, MIN(chat_messages.created_at) AS created_at,
      (SELECT content FROM chat_messages m2 WHERE m2.client_id = chat_messages.client_id AND m2.conversation_id = chat_messages.conversation_id AND m2.role = 'user' ORDER BY m2.created_at ASC LIMIT 1) AS question_preview
     FROM chat_messages
     WHERE chat_messages.client_id = $1 ${modeClause}
     GROUP BY chat_messages.client_id, chat_messages.conversation_id, chat_messages.chat_mode
     ORDER BY MIN(chat_messages.created_at) DESC`,
    params
  );
  return (result.rows || []).map((r) => ({ ...r, client_id: clientId }));
}

export async function getMessages(clientId, conversationId) {
  const p = await getPool();
  if (!p) return [];
  const result = await p.query(
    `SELECT role, content, model, usage, created_at
     FROM chat_messages
     WHERE client_id = $1 AND conversation_id = $2
     ORDER BY created_at ASC`,
    [clientId, conversationId]
  );
  const rows = result.rows || [];
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    ...(r.model && { model: r.model }),
    ...(r.usage && { usage: typeof r.usage === 'string' ? JSON.parse(r.usage) : r.usage }),
  }));
}

export async function getClientIdByEmail(email) {
  const p = await getPool();
  if (!p) return null;
  const result = await p.query(
    `SELECT client_id FROM chat_sessions WHERE email = $1 ORDER BY updated_at DESC LIMIT 1`,
    [email]
  );
  return result.rows?.[0]?.client_id ?? null;
}

export async function getSessionEmail(clientId) {
  const p = await getPool();
  if (!p) return null;
  const result = await p.query(
    'SELECT email FROM chat_sessions WHERE client_id = $1',
    [clientId]
  );
  return result.rows?.[0]?.email ?? null;
}
