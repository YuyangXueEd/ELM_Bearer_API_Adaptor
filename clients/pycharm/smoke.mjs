// Optional live check: uses ELM quota, no IDE required, no file tools granted.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const cwd = fileURLToPath(new URL('../../.local/acp-smoke/', import.meta.url));
mkdirSync(cwd, { recursive: true });
const child = spawn(process.execPath, [fileURLToPath(new URL('launch.mjs', import.meta.url)), ...process.argv.slice(2)], {
  cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});
// Third-party logs may contain conversation data; do not print them.
child.stderr.resume();
let nextId = 0;
let output = '';
const pending = new Map();
const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); send({ id, method, params }); });
}
createInterface({ input: child.stdout }).on('line', line => {
  try {
    const message = JSON.parse(line);
    if (message.method && message.id !== undefined) {
      send({ id: message.id, error: { code: -32601, message: 'Client tools are unavailable in this smoke test' } });
    } else if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter?.reject(new Error(`ACP request failed (code ${message.error.code})`));
      else waiter?.resolve(message.result);
    } else if (message.method === 'session/update') {
      const update = message.params.update;
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') output += update.content.text;
    }
  } catch (error) { for (const waiter of pending.values()) waiter.reject(error); }
});
child.on('error', error => { for (const waiter of pending.values()) waiter.reject(error); });
child.on('exit', () => { for (const waiter of pending.values()) waiter.reject(new Error('ACP exited before replying')); });
const timeout = setTimeout(() => { console.error('ACP smoke test timed out'); child.kill(); process.exitCode = 1; }, 90000);
try {
  const init = await request('initialize', { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'elm-smoke', version: '1.0.0' } });
  assert.equal(init.protocolVersion, 1);
  console.log('ACP initialize: PASS');
  const session = await request('session/new', { cwd, mcpServers: [] });
  assert.ok(session.sessionId);
  console.log('ACP session/new: PASS');
  const result = await request('session/prompt', { sessionId: session.sessionId, prompt: [{ type: 'text', text: 'Do not use tools. Reply with exactly ELM_ACP_OK.' }] });
  assert.equal(result.stopReason, 'end_turn');
  // Codex can prepend a model-metadata warning as an ACP message chunk.
  assert.ok(output.trim().endsWith('ELM_ACP_OK'), 'The expected ELM response marker was missing');
  console.log('ACP streamed ELM response: PASS');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  child.stdin.end();
}
