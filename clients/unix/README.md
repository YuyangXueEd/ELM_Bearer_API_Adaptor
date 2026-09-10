# Easy start on macOS and Linux

This browser-assisted launcher configures a separate **ELM VS Code window**. It uses the ELM API directly; no relay, npm install, or global Codex CLI is required.

**Experimental:** automated checks cover configuration, request protection, and process arguments. Native macOS/Linux Codex editing and model switching still need tester verification. The Windows results do not establish native Unix compatibility. PyCharm has its own [setup instructions](../pycharm/README.md).

## Before you start

- Install [Node.js 22 or newer](https://nodejs.org/en/download) and [Visual Studio Code](https://code.visualstudio.com/download).
- Have an ELM API key and an existing project folder ready.
- Use a local graphical desktop with a browser. Headless servers, SSH sessions, and remote containers are outside this launcher's tested scope. A separate [Remote-WSL configuration](../wsl/README.md) has passed IDE tests; this Linux launcher does not configure the Windows bridge.
- Download and extract the **[latest source ZIP](https://github.com/YuyangXueEd/ELM_Bearer_API_Adaptor/archive/refs/heads/main.zip)**. Keep the whole folder together. The older `v0.1.0-beta.1` release ZIP predates this launcher.

## macOS

1. Put Visual Studio Code in `/Applications` or `~/Applications`.
2. Double-click **Start ELM.command** in the extracted project folder.
3. If the ZIP did not preserve executable permissions, open Terminal, type `sh `, drag **start-elm.sh** into Terminal, then press Enter. This also works without changing executable permissions.
4. A local setup page opens in your browser. If it does not, copy the link printed in Terminal into your browser.

If macOS displays a security prompt, inspect the downloaded source and follow your organization's normal approval process. The launcher is source code, not a signed or notarized application.

## Linux

Open a terminal in the extracted project folder and run:

```sh
sh ./start-elm.sh
```

The launcher opens your default browser using `xdg-open`. If your desktop does not provide it, open the printed link manually. The `code` command must be available in `PATH`; standard `/usr/bin/code` and `/snap/bin/code` installations are also detected. Flatpak installations are not currently detected.

## In the setup page

1. Paste your ELM API key and click **Load models**.
2. Choose your starting model. The complete account list is shown, including non-coding models. `gpt-5.5` is preferred when available, then `gpt-5.2`; otherwise choose explicitly. Listing a model does **not** prove Responses API, streaming, or tool compatibility.
3. Paste the absolute path to your project folder, for example `/Users/alex/Projects/demo` or `/home/alex/Projects/demo`.
4. Click **Open ELM in VS Code**.
5. In VS Code, install the official **Codex extension by OpenAI** if needed, open Codex, and complete its normal first-run permission/setup prompts. Approve project trust only for projects you trust. The launcher does not install these prerequisites or bypass security prompts.
6. When finished with setup, close the browser tab and press **Ctrl+C** in the setup terminal. The VS Code window can remain open.

The status message confirms that a launch was requested, not that Codex has completed a working tool call. For a first test, ask Codex to read a harmless file, make a small reversible edit, and run the project's tests. See the [verification guide](../../docs/VERIFICATION-2026-09-10.md) for the evidence used on Windows.

## Model changes and settings

To change the starting model, close **all ELM VS Code windows**, rerun setup, and choose another model. Normal VS Code windows may stay open. Existing sandbox settings in the ELM configuration are preserved.

The launcher's full ELM list is separate from the Codex extension's model picker. The extension does not automatically import the full ELM catalog. Native Unix model switching has not yet been verified.

## WSL Ubuntu: what works today

On Ubuntu 24.04 under WSL2, we verified the shell entry point, browser page (opened from Windows), all 14 automated tests, ELM model discovery, and a streaming tool-call round trip. Linux Codex CLI 0.153.4 with GPT-5.5 also read a file, corrected a small Python bug, and ran three passing tests under the `workspace-write` sandbox.

We subsequently installed Remote-WSL and the Linux Codex extension and verified the **actual VS Code Remote-WSL workflow**: GPT-5.5 read files, fixed the bug, and ran three passing tests; switching to GPT-5.2 inside the same plugin conversation preserved ELM routing and reran the tests successfully. See the [separate WSL guide](../wsl/README.md) for the tested environment handoff.

WSL often finds a Windows `code` script on its inherited PATH. This Linux launcher still skips Windows-mounted executables because it does not implement that handoff. Use **Start ELM.cmd from Windows** for Windows projects, or follow the manual Remote-WSL guide for Linux projects.

The test installation used Linux Node.js 22.23.2 in a separate user cache directory, without changing shell startup files. A Windows Node.js/npm installation on WSL's inherited PATH is not a substitute for Linux Node.js. Native Linux VS Code under WSLg and native macOS/Linux desktops remain unverified.

Settings live in:

| Platform | Isolated settings folder |
|---|---|
| macOS | `~/Library/Application Support/ELM-Coding` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/elm-coding` |

Within that folder, `codex/config.toml` contains provider/model settings and `vscode/` contains the separate VS Code user data. Your usual Codex configuration is not edited. If the ELM provider configuration has been customized incompatibly, setup asks you to back up and remove that file instead of overwriting it.

API keys are kept in memory and passed only through the VS Code child environment, never command-line arguments or the saved configuration. There is no “remember key” feature on macOS/Linux yet. Processes running as your user may be able to inspect process environments; use only a trusted machine. The browser interface binds to `127.0.0.1`, uses a random session token, and rejects cross-origin requests.
