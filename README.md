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
- `/chatbot/view`

## API routes

- `GET /api/health`
- `GET /api/chat-modes`
- `GET /api/rules/[chat_mode]`
- `POST /api/chat`
- `POST /api/sessions/email`
- `GET /api/chat-history`
- `GET /api/chat-history/admin`
- `GET /api/chat-history/messages`
- `DELETE /api/chat-history/conversation`
- `DELETE /api/chat-history/admin/conversation`

## Embed options

### Iframe

```html
<iframe
  src="https://your-chatbot-host/chatbot/embed/insolvency"
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
  mode-id="insolvency"
  api-base="https://your-chatbot-host"
  embedded="true"
  tenant-id="rapidmvp"
  app-id="movieshaker"
></usageflows-chatbot>
```

Versioned alias:

- `/chatbot-widget/v1/usageflows-chatbot.js`

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_BASE_URL` | Gateway base URL | `https://models.rapidmvp.io` |
| `GATEWAY_API_KEY` | Internal key for gateway `X-Internal-API-Key` | required |
| `CHAT_MODEL` | Model id sent in payload | `openai/gpt-5-pro` |
| `GATEWAY_TIMEOUT_MS` | Timeout to gateway in ms | `120000` |
| `CHATBOT_CORS_ALLOWED_ORIGINS` | CORS allowlist for `/api/*` | `https://rapidmvp.io,https://www.rapidmvp.io,https://taxflow.uk` |
| `CHATBOT_FRAME_ANCESTORS` | CSP `frame-ancestors` allowlist for `/chatbot/*` | `'self' https://rapidmvp.io https://www.rapidmvp.io https://*.sharepoint.com` |
| `CONNECTION_TYPE` | `AZURE` or `POSTGRES` | `AZURE` |

See `.env.example` for persistence-related values.

## Testing and evals

```bash
npm test
node scripts/run-evals.js
```

- Eval fixtures: `evals/baseline.json`
- Eval output: `evals/latest-results.json`
- Rollout checklist: `docs/deployment-checklist.md`
