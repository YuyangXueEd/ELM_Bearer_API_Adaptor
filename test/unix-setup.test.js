import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { request } from 'node:http';
import { childEnvironment, saveConfig, launchProcess, createSetupServer, isWindowsCodeBridge } from '../clients/unix/start-elm.mjs';

test('WSL does not treat a Windows-mounted code command as native Linux VS Code', () => {
  assert.equal(isWindowsCodeBridge('/mnt/c/Users/test/Microsoft VS Code/bin/code', { WSL_DISTRO_NAME: 'Ubuntu' }), true);
  assert.equal(isWindowsCodeBridge('/usr/share/code/bin/code', { WSL_DISTRO_NAME: 'Ubuntu' }), false);
  assert.equal(isWindowsCodeBridge('/mnt/c/code', {}), false);
});

test('Unix setup preserves Codex settings and passes secrets only through the isolated child environment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'elm setup '));
  try {
    const home = await saveConfig(root, 'gpt-5.5');
    const file = join(home, 'config.toml');
    const original = await readFile(file, 'utf8');
    await writeFile(file, original + '\n[sandbox_workspace_write]\nnetwork_access = false\n');
    await saveConfig(root, 'gpt-5.2');
    const changed = await readFile(file, 'utf8');
    assert.match(changed, /model = "gpt-5.2"/);
    assert.match(changed, /network_access = false/);
    const env = childEnvironment('test-secret', home, { PATH: 'keep', VSCODE_IPC_HOOK_CLI: 'remove', CODEX_HOME: 'wrong', ELM_OLD: 'remove', ELECTRON_RUN_AS_NODE: '1' });
    assert.deepEqual(env, { PATH: 'keep', CODEX_HOME: home, ELM_API_KEY: 'test-secret' });
    let captured;
    await launchProcess('/Applications/VS Code', '/project with spaces', root, 'test-secret', (...args) => {
      captured = args;
      const child = new EventEmitter(); child.unref = () => {};
      queueMicrotask(() => child.emit('spawn')); return child;
    });
    assert.deepEqual(captured[1], ['--user-data-dir', join(root, 'vscode'), '--new-window', '/project with spaces']);
    assert.equal(captured[2].env.ELM_API_KEY, 'test-secret');
    assert.equal(captured[2].shell, false);
    assert.ok(!JSON.stringify(captured[1]).includes('test-secret'));
    assert.ok(!changed.includes('test-secret'));
    await writeFile(file, changed.replace('model_provider = "elm"', 'model_provider = "other"'));
    await assert.rejects(saveConfig(root, 'gpt-5.5'), /customized/);
    await assert.rejects(saveConfig(root, 'bad"model'), /valid model/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Local browser setup authenticates requests and loads the complete model list', async () => {
  let launched;
  const { server, url } = await createSetupServer({ models: async key => { assert.equal(key, 'test-key'); return ['gpt-5.5', 'embedding-model']; }, start: async input => { launched = input; } });
  const origin = new URL(url).origin;
  const headers = { 'Content-Type': 'application/json', 'X-ELM-Setup-Token': new URL(url).hash.slice(1), Origin: origin };
  try {
    const page = await fetch(origin);
    assert.match(await page.text(), /script src="\/setup.js"/);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await fetch(origin + '/api/status')).status, 403);
    assert.equal((await fetch(origin + '/api/models', { method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: '{}' })).status, 403);
    const badHostStatus = await new Promise((resolve, reject) => {
      const req = request(origin + '/api/models', { method: 'POST', headers: { ...headers, Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end('{}');
    });
    assert.equal(badHostStatus, 403);
    const result = await fetch(origin + '/api/models', { method: 'POST', headers, body: JSON.stringify({ key: 'test-key' }) });
    assert.deepEqual(await result.json(), { models: ['gpt-5.5', 'embedding-model'] });
    const input = { key: 'test-key', model: 'gpt-5.5', project: '/tmp/project' };
    assert.equal((await fetch(origin + '/api/launch', { method: 'POST', headers, body: JSON.stringify(input) })).status, 200);
    assert.deepEqual(launched, input);
    assert.equal((await fetch(origin + '/api/models', { method: 'POST', headers, body: 'invalid' })).status, 400);
    assert.equal((await fetch(origin + '/api/models', { method: 'POST', headers, body: JSON.stringify({ key: 'x'.repeat(40_000) }) })).status, 400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
