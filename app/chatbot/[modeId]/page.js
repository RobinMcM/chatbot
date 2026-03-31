import ChatbotClient from '../../../components/chatbot/ChatbotClient.jsx';

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

export default function ChatbotModePage({ params, searchParams }) {
  return (
    <ChatbotClient
      embedded={false}
      modeId={params.modeId}
      model={parseModel(searchParams)}
      backgroundColor={parseBackgroundColor(searchParams)}
    />
  );
}
