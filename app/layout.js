import './globals.css';

export const metadata = {
  title: 'UsageFlows Chatbot',
  description: 'Standalone chatbot with Next.js route handlers.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
