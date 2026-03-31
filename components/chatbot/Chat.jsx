'use client';

import { useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatChatContent } from './utils/formatChatContent.js';
import { apiUrl } from './utils/api.js';

const INPUT_SECTION_HEIGHT_MIN = 56;
const INPUT_SECTION_HEIGHT_MAX = 240;
const INPUT_SECTION_HEIGHT_DEFAULT = 80;

export default function Chat({
  apiBase,
  chatMode,
  conversationHistory,
  onHistoryChange,
  onClearHistory,
  promptInfo,
  model,
  backgroundColor,
  contactUrl = '',
  contactTargetOrigin = '',
  allowedParentOrigins = [],
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [inputSectionHeight, setInputSectionHeight] = useState(INPUT_SECTION_HEIGHT_DEFAULT);
  const resizeRef = useRef({ startY: 0, startHeight: 0 });

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: inputSectionHeight };
    const onMove = (moveEvent) => {
      const dy = resizeRef.current.startY - moveEvent.clientY;
      setInputSectionHeight(() => {
        const next = resizeRef.current.startHeight + dy;
        return Math.min(INPUT_SECTION_HEIGHT_MAX, Math.max(INPUT_SECTION_HEIGHT_MIN, next));
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
  }, [inputSectionHeight]);

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || !chatMode) return;

    const newHistory = [...conversationHistory, { role: 'user', content: userMessage }];
    onHistoryChange(newHistory);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const body = {
        chat_mode: chatMode,
        conversation_history: conversationHistory,
        user_message: userMessage,
      };
      if (typeof model === 'string' && model.trim() !== '') body.model = model.trim();
      const res = await fetch(apiUrl(apiBase, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
      const assistantMessage = { role: 'assistant', content: data.content || '' };
      if (data.usage != null && typeof data.usage === 'object') assistantMessage.usage = data.usage;
      if (typeof data.model === 'string' && data.model.trim() !== '') assistantMessage.model = data.model.trim();
      onHistoryChange([...newHistory, assistantMessage]);
    } catch (err) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleContact = useCallback(() => {
    if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
      setError('Send at least one message before continuing to contact.');
      return;
    }
    const referrerOrigin = (() => {
      try {
        return document.referrer ? new URL(document.referrer).origin : '';
      } catch {
        return '';
      }
    })();
    const targetOrigin = (contactTargetOrigin || referrerOrigin || '*').trim();
    const normalizedAllowlist = Array.isArray(allowedParentOrigins)
      ? allowedParentOrigins.map((origin) => String(origin).trim()).filter(Boolean)
      : [];
    if (normalizedAllowlist.length > 0 && targetOrigin !== '*' && !normalizedAllowlist.includes(targetOrigin)) {
      setError('Unable to share chat with this page. Origin is not allowed.');
      return;
    }
    const transcript = conversationHistory
      .filter((msg) => msg && typeof msg.content === 'string' && (msg.role === 'user' || msg.role === 'assistant'))
      .map((msg) => ({
        role: msg.role,
        content: msg.content.slice(0, 4000),
      }));
    const summary = transcript
      .slice(-6)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n')
      .slice(0, 6000);
    const payload = {
      type: 'usageflows:contactPayload',
      version: 1,
      source: 'usageflows-chatbot',
      modeId: chatMode,
      transcript,
      summary,
      timestamp: Date.now(),
      leadContext: {
        model: typeof model === 'string' ? model : '',
        contactUrl: typeof contactUrl === 'string' ? contactUrl : '',
      },
    };
    window.parent.postMessage(payload, targetOrigin);
  }, [allowedParentOrigins, chatMode, contactTargetOrigin, contactUrl, conversationHistory, model]);

  return (
    <div className="chat" style={backgroundColor ? { '--chat-messages-bg': backgroundColor } : undefined}>
      <div className="chat-messages">
        {conversationHistory.length === 0 && (
          <div className="chat-placeholder">
            {typeof promptInfo === 'string' && promptInfo.trim() !== '' ? promptInfo.trim() : 'Send a message to start.'}
          </div>
        )}
        {conversationHistory.map((msg, i) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div key={i} className={`chat-message chat-message--${msg.role}`}>
              <span className="chat-message-role">
                {msg.role === 'user' ? 'Chat' : msg.role === 'assistant' ? 'Result' : msg.role}
              </span>
              {isAssistant ? (
                <div className="chat-message-body chat-message-body--assistant">
                  <div className="chat-message-content chat-message-content--markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatChatContent(msg.content)}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="chat-message-content">{msg.content}</div>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="chat-error">{error}</div>}
      <div className="chat-bottom">
        <div className="chat-input-section" style={{ height: inputSectionHeight }}>
          <div
            className="chat-input-resize-handle"
            onMouseDown={handleResizeStart}
            role="slider"
            aria-label="Resize message input height"
            aria-valuemin={INPUT_SECTION_HEIGHT_MIN}
            aria-valuemax={INPUT_SECTION_HEIGHT_MAX}
            aria-valuenow={inputSectionHeight}
          />
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              disabled={sending || !chatMode}
              rows={2}
              aria-label="Type a message"
            />
            <div className="chat-input-actions">
              <button
                type="button"
                className="chat-send"
                onClick={handleSend}
                disabled={sending || !input.trim() || !chatMode}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
              {typeof onClearHistory === 'function' && (
                <button type="button" className="chat-clear-btn" onClick={onClearHistory} aria-label="Clear chat" title="Clear chat">
                  Clear
                </button>
              )}
              <button
                type="button"
                className="chat-contact-btn"
                onClick={handleContact}
                disabled={sending || conversationHistory.length === 0}
                aria-label="Continue to contact page"
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="chat-disclaimer" aria-label="Disclaimer">
        Responses are AI-generated and do not constitute formal advice.
      </p>
    </div>
  );
}
