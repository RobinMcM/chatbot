(function () {
  function normalizeBase(base) {
    var trimmed = (base || '').trim();
    if (!trimmed) return window.location.origin;
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  function parseOrigin(value) {
    var trimmed = (value || '').trim();
    if (!trimmed) return '';
    try {
      return new URL(trimmed).origin;
    } catch (_) {
      return '';
    }
  }

  function splitOrigins(value) {
    var trimmed = String(value || '').trim();
    if (!trimmed) return [];
    return trimmed.split(',').map(function (entry) { return parseOrigin(entry); }).filter(Boolean);
  }

  function resolveAccentColor(bgAttr, src) {
    var explicit = (bgAttr || '').trim();
    if (explicit) return explicit;
    try {
      var parsed = new URL(src, window.location.origin);
      var fromQuery = (parsed.searchParams.get('bg') || '').trim();
      return fromQuery || '#2563eb';
    } catch (_) {
      return '#2563eb';
    }
  }

  function sanitizeSize(value, min, max) {
    var num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(min, Math.min(max, Math.round(num)));
  }

  function createIframe(src) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = 'UsageFlows Chatbot';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.borderRadius = '16px';
    iframe.style.setProperty('width', '100%', 'important');
    iframe.style.setProperty('height', '100%', 'important');
    iframe.style.setProperty('display', 'block', 'important');
    return iframe;
  }

  function createResizeHandle(accentColor) {
    var backgroundColor = (accentColor || '').trim() || '#2563eb';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Drag to resize';
    btn.setAttribute('aria-label', 'Resize chat panel');
    btn.style.position = 'absolute';
    btn.style.top = '-18px';
    btn.style.left = '-18px';
    btn.style.width = '36px';
    btn.style.height = '36px';
    btn.style.border = '1px solid rgba(255,255,255,0.35)';
    btn.style.borderRadius = '999px';
    btn.style.background = backgroundColor;
    btn.style.color = '#fff';
    btn.style.cursor = 'nwse-resize';
    btn.style.boxShadow = '0 4px 14px rgba(15,23,42,0.18)';
    btn.style.zIndex = '3';
    btn.style.padding = '0';
    btn.style.touchAction = 'none';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 9 3 3 9 3"></polyline><line x1="3" y1="3" x2="10" y2="10"></line><line x1="7" y1="3" x2="10" y2="6"></line><line x1="3" y1="7" x2="6" y2="10"></line></svg>';
    return btn;
  }

  class UsageflowsChatbotElement extends HTMLElement {
    disconnectedCallback() {
      if (this._onMessage) {
        window.removeEventListener('message', this._onMessage);
        this._onMessage = null;
      }
      this._mounted = false;
    }

    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
      var modeId = (this.getAttribute('mode-id') || '').trim();
      var ruleId = (this.getAttribute('rule') || '').trim();
      var apiBase = normalizeBase(this.getAttribute('api-base') || '');
      var embedded = this.getAttribute('embedded') !== 'false';
      var embedSrc = (this.getAttribute('embed-src') || '').trim();
      var model = (this.getAttribute('model') || '').trim();
      var bgColor = (this.getAttribute('bg-color') || '').trim();
      var contactUrl = (this.getAttribute('contact-url') || '').trim();
      var contactTargetOrigin = parseOrigin(this.getAttribute('contact-target-origin') || '');
      var allowedParentOriginsRaw = (this.getAttribute('allowed-parent-origins') || '').trim();
      var storageKey = (this.getAttribute('contact-storage-key') || 'usageflows_contact_payload').trim();
      var tenantId = (this.getAttribute('tenant-id') || '').trim();
      var appId = (this.getAttribute('app-id') || '').trim();
      var hiddenRulesSelector = (this.getAttribute('hidden-rules-selector') || '').trim();
      var hiddenRulesFieldId = (this.getAttribute('hidden-rules-field-id') || '').trim();
      var resultFieldSelector = (this.getAttribute('result-field-selector') || '').trim();
      var resultFieldId = (this.getAttribute('result-field-id') || '').trim();

      var params = new URLSearchParams();
      var resolvedRule = ruleId || modeId || 'default';
      if (tenantId) params.set('tenant_id', tenantId);
      if (appId) params.set('app_id', appId);
      if (resolvedRule) params.set('rule', resolvedRule);
      if (model) params.set('model', model);
      if (bgColor) params.set('bg', bgColor);
      if (contactUrl) params.set('contact_url', contactUrl);
      if (contactTargetOrigin) params.set('contact_target_origin', contactTargetOrigin);
      if (allowedParentOriginsRaw) params.set('allowed_parent_origins', allowedParentOriginsRaw);
      var qs = params.toString() ? ('?' + params.toString()) : '';
      var src = embedSrc || (apiBase + '/chatbot/embed' + qs);
      var sizeStorageKey = 'usageflows-widget-size:' + src;
      var iframeOrigin = parseOrigin(src);
      var accentColor = resolveAccentColor(bgColor, src);
      var allowedParentOrigins = splitOrigins(allowedParentOriginsRaw);
      var self = this;

      function mountBridgeForIframe(iframeEl) {
        function readHiddenRulesText() {
          var target = null;
          if (hiddenRulesSelector) {
            try {
              target = document.querySelector(hiddenRulesSelector);
            } catch (_) {
              target = null;
            }
          } else if (hiddenRulesFieldId) {
            target = document.getElementById(hiddenRulesFieldId);
          }
          if (!target) return '';
          var value = typeof target.value === 'string' ? target.value : (target.textContent || '');
          return String(value || '').slice(0, 20000);
        }

        function writeResultText(value) {
          var target = null;
          if (resultFieldSelector) {
            try {
              target = document.querySelector(resultFieldSelector);
            } catch (_) {
              target = null;
            }
          } else if (resultFieldId) {
            target = document.getElementById(resultFieldId);
          }
          if (!target) return;
          var text = typeof value === 'string' ? value : '';
          if ('value' in target) {
            target.value = text;
          } else {
            target.textContent = text;
          }
        }

        self._onMessage = function (event) {
          if (!iframeEl || !iframeEl.contentWindow) return;
          if (event.source !== iframeEl.contentWindow) return;
          if (iframeOrigin && event.origin !== iframeOrigin) return;

          var data = event.data || {};
          if (!data || data.source !== 'usageflows-chatbot') return;

          if (data.type === 'usageflows:requestHiddenRules') {
            var rulesResponse = {
              type: 'usageflows:hiddenRulesPayload',
              source: 'usageflows-chatbot-widget',
              requestId: typeof data.requestId === 'string' ? data.requestId : '',
              rulesText: readHiddenRulesText()
            };
            try {
              iframeEl.contentWindow.postMessage(rulesResponse, event.origin || '*');
            } catch (_) {}
            return;
          }

          if (data.type === 'usageflows:chatResult') {
            writeResultText(typeof data.message === 'string' ? data.message : '');
            return;
          }

          if (data.type !== 'usageflows:contactPayload') return;

          var payload = {
            type: 'usageflows:contactPayload',
            version: Number(data.version) || 1,
            source: 'usageflows-chatbot',
            modeId: typeof data.modeId === 'string' ? data.modeId : '',
            timestamp: Number(data.timestamp) || Date.now(),
            summary: typeof data.summary === 'string' ? data.summary : '',
            transcript: Array.isArray(data.transcript) ? data.transcript : [],
            leadContext: data.leadContext && typeof data.leadContext === 'object' ? data.leadContext : {},
            chatbotOrigin: event.origin,
          };

          try {
            sessionStorage.setItem(storageKey, JSON.stringify(payload));
          } catch (_) {}

          var nextUrl = contactUrl || (payload.leadContext && typeof payload.leadContext.contactUrl === 'string' ? payload.leadContext.contactUrl : '');
          if (!nextUrl) return;
          try {
            var parsed = new URL(nextUrl, window.location.origin);
            if (contactTargetOrigin && parsed.origin !== contactTargetOrigin) return;
            if (allowedParentOrigins.length > 0 && allowedParentOrigins.indexOf(window.location.origin) === -1) return;
            parsed.searchParams.set('chat_prefill', '1');
            window.location.assign(parsed.toString());
          } catch (_) {}
        };
        window.addEventListener('message', self._onMessage);
      }

      if (embedded) {
        this.style.display = 'block';
        this.style.width = this.style.width || '380px';
        this.style.height = this.style.height || '560px';
        var embeddedIframe = createIframe(src);
        this.appendChild(embeddedIframe);
        mountBridgeForIframe(embeddedIframe);
        return;
      }

      var wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '20px';
      wrapper.style.right = '20px';
      wrapper.style.zIndex = '2147483000';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'flex-end';

      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Open chatbot');
      button.style.width = '56px';
      button.style.height = '56px';
      button.style.border = 'none';
      button.style.borderRadius = '999px';
      button.style.background = '#2563eb';
      button.style.color = '#fff';
      button.style.cursor = 'pointer';
      button.style.boxShadow = '0 8px 24px rgba(37,99,235,0.35)';
      button.style.display = 'inline-flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

      var panel = document.createElement('div');
      panel.style.display = 'none';
      panel.style.width = '380px';
      panel.style.height = '560px';
      panel.style.marginBottom = '12px';
      panel.style.position = 'relative';
      panel.style.background = 'transparent';
      panel.style.overflow = 'visible';
      panel.style.alignSelf = 'flex-end';
      try {
        var savedRaw = sessionStorage.getItem(sizeStorageKey);
        if (savedRaw) {
          var saved = JSON.parse(savedRaw);
          var restoredW = sanitizeSize(saved && saved.width, 320, Math.max(320, Math.min(860, window.innerWidth - 32)));
          var restoredH = sanitizeSize(saved && saved.height, 360, Math.max(360, Math.min(900, window.innerHeight - 32)));
          if (restoredW) panel.style.width = String(restoredW) + 'px';
          if (restoredH) panel.style.height = String(restoredH) + 'px';
        }
      } catch (_) {}

      var iframe = createIframe(src);
      iframe.style.borderRadius = '16px';
      iframe.style.boxShadow = '0 12px 36px rgba(0,0,0,0.2)';
      panel.appendChild(iframe);
      mountBridgeForIframe(iframe);

      var resizeBtn = createResizeHandle(accentColor);
      panel.appendChild(resizeBtn);

      var dragState = null;
      var getMaxWidth = function () {
        return Math.max(320, Math.min(860, window.innerWidth - 32));
      };
      var getMaxHeight = function () {
        return Math.max(360, Math.min(900, window.innerHeight - 32));
      };
      var stopDrag = function () {
        if (!dragState) return;
        if (dragState.pointerId != null && typeof resizeBtn.releasePointerCapture === 'function') {
          try { resizeBtn.releasePointerCapture(dragState.pointerId); } catch (_) {}
        }
        try {
          var finalRect = panel.getBoundingClientRect();
          sessionStorage.setItem(sizeStorageKey, JSON.stringify({
            width: Math.round(finalRect.width),
            height: Math.round(finalRect.height)
          }));
        } catch (_) {}
        dragState = null;
        iframe.style.pointerEvents = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      resizeBtn.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        dragState = {
          pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
          startX: event.clientX,
          startY: event.clientY,
          startW: panel.getBoundingClientRect().width,
          startH: panel.getBoundingClientRect().height
        };
        if (dragState.pointerId != null && typeof resizeBtn.setPointerCapture === 'function') {
          try { resizeBtn.setPointerCapture(dragState.pointerId); } catch (_) {}
        }
        iframe.style.pointerEvents = 'none';
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
      });
      document.addEventListener('pointermove', function (event) {
        if (!dragState) return;
        if (dragState.pointerId != null && typeof event.pointerId === 'number' && event.pointerId !== dragState.pointerId) return;
        event.preventDefault();
        var dx = dragState.startX - event.clientX;
        var dy = dragState.startY - event.clientY;
        var nextW = Math.max(320, Math.min(getMaxWidth(), dragState.startW + dx));
        var nextH = Math.max(360, Math.min(getMaxHeight(), dragState.startH + dy));
        panel.style.width = String(Math.round(nextW)) + 'px';
        panel.style.height = String(Math.round(nextH)) + 'px';
        try {
          sessionStorage.setItem(sizeStorageKey, JSON.stringify({
            width: Math.round(nextW),
            height: Math.round(nextH)
          }));
        } catch (_) {}
      });
      document.addEventListener('pointerup', stopDrag);
      document.addEventListener('pointercancel', stopDrag);
      window.addEventListener('blur', stopDrag);

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
