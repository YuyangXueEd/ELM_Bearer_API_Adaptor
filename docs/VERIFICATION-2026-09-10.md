# Verification report: 10 September 2026

This is a development snapshot for one Windows machine and one ELM account, not a guarantee for every model or institution.

## Passed

- Guided Windows launcher: the user confirmed that the setup dialog was visible. Its shared model-discovery function fetched 54 model IDs from the test account; shared configuration/startup functions generated a key-free direct-ELM config and opened a separate VS Code window. Automated checks passed for model-list validation, preservation of sandbox settings, rejection of foreign provider configs, argument quoting, credential isolation and Windows DPAPI round trips. This does not extend the earlier relay UI test into a completed direct-mode coding workflow.
- Actual VS Code UI: version 1.137.0, `openai.chatgpt` 26.903.71938, bundled Codex 0.153.4, on Windows with a dedicated `CODEX_HOME` and VS Code user-data directory. The UI's official non-administrator sandbox setup completed and saved `sandbox = "unelevated"`; normal approval controls stayed enabled.
- UI routing: the new conversation recorded `source = vscode`, `model_provider = elm`, initially `model = gpt-5.5`. With other relay clients idle, each UI task generated successful `POST /v1/responses` traffic through the relay whose upstream is fixed to ELM. No ChatGPT sign-in was needed in this isolated profile for the configured provider.
- UI file read: GPT-5.5 read `README.md` and `add.py` with successful tool outputs, reported the verification word `ELM_FILE_READ_OK` (not supplied in the prompt), and identified that `add(2, 3)` returned -1. It made no edits in that turn.
- UI editing and test execution: GPT-5.5 changed `return a - b` to `return a + b`, created `test_add.py` using standard-library `unittest`, and ran `python -m unittest -v`. The actual tool output recorded exit code 0 and 3 passing tests covering positive numbers, negative numbers and zero. Independent disk inspection confirmed both files.
- UI model switching: the model/effort menu switched the same conversation from GPT-5.5 to GPT-5.2 without manually editing configuration. The next turn recorded `gpt-5.2`, while the conversation provider remained `elm`; new relay requests returned HTTP 200. GPT-5.2 reran the same tests successfully, with an actual exit-code-0 tool result and `ELM_MODEL_SWITCH_OK` in its reply.
- Node.js v24.19.0: JavaScript syntax checks and the offline test suite.
- ELM `/models`: successful authenticated discovery; gpt-5.3-codex was available.
- `doctor --live`: direct Responses SSE, a diagnostic function call, supplied function result and final OK reply.
- `doctor --proxy --live`: the same round trip through the authenticated local relay.
- Actual Codex clients, including the binary bundled with VS Code extension `openai.chatgpt` version `26.903.71938`, completed model response streams through the relay. An automated assertion confirmed that the bundled engine returned exactly `ELM_ADAPTOR_OK` for a no-tool prompt.
- PyCharm ACP transport: `@agentclientprotocol/codex-acp` 1.11.0 with Codex 0.153.4 passed initialization, API-key authentication, session creation and a streamed `ELM_ACP_OK` reply in direct and relay modes. The relay recorded HTTP 200 for the ACP request. Reproduce with `node clients/pycharm/smoke.mjs` (add `--proxy` for relay mode). The test supplies no ACP client filesystem/terminal tools, requests a text-only reply, and does not launch PyCharm or verify Codex's own tools.

The offline suite checks authentication, client-header isolation, exact body forwarding, incremental SSE, upstream error/status forwarding, redirects, timeouts, disconnect cancellation, request limits and non-destructive key-free configuration generation.

## Earlier failures and their resolution

- Earlier command-line attempts received responses but local command execution was rejected. The subsequent actual UI test, after sandbox initialization, completed file reads, patches and command execution. The API relay itself was not changed to resolve sandbox setup.
- An earlier panel conversation returned `ELM_VSCODE_UI_OK`, but its metadata showed `source = vscode`, `model_provider = openai`, and `model = gpt-6-astra`. A follow-up at 11:51 UTC returned `ELM_ROUTE_CHECK_0910` while the ELM relay received zero requests. Project-level provider configuration had been ignored. The successful test used user-level settings in a dedicated `CODEX_HOME`, a fresh isolated VS Code process and a new conversation. It does not retroactively make the earlier conversation an ELM test.

## Remaining limits

- **Model metadata:** the tested Codex build warned that gpt-5.3-codex metadata was missing and used fallback metadata. The model itself was available through ELM. Client model-catalog compatibility needs further investigation.
- The built-in VS Code picker was not populated from ELM model discovery. It included entries unavailable to the tested account. Only GPT-5.5 and GPT-5.2 were UI-tested; an ELM-specific catalog is not shipped.
- The actual VS Code UI workflow used relay mode. Direct API/CLI checks passed independently; a direct-mode UI workflow was not repeated.
- PyCharm UI is deferred because PyCharm is not installed on this machine. ACP authentication and transport were tested separately as described above.
- `/responses/compact`, WebSockets, image workflows, all tool types and locally hosted models have not been validated.

Tests used ignored `.env` and `.local` files with a dedicated Codex configuration directory. No credentials or raw session transcripts are included in this repository. Existing user Codex provider configuration was not overwritten.
