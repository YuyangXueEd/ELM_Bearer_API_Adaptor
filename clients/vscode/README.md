# VS Code: connect the Codex extension to ELM

These instructions apply to the official Codex extension. The separate ELM Coding extension does not use this configuration.

**Prefer a setup window?** Use [Easy start for Windows](EASY-START.md): double-click `Start ELM.cmd`, enter your key, load your account's models and open VS Code. No Node.js or manual TOML editing is needed. The manual relay and direct instructions below remain available.

**Verified on Windows:** the Codex panel used ELM to read and edit files, run tests, and switch from GPT-5.5 to GPT-5.2. See the [verification report](../../docs/VERIFICATION-2026-09-10.md).

## Tested isolated Windows setup

This setup uses a separate Codex home and VS Code profile. Run it from a fresh PowerShell terminal at the repository root. Requires Node.js 22+, VS Code and the official Codex extension.

1. Fill in the local `.env` as described in the root README and run `npm start` in a separate terminal. Keep the relay running.
2. Create a new configuration directory and generate its key-free relay configuration:

```powershell
$elmCodexHome = Join-Path $PWD '.local\vscode-elm-home'
$elmCodeProfile = Join-Path $PWD '.local\vscode-elm-user'
New-Item -ItemType Directory -Force -Path $elmCodexHome | Out-Null
node --env-file=.env src/cli.js config --proxy --model gpt-5.5 --out (Join-Path $elmCodexHome 'config.toml')
```

The generator will not overwrite an existing file. Keep it for later launches; it may contain sandbox settings saved by the plugin.

3. Start an isolated VS Code process with the local token. Enter the **same** `ELM_ADAPTOR_TOKEN` used by the relay at the hidden prompt. Replace the example project path with a disposable local project:

```powershell
$elmLocalToken = Read-Host 'ELM_ADAPTOR_TOKEN from your local .env' -AsSecureString
$env:ELM_ADAPTOR_TOKEN = [System.Net.NetworkCredential]::new('', $elmLocalToken).Password
$env:CODEX_HOME = $elmCodexHome
code --user-data-dir "$elmCodeProfile" --extensions-dir "$env:USERPROFILE\.vscode\extensions" --new-window 'C:\Projects\YourDisposableProject'
```

If needed, adjust `--extensions-dir` or install Codex in the isolated profile. The relay holds the ELM key; VS Code uses only the local token. Fully close the isolated instance before changing its environment.

4. Complete Codex's Windows sandbox setup and leave its permission controls enabled.
5. Start a new conversation and select **5.5** from the model menu.

To return to normal, close the isolated window and terminal, then open VS Code normally. Keep your usual `.codex` directory.

## Alternative: configure an existing VS Code installation

Use these instructions to configure your existing user-level Codex setup. The tested UI workflow above used relay mode.

### How to prove which provider is used

Confirm ELM routing in local session metadata (`source`, `model_provider`, and `model`). In relay mode, correlate a test prompt with a successful `POST /v1/responses` log. Restart VS Code and start a new conversation after configuration changes. Keep session records private.

## 1. Supply your ELM API key

In Windows, search for **Edit environment variables for your account**. Add a user variable named `ELM_API_KEY` with your own ELM key as its value. Use an ELM key, not an OpenAI key, and keep it out of this shared folder.

Save your work, fully exit VS Code and reopen it from a fresh process. If the environment remains stale, sign out of Windows and sign back in. **Reload Window** alone does not guarantee that the extension receives updated variables.

User environment variables persist on the machine. To use a temporary variable instead, fully exit VS Code, then run this in PowerShell:

```powershell
$elmSecret = Read-Host 'ELM API key' -AsSecureString
$env:ELM_API_KEY = [System.Net.NetworkCredential]::new('', $elmSecret).Password
# Replace this example with your own project directory.
code 'C:\Projects\YourProject'
```

`code` may reuse an existing process with an old environment. A project `.env` or `terminal.integrated.env.windows` may not reach the extension host.

## 2. Merge the provider configuration

Use the configuration-file entry in the Codex extension settings and edit the file it opens. The default Windows location is `%USERPROFILE%\.codex\config.toml`. If `CODEX_HOME` is set, the file is `config.toml` inside that directory.

Back up the existing file, then merge [config.example.toml](config.example.toml).

Use the user-level config. Codex ignores `model_provider` and `model_providers` in project `.codex/config.toml`, even for trusted projects. [Official rules](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml)

This checked-in template connects directly to ELM. To use the optional local relay, start it as described in the [project README](../../README.md), generate a config with `node --env-file=.env src/cli.js config --proxy`, and merge that output instead. Supply `ELM_ADAPTOR_TOKEN` to the VS Code process in place of `ELM_API_KEY`; keep the relay running while using the agent.

- Put `model`, `model_provider` and `model_reasoning_effort` before TOML table headers. Merge provider entries and preserve other settings.
- Direct URL: `https://elm.edina.ac.uk/api/v1`; relay URL: `http://127.0.0.1:8787/v1`. Codex adds `/responses`.
- This config affects Codex clients using the same `CODEX_HOME`. ELM still requires its own key; WebSockets are disabled for HTTP/SSE.

Sources: [custom providers](https://learn.chatgpt.com/docs/config-file/config-advanced) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## 3. Restart and verify

Restart VS Code and create a new Codex conversation. Follow [Verification and troubleshooting](../../docs/VERIFY.md) to check the provider, a simple reply and a file read. Existing conversations may retain previous model settings.

For WSL, SSH or containers, identify where the extension host and Codex process run. Configure the key and configuration file on that host. Windows user variables do not automatically configure every remote environment.

## Roll back

Restore the configuration backup and restart VS Code. Temporary variables disappear when the processes holding them exit; persistent variables can be removed through Windows environment settings. There is no need to delete `auth.json` or other providers.

## Choosing models

You can switch the tested models inside the plugin without manually editing TOML:

1. Expand the Codex side panel if its controls show only icons.
2. Click the model/effort control beside the composer, such as **5.5 Light**.
3. In the effort popup, click the model selection control (labelled **Select model** to accessibility tools; visually the effort label has a right arrow).
4. Select **5.2** or **5.5**, then click the composer to dismiss the popup and send a new request.

GPT-5.5 and GPT-5.2 were verified. The plugin may persist model defaults beyond the current conversation.

`model` sets the initial default. The picker is not synced with ELM and may show models your account cannot access. Use `npm run doctor` to check availability; this does not guarantee Codex tool support.

For a model absent from the picker, set its exact ID in TOML and restart. A broad ELM catalog needs compatibility checks before adding it through Codex's `model_catalog_json`. [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
