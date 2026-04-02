'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatChatContent } from './utils/formatChatContent.js';
import { apiUrl } from './utils/api.js';

const INSUFFICIENT_CREDITS_CHAT_MESSAGE = 'Insufficient Credits';
const HIDDEN_RULES_REQUEST_TIMEOUT_MS = 1200;

function isInsufficientCreditsError(value) {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  if (!text) return false;
  return (
    text.includes('insufficient credits') ||
    text.includes('requires more credits') ||
    text.includes('not enough credits') ||
    (text.includes('402') && text.includes('credit'))
  );
}

export default function Chat({
  apiBase,
  chatMode,
  conversationHistory,
  onHistoryChange,
  onClearHistory,
  promptInfo,
  model,
  contactUrl = '',
  contactTargetOrigin = '',
  allowedParentOrigins = [],
  rulesSource = 'folder',
  assistantEnabled = true,
  assistantDisabledMessage = '',
  showRulesPanel = false,
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(-1);
  const [rulesPreview, setRulesPreview] = useState('');
  const normalizedRulesSource = rulesSource === 'hidden' || rulesSource === 'external' ? rulesSource : 'folder';
  const isHostRulesSource = normalizedRulesSource === 'hidden' || normalizedRulesSource === 'external';
  const disabledMessage = typeof assistantDisabledMessage === 'string' && assistantDisabledMessage.trim()
    ? assistantDisabledMessage.trim()
    : 'Assistant is disabled for this section.';

  const requestHiddenRulesText = useCallback(async () => {
    if (typeof window === 'undefined' || !window.parent || window.parent === window) return '';
    const requestId = `hidden-rules-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timer);
        resolve(typeof value === 'string' ? value : '');
      };

      const onMessage = (event) => {
        if (event.source !== window.parent) return;
        const data = event.data ?? {};
        if (!data || data.type !== 'usageflows:hiddenRulesPayload') return;
        if (data.requestId !== requestId) return;
        settle(typeof data.rulesText === 'string' ? data.rulesText.slice(0, 20000) : '');
      };

      const timer = window.setTimeout(() => settle(''), HIDDEN_RULES_REQUEST_TIMEOUT_MS);
      window.addEventListener('message', onMessage);
      window.parent.postMessage({
        type: 'usageflows:requestHiddenRules',
        source: 'usageflows-chatbot',
        requestId,
        timestamp: Date.now(),
      }, '*');
    });
  }, []);

  useEffect(() => {
    if (!showRulesPanel || !isHostRulesSource) {
      setRulesPreview('');
      return;
    }
    let cancelled = false;
    requestHiddenRulesText().then((text) => {
      if (cancelled) return;
      setRulesPreview(typeof text === 'string' ? text : '');
    });
    return () => {
      cancelled = true;
    };
  }, [isHostRulesSource, requestHiddenRulesText, showRulesPanel]);

  const handleSend = async () => {
    if (!assistantEnabled) return;
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
      body.rules_source = normalizedRulesSource;
      if (isHostRulesSource) {
        const hiddenRulesText = await requestHiddenRulesText();
        if (hiddenRulesText.trim()) {
          body.hidden_rules_text = hiddenRulesText;
        }
        if (showRulesPanel) setRulesPreview(hiddenRulesText);
      }
      if (typeof model === 'string' && model.trim() !== '') body.model = model.trim();
      console.log('[chatbot] sending /api/chat', {
        chat_mode: body.chat_mode,
        history_count: Array.isArray(body.conversation_history) ? body.conversation_history.length : 0,
        user_message_length: typeof body.user_message === 'string' ? body.user_message.length : 0,
        model: body.model || null,
      });
      const res = await fetch(apiUrl(apiBase, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      console.log('[chatbot] /api/chat response', { status: res.status, ok: res.ok, data });
      if (typeof data.error === 'string' && data.error.trim() !== '') {
        throw new Error(data.error.trim());
      }
      if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
      const assistantMessage = { role: 'assistant', content: data.content || '' };
      if (data.usage != null && typeof data.usage === 'object') assistantMessage.usage = data.usage;
      if (typeof data.model === 'string' && data.model.trim() !== '') assistantMessage.model = data.model.trim();
      const updatedHistory = [...newHistory, assistantMessage];
      onHistoryChange(updatedHistory);
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'usageflows:chatResult',
          source: 'usageflows-chatbot',
          version: 1,
          modeId: chatMode,
          message: assistantMessage.content,
          timestamp: Date.now(),
        }, '*');
      }
    } catch (err) {
      const message = err?.message || 'Failed to send';
      console.error('[chatbot] send failed', { message, chatMode, model: model || null });
      if (isInsufficientCreditsError(message)) {
        onHistoryChange([...newHistory, { role: 'assistant', content: INSUFFICIENT_CREDITS_CHAT_MESSAGE }]);
        setError(null);
      } else {
        setError(message);
      }
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

  const handleCopyMessage = useCallback(async (message, index) => {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMessageIndex(index);
      window.setTimeout(() => setCopiedMessageIndex((current) => (current === index ? -1 : current)), 1200);
    } catch {
      setError('Unable to copy message.');
    }
  }, []);

  return (
    <div className="chat">
      <div className="chat-messages">
        {conversationHistory.length === 0 && (
          <div className="chat-placeholder">
            {!assistantEnabled
              ? disabledMessage
              : (typeof promptInfo === 'string' && promptInfo.trim() !== '' ? promptInfo.trim() : 'Send a message to start.')}
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
                  <div className="chat-message-tools">
                    <button
                      type="button"
                      className="chat-message-copy-btn"
                      onClick={() => handleCopyMessage(msg.content, i)}
                      aria-label="Copy this result"
                      title={copiedMessageIndex === i ? 'Copied' : 'Copy'}
                    >
                      {copiedMessageIndex === i ? 'Copied' : 'Copy'}
                    </button>
                  </div>
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
        <div className="chat-input-section">
          <div className={`chat-input-row${showRulesPanel ? ' chat-input-row--split' : ''}`}>
            {showRulesPanel && (
              <div className="chat-rules-panel">
                <label className="chat-rules-label">Active Rules (Development)</label>
                <textarea
                  className="chat-rules-textarea"
                  readOnly
                  value={rulesPreview || 'Waiting for host rules payload...'}
                  aria-label="Active rules payload"
                />
              </div>
            )}
            <div className="chat-composer">
            <textarea
              className="chat-input"
              placeholder={assistantEnabled ? 'Type a message…' : disabledMessage}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              disabled={sending || !chatMode || !assistantEnabled}
              rows={2}
              aria-label="Type a message"
            />
            <div className="chat-input-actions">
              <button
                type="button"
                className="chat-send"
                onClick={handleSend}
                disabled={sending || !input.trim() || !chatMode || !assistantEnabled}
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
                disabled={sending || conversationHistory.length === 0 || !assistantEnabled}
                aria-label="Continue to contact page"
              >
                Contact
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
      <p className="chat-disclaimer" aria-label="Disclaimer">
        Responses are AI-generated and do not constitute formal advice.
        <span className="chat-footer-label" aria-label="Footer label">7</span>
      </p>
    </div>
  );
}
