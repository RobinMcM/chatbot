# MovieShaker Chatbot

Virtual co-production assistant for MovieShaker.
Context-aware chatbot embedded into MovieShakerV2 pages.
Built with Next.js App Router, powered by `models.rapidmvp.io`.

## Install

```bash
npm install
```

## Run locally

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

| Route | Description |
|-------|-------------|
| `/chatbot` | Full app, default mode |
| `/chatbot/[modeId]` | Full app, specific mode |
| `/chatbot/embed` | Embedded widget, default mode |
| `/chatbot/embed/[modeId]` | Embedded widget, specific mode |

## API routes

| Route | Description |
|-------|-------------|
| `GET /api/health` | Unauthenticated health check |
| `GET /api/chat-modes` | Returns available MovieShaker chat modes |
| `POST /api/chat` | Send a message, get a response |

## Chat modes

Modes are defined in `lib/server/modes.js`. Each mode maps to a section
of the MovieShaker platform and provides a tailored system prompt.

Current modes: `general`, `scripts`, `budget`, `scheduling`, `festivals`, `moodboard`

To add a new mode — edit `lib/server/modes.js` only. No other files need changing.

## Embed options

### Iframe

```html
<iframe
  src="https://chatbot.rapidmvp.io/chatbot/embed/festivals"
  title="MovieShaker Assistant"
  width="380"
  height="560"
  style="border:0;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.12);"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

### Script/widget

```html
<script src="https://chatbot.rapidmvp.io/chatbot-widget/usageflows-chatbot.js" defer></script>
<usageflows-chatbot
  mode-id="festivals"
  api-base="https://chatbot.rapidmvp.io"
  embedded="false"
></usageflows-chatbot>
```

## Page context

Pass the current MovieShaker page context to get mode-aware responses:

```js
// POST /api/chat
{
  "chat_mode": "festivals",
  "conversation_history": [],
  "user_message": "Which festivals should I target?",
  "page_context": "Project: The Last Frame. Genre: Documentary. Budget: £50k."
}
```

## Environment variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GATEWAY_API_KEY` | ✅ | Internal key for gateway auth | — |
| `GATEWAY_BASE_URL` | | Gateway base URL | `https://models.rapidmvp.io` |
| `CHAT_MODEL` | | Default model id | `openai/gpt-5-mini` |
| `CHAT_MODEL_ALLOWLIST` | | Comma-separated allowed model ids | empty (all allowed) |
| `GATEWAY_TIMEOUT_MS` | | Gateway request timeout ms | `120000` |
| `CHATBOT_CORS_ALLOWED_ORIGINS` | | CORS allowlist for `/api/*` | rapidmvp.io origins |
| `CHATBOT_FRAME_ANCESTORS` | | CSP `frame-ancestors` for embed security | rapidmvp.io + SharePoint |

Note: `GATEWAY_INTERNAL_API_KEY` is also accepted as an alias for `GATEWAY_API_KEY`.

## Gateway

The chatbot calls `openrouter-gateway` at `models.rapidmvp.io` directly.
It does not call MovieShakerV2 engine for chat — it is a standalone consumer of the gateway.

## Cross-origin contact handoff

The **Contact** button in the chat sends a `postMessage` payload to the parent page.
The parent page can use this to pre-fill a contact form with the conversation transcript.

Payload type: `usageflows:contactPayload`

## Security

- System prompts are never exposed to the client via `/api/chat-modes`
- CSP `frame-ancestors` is enforced via `middleware.js`
- `GATEWAY_API_KEY` is server-side only — never sent to the browser

## Testing

```bash
node --test tests/rules.test.js
```

## Evals

```bash
node scripts/run-evals.js
```

Fixtures: `evals/baseline.json`
Checklist: `docs/deployment-checklist.md`
