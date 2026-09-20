# mimocode-supermemory installer for MiMoCode (Windows)
# Browser OAuth login aligned with official opencode-supermemory.
#   powershell -File install.ps1
#   powershell -File install.ps1 -Login
#   powershell -File install.ps1 -Status
#   powershell -File install.ps1 -Uninstall
param(
  [switch]$Status,
  [switch]$Login,
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$pkgName = 'mimocode-supermemory'

function Get-Paths {
  $userRoot = $env:USERPROFILE
  if (-not $userRoot) { $userRoot = [Environment]::GetFolderPath('UserProfile') }
  [pscustomobject]@{
    Home         = $userRoot
    ConfigDir    = Join-Path $userRoot '.config\mimocode'
    ConfigFile   = Join-Path $userRoot '.config\mimocode\mimocode.jsonc'
    SmFile       = Join-Path $userRoot '.config\mimocode\supermemory.jsonc'
    CommandsDir  = Join-Path $userRoot '.config\mimocode\commands'
    SkillsDir    = Join-Path $userRoot '.config\mimocode\skills'
    CacheRoot    = Join-Path $userRoot ".cache\mimocode\packages\$pkgName@latest\node_modules"
    CredDir      = Join-Path $userRoot '.supermemory-mimocode'
    CredFile     = Join-Path $userRoot '.supermemory-mimocode\credentials.json'
  }
}

$script:SlashCommands = @(
  'supermemory-index.md',
  'supermemory-init.md',
  'supermemory-login.md',
  'supermemory-logout.md',
  'supermemory-status.md'
)
$script:SlashSkills = @(
  'supermemory-init',
  'supermemory-login',
  'supermemory-logout',
  'supermemory-status',
  'mimocode-supermemory'
)
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-TextFile([string]$path, [string]$content) {
  $dir = Split-Path -Parent $path
  if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($path, $content, $script:Utf8NoBom)
}

function Expand-TemplateTokens([string]$text, [string]$ps1Path, [string]$cliPath) {
  if ($null -eq $text) { return '' }
  return $text.Replace('{{PS1}}', $ps1Path).Replace('{{CLI}}', $cliPath).Replace('{{PKG}}', $pkgName)
}

function Copy-PackageHelpers {
  param($p, $root)
  New-Item -ItemType Directory -Path (Join-Path $p.CacheRoot 'bin') -Force | Out-Null
  $srcPs1 = Join-Path $root 'install.ps1'
  $srcCli = Join-Path $root 'bin\cli.js'
  if (Test-Path -LiteralPath $srcPs1) {
    Copy-Item -LiteralPath $srcPs1 -Destination (Join-Path $p.CacheRoot 'install.ps1') -Force
  }
  if (Test-Path -LiteralPath $srcCli) {
    Copy-Item -LiteralPath $srcCli -Destination (Join-Path $p.CacheRoot 'bin\cli.js') -Force
  }
  $srcTpl = Join-Path $root 'templates'
  $dstTpl = Join-Path $p.CacheRoot 'templates'
  if (Test-Path -LiteralPath $srcTpl) {
    New-Item -ItemType Directory -Path $dstTpl -Force | Out-Null
    Copy-Item -Path (Join-Path $srcTpl '*') -Destination $dstTpl -Recurse -Force
  }
}

function Install-SlashAssets {
  param($p, $root)
  Copy-PackageHelpers -p $p -root $root
  $ps1Path = Join-Path $p.CacheRoot 'install.ps1'
  $cliPath = Join-Path $p.CacheRoot 'bin\cli.js'
  if (-not (Test-Path -LiteralPath $ps1Path) -and (Test-Path -LiteralPath (Join-Path $root 'install.ps1'))) {
    $ps1Path = Join-Path $root 'install.ps1'
  }
  if (-not (Test-Path -LiteralPath $cliPath) -and (Test-Path -LiteralPath (Join-Path $root 'bin\cli.js'))) {
    $cliPath = Join-Path $root 'bin\cli.js'
  }

  $cmdSrc = Join-Path $root 'templates\commands'
  $cmdCount = 0
  if (Test-Path -LiteralPath $cmdSrc) {
    New-Item -ItemType Directory -Path $p.CommandsDir -Force | Out-Null
    Get-ChildItem -LiteralPath $cmdSrc -Filter '*.md' -File | ForEach-Object {
      $raw = [System.IO.File]::ReadAllText($_.FullName)
      Write-TextFile -path (Join-Path $p.CommandsDir $_.Name) -content (Expand-TemplateTokens $raw $ps1Path $cliPath)
      $cmdCount++
    }
  }

  $skSrc = Join-Path $root 'templates\skills'
  $skCount = 0
  if (Test-Path -LiteralPath $skSrc) {
    Get-ChildItem -LiteralPath $skSrc -Directory | ForEach-Object {
      $skillDir = $_.FullName
      $skillName = $_.Name
      $dest = Join-Path $p.SkillsDir $skillName
      New-Item -ItemType Directory -Path $dest -Force | Out-Null
      $md = Join-Path $skillDir 'SKILL.md'
      if (Test-Path -LiteralPath $md) {
        $raw = [System.IO.File]::ReadAllText($md)
        Write-TextFile -path (Join-Path $dest 'SKILL.md') -content (Expand-TemplateTokens $raw $ps1Path $cliPath)
      }
      $locSrc = Join-Path $skillDir 'locales'
      if (Test-Path -LiteralPath $locSrc) {
        $locDst = Join-Path $dest 'locales'
        New-Item -ItemType Directory -Path $locDst -Force | Out-Null
        Copy-Item -Path (Join-Path $locSrc '*') -Destination $locDst -Recurse -Force
      }
      $skCount++
    }
  }

  return [pscustomobject]@{ Commands = $cmdCount; Skills = $skCount; Ps1 = $ps1Path; Cli = $cliPath }
}

function Test-SlashAssets {
  param($p)
  $missingCmd = @()
  foreach ($name in $script:SlashCommands) {
    if (-not (Test-Path -LiteralPath (Join-Path $p.CommandsDir $name))) { $missingCmd += $name }
  }
  $missingSk = @()
  foreach ($name in $script:SlashSkills) {
    if (-not (Test-Path -LiteralPath (Join-Path $p.SkillsDir "$name\SKILL.md"))) { $missingSk += $name }
  }
  [pscustomobject]@{
    CommandsOk  = ($missingCmd.Count -eq 0)
    SkillsOk    = ($missingSk.Count -eq 0)
    MissingCmd  = $missingCmd
    MissingSk   = $missingSk
  }
}

function Remove-SlashAssets {
  param($p)
  foreach ($name in $script:SlashCommands) {
    $path = Join-Path $p.CommandsDir $name
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  }
  foreach ($name in $script:SlashSkills) {
    $path = Join-Path $p.SkillsDir $name
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force }
  }
}

