import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import styles from './index.css?inline';

class UsageflowsChatbotElement extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    const modeId = this.getAttribute('mode-id')?.trim() || 'insolvency';
    const apiBase = this.getAttribute('api-base')?.trim() || '';
    const embedded = this.getAttribute('embedded') !== 'false';

    const rootNode = this.attachShadow({ mode: 'open' });
    const styleTag = document.createElement('style');
    styleTag.textContent = styles;
    rootNode.appendChild(styleTag);

    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    rootNode.appendChild(mount);

    this._root = ReactDOM.createRoot(mount);
    this._root.render(
      <React.StrictMode>
        <MemoryRouter initialEntries={[`/${modeId}`]}>
          <Routes>
            <Route path="/:modeId" element={<App embedded={embedded} apiBase={apiBase} />} />
          </Routes>
        </MemoryRouter>
      </React.StrictMode>
    );
  }

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
    this._mounted = false;
  }
}

if (!customElements.get('usageflows-chatbot')) {
  customElements.define('usageflows-chatbot', UsageflowsChatbotElement);
}
