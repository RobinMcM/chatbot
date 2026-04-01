# MovieShaker Chatbot Handoff Contract

This document is the integration contract for the MovieShaker agent.

The chatbot is hosted separately and embedded into MovieShaker pages via `usageflows-chatbot`.

## 1) URL contract

Use `embed-src` as the canonical configuration source.

Required/expected query params:

- `rule`: rule id used when `rules_source=folder`
- `rules_source`: `folder` or `hidden`
- `model`: model id (must be allowed by `CHAT_MODEL_ALLOWLIST` if configured)
- `bg`: accent color (URL-encoded if hex, for example `%23250411`)

Example:

`https://chatbot.rapidmvp.io/chatbot/embed?rule=insolvency&rules_source=hidden&model=openai/gpt-5-mini&bg=%23250411`

## 2) Widget attribute contract

The MovieShaker page can configure rules and output field mapping with attributes:

- `hidden-rules-field-id`: id of hidden field that stores active prompt text
- `hidden-rules-selector`: CSS selector alternative to `hidden-rules-field-id`
- `result-field-id`: id of text field to receive latest assistant result
- `result-field-selector`: CSS selector alternative to `result-field-id`
- `allowed-parent-origins`: comma-separated origin allowlist for contact handoff
- `contact-url`: optional contact page URL
- `contact-target-origin`: optional strict target origin for contact handoff

Example:

```html
<script src="https://chatbot.rapidmvp.io/chatbot-widget/usageflows-chatbot.js" defer></script>
<usageflows-chatbot
  embed-src="https://chatbot.rapidmvp.io/chatbot/embed?rule=insolvency&rules_source=hidden&model=openai/gpt-5-mini&bg=%23250411"
  hidden-rules-field-id="chatbot-hidden-rules"
  result-field-id="chatbot-result"
  allowed-parent-origins="https://movieshaker.com,https://www.movieshaker.com"
  embedded="false"
></usageflows-chatbot>
```

## 3) postMessage protocol

### A) Parent -> iframe rules request response

1. Chat iframe posts request:
   - `type: "usageflows:requestHiddenRules"`
   - `source: "usageflows-chatbot"`
   - `requestId: string`

2. Widget bridge reads hidden rules field and replies to iframe:
   - `type: "usageflows:hiddenRulesPayload"`
   - `source: "usageflows-chatbot-widget"`
   - `requestId: string`
   - `rulesText: string` (max 20000 chars)

### B) Iframe -> parent latest result signal

After each assistant reply, iframe posts:

- `type: "usageflows:chatResult"`
- `source: "usageflows-chatbot"`
- `version: 1`
- `modeId: string`
- `message: string`
- `timestamp: number`

Widget bridge writes `message` into `result-field-id` or `result-field-selector`.

### C) Iframe -> parent contact payload (existing)

On Contact button:

- `type: "usageflows:contactPayload"`
- `source: "usageflows-chatbot"`
- `summary`, `transcript`, `leadContext`

Widget stores payload in `sessionStorage` and optionally redirects to `contact-url` if configured.

## 4) API request contract (`POST /api/chat`)

When `rules_source=hidden`, chat client sends:

- `rules_source: "hidden"`
- `hidden_rules_text: string` (optional; max 20000 chars)

When `rules_source=folder`, chat client sends:

- `rules_source: "folder"`
- `chat_mode` resolved from URL `rule` or fallback default

Server behavior:

- `rules_source=folder`: load from `rules/<id>.md` with default fallback.
- `rules_source=hidden`: use `hidden_rules_text` when present; otherwise fall back to default file-based rules template.

## 5) Security and safety rules

- Do not use broad DOM scraping. Use explicit selectors or ids only.
- Enforce origin checks for contact handoff (`allowed-parent-origins`, `contact-target-origin`).
- Keep hidden rules text length-bounded.
- Validate `rules_source` to `folder|hidden` only.
- Keep fallback to server default rules to avoid hard failures.
