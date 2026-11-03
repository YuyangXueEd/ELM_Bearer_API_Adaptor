# PyCharm: Codex via ELM

This folder is independent of the [VS Code setup](../vscode/README.md). Use a **Custom ACP Agent** in JetBrains AI Chat, or run standalone Codex in PyCharm Terminal.

**Verified:** ACP initialization, session creation and streamed replies through ELM in direct and relay modes on Windows. On 3 November 2026, PyCharm 2026.2.4 also selected **Codex via ELM**, received a reply, created `hello_world.py`, and edited `script.py` through `mcp.pycharm.apply_patch`. The IDE showed a model-metadata fallback warning for `gpt-5.3-codex`. **Still to verify:** agent terminal commands and running project tests. See the [earlier transport verification report](../../docs/VERIFICATION-2026-09-10.md).

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

This optional live test uses ELM quota. It checks ACP initialization, session creation and a requested text-only `ELM_ACP_OK` response in a disposable directory. It supplies no ACP client filesystem or terminal tools; this is not a test of Codex's own tool execution. Expected output: three `PASS` lines. If it fails, check ELM access using `npm run doctor` first.

### 3. Register in PyCharm

In AI Chat, open the top-right options menu and choose **Add Custom Agent**. Merge the entry from [acp.example.json](acp.example.json) into `%USERPROFILE%\.jetbrains\acp.json`, preserving other entries. Replace both example paths with your local absolute paths. Find Node with `(Get-Command node).Source` on Windows or `command -v node` on macOS/Linux. The command must be the Node executable and the argument must be this folder's `launch.mjs`. Do not launch through npm, which can write non-ACP text to stdout. Keep the ELM key in the ignored root `.env`; it does not belong in `acp.json`.

After adding the entry, use AI Chat's bottom-left selector (often labelled **Chat**) and choose **Agents → Codex via ELM**. This is a local custom agent; it does not appear as a registry installation under Settings → AI Assistant → Agents. If it is missing, validate `acp.json` and restart the IDE.

Select **Codex via ELM**, start a new chat, and ask: `Do not use tools. Reply with exactly ELM_ACP_OK.` Then, in a disposable project, ask it to read a harmless file and make a small edit. The launcher starts in read-only mode; change the session to an appropriate editing mode when you want edits. The text-only smoke check does not validate IDE tools, terminal commands, or test execution.

The launcher supplies the provider credential to ACP's API-key authentication step automatically. This step was necessary with the tested adapter even though ELM uses `requires_openai_auth = false`. Credentials are available to the local process and may be persisted by Codex under the dedicated, ignored `.local/pycharm-codex` home. Neither `CODEX_CONFIG` nor the shared JSON contains the key. That dedicated home does not inherit your normal Codex authentication, history, skills or MCP settings.

If PyCharm asks for ChatGPT authentication, confirm you selected the **custom** agent. Inspect **Get ACP Logs** if needed; third-party logs can contain conversation data, so redact them before sharing.

### Optional relay mode

Set `ELM_ADAPTOR_TOKEN` in `.env` and run `npm start` in a separate terminal. Add `"--proxy"` as the second entry in the JSON `args` array. Check it with:

```powershell
node clients/pycharm/smoke.mjs --proxy
```

Keep the relay running. The launcher reads `ELM_ADAPTOR_PORT` and `ELM_MODEL` from the environment or local `.env`. Existing process variables take precedence.

### Choosing a model

For the initial pilot, keep `ELM_MODEL=gpt-5.3-codex`. To test another model, first check it with `npm run doctor -- --model MODEL_ID`, then update `ELM_MODEL` in the root `.env` and restart the custom agent. Model selection through the PyCharm UI has not been verified. The adapter's displayed model list is not proof that every listed model is available through your ELM account.

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
