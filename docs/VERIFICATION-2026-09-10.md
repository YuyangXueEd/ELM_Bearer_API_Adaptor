# Verification report: 10 September 2026

This is a development snapshot for one Windows machine and one ELM account, not a guarantee for every model or institution.

## Passed

- Node.js v24.19.0: JavaScript syntax checks and the offline test suite.
- ELM `/models`: successful authenticated discovery; gpt-5.3-codex was available.
- `doctor --live`: direct Responses SSE, a diagnostic function call, supplied function result and final OK reply.
- `doctor --proxy --live`: the same round trip through the authenticated local relay.
- Actual Codex clients, including the binary bundled with VS Code extension `openai.chatgpt` version `26.903.71938`, completed model response streams through the relay. An automated assertion confirmed that the bundled engine returned exactly `ELM_ADAPTOR_OK` for a no-tool prompt.
- PyCharm ACP transport: `@agentclientprotocol/codex-acp` 1.11.0 with Codex 0.153.4 passed initialization, API-key authentication, session creation and a streamed `ELM_ACP_OK` reply in direct and relay modes. The relay recorded HTTP 200 for the ACP request. Reproduce with `node clients/pycharm/smoke.mjs` (add `--proxy` for relay mode). The test grants no file tools and does not launch PyCharm.

The offline suite checks authentication, client-header isolation, exact body forwarding, incremental SSE, upstream error/status forwarding, redirects, timeouts, disconnect cancellation, request limits and non-destructive key-free configuration generation.

## Incomplete or blocked

- **Actual Codex file-read workflow:** the clients received model responses, but local shell execution was rejected by the machine's command policy. No successful file-read or editing workflow is claimed. Changing the API relay cannot resolve an independent command-execution restriction.
- **VS Code UI:** a later test accessed the user's open window, completed onboarding and received `ELM_VSCODE_UI_OK` in the Codex panel. Routing of that UI response to ELM has not been established, so this is not counted as an ELM integration pass. A project-level provider configuration alone did not establish that the panel used it.
- **Model metadata:** the tested Codex build warned that gpt-5.3-codex metadata was missing and used fallback metadata. The model itself was available through ELM. Client model-catalog compatibility needs further investigation.
- PyCharm UI has not been exercised. ACP authentication and transport were tested separately as described above.
- `/responses/compact`, WebSockets, image workflows, all tool types and locally hosted models have not been validated.

Tests used ignored `.env` and `.local` files with a dedicated Codex configuration directory. No credentials or raw session transcripts are included in this repository. Existing user Codex provider configuration was not overwritten.
