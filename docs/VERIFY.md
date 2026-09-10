# Verification and troubleshooting

## Verification sequence

1. Check the credential for your mode: direct clients need `ELM_API_KEY`; relay clients need `ELM_ADAPTOR_TOKEN`. In a fresh PowerShell terminal, `[bool]$env:ELM_API_KEY` (or the local-token variable) prints only true or false. This does not prove the IDE inherited it. The PyCharm launcher loads the root `.env` itself.
2. Create a new Codex conversation. For the CLI, use `/status`; for an IDE/ACP client, inspect its actual session metadata and diagnostic logs. Do not rely on a model-generated answer about its provider. Expect provider `elm` and the configured model. Direct requests go to `elm.edina.ac.uk`; relay clients contact `127.0.0.1`, and the relay forwards to ELM. Keep other relay clients idle while correlating a new prompt with a new successful request log.
3. Send: **Reply only OK. Do not call tools.** Confirm the response completes normally.
4. Send: **Read this project's README and summarise it in two points. Do not modify files.** Confirm a file-read tool call and final answer. If the project has no README, specify a known text file.
5. After these checks pass, test editing and longer conversations using the client's normal permission flow.

## Optional independent API checks

After setting ELM_API_KEY in PowerShell, query the available models:

```powershell
$elmHeaders = @{ Authorization = 'Bearer ' + $env:ELM_API_KEY }
$elmModels = Invoke-RestMethod -Uri 'https://elm.edina.ac.uk/api/v1/models' -Headers $elmHeaders
$elmModels.data.id
```

If the key is missing, set it before running these commands. Check that your account lists the template's model.

The following optional generation test incurs a small amount of ELM usage. It runs only when you execute it:

```powershell
$elmBody = @{
    model = 'gpt-5.3-codex'
    input = 'Reply only OK.'
    reasoning = @{ effort = 'low' }
    max_output_tokens = 128
    store = $false
} | ConvertTo-Json -Depth 5
$elmResponse = Invoke-RestMethod -Method Post -Uri 'https://elm.edina.ac.uk/api/v1/responses' -Headers $elmHeaders -ContentType 'application/json' -Body $elmBody
$elmResponse.status
$elmResponse.output | Where-Object type -eq 'message' | ForEach-Object { $_.content.text }
```

Expect `completed` and an OK reply. If the status is `incomplete`, inspect `incomplete_details`; exhausting the token limit is different from protocol incompatibility. This checks non-streaming Responses only, not streaming, tool calls or IDE integration.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Missing environment variable/key | Variable name, actual Codex host, and whether the IDE/launcher was restarted |
| Still using OpenAI despite project config | Provider keys are ignored in project-local config. Use user-level `CODEX_HOME/config.toml`, restart and create a new conversation |
| 401 | Missing or invalid ELM key, an OpenAI key used by mistake, or inactive provider configuration |
| 400 | Request parameters and model compatibility; inspect the error body |
| 404 | Extra URL path segments, model availability under /models, or missing resources |
| 413 | ELM documents a 10 MiB request-body limit; reduce attachments or input size |
| 429 | Quota or rate limits; inspect the error type and Retry-After |
| SSE disconnects | Network/proxy timeouts and final response.completed or error events |
| CLI works but built-in PyCharm Codex fails | JetBrains-specific configuration, authentication or overrides; use standalone CLI or investigate Custom ACP |
| ACP cannot start | Run `npm ci --prefix clients/pycharm` from the repository root; check the absolute Node/launch.mjs paths, local `.env`, arguments and ACP logs |
| Relay cannot listen / EADDRINUSE | Port is occupied; stop the other service or set ELM_ADAPTOR_PORT (1024-65535), then regenerate the client config |
| Replies work but tools do not | Support for the requested tool type and actual tool-call events; HTTP 200 alone is insufficient |
| Long-session compaction fails | ELM does not document /responses/compact; inspect the failing path rather than assuming support from short requests |
| Qwen/Llama fails through Codex | ELM does not mark /responses as supporting local models; investigate a protocol adapter separately |

## Useful diagnostic information

Record the IDE, extension/AI Assistant and CLI/ACP versions, entry point, provider/model, failing request path, HTTP status and error message. Remove Authorization headers, API keys, conversation content and other private data before sharing logs. A full `auth.json` is not needed.

Keep normal authentication and TLS certificate verification enabled when diagnosing network failures.

Sources: [ELM Proxy API](https://elm.edina.ac.uk/elm/help/proxy-api) and [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
