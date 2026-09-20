$ErrorActionPreference = 'Continue'
$gitExe = 'f:\Program Files\Git\cmd\git.exe'
Remove-Item -LiteralPath '.git-tmp.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '.git-commit-cap.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '.git-p1.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '.git-scan-privacy.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath '.git-privacy-fix.ps1' -Force -ErrorAction SilentlyContinue
& $gitExe status -sb
& $gitExe add -A
& $gitExe status -sb
& $gitExe -c user.name='wsks2233' -c user.email='wsks2233@users.noreply.github.com' commit -m 'feat: tool forget via document delete + scope (backlog #3)'
& $gitExe log -2 --oneline
& $gitExe push origin main
Write-Output ("push_exit=" + $LASTEXITCODE)
& $gitExe status -sb
& $gitExe log -1 --format='%h %s' origin/main
