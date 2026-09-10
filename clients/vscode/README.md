# VS Code: connect the Codex extension to ELM

These instructions apply to the official Codex extension. The separate ELM Coding extension does not use this configuration.

**Prefer a setup window?** Use [Easy start for Windows](EASY-START.md): double-click `Start ELM.cmd`, enter your key, load your account's models and open VS Code. No Node.js or manual TOML editing is needed. The manual relay and direct instructions below remain available.

**Verified on Windows:** VS Code 1.137.0, extension `openai.chatgpt` 26.903.71938, bundled Codex 0.153.4. With a dedicated user-level `CODEX_HOME`, the graphical panel used ELM through the local relay, read files, fixed a Python function, created tests and ran all 3 successfully. Switching from GPT-5.5 to GPT-5.2 inside the same conversation retained ELM routing and successfully reran the tests. The earlier project-level configuration failure is retained in the [dated report](../../docs/VERIFICATION-2026-09-10.md).

## Tested isolated Windows setup

This uses a separate Codex home and VS Code user-data directory so your normal Codex configuration remains available. Use a fresh external PowerShell terminal, not a terminal inherited from another Codex session. Run the commands from this repository's root. Node.js 22+, VS Code and the official Codex extension are required.

1. Fill in the local `.env` as described in the root README and run `npm start` in a separate terminal. Keep the relay running.
2. Create a new configuration directory and generate its key-free relay configuration:

```powershell
$elmCodexHome = Join-Path $PWD '.local\vscode-elm-home'
$elmCodeProfile = Join-Path $PWD '.local\vscode-elm-user'
New-Item -ItemType Directory -Force -Path $elmCodexHome | Out-Null
node --env-file=.env src/cli.js config --proxy --model gpt-5.5 --out (Join-Path $elmCodexHome 'config.toml')
```

The generator refuses to overwrite an existing file. On later launches, keep that file and skip generation; it also contains sandbox settings saved by the plugin.

3. Start an isolated VS Code process with the local token. Enter the **same** `ELM_ADAPTOR_TOKEN` used by the relay at the hidden prompt. Replace the example project path with a disposable local project:

```powershell
$elmLocalToken = Read-Host 'ELM_ADAPTOR_TOKEN from your local .env' -AsSecureString
$env:ELM_ADAPTOR_TOKEN = [System.Net.NetworkCredential]::new('', $elmLocalToken).Password
$env:CODEX_HOME = $elmCodexHome
code --user-data-dir "$elmCodeProfile" --extensions-dir "$env:USERPROFILE\.vscode\extensions" --new-window 'C:\Projects\YourDisposableProject'
```

This command assumes the normal Windows extension location. If your installation uses another location, adjust `--extensions-dir`, or install the official Codex extension in the isolated profile. The relay supplies the upstream key; this VS Code process only needs the local token. Fully close the isolated instance before relaunching with changed environment variables.

4. Open Codex and complete its Windows sandbox setup. The successful test used the official **Continue without administrator access** option after administrator setup did not finish; the plugin saved `[windows] sandbox = "unelevated"`. If your sandbox is already working, keep it. Leave the normal permission controls enabled.
5. Create a new conversation and follow the verification steps below. Use the model menu to select **5.5**; the shared CLI default remains `gpt-5.3-codex`, while this VS Code example explicitly selects the UI-tested model.

To return to your normal setup, close the isolated window and this PowerShell terminal, then open VS Code normally. Do not delete or replace your normal `.codex` directory.

## Alternative: configure an existing VS Code installation

The following sections explain direct access and merging settings into your existing user-level configuration. The end-to-end UI test above used relay mode.

### How to prove which provider is used

Check the actual conversation's session metadata (`source`, `model_provider`) and turn context (`model`), not the model's answer to "which API are you using?". Read these locally; raw session files can contain private data and should not be uploaded.

For relay mode, start `npm start`, send a unique harmless prompt from the VS Code Codex panel, and correlate it with a new `POST /v1/responses` log entry and successful upstream status. Keep other relay clients idle during the check. The relay's upstream is fixed to ELM. A matching reply without a relay request does not prove ELM connectivity. After changing configuration, restart the extension and create a new conversation before repeating the check.

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

If VS Code is already running, `code` may reuse a process with the old environment. A project's `.env` file and `terminal.integrated.env.windows` do not guarantee that the extension host receives the key.

## 2. Merge the provider configuration

Use the configuration-file entry in the Codex extension settings and edit the file it opens. The default Windows location is `%USERPROFILE%\.codex\config.toml`. If `CODEX_HOME` is set, the file is `config.toml` inside that directory.

Back up the existing file, then merge [config.example.toml](config.example.toml).

**Use the user-level file, not `<project>/.codex/config.toml`.** Current Codex deliberately ignores `model_provider` and `model_providers` in project-local configuration. This explains why the earlier project-level test continued using OpenAI. A trusted project does not remove this restriction. [Official rules](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml)

This checked-in template connects directly to ELM. To use the optional local relay, start it as described in the [project README](../../README.md), generate a config with `node --env-file=.env src/cli.js config --proxy`, and merge that output instead. Supply `ELM_ADAPTOR_TOKEN` to the VS Code process in place of `ELM_API_KEY`; keep the relay running while using the agent.

- Place `model`, `model_provider` and `model_reasoning_effort` at the TOML top level, before the first table header.
- Update existing entries rather than defining the same key or `[model_providers.elm]` table twice.
- Preserve existing MCP, project, permission and other settings.
- This changes the default provider for Codex clients that read this configuration. The CLI or desktop app on the same machine may also be affected.
- Direct mode uses `https://elm.edina.ac.uk/api/v1`; relay mode uses `http://127.0.0.1:8787/v1`. Codex adds `/responses`.
- `requires_openai_auth = false` selects provider-specific credentials. ELM still requires authentication.
- `supports_websockets = false` selects the HTTP/SSE transport used in the API tests.

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

The test switched an existing conversation from `gpt-5.5` to `gpt-5.2`; the UI displayed the change, the next turn's metadata recorded the new model, and the provider remained `elm`. GPT-5.2 then executed the test command successfully. The plugin may persist model defaults itself; do not assume selection is confined to one conversation.

`model` in TOML supplies the initial default. Endpoint/provider/authentication still require configuration. The picker is not a live list from ELM `/models`: it also showed models unavailable to the test account, including 6 Astra. Check your own account with `npm run doctor`; avoid **Default** or unverified entries when checking routing. Availability alone does not establish Codex tool compatibility.

For models absent from the picker, configure their exact ID and restart with a new conversation. `gpt-5.3-codex` passed API/CLI checks but was absent from this build's catalog and produced a missing-metadata warning. No ELM catalog generator is shipped. Codex documents `model_catalog_json` for startup catalogs, but a broad ELM catalog needs separate capability validation. [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
