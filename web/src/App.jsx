import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Chat from './components/Chat';
import mksLogo from '../images/MKS.png';

const PANEL_HEIGHT_DEFAULT = 520;
const PANEL_HEIGHT_MIN = 320;
const PANEL_HEIGHT_MAX = 800;
const PANEL_WIDTH_DEFAULT = 380;
const PANEL_WIDTH_MIN = 320;
const PANEL_WIDTH_MAX = 640;

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

export default function App() {
  const [chatModes, setChatModes] = useState([]);
  const [chatMode, setChatMode] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT_DEFAULT);
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH_DEFAULT);
  const resizeRef = useRef({ startY: 0, startHeight: 0 });
  const widthResizeRef = useRef({ startX: 0, startWidth: 0 });
  const { modeId: modeIdParam } = useParams();
  const navigate = useNavigate();

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

  const handleWidthResizeStart = useCallback((e) => {
    e.preventDefault();
    widthResizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    const onMove = (moveEvent) => {
      const dx = widthResizeRef.current.startX - moveEvent.clientX;
      setPanelWidth((w) => {
        const next = widthResizeRef.current.startWidth + dx;
        return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, next));
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  useEffect(() => {
    fetch('/api/chat-modes')
      .then((res) => res.json())
      .then((data) => {
        const modes = data.chat_modes || [];
        const list = Array.isArray(modes) ? modes : [];
        setChatModes(list);
        const ids = list.map((m) => (typeof m === 'object' && m != null && 'id' in m ? m.id : m));
        const normalized = typeof modeIdParam === 'string' && modeIdParam.trim() !== '' ? modeIdParam.trim() : null;
        const canonical = normalized
          ? ids.find((id) => id.toLowerCase() === normalized.toLowerCase()) || null
          : null;
        if (list.length > 0) {
          if (canonical) {
            setChatMode(canonical);
          } else {
            navigate(`/${ids[0]}`, { replace: true });
            setChatMode(ids[0]);
          }
        } else {
          setChatMode('');
        }
      })
      .catch((err) => setError(err.message || 'Failed to load chat modes'))
      .finally(() => setLoading(false));
  }, [modeIdParam, navigate]);

  useEffect(() => {
    if (chatModes.length === 0) return;
    const ids = chatModes.map((m) => (typeof m === 'object' && m != null && 'id' in m ? m.id : m));
    const normalized = typeof modeIdParam === 'string' && modeIdParam.trim() !== '' ? modeIdParam.trim() : null;
    const canonical = normalized ? ids.find((id) => id.toLowerCase() === normalized.toLowerCase()) : null;
    if (canonical) setChatMode(canonical);
  }, [modeIdParam, chatModes]);

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
          <div className="chatbot-panel" style={{ height: panelHeight, width: panelWidth }}>
            <div
              className="chatbot-panel-width-resize-handle"
              onMouseDown={handleWidthResizeStart}
              role="slider"
              aria-label="Resize chat panel width"
              aria-valuemin={PANEL_WIDTH_MIN}
              aria-valuemax={PANEL_WIDTH_MAX}
              aria-valuenow={panelWidth}
            />
            <div className="chatbot-panel-body">
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
        <div className="chatbot-panel" style={{ height: panelHeight, width: panelWidth }}>
          <div
            className="chatbot-panel-width-resize-handle"
            onMouseDown={handleWidthResizeStart}
            role="slider"
            aria-label="Resize chat panel width"
            aria-valuemin={PANEL_WIDTH_MIN}
            aria-valuemax={PANEL_WIDTH_MAX}
            aria-valuenow={panelWidth}
          />
          <div className="chatbot-panel-body">
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
                          const mode = Array.isArray(chatModes) ? chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === chatMode) : null;
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
              chatMode={chatMode}
              conversationHistory={conversationHistory}
              onHistoryChange={setConversationHistory}
              onClearHistory={() => setConversationHistory([])}
              promptInfo={(() => {
                const mode = chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === chatMode);
                return typeof mode === 'object' && mode != null && 'promptInfo' in mode ? mode.promptInfo : '';
              })()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
