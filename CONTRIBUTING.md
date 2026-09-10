# Contributing

Use Node.js 22 or newer. Run `npm run check` and `npm test` before opening a pull request. Offline tests must not use ELM credentials. Run `doctor --live` only deliberately with your own account; it consumes quota.

Keep documentation, code comments and public reports in English. Describe whether your client uses Responses, Chat Completions or another protocol. Include the client/extension version, model, direct versus relay mode, HTTP status and a minimal redacted example.

Never attach API keys, Authorization headers, `.env`, auth.json, personal project files or complete agent session logs. The `.local` directory is ignored for local tests and generated client profiles.

Preserve these contracts when changing the relay:

- ELM credentials go only to the configured upstream; the production CLI fixes that upstream to ELM.
- Local authentication remains required and the listener remains loopback-only.
- Streams arrive incrementally and retain their original event bytes, tool call IDs and completion/error semantics.
- Client disconnects stop upstream work. Do not retry generation without explicit user intent.
- Unsupported upstream capabilities remain visible failures.

Add a focused offline regression test for a bug. Protocol translation requires real compatibility tests; do not claim support based only on an HTTP 200 response.
