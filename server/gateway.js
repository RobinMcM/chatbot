import axios from 'axios';

const DEFAULT_TIMEOUT_MS = 120000; // 2 min

/** Summarise messages for logging: role, length, and first N chars of content. */
function summariseMessages(messages, previewLen = 120) {
  if (!Array.isArray(messages)) return '(not an array)';
  return messages.map((m, i) => {
    const role = m?.role ?? '?';
    const content = typeof m?.content === 'string' ? m.content : String(m?.content ?? '');
    const preview = content.length <= previewLen ? content : content.slice(0, previewLen) + '...';
    return { i, role, contentLength: content.length, preview };
  });
}

/** Detailed request log (no API key value). Optionally log full prompt. */
function logRequest(url, body, apiKey, timeout, logFullPrompt = true) {
  const messages = body?.payload?.messages;
  console.log('[gateway] ---- REQUEST ----');
  console.log('[gateway] URL:', url);
  console.log('[gateway] Method: POST');
  console.log('[gateway] Headers: Content-Type=application/json, X-Internal-API-Key=', apiKey ? `present (${String(apiKey).length} chars)` : 'MISSING');
  console.log('[gateway] Timeout:', timeout, 'ms');
  console.log('[gateway] Body: provider=%s job_type=%s dry_run=%s payload.model=%s',
    body?.provider, body?.job_type, body?.dry_run, body?.payload?.model);
  console.log('[gateway] Body.payload.messages: count=%d', messages?.length ?? 0);
  summariseMessages(messages || []).forEach(({ i, role, contentLength, preview }) => {
    console.log(`[gateway]   [%d] role=%s contentLength=%d preview=%s`, i, role, contentLength, JSON.stringify(preview));
  });
  if (logFullPrompt && Array.isArray(messages) && messages.length > 0) {
    console.log('[gateway] ---- FULL PROMPT SENT TO API ----');
    messages.forEach((m, i) => {
      console.log(`[gateway] --- Message ${i} role=${m?.role ?? '?'} ---`);
      console.log((m?.content != null ? String(m.content) : ''));
    });
    console.log('[gateway] ---- END FULL PROMPT ----');
  }
  console.log('[gateway] ---- END REQUEST ----');
}

/** Log full response when it's an error or non-200. */
function logResponseDetails(status, headers, data, elapsedMs) {
  console.log('[gateway] ---- RESPONSE ----');
  console.log('[gateway] Status:', status, 'Elapsed:', elapsedMs, 'ms');
  if (headers && typeof headers === 'object') {
    const h = {};
    for (const k of Object.keys(headers)) h[k] = headers[k];
    if (h['x-internal-api-key']) h['x-internal-api-key'] = '[REDACTED]';
    console.log('[gateway] Response headers:', JSON.stringify(h, null, 2));
  }
  console.log('[gateway] Response body:', JSON.stringify(data, null, 2));
  console.log('[gateway] ---- END RESPONSE ----');
}

/**
 * Call the usageflows gateway POST /api/execute (OpenRouter text-completion).
 */
export async function executeChat({ baseUrl, apiKey, model, messages, timeoutMs }) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/execute`;
  const body = {
    provider: 'openrouter',
    job_type: 'text-completion',
    payload: { model, messages },
    dry_run: false,
  };

  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  logRequest(url, body, apiKey, timeout);
  const start = Date.now();

  let response;
  try {
    response = await axios.post(url, body, {
      headers: {
        'X-Internal-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout,
      validateStatus: () => true,
    });
  } catch (axiosErr) {
    const elapsed = Date.now() - start;
    const code = axiosErr.code || axiosErr.errno || 'UNKNOWN';
    const msg = axiosErr.message || String(axiosErr);
    console.error('[gateway] ---- REQUEST FAILED (no HTTP response) ----');
    console.error('[gateway] Error code:', code);
    console.error('[gateway] Error message:', msg);
    console.error('[gateway] Elapsed before failure:', elapsed, 'ms');
    if (axiosErr.response !== undefined) {
      console.error('[gateway] Partial response present:', axiosErr.response?.status, axiosErr.response?.data);
    }
    console.error('[gateway] URL:', url);
    console.error('[gateway] ---- END FAILURE ----');
    const err = new Error(`Gateway connection failed: ${code} - ${msg}`);
    err.status = 502;
    err.code = code;
    throw err;
  }

  const elapsed = Date.now() - start;
  const data = response.data;
  const contentType = (response.headers && response.headers['content-type']) || '';
  const bodyStr = typeof data === 'string' ? data : (data && JSON.stringify(data));

  if (response.status !== 200) {
    console.error('[gateway] Non-200 response:');
    if (response.status === 504 && (contentType.includes('text/html') || (bodyStr && bodyStr.includes('504') && bodyStr.includes('<html')))) {
      console.error('[gateway] 504 from nginx (HTML). Nginx in front of the gateway timed out waiting for the upstream (OpenRouter). Elapsed:', elapsed, 'ms');
      console.error('[gateway] Fix: on the gateway server (usageflows.info), increase nginx proxy timeouts for /api/execute, e.g. proxy_read_timeout 120s;');
    } else {
      logResponseDetails(response.status, response.headers, data, elapsed);
    }
    const rawMsg = typeof data === 'object' && data?.message ? data.message : (typeof data === 'string' ? null : response.statusText) || 'Gateway error';
    let msg;
    if (response.status === 504 && (contentType.includes('text/html') || (bodyStr && bodyStr.includes('504') && bodyStr.includes('nginx')))) {
      msg = "The gateway server (nginx) timed out waiting for the AI. The gateway admin needs to increase nginx proxy_read_timeout for /api/execute (e.g. 120s).";
    } else if (response.status === 504) {
      msg = 'The AI gateway timed out. Try a shorter message or try again in a moment.';
    } else {
      msg = rawMsg;
    }
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  if (data.status === 'error') {
    console.error('[gateway] Gateway body.status=error:');
    logResponseDetails(response.status, response.headers, data, elapsed);
    const err = new Error(data.message || 'Gateway returned error');
    err.status = 502;
    throw err;
  }

  const result = data.result;
  const content =
    result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? '';
  const usage = data.usage ?? undefined;
  const modelFromResponse =
    typeof data.model === 'string' && data.model.trim() !== ''
      ? data.model.trim()
      : typeof result?.model === 'string' && result.model.trim() !== ''
        ? result.model.trim()
        : undefined;

  console.log('[gateway] Success: status=200 elapsed=%d ms contentLength=%d usage=%s model=%s',
    elapsed, String(content).length, usage ? JSON.stringify(usage) : 'none', modelFromResponse || 'none');
  return { content: String(content), usage, model: modelFromResponse };
}
