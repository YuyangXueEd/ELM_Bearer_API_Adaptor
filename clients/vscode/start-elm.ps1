param(
    [string]$StateDirectory = (Join-Path $env:LOCALAPPDATA 'ELM-Coding'),
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Security

function Protect-Key([string]$Key) {
    return [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect(
        [Text.Encoding]::UTF8.GetBytes($Key), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))
}

function Unprotect-Key([string]$Encrypted) {
    return [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect(
        [Convert]::FromBase64String($Encrypted), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))
}

function Get-ModelIds($Response) {
    $ids = @($Response.data | ForEach-Object { $_.id } | Sort-Object -Unique)
    if (!$ids.Count -or @($ids | Where-Object { $_ -isnot [string] -or $_ -notmatch '^[A-Za-z0-9_./:-]+$' }).Count) {
        throw 'ELM returned an empty or unexpected model list. Please try again later.'
    }
    return $ids
}

function Quote-Argument([string]$Value) {
    # Windows command-line escaping, including spaces and a trailing backslash.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Save-Configuration([string]$Directory, [string]$Model) {
    if ($Model -notmatch '^[A-Za-z0-9_./:-]+$') { throw 'Invalid model identifier.' }
    $configPath = Join-Path $Directory 'config.toml'
    if (Test-Path -LiteralPath $configPath) {
        $config = [IO.File]::ReadAllText($configPath)
        if ($config -notmatch '(?m)^model_provider = "elm"\r?$' -or
            $config -notmatch '(?m)^base_url = "https://elm.edina.ac.uk/api/v1"\r?$' -or
            $config -notmatch '(?m)^env_key = "ELM_API_KEY"\r?$') {
            throw 'This launcher profile contains a different provider configuration. Choose a fresh launcher profile or restore its ELM direct configuration.'
        }
        # Preserve sandbox settings and all other preferences saved by Codex.
        $config = [regex]::new('(?m)^model = "[^"\r\n]+"\r?$').Replace($config, ('model = "' + $Model + '"'), 1)
    } else {
        $config = @"
model = "$Model"
model_provider = "elm"
model_reasoning_effort = "low"

[model_providers.elm]
name = "ELM"
base_url = "https://elm.edina.ac.uk/api/v1"
env_key = "ELM_API_KEY"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
"@
    }
    [IO.Directory]::CreateDirectory($Directory) | Out-Null
    [IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))
}

function New-CodeProcess([string]$Executable, [string]$Directory, [string]$Project, [string]$Key) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.UseShellExecute = $false
    $info.Arguments = (@('--user-data-dir', (Join-Path $Directory 'vscode'), '--new-window', $Project) |
        ForEach-Object { Quote-Argument $_ }) -join ' '
    foreach ($name in @($info.EnvironmentVariables.Keys)) {
        if ($name -match '^(CODEX_|VSCODE_|ELM_)' -or $name -eq 'ELECTRON_RUN_AS_NODE') {
            $info.EnvironmentVariables.Remove($name)
        }
    }
    $info.EnvironmentVariables['CODEX_HOME'] = Join-Path $Directory 'codex'
    $info.EnvironmentVariables['ELM_API_KEY'] = $Key
    return $info
}

