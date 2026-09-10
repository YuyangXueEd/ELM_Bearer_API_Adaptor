# PyCharm: standalone CLI and AI Chat options

The built-in AI Assistant Codex integration, standalone CLI and Custom ACP Agent are separate entry points. Start with Option A to verify direct access; use Option B if you need an AI Chat panel. Neither option has yet been verified end to end inside PyCharm for this setup.

The templates below use direct ELM access. For relay mode in Option A, generate the proxy TOML from the [project quick start](../../README.md), use it in the dedicated Codex home, and provide ELM_ADAPTOR_TOKEN to the CLI process while the relay is running. For Option B, the JSON's embedded CODEX_CONFIG would also need the relay base URL and env_key changed together; that combination is not presented as tested here.

## Option A: run standalone Codex CLI in PyCharm Terminal

### Prepare a dedicated configuration

1. Check that `codex --version` works in Terminal. If needed, install Codex using the [official CLI instructions](https://developers.openai.com/codex/cli/).
2. Create the folder `%USERPROFILE%\.codex-elm`.
3. Copy [config.example.toml](config.example.toml) into it as `config.toml`. If that file already exists, back it up and merge the settings instead of overwriting it.

Open a PowerShell terminal inside PyCharm, change to your project directory and run:

```powershell
$env:CODEX_HOME = Join-Path $env:USERPROFILE '.codex-elm'
$elmSecret = Read-Host 'ELM API key' -AsSecureString
$env:ELM_API_KEY = [System.Net.NetworkCredential]::new('', $elmSecret).Password
codex
```

Set `CODEX_HOME` only in this terminal, not as a global user variable. The dedicated directory does not automatically inherit your original Codex home's MCP settings, skills, authentication or history. Transfer any required settings deliberately.

Use `/status` to check the provider and model, then follow [Verification and troubleshooting](../VERIFY.md). This runs Codex in the terminal; it does not replace the built-in AI Assistant panel.

### Roll back

Exit Codex and close the terminal session. If PyCharm reuses terminal processes, start a fresh terminal that does not inherit these temporary variables. This option does not modify the original user configuration.

## Option B: add a Custom ACP Agent to AI Chat

**Status: documented candidate; authentication and end-to-end IDE verification are pending.**

JetBrains supports custom ACP agents in `~/.jetbrains/acp.json`. This option uses `@agentclientprotocol/codex-acp`. The former `@zed-industries/codex-acp` repository is archived and directs new installations to this maintained project.

### 1. Install the adapter

In a terminal with Node.js and npm available:

```powershell
npm install -g @agentclientprotocol/codex-acp
codex-acp --version
```

The adapter includes a compatible Codex npm dependency. Leave `CODEX_PATH` unset for the initial setup. Record the installed version for reproducibility; these instructions do not pin or claim to have tested an adapter release.

### 2. Supply the process environment

Set the user environment variable `ELM_API_KEY` as described in the [VS Code guide](../vscode/README.md).

The adapter also exposes an API-key authentication flow. If the client requires that flow, the adapter process needs `CODEX_API_KEY` with the same ELM key. You can supply it through Windows user environment settings. Do not commit its value to the shared JSON template. If you already use CODEX_API_KEY for another provider, use a dedicated launch environment rather than replacing it globally.

Fully exit and restart PyCharm so it inherits the variables and npm's PATH. The IDE launcher may also need restarting; signing out of Windows refreshes stale environments.

Use the custom agent named **Codex via ELM** for this option. Do not enter the ELM key in the built-in OpenAI provider form.

### 3. Register the agent

From AI Chat, select **Add Custom Agent** and edit the configuration file it opens. Merge the `Codex via ELM` entry under `agent_servers` from [acp.example.json](acp.example.json). Preserve existing agents and settings.

The Windows template launches the npm command through `cmd.exe /d /c codex-acp`. Adjust `command` if Windows is installed elsewhere. If the command is not found, check `Get-Command codex-acp` in a new system terminal and confirm PyCharm inherited the relevant npm PATH.

The adapter documents `MODEL_PROVIDER` and `CODEX_CONFIG` as configuration inputs. The template uses both to specify ELM and starts in read-only mode through `INITIAL_AGENT_MODE`. It does not require editing JetBrains' built-in Codex cache configuration. After verification, choose the working mode appropriate to your task in the agent UI.

### 4. Verify the connection and authentication

Select **Codex via ELM**, create a new conversation and run `/status`. Check for provider `elm` and model `gpt-5.3-codex`, then test a simple reply and file read. The agent's display name alone does not prove which provider receives requests.

If an authentication menu appears, select the API-key method. The adapter documents that this method reads `CODEX_API_KEY` or `OPENAI_API_KEY`. Its interaction with custom providers and specific JetBrains versions still needs testing.

If the client only allows ChatGPT authentication, rejects the provider or reports `openai`/`jetbrains-ai`, stop this test, inspect ACP logs and use Option A. Such a failure does not by itself establish that ELM's Responses API is unavailable.

JetBrains documents WSL limitations for ACP; this template targets native Windows PyCharm. If **Add Custom Agent** is unavailable, check the IDE/AI Assistant version and organisation restrictions.

### Roll back

Remove only the `Codex via ELM` entry you added to `acp.json`, then restart the IDE. Remove newly added environment variables if no longer needed, or restore their previous values. Do not clear the built-in JetBrains authentication directory.

## Why not overwrite the built-in Codex configuration?

The integrated JetBrains agent uses `<IDE system dir>/aia/codex` and may not read `~/.codex`. Reports for specific versions describe rejection of third-party providers or overwritten settings. Copying files into the cache directory or making them read-only is not treated here as a reliable solution.

## Sources

- [JetBrains ACP settings](https://www.jetbrains.com/help/ai-assistant/acp.html)
- [Current codex-acp installation, authentication and runtime options](https://github.com/agentclientprotocol/codex-acp)
- [Former adapter migration notice](https://github.com/zed-industries/codex-acp)
- [JetBrains Codex home explanation](https://youtrack.jetbrains.com/projects/WI/articles/SUPPORT-A-3134/How-does-Codex-CLI-integration-Codex-Agent-work-in-JetBrains-IDEs)
- [Custom configuration issue report](https://youtrack.jetbrains.com/projects/LLM/issues/LLM-26596/Codex-refusing-to-use-custom-config.toml-file)
