import ChatbotClient from '../../../components/chatbot/ChatbotClient.jsx';

export default function ChatbotModePage({ params }) {
  return <ChatbotClient embedded={false} modeId={params.modeId} />;
}
