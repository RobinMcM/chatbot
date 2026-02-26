import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatChatContent } from '../utils/formatChatContent';

const ADMIN_LIMIT = 200;

function getMessageCost(usage) {
  if (usage == null || typeof usage !== 'object') return null;
  const raw = usage.total ?? usage.total_cost ?? usage.cost ?? usage.subtotal;
  return typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;
}
function formatCost(cost) {
  return cost != null ? `$${Number(cost).toFixed(4)}` : '—';
}

function buildAdminUrl(clientId, email, chatMode) {
  const url = new URL('/api/chat-history/admin', window.location.origin);
  url.searchParams.set('limit', String(ADMIN_LIMIT));
  if (clientId && clientId.trim()) url.searchParams.set('client_id', clientId.trim());
  if (email && email.trim()) url.searchParams.set('email', email.trim());
  if (chatMode && chatMode.trim()) url.searchParams.set('chat_mode', chatMode.trim());
  return url.toString();
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 504) return { error: 'Request timed out. Please try again.' };
    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(text);
        return { error: data.error || res.statusText || 'Failed to load' };
      } catch (_) {}
    }
    return { error: res.status === 504 ? 'Request timed out. Please try again.' : 'Failed to load' };
  }
  if (!contentType.includes('application/json')) return { error: 'Invalid response from server' };
  return res.json();
}

