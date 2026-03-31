import { CHAT_MODEL, GATEWAY_API_KEY, GATEWAY_BASE_URL, GATEWAY_TIMEOUT_MS } from './env.js';

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return data;
  const copy = JSON.parse(JSON.stringify(data));
  if (copy.payload?.messages) {
    copy.payload.messages = copy.payload.messages.map((msg) => ({
      role: msg?.role ?? '?',
      contentLength: typeof msg?.content === 'string' ? msg.content.length : 0,
    }));
  }
  return copy;
}

export async function executeGatewayChat({ messages, requestId, model: requestedModel = null }) {
  const baseUrl = GATEWAY_BASE_URL;
  const apiKey = GATEWAY_API_KEY;
  const model = typeof requestedModel === 'string' && requestedModel.trim()
    ? requestedModel.trim().slice(0, 128)
    : CHAT_MODEL;
  const timeoutMs = GATEWAY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS;
  if (!apiKey) {
    const err = new Error('GATEWAY_API_KEY is required');
    err.status = 500;
    throw err;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/execute`;
  const payload = {
    provider: 'openrouter',
    job_type: 'text-completion',
    payload: { model, messages },
    dry_run: false,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const { signal, clear } = createTimeoutSignal(timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-API-Key': apiKey,
          'X-Request-Id': requestId,
        },
        body: JSON.stringify(payload),
        signal,
      });
      const elapsedMs = Date.now() - started;
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status === 'error') {
        const message = data.message || response.statusText || 'Gateway error';
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          await sleep(150 * (attempt + 1));
          continue;
        }
        const err = new Error(message);
        err.status = response.status || 502;
        throw err;
      }

      const result = data.result || {};
      const content = result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? '';
      const usage = data.usage ?? undefined;
      const modelFromResponse = typeof data.model === 'string' && data.model.trim()
        ? data.model.trim()
        : typeof result.model === 'string' && result.model.trim()
          ? result.model.trim()
          : model;

      return { content: String(content), usage, model: modelFromResponse };
    } catch (err) {
      clear();
      const aborted = err?.name === 'AbortError';
      if ((aborted || err?.status >= 500) && attempt < MAX_RETRIES) {
        await sleep(150 * (attempt + 1));
        continue;
      }
      const status = err?.status || (aborted ? 504 : 502);
      const wrapped = new Error(aborted ? 'Gateway timeout. Try again.' : (err?.message || 'Gateway request failed'));
      wrapped.status = status;
      throw wrapped;
    } finally {
      clear();
    }
  }

  const finalError = new Error('Gateway request failed');
  finalError.status = 502;
  throw finalError;
}
