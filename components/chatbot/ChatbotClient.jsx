'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Chat from './Chat.jsx';
import { apiUrl } from './utils/api.js';

const PANEL_HEIGHT_DEFAULT = 520;
const PANEL_HEIGHT_MIN = 320;
const PANEL_HEIGHT_MAX = 800;

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text || text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server');
  }
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ExpandIcon({ expanded = false }) {
  if (expanded) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 3 3 3 3 9" />
      <polyline points="15 21 21 21 21 15" />
      <line x1="3" y1="3" x2="10" y2="10" />
      <line x1="21" y1="21" x2="14" y2="14" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export default function ChatbotClient({ embedded = false, apiBase = '', modeId = null, model = '', backgroundColor = '' }) {
  const [chatModes, setChatModes] = useState([]);
  const [chatMode, setChatMode] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(embedded);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT_DEFAULT);
  const resizeRef = useRef({ startY: 0, startHeight: 0 });

  const getMaxHeight = useCallback(
    () => Math.min(PANEL_HEIGHT_MAX, typeof window !== 'undefined' ? window.innerHeight - 80 : PANEL_HEIGHT_MAX),
    []
  );

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: panelHeight };
    const onMove = (moveEvent) => {
      const dy = moveEvent.clientY - resizeRef.current.startY;
      const maxH = getMaxHeight();
      setPanelHeight(() => {
        const next = resizeRef.current.startHeight - dy;
        return Math.min(maxH, Math.max(PANEL_HEIGHT_MIN, next));
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelHeight, getMaxHeight]);

  useEffect(() => {
    fetch(apiUrl(apiBase, '/api/chat-modes'))
      .then(async (res) => {
        const data = await readJsonResponse(res);
        if (!res.ok) throw new Error(data?.error || res.statusText || 'Failed to load chat modes');
        return data;
      })
      .then((data) => {
        const modes = data.chat_modes || [];
        const list = Array.isArray(modes) ? modes : [];
        setChatModes(list);
        const ids = list.map((m) => (typeof m === 'object' && m != null && 'id' in m ? m.id : m));
        const normalized = typeof modeId === 'string' && modeId.trim() !== '' ? modeId.trim() : null;
        const canonical = normalized ? ids.find((id) => id.toLowerCase() === normalized.toLowerCase()) || null : null;
        if (list.length > 0) {
          if (canonical) {
            setChatMode(canonical);
          } else {
            const query = typeof window !== 'undefined' ? window.location.search : '';
            const destination = `${embedded ? `/chatbot/embed/${ids[0]}` : `/chatbot/${ids[0]}`}${query}`;
            window.history.replaceState(null, '', destination);
            setChatMode(ids[0]);
          }
        } else {
          setChatMode('');
        }
      })
      .catch((err) => setError(err.message || 'Failed to load chat modes'))
      .finally(() => setLoading(false));
  }, [modeId, embedded, apiBase]);

  if (loading) {
    return (
      <div className={`chatbot-widget${embedded ? ' chatbot-widget--embed' : ''}`}>
        {!embedded && (
          <button type="button" className="chatbot-toggle" onClick={() => setOpen(true)} aria-label="Open chat" disabled>
            <ChatIcon />
          </button>
        )}
        <span className="chatbot-loading">Loading…</span>
      </div>
    );
  }

  return (
    <div className={`chatbot-widget${embedded ? ' chatbot-widget--embed' : ''}`}>
      {!open && !embedded ? (
        <button type="button" className="chatbot-toggle" onClick={() => setOpen(true)} aria-label="Open chat">
          <ChatIcon />
        </button>
      ) : (
        <div>
          <div
            className="chatbot-panel"
            style={
              embedded
                ? { height: '100%', width: '100%', maxHeight: '100%', maxWidth: '100%' }
                : expanded
                  ? { height: 'calc(100vh - 2rem)', width: 'calc(100vw - 2rem)', maxHeight: '900px', maxWidth: '960px' }
                  : { height: panelHeight, width: 380 }
            }
          >
            <div className="chatbot-panel-body">
              {!embedded && !expanded && (
                <div className="chatbot-panel-resize-handle" onMouseDown={handleResizeStart} role="slider" aria-label="Resize chat panel height" aria-valuemin={PANEL_HEIGHT_MIN} aria-valuemax={PANEL_HEIGHT_MAX} aria-valuenow={panelHeight} />
              )}
              <header className="chatbot-panel-header">
                <div className="chatbot-panel-title-row">
                  <div className="chatbot-panel-brand">
                    <button
                      type="button"
                      className="chatbot-panel-expand"
                      onClick={() => setExpanded((prev) => !prev)}
                      aria-label={expanded ? 'Collapse chat panel' : 'Expand chat panel'}
                      title={expanded ? 'Collapse' : 'Expand'}
                    >
                      <ExpandIcon expanded={expanded} />
                    </button>
                    <span className="chatbot-panel-title"><strong>Rapid</strong> MVP Assistant</span>
                  </div>
                  {!embedded && (
                    <button type="button" className="chatbot-panel-close" onClick={() => setOpen(false)} aria-label="Close chat">
                      <ChevronDownIcon />
                    </button>
                  )}
                </div>
                <div className="chatbot-panel-header-section">
                  <div className="chatbot-panel-prompt-row">
                    {chatMode && (
                      <span className="chatbot-panel-mode-name" aria-label="Current chat mode">
                        Lets Chat about{' '}
                        {(() => {
                          const mode = chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === chatMode);
                          return typeof mode === 'object' && mode != null && 'displayName' in mode ? mode.displayName : chatMode;
                        })()}
                      </span>
                    )}
                    <div className="chatbot-panel-info-wrap">
                      <button type="button" className="chatbot-panel-info-btn" onClick={() => setInfoOpen((o) => !o)} aria-label="Prompt information" aria-expanded={infoOpen}>
                        <InfoIcon />
                      </button>
                      {infoOpen && (
                        <div className="chatbot-panel-info-popover" role="dialog" aria-label="Prompt information">
                          <h3 className="chatbot-panel-info-heading">Prompt Information</h3>
                          <p className="chatbot-panel-info-text">
                            {(() => {
                              const mode = Array.isArray(chatModes) ? chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === chatMode) : null;
                              const text = typeof mode === 'object' && mode != null && 'promptInfo' in mode ? mode.promptInfo : null;
                              return typeof text === 'string' ? text : 'No description.';
                            })()}
                          </p>
                          <button type="button" className="chatbot-panel-info-close" onClick={() => setInfoOpen(false)} aria-label="Close">×</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </header>
              {error && <div className="chatbot-panel-error">Error: {error}</div>}
              <Chat
                apiBase={apiBase}
                chatMode={chatMode}
                conversationHistory={conversationHistory}
                onHistoryChange={setConversationHistory}
                onClearHistory={() => setConversationHistory([])}
                promptInfo={(() => {
                  const mode = chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === chatMode);
                  return typeof mode === 'object' && mode != null && 'promptInfo' in mode ? mode.promptInfo : '';
                })()}
                model={model}
                backgroundColor={backgroundColor}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