if ($SelfTest) {
    $testDirectory = Join-Path ([IO.Path]::GetTempPath()) ('elm-launcher-' + [guid]::NewGuid())
    Save-Configuration $testDirectory 'gpt-5.5'
    $path = Join-Path $testDirectory 'config.toml'
    [IO.File]::AppendAllText($path, "`n[windows]`nsandbox = `"unelevated`"`n")
    Save-Configuration $testDirectory 'gpt-5.2'
    $result = [IO.File]::ReadAllText($path)
    if ($result -notmatch 'model = "gpt-5.2"' -or $result -notmatch 'sandbox = "unelevated"') { throw 'Preferences were not preserved.' }
    $info = New-CodeProcess 'C:\Program Files\Code.exe' $testDirectory 'C:\Project with spaces\' 'test-secret-only'
    if ($info.Arguments.Contains('test-secret-only') -or $info.EnvironmentVariables['ELM_API_KEY'] -ne 'test-secret-only') { throw 'Credential isolation failed.' }
    if ($info.EnvironmentVariables.ContainsKey('CODEX_CONFIG') -or $info.EnvironmentVariables.ContainsKey('VSCODE_IPC_HOOK_CLI') -or $info.EnvironmentVariables.ContainsKey('ELECTRON_RUN_AS_NODE')) { throw 'Inherited client override retained.' }
    if ($info.Arguments -notmatch 'Project with spaces\\\\"$') { throw 'Argument escaping failed.' }
    if ($result.Contains('test-secret-only')) { throw 'Credential written to TOML.' }
    $encrypted = Protect-Key 'test-secret-only'
    $decoded = Unprotect-Key $encrypted
    if ($decoded -ne 'test-secret-only' -or $encrypted.Contains('test-secret-only')) { throw 'Windows key storage failed.' }
    $ids = @(Get-ModelIds @{ data = @(@{id='vendor/model:1'}, @{id='gpt-5.5'}, @{id='vendor/model:1'}) })
    if ($ids.Count -ne 2 -or 'vendor/model:1' -notin $ids) { throw 'Full model discovery failed.' }
    $rejected = $false
    try { Get-ModelIds @{ data = @(@{ id = 'bad"model' }) } } catch { $rejected = $true }
    if (!$rejected) { throw 'Unsafe model identifier accepted.' }
    [IO.File]::WriteAllText($path, 'model_provider = "openai"')
    $rejected = $false
    try { Save-Configuration $testDirectory 'gpt-5.5' } catch { $rejected = $true }
    if (!$rejected -or [IO.File]::ReadAllText($path) -ne 'model_provider = "openai"') { throw 'Foreign config was overwritten.' }
    Remove-Item -LiteralPath $path
    [IO.Directory]::Delete($testDirectory)
    Write-Output 'PASS: config preservation, provider guard, quoting, credential isolation, Windows encrypted storage and model discovery.'
    exit
}

[Windows.Forms.Application]::EnableVisualStyles()
$form = [Windows.Forms.Form]::new()
$form.Text = 'ELM Coding - VS Code'
$form.ClientSize = [Drawing.Size]::new(580, 450)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.TopMost = $true
$form.Font = [Drawing.Font]::new('Segoe UI', 10)
$form.Add_Shown({ $form.Show(); $form.Activate() })

function Add-Label([string]$Text, [int]$Top) {
    $label = [Windows.Forms.Label]::new()
    $label.Text = $Text
    $label.SetBounds(24, $Top, 532, 30)
    $form.Controls.Add($label)
}

Add-Label 'Connect your ELM account to Codex in VS Code.' 20
Add-Label 'ELM API key' 65
$keyBox = [Windows.Forms.TextBox]::new()
$keyBox.UseSystemPasswordChar = $true
$keyBox.SetBounds(24, 94, 532, 28)
$form.Controls.Add($keyBox)
$remember = [Windows.Forms.CheckBox]::new()
$remember.Text = 'Remember key on this Windows account (encrypted)'
$remember.SetBounds(24, 130, 532, 28)
$form.Controls.Add($remember)
$keyPath = Join-Path $StateDirectory 'key.dpapi'
if (Test-Path -LiteralPath $keyPath) {
    try {
        $keyBox.Text = Unprotect-Key ([IO.File]::ReadAllText($keyPath))
        $remember.Checked = $true
    } catch { $keyBox.Text = '' }
}

Add-Label 'Project folder' 170
$folderBox = [Windows.Forms.TextBox]::new()
$folderBox.SetBounds(24, 199, 424, 28)
$form.Controls.Add($folderBox)
$settingsPath = Join-Path $StateDirectory 'launcher.json'
if (Test-Path -LiteralPath $settingsPath) {
    try { $folderBox.Text = ([IO.File]::ReadAllText($settingsPath) | ConvertFrom-Json).project } catch {}
}
$browse = [Windows.Forms.Button]::new()
$browse.Text = 'Browse...'
$browse.SetBounds(460, 198, 96, 30)
$browse.Add_Click({
    $picker = [Windows.Forms.FolderBrowserDialog]::new()
    $picker.Description = 'Choose a project folder. Use a disposable project for your first test.'
    if ($picker.ShowDialog() -eq 'OK') { $folderBox.Text = $picker.SelectedPath }
    $picker.Dispose()
})
$form.Controls.Add($browse)
Add-Label 'Starting model - load the full list from your ELM account' 244
$modelBox = [Windows.Forms.ComboBox]::new()
$modelBox.DropDownStyle = 'DropDownList'
$modelBox.SetBounds(24, 274, 390, 28)
$modelBox.DropDownWidth = 520
$modelBox.MaxDropDownItems = 15
$form.Controls.Add($modelBox)
$loadModels = [Windows.Forms.Button]::new()
$loadModels.Text = 'Load models'
$loadModels.SetBounds(426, 273, 130, 30)
$form.Controls.Add($loadModels)
$status = [Windows.Forms.Label]::new()
$status.SetBounds(24, 318, 532, 60)
$status.Text = 'Uses a separate VS Code profile. No Node.js, relay or TOML editing needed. Close that profile before launching again.'
$form.Controls.Add($status)
$launch = [Windows.Forms.Button]::new()
$launch.Text = 'Open ELM in VS Code'
$launch.SetBounds(24, 392, 260, 36)
$form.Controls.Add($launch)
$form.AcceptButton = $launch
$forget = [Windows.Forms.Button]::new()
$forget.Text = 'Forget saved key'
$forget.SetBounds(306, 392, 250, 36)
$forget.Add_Click({
    if (Test-Path -LiteralPath $keyPath) { Remove-Item -LiteralPath $keyPath }
    $keyBox.Clear()
    $remember.Checked = $false
    $modelBox.Items.Clear()
    $status.Text = 'Saved key removed. Close any running ELM VS Code windows to clear their copy of the key.'
})
$form.Controls.Add($forget)

function Get-ElmModels([string]$Key) {
    if (!$Key -or $Key -match '\s' -or $Key.StartsWith('replace-')) { throw 'Enter your ELM API key first.' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        $response = Invoke-RestMethod -Uri 'https://elm.edina.ac.uk/api/v1/models' -Headers @{ Authorization = 'Bearer ' + $Key } -TimeoutSec 20 -MaximumRedirection 0
    } catch { throw 'ELM connection failed. Check your key and internet connection, then try again. No configuration was changed.' }
    return Get-ModelIds $response
}

$loadModels.Add_Click({
    $loadModels.Enabled = $false
    $launch.Enabled = $false
    $status.Text = 'Loading the models available to your ELM account...'
    [Windows.Forms.Application]::DoEvents()
    try {
        $previous = $modelBox.SelectedItem
        $ids = @(Get-ElmModels $keyBox.Text.Trim())
        $modelBox.Items.Clear()
        $modelBox.Items.AddRange([object[]]$ids)
        if ($previous -in $ids) { $modelBox.SelectedItem = $previous }
        elseif ('gpt-5.5' -in $ids) { $modelBox.SelectedItem = 'gpt-5.5' }
        else { $modelBox.SelectedIndex = 0 }
        $status.Text = "$($ids.Count) models loaded. GPT-5.5 and GPT-5.2 were UI-tested. Other models may not support Codex Responses or coding tools."
    } catch { $status.Text = $_.Exception.Message }
    finally { $loadModels.Enabled = $true; $launch.Enabled = $true }
})

$launch.Add_Click({
    $launch.Enabled = $false
    $loadModels.Enabled = $false
    try {
        $key = $keyBox.Text.Trim()
        if (!$key -or $key -match '\s' -or $key.StartsWith('replace-')) { throw 'Enter your ELM API key.' }
        if (!$modelBox.SelectedItem) { throw 'Click Load models, then choose a starting model.' }
        if (!(Test-Path -LiteralPath $folderBox.Text -PathType Container)) { throw 'Choose an existing project folder.' }
        $project = (Resolve-Path -LiteralPath $folderBox.Text).Path
        $candidates = @((Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'),
            (Join-Path $env:ProgramFiles 'Microsoft VS Code\Code.exe'))
        $code = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (!$code) { throw 'Install VS Code from https://code.visualstudio.com, then run Start ELM again. Standard user and system installations are supported.' }
        $profilePath = Join-Path $StateDirectory 'vscode'
        $running = Get-CimInstance Win32_Process -Filter "Name = 'Code.exe'" |
            Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profilePath) }
        if ($running) { throw 'Close the ELM VS Code window first, then click Open again. Your normal VS Code windows can stay open.' }
        $status.Text = 'Checking your ELM key and model availability...'
        [Windows.Forms.Application]::DoEvents()
        $ids = @(Get-ElmModels $key)
        if ($modelBox.SelectedItem -notin $ids) { throw 'This model is no longer available to this key. Click Load models and choose again.' }
        Save-Configuration (Join-Path $StateDirectory 'codex') $modelBox.SelectedItem
        $settingsDirectory = Join-Path $profilePath 'User'
        [IO.Directory]::CreateDirectory($settingsDirectory) | Out-Null
        $codeSettings = Join-Path $settingsDirectory 'settings.json'
        if (!(Test-Path -LiteralPath $codeSettings)) {
            [IO.File]::WriteAllText($codeSettings, '{"chatgpt.openOnStartup":true,"workbench.startupEditor":"none"}')
        }
        if ($remember.Checked) {
            $encrypted = Protect-Key $key
            [IO.File]::WriteAllText($keyPath, $encrypted)
        } elseif (Test-Path -LiteralPath $keyPath) { Remove-Item -LiteralPath $keyPath }
        [IO.File]::WriteAllText($settingsPath, (@{ project = $project } | ConvertTo-Json))
        $info = New-CodeProcess $code $StateDirectory $project $key
        [Diagnostics.Process]::Start($info) | Out-Null
        $status.Text = 'VS Code opened. Open Codex, install the official OpenAI Codex extension if missing, and complete its sandbox setup. Start a new chat.'
    } catch {
        # Only display our own actionable errors. Never show a raw HTTP response or key.
        $message = $_.Exception.Message
        if ($keyBox.Text) { $message = $message.Replace($keyBox.Text, '[REDACTED]') }
        if ($_.InvocationInfo.ScriptLineNumber -and $message.Length -gt 400) { $message = 'Setup could not finish. Check the selected folder and your Windows permissions.' }
        $status.Text = $message
    } finally { $launch.Enabled = $true; $loadModels.Enabled = $true }
})

[void]$form.ShowDialog()
$form.Dispose()
