import ChatbotClient from '../../../components/chatbot/ChatbotClient.jsx';

function parseRule(searchParams, params) {
  if (searchParams && typeof searchParams.rule === 'string' && searchParams.rule.trim()) {
    return searchParams.rule.trim().slice(0, 64);
  }
  if (params && typeof params.modeId === 'string' && params.modeId.trim()) {
    return params.modeId.trim().slice(0, 64);
  }
  return '';
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

function parseRulesSource(searchParams) {
  if (!searchParams) return 'folder';
  const value = typeof searchParams.rules_source === 'string' ? searchParams.rules_source.trim().toLowerCase() : '';
  if (value === 'hidden') return 'hidden';
  if (value === 'external') return 'external';
  return 'folder';
}

function parseContextLabel(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.context_label === 'string' ? searchParams.context_label : '';
  return value.trim().slice(0, 160);
}

function parsePromptInfo(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.prompt_info === 'string' ? searchParams.prompt_info : '';
  return value.trim().slice(0, 20000);
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

function parseRulesPanel(searchParams) {
  if (!searchParams) return '';
  const value = typeof searchParams.rules_panel === 'string' ? searchParams.rules_panel.trim().toLowerCase() : '';
  return value === 'visible' || value === 'hidden' ? value : '';
}

async function resolveRouteProps(params, searchParams) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  return {
    params: resolvedParams && typeof resolvedParams === 'object' ? resolvedParams : {},
    searchParams: resolvedSearchParams && typeof resolvedSearchParams === 'object' ? resolvedSearchParams : {},
  };
}

export default async function ChatbotModePage({ params, searchParams }) {
  const resolved = await resolveRouteProps(params, searchParams);
  return (
    <ChatbotClient
      embedded={false}
      ruleId={parseRule(resolved.searchParams, resolved.params)}
      modeId={resolved.params.modeId}
      model={parseModel(resolved.searchParams)}
      backgroundColor={parseBackgroundColor(resolved.searchParams)}
      contactUrl={parseContactUrl(resolved.searchParams)}
      contactTargetOrigin={parseContactTargetOrigin(resolved.searchParams)}
      allowedParentOrigins={parseAllowedParentOrigins(resolved.searchParams)}
      rulesSource={parseRulesSource(resolved.searchParams)}
      contextLabel={parseContextLabel(resolved.searchParams)}
      promptInfoOverride={parsePromptInfo(resolved.searchParams)}
      assistantEnabled={parseAssistantEnabled(resolved.searchParams)}
      assistantDisabledMessage={parseAssistantDisabledMessage(resolved.searchParams)}
      rulesPanel={parseRulesPanel(resolved.searchParams)}
    />
  );
}
