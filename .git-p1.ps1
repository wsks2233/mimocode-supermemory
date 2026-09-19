$ErrorActionPreference = 'Continue'
$gitExe = 'f:\Program Files\Git\cmd\git.exe'
& $gitExe add -A
& $gitExe -c user.name='wsks2233' -c user.email='wsks2233@users.noreply.github.com' commit -m 'feat: install.ps1 calls mimo plugin then stable cache install' 2>&1
& $gitExe push origin main 2>&1
Write-Output ("exit=" + $LASTEXITCODE)
& $gitExe status -sb
