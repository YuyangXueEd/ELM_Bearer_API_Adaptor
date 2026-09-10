#!/usr/bin/env node
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { ELM_BASE } from '../../src/relay.js';

const run = promisify(execFile);
const modelPattern = /^[A-Za-z0-9_./:-]+$/;
const page = fileURLToPath(new URL('./setup.html', import.meta.url));

export function stateDirectory(platform = process.platform, home = homedir(), env = process.env) {
  return platform === 'darwin' ? join(home, 'Library', 'Application Support', 'ELM-Coding')
    : join(env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : join(home, '.config'), 'elm-coding');
}

export function childEnvironment(key, home, env = process.env) {
  const clean = Object.fromEntries(Object.entries(env).filter(([name]) => !/^(CODEX_|VSCODE_|ELM_|ELECTRON_RUN_AS_NODE$)/i.test(name)));
  return { ...clean, CODEX_HOME: home, ELM_API_KEY: key };
}

export function isWindowsCodeBridge(executable, env = process.env) {
  return Boolean(env.WSL_DISTRO_NAME) && /^\/mnt\/[a-z]\//i.test(executable);
}

export async function findCode(platform = process.platform) {
  const candidates = platform === 'darwin'
    ? ['/Applications/Visual Studio Code.app/Contents/MacOS/Electron', join(homedir(), 'Applications/Visual Studio Code.app/Contents/MacOS/Electron')]
    : [...(process.env.PATH ?? '').split(delimiter).filter(Boolean).map(p => join(p, 'code')), '/usr/bin/code', '/snap/bin/code'];
  let windowsBridge = false;
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      if (isWindowsCodeBridge(await realpath(candidate))) { windowsBridge = true; continue; }
      return candidate;
    } catch { /* Try the next standard installation. */ }
  }
  if (windowsBridge) throw new Error('WSL detected Windows VS Code. This Linux launcher requires native Linux VS Code; the Windows/Remote-WSL bridge is not supported yet. Use Start ELM.cmd from Windows for the verified Windows workflow.');
  throw new Error('Install Visual Studio Code first. On macOS, place it in Applications. On Linux, make the code command available in PATH.');
}

export async function loadModels(key) {
  if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw new Error('Enter a valid ELM API key.');
  let response;
  try {
    response = await fetch(`${ELM_BASE}/models`, { headers: { authorization: `Bearer ${key.trim()}` }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  } catch { throw new Error('Cannot reach ELM. Check your connection and try again.'); }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`ELM returned HTTP ${response.status}. Check your key and account access.`); }
  const body = await response.json().catch(() => { throw new Error('ELM returned an unexpected model list.'); });
  if (!Array.isArray(body.data) || body.data.some(m => typeof m?.id !== 'string' || !modelPattern.test(m.id))) throw new Error('ELM returned an unexpected model list.');
  return [...new Set(body.data.map(m => m.id))].sort();
}

