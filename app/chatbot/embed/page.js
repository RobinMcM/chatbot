import ChatbotClient from '../../../components/chatbot/ChatbotClient.jsx';

function parseMode(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.mode === 'string' ? searchParams.mode : '';
  return value.trim().slice(0, 64);
}

function parseModel(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.model === 'string' ? searchParams.model : '';
  return value.trim().slice(0, 128);
}

function parseBackgroundColor(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.bg === 'string' ? searchParams.bg.trim() : '';
  if (!value) return '';
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
  const isCssFunc = /^(rgb|rgba|hsl|hsla)\([^)]+\)$/.test(value);
  const isKeyword = /^(transparent|white|black|gray|grey|blue|green|red|yellow|orange|purple|pink|teal|cyan|indigo|slate|zinc|neutral|stone)$/i.test(value);
  return isHex || isCssFunc || isKeyword ? value : '';
}

function parseContactUrl(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.contact_url === 'string' ? searchParams.contact_url.trim() : '';
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function parseContactTargetOrigin(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.contact_target_origin === 'string' ? searchParams.contact_target_origin.trim() : '';
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function parseAllowedParentOrigins(searchParams) {
  if (!searchParams) return [];
  const value = typeof searchParams.allowed_parent_origins === 'string' ? searchParams.allowed_parent_origins : '';
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function parseAssistantEnabled(searchParams) {
  if (!searchParams) return true;
  const value = typeof searchParams.assistant_enabled === 'string' ? searchParams.assistant_enabled.trim().toLowerCase() : '';
  if (value === '0' || value === 'false' || value === 'off') return false;
  return true;
}

function parseAssistantDisabledMessage(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.assistant_disabled_message === 'string' ? searchParams.assistant_disabled_message : '';
  return value.trim().slice(0, 400);
}

async function resolveSearchParams(searchParams) {
  const resolved = await Promise.resolve(searchParams);
  return resolved && typeof resolved === 'object' ? resolved : {};
}

export default async function ChatbotEmbedPage({ searchParams }) {
  const sp = await resolveSearchParams(searchParams);
  return (
    <ChatbotClient
      embedded
      modeId={parseMode(sp)}
      model={parseModel(sp)}
      backgroundColor={parseBackgroundColor(sp)}
      contactUrl={parseContactUrl(sp)}
      contactTargetOrigin={parseContactTargetOrigin(sp)}
      allowedParentOrigins={parseAllowedParentOrigins(sp)}
      assistantEnabled={parseAssistantEnabled(sp)}
      assistantDisabledMessage={parseAssistantDisabledMessage(sp)}
    />
  );
}
