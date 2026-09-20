$ErrorActionPreference = 'Stop'
$root = 'F:\代码\mimocode-supermemory'
node --check (Join-Path $root 'dist\index.js')
if ($LASTEXITCODE -ne 0) { exit 1 }
node --check (Join-Path $root 'bin\cli.js')
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host 'SYNTAX_OK'

$ps = Get-Content -LiteralPath (Join-Path $root 'install.ps1') -Raw
$psMarkers = @(
  'Install-SlashAssets',
  'Test-SlashAssets',
  'Remove-SlashAssets',
  'CommandsDir',
  'SkillsDir'
)
foreach ($s in $psMarkers) {
  if (-not $ps.Contains($s)) { Write-Host "ps1 missing $s"; exit 1 }
}
Write-Host 'PS1_MARKERS_OK'

$cli = Get-Content -LiteralPath (Join-Path $root 'bin\cli.js') -Raw
$cliMarkers = @(
  'installSlashAssets',
  'testSlashAssets',
  'removeSlashAssets',
  'commandsDir',
  'skillsDir'
)
foreach ($s in $cliMarkers) {
  if (-not $cli.Contains($s)) { Write-Host "cli missing $s"; exit 1 }
}
Write-Host 'CLI_MARKERS_OK'
