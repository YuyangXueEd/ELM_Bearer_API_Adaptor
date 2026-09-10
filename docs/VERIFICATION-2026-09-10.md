# Verification report: 10 September 2026

This is a development snapshot for one Windows machine and one ELM account, not a guarantee for every model or institution.

## Passed

- Guided Windows launcher: the user confirmed that the setup dialog was visible. Its shared model-discovery function fetched 54 model IDs from the test account; shared configuration/startup functions generated a key-free direct-ELM config and opened a separate VS Code window. Automated checks passed for model-list validation, preservation of sandbox settings, rejection of foreign provider configs, argument quoting, credential isolation and Windows DPAPI round trips.
- Direct-mode UI follow-up: the launcher-created profile initially required its own sandbox setup. Administrator setup did not complete; the profile subsequently saved `sandbox = "unelevated"`. In the actual VS Code panel, GPT-5.5 read the README verification word, added a docstring to `add.py` and ran all 3 existing tests with exit code 0. The final reply included `ELM_GUIDED_SETUP_OK`. Session metadata recorded `source = vscode`, `model_provider = elm`, `model = gpt-5.5`; the active configuration used the direct ELM HTTPS endpoint. This verifies a direct-mode read/edit/test workflow in addition to the earlier relay workflow.
- Prerequisites rechecked: VS Code 1.137.0 and the installed Codex extension 26.903.71938 were detected and used. No separate global Codex CLI installation was needed for the extension test. Fresh direct `doctor --live` checks passed streaming and diagnostic tool round trips for GPT-5.5 and GPT-5.2.
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
- The actual Windows VS Code UI read/edit/test workflow passed in both relay and direct modes. Native Windows UI model switching was tested in relay mode. The later Remote-WSL test below additionally verified direct-mode GPT-5.5 to GPT-5.2 switching in the plugin.
- PyCharm UI is deferred because PyCharm is not installed on this machine. ACP authentication and transport were tested separately as described above.
- `/responses/compact`, WebSockets, image workflows, all tool types and locally hosted models have not been validated.

Tests used ignored `.env` and `.local` files with a dedicated Codex configuration directory. No credentials or raw session transcripts are included in this repository. Existing user Codex provider configuration was not overwritten.


## macOS/Linux guided launcher (source preview)

Added POSIX launch scripts and a loopback browser setup page with no new dependencies. Local Windows checks: 13 automated tests passed; browser initial state and missing-key feedback were inspected; the new model discovery function returned all 54 account models, including gpt-5.5 and gpt-5.2. Tests cover isolated configuration preservation, refusal to overwrite a foreign provider, child argument/environment handling, and HTTP token/origin/host validation. The CI matrix now includes macOS, Linux, and Windows with Node.js 22 and 24, plus POSIX shell syntax checks.

These checks do not establish native macOS/Linux VS Code routing, first-run permissions, file editing, or model switching. Those remain pending real desktop testing. The published v0.1.0-beta.1 ZIP does not include the new launchers; use the main source ZIP.


## WSL2 Ubuntu verification

Environment: Ubuntu 24.04.4 LTS, Linux 6.6.114.1-microsoft-standard-WSL2, native Linux Node.js 22.23.2, Codex CLI 0.153.4. Node was downloaded from nodejs.org and checked against the published SHA-256 checksum; runtime and fixtures were isolated under the Linux user cache, with no shell startup changes.

- All 14 automated tests and JavaScript/POSIX syntax checks passed in WSL.
- The shell launcher started the loopback setup server. The Windows browser reached it through localhost forwarding and displayed the Linux settings path. Automatic browser opening was unavailable because xdg-open was absent; the printed-link fallback worked.
- ELM discovery returned 54 models; GPT-5.5 streaming and diagnostic function round trip passed.
- A real Linux Codex CLI run read the marker WSL_ELM_READ_7391, changed subtraction to addition in a disposable Python project, and executed three passing unittest cases. An independent rerun also passed.
- Session 01a08ba5-80b8-75d1-887c-fb0b096579fc recorded provider elm, model gpt-5.5, source exec, and workspace-write sandbox with command network access disabled. This is CLI evidence, not IDE evidence.
- Found and fixed a launcher detection problem: the inherited WSL PATH resolved code to Windows VS Code. Windows-mounted executables are now skipped, with a clear error when no native Linux VS Code exists. Regression coverage was added.

At the end of that initial check, the machine had neither native Linux VS Code nor the Remote-WSL extension. The subsequent Remote-WSL installation and IDE test are recorded below. Native Linux VS Code under WSLg remains unverified.

## Remote-WSL IDE verification

Installed Microsoft WSL extension 0.104.3 in Windows VS Code and OpenAI Codex extension 26.903.71938 (Linux x64) in Ubuntu's VS Code server. The bundled Codex engine was 0.153.4. Opened an isolated Windows VS Code user-data directory against a disposable project on Ubuntu's Linux filesystem.

The dedicated CODEX_HOME was a Linux path. Windows-to-Linux environment forwarding used WSLENV entries `ELM_API_KEY/u` and `CODEX_HOME/u`. Read-only process inspection confirmed that the Linux VS Code server and extension host received the intended configuration home and a non-empty ELM key; no key values were printed. No key was saved to TOML, a shell startup file, or a command-line argument.

- VS Code displayed **WSL: Ubuntu** and the Linux project files. Workspace trust was granted only to the disposable test project.
- Through the actual Codex plugin UI, GPT-5.5 read the marker `ELM_WSL_IDE_4829`, changed `return a - b` to `return a + b`, and ran `python3 -m unittest -v`: three tests passed.
- In the same conversation, the plugin's model menu selected GPT-5.2. The UI recorded the model change, then GPT-5.2 reran the three tests successfully and read the marker again.
- Linux session `01a08bc1-3cd0-79f3-b92f-96bb8bd9de08` recorded `source = vscode`, `model_provider = elm`, and turn models `gpt-5.5` then `gpt-5.2`. Both turns used `workspace-write` with command network access disabled. No sandbox bypass was used.
- The edited file and a separate unittest rerun were independently checked and passed.

This verifies direct ELM routing, reads, edits, command execution, and plugin model switching through Remote-WSL in the tested fresh-server setup. It does not verify the native Linux guided launcher's Windows bridge: that entry still rejects Windows-mounted code commands. Existing-server environment reuse, multiple concurrent account profiles, reconnect behavior, WSLg native desktop VS Code, and native macOS/Linux desktops remain outside this result. See the [manual Remote-WSL guide](../clients/wsl/README.md).
