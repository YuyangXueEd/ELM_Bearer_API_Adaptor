import http from 'node:http';
import https from 'node:https';
import { timingSafeEqual } from 'node:crypto';

export const ELM_BASE = 'https://elm.edina.ac.uk/api/v1';
const LIMIT = 10 * 1024 * 1024;

function json(res, status, message) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { message, type: 'adaptor_error', code: status } }));
}

function authorized(header, token) {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(header ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Loopback-only, authenticated relay. Preserves upstream bytes/status; never retries generation.
 * Requests are bounded before forwarding. Responses stream with backpressure and cancellation.
 * upstream is injectable for offline tests; the CLI always uses ELM_BASE.
 */
export function createRelay({ apiKey, token, upstream = ELM_BASE, timeoutMs = 300_000, maxBody = LIMIT, onRequest = () => {} }) {
  if (!apiKey || apiKey.startsWith('replace-')) throw new Error('Set ELM_API_KEY.');
  if (!token || token.startsWith('replace-') || token.length < 24) throw new Error('Set ELM_ADAPTOR_TOKEN to a random token of at least 24 characters.');
  if (apiKey === token) throw new Error('Use a separate local token, not the ELM key.');
  const base = new URL(upstream);
  return http.createServer(async (req, res) => {
    // No browser-origin requests or CORS: local agents send server-side HTTP requests.
    if (req.headers.origin) return json(res, 403, 'Browser-origin requests are not supported.');
    if (!authorized(req.headers.authorization, token)) return json(res, 401, 'Invalid local adaptor token.');
    const rawPath = req.url?.split('?')[0];
    const allowed = req.method === 'GET' ? /^\/v1\/models(?:\/[A-Za-z0-9_.-]+)?$/ :
      req.method === 'POST' ? /^\/v1\/(responses(?:\/compact)?|chat\/completions)$/ : null;
    if (!allowed?.test(rawPath)) return json(res, 404, 'Unsupported adaptor route.');
    if (req.method === 'POST' && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) {
      return json(res, 415, 'Use Content-Type: application/json.');
    }
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBody) {
          json(res, 413, 'Request exceeds the adaptor body limit.');
          return;
        }
        chunks.push(chunk);
      }
    } catch { if (!res.destroyed) json(res, 400, 'Incomplete request body.'); return; }
    if (res.destroyed) return;
    const body = Buffer.concat(chunks);
    if (req.method === 'POST') {
      try { JSON.parse(body.toString('utf8')); }
      catch { return json(res, 400, 'Invalid JSON request.'); }
    }
    // Explicit routes and a fixed origin prevent absolute-URL forwarding and credential redirects.
    const target = new URL(base.href.replace(/\/$/, '') + req.url.slice(3));
    const transport = target.protocol === 'https:' ? https : http;
    const headers = { authorization: `Bearer ${apiKey}`, accept: req.headers.accept ?? '*/*' };
    if (req.method === 'POST') Object.assign(headers, { 'content-type': 'application/json', 'content-length': body.length });
    const upstreamReq = transport.request(target, { method: req.method, headers }, upstreamRes => {
      const status = upstreamRes.statusCode ?? 502;
      onRequest({ method: req.method, path: rawPath, status });
      // Redirects are not followed or exposed, so clients cannot replay local credentials elsewhere.
      if (status >= 300 && status < 400) {
        upstreamRes.resume();
        return json(res, 502, 'ELM returned an unexpected redirect.');
      }
      const responseHeaders = {};
      for (const name of ['content-type', 'retry-after', 'x-request-id']) {
        if (upstreamRes.headers[name]) responseHeaders[name] = upstreamRes.headers[name];
      }
      res.writeHead(status, { ...responseHeaders, 'cache-control': 'no-store' });
      res.flushHeaders();
      upstreamRes.on('error', () => res.destroy());
      upstreamRes.on('aborted', () => res.destroy());
      upstreamRes.pipe(res);
    });
    upstreamReq.setTimeout(timeoutMs, () => upstreamReq.destroy(new Error('timeout')));
    upstreamReq.on('error', () => {
      if (res.destroyed) return;
      if (res.headersSent) res.destroy();
      else json(res, 502, 'ELM connection failed or timed out.');
    });
    res.on('close', () => upstreamReq.destroy());
    upstreamReq.end(body);
  });
}
