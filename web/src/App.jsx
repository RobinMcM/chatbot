import { useState, useEffect, useRef, useCallback } from 'react';
import ChatModeSelect from './components/ChatModeSelect';
import Chat from './components/Chat';
import mksLogo from '../images/MKS.png';

const PANEL_HEIGHT_DEFAULT = 520;
const PANEL_HEIGHT_MIN = 320;
const PANEL_HEIGHT_MAX = 800;

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

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ClearChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default function App() {
  const [chatModes, setChatModes] = useState([]);
  const [chatMode, setChatMode] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT_DEFAULT);
  const resizeRef = useRef({ startY: 0, startHeight: 0 });

  const getMaxHeight = useCallback(() => Math.min(PANEL_HEIGHT_MAX, typeof window !== 'undefined' ? window.innerHeight - 80 : PANEL_HEIGHT_MAX), []);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: panelHeight };
    const onMove = (moveEvent) => {
      const dy = moveEvent.clientY - resizeRef.current.startY;
      const maxH = getMaxHeight();
      setPanelHeight((h) => {
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
    fetch('/api/chat-modes')
      .then((res) => res.json())
      .then((data) => {
        const modes = data.chat_modes || [];
        setChatModes(Array.isArray(modes) ? modes : []);
        if (modes.length && !chatMode) {
          const first = modes[0];
          const id = typeof first === 'object' && first !== null && 'id' in first ? first.id : first;
          setChatMode(typeof id === 'string' ? id : '');
        }
      })
      .catch((err) => setError(err.message || 'Failed to load chat modes'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="chatbot-widget">
        <button type="button" className="chatbot-toggle" onClick={() => setOpen(true)} aria-label="Open chat" disabled>
          <ChatIcon />
        </button>
        <span className="chatbot-loading">Loading…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="chatbot-widget">
        <button type="button" className="chatbot-toggle" onClick={() => setOpen(true)} aria-label="Open chat">
          <ChatIcon />
        </button>
        {open && (
          <div className="chatbot-panel" style={{ height: panelHeight }}>
            <div
              className="chatbot-panel-resize-handle"
              onMouseDown={handleResizeStart}
              role="slider"
              aria-label="Resize chat panel height"
              aria-valuemin={PANEL_HEIGHT_MIN}
              aria-valuemax={PANEL_HEIGHT_MAX}
              aria-valuenow={panelHeight}
            />
            <header className="chatbot-panel-header">
              <div className="chatbot-panel-brand">
                <img src={mksLogo} alt="MKS" className="chatbot-panel-logo" />
                <span className="chatbot-panel-title"><strong>Moore</strong> Kingston Smith</span>
              </div>
              <button type="button" className="chatbot-panel-close" onClick={() => setOpen(false)} aria-label="Close chat">
                <ChevronDownIcon />
              </button>
            </header>
            <div className="chatbot-panel-error">Error: {error}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chatbot-widget">
      {!open ? (
        <button type="button" className="chatbot-toggle" onClick={() => setOpen(true)} aria-label="Open chat">
          <ChatIcon />
        </button>
      ) : (
        <div className="chatbot-panel" style={{ height: panelHeight }}>
          <div
            className="chatbot-panel-resize-handle"
            onMouseDown={handleResizeStart}
            role="slider"
            aria-label="Resize chat panel height"
            aria-valuemin={PANEL_HEIGHT_MIN}
            aria-valuemax={PANEL_HEIGHT_MAX}
            aria-valuenow={panelHeight}
          />
          <header className="chatbot-panel-header">
            <div className="chatbot-panel-title-row">
              <div className="chatbot-panel-brand">
                <img src={mksLogo} alt="MKS" className="chatbot-panel-logo" />
                <span className="chatbot-panel-title"><strong>Moore</strong> Kingston Smith</span>
              </div>
              <button type="button" className="chatbot-panel-close" onClick={() => setOpen(false)} aria-label="Close chat">
                <ChevronDownIcon />
              </button>
            </div>
            <div className="chatbot-panel-header-section">
              <h2 className="chatbot-panel-heading">what would you like to ask ..</h2>
              <div className="chatbot-panel-prompt-row">
                <button
                  type="button"
                  className="chatbot-panel-clear-btn"
                  onClick={() => setConversationHistory([])}
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <ClearChatIcon />
                </button>
                <ChatModeSelect
                  chatModes={chatModes}
                  value={typeof chatMode === 'object' && chatMode !== null && 'id' in chatMode ? chatMode.id : chatMode}
                  onChange={setChatMode}
                />
                <div className="chatbot-panel-info-wrap">
                  <button
                    type="button"
                    className="chatbot-panel-info-btn"
                    onClick={() => setInfoOpen((o) => !o)}
                    aria-label="Prompt information"
                    aria-expanded={infoOpen}
                  >
                    <InfoIcon />
                  </button>
                  {infoOpen && (
                    <div className="chatbot-panel-info-popover" role="dialog" aria-label="Prompt information">
                      <h3 className="chatbot-panel-info-heading">Prompt Information</h3>
                      <p className="chatbot-panel-info-text">
                        {(() => {
                          const modeId = typeof chatMode === 'object' && chatMode != null && 'id' in chatMode ? chatMode.id : chatMode;
                          const mode = Array.isArray(chatModes) ? chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === modeId) : null;
                          const text = typeof mode === 'object' && mode != null && 'promptInfo' in mode ? mode.promptInfo : null;
                          return typeof text === 'string' ? text : 'No description.';
                        })()}
                      </p>
                      <button type="button" className="chatbot-panel-info-close" onClick={() => setInfoOpen(false)} aria-label="Close">
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>
          <Chat
            chatMode={typeof chatMode === 'object' && chatMode !== null && 'id' in chatMode ? chatMode.id : chatMode}
            conversationHistory={conversationHistory}
            onHistoryChange={setConversationHistory}
          />
        </div>
      )}
    </div>
  );
}
