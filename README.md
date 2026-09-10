# ELM Bearer API Adaptor

Connect coding agents to the University of Edinburgh's ELM API. This community project provides **connection diagnostics, Codex configuration generation and an optional authenticated local streaming relay**.

It is an integration layer, not a new autonomous coding agent. Codex or another compatible client supplies the coding workflow and file tools. It is not affiliated with or endorsed by EDINA, OpenAI or JetBrains.

## Readiness: experimental pilot

Ready for colleagues to try in a disposable project. **VS Code routing, file reading, editing, test execution and model switching have passed on the Windows setup below.** PyCharm UI testing remains pending. This is still a technical pilot, not a guarantee for every installation or ELM model.

| Component | Evidence | Status |
|---|---|---|
| Diagnostics and local relay | Offline tests plus live streaming/function-call checks | Ready for pilot testing |
| PyCharm ACP launcher | Authentication, session creation and text replies through ELM | Ready for transport testing; PyCharm UI/editing still unverified |
| VS Code Codex extension | Actual UI used ELM with GPT-5.5, read files, patched code and ran 3 passing tests | Verified on Windows / VS Code 1.137.0 / extension 26.903.71938 |
| VS Code model switching | Selected GPT-5.5 then GPT-5.2 in the plugin; both used ELM and executed tools | Verified for these two models; automatic ELM catalog discovery is not implemented |

See the [review findings](docs/REVIEW.md) and [dated evidence](docs/VERIFICATION-2026-09-10.md). An HTTP 200 or a model saying "I use ELM" is not proof of a working IDE integration.

## Why this exists

ELM already documents an OpenAI-compatible Responses API. Bearer authentication is not a different protocol. The common setup problems are selecting the correct endpoint, passing credentials to the IDE process and configuring the agent's provider.

Use **direct mode** when your client supports a custom base URL and Bearer key. Use the **local relay** when you want the upstream ELM key held in one local process while clients use a separate local token. The relay preserves JSON, SSE events, function calls and upstream error statuses; it does not translate Chat Completions into Responses or invent missing model capabilities.

```text
Direct:  Codex / compatible client ── ELM Bearer key ──> ELM

Relay:   Codex / compatible client ── local token ──> 127.0.0.1:8787
                                                       │
                                                  ELM Bearer key
                                                       │
                                                       ▼
                                               ELM /api/v1
```

## Quick start

Requires Node.js 22+ and your own ELM API key. The relay and diagnostics have no runtime dependencies or build steps. The optional PyCharm ACP client has its own pinned dependencies in `clients/pycharm`.

```sh
git clone https://github.com/YuyangXueEd/ELM_Bearer_API_Adaptor.git
cd ELM_Bearer_API_Adaptor
```

Copy `.env.example` to `.env` in your editor and fill in `ELM_API_KEY`. Keep this file local. If using the relay, generate a separate token and place it in `ELM_ADAPTOR_TOKEN`:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Check connectivity and model availability:

```sh
npm run doctor
```

An optional live check makes two small generation requests, validates streaming and a diagnostic function-call round trip, and uses ELM quota. It executes no model-requested code:

```sh
npm run doctor -- --live
```

Each colleague needs their own key and model permissions. The default `gpt-5.3-codex` was available for the account used during development. Use `ELM_MODEL` or `--model` to select another supported model; the live probe requires Responses function calls and `reasoning.effort = low` support.

### Direct Codex configuration

```sh
node --env-file=.env src/cli.js config --out codex.example.toml
```

This creates a key-free TOML file and refuses to overwrite an existing file. Follow the separate [VS Code setup](clients/vscode/README.md) or [PyCharm setup](clients/pycharm/README.md). The PyCharm folder includes a pinned ACP launcher that loads the local `.env`; VS Code needs the process environment or provider authentication configured explicitly.

**Provider settings belong in the user-level `CODEX_HOME/config.toml`.** Current Codex ignores `model_provider` and `model_providers` in a project's `.codex/config.toml`. Do not copy the template there. [Official configuration rules](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml)

### Optional local relay

In the first terminal:

```sh
npm start
```

In a second terminal:

```sh
npm run doctor -- --proxy --live
node --env-file=.env src/cli.js config --proxy --out codex.proxy.example.toml
```

