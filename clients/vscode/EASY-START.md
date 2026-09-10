# Easy start: ELM in VS Code on Windows

Use a small setup window instead of editing configuration files. This launcher connects directly to ELM, so **you do not need Node.js, Git, a terminal command, or a running relay**.

## First time

1. Install [VS Code](https://code.visualstudio.com/) if you do not already have it. Standard Windows user and system installations are supported.
2. [Download this project as a ZIP](https://github.com/YuyangXueEd/ELM_Bearer_API_Adaptor/archive/refs/heads/main.zip). Right-click it and choose **Extract All**. Keep the extracted folder together; do not run the launcher from inside the ZIP.
3. Double-click **Start ELM.cmd** in the extracted folder. A small console window may remain behind the setup dialog; you do not need to type commands into it.
4. Paste your own ELM API key into the masked field. Optionally tick **Remember key on this Windows account (encrypted)**.
5. Click **Browse** and choose a project folder. Use a disposable project for your first try.
6. Click **Load models**. This fetches the full model list available to your key from ELM, rather than a fixed list of two models. Choose your starting model. **GPT-5.5** is selected when available; GPT-5.5 and GPT-5.2 have passed our earlier VS Code UI tests.
7. Click **Open ELM in VS Code**. In that window, open the official OpenAI Codex extension. If it is missing, install **Codex** by **OpenAI** from VS Code's Extensions view. Complete Codex's Windows sandbox setup and start a new conversation.

The model list describes account access, not coding compatibility. Some ELM models do not support the Responses API or Codex tools and will fail even though ELM lists them. The launcher's connection check uses model discovery; it does not make a generation request or establish tool compatibility. See the [compatibility report](../../docs/VERIFICATION-2026-09-10.md).

## Next time

Close the ELM VS Code window before starting again, double-click **Start ELM.cmd**, load models and click **Open ELM in VS Code**. A remembered key and the last project folder are restored. Your normal VS Code windows can remain open.

The selected starting model is applied at launch. Supported entries can also be switched using [Codex's own model menu](README.md#choosing-models). The launcher fetches the full ELM list; the plugin's own picker still uses its own catalog and may show different entries.

## What it changes

The launcher uses a separate profile under **%LOCALAPPDATA%\ELM-Coding**:

| File or folder | Purpose |
|---|---|
| `codex/config.toml` | ELM provider and selected model; contains no key. Existing sandbox settings are preserved. |
| `vscode/` | Separate VS Code settings and session data |
| `launcher.json` | Last project folder |
| `key.dpapi` | Optional saved key encrypted using Windows DPAPI for the current account |

Your normal Codex configuration is not overwritten. The ELM key is passed only to the child VS Code process's environment, not written into TOML or command-line arguments. DPAPI protects the saved file; other processes running as your own Windows account can still access your credentials. ELM receives the requests and content you send through Codex.

Click **Forget saved key** to remove the saved credential. Close running ELM VS Code windows to clear their inherited copy. To return to your usual setup, close the ELM window and open VS Code normally.

## If setup does not work

| What you see | What to do |
|---|---|
| PowerShell reports that scripts are blocked | Check the downloaded ZIP's Properties for **Unblock** before extracting, if available and permitted by your organisation. For a managed policy restriction, ask IT; the launcher does not change execution policy. The [manual guide](README.md) remains available. |
| VS Code cannot be found | Install the standard Windows version. Portable or custom installations currently need the manual guide. |
| ELM connection failed | Check your key and network connection. No provider configuration is changed when model discovery fails. |
| Model unavailable | Reload the list with your current key and choose again. |
| Close the ELM window first | Exit the separate ELM VS Code window before changing the key or starting model. This prevents reuse of a process with stale credentials. |
| Windows sandbox setup did not finish | Follow Codex's setup prompt. The previous UI test succeeded with **Continue without administrator access**. |
| Model replies fail or tools do not work | Try a model with verified Codex support and consult [troubleshooting](../../docs/VERIFY.md). |

This is a guided Windows launcher, not a bundled VS Code installer. PyCharm and other operating systems use the separate manual guides.

## Developer check

On Windows, run `powershell -NoProfile -File clients/vscode/start-elm.ps1 -SelfTest`. It uses temporary files and fake credentials to check preference preservation, provider isolation, argument quoting, DPAPI storage and model-list validation. It makes no ELM requests and does not start VS Code.
