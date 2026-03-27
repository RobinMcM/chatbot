# Deployment Checklist (RapidMVP + Movieshaker + Customer Export)

## DNS / Domains

- `taxflow.uk` (or equivalent chatbot host) points to Next.js app deployment.
- `models.rapidmvp.io` gateway is reachable and healthy (`GET /health`).

## Environment

- `GATEWAY_BASE_URL=https://models.rapidmvp.io`
- `GATEWAY_API_KEY=<internal key>`
- `CHATBOT_CORS_ALLOWED_ORIGINS` includes all caller origins:
  - `https://rapidmvp.io`
  - `https://movieshaker.com`
  - customer domains as needed
- `CHATBOT_FRAME_ANCESTORS` includes approved iframe parents.
- Persistence variables configured for Azure SQL or Postgres.

## Security Headers

- `/chatbot/*` responses include CSP `frame-ancestors` allowlist.
- `/api/*` responses include CORS headers for allowed origins.
- No secrets are emitted in logs.

## Functional Smoke Tests

- `GET /api/health`
- `GET /api/chat-modes`
- `POST /api/chat` (non-empty answer)
- `GET /chatbot/embed/insolvency` loads in iframe
- widget script loads from `/chatbot-widget/usageflows-chatbot.js`

## Cross-Origin Checks

- `curl -i https://<chatbot-host>/api/chat-modes -H "Origin: https://rapidmvp.io"`
- `curl -i -X OPTIONS https://<chatbot-host>/api/chat -H "Origin: https://rapidmvp.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-session-id"`

## Go-Live Guard

- Run `node scripts/run-evals.js` and verify zero failures.
- Keep rollback deployment target available for one release cycle.
