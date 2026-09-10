# PyCharm: Codex via ELM

This folder is independent of the [VS Code setup](../vscode/README.md). Use a **Custom ACP Agent** in JetBrains AI Chat, or run standalone Codex in PyCharm Terminal.

**Verified:** ACP initialization, session creation and a streamed reply through ELM in direct and relay modes on Windows. **Not yet verified:** PyCharm's graphical chat panel and a complete file-editing workflow. See the [verification report](../../docs/VERIFICATION-2026-09-10.md).

## Option A: Custom ACP Agent in AI Chat

Requires Node.js 22+, a PyCharm/AI Assistant version offering **Add Custom Agent**, and an ELM key. JetBrains documents custom ACP in AI Assistant 2026.2 without requiring a JetBrains AI subscription. Organisation policies can restrict agents; WSL is currently unsupported for this integration.

### 1. Install and prepare

From the repository root:

```powershell
npm ci --prefix clients/pycharm
```

Create the root `.env` from `.env.example` and fill in your own `ELM_API_KEY`. It is ignored by Git. The launcher loads this file directly, so you do not need to add the key to Windows user variables or JetBrains JSON.

This folder pins `@agentclientprotocol/codex-acp` to **1.11.0** and locks its dependencies, including Codex **0.153.4**. The shared HTTP relay still has no runtime dependencies.

### 2. Verify before configuring the IDE

```powershell
node clients/pycharm/smoke.mjs
```

This optional live test uses ELM quota. It checks ACP initialization, session creation and the `ELM_ACP_OK` response without granting file tools. Expected output: three `PASS` lines. If it fails, check ELM access using `npm run doctor` first.

### 3. Register in PyCharm

Open **AI Chat → agent selector → Add Custom Agent**. Merge the entry from [acp.example.json](acp.example.json) into `~/.jetbrains/acp.json`, preserving other entries.

Replace both paths with your local absolute paths. Find Node with `Get-Command node` on Windows or `command -v node` on macOS/Linux. The command must be the Node executable and the argument must be this folder's `launch.mjs`. Do not launch through npm, which can write non-ACP text to stdout.

Select **Codex via ELM**, start a new chat, and ask: `Do not use tools. Reply with exactly ELM_ACP_OK.` Then ask it to read a harmless file in a disposable project. Change the initial read-only mode to an appropriate editing mode when you want edits.

The launcher supplies the provider credential to ACP's API-key authentication step automatically. This step was necessary with the tested adapter even though ELM uses `requires_openai_auth = false`. Credentials are available to the local process and may be persisted by Codex under the dedicated, ignored `.local/pycharm-codex` home. Neither `CODEX_CONFIG` nor the shared JSON contains the key. That dedicated home does not inherit your normal Codex authentication, history, skills or MCP settings.

If PyCharm asks for ChatGPT authentication, confirm you selected the **custom** agent. Inspect **Get ACP Logs** if needed; third-party logs can contain conversation data, so redact them before sharing.

### Optional relay mode

Set `ELM_ADAPTOR_TOKEN` in `.env` and run `npm start` in a separate terminal. Add `"--proxy"` as the second entry in the JSON `args` array. Check it with:

```powershell
node clients/pycharm/smoke.mjs --proxy
```

Keep the relay running. The launcher reads `ELM_ADAPTOR_PORT` and `ELM_MODEL` from the environment or local `.env`. Existing process variables take precedence.

### Roll back

Remove only **Codex via ELM** from `acp.json` and restart the IDE. The launcher does not edit your global Codex configuration or Windows user variables.

## Option B: standalone Codex in PyCharm Terminal

Install the [official Codex CLI](https://developers.openai.com/codex/cli/). Create `%USERPROFILE%\.codex-elm` and copy [config.example.toml](config.example.toml) into it as `config.toml`, merging if it already exists. In PyCharm Terminal:

```powershell
$env:CODEX_HOME = Join-Path $env:USERPROFILE '.codex-elm'
$elmSecret = Read-Host 'ELM API key' -AsSecureString
$env:ELM_API_KEY = [System.Net.NetworkCredential]::new('', $elmSecret).Password
codex
```

This runs the CLI in the terminal. Check `/status`, then follow [verification](../../docs/VERIFY.md). Close the terminal to end the temporary environment.

## Sources

- [JetBrains custom ACP agents](https://www.jetbrains.com/help/ai-assistant/acp.html)
- [Maintained Codex ACP adapter and runtime options](https://github.com/agentclientprotocol/codex-acp)
- [Codex provider configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
