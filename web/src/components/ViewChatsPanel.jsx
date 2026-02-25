import { useState, useEffect } from 'react';

export default function ViewChatsPanel({ chatMode, sessionId, linkedEmail, conversationId, onClose, onLoadConversation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(null);

  useEffect(() => {
    if (!chatMode || typeof chatMode !== 'string' || !chatMode.trim()) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const url = new URL('/api/chat-history', window.location.origin);
    url.searchParams.set('chat_mode', chatMode.trim());
    if (linkedEmail) url.searchParams.set('email', linkedEmail);
    const headers = {};
    if (sessionId) headers['X-Session-Id'] = sessionId;
    fetch(url.toString(), { headers })
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          const text = await res.text();
          if (res.status === 504) return { error: 'Request timed out. Please try again.' };
          if (contentType.includes('application/json')) {
            try {
              const data = JSON.parse(text);
              return { error: data.error || res.statusText || 'Failed to load history' };
            } catch (_) {}
          }
          return { error: res.status === 504 ? 'Request timed out. Please try again.' : 'Failed to load history' };
        }
        if (!contentType.includes('application/json')) return { error: 'Invalid response from server' };
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setConversations([]);
        } else {
          setConversations(Array.isArray(data.conversations) ? data.conversations : []);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load history');
        setConversations([]);
      })
      .finally(() => setLoading(false));
  }, [chatMode, sessionId, linkedEmail]);

  const handleSelectConversation = async (c) => {
    const clientId = c.client_id;
    const conversationId = c.conversation_id;
    if (!clientId || !conversationId || !onLoadConversation) return;
    setLoadingConversation(conversationId);
    try {
      const url = new URL('/api/chat-history/messages', window.location.origin);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('conversation_id', conversationId);
      const res = await fetch(url.toString());
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        await res.text();
        if (res.status === 504) throw new Error('Request timed out. Please try again.');
        throw new Error('Failed to load conversation');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const messages = Array.isArray(data.messages) ? data.messages : [];
      onLoadConversation(messages, conversationId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingConversation(null);
    }
  };

  return (
    <div className="view-chats-panel">
      <header className="view-chats-panel-header">
        <h2 className="view-chats-panel-title">View chats</h2>
        <button type="button" className="view-chats-panel-close" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </header>
      {error && <div className="view-chats-error">{error}</div>}
      {loading && !conversations.length && chatMode && (
        <p className="view-chats-loading">Loading…</p>
      )}
      {!chatMode && (
        <p className="view-chats-empty">Open a chat topic from the URL to see previous chats.</p>
      )}
      <div className="view-chats-list-wrap">
        {chatMode && !loading && conversations.length === 0 && (
          <p className="view-chats-empty">No questions yet for this topic.</p>
        )}
        <ul className="view-chats-list">
          {conversations.map((c, i) => (
            <li key={(c.conversation_id || i) + String(c.created_at)} className="view-chats-item">
              <button
                type="button"
                className={`view-chats-item-btn${conversationId && c.conversation_id === conversationId ? ' view-chats-item-btn--selected' : ''}`}
                onClick={() => handleSelectConversation(c)}
                disabled={loadingConversation !== null}
                aria-label={`Load conversation: ${c.question_preview || 'No preview'}`}
              >
                <div className="view-chats-item-preview">
                  {c.question_preview ? (
                    <p className="view-chats-item-question">{c.question_preview}</p>
                  ) : (
                    <p className="view-chats-item-question view-chats-item-question--muted">(No preview)</p>
                  )}
                </div>
                <time className="view-chats-item-date" dateTime={c.created_at}>
                  {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                </time>
                {loadingConversation === c.conversation_id && <span className="view-chats-item-loading">Loading…</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
