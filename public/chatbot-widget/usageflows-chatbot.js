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

  function createResizeHandle() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Drag to resize';
    btn.setAttribute('aria-label', 'Resize chat panel');
    btn.style.position = 'absolute';
    btn.style.top = '-10px';
    btn.style.left = '-10px';
    btn.style.width = '28px';
    btn.style.height = '28px';
    btn.style.border = '1px solid #cbd5e1';
    btn.style.borderRadius = '999px';
    btn.style.background = '#fff';
    btn.style.color = '#475569';
    btn.style.cursor = 'nwse-resize';
    btn.style.boxShadow = '0 4px 14px rgba(15,23,42,0.18)';
    btn.style.zIndex = '3';
    btn.style.padding = '0';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 9 3 3 9 3"></polyline><line x1="3" y1="3" x2="10" y2="10"></line><line x1="7" y1="3" x2="10" y2="6"></line><line x1="3" y1="7" x2="6" y2="10"></line></svg>';
    return btn;
  }

  class UsageflowsChatbotElement extends HTMLElement {
    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
      var modeId = (this.getAttribute('mode-id') || 'insolvency').trim();
      var apiBase = normalizeBase(this.getAttribute('api-base') || '');
      var embedded = this.getAttribute('embedded') !== 'false';
      var embedSrc = (this.getAttribute('embed-src') || '').trim();
      var model = (this.getAttribute('model') || '').trim();
      var bgColor = (this.getAttribute('bg-color') || '').trim();
      var tenantId = (this.getAttribute('tenant-id') || '').trim();
      var appId = (this.getAttribute('app-id') || '').trim();

      var params = new URLSearchParams();
      if (tenantId) params.set('tenant_id', tenantId);
      if (appId) params.set('app_id', appId);
      if (model) params.set('model', model);
      if (bgColor) params.set('bg', bgColor);
      var qs = params.toString() ? ('?' + params.toString()) : '';
      var src = embedSrc || (apiBase + '/chatbot/embed/' + encodeURIComponent(modeId) + qs);

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
      panel.style.position = 'relative';
      panel.style.background = 'transparent';
      panel.style.overflow = 'visible';

      var iframe = createIframe(src);
      iframe.style.borderRadius = '16px';
      iframe.style.boxShadow = '0 12px 36px rgba(0,0,0,0.2)';
      panel.appendChild(iframe);

      var resizeBtn = createResizeHandle();
      panel.appendChild(resizeBtn);

      var dragState = null;
      resizeBtn.addEventListener('mousedown', function (event) {
        event.preventDefault();
        dragState = {
          startX: event.clientX,
          startY: event.clientY,
          startW: panel.getBoundingClientRect().width,
          startH: panel.getBoundingClientRect().height
        };
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
      });
      window.addEventListener('mousemove', function (event) {
        if (!dragState) return;
        var dx = dragState.startX - event.clientX;
        var dy = dragState.startY - event.clientY;
        var nextW = Math.max(320, Math.min(860, dragState.startW + dx));
        var nextH = Math.max(360, Math.min(window.innerHeight - 32, dragState.startH + dy));
        panel.style.width = String(Math.round(nextW)) + 'px';
        panel.style.height = String(Math.round(nextH)) + 'px';
      });
      window.addEventListener('mouseup', function () {
        if (!dragState) return;
        dragState = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });

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
