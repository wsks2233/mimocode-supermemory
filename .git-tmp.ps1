$ErrorActionPreference = 'Stop'
$gitExe = 'f:\Program Files\Git\cmd\git.exe'
& $gitExe add -A
& $gitExe -c user.name='wsks2233' -c user.email='wsks2233@users.noreply.github.com' commit -m 'chore: drop temporary push helper script'
& $gitExe push origin main
& $gitExe status -sb
& $gitExe log -3 --oneline
