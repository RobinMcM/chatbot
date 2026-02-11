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

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_BASE_URL` | Gateway base URL | `https://usageflows.info` |
| `GATEWAY_API_KEY` | API key sent as `X-Internal-API-Key` | (required) |
| `CHAT_MODEL` | OpenRouter model id for chat | `openai/gpt-5-pro` |
| `GATEWAY_TIMEOUT_MS` | Timeout for gateway request (ms) | `120000` (2 min) |
| `PORT` | Server port | `3000` |

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
