import ChatbotClient from '../../../../components/chatbot/ChatbotClient.jsx';

export default function ChatbotEmbedModePage({ params }) {
  return <ChatbotClient embedded modeId={params.modeId} />;
}
