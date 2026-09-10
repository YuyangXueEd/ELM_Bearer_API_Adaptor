# VS Code: connect the Codex extension to ELM

These instructions apply to the official Codex extension. The separate ELM Coding extension does not use this configuration.

**Current verification:** the extension's bundled Codex engine returned a reply through ELM. However, the tested graphical-panel conversation used `openai` / `gpt-6-astra`, and a fresh reply generated no request to the running ELM relay. Its project-level ELM configuration had not taken effect. Full IDE editing through ELM remains unverified. See the [dated report](../../docs/VERIFICATION-2026-09-10.md).

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

This checked-in template connects directly to ELM. To use the optional local relay, start it as described in the [project README](../../README.md), generate a config with `node --env-file=.env src/cli.js config --proxy`, and merge that output instead. Supply `ELM_ADAPTOR_TOKEN` to the VS Code process in place of `ELM_API_KEY`; keep the relay running while using the agent.

- Place `model`, `model_provider` and `model_reasoning_effort` at the TOML top level, before the first table header.
- Update existing entries rather than defining the same key or `[model_providers.elm]` table twice.
- Preserve existing MCP, project, permission and other settings.
- This changes the default provider for Codex clients that read this configuration. The CLI or desktop app on the same machine may also be affected.
- Keep `base_url` ending at `/api/v1`; Codex adds `/responses`.
- `requires_openai_auth = false` selects provider-specific credentials. ELM still requires authentication.
- `supports_websockets = false` selects the HTTP/SSE transport used in the API tests.

Sources: [custom providers](https://learn.chatgpt.com/docs/config-file/config-advanced) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## 3. Restart and verify

Restart VS Code and create a new Codex conversation. Follow [Verification and troubleshooting](../../docs/VERIFY.md) to check the provider, a simple reply and a file read. Existing conversations may retain previous model settings.

For WSL, SSH or containers, identify where the extension host and Codex process run. Configure the key and configuration file on that host. Windows user variables do not automatically configure every remote environment.

## Roll back

Restore the configuration backup and restart VS Code. Temporary variables disappear when the processes holding them exit; persistent variables can be removed through Windows environment settings. There is no need to delete `auth.json` or other providers.