export default function ViewChatsPage() {
  const [chatModes, setChatModes] = useState([]);
  const [filterClientId, setFilterClientId] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [expandedMessages, setExpandedMessages] = useState([]);
  const [viewAsFormatted, setViewAsFormatted] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);

  useEffect(() => {
    fetch('/api/chat-modes')
      .then((res) => res.json())
      .then((data) => {
        const modes = Array.isArray(data.chat_modes) ? data.chat_modes : [];
        setChatModes(modes);
      })
      .catch((err) => setError(err.message || 'Failed to load modes'));
  }, []);

  const fetchConversations = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(buildAdminUrl(filterClientId, filterEmail, filterTopic))
      .then((res) => parseJsonResponse(res))
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
  }, [filterClientId, filterEmail, filterTopic]);

  useEffect(() => {
    fetchConversations();
  }, [filterTopic, fetchConversations]);

  function getRowKey(c) {
    return `${c.client_id || ''}\0${c.conversation_id || ''}`;
  }

  async function handleExpand(c) {
    const key = getRowKey(c);
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedMessages([]);
      return;
    }
    setExpandedKey(key);
    setLoadingMessages(key);
    setExpandedMessages([]);
    const url = new URL('/api/chat-history/messages', window.location.origin);
    url.searchParams.set('client_id', c.client_id);
    url.searchParams.set('conversation_id', c.conversation_id);
    try {
      const res = await fetch(url.toString());
      const data = await parseJsonResponse(res);
      if (data.error) {
        setExpandedMessages([{ role: 'error', content: data.error }]);
      } else {
        setExpandedMessages(Array.isArray(data.messages) ? data.messages : []);
      }
    } catch (err) {
      setExpandedMessages([{ role: 'error', content: err.message || 'Failed to load messages' }]);
    } finally {
      setLoadingMessages(null);
    }
  }

  function displayClient(c) {
    if (c.email && String(c.email).trim()) return c.email;
    return c.client_id || '—';
  }

  async function handleDeleteConversation(c) {
    const key = getRowKey(c);
    if (!window.confirm('Delete this chat and all its messages? This cannot be undone.')) return;
    setDeletingKey(key);
    const url = new URL('/api/chat-history/admin/conversation', window.location.origin);
    url.searchParams.set('client_id', c.client_id);
    url.searchParams.set('conversation_id', c.conversation_id);
    try {
      const res = await fetch(url.toString(), { method: 'DELETE' });
      const data = await parseJsonResponse(res);
      if (data.error) {
        setError(data.error);
      } else {
        setExpandedKey((k) => (k === key ? null : k));
        setExpandedMessages([]);
        fetchConversations();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete');
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="view-chats-page">
      <header className="view-chats-header">
        <Link to="/" className="view-chats-back">Back to home</Link>
        <h1 className="view-chats-title">View chats</h1>
        <p className="view-chats-header-desc">Expand a row to open the chat, then use &quot;Delete chat&quot; to remove that conversation and all its messages.</p>
      </header>
      {error && <div className="view-chats-error">{error}</div>}

      <div className="view-chats-filters">
        <label className="view-chats-label">
          <span className="view-chats-label-text">Client ID</span>
          <input
            type="text"
            className="view-chats-input"
            placeholder="Filter by client ID"
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            aria-label="Filter by client ID"
          />
        </label>
        <label className="view-chats-label">
          <span className="view-chats-label-text">Email / Phone</span>
          <input
            type="text"
            className="view-chats-input"
            placeholder="Filter by email or phone"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            aria-label="Filter by email or phone"
          />
        </label>
        <label className="view-chats-label">
          <span className="view-chats-label-text">Topic</span>
          <select
            className="view-chats-select"
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            disabled={!chatModes.length}
            aria-label="Filter by topic"
          >
            <option value="">All topics</option>
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
        <button
          type="button"
          className="view-chats-apply-btn"
          onClick={fetchConversations}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {loading && !conversations.length && (
        <p className="view-chats-loading">Loading…</p>
      )}
      {!loading && conversations.length === 0 && (
        <p className="view-chats-empty">No conversations match the filters.</p>
      )}

      {conversations.length > 0 && (
        <div className="view-chats-grid-wrap">
          <table className="view-chats-grid">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Client ID</th>
                <th>Client</th>
                <th>Model</th>
                <th>Total cost</th>
                <th>First message</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => {
                const rowKey = getRowKey(c);
                const isExpanded = expandedKey === rowKey;
                const preview = c.question_preview ? String(c.question_preview).slice(0, 120) + (String(c.question_preview).length > 120 ? '…' : '') : '(No preview)';
                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className={isExpanded ? 'view-chats-grid-row--expanded' : ''}
                    >
                      <td>{c.chat_mode || '—'}</td>
                      <td className="view-chats-grid-cell-client-id">{c.client_id || '—'}</td>
                      <td className="view-chats-grid-cell-client">{displayClient(c)}</td>
                      <td className="view-chats-grid-cell-model">{c.model || '—'}</td>
                      <td className="view-chats-grid-cell-total-cost">{formatCost(c.total_cost)}</td>
                      <td>
                        <button
                          type="button"
                          className="view-chats-grid-cell-preview"
                          onClick={() => handleExpand(c)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse chat history' : 'Expand chat history'}
                        >
                          {preview}
                        </button>
                      </td>
                      <td>
                        <time dateTime={c.created_at}>
                          {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                        </time>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="view-chats-grid-row-expanded">
                        <td colSpan={7} className="view-chats-grid-expanded">
                          <div className="view-chats-grid-expanded-inner">
                            <div className="view-chats-grid-expanded-header">
                              <div className="view-chats-grid-expanded-header-left">
                                <p className="view-chats-grid-messages-title">Chat history</p>
                                <button
                                  type="button"
                                  className="view-chats-format-toggle"
                                  onClick={() => setViewAsFormatted((v) => !v)}
                                  aria-pressed={viewAsFormatted}
                                  aria-label={viewAsFormatted ? 'Show as plain text' : 'Show as formatted (markdown)'}
                                >
                                  {viewAsFormatted ? 'Text' : 'Formatted'}
                                </button>
                                {expandedMessages.length > 0 && (() => {
                                  const total = expandedMessages
                                    .filter((m) => m.role === 'assistant' && m.usage)
                                    .reduce((sum, m) => sum + (getMessageCost(m.usage) ?? 0), 0);
                                  return (
                                    <span className="view-chats-grid-total-cost">
                                      Total cost: {formatCost(total)}
                                    </span>
                                  );
                                })()}
                              </div>
                              <button
                                type="button"
                                className="view-chats-delete-btn"
                                onClick={() => handleDeleteConversation(c)}
                                disabled={deletingKey !== null}
                                aria-label={`Delete this chat: ${preview}`}
                              >
                                {deletingKey === rowKey ? 'Deleting…' : 'Delete chat'}
                              </button>
                            </div>
                            {loadingMessages === rowKey ? (
                              <p className="view-chats-loading">Loading messages…</p>
                            ) : expandedMessages.length === 0 ? (
                              <p className="view-chats-empty">No messages.</p>
                            ) : (
                              <>
                                {(() => {
                                  const models = [...new Set(expandedMessages.map((m) => m.model).filter(Boolean))];
                                  if (models.length === 0) return null;
                                  return (
                                    <div className="view-chats-grid-models">
                                      <span className="view-chats-grid-models-label">Chatbot model(s):</span>
                                      <ul className="view-chats-grid-models-list" aria-label="Chatbot models used in this conversation">
                                        {models.map((model, i) => (
                                          <li key={i}>{model}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  );
                                })()}
                                {expandedMessages.map((msg, j) => (
                                  msg.role === 'error' ? (
                                    <div key={j} className="view-chats-grid-message view-chats-grid-message--assistant" style={{ color: '#b91c1c' }}>
                                      {msg.content}
                                    </div>
                                  ) : (
                                    <div
                                      key={j}
                                      className={`view-chats-grid-message view-chats-grid-message--${msg.role === 'user' ? 'user' : 'assistant'}`}
                                    >
                                      <span className="view-chats-grid-message-meta">
                                        {msg.role}
                                        {msg.created_at ? ` · ${new Date(msg.created_at).toLocaleString()}` : ''}
                                        {msg.model ? ` · ${msg.model}` : ''}
                                        {msg.role === 'assistant' && (getMessageCost(msg.usage) != null ? ` · Cost: ${formatCost(getMessageCost(msg.usage))}` : '')}
                                      </span>
                                      <div style={{ marginTop: '0.25rem' }}>
                                        {viewAsFormatted ? (
                                          <div className="chat-message-content chat-message-content--markdown">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatChatContent(msg.content)}</ReactMarkdown>
                                          </div>
                                        ) : (
                                          <>{msg.content}</>
                                        )}
                                      </div>
                                    </div>
                                  )
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
