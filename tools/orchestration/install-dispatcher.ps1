# Register (or remove) the Task Scheduler entry that keeps the dispatcher alive (hunter H-002).
#
#   powershell -ExecutionPolicy Bypass -File install-dispatcher.ps1             install / update
#   powershell -ExecutionPolicy Bypass -File install-dispatcher.ps1 -Uninstall  remove
#
# The task runs launch-dispatcher.sh at logon and every 5 minutes. The launcher does nothing while a
# dispatcher is alive, so the repetition is only the restart guarantee after a crash, an Orca restart
# or a reboot. The dispatcher still acts only while state\dispatch.enabled exists (shadow otherwise).
param([switch]$Uninstall, [string]$Code = '')

$Name = 'dsv-dispatcher'
if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "removed scheduled task $Name"
  return
}

if (-not $Code) { $Code = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
$Launcher = (Join-Path $Code 'tools\orchestration\launch-dispatcher.sh') -replace '\\', '/'
if (-not (Test-Path $Launcher)) { throw "no launcher at $Launcher" }

# Git Bash by full path: a bare bash.exe can resolve to WSL's.
$Bash = @("$env:ProgramFiles\Git\bin\bash.exe", "${env:ProgramFiles(x86)}\Git\bin\bash.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Bash) { throw 'Git Bash not found under Program Files\Git\bin' }

# The task runs a bootstrap kept OUTSIDE every worktree: it re-creates the code tree if something
# removed it (measured 2026-10-04), then runs that tree's launcher.
$Root = (& git -C $Code rev-parse --path-format=absolute --git-common-dir) | Split-Path -Parent
if (-not $Root -or -not (Test-Path $Root)) { throw "root checkout of $Code not found" }
$State = Join-Path $env:LOCALAPPDATA 'orca-orchestration\design-system-viewer'
New-Item -ItemType Directory -Force -Path $State | Out-Null
$Boot = Join-Path $State 'bootstrap.sh'
Copy-Item (Join-Path $Code 'tools\orchestration\dispatcher-bootstrap.sh') $Boot -Force
$Boot = $Boot -replace '\\', '/'
$CodeArg = $Code -replace '\\', '/'
$RootArg = $Root -replace '\\', '/'
$Action   = New-ScheduledTaskAction -Execute $Bash -Argument "-l `"$Boot`" `"$CodeArg`" `"$RootArg`""
$AtLogon  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Every5   = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $Name -Action $Action -Trigger $AtLogon, $Every5 -Settings $Settings -Force | Out-Null
Write-Host "registered scheduled task $Name -> $Bash -l $Boot $CodeArg $RootArg (at logon + every 5 min)"