Merge the generated config as described in the client guides. The Codex process needs `ELM_ADAPTOR_TOKEN`; only the relay needs `ELM_API_KEY`. If you change `ELM_ADAPTOR_PORT`, regenerate the proxy config using the same `.env`.

For another OpenAI-compatible client, configure:

| Setting | Relay value |
|---|---|
| Base URL | `http://127.0.0.1:8787/v1` |
| API key | Your `ELM_ADAPTOR_TOKEN` |
| Model | A model enabled for your ELM account |
| Protocol | Responses or Chat Completions, according to client and model support |

No OpenAI key or ChatGPT subscription is used for ELM model requests. A particular IDE integration may impose its own authentication requirements. This project does not bypass those requirements.

## Supported routes and boundaries

| Local route | Upstream route | Behaviour |
|---|---|---|
| `GET /v1/models` | `GET /api/v1/models` | Model discovery |
| `GET /v1/models/{id}` | `GET /api/v1/models/{id}` | Simple model IDs only; use list discovery for IDs containing slashes |
| `POST /v1/responses` | `POST /api/v1/responses` | JSON/SSE byte-preserving relay |
| `POST /v1/chat/completions` | `POST /api/v1/chat/completions` | JSON/SSE byte-preserving relay |
| `POST /v1/responses/compact` | `POST /api/v1/responses/compact` | Pass-through only; upstream support is not established |

- Binds only to `127.0.0.1`, authenticates every route, and rejects browser-origin requests. It is a single-user local service, not a public or multi-tenant gateway.
- Keeps the upstream host fixed to ELM. Client headers other than `Accept` are not forwarded; the relay sets upstream authentication itself. Redirects are rejected.
- Limits request bodies to 10 MiB. Response streaming uses backpressure; client disconnects cancel upstream requests. Upstream socket inactivity timeout is five minutes.
- Logs method, route and status only, not keys, prompts or responses. Raw upstream responses still go to the authenticated client.
- Does not automatically retry generation requests. Errors and `Retry-After` are preserved.
- No WebSocket, Anthropic Messages, file upload or Responses-to-Chat-Completions conversion. ELM's local Qwen/Llama models are not assumed to support Responses.
- A local token separates credentials; it is not a security boundary against other processes running as your own user.

## Verification status

See [the dated verification report](docs/VERIFICATION-2026-09-10.md) and [troubleshooting](docs/VERIFY.md). Live API streaming and diagnostic function-call round trips passed in direct and relay modes. The actual VS Code read/edit/test workflow and model switching passed in relay mode; PyCharm UI and long-session compaction remain unverified.

### First tester checklist

1. Set your own key in the local `.env` and run `npm run doctor`. It prints available model IDs; a listed model is not automatically compatible with Codex tools.
2. Optionally run `npm run doctor -- --live` to check streaming and a diagnostic function call. This uses ELM quota.
3. Follow exactly one IDE guide: [VS Code](clients/vscode/README.md) or [PyCharm](clients/pycharm/README.md).
4. Verify the active provider and request route, then read a harmless file and make a small edit in a disposable project. Record these as separate results.
5. Report versions, selected model, direct/relay mode, and the first failing step using [the contribution guide](CONTRIBUTING.md). Never include your key or raw session logs.

## Development

```sh
npm run check
npm test
```

Tests use a local fake upstream, require no key and make no ELM requests. GitHub Actions runs them on Windows and Linux with Node.js 22 and 24. Do not add API keys, `.env` files, raw session transcripts or personal IDE settings to commits.

## Design and next steps

The first release centralises ELM routing and credential handling in a small HTTP module. Configuration generation and diagnostics live in the CLI. A full protocol conversion gateway was considered, but is unnecessary for ELM's existing Responses endpoint and would need independent validation for tool semantics, reasoning items and compaction.

Future work should start from reproducible client failures: PyCharm UI testing, broader model-specific compatibility tests and longer sessions. Implement protocol mappings only when a verified failure requires them. Reports should include client versions and redacted errors; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [ELM Proxy API](https://elm.edina.ac.uk/elm/help/proxy-api)
- [OpenAI Codex provider configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
- [OpenAI Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [JetBrains custom ACP agents](https://www.jetbrains.com/help/ai-assistant/acp.html)
- [Maintained Codex ACP adapter](https://github.com/agentclientprotocol/codex-acp)

Licensed under [MIT](LICENSE).
