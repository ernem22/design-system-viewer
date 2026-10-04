# fence.probe.ps1 - can the Run be bound to a second Orca terminal? Run from the coordinator (Hermes) terminal:
#   powershell.exe -ExecutionPolicy Bypass -File probe-fence.ps1
# Does exactly three approved things and measures one question:
#   A. pauses reconcile (renames state\reconcile.enabled -> .paused, if present)
#   B. acks the stale replayed heartbeat delivery_7b6afc09328a (only if it is still the head batch)
#   C. measures whether the Run can be bound to ANOTHER Orca terminal (run-use) and what that does
#      to this terminal's fence; then binds it back here so Hermes ends exactly as it started.
# Starts no worker. Creates at most two never-dispatched probe Tasks.

$ErrorActionPreference = 'Continue'
$Base = Join-Path $env:LOCALAPPDATA 'orca-orchestration'
$Out  = Join-Path $Base 'probe-fence.txt'
$ChildOut = Join-Path $Base 'probe-fence-child.txt'
$ChildPs  = Join-Path $Base 'probe-fence-child.ps1'
Set-Content -Path $Out -Value '' -Encoding UTF8
Set-Location 'D:/code/design-system-viewer'
$Run = 'run_4e539259ab29'; $Stale = 'delivery_7b6afc09328a'
$script:Last = ''; $script:Child = ''

function Sec($t) { Add-Content $Out ("`n===== $t  [" + (Get-Date).ToUniversalTime().ToString('HH:mm:ssZ') + ']') }
function Cap {
  param([string]$Exe, [string[]]$A)
  Add-Content $Out ('$ ' + $Exe + ' ' + ($A -join ' '))
  $o = (& $Exe @A 2>$null | Out-String); $rc = $LASTEXITCODE
  Add-Content $Out $o; Add-Content $Out "[rc=$rc]"
  $script:Last = $o; return $rc
}
function First($rx) { $m = [regex]::Match($script:Last, $rx); if ($m.Success) { $m.Groups[$m.Groups.Count - 1].Value } else { '' } }

try {
  # ---- A. reconcile off -------------------------------------------------------------------
  Sec 'A: reconcile flag'
  $State = Join-Path $Base 'design-system-viewer\state'
  Add-Content $Out ((Get-ChildItem -Path $State -Filter 'reconcile*' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join ', ')
  $flag = Join-Path $State 'reconcile.enabled'
  if (Test-Path $flag) {
    if (Test-Path "$flag.paused") { Remove-Item "$flag.paused" -Force }
    Rename-Item -Path $flag -NewName 'reconcile.enabled.paused'
    Add-Content $Out 'renamed reconcile.enabled -> reconcile.enabled.paused'
  } else { Add-Content $Out 'reconcile.enabled not present: already off' }
  Add-Content $Out ('after: ' + ((Get-ChildItem -Path $State -Filter 'reconcile*' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join ', '))

  # ---- B. stale heartbeat ack ----------------------------------------------------------------
  Sec 'B: inbox head (peek)'
  Cap orca @('orchestration','check','--peek','--json') | Out-Null
  Sec 'B: inbox head batch'
  Cap orca @('orchestration','check','--json') | Out-Null
  $head = First '"deliveryId"\s*:\s*"([^"]+)"'
  if ($head -eq $Stale) {
    Sec "B: ack $Stale (approved)"
    Cap orca @('orchestration','check','--ack',$Stale,'--json') | Out-Null
    Add-Content $Out ('next head after ack: ' + (First '"deliveryId"\s*:\s*"([^"]+)"'))
  } else { Add-Content $Out "head batch is '$head', not $Stale - NOT acking anything" }

  # ---- C. fence / run handover -----------------------------------------------------------------
  Sec 'C1: this terminal before'
  Add-Content $Out ('env ORCA_* : ' + ((cmd /c set ORCA 2>$null) -join ' | '))
  Cap orca @('orchestration','run-current','--json') | Out-Null

  # the child runs in its own Orca terminal; it measures, writes its own file, and exits
  $child = @'
$O = '__CHILD_OUT__'
Set-Content -Path $O -Value '' -Encoding UTF8
function C([string[]]$A) { Add-Content $O ("`n===== orca " + ($A -join ' ') + "  [" + (Get-Date).ToUniversalTime().ToString('HH:mm:ssZ') + "]"); $o = (& orca @A 2>$null | Out-String); Add-Content $O $o; Add-Content $O "[rc=$LASTEXITCODE]" }
Add-Content $O ('env ORCA_* : ' + ((cmd /c set ORCA 2>$null) -join ' | '))
C @('orchestration','run-current','--json')
C @('orchestration','run-use','--id','__RUN__','--json')
C @('orchestration','run-current','--json')
C @('orchestration','task-create','--spec','fence probe - never dispatched','--task-title','probe-fence-child','--json')
C @('orchestration','worker-list','--limit','1','--json')
Add-Content $O "`nCHILD-DONE"
'@
  $child = $child.Replace('__CHILD_OUT__', $ChildOut).Replace('__RUN__', $Run)
  [System.IO.File]::WriteAllText($ChildPs, $child)
  if (Test-Path $ChildOut) { Remove-Item $ChildOut -Force }

  Sec 'C2: create child terminal'
  Cap orca @('terminal','create','--worktree','current','--title','probe-fence',
    '--command',"powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$ChildPs`"",'--json') | Out-Null
  $script:Child = First '"handle"\s*:\s*"(term_[0-9a-fA-F-]+)"'
  Add-Content $Out "child terminal=$($script:Child)"

  Sec 'C3: wait for child (max 120s)'
  for ($i = 0; $i -lt 40; $i++) {
    if ((Test-Path $ChildOut) -and (Select-String -Path $ChildOut -Pattern 'CHILD-DONE' -Quiet)) { break }
    Start-Sleep -Seconds 3
  }
  Add-Content $Out ('child finished: ' + ((Test-Path $ChildOut) -and (Select-String -Path $ChildOut -Pattern 'CHILD-DONE' -Quiet)))
  Sec 'C3: child output'
  if (Test-Path $ChildOut) { Add-Content $Out (Get-Content $ChildOut -Raw) }

  Sec 'C4: this terminal after the child bound'
  Cap orca @('orchestration','run-current','--json') | Out-Null
  Cap orca @('orchestration','task-create','--spec','fence probe - never dispatched','--task-title','probe-fence-parent','--json') | Out-Null
}
finally {
  # always: bind the Run back to THIS terminal and close the child, so Hermes ends as it started
  if ($script:Child) { Sec 'Z: close child terminal'; Cap orca @('terminal','close','--terminal',$script:Child,'--json') | Out-Null }
  Sec 'Z: restore binding here'
  Cap orca @('orchestration','run-use','--id',$Run,'--json') | Out-Null
  Cap orca @('orchestration','run-current','--json') | Out-Null

  Sec 'SUMMARY (grep, no interpretation)'
  $all = Get-Content $Out -Raw
  $lines = @()
  $lines += 'consumer_fenced count: ' + [regex]::Matches($all, 'consumer_fenced').Count
  $lines += 'error codes seen: ' + (([regex]::Matches($all, '"code"\s*:\s*"([a-z_]+)"') | ForEach-Object { $_.Groups[1].Value } | Group-Object | ForEach-Object { "$($_.Count)x $($_.Name)" }) -join ', ')
  $lines += 'task ids created: ' + (([regex]::Matches($all, '"taskId"\s*:\s*"(task_[0-9a-f]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique) -join ', ')
  Add-Content $Out $lines
  Write-Host ("$Out " + (Get-Content $Out).Count + ' lines')
}
