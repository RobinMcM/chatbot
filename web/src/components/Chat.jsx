import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const INPUT_SECTION_HEIGHT_MIN = 56;
const INPUT_SECTION_HEIGHT_MAX = 240;
const INPUT_SECTION_HEIGHT_DEFAULT = 80;

export default function Chat({ chatMode, conversationHistory, onHistoryChange, onClearHistory, promptInfo }) {
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
      setInputSectionHeight((h) => {
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

    const newHistory = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];
    onHistoryChange(newHistory);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_mode: chatMode,
          conversation_history: conversationHistory,
          user_message: userMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || 'Request failed');
      }
      const assistantMessage = {
        role: 'assistant',
        content: data.content || '',
      };
      if (data.usage != null && typeof data.usage === 'object') {
        assistantMessage.usage = data.usage;
      }
      if (typeof data.model === 'string' && data.model.trim() !== '') {
        assistantMessage.model = data.model.trim();
      }
      onHistoryChange([...newHistory, assistantMessage]);
    } catch (err) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {conversationHistory.length === 0 && (
          <div className="chat-placeholder">
            {typeof promptInfo === 'string' && promptInfo.trim() !== '' ? promptInfo.trim() : 'Send a message to start.'}
          </div>
        )}
        {conversationHistory.map((msg, i) => {
          const isAssistant = msg.role === 'assistant';
          const usage = isAssistant ? msg.usage : null;
          const cost = usage != null
            ? (usage.total ?? usage.total_cost ?? usage.subtotal)
            : null;
          const costDisplay = isAssistant
            ? (typeof cost === 'number' && !Number.isNaN(cost) ? `$${Number(cost).toFixed(4)}` : '—')
            : null;
          const modelDisplay = isAssistant && typeof msg.model === 'string' && msg.model.trim() !== '' ? msg.model.trim() : null;
          return (
            <div key={i} className={`chat-message chat-message--${msg.role}`}>
              <span className="chat-message-role">
                {msg.role === 'user' ? 'Chat' : msg.role === 'assistant' ? 'Result' : msg.role}
              </span>
              {isAssistant ? (
                <div className="chat-message-body chat-message-body--assistant">
                  <div className="chat-message-content chat-message-content--markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ''}</ReactMarkdown>
                    <span className="chat-result-cost-inline">
                      Cost: {costDisplay}
                      {modelDisplay != null && ` · ${modelDisplay}`}
                    </span>
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
      <div
        className="chat-input-section"
        style={{ height: inputSectionHeight }}
      >
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
              <button
                type="button"
                className="chat-clear-btn"
                onClick={onClearHistory}
                aria-label="Clear chat"
                title="Clear chat"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="chat-disclaimer" aria-label="Disclaimer">
        Responses are AI-generated and do not constitute formal advice.
      </p>
    </div>
  );
}
