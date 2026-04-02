'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Chat from './Chat.jsx';
import { apiUrl } from './utils/api.js';

const PANEL_HEIGHT_DEFAULT = 520;
const PANEL_HEIGHT_MIN = 320;
const PANEL_HEIGHT_MAX = 800;
const PANEL_WIDTH_DEFAULT = 380;
const PANEL_WIDTH_MIN = 320;
const PANEL_WIDTH_MAX = 640;

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

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ResizeCornerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', margin: 'auto' }}>
      <polyline points="8 3 3 3 3 8" />
      <line x1="3" y1="3" x2="10" y2="10" />
      <polyline points="16 21 21 21 21 16" />
      <line x1="14" y1="14" x2="21" y2="21" />
    </svg>
  );
}

export default function ChatbotClient({
  embedded = false,
  apiBase = '',
  modeId = null,
  ruleId = '',
  model = '',
  backgroundColor = '',
  contactUrl = '',
  contactTargetOrigin = '',
  allowedParentOrigins = [],
  rulesSource = 'folder',
  contextLabel = '',
  promptInfoOverride = '',
  assistantEnabled = true,
  assistantDisabledMessage = '',
  rulesPanel = '',
}) {
  const [chatModes, setChatModes] = useState([]);
  const [chatMode, setChatMode] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(embedded);
  const [infoOpen, setInfoOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT_DEFAULT);
  const [panelWidth, setPanelWidth] = useState(PANEL_WIDTH_DEFAULT);
  const resizeRef = useRef({ startX: 0, startY: 0, startWidth: 0, startHeight: 0 });
  const panelBodyStyle = backgroundColor ? { '--chat-accent-bg': backgroundColor } : undefined;
  const normalizedRulesSource = rulesSource === 'hidden' || rulesSource === 'external' ? rulesSource : 'folder';
  const normalizedContextLabel = typeof contextLabel === 'string' ? contextLabel.trim() : '';
  const normalizedPromptInfoOverride = typeof promptInfoOverride === 'string' ? promptInfoOverride.trim() : '';
  const useExternalDisplay = normalizedRulesSource === 'external';

  const getMaxHeight = useCallback(
    () => Math.min(PANEL_HEIGHT_MAX, typeof window !== 'undefined' ? window.innerHeight - 80 : PANEL_HEIGHT_MAX),
    []
  );
  const getMaxWidth = useCallback(
    () => Math.min(PANEL_WIDTH_MAX, typeof window !== 'undefined' ? window.innerWidth - 32 : PANEL_WIDTH_MAX),
    []
  );

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: panelWidth,
      startHeight: panelHeight,
    };
    const onMove = (moveEvent) => {
      const dx = resizeRef.current.startX - moveEvent.clientX;
      const dy = resizeRef.current.startY - moveEvent.clientY;
      const maxH = getMaxHeight();
      const maxW = getMaxWidth();
      setPanelHeight(() => {
        const next = resizeRef.current.startHeight + dy;
        return Math.min(maxH, Math.max(PANEL_HEIGHT_MIN, next));
      });
      setPanelWidth(() => {
        const next = resizeRef.current.startWidth + dx;
        return Math.min(maxW, Math.max(PANEL_WIDTH_MIN, next));
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelHeight, panelWidth, getMaxHeight, getMaxWidth]);

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
        const normalizedRule = typeof ruleId === 'string' && ruleId.trim() ? ruleId.trim() : '';
        const normalizedLegacyMode = typeof modeId === 'string' && modeId.trim() ? modeId.trim() : '';
        const requested = normalizedRule || normalizedLegacyMode;
        const canonical = requested ? ids.find((id) => id.toLowerCase() === requested.toLowerCase()) || null : null;
        setChatMode(canonical || 'default');
      })
      .catch((err) => setError(err.message || 'Failed to load chat modes'))
      .finally(() => setLoading(false));
  }, [modeId, ruleId, apiBase]);

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

  const selectedMode = Array.isArray(chatModes)
    ? chatModes.find((m) => (typeof m === 'object' && m != null ? m.id : m) === chatMode)
    : null;
  const fallbackDisplayLabel = typeof selectedMode === 'object' && selectedMode != null && 'displayName' in selectedMode
    ? selectedMode.displayName
    : chatMode;
  const resolvedDisplayLabel = useExternalDisplay && normalizedContextLabel
    ? normalizedContextLabel
    : fallbackDisplayLabel;
  const fallbackPromptInfo = typeof selectedMode === 'object' && selectedMode != null && 'promptInfo' in selectedMode
    ? selectedMode.promptInfo
    : '';
  const resolvedPromptInfo = useExternalDisplay && normalizedPromptInfoOverride
    ? normalizedPromptInfoOverride
    : fallbackPromptInfo;
  const promptInfoWithFallbackUrl = (() => {
    const baseText = typeof resolvedPromptInfo === 'string' ? resolvedPromptInfo : '';
    if (!baseText.includes('Fallback template used when no valid rule is provided.')) return baseText;
    if (typeof window === 'undefined') return baseText;
    return `${baseText} (${window.location.href})`;
  })();
  const shouldShowRulesPanel = useExternalDisplay
    ? (rulesPanel === 'visible' || rulesPanel === '')
    : false;

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
                : { height: panelHeight, width: panelWidth }
            }
          >
            {!embedded && (
              <button
                type="button"
                className="chatbot-panel-corner-resize"
                onMouseDown={handleResizeStart}
                aria-label="Resize chat panel"
                title="Drag to resize"
              >
                <ResizeCornerIcon />
              </button>
            )}
            <div className="chatbot-panel-body" style={panelBodyStyle}>
              <header className="chatbot-panel-header">
                <div className="chatbot-panel-title-row">
                  <div className="chatbot-panel-brand">
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
                        {resolvedDisplayLabel}
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
                            {typeof promptInfoWithFallbackUrl === 'string' && promptInfoWithFallbackUrl
                              ? promptInfoWithFallbackUrl
                              : 'No description.'}
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
                promptInfo={promptInfoWithFallbackUrl}
                model={model}
                contactUrl={contactUrl}
                contactTargetOrigin={contactTargetOrigin}
                allowedParentOrigins={allowedParentOrigins}
                rulesSource={normalizedRulesSource}
                assistantEnabled={assistantEnabled}
                assistantDisabledMessage={assistantDisabledMessage}
                showRulesPanel={shouldShowRulesPanel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
