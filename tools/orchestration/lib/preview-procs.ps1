# Find the preview/dev servers that Orca's worktree lifecycle does not own.
#
# Why: the coordinator starts a preview OUTSIDE Orca, so removing a worktree never stops it.
# Measured 2026-10-02 on this host: a `serve2.js ...\Temp\opencode\wt-old 8126` process was still
# listening on 8126 while its directory no longer existed, and the port answered 404 while `curl`
# read it as "up". This is the one place that decides whether such a process is still legitimate.
#
#   -Mode worktree -Path <dir>   every node process whose command line names <dir>
#   -Mode orphan                 every server-shaped node process whose command line names at
#                                least one absolute path that is NOT on disk
#   [-Kill]                      stop each match (default: report only)
#
# Output: one line per match, `<pid>|<kind>|<live|killed>|<command line, 140 chars>`, then a
# summary `MATCHED <n>` / `NONE`. Report-only by default so the destructive mode is explicit.
#
# TWO THINGS THIS DELIBERATELY DOES NOT DO:
#   * It matches the COMMAND LINE only. A preview started as `(cd <wt>/app && npx vite preview
#     --port N)` names no path in its command line - only its cwd - so it is invisible to the
#     worktree mode. Start previews with the path spelled out (serve.sh prints that line), or stop
#     that one by port.
#   * The orphan mode needs a path that is GONE. A server whose every path token exists is left
#     alone even if it is idle: the kill has to be justified by the disk, not by a heuristic.
param(
  [Parameter(Mandatory = $true)][ValidateSet('worktree', 'orphan')][string]$Mode,
  [string]$Path,
  [switch]$Kill
)

function Normalize([string]$s) {
  if (-not $s) { return '' }
  return $s.ToLower().Replace('\', '/')
}

# Absolute paths in a command line come quoted (`"C:\Program Files\nodejs\node.exe"`) or bare
# (`serve2.js C:\...\wt-old 8126`). Both forms are collected; a bare token is sliced at the first
# space, which is why the quoted form has to be tried first.
function PathTokens([string]$normalized) {
  $tokens = @()
  foreach ($m in [regex]::Matches($normalized, '"([a-z]:[^"]*)"')) { $tokens += $m.Groups[1].Value }
  foreach ($m in [regex]::Matches($normalized, '(?:^|\s)([a-z]:[^\s"]+)')) { $tokens += $m.Groups[1].Value }
  return $tokens
}

# A token can carry trailing punctuation from the surrounding shell text; a path that exists in
# either form is not evidence of anything.
function TokenExists([string]$token) {
  $trimmed = $token.TrimEnd(')', ']', '}', ',', ';', '.')
  foreach ($cand in @($token, $trimmed)) {
    if (-not $cand) { continue }
    if (Test-Path -LiteralPath $cand) { return $true }
  }
  return $false
}

$want = (Normalize $Path).TrimEnd('/')
$serverRe = 'vite|preview|http-server|serve[0-9]*\.js|serve\.js|live-server'
$matched = 0

foreach ($p in (Get-CimInstance Win32_Process)) {
  if ($p.Name -notin @('node.exe', 'node', 'bun.exe')) { continue }
  $cmd = $p.CommandLine
  if (-not $cmd) { continue }
  $nc = Normalize $cmd
  $reason = ''

  if ($Mode -eq 'worktree') {
    if (-not $want) { continue }
    if ($nc.Contains($want)) { $reason = "names $want" }
  }
  else {
    if ($nc -notmatch $serverRe) { continue }
    foreach ($t in (PathTokens $nc)) {
      if (-not (TokenExists $t)) { $reason = "serves missing path $t"; break }
    }
  }
  if (-not $reason) { continue }

  $matched++
  $short = $cmd.Substring(0, [Math]::Min(140, $cmd.Length))
  $state = 'live'
  if ($Kill) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    if (Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue) { $state = 'kill-failed' }
    else { $state = 'killed' }
  }
  Write-Output ("$($p.ProcessId)|$Mode|$state|$short|$reason")
}

if ($matched -eq 0) { Write-Output 'NONE' } else { Write-Output "MATCHED $matched" }
