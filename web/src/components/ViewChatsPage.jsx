import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEmailFromCookie } from '../utils/cookies';

const SESSION_STORAGE_KEY = 'chatbot_session_id';

function getSessionId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function getLinkedEmail() {
  if (typeof window === 'undefined') return '';
  return getEmailFromCookie() || window.localStorage.getItem('chatbot_email') || '';
}

export default function ViewChatsPage() {
  const [chatModes, setChatModes] = useState([]);
  const [selectedModeId, setSelectedModeId] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/chat-modes')
      .then((res) => res.json())
      .then((data) => {
        const modes = Array.isArray(data.chat_modes) ? data.chat_modes : [];
        setChatModes(modes);
        if (modes.length > 0 && !selectedModeId) {
          const first = modes[0];
          const id = typeof first === 'object' && first !== null && 'id' in first ? first.id : first;
          setSelectedModeId(typeof id === 'string' ? id : '');
        }
      })
      .catch((err) => setError(err.message || 'Failed to load modes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedModeId) {
      setConversations([]);
      return;
    }
    setLoading(true);
    const url = new URL('/api/chat-history', window.location.origin);
    url.searchParams.set('chat_mode', selectedModeId);
    const email = getLinkedEmail();
    if (email) url.searchParams.set('email', email);
    const headers = {};
    const sid = getSessionId();
    if (sid) headers['X-Session-Id'] = sid;
    fetch(url.toString(), { headers })
      .then((res) => res.json())
      .then((data) => {
        setConversations(Array.isArray(data.conversations) ? data.conversations : []);
        if (data.error) setError(data.error);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load history');
        setConversations([]);
      })
      .finally(() => setLoading(false));
  }, [selectedModeId]);

  return (
    <div className="view-chats-page">
      <header className="view-chats-header">
        <h1 className="view-chats-title">View chats</h1>
        <Link to="/" className="view-chats-back">
          Back to chat
        </Link>
      </header>
      {error && <div className="view-chats-error">{error}</div>}
      {loading && !conversations.length && selectedModeId && (
        <p className="view-chats-loading">Loading…</p>
      )}
      <div className="view-chats-controls">
        <label className="view-chats-label">
          <span className="view-chats-label-text">Topic</span>
          <select
            className="view-chats-select"
            value={selectedModeId}
            onChange={(e) => setSelectedModeId(e.target.value)}
            disabled={!chatModes.length}
            aria-label="Filter by topic"
          >
            {!chatModes.length && <option value="">No topics</option>}
            {chatModes.map((mode) => {
              const id = typeof mode === 'object' && mode !== null && 'id' in mode ? mode.id : mode;
              const label = typeof mode === 'object' && mode !== null && 'displayName' in mode ? mode.displayName : id;
              return (
                <option key={id} value={id}>
                  {typeof label === 'string' ? label : String(id ?? '')}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="view-chats-list-wrap">
        {selectedModeId && !loading && conversations.length === 0 && (
          <p className="view-chats-empty">No questions yet for this topic.</p>
        )}
        <ul className="view-chats-list">
          {conversations.map((c, i) => (
            <li key={(c.conversation_id || i) + String(c.created_at)} className="view-chats-item">
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
