$ErrorActionPreference = 'Stop'
$gitExe = 'f:\Program Files\Git\cmd\git.exe'
Write-Output ("cwd=" + (Get-Location).Path)
& $gitExe status -sb
& $gitExe add -A
& $gitExe status -sb
& $gitExe -c user.name='wsks2233' -c user.email='flowers2233@foxmail.com' commit -m 'feat: add plugin[] module, elegant installer, and Supermemory OAuth login'
& $gitExe log -1 --oneline
& $gitExe status -sb
Write-Output 'COMMITTED_LOCAL_ONLY'
