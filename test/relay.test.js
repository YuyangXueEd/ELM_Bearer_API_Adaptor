import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRelay } from '../src/relay.js';

const token = 'local-test-token-0123456789abcdef';
async function listen(server, t) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function fixture(t, handler, options = {}) {
  const upstream = await listen(http.createServer(handler), t);
  const base = await listen(createRelay({ apiKey: 'upstream-test-key', token, upstream: upstream + '/api/v1', ...options }), t);
  return (path, init = {}) => fetch(base + path, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers } });
}

test('forwards exact JSON and replaces auth; does not forward private client headers', async t => {
  let captured;
  const request = await fixture(t, async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    captured = { url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
    res.setHeader('content-type', 'application/json'); res.end('{"ok":true}');
  });
  const body = JSON.stringify({ model: 'test', input: [{ type: 'function_call_output', call_id: 'call_1', output: 'hello' }], store: false });
  const response = await request('/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'private', 'x-other': 'private' }, body });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(captured.url, '/api/v1/responses'); assert.equal(captured.body, body);
  assert.equal(captured.headers.authorization, 'Bearer upstream-test-key');
  assert.equal(captured.headers.cookie, undefined); assert.equal(captured.headers['x-other'], undefined);
});

test('streams first event before upstream finishes and preserves tool events byte-for-byte', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
  const first = 'event: response.created\ndata: {"type":"response.created"}\n\n';
  const last = 'event: response.completed\ndata: {"type":"response.completed","response":{"output":[{"type":"function_call","arguments":"{}"}]}}\n\n';
  const request = await fixture(t, async (req, res) => {
    res.setHeader('content-type', 'text/event-stream'); res.write(first); await gate; res.end(last);
  });
  const response = await request('/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const reader = response.body.getReader();
  const chunk = await reader.read(); assert.equal(Buffer.from(chunk.value).toString(), first);
  release(); let rest = ''; while (true) { const value = await reader.read(); if (value.done) break; rest += Buffer.from(value.value).toString(); }
  assert.equal(rest, last);
});

test('rejects missing auth, browser requests, invalid routes and invalid JSON before upstream', async t => {
  let hits = 0;
  const request = await fixture(t, (req, res) => { hits++; res.end('{}'); });
  assert.equal((await request('/v1/models', { headers: { authorization: '' } })).status, 401);
  assert.equal((await request('/v1/models', { headers: { origin: 'https://example.com' } })).status, 403);
  assert.equal((await request('/v1/files')).status, 404);
  assert.equal((await request('/v1/responses', { method: 'DELETE' })).status, 404);
  assert.equal((await request('/v1/responses', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await request('/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })).status, 400);
  assert.equal(hits, 0);
});

test('preserves quota status and Retry-After; compact failures remain failures', async t => {
  const request = await fixture(t, (req, res) => {
    if (req.url.endsWith('/compact')) { res.writeHead(404); res.end('{"error":"unsupported"}'); }
    else { res.writeHead(429, { 'retry-after': '15', 'content-type': 'application/json' }); res.end('{"error":"quota_exceeded"}'); }
  });
  const response = await request('/v1/models'); assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '15'); assert.equal(await response.text(), '{"error":"quota_exceeded"}');
  assert.equal((await request('/v1/responses/compact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404);
});

test('supports Chat Completions without rewriting tools or response format', async t => {
  const responseBody = JSON.stringify({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'call_chat', type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] } }] });
  let path;
  const request = await fixture(t, (req, res) => { path = req.url; res.setHeader('content-type', 'application/json'); res.end(responseBody); });
  const response = await request('/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"model":"test","messages":[]}' });
  assert.equal(path, '/api/v1/chat/completions'); assert.equal(await response.text(), responseBody);
});

test('does not forward redirects or leak an upstream connection error', async t => {
  const request = await fixture(t, (req, res) => { res.writeHead(302, { location: 'https://example.com' }); res.end(); });
  const response = await request('/v1/models'); assert.equal(response.status, 502); assert.equal(response.headers.get('location'), null);
  const timeoutRequest = await fixture(t, () => {}, { timeoutMs: 30 });
  const timeoutResponse = await timeoutRequest('/v1/models'); assert.equal(timeoutResponse.status, 502);
  assert.ok(!(await timeoutResponse.text()).includes('upstream-test-key'));
});

test('cancels upstream when a client disconnects', async t => {
  let disconnected;
  const closed = new Promise(resolve => { disconnected = resolve; });
  const request = await fixture(t, (req, res) => {
    res.setHeader('content-type', 'text/event-stream'); res.write('data: {}\n\n');
    res.on('close', disconnected);
  });
  const abort = new AbortController();
  const response = await request('/v1/models', { signal: abort.signal });
  await response.body.getReader().read(); abort.abort();
  await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Upstream not cancelled')), 2000); timer.unref(); })]);
});

test('rejects oversized bodies without contacting upstream', async t => {
  let hits = 0;
  const request = await fixture(t, (req, res) => { hits++; res.end(); }, { maxBody: 16 });
  const response = await request('/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: 'x'.repeat(100) }) });
  assert.equal(response.status, 413); assert.equal(hits, 0);
});

test('configuration contains no credentials and refuses to overwrite an existing file', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'elm-config-')); const output = join(folder, 'config.toml');
  try {
    const args = ['src/cli.js', 'config', '--proxy', '--out', output];
    const options = { env: { ...process.env, ELM_API_KEY: 'private-test-key', ELM_ADAPTOR_TOKEN: token }, encoding: 'utf8' };
    assert.equal(spawnSync(process.execPath, args, options).status, 0);
    const config = await readFile(output, 'utf8'); assert.ok(config.includes('ELM_ADAPTOR_TOKEN'));
    assert.ok(!config.includes('private-test-key')); assert.ok(!config.includes(token));
    assert.equal(spawnSync(process.execPath, args, options).status, 1);
    assert.equal(await readFile(output, 'utf8'), config);
  } finally { await rm(folder, { recursive: true }); }
});
