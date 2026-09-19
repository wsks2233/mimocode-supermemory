$ErrorActionPreference = 'Stop'
$git = 'f:\Program Files\Git\cmd\git.exe'
$root = 'F:\代码\mimocode-supermemory'
Set-Location -LiteralPath $root

Write-Output '=== git status ==='
& $git rev-parse --git-dir
& $git rev-parse --git-common-dir
& $git branch --show-current
& $git status -sb

New-Item -ItemType Directory -Path (Join-Path $root '.worktrees') -Force | Out-Null
$ignore = Join-Path $root '.worktrees\.gitignore'
if (-not (Test-Path -LiteralPath $ignore)) {
  [System.IO.File]::WriteAllText($ignore, "*`n")
}

$wt = Join-Path $root '.worktrees\plugin-module'
if (Test-Path -LiteralPath $wt) {
  Write-Output 'worktree-exists'
} else {
  & $git check-ignore -q $wt
  if ($LASTEXITCODE -ne 0) {
    Add-Content -Path $ignore -Value '*' -Encoding ascii
  }
  & $git worktree add $wt -b feat/plugin-module
}

& $git worktree list
Write-Output '=== worktree files ==='
Get-ChildItem -LiteralPath $wt | Select-Object Name
Write-Output 'WORKTREE_READY'
