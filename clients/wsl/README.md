# VS Code + Codex in Ubuntu WSL2

**Verified:** Remote-WSL Codex used ELM to read and edit files, run tests, and switch from GPT-5.5 to GPT-5.2.

This manual setup is separate from the Windows and native Linux launchers. `start-elm.sh` does not configure the Windows-to-WSL handoff.

## Required installations

- Windows VS Code and Ubuntu WSL2.
- **WSL by Microsoft**, extension ID `ms-vscode-remote.remote-wsl`, installed in Windows VS Code.
- **Codex by OpenAI**, extension ID `openai.chatgpt`, installed **in WSL: Ubuntu** through the Extensions panel after opening a WSL window. A Windows-only installation does not install the Linux extension.
- Linux Node.js 22+ if you use this repository's configuration generator or diagnostics. The Codex extension itself includes its engine.

## Configure a separate Codex home

In an Ubuntu terminal, from this repository's folder, run:

```sh
mkdir -p "$HOME/.config/elm-coding/codex"
node src/cli.js config --model gpt-5.5 --out "$HOME/.config/elm-coding/codex/config.toml"
```

The generated configuration uses ELM's Responses endpoint and contains no key. Keep it in this dedicated user-level Codex home, not the project's `.codex` folder. The generator will not overwrite an existing file.

## Launch Windows VS Code with the Linux environment

Use a fresh WSL VS Code server; an existing server may retain an earlier environment. Save your work and close other Ubuntu VS Code windows first. If needed, `wsl --terminate Ubuntu` stops the entire distribution.

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

`WSLENV` passes both variables to Linux. `CODEX_HOME` is a Linux path; do not add the `/p` path-conversion flag. The key stays in the process environment. No persistent key storage or shell startup changes are needed.

## Verify in the IDE

1. Confirm the bottom-left status says **WSL: Ubuntu** and your files are under a Linux path.
2. Install Codex **in WSL: Ubuntu** if it is not already installed, then open the Codex panel.
3. Complete first-run prompts and trust only projects you trust.
4. Start a new conversation with GPT-5.5. Ask it to read a harmless file, make a small edit, and run your project's tests.
5. For a model-switch check, open the model/effort menu, choose **Select model → 5.2**, and ask it to run the tests again. The plugin may warn about switching mid-conversation; the tested follow-up succeeded.
6. To confirm routing, inspect `$CODEX_HOME/sessions` for `source: vscode`, `model_provider: elm`, and the selected model. Review the file changes and command output too.

The plugin picker is not synced with your ELM account. GPT-5.5 and GPT-5.2 were verified in this workflow. See the [test notes](../../docs/VERIFICATION-2026-09-10.md#remote-wsl-ide-verification).
