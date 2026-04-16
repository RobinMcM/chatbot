# CLAUDE.md — chatbot

## Service Identity
MovieShaker virtual co-production assistant.
Context-aware chatbot embedded into MovieShakerV2 pages.
Producers get production support specific to the section they are working in.

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Gateway**: `https://models.rapidmvp.io` (openrouter-gateway)
- **Deployed at**: `https://chatbot.rapidmvp.io`

## Structure
```
app/                              ← Next.js App Router
  api/
    chat/route.js                 ← POST /api/chat — main chat endpoint
    chat-modes/route.js           ← GET /api/chat-modes — returns mode list
    health/route.js               ← GET /api/health — unauthenticated
  chatbot/
    page.js                       ← full app entry
    [modeId]/page.js              ← mode-specific full app
    embed/page.js                 ← embedded widget entry
    embed/[modeId]/page.js        ← mode-specific embedded widget
  globals.css                     ← global styles
  layout.js                       ← root layout
  page.js                         ← root redirect

components/chatbot/
  ChatbotClient.jsx               ← main widget shell, mode selection, panel UI
  Chat.jsx                        ← message input, send, conversation rendering
  utils/
    api.js                        ← URL builder
    cookies.js                    ← email persistence
    formatChatContent.js          ← markdown formatting

lib/server/
  modes.js                        ← MovieShaker chat modes config (SINGLE SOURCE OF TRUTH)
  prompt.js                       ← message array builder
  gateway-client.js               ← calls openrouter-gateway /api/execute
  env.js                          ← environment variable loading
  cors.js                         ← CORS headers for API routes
  http.js                         ← safe JSON parsing
  session.js                      ← session utilities
  persistence/                    ← database adapters (PostgreSQL, Azure)
    index.js
    db-pg.js
    db-azure.js

middleware.js                     ← CSP frame-ancestors header for /chatbot/* routes
public/chatbot-widget/            ← compiled widget JS for embedding
  usageflows-chatbot.js
  v1/usageflows-chatbot.js

docs/                             ← MovieShaker-specific design documents
  movieshaker-prompts.md
  movieshaker-response-schema.md
  movieshaker-chatbot-handoff.md
  movieshaker-agent-checklist.md
  deployment-checklist.md

evals/                            ← evaluation fixtures and results
tests/
  rules.test.js                   ← tests for modes.js (listModesForClient, findMode)
```

## Rules — Read Before Every Task

### Scope
- Only modify the file(s) explicitly named in the request
- Do not modify `lib/server/gateway-client.js` without explicit confirmation
- Do not modify `middleware.js` without explicit confirmation
- Do not modify `persistence/` files without explicit confirmation

### Adding a new chat mode
**Only one file changes**: `lib/server/modes.js`
Add an entry to the `MOVIESHAKER_MODES` array with:
- `id` — URL-safe lowercase string
- `displayName` — shown in UI header
- `promptInfo` — shown in info popover
- `systemPrompt` — prepended to every conversation in this mode

Never add mode logic anywhere else.

### Git
- Do NOT run any git commands
- Developer handles all git operations via VS Code git panel

### Running the service
- Do NOT run `npm run dev`, `npm run build`, or any npm scripts
- Do NOT run any commands automatically

### Dependencies
- Do NOT modify `package.json` without explicit confirmation
- Do NOT install packages automatically

## Gateway Contract
The chatbot calls `openrouter-gateway` directly via `lib/server/gateway-client.js`:

```
POST https://models.rapidmvp.io/api/execute
Headers: X-Internal-API-Key, X-Request-Id
Body: { provider: "openrouter", job_type: "text-completion",
        payload: { model, messages }, dry_run: false }
```

Response extraction:
```
data.result.choices[0].message.content → reply text
data.usage                             → cost/token info
data.model                             → model used
```

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GATEWAY_API_KEY` | ✅ | Gateway auth key (alias: `GATEWAY_INTERNAL_API_KEY`) |
| `GATEWAY_BASE_URL` | | Default: `https://models.rapidmvp.io` |
| `CHAT_MODEL` | | Default model: `openai/gpt-5-mini` |
| `CHAT_MODEL_ALLOWLIST` | | Comma-separated allowed model ids |
| `GATEWAY_TIMEOUT_MS` | | Default: `120000` |
| `CHATBOT_CORS_ALLOWED_ORIGINS` | | Default: rapidmvp.io origins |
| `CHATBOT_FRAME_ANCESTORS` | | CSP frame-ancestors for embed security |

## Chat API Contract
```
POST /api/chat
Body: {
  chat_mode: string,           // mode id from /api/chat-modes
  conversation_history: [],    // full prior messages
  user_message: string,        // current message
  page_context?: string,       // optional context from MovieShaker page
  model?: string               // optional model override
}
Response: { content, model, chat_mode, usage? }
```

## Security
- `GATEWAY_API_KEY` must never be logged or exposed
- `/api/chat-modes` does NOT return `systemPrompt` to the client
- CSP `frame-ancestors` controlled via `middleware.js` and `CHATBOT_FRAME_ANCESTORS`
- CORS controlled via `CHATBOT_CORS_ALLOWED_ORIGINS`

## Testing
```bash
node --test tests/rules.test.js
```
Tests cover: `listModesForClient`, `findMode`, `MOVIESHAKER_MODES` integrity.

## If Uncertain
Ask before proceeding. Do not infer intent and act.
One task at a time. Wait for confirmation before the next step.
