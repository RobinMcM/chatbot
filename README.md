# UsageFlows Chatbot v2

Standalone chatbot app built with Next.js App Router and Tailwind, with API Route Handlers and `models.rapidmvp.io` as the gateway source of truth.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open: [http://localhost:3000/chatbot](http://localhost:3000/chatbot)

## Build and start

```bash
npm run build
npm run start
```

## Chat routes

- `/chatbot`
- `/chatbot/[modeId]`
- `/chatbot/embed`
- `/chatbot/embed/[modeId]`

## API routes

- `GET /api/health`
- `GET /api/chat-modes`
- `GET /api/rules/[chat_mode]`
- `POST /api/chat`

The chatbot is stateless in Next.js runtime: no server-side chat history/admin endpoints.

## Embed options

### Iframe

```html
<iframe
  src="https://your-chatbot-host/chatbot/embed?rule=insolvency&model=openai/gpt-5-pro&bg=%23f8fafc"
  title="Advisory assistant"
  width="380"
  height="560"
  style="border:0;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.12);"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

### Script/widget

```html
<script src="https://your-chatbot-host/chatbot-widget/usageflows-chatbot.js" defer></script>
<usageflows-chatbot
  rule="insolvency"
  api-base="https://your-chatbot-host"
  embedded="false"
  model="openai/gpt-5-pro"
  bg-color="#f8fafc"
  contact-url="https://clientsite.com/contact"
  contact-target-origin="https://clientsite.com"
  allowed-parent-origins="https://clientsite.com,https://www.clientsite.com"
></usageflows-chatbot>
```

You can also pass a single full embed URL:

```html
<usageflows-chatbot
  embed-src="https://your-chatbot-host/chatbot/embed?rule=insolvency&model=openai/gpt-5-pro&bg=%23f8fafc&contact_url=https%3A%2F%2Fclientsite.com%2Fcontact&contact_target_origin=https%3A%2F%2Fclientsite.com&allowed_parent_origins=https%3A%2F%2Fclientsite.com%2Chttps%3A%2F%2Fwww.clientsite.com"
  embedded="false"
></usageflows-chatbot>
```

Versioned alias:

- `/chatbot-widget/v1/usageflows-chatbot.js`

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_BASE_URL` | Gateway base URL | `https://models.rapidmvp.io` |
| `GATEWAY_API_KEY` | Internal key for gateway `X-Internal-API-Key` | required |
| `CHAT_MODEL` | Default model id sent in payload | `openai/gpt-5-pro` |
| `CHAT_MODEL_ALLOWLIST` | Optional comma-separated allowlist for URL-provided `?model=` values | empty |
| `GATEWAY_TIMEOUT_MS` | Timeout to gateway in ms | `120000` |
| `CHATBOT_CORS_ALLOWED_ORIGINS` | CORS allowlist for `/api/*` | `https://rapidmvp.io,https://www.rapidmvp.io,https://taxflow.uk` |
| `CHATBOT_FRAME_ANCESTORS` | CSP `frame-ancestors` allowlist for `/chatbot/*` | `'self' https://rapidmvp.io https://www.rapidmvp.io https://*.sharepoint.com` |

Model precedence:
1. URL query `?model=...` (or widget `model` attribute),
2. `CHAT_MODEL` fallback.

Background override:
- URL query `?bg=...` (or widget `bg-color` attribute), e.g. `?bg=%23f8fafc`.

Rule selection:
- URL query `?rule=...` (or widget `rule` attribute) loads `rules/<rule>.md`.
- If `rule` is missing/invalid, chatbot falls back to `rules/default.md`.

## Cross-origin contact handoff (no database)

- User clicks **Contact** in chatbot.
- Chatbot sends a secure `postMessage` payload to the parent page (`type: usageflows:contactPayload`).
- Widget script stores payload in `sessionStorage` and redirects to `contact-url`.
- Contact page reads payload from storage and pre-fills the submit form.

Suggested contact-page prefill snippet:

```html
<script>
  (function () {
    var key = 'usageflows_contact_payload';
    var raw = sessionStorage.getItem(key);
    if (!raw) return;
    try {
      var payload = JSON.parse(raw);
      if (!payload || payload.type !== 'usageflows:contactPayload') return;
      var transcriptText = (Array.isArray(payload.transcript) ? payload.transcript : [])
        .map(function (m) { return String(m.role || '') + ': ' + String(m.content || ''); })
        .join('\n\n');
      var summary = typeof payload.summary === 'string' ? payload.summary : '';
      var field = document.querySelector('#chatTranscript');
      if (field) field.value = (summary ? summary + '\n\n' : '') + transcriptText;

      var form = document.querySelector('form');
      if (form) {
        form.addEventListener('submit', function () {
          sessionStorage.removeItem(key);
        }, { once: true });
      }
    } catch (_) {}
  })();
</script>
```

Cross-origin verification checklist:

1. Load widget on client origin (for example `https://clientsite.com`) and send chat messages.
2. Click **Contact** and confirm browser navigates to `contact-url?chat_prefill=1`.
3. Confirm contact form field (for example `#chatTranscript`) is prefilled from session payload.
4. Submit form and confirm `sessionStorage.getItem('usageflows_contact_payload')` is cleared.
5. Negative test: set `allowed-parent-origins` to a different origin and confirm no redirect happens.
6. Negative test: set `contact-target-origin` that does not match `contact-url` and confirm no redirect happens.

## Testing and evals

```bash
npm test
node scripts/run-evals.js
```

- Eval fixtures: `evals/baseline.json`
- Eval output: `evals/latest-results.json`
- Rollout checklist: `docs/deployment-checklist.md`
