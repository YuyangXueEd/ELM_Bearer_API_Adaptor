import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

// Keep stdout exclusively for ACP. The IDE's working directory is the user's project.
const root = fileURLToPath(new URL('../../', import.meta.url));
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const { values: { proxy = false } } = parseArgs({ options: { proxy: { type: 'boolean' } } });
const envKey = proxy ? 'ELM_ADAPTOR_TOKEN' : 'ELM_API_KEY';
const credential = process.env[envKey];
if (!credential || credential.startsWith('replace-')) throw new Error(`Set ${envKey} in the repository's local .env file.`);
if (proxy && (credential.length < 24 || credential === process.env.ELM_API_KEY)) {
  throw new Error('ELM_ADAPTOR_TOKEN must be a separate random token of at least 24 characters.');
}
const port = Number(process.env.ELM_ADAPTOR_PORT ?? 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ELM_ADAPTOR_PORT must be 1024-65535.');
const model = process.env.ELM_MODEL ?? 'gpt-5.3-codex';
if (!/^[A-Za-z0-9_./:-]+$/.test(model)) throw new Error('Invalid ELM_MODEL identifier.');
try { import.meta.resolve('@agentclientprotocol/codex-acp'); }
catch { throw new Error('ACP adapter is missing. Run npm ci --prefix clients/pycharm from the repository root.'); }
process.env.CODEX_HOME = join(root, '.local', 'pycharm-codex');
mkdirSync(process.env.CODEX_HOME, { recursive: true });
process.env.MODEL_PROVIDER = 'elm';
process.env.INITIAL_AGENT_MODE = 'read-only';
// Discard unrelated adapter overrides inherited from another Codex installation.
delete process.env.CODEX_PATH;
// ACP checks account authentication before applying session-level provider overrides.
// Supply the same provider credential to that local check, without logging its value.
process.env.CODEX_API_KEY = process.env[envKey];
process.env.DEFAULT_AUTH_REQUEST = JSON.stringify({ methodId: 'api-key' });
process.env.CODEX_CONFIG = JSON.stringify({
  model,
  model_provider: 'elm',
  model_reasoning_effort: 'low',
  model_providers: { elm: {
    name: 'ELM',
    base_url: proxy ? `http://127.0.0.1:${port}/v1` : 'https://elm.edina.ac.uk/api/v1',
    env_key: envKey,
    wire_api: 'responses',
    requires_openai_auth: false,
    supports_websockets: false,
  } },
});
await import('@agentclientprotocol/codex-acp');
