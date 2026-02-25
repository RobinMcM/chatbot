import sql from 'mssql';

const AZURE_SQL_CONNECTION_STRING = process.env.AZURE_SQL_CONNECTION_STRING;
const AZURE_SQL_SERVER = process.env.AZURE_SQL_SERVER;
const AZURE_SQL_DATABASE = process.env.AZURE_SQL_DATABASE;
const AZURE_SQL_USER = process.env.AZURE_SQL_USER;
const AZURE_SQL_PASSWORD = process.env.AZURE_SQL_PASSWORD;

let pool = null;

function getConfig() {
  if (AZURE_SQL_CONNECTION_STRING && AZURE_SQL_CONNECTION_STRING.trim() !== '') {
    return AZURE_SQL_CONNECTION_STRING;
  }
  if (AZURE_SQL_SERVER && AZURE_SQL_DATABASE && AZURE_SQL_USER && AZURE_SQL_PASSWORD) {
    return {
      server: AZURE_SQL_SERVER,
      database: AZURE_SQL_DATABASE,
      user: AZURE_SQL_USER,
      password: AZURE_SQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    };
  }
  return null;
}

export function isConfigured() {
  return getConfig() !== null;
}

export async function getPool() {
  if (!isConfigured()) return null;
  if (pool) return pool;
  const config = getConfig();
  pool = typeof config === 'string' ? await sql.connect(config) : await sql.connect(config);
  return pool;
}

export async function ensureTables() {
  const p = await getPool();
  if (!p) return;
  await p.request().query(`
    IF OBJECT_ID(N'dbo.chat_sessions', N'U') IS NULL
    CREATE TABLE dbo.chat_sessions (
      client_id NVARCHAR(256) NOT NULL PRIMARY KEY,
      email NVARCHAR(320) NULL,
      created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
      updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
  `);
  await p.request().query(`
    IF OBJECT_ID(N'dbo.chat_messages', N'U') IS NULL
    CREATE TABLE dbo.chat_messages (
      id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      client_id NVARCHAR(256) NOT NULL,
      conversation_id NVARCHAR(64) NOT NULL,
      chat_mode NVARCHAR(64) NOT NULL,
      role NVARCHAR(32) NOT NULL,
      content NVARCHAR(MAX) NOT NULL,
      model NVARCHAR(128) NULL,
      usage NVARCHAR(MAX) NULL,
      email NVARCHAR(320) NULL,
      created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_chat_messages_client_conversation')
    CREATE INDEX IX_chat_messages_client_conversation ON dbo.chat_messages (client_id, conversation_id, created_at);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_chat_messages_email')
    CREATE INDEX IX_chat_messages_email ON dbo.chat_messages (email, created_at) WHERE email IS NOT NULL;
  `);
}

export async function upsertSession(clientId, email) {
  const p = await getPool();
  if (!p) return;
  await p.request()
    .input('client_id', sql.NVarChar(256), clientId)
    .input('email', sql.NVarChar(320), email || null)
    .query(`
      MERGE dbo.chat_sessions AS t
      USING (SELECT @client_id AS client_id, @email AS email) AS s
      ON t.client_id = s.client_id
      WHEN MATCHED THEN UPDATE SET email = s.email, updated_at = GETUTCDATE()
      WHEN NOT MATCHED THEN INSERT (client_id, email) VALUES (s.client_id, s.email);
    `);
}

export async function insertMessages(clientId, conversationId, chatMode, messages, email = null) {
  const p = await getPool();
  if (!p) return;
  for (const msg of messages) {
    await p.request()
      .input('client_id', sql.NVarChar(256), clientId)
      .input('conversation_id', sql.NVarChar(64), conversationId)
      .input('chat_mode', sql.NVarChar(64), chatMode)
      .input('role', sql.NVarChar(32), msg.role)
      .input('content', sql.NVarChar(sql.MAX), msg.content || '')
      .input('model', sql.NVarChar(128), msg.model || null)
      .input('usage', sql.NVarChar(sql.MAX), msg.usage ? JSON.stringify(msg.usage) : null)
      .input('email', sql.NVarChar(320), email || null)
      .query(`
        INSERT INTO dbo.chat_messages (client_id, conversation_id, chat_mode, role, content, model, usage, email)
        VALUES (@client_id, @conversation_id, @chat_mode, @role, @content, @model, @usage, @email);
      `);
  }
}

