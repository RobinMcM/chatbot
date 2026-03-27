# UsageFlows Chatbot v1

Self-contained chat app: React + Vite frontend and Node.js (Express) backend. The backend proxies chat requests to the usageflows.info gateway (OpenRouter / GPT-5 Pro) and loads read-only rules templates from `rules/`.

## Install

From the project root (e.g. `root/chatbot`):

```bash
npm install
```

All dependencies (Express, Vite, React) are in the root `package.json`.

## Run (development)

Start both the Express API and the Vite dev server:

```bash
npm run dev
```

- **Backend:** http://localhost:3000 (API: `/api/chat-modes`, `/api/chat`, `/api/rules/:chat_mode`)
- **Frontend:** Vite runs on its own port (e.g. 5173); use the Vite URL for hot reload. Configure Vite proxy in `web/vite.config.js` so `/api` is forwarded to the Express server.

Alternatively, run in two terminals:

- Terminal 1: `npm run dev:server` (Express on PORT)
- Terminal 2: `npm run dev:web` (Vite dev server)

## Build and run (production)

```bash
npm run build
npm run start
```

The Express server serves the built frontend from `web/dist` and the API. Open http://localhost:3000 (or your `PORT`).
The reusable web-component bundle is served from `web/dist-widget` at `/chatbot-widget/usageflows-chatbot.js`.

## Route behavior (single-page chatbot)

- `/chatbot` opens the chatbot directly and redirects to the first available mode.
- `/chatbot/:modeId` opens a specific mode directly.
- `/chatbot/embed` opens embed mode and redirects to the first available mode.
- `/chatbot/embed/:modeId` opens a specific mode in embed layout.
- `/chatbot/view` remains available for chat history/admin review.

## Embed via iframe (SharePoint + any website)

This quick-win integration mode uses the hosted chatbot page directly in an iframe.

- Recommended iframe URL: `https://your-chatbot-host/chatbot/embed/insolvency` (replace `insolvency` with your mode id)
- Keep chatbot API same-origin to the chatbot host (the iframe page calls its own `/api/...` routes).

### SharePoint Online (Embed Web Part)

In SharePoint, use the Embed Web Part and set the source URL to your hosted chatbot embed route:

`https://your-chatbot-host/chatbot/embed/insolvency`

### Generic HTML embed

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

## Render as web component (non-iframe)

For websites where script embedding is allowed, use the chatbot web component:

```html
<script src="https://your-chatbot-host/chatbot-widget/usageflows-chatbot.js" defer></script>
<usageflows-chatbot
  mode-id="insolvency"
  api-base="https://your-chatbot-host"
  embedded="true"
></usageflows-chatbot>
```

Attributes:

- `mode-id`: chat mode id from `rules/` filename (`insolvency`, `auditing`, etc.)
- `api-base`: chatbot API origin (defaults to relative host if omitted)
- `embedded`: `true` for direct panel render, `false` for floating launcher behavior

### SharePoint note

SharePoint Online typically requires a custom SPFx web part for script-based widgets. In SPFx, load `usageflows-chatbot.js` and mount `<usageflows-chatbot ...>` in the web part render output.

## Framing and security headers

Your chatbot host (reverse proxy/CDN/app server) must allow being framed by approved origins.

- Do not send `X-Frame-Options: DENY`.
- Prefer CSP `frame-ancestors` with an allowlist of trusted hosts.
- The Express app now sets `Content-Security-Policy: frame-ancestors ...` on `/chatbot` routes using `CHATBOT_FRAME_ANCESTORS`.

Example CSP directive:

```text
Content-Security-Policy: frame-ancestors 'self' https://rapidmvp.io https://*.sharepoint.com;
```

If you still use `X-Frame-Options`, use `SAMEORIGIN` only when iframe parent is same origin. For cross-origin embedding (SharePoint/rapidmvp), rely on CSP `frame-ancestors` allowlist.
If your reverse proxy also sets CSP/X-Frame-Options, make sure it does not override or block the allowlist from app settings.

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_BASE_URL` | Gateway base URL | `https://usageflows.info` |
| `GATEWAY_API_KEY` | API key sent as `X-Internal-API-Key` | (required) |
| `CHAT_MODEL` | OpenRouter model id for chat | `openai/gpt-5-pro` |
| `GATEWAY_TIMEOUT_MS` | Timeout for gateway request (ms) | `120000` (2 min) |
| `PORT` | Server port | `3000` |
| `CHATBOT_CORS_ALLOWED_ORIGINS` | Comma-separated allowed browser origins for `/api/*` CORS | `https://rapidmvp.io,https://www.rapidmvp.io,https://taxflow.uk` |
| `CHATBOT_FRAME_ANCESTORS` | Comma-separated iframe parent allowlist for `/chatbot` routes | `'self',https://rapidmvp.io,https://www.rapidmvp.io,https://*.sharepoint.com` |

Copy `.env.example` to `.env` and set `GATEWAY_API_KEY` (and others if needed).

## Adding a new chat mode

1. Add a new file under `rules/` with extension `.md` or `.txt`, e.g. `rules/my-mode.md`.
2. The chat mode id is the filename without extension (e.g. `my-mode`).
3. No code changes needed; `GET /api/chat-modes` scans `rules/` and returns the list. The dropdown will include the new mode after restart or on next request.

V1 does not support editing or uploading rules; templates are read-only files.

## Troubleshooting

**Port already in use (EADDRINUSE)**  
Another process is using the server port. Stop it or use a different port:

```bash
# Free port 3000 (Linux/macOS)
kill $(lsof -t -i:3000) 2>/dev/null

# Or run on another port
PORT=3001 npm run dev
```

**ENOSPC: System limit for number of file watchers reached**  
Vite needs to watch many files; the system inotify limit is too low. Increase it (Linux):

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Then try `npm run dev` again.

**504 Gateway Timeout**  
- If the log shows **504 from nginx (HTML)** and the response body is an HTML page from nginx: the **gateway server** (e.g. usageflows.info) is timing out. Nginx is closing the connection before the upstream (OpenRouter) responds. The gateway admin must increase nginx proxy timeouts for the `/api/execute` location (e.g. `proxy_read_timeout 120s;`).
- If the gateway returns JSON with a timeout message, increasing `GATEWAY_TIMEOUT_MS` in the chatbot `.env` may help.
