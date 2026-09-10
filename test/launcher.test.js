import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('ACP launcher rejects invalid setup before starting the adapter or making requests', () => {
  const env = { ...process.env, ELM_API_KEY: 'offline-test-key',
    ELM_ADAPTOR_TOKEN: 'offline-local-token-0123456789', ELM_MODEL: 'test-model', ELM_ADAPTOR_PORT: '8787' };
  for (const [args, overrides, expected] of [
    [['--proyx'], {}, /Unknown option/],
    [[], { ELM_API_KEY: 'replace-with-your-elm-key' }, /Set ELM_API_KEY/],
    [['--proxy'], { ELM_ADAPTOR_TOKEN: 'short' }, /separate random token/],
    [['--proxy'], { ELM_API_KEY: env.ELM_ADAPTOR_TOKEN }, /separate random token/],
    [[], { ELM_ADAPTOR_PORT: '80' }, /1024-65535/],
    [[], { ELM_MODEL: 'bad model' }, /Invalid ELM_MODEL/],
  ]) {
    const result = spawnSync(process.execPath, ['clients/pycharm/launch.mjs', ...args], {
      env: { ...env, ...overrides }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes(env.ELM_API_KEY));
    assert.ok(!result.stderr.includes(env.ELM_ADAPTOR_TOKEN));
  }
});