export async function backfillEmailForClient(clientId, email) {
  const p = await getPool();
  if (!p) return 0;
  const result = await p.request()
    .input('client_id', sql.NVarChar(256), clientId)
    .input('email', sql.NVarChar(320), email)
    .query(`UPDATE dbo.chat_messages SET email = @email WHERE client_id = @client_id AND (email IS NULL OR email = ''); SELECT @@ROWCOUNT AS updated;`);
  return result.recordset?.[0]?.updated ?? 0;
}

export async function getConversations(clientId, email = null, chatMode = null) {
  const p = await getPool();
  if (!p) return [];
  const modeFilter = chatMode && typeof chatMode === 'string' && chatMode.trim() !== '' ? 'AND m.chat_mode = @chat_mode' : '';
  const modeFilterClient = chatMode && typeof chatMode === 'string' && chatMode.trim() !== '' ? 'AND chat_mode = @chat_mode' : '';
  if (email) {
    const req = p.request().input('email', sql.NVarChar(320), email);
    if (chatMode && chatMode.trim()) req.input('chat_mode', sql.NVarChar(64), chatMode.trim());
    const byEmail = await req.query(`
      SELECT DISTINCT client_id, conversation_id, chat_mode,
        (SELECT MIN(created_at) FROM dbo.chat_messages m2 WHERE m2.client_id = m.client_id AND m2.conversation_id = m.conversation_id) AS created_at
      FROM dbo.chat_messages m
      WHERE m.email = @email ${modeFilter}
      ORDER BY created_at DESC
    `);
    return byEmail.recordset || [];
  }
  const req = p.request().input('client_id', sql.NVarChar(256), clientId);
  if (chatMode && chatMode.trim()) req.input('chat_mode', sql.NVarChar(64), chatMode.trim());
  const byClient = await req.query(`
    SELECT conversation_id, chat_mode, MIN(created_at) AS created_at
    FROM dbo.chat_messages
    WHERE client_id = @client_id ${modeFilterClient}
    GROUP BY client_id, conversation_id, chat_mode
    ORDER BY created_at DESC
  `);
  return (byClient.recordset || []).map((r) => ({ ...r, client_id: clientId }));
}

export async function getConversationsWithPreview(clientId, email = null, chatMode = null) {
  const p = await getPool();
  if (!p) return [];
  const hasMode = chatMode && typeof chatMode === 'string' && chatMode.trim() !== '';
  if (email) {
    const req = p.request().input('email', sql.NVarChar(320), email);
    if (hasMode) req.input('chat_mode', sql.NVarChar(64), chatMode.trim());
    const result = await req.query(`
      SELECT DISTINCT m.client_id, m.conversation_id, m.chat_mode,
        (SELECT MIN(created_at) FROM dbo.chat_messages m2 WHERE m2.client_id = m.client_id AND m2.conversation_id = m.conversation_id) AS created_at,
        (SELECT TOP 1 content FROM dbo.chat_messages m3 WHERE m3.client_id = m.client_id AND m3.conversation_id = m.conversation_id AND m3.role = 'user' ORDER BY m3.created_at ASC) AS question_preview
      FROM dbo.chat_messages m
      WHERE m.email = @email ${hasMode ? 'AND m.chat_mode = @chat_mode' : ''}
      ORDER BY created_at DESC
    `);
    return result.recordset || [];
  }
  const req = p.request().input('client_id', sql.NVarChar(256), clientId);
  if (hasMode) req.input('chat_mode', sql.NVarChar(64), chatMode.trim());
  const result = await req.query(`
    SELECT conversation_id, chat_mode, MIN(created_at) AS created_at,
      (SELECT TOP 1 content FROM dbo.chat_messages m2 WHERE m2.client_id = chat_messages.client_id AND m2.conversation_id = chat_messages.conversation_id AND m2.role = 'user' ORDER BY m2.created_at ASC) AS question_preview
    FROM dbo.chat_messages
    WHERE client_id = @client_id ${hasMode ? 'AND chat_mode = @chat_mode' : ''}
    GROUP BY client_id, conversation_id, chat_mode
    ORDER BY MIN(created_at) DESC
  `);
  return (result.recordset || []).map((r) => ({ ...r, client_id: clientId }));
}

export async function getMessages(clientId, conversationId) {
  const p = await getPool();
  if (!p) return [];
  const result = await p.request()
    .input('client_id', sql.NVarChar(256), clientId)
    .input('conversation_id', sql.NVarChar(64), conversationId)
    .query(`
      SELECT role, content, model, usage, created_at
      FROM dbo.chat_messages
      WHERE client_id = @client_id AND conversation_id = @conversation_id
      ORDER BY created_at ASC
    `);
  const rows = result.recordset || [];
  return rows.map((r) => ({
    role: r.role,
    content: r.content,
    ...(r.model && { model: r.model }),
    ...(r.usage && { usage: typeof r.usage === 'string' ? JSON.parse(r.usage) : r.usage }),
  }));
}

