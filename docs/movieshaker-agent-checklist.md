# MovieShaker Agent Implementation Checklist

Use this checklist in the MovieShaker workspace to implement Film Festival chatbot integration.

## A) Page integration

- [ ] Add a hidden rules field on Film Festival page (id or selector).
- [ ] Add a visible result field to receive latest assistant response.
- [ ] Inject chatbot widget script and `<usageflows-chatbot>` element on page/layout.
- [ ] Set `embed-src` with:
  - `rule=<defaultRuleId>`
  - `rules_source=hidden`
  - `model=<approvedModel>`
  - `bg=<accentColor>`
- [ ] Set widget attributes:
  - `hidden-rules-field-id` (or selector)
  - `result-field-id` (or selector)

## B) Section-aware hidden rules

- [ ] Detect active section tab (`positioning`, `funding`, `marketing`, `festivals`).
- [ ] Build hidden rules text from section template + project context.
- [ ] Update hidden rules field whenever active section changes.
- [ ] Keep rules text bounded (max 20000 chars).

## C) Suggestion parsing and field apply

- [ ] Parse assistant content using schema in `movieshaker-response-schema.md`.
- [ ] Validate allowed keys per current section.
- [ ] Trim and length-limit values.
- [ ] Add user action to apply suggestions (for example "Apply suggestions").
- [ ] Never auto-overwrite fields without explicit user action.

## D) Runtime verification

- [ ] Confirm chat send with `rules_source=hidden`.
- [ ] Confirm iframe requests hidden rules via `usageflows:requestHiddenRules`.
- [ ] Confirm parent responds with `usageflows:hiddenRulesPayload`.
- [ ] Confirm latest assistant text populates result field via `usageflows:chatResult`.
- [ ] Confirm per-assistant `Copy` button copies only that result.

## E) Negative tests

- [ ] Missing hidden rules field -> chat still works via fallback rules.
- [ ] Invalid `rules_source` -> API returns clear 400.
- [ ] Oversized hidden rules -> API rejects with length error.
- [ ] Unknown suggestion keys -> parser rejects and does not mutate fields.
- [ ] Broken JSON assistant output -> no field mutation, show parse warning.

## F) Security checks

- [ ] Limit selectors to explicit known ids/selectors (no broad scraping).
- [ ] Validate allowed parent origins for contact handoff flows.
- [ ] Keep output mapping constrained to known field ids only.

## G) Release checklist

- [ ] Document final `embed-src` URL and approved model.
- [ ] Capture one successful run per section with before/after field values.
- [ ] Add rollback path (disable widget quickly or switch to `rules_source=folder`).
