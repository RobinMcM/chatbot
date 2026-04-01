# MovieShaker Chat Response Schema

This schema defines the structured output contract the MovieShaker page should parse from chatbot responses.

Use this as the canonical parser contract for "Apply suggestions".

## 1) Response shape

```json
{
  "chat_text": "Short human-readable guidance for the producer.",
  "field_suggestions": {
    "fieldKey1": "Suggested value",
    "fieldKey2": "Suggested value"
  },
  "confidence": "high",
  "notes": [
    "Optional assumption or caveat."
  ]
}
```

## 2) Field rules

- `chat_text`
  - Type: string
  - Required: yes
  - Max length: 3000
- `field_suggestions`
  - Type: object
  - Required: yes
  - Key/value pairs where:
    - key must be an allowed field for active section
    - value must be string
    - value max length: 2000
- `confidence`
  - Type: enum string
  - Optional
  - Allowed: `high`, `medium`, `low`
- `notes`
  - Type: string array
  - Optional
  - Max items: 5
  - Each item max length: 280

## 3) Allowed keys per section

- `positioning`: `writer`, `format`, `genre`, `whyNow`, `comps`, `targetAudience`
- `funding`: `budgetMvp`, `budgetTarget`, `budgetStretch`, `sourceGrants`, `sourcePrivate`, `sourceCrowd`, `sourceInKind`
- `marketing`: `logline`, `synopsis`, `visualTone`, `contentPlan`, `channels`, `pressOutlets`
- `festivals`: `tier1`, `tier2`, `tier3`, `distribution`

## 4) Parser validation requirements

MovieShaker parser should:

1. Parse JSON safely (reject malformed content).
2. Reject unknown top-level keys not in schema.
3. Reject unknown `field_suggestions` keys for current section.
4. Trim all string values.
5. Enforce max lengths.
6. Ignore empty suggestion values after trimming.
7. Never auto-apply without explicit user action (for example "Apply suggestions").

## 5) Fallback behavior

If structured parsing fails:

- display `chat_text` fallback from raw assistant content if available,
- do not mutate form fields,
- show non-blocking warning: "Suggestions could not be parsed. Please refine or retry."

## 6) Backward compatibility with current `usageflows:chatResult`

Current widget bridge publishes:

```json
{
  "type": "usageflows:chatResult",
  "message": "<assistant text>"
}
```

For immediate compatibility, MovieShaker can:

- write raw `message` into result textbox,
- attempt JSON extraction/parsing only when content appears to be structured.

Long-term preferred path:

- enforce structured JSON output for assistant responses in section workflows.
