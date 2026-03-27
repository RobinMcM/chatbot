(function () {
  function normalizeBase(base) {
    var trimmed = (base || '').trim();
    if (!trimmed) return window.location.origin;
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  function createIframe(src) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = 'UsageFlows Chatbot';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.borderRadius = '16px';
    return iframe;
  }

  class UsageflowsChatbotElement extends HTMLElement {
    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
      var modeId = (this.getAttribute('mode-id') || 'insolvency').trim();
      var apiBase = normalizeBase(this.getAttribute('api-base') || '');
      var embedded = this.getAttribute('embedded') !== 'false';
      var tenantId = (this.getAttribute('tenant-id') || '').trim();
      var appId = (this.getAttribute('app-id') || '').trim();

      var params = new URLSearchParams();
      if (tenantId) params.set('tenant_id', tenantId);
      if (appId) params.set('app_id', appId);
      var qs = params.toString() ? ('?' + params.toString()) : '';
      var src = apiBase + '/chatbot/embed/' + encodeURIComponent(modeId) + qs;

      if (embedded) {
        this.style.display = 'block';
        this.style.width = this.style.width || '380px';
        this.style.height = this.style.height || '560px';
        this.appendChild(createIframe(src));
        return;
      }

      var wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '20px';
      wrapper.style.right = '20px';
      wrapper.style.zIndex = '2147483000';

      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Chat';
      button.style.width = '56px';
      button.style.height = '56px';
      button.style.border = 'none';
      button.style.borderRadius = '999px';
      button.style.background = '#2563eb';
      button.style.color = '#fff';
      button.style.cursor = 'pointer';
      button.style.boxShadow = '0 8px 24px rgba(37,99,235,0.35)';

      var panel = document.createElement('div');
      panel.style.display = 'none';
      panel.style.width = '380px';
      panel.style.height = '560px';
      panel.style.marginBottom = '12px';
      panel.style.background = '#fff';
      panel.style.borderRadius = '16px';
      panel.style.overflow = 'hidden';
      panel.style.boxShadow = '0 12px 36px rgba(0,0,0,0.2)';
      panel.appendChild(createIframe(src));

      button.addEventListener('click', function () {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      });

      wrapper.appendChild(panel);
      wrapper.appendChild(button);
      this.appendChild(wrapper);
    }
  }

  if (!customElements.get('usageflows-chatbot')) {
    customElements.define('usageflows-chatbot', UsageflowsChatbotElement);
  }
})();
