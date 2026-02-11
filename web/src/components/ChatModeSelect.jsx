export default function ChatModeSelect({ chatModes, value, onChange }) {
  const safeValue = typeof value === 'object' && value !== null && 'id' in value ? value.id : value;
  const safeModes = Array.isArray(chatModes) ? chatModes : [];
  return (
    <label className="chat-mode-select">
      <span>Chat mode</span>
      <select
        value={typeof safeValue === 'string' ? safeValue : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={!safeModes.length}
      >
        {!safeModes.length && (
          <option value="">No modes available</option>
        )}
        {safeModes.map((mode) => {
          const id = typeof mode === 'object' && mode !== null && 'id' in mode ? mode.id : mode;
          const label = typeof mode === 'object' && mode !== null && 'displayName' in mode ? mode.displayName : mode;
          return (
            <option key={id} value={id}>
              {typeof label === 'string' ? label : String(id ?? '')}
            </option>
          );
        })}
      </select>
    </label>
  );
}
