#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { ELM_BASE, createRelay } from './relay.js';

const help = `ELM Bearer API Adaptor (Node.js 22+; no dependencies)

node --env-file=.env src/cli.js serve
node --env-file=.env src/cli.js doctor [--live] [--proxy]
node --env-file=.env src/cli.js config [--proxy] [--model MODEL] [--out FILE]

doctor lists models; --live adds a small paid streaming tool-call round trip.
config prints key-free Codex TOML, or creates FILE without overwriting it.
serve binds only 127.0.0.1; clients authenticate with ELM_ADAPTOR_TOKEN.
Use Node's --env-file option to load your existing .env (never committed).
`;

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean' }, proxy: { type: 'boolean' }, live: { type: 'boolean' },
    out: { type: 'string' }, model: { type: 'string' }
  } });
  const command = positionals[0];
  if (values.help || !command) { console.log(help); return; }
  if (positionals.length !== 1) throw new Error('Expected one command. Use --help.');
  const model = values.model ?? process.env.ELM_MODEL ?? 'gpt-5.3-codex';
  if (!/^[A-Za-z0-9_./:-]+$/.test(model)) throw new Error('Invalid model identifier.');
  const port = Number(process.env.ELM_ADAPTOR_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ELM_ADAPTOR_PORT must be 1024-65535.');
  const base = values.proxy ? `http://127.0.0.1:${port}/v1` : ELM_BASE;
  if (command === 'config') {
    const config = `# User-level CODEX_HOME/config.toml only: project configs ignore provider settings.
# Merge top-level keys before the first TOML table. Contains no secrets.
model = "${model}"
model_provider = "elm"
model_reasoning_effort = "low"

[model_providers.elm]
name = "ELM"
base_url = "${base}"
env_key = "${values.proxy ? 'ELM_ADAPTOR_TOKEN' : 'ELM_API_KEY'}"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
`;
    if (values.out) { await writeFile(values.out, config, { flag: 'wx' }); console.log('Created configuration file.'); }
    else process.stdout.write(config);
    return;
  }
  if (command === 'serve') {
    const server = createRelay({ apiKey: process.env.ELM_API_KEY, token: process.env.ELM_ADAPTOR_TOKEN,
      onRequest: event => console.log(JSON.stringify(event)) });
    server.on('error', error => { console.error(`Cannot listen: ${error.code ?? 'server error'}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`ELM relay: http://127.0.0.1:${port}/v1 (authenticated; keys and bodies are not logged)`));
    const shutdown = () => { server.close(); server.closeAllConnections(); };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
    return;
  }
  if (command !== 'doctor') throw new Error('Unknown command. Use --help.');
  const key = process.env[values.proxy ? 'ELM_ADAPTOR_TOKEN' : 'ELM_API_KEY'];
  if (!key || key.startsWith('replace-')) throw new Error(`Set ${values.proxy ? 'ELM_ADAPTOR_TOKEN' : 'ELM_API_KEY'}.`);
  async function request(path, body) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(90_000),
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`${path}: HTTP ${response.status}. Check the troubleshooting guide.`); }
    return response;
  }
  const models = await (await request('/models')).json();
  if (!Array.isArray(models.data) || models.data.some(item => typeof item?.id !== 'string')) throw new Error('Unexpected /models response; expected data containing model IDs.');
  const ids = models.data.map(item => item.id).sort();
  const available = ids.includes(model);
  console.log(JSON.stringify({ check: 'models', status: 'ok', count: ids.length, models: ids, model, available }));
  if (!available) throw new Error('Selected model is not listed for this ELM account. Use --model.');
  if (!values.live) return;
  // Parse complete SSE lines, regardless of network chunk boundaries. Never print raw model output.
  async function streamed(input, tools = []) {
    const response = await request('/responses', { model, input, tools, stream: true, store: false,
      max_output_tokens: 512, reasoning: { effort: 'low' },
      tool_choice: tools.length ? { type: 'function', name: 'echo_probe' } : 'auto' });
    if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Expected an SSE response.');
    const decoder = new TextDecoder();
    let pending = '', done;
    const types = new Set();
    for await (const chunk of response.body) {
      pending += decoder.decode(chunk, { stream: true });
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).trimEnd(); pending = pending.slice(end + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        const event = JSON.parse(data); types.add(event.type);
        if (event.type === 'response.failed' || event.type === 'error') throw new Error('Upstream reported a streaming error.');
        if (event.type === 'response.completed') done = event.response;
      }
    }
    if (done?.status !== 'completed') throw new Error('Stream ended without a completed response.');
    console.log(JSON.stringify({ check: 'responses-stream', status: 'ok', events: [...types] }));
    return done;
  }
  const input = [{ role: 'user', content: 'Call echo_probe with value OK. After the tool returns, reply only OK.' }];
  const first = await streamed(input, [{ type: 'function', name: 'echo_probe', description: 'Diagnostic echo; no external action.',
    parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false }, strict: true }]);
  const call = first.output.find(item => item.type === 'function_call' && item.name === 'echo_probe');
  if (!call || JSON.parse(call.arguments).value !== 'OK') throw new Error('Expected diagnostic tool call missing.');
  const second = await streamed([...input, ...first.output, { type: 'function_call_output', call_id: call.call_id, output: 'OK' }]);
  const text = second.output.filter(item => item.type === 'message').flatMap(item => item.content).filter(item => item.type === 'output_text').map(item => item.text).join('');
  if (!/^OK[.!]?$/i.test(text.trim())) throw new Error('Unexpected diagnostic final reply.');
  console.log(JSON.stringify({ check: 'tool-round-trip', status: 'ok', model }));
}

main().catch(error => {
  // Do not echo URLs/headers/body from dependency errors; CLI-owned messages contain no credentials.
  const message = error.code === 'EEXIST' ? 'Output exists; merge manually or choose a new file.' : error.message;
  let safe = message;
  for (const key of [process.env.ELM_API_KEY, process.env.ELM_ADAPTOR_TOKEN]) if (key) safe = safe.replaceAll(key, '[REDACTED]');
  console.error(safe); process.exitCode = 1;
});
