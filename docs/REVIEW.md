# Pilot readiness review — 10 September 2026

## Decision

Ready for a technical pilot. VS Code's actual graphical panel now has a verified ELM file-read, edit and test workflow plus model switching on the documented Windows setup. Diagnostics, the relay and PyCharm ACP transport have separate passing checks. PyCharm UI, a broad model catalog and long-session compaction remain unverified.

## Findings and changes

| Priority | Finding | Resolution |
|---|---|---|
| High | VS Code's tested conversation used OpenAI while a project-level ELM config existed. Current Codex ignores provider keys at project scope. | Guides and templates require user-level configuration. A dedicated CODEX_HOME and isolated VS Code process now passed UI routing, file reads, editing and test execution through ELM. |
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

1. PyCharm: register the custom ACP entry and repeat the workflow inside the actual AI Chat UI once PyCharm is available. Testing is currently deferred because it is not installed; transport success alone does not verify that UI.
2. Broader compatibility: VS Code switching from GPT-5.5 to GPT-5.2 passed while retaining ELM routing and working tools. Other models and PyCharm switching need separate tests. No ELM catalog generator is included.
3. Longer sessions: verify compaction support before advertising long-running use. `/responses/compact` remains pass-through with upstream support unconfirmed.

The [verification report](VERIFICATION-2026-09-10.md) retains the earlier observed failures. The [tester checklist](../README.md#first-tester-checklist) is the supported entry point for colleagues.
