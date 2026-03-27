# Chatbot Eval Baseline

This folder contains a lightweight regression harness for conversational quality checks.

## Run

1. Start the Next.js app locally.
2. Run:

```bash
node scripts/run-evals.js
```

Optional environment variables:

- `EVAL_BASE_URL` (default `http://localhost:3000`)
- `EVAL_FIXTURE_PATH` (default `evals/baseline.json`)
- `EVAL_OUTPUT_PATH` (default `evals/latest-results.json`)

## What it validates

- Endpoint availability (`POST /api/chat`)
- Basic relevance markers (`must_include_any`)
- Max response latency per case

This is the first-layer regression gate and should be extended with stricter grading and human-reviewed golden sets.
