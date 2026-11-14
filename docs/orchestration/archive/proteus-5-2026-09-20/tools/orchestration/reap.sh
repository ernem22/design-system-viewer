#!/usr/bin/env bash
# Stateless reap: release the worker, close its terminal, remove its worktree.
# The counterpart of spawn.sh. This is the pair the failure ledger calls
# "ack and release are one atomic pair" plus the third step, teardown.
#
#   reap.sh <role-slug> [dispatch-id]
#
# State: none. The worktree path is read from `orca worktree list` — Orca owns
# it, so this script cannot drift from it. Ack is not done here: ack needs the
# delivery id, which belongs to the settlement the caller just read.
#
# Prints one line per step so the caller can see what actually happened.
set -uo pipefail

ROLE="${1:?usage: reap.sh <role-slug> [dispatch-id]}"
DISPATCH="${2:-}"
S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
REPO_ID="294b7f02-d29f-464f-a65c-f6929e0b8ae2"

# Orca owns the worktree list; ask it, do not cache it.
P=$(orca worktree list 2>/dev/null | grep -E "^$REPO_ID::" | grep "/$ROLE\$" | head -1 | sed -E 's/^[^:]*::(.*)  refs.*/\1/')
if [ -z "$P" ]; then
  # fall back to a plain path column hit, then give up loudly rather than silently
  P=$(orca worktree list 2>/dev/null | grep "/$ROLE\$" | head -1 | awk '{print $1}')
fi

if [ -n "$DISPATCH" ]; then
  ST=$(orca orchestration worker-release --dispatch "$DISPATCH" --json 2>&1 \
       | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).result.state)}catch(e){console.log('unparsed')}})")
  echo "release $DISPATCH: $ST"
else
  echo "release: skipped (no dispatch id)"
fi

# Kill any preview/dev server still running out of this worktree, BEFORE the worktree goes.
# reap.sh used to remove the directory and leave the server holding it: the process kept its
# memory and its port, and `worktree rm` came back false because the directory was busy. Those
# orphans accumulated all night (13 of them at one point) and were the real cause of the
# "memory full" agent deaths — not the worktrees themselves.
# NB: `taskkill //F //PID` is NOT equivalent to `taskkill -F -PID` in this shell: MSYS path
# conversion is disabled, so the double-slash form is rejected with "Invalid argument/option"
# and the kill silently no-ops while the caller believes it succeeded.
kill_servers() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*$ROLE*' -and \$_.CommandLine -match 'vite' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
  for port in 4210 4211 4212 4213 4214 4215 4216 4217 4218 4219 4220 4221; do
    PID=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | head -1 | awk '{print $NF}')
    [ -z "$PID" ] && continue
    CL=$(powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"ProcessId=$PID\").CommandLine" 2>/dev/null)
    case "$CL" in *"$ROLE"*) taskkill -F -PID "$PID" >/dev/null 2>&1 && echo "server on :$port killed ($ROLE)";; esac
  done
}
kill_servers

if [ -n "$P" ]; then
  orca terminal close --worktree "id:$REPO_ID::$P" --all --json >/dev/null 2>&1 \
    && echo "terminals closed: $ROLE" || echo "terminals: none for $ROLE"

  RM=$(orca worktree rm --worktree "id:$REPO_ID::$P" --force --json 2>&1 \
       | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).ok)}catch(e){console.log('unparsed')}})")
  echo "worktree rm $ROLE: $RM ($P)"
else
  echo "worktree: orca does not list a worktree for $ROLE"
fi