export async function saveConfig(root, model) {
  if (typeof model !== 'string' || !modelPattern.test(model)) throw new Error('Choose a valid model.');
  const home = join(root, 'codex');
  await mkdir(home, { recursive: true, mode: 0o700 });
  const filename = join(home, 'config.toml');
  let config;
  try { config = await readFile(filename, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (config !== undefined) {
    const top = config.split(/^\s*\[/m)[0];
    const provider = config.split(/^\[model_providers\.elm\]\s*\r?\n/m)[1]?.split(/^\s*\[/m)[0];
    if (!/^model_provider = "elm"\r?$/m.test(top) || !/^model = "[A-Za-z0-9_./:-]+"\r?$/m.test(top)
        || !provider || !provider.split(/\r?\n/).includes(`base_url = "${ELM_BASE}"`) || !/^env_key = "ELM_API_KEY"\r?$/m.test(provider)
        || !/^wire_api = "responses"\r?$/m.test(provider) || !/^requires_openai_auth = false\r?$/m.test(provider)
        || !/^supports_websockets = false\r?$/m.test(provider)) {
      throw new Error('The isolated ELM configuration was customized. Back it up and remove its config.toml before running setup again.');
    }
    config = config.replace(/^model = "[A-Za-z0-9_./:-]+"\r?$/m, `model = "${model}"`);
  } else {
    const { stdout } = await run(process.execPath, [fileURLToPath(new URL('../../src/cli.js', import.meta.url)), 'config', '--model', model], { env: childEnvironment('', home) });
    config = stdout;
  }
  const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, config, { mode: 0o600, flag: 'wx' });
  await rename(temporary, filename);
  const user = join(root, 'vscode', 'User');
  await mkdir(user, { recursive: true, mode: 0o700 });
  await writeFile(join(user, 'settings.json'), JSON.stringify({ 'chatgpt.openOnStartup': true, 'workbench.startupEditor': 'none' }, null, 2), { flag: 'wx', mode: 0o600 })
    .catch(e => { if (e.code !== 'EEXIST') throw e; });
  return home;
}

export function launchProcess(executable, project, root, key, spawnProcess = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(executable, ['--user-data-dir', join(root, 'vscode'), '--new-window', project], {
      env: childEnvironment(key, join(root, 'codex')), detached: true, stdio: 'ignore', shell: false
    });
    child.once('error', () => reject(new Error('VS Code could not start. Check its installation.')));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export async function launch({ key, model, project }, root) {
  if (typeof project !== 'string' || !isAbsolute(project) || !(await stat(project).catch(() => null))?.isDirectory()) throw new Error('Enter the absolute path of an existing project folder.');
  const executable = await findCode();
  const { stdout } = await run('ps', ['-ax', '-o', 'args=']);
  if (stdout.split('\n').some(line => line.includes('--user-data-dir') && line.includes(join(root, 'vscode')))) throw new Error('Close all ELM VS Code windows before reopening or changing the starting model.');
  if (!(await loadModels(key)).includes(model)) throw new Error('Select a model listed for your ELM account.');
  await saveConfig(root, model);
  await launchProcess(executable, project, root, key.trim());
}

export async function createSetupServer({ preview = false, models = loadModels, start = launch, root = stateDirectory() } = {}) {
  const token = randomBytes(32).toString('hex');
  let busy = false;
  const server = createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    function json(status, value) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); }
    if (req.headers.host !== origin.slice(7)) { json(403, { error: 'Invalid host.' }); return; }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/setup.js')) {
      const html = await readFile(page, 'utf8');
      res.writeHead(200, { 'Content-Type': req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
      res.end(req.url === '/' ? html.replace(/<script id="app">[^]*?<\/script>/, '<script src="/setup.js"></script>') : html.match(/<script id="app">([^]*?)<\/script>/)[1]);
      return;
    }
    if (req.headers['x-elm-setup-token'] !== token || (req.method !== 'GET' && req.headers.origin !== origin)) { json(403, { error: 'Reopen the setup link from the terminal.' }); return; }
    if (req.method === 'GET' && req.url === '/api/status') { json(200, { platform: process.platform, preview, root }); return; }
    if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') { json(404, { error: 'Not found.' }); return; }
    if (busy) { json(409, { error: 'Please wait for the current request.' }); return; }
    busy = true;
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 32_768) throw new Error('Request too large.'); }
      let input;
      try { input = JSON.parse(body); } catch { throw new Error('Invalid request.'); }
      if (!input || typeof input !== 'object') throw new Error('Invalid request.');
      if (req.url === '/api/models') json(200, { models: await models(input.key) });
      else if (req.url === '/api/launch') {
        if (preview) throw new Error('Preview only: launching requires macOS or Linux.');
        await start(input, root);
        json(200, { message: 'VS Code launch requested. Open Codex, install the extension if needed, and complete its first-run prompts. Keep the project trusted only if you trust its contents.' });
      } else json(404, { error: 'Not found.' });
    } catch (e) { json(400, { error: e.message.startsWith('Unexpected') ? 'Invalid response. Try again.' : e.message }); }
    finally { busy = false; }
  });
  server.requestTimeout = 30_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}/#${token}` };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const preview = process.argv.includes('--preview');
  if (!preview && !['darwin', 'linux'].includes(process.platform)) {
    console.error('Use Start ELM.cmd on Windows. This launcher is for macOS and Linux.');
    process.exitCode = 1;
  } else {
    const { server, url } = await createSetupServer({ preview });
    console.log(`ELM Coding setup\nOpen this local link in your browser:\n${url}\nKeep this terminal open during setup. Press Ctrl+C when finished. API keys are not saved.`);
    if (!preview) run(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]).catch(() => console.log('Open the link above manually.'));
    const close = () => { server.close(); server.closeAllConnections(); };
    process.once('SIGINT', close); process.once('SIGTERM', close);
  }
}