/**
 * Delete all messages for a conversation (delete conversation hierarchy).
 * Returns the number of rows deleted.
 */
export async function deleteConversation(clientId, conversationId) {
  const p = await getPool();
  if (!p) return 0;
  const result = await p.request()
    .input('client_id', sql.NVarChar(256), clientId)
    .input('conversation_id', sql.NVarChar(64), conversationId)
    .query(`
      DELETE FROM dbo.chat_messages
      WHERE client_id = @client_id AND conversation_id = @conversation_id
    `);
  return result.rowsAffected?.[0] ?? 0;
}

/**
 * Admin: list conversations across clients with optional filters.
 * Returns: client_id, email, conversation_id, chat_mode, created_at, question_preview.
 */
export async function getConversationsForAdmin({ clientId = null, email = null, chatMode = null, limit = 200 } = {}) {
  const p = await getPool();
  if (!p) return [];
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const hasClient = clientId && typeof clientId === 'string' && clientId.trim() !== '';
  const hasEmail = email && typeof email === 'string' && email.trim() !== '';
  const hasMode = chatMode && typeof chatMode === 'string' && chatMode.trim() !== '';
  let req = p.request()
    .input('limit', sql.Int, cap);
  const conditions = [];
  if (hasClient) {
    req = req.input('client_id', sql.NVarChar(256), clientId.trim().slice(0, 256));
    conditions.push('m.client_id = @client_id');
  }
  if (hasEmail) {
    req = req.input('email_filter', sql.NVarChar(320), '%' + email.trim().slice(0, 320) + '%');
    conditions.push('m.email LIKE @email_filter');
  }
  if (hasMode) {
    req = req.input('chat_mode', sql.NVarChar(64), chatMode.trim().slice(0, 64));
    conditions.push('m.chat_mode = @chat_mode');
  }
  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const result = await req.query(`
    SELECT TOP (@limit) m.client_id,
      MAX(m.email) AS email,
      m.conversation_id,
      m.chat_mode,
      MIN(m.created_at) AS created_at,
      (SELECT TOP 1 content FROM dbo.chat_messages m3 WHERE m3.client_id = m.client_id AND m3.conversation_id = m.conversation_id AND m3.role = 'user' ORDER BY m3.created_at ASC) AS question_preview,
      (SELECT TOP 1 m2.model FROM dbo.chat_messages m2 WHERE m2.client_id = m.client_id AND m2.conversation_id = m.conversation_id AND m2.role = 'assistant' AND m2.model IS NOT NULL AND m2.model <> '' ORDER BY m2.created_at DESC) AS model,
      (SELECT SUM(COALESCE(
        TRY_CAST(JSON_VALUE(m2.usage, '$.total') AS FLOAT),
        TRY_CAST(JSON_VALUE(m2.usage, '$.total_cost') AS FLOAT),
        TRY_CAST(JSON_VALUE(m2.usage, '$.cost') AS FLOAT),
        TRY_CAST(JSON_VALUE(m2.usage, '$.subtotal') AS FLOAT)
      )) FROM dbo.chat_messages m2 WHERE m2.client_id = m.client_id AND m2.conversation_id = m.conversation_id AND m2.role = 'assistant' AND m2.usage IS NOT NULL AND LEN(m2.usage) > 0) AS total_cost
    FROM dbo.chat_messages m
    ${whereClause}
    GROUP BY m.client_id, m.conversation_id, m.chat_mode
    ORDER BY MIN(m.created_at) DESC
  `);
  return result.recordset || [];
}

export async function getClientIdByEmail(email) {
  const p = await getPool();
  if (!p) return null;
  const result = await p.request()
    .input('email', sql.NVarChar(320), email)
    .query(`SELECT TOP 1 client_id FROM dbo.chat_sessions WHERE email = @email ORDER BY updated_at DESC`);
  return result.recordset?.[0]?.client_id ?? null;
}

export async function getSessionEmail(clientId) {
  const p = await getPool();
  if (!p) return null;
  const result = await p.request()
    .input('client_id', sql.NVarChar(256), clientId)
    .query('SELECT email FROM dbo.chat_sessions WHERE client_id = @client_id');
  return result.recordset?.[0]?.email ?? null;
}
