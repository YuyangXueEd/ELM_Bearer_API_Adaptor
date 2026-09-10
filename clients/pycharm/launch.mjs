import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Keep stdout exclusively for ACP. The IDE's working directory is the user's project.
const root = fileURLToPath(new URL('../../', import.meta.url));
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const proxy = process.argv.includes('--proxy');
const envKey = proxy ? 'ELM_ADAPTOR_TOKEN' : 'ELM_API_KEY';
if (!process.env[envKey]) throw new Error(`Set ${envKey} in the repository's local .env file.`);
const port = Number(process.env.ELM_ADAPTOR_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ELM_ADAPTOR_PORT');
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
  model: process.env.ELM_MODEL || 'gpt-5.3-codex',
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
