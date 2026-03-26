import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: 'dist-widget',
    emptyOutDir: true,
    lib: {
      entry: 'src/widget.jsx',
      name: 'UsageflowsChatbotWidget',
      formats: ['iife'],
      fileName: () => 'usageflows-chatbot.js',
    },
  },
});
