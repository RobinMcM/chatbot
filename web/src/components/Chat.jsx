import { useState } from 'react';

export default function Chat({ chatMode, conversationHistory, onHistoryChange }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

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
          <div className="chat-placeholder">Send a message to start.</div>
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
          return (
            <div key={i} className={`chat-message chat-message--${msg.role}`}>
              <span className="chat-message-role">
                {msg.role === 'user' ? 'Chat' : msg.role === 'assistant' ? 'Result' : msg.role}
              </span>
              {isAssistant ? (
                <div className="chat-message-body chat-message-body--assistant">
                  <div className="chat-message-content">
                    {msg.content}
                    {'\n\n'}
                    <span className="chat-result-cost-inline">Cost: {costDisplay}</span>
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
      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={sending || !chatMode}
        />
        <button
          type="button"
          className="chat-send"
          onClick={handleSend}
          disabled={sending || !input.trim() || !chatMode}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
