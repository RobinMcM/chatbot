import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000';
const FIXTURE_PATH = process.env.EVAL_FIXTURE_PATH || path.join(process.cwd(), 'evals', 'baseline.json');
const OUTPUT_PATH = process.env.EVAL_OUTPUT_PATH || path.join(process.cwd(), 'evals', 'latest-results.json');

async function run() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const results = [];

  for (const item of fixture) {
    const started = Date.now();
    let status = 'pass';
    let error = null;
    let content = '';
    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_mode: item.chat_mode,
          conversation_history: [],
          user_message: item.user_message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      content = String(data.content || '');
      if (Array.isArray(item.must_include_any) && item.must_include_any.length > 0) {
        const lower = content.toLowerCase();
        const match = item.must_include_any.some((term) => lower.includes(String(term).toLowerCase()));
        if (!match) {
          status = 'fail';
          error = `Output missing required terms (${item.must_include_any.join(', ')})`;
        }
      }
    } catch (err) {
      status = 'fail';
      error = err.message;
    }
    const elapsedMs = Date.now() - started;
    if (item.max_latency_ms && elapsedMs > item.max_latency_ms) {
      status = 'fail';
      error = `Exceeded max latency (${elapsedMs}ms > ${item.max_latency_ms}ms)`;
    }
    results.push({
      id: item.id,
      status,
      elapsedMs,
      error,
      preview: content.slice(0, 200),
      ranAt: new Date().toISOString(),
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  const failures = results.filter((r) => r.status !== 'pass').length;
  console.log(JSON.stringify({ total: results.length, failures, output: OUTPUT_PATH }, null, 2));
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
