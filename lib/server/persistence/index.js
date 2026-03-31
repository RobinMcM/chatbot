// Persistence is retired for the Next.js runtime.
// Kept as a no-op shim to avoid accidental runtime imports.
export const isConfigured = () => false;
export const getPool = () => null;
export const ensureTables = async () => {};
export const upsertSession = async () => {};
export const insertMessages = async () => {};
export const backfillEmailForClient = async () => 0;
export const getConversations = async () => [];
export const getConversationsWithPreview = async () => [];
export const getConversationsForAdmin = async () => [];
export const getMessages = async () => [];
export const deleteConversation = async () => 0;
export const getClientIdByEmail = async () => null;
export const getSessionEmail = async () => null;
