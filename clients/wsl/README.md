# VS Code + Codex in Ubuntu WSL2

**Verified on 10 September 2026:** Windows VS Code connected to Ubuntu through Microsoft's WSL extension, with the Linux Codex extension running on the remote side. ELM GPT-5.5 read files, fixed a Python bug, and ran three passing tests. Switching the same conversation to GPT-5.2 in the plugin preserved ELM routing and ran the tests again.

This is a **manual setup**, separate from the Windows and native Linux guided launchers. The existing `start-elm.sh` intentionally rejects Windows-mounted VS Code executables; it does not set up this environment handoff.

## Required installations

- Windows VS Code and Ubuntu WSL2.
- **WSL by Microsoft**, extension ID `ms-vscode-remote.remote-wsl`, installed in Windows VS Code.
- **Codex by OpenAI**, extension ID `openai.chatgpt`, installed **in WSL: Ubuntu** through the Extensions panel after opening a WSL window. A Windows-only installation does not install the Linux extension.
- Linux Node.js 22+ if you use this repository's configuration generator or diagnostics. The Codex extension itself includes its engine.

Tested versions: VS Code 1.137.0, WSL extension 0.104.3, Codex extension 26.903.71938 (Linux x64), Codex engine 0.153.4, Ubuntu 24.04.4 LTS under WSL2.

## Configure a separate Codex home

In an Ubuntu terminal, from this repository's folder, run:

```sh
mkdir -p "$HOME/.config/elm-coding/codex"
node src/cli.js config --model gpt-5.5 --out "$HOME/.config/elm-coding/codex/config.toml"
```

The generator refuses to overwrite an existing file. The generated file uses ELM's direct Responses endpoint and references `ELM_API_KEY`; it contains no key. Keep provider settings in this dedicated user-level configuration, not in the project's `.codex` folder.

## Launch Windows VS Code with the Linux environment

Start with a fresh WSL VS Code server. An existing server can retain the environment from an earlier launch, even if you open another window. Save your work and close other Ubuntu VS Code windows before initial setup. If a stale server remains, you can restart Ubuntu with `wsl --terminate Ubuntu` from PowerShell **after saving and stopping all Ubuntu work**; that command stops every process in the distribution. We did not need to terminate Ubuntu for the fresh-server test.

Open a fresh **Windows PowerShell** window. Replace the two `/home/<linux-user>/...` paths below with your actual Linux paths, and adjust the VS Code executable path if you installed it elsewhere:

```powershell
$elmSecureKey = Read-Host 'ELM API key' -AsSecureString
$env:ELM_API_KEY = [Net.NetworkCredential]::new('', $elmSecureKey).Password
$env:CODEX_HOME = '/home/<linux-user>/.config/elm-coding/codex'
$env:WSLENV = (@($env:WSLENV, 'ELM_API_KEY/u', 'CODEX_HOME/u') | Where-Object { $_ }) -join ':'

& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" `
  --user-data-dir "$env:LOCALAPPDATA\ELM-WSL-Coding\vscode" `
  --new-window `
  --folder-uri 'vscode-remote://wsl+Ubuntu/home/<linux-user>/Projects/my-project'
```

`WSLENV` explicitly passes the two variables from Windows to Linux. `CODEX_HOME` is already a Linux path, so it must **not** use the path-conversion `/p` flag. The key is passed through the process environment, not a command-line argument or configuration file. Close the PowerShell window after VS Code has connected. No persistent key storage or shell startup changes are required.

The test used this handoff with a fresh server and confirmed that the Linux server and extension host received the intended Codex home and key. Reusing a server launched with another account/key, multiple simultaneous ELM accounts in one Ubuntu server, reconnects after server restarts, and automatic recovery are not verified. An isolated Windows user-data directory alone does not isolate the shared Linux VS Code server.

## Verify in the IDE

1. Confirm the bottom-left status says **WSL: Ubuntu** and your files are under a Linux path.
2. Install Codex **in WSL: Ubuntu** if it is not already installed, then open the Codex panel.
3. Complete normal first-run prompts and grant workspace trust only to a project you trust. We used a disposable fixture and the normal `workspace-write` sandbox; no sandbox bypass was required.
4. Start a new conversation with GPT-5.5. Ask it to read a harmless file, make a small edit, and run your project's tests.
5. For a model-switch check, open the model/effort menu, choose **Select model → 5.2**, and ask it to run the tests again. The plugin may warn about switching mid-conversation; the tested follow-up succeeded.
6. Inspect the Linux session records under `$CODEX_HOME/sessions`: the conversation should record `source: vscode` and `model_provider: elm`, with each turn's selected model. Also check the actual file changes and command outputs. The model's own claim about its provider is not sufficient evidence.

The plugin's model picker is not an ELM account catalog. It may show models your account cannot access. Only GPT-5.5 and GPT-5.2 were verified in this Remote-WSL workflow. See the [test evidence](../../docs/VERIFICATION-2026-09-10.md#remote-wsl-ide-verification).
