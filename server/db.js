const CONNECTION_TYPE = (process.env.CONNECTION_TYPE || 'AZURE').toUpperCase();

const db = CONNECTION_TYPE === 'POSTGRES'
  ? await import('./db-pg.js')
  : await import('./db-azure.js');

export const isConfigured = db.isConfigured;
export const getPool = db.getPool;
export const ensureTables = db.ensureTables;
export const upsertSession = db.upsertSession;
export const insertMessages = db.insertMessages;
export const backfillEmailForClient = db.backfillEmailForClient;
export const getConversations = db.getConversations;
export const getConversationsWithPreview = db.getConversationsWithPreview;
export const getMessages = db.getMessages;
export const getClientIdByEmail = db.getClientIdByEmail;
export const getSessionEmail = db.getSessionEmail;
