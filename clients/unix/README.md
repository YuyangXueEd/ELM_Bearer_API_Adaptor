# Easy start on macOS and Linux

This browser-assisted launcher opens a separate VS Code window connected directly to ELM. No relay, npm install, or global Codex CLI is needed.

**Experimental:** native macOS/Linux Codex editing and model switching still need verification. See the [PyCharm guide](../pycharm/README.md) for that setup.

## Before you start

- Install [Node.js 22 or newer](https://nodejs.org/en/download) and [Visual Studio Code](https://code.visualstudio.com/download).
- Have an ELM API key and an existing project folder ready.
- Use a local desktop with a browser. Headless servers, SSH and remote containers are unsupported. For WSL, use the [Remote-WSL guide](../wsl/README.md).
- Download and extract the **[latest source ZIP](https://github.com/YuyangXueEd/ELM_Bearer_API_Adaptor/archive/refs/heads/main.zip)**. Keep the whole folder together. The older `v0.1.0-beta.1` release ZIP predates this launcher.

## macOS

1. Put Visual Studio Code in `/Applications` or `~/Applications`.
2. Double-click **Start ELM.command** in the extracted project folder.
3. If the ZIP did not preserve executable permissions, open Terminal, type `sh `, drag **start-elm.sh** into Terminal, then press Enter. This also works without changing executable permissions.
4. If the setup page does not open, copy the link printed in Terminal into your browser.

The launcher is not a signed or notarized application; review the source if macOS displays a security prompt.

## Linux

Open a terminal in the extracted project folder and run:

```sh
sh ./start-elm.sh
```

The launcher uses `xdg-open`; if unavailable, open its printed link manually. The `code` command must be in `PATH` (`/usr/bin/code` and `/snap/bin/code` are detected; Flatpak is not).

## In the setup page

1. Paste your ELM API key and click **Load models**.
2. Choose a starting model. The list includes all account models, not only coding models. `gpt-5.5` is preferred, then `gpt-5.2`; verify other models before use.
3. Paste the absolute path to your project folder, for example `/Users/alex/Projects/demo` or `/home/alex/Projects/demo`.
4. Click **Open ELM in VS Code**.
5. Install the official **Codex extension by OpenAI** if needed and complete its first-run setup. Trust only projects you trust.
6. When finished with setup, close the browser tab and press **Ctrl+C** in the setup terminal. The VS Code window can remain open.

After launch, test Codex by asking it to read a harmless file, make a small edit, and run the project's tests. Windows test notes are in the [verification guide](../../docs/VERIFICATION-2026-09-10.md).

## Model changes and settings

To change the starting model, close **all ELM VS Code windows**, rerun setup, and choose another model. Normal VS Code windows may stay open. Existing sandbox settings in the ELM configuration are preserved.

The launcher's ELM catalog is separate from the Codex picker. Native Unix model switching is unverified.

## WSL Ubuntu: what works today

The tested WSL workflow supports ELM model discovery, streaming tool calls, file edits, tests, and GPT-5.5/5.2 switching. Follow the [Remote-WSL guide](../wsl/README.md) for setup.

For WSL, use **Start ELM.cmd** for Windows projects or the manual Remote-WSL guide for Linux projects. This launcher does not handle the Windows-to-WSL handoff.

WSL requires Linux Node.js; Windows Node.js on its inherited `PATH` is not a replacement. Native Linux VS Code under WSLg and native macOS/Linux desktops remain unverified.

Settings live in:

| Platform | Isolated settings folder |
|---|---|
| macOS | `~/Library/Application Support/ELM-Coding` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/elm-coding` |

Within that folder, `codex/config.toml` contains provider/model settings and `vscode/` contains the separate VS Code user data. Your usual Codex configuration is not edited. If the ELM provider configuration has been customized incompatibly, setup asks you to back up and remove that file instead of overwriting it.

API keys are kept in memory and passed only through the VS Code child environment, never command-line arguments or the saved configuration. There is no “remember key” feature on macOS/Linux yet. Processes running as your user may be able to inspect process environments; use only a trusted machine. The browser interface binds to `127.0.0.1`, uses a random session token, and rejects cross-origin requests.