function Read-Jsonc([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $raw = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
  if (-not $raw) { return $null }
  $stripped = [regex]::Replace($raw, '/\*[\s\S]*?\*/', '')
  $stripped = [regex]::Replace($stripped, '(?m)^\s*//.*$', '')
  try { return ($stripped | ConvertFrom-Json) } catch { return $null }
}

function Write-Json([string]$path, $obj) {
  $dir = Split-Path -Parent $path
  if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $json = $obj | ConvertTo-Json -Depth 8
  # Host JSON parsers reject UTF-8 BOM
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding $false))
}

function Get-PackageRoot {
  if ($PSScriptRoot) { return $PSScriptRoot }
  return (Get-Location).Path
}

function Install-Plugin {
  $p = Get-Paths
  $root = Get-PackageRoot
  $srcPkg = Join-Path $root 'package.json'
  $srcDist = Join-Path $root 'dist\index.js'
  if (-not (Test-Path -LiteralPath $srcPkg)) { throw "package.json not found under $root" }
  if (-not (Test-Path -LiteralPath $srcDist)) { throw "dist/index.js not found under $root" }

  # Official host installer first (best-effort)
  $mimoCmd = Get-Command mimo -ErrorAction SilentlyContinue
  $mimo = if ($mimoCmd) { $mimoCmd.Source } else { 'C:\Users\wsks\.mimocode\bin\mimo.exe' }
  if ($env:SUPERMEMORY_SKIP_MIMO_PLUGIN -eq '1') {
    Write-Host 'Skip mimo plugin file: (SUPERMEMORY_SKIP_MIMO_PLUGIN=1)'
  } elseif (Test-Path -LiteralPath $mimo) {
    Write-Host "Trying: mimo plugin file:$root (20s timeout, non-fatal)"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $job = Start-Job -ScriptBlock {
        param($mimoExe, $pluginArg)
        & $mimoExe plugin $pluginArg 2>&1
      } -ArgumentList $mimo, ("file:" + $root)
      if (Wait-Job -Job $job -Timeout 20) {
        Receive-Job -Job $job | ForEach-Object { Write-Host $_ }
      } else {
        Write-Host 'mimo plugin file: timed out after 20s (non-fatal; package-name path used)'
        Stop-Job -Job $job -ErrorAction SilentlyContinue
      }
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    } catch {
      Write-Host "mimo plugin file: failed (non-fatal): $($_.Exception.Message)"
    } finally {
      $ErrorActionPreference = $prevEap
    }
  }

  New-Item -ItemType Directory -Path $p.CacheRoot -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $p.CacheRoot 'dist') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $p.CacheRoot "$pkgName\dist") -Force | Out-Null
  Copy-Item -LiteralPath $srcPkg -Destination (Join-Path $p.CacheRoot 'package.json') -Force
  Copy-Item -LiteralPath $srcDist -Destination (Join-Path $p.CacheRoot 'dist\index.js') -Force
  Copy-Item -LiteralPath $srcPkg -Destination (Join-Path $p.CacheRoot "$pkgName\package.json") -Force
  Copy-Item -LiteralPath $srcDist -Destination (Join-Path $p.CacheRoot "$pkgName\dist\index.js") -Force

  $cfg = Read-Jsonc $p.ConfigFile
  $map = [ordered]@{}
  $map['$schema'] = 'https://mimo.xiaomi.com/mimocode/config.json'
  if ($cfg) {
    foreach ($prop in $cfg.PSObject.Properties) {
      if ($prop.Name -in @('plugin', '$schema')) { continue }
      $map[$prop.Name] = $prop.Value
    }
  }
  $list = @()
  if ($cfg -and $cfg.plugin) {
    foreach ($item in @($cfg.plugin)) {
      $n = if ($item -is [System.Array]) { $item[0] } else { $item }
      if ($n -is [string] -and $n -match 'file:|\\\\|/') { continue }
      if ($n) { $list += $n }
    }
  }
  if ($list -notcontains $pkgName) { $list += $pkgName }
  $map['plugin'] = @($list | Select-Object -Unique)
  foreach ($cfgPath in @($p.ConfigFile, (Join-Path $p.Home '.mimocode\mimocode.json'))) {
    $sub = Read-Jsonc $cfgPath
    $m2 = [ordered]@{}
    $m2['$schema'] = 'https://mimo.xiaomi.com/mimocode/config.json'
    if ($sub) {
      foreach ($prop in $sub.PSObject.Properties) {
        if ($prop.Name -in @('plugin', '$schema')) { continue }
        $m2[$prop.Name] = $prop.Value
      }
    }
    $m2['plugin'] = $map['plugin']
    Write-Json $cfgPath ([pscustomobject]$m2)
  }

  if (-not (Test-Path -LiteralPath $p.SmFile)) {
    $sample = [ordered]@{
      apiKey = ''; baseUrl = ''; autoInject = $true
      maxMemories = 5; maxProjectMemories = 10; maxProfileItems = 5; similarityThreshold = 0.6
    }
    Write-Json $p.SmFile ([pscustomobject]$sample)
  }

  $slash = Install-SlashAssets -p $p -root $root

  Write-Host 'mimocode-supermemory installed'
  Write-Host "  mimo plugin : attempted file:$root"
  Write-Host "  cache       : $($p.CacheRoot)"
  Write-Host "  config      : plugin => `"$pkgName`" (stable name + cache)"
  Write-Host "  memory      : $($p.SmFile)"
  Write-Host "  commands    : $($slash.Commands) files -> $($p.CommandsDir)"
  Write-Host "  skills      : $($slash.Skills) dirs -> $($p.SkillsDir)"
  Write-Host "  slash tips  : /supermemory-init /supermemory-login /supermemory-status"
  Write-Host 'Note: file: entries may fail at runtime on 0.1.14; package-name path is verified.'
  Write-Host '      github:user/repo requires git in PATH. Restart MiMo after install.'
}

function Invoke-Login {
  $p = Get-Paths
  $authBase = if ($env:SUPERMEMORY_AUTH_URL) { $env:SUPERMEMORY_AUTH_URL } else { 'https://console.supermemory.ai/auth/connect' }

  if (Test-Path -LiteralPath $p.CredFile) {
    Write-Host "Already authenticated: $($p.CredFile)"
    Write-Host 'Delete that file to re-authenticate, or unset env key.'
    return
  }

  $bytes = New-Object byte[] 16
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $state = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

  $port = Get-Random -Minimum 49152 -Maximum 65535
  $prefix = "http://127.0.0.1:$port/"
  $callback = "http://127.0.0.1:$port/callback?state=$state"
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add($prefix)
  try { $listener.Start() } catch {
    Write-Host "Failed to bind $prefix : $($_.Exception.Message)"
    Write-Host 'Fallback: set SUPERMEMORY_API_KEY from https://console.supermemory.ai/keys'
    exit 1
  }

  $hostName = $env:COMPUTERNAME
  if (-not $hostName) { $hostName = 'pc' }
  $os = [System.Environment]::OSVersion.VersionString
  $authUrl = $authBase + '?callback=' + [uri]::EscapeDataString($callback) +
    '&client=mimocode' +
    '&hostname=' + [uri]::EscapeDataString("mimocode - $hostName") +
    '&os=' + [uri]::EscapeDataString($os) +
    '&cwd=' + [uri]::EscapeDataString((Get-Location).Path) +
    '&cli_version=0.2.0'

  Write-Host 'Opening browser for Supermemory authentication...'
  Write-Host 'If it does not open, visit:'
  Write-Host $authUrl
  try { Start-Process $authUrl } catch { Write-Host "Could not launch browser: $($_.Exception.Message)" }
  Write-Host "Waiting for callback on $callback (5 min timeout)..."

  $deadline = (Get-Date).AddMinutes(5)
  while ((Get-Date) -lt $deadline) {
    $ctxTask = $listener.GetContextAsync()
    while (-not $ctxTask.IsCompleted) {
      if ((Get-Date) -ge $deadline) { break }
      Start-Sleep -Milliseconds 200
    }
    if (-not $ctxTask.IsCompleted) { break }
    try { $ctx = $ctxTask.Result } catch { break }
    $req = $ctx.Request
    $res = $ctx.Response
    if ($req.Url.AbsolutePath -ne '/callback') {
      $buf = [Text.Encoding]::UTF8.GetBytes('Not Found')
      $res.StatusCode = 404
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      continue
    }
    $q = $req.QueryString
    if ($q['state'] -ne $state) {
      $buf = [Text.Encoding]::UTF8.GetBytes('<h1>Connection Failed</h1><p>Invalid auth state.</p>')
      $res.StatusCode = 403
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      Write-Host 'Invalid auth state.'
      break
    }
    $apiKey = $q['apikey']
    if (-not $apiKey) { $apiKey = $q['api_key'] }
    $apiBase = $q['api_url']
    if (-not $apiBase) { $apiBase = $q['api_base_url'] }
    if ($apiKey -and $apiKey.StartsWith('sm_')) {
      New-Item -ItemType Directory -Path $p.CredDir -Force | Out-Null
      $cred = [ordered]@{ apiKey = $apiKey; createdAt = (Get-Date).ToString('o'); client = 'mimocode' }
      if ($apiBase) { $cred.apiBaseUrl = $apiBase }
      Write-Json $p.CredFile ([pscustomobject]$cred)
      $sm = Read-Jsonc $p.SmFile
      $map = [ordered]@{}
      if ($sm) { foreach ($prop in $sm.PSObject.Properties) { $map[$prop.Name] = $prop.Value } }
      $map['apiKey'] = $apiKey
      if ($apiBase) { $map['baseUrl'] = $apiBase }
      if (-not $map.Contains('autoInject')) { $map['autoInject'] = $true }
      Write-Json $p.SmFile ([pscustomobject]$map)
      $buf = [Text.Encoding]::UTF8.GetBytes('<h1>Connected!</h1><p>Close this window and return to the terminal.</p>')
      $res.StatusCode = 200
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      Write-Host 'Successfully authenticated with Supermemory!'
      Write-Host "  saved: $($p.CredFile)"
      Write-Host 'Restart MiMoCode to activate.'
      try { $listener.Stop(); $listener.Close() } catch { }
      return
    }
    $buf = [Text.Encoding]::UTF8.GetBytes('<h1>Connection Failed</h1><p>No API key received.</p>')
    $res.StatusCode = 400
    $res.OutputStream.Write($buf, 0, $buf.Length)
    $res.Close()
    Write-Host 'No API key received.'
    break
  }
  try { $listener.Stop(); $listener.Close() } catch { }
  Write-Host 'Authentication timed out or failed.'
  Write-Host 'Fallback: set SUPERMEMORY_API_KEY from https://console.supermemory.ai/keys'
  exit 1
}

function Show-Status {
  $p = Get-Paths
  $pkg = Join-Path $p.CacheRoot 'package.json'
  $entry = Join-Path $p.CacheRoot 'dist\index.js'
  $cfg = Read-Jsonc $p.ConfigFile
  $pluginListed = $false
  if ($cfg -and $cfg.plugin) {
    $pluginListed = (@($cfg.plugin) | ForEach-Object { if ($_ -is [System.Array]) { $_[0] } else { $_ } }) -contains $pkgName
  }
  $key = $null
  $source = 'not configured'
  $userKey = [Environment]::GetEnvironmentVariable('SUPERMEMORY_API_KEY','User')
  if ($env:SUPERMEMORY_API_KEY) { $key = $env:SUPERMEMORY_API_KEY; $source = 'SUPERMEMORY_API_KEY env' }
  elseif ($userKey) { $key = $userKey; $source = 'SUPERMEMORY_API_KEY User env' }
  $sm = Read-Jsonc $p.SmFile
  if (-not $key -and $sm -and $sm.apiKey) { $key = $sm.apiKey; $source = $p.SmFile }
  if (-not $key -and (Test-Path $p.CredFile)) {
    try {
      $cred = Get-Content $p.CredFile -Raw | ConvertFrom-Json
      if ($cred.apiKey) { $key = $cred.apiKey; $source = $p.CredFile }
    } catch { }
  }
  $mask = 'not set'
  if ($key) {
    if ($key.Length -le 12) { $mask = $key.Substring(0,4) + '...' }
    else { $mask = $key.Substring(0,6) + '...' + $key.Substring($key.Length-4) }
  }
  $slash = Test-SlashAssets -p $p
  $ready = (Test-Path $pkg) -and (Test-Path $entry) -and $pluginListed -and [bool]$key
  Write-Host 'mimocode-supermemory status'
  Write-Host ("  package.json : " + $(if (Test-Path $pkg) { 'OK' } else { 'MISSING' }))
  Write-Host ("  dist/index.js: " + $(if (Test-Path $entry) { 'OK' } else { 'MISSING' }))
  Write-Host ("  plugin[]     : " + $(if ($pluginListed) { 'OK' } else { 'MISSING' }))
  Write-Host ("  API key      : $mask ($source)")
  Write-Host ("  credentials  : " + $(if (Test-Path $p.CredFile) { $p.CredFile } else { 'none' }))
  Write-Host ("  commands     : " + $(if ($slash.CommandsOk) { 'OK' } else { "MISSING ($($slash.MissingCmd -join ', '))" }))
  Write-Host ("  skills       : " + $(if ($slash.SkillsOk) { 'OK' } else { "MISSING ($($slash.MissingSk -join ', '))" }))
  Write-Host ("  ready        : " + $(if ($ready) { 'YES' } else { 'NO' }))
  if (-not $ready) { exit 1 }
}

function Uninstall-Plugin {
  $p = Get-Paths
  $cfg = Read-Jsonc $p.ConfigFile
  if ($cfg -and $cfg.plugin) {
    $cfg.plugin = @($cfg.plugin | Where-Object {
      $name = if ($_ -is [System.Array]) { $_[0] } else { $_ }
      $name -ne $pkgName
    })
    Write-Json $p.ConfigFile $cfg
  }
  $cache = Join-Path $p.Home ".cache\mimocode\packages\$pkgName@latest"
  if (Test-Path $cache) { Remove-Item -LiteralPath $cache -Recurse -Force }
  Remove-SlashAssets -p $p
  Write-Host "uninstalled $pkgName (credentials kept under .supermemory-mimocode)"
  Write-Host "  removed slash commands/skills under .config/mimocode (if present)"
}

if ($Status) { Show-Status }
elseif ($Login) { Invoke-Login }
elseif ($Uninstall) { Uninstall-Plugin }
else { Install-Plugin }
