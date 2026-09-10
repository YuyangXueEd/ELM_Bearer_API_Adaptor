# Pilot readiness review — 10 September 2026

## Decision

Ready for a technical pilot of diagnostics, the loopback relay and the PyCharm ACP transport. Not ready to advertise as a fully verified VS Code/PyCharm coding-agent installation. Both IDEs still need an end-to-end file-read, edit and test workflow through ELM.

## Findings and changes

| Priority | Finding | Resolution |
|---|---|---|
| High | VS Code's tested conversation used OpenAI while a project-level ELM config existed. Current Codex ignores provider keys at project scope. | Guides and generated templates now require user-level configuration. This corrects setup instructions; UI routing through ELM still needs verification. |
| Medium | The ACP launcher silently ignored unknown arguments; a typo such as `--proyx` selected direct access. | Strict argument parsing now fails before starting the adapter. Regression tested. |
| Medium | ACP accepted placeholder credentials, short/shared local tokens, and ports rejected by the relay. | Validate these before adapter startup; regression tests cover invalid settings without ELM requests. |
| Medium | Diagnostics said they listed models but printed only a count and the selected ID. | Print available IDs and validate the discovery response shape. Regression tested with a mocked fetch. |
| Medium | A successful API reply could be mistaken for complete IDE readiness. | README now leads with a readiness matrix, distinct test stages and unverified features. |
| Low | Direct config generation in the README did not load the `.env` model selection. | The documented command now loads `.env` explicitly. |
| Low | ACP smoke checking accepted any response ending with the marker, and malformed protocol errors could expose raw text. | Require the exact reply after the known metadata warning; use a generic protocol-parse error. |
| Low | CI did not check installation of the optional ACP package/bundled Codex binary. | Added locked installation and a binary version check on Windows/Linux and Node 22/24; updated GitHub Actions to v6. |

## Review coverage and evidence

- Read all application source, CLI paths, ACP launcher/smoke client, offline tests, dependency manifest/lockfile, IDE templates and setup/troubleshooting guides.
- Checked relay authentication, fixed production upstream, header isolation, redirects, bounded request buffering, streaming, cancellation and error propagation. No protocol translation is introduced.
- Exported the staged files into a clean local directory without `.env` or `node_modules`, installed the pinned ACP dependencies, and passed syntax checks and all 11 offline tests.
- From that clean copy, ELM diagnostics passed model discovery and the streaming diagnostic function-call round trip in direct and relay modes; ACP initialization, session creation and the requested text reply also passed in both modes.
- `npm audit --prefix clients/pycharm --omit=dev` reported zero known vulnerabilities at review time. This is a registry advisory check, not a complete security audit.
- Secrets and generated authentication/session data remain outside the committed files. Live checks use a developer's local credential and consume quota; CI has no ELM key.

## Remaining acceptance criteria

1. VS Code: apply user-level ELM settings, restart, create a new conversation, and confirm ELM session metadata plus matching relay traffic. Then read/edit a disposable file and run its test.
2. PyCharm: register the provided custom ACP entry and repeat the same workflow inside the actual AI Chat UI. Transport success alone does not verify that UI.
3. Model switching: validate selection in each IDE while keeping ELM routing. An ELM catalog generator is not included; do not promise that every ELM model appears or supports Codex tools.
4. Longer sessions: verify compaction support before advertising long-running use. `/responses/compact` remains pass-through with upstream support unconfirmed.

The [verification report](VERIFICATION-2026-09-10.md) retains the earlier observed failures. The [tester checklist](../README.md#first-tester-checklist) is the supported entry point for colleagues.
