#!/usr/bin/env bash
# Start one worker in one short command: resolve the handle by worktree PATH, wait
# for the TUI to be idle, then worker-start.
#
# Why: doing this inline in a composite shell command kept losing the dispatch when
# the session was interrupted mid-call — the handle lookup, the wait and the start
# are three steps that must run together.
#
#   start.sh <worktree-path> <spec-file> <task-title>
#
# Prints the worker-start result line. Exit 0 only when ok=true.
set -uo pipefail

P="${1:?usage: start.sh <worktree-path> <spec-file> <task-title>}"
SPEC="${2:?usage: start.sh <worktree-path> <spec-file> <task-title>}"
TITLE="${3:?usage: start.sh <worktree-path> <spec-file> <task-title>}"
RUN="${WATCH_RUN:-run_4e539259ab29}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$HERE/repo-id.sh"
# The coordinator handle that owns the Run. Orca exports ORCA_TERMINAL_HANDLE to every
# terminal it manages, so derive it. The constant this replaces (term_795ae4f7-...) was a
# handle from a session long gone, and every worker-start from this script was then fenced
# with consumer_fenced. WATCH_FROM overrides; neither being set is a hard error, not a guess.
FROM="${WATCH_FROM:-${ORCA_TERMINAL_HANDLE:-}}"
if [ -z "$FROM" ]; then
  echo "start.sh: no coordinator handle: ORCA_TERMINAL_HANDLE is unset and WATCH_FROM is empty" >&2
  echo "  run this from the Orca terminal bound to the Run, or pass WATCH_FROM=<handle>" >&2
  echo "  (handles: orca terminal list)" >&2
  exit 2
fi

[ -f "$SPEC" ] || { echo "start.sh: no spec at $SPEC" >&2; exit 1; }

H=""
# The agent terminal registers a few seconds after the worktree is created; wait
# for it rather than falling back to the plain shell, which worker-start rejects
# with agent_unconfigured.
for _ in $(seq 1 12); do
  H=$(bash "$HERE/handle.sh" "$P" --agent-only 2>/dev/null | head -1)
  [ -n "$H" ] && break
  sleep 5
done
[ -z "$H" ] && { echo "start.sh: no agent terminal for $P after 60s" >&2; exit 2; }
echo "start.sh: $P -> $H"

orca terminal wait --terminal "$H" --for tui-idle --timeout-ms 90000 --json >/dev/null 2>&1

orca orchestration worker-start --spec "$(cat "$SPEC")" --task-title "$TITLE" \
  --terminal "$H" --worktree "id:$REPO_ID::$P" --run "$RUN" --from "$FROM" --json 2>&1 \
  | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{ const j=JSON.parse(s);
    if(j.ok){ console.log('STARTED task='+(j.result&&j.result.taskId)+' dispatch='+(j.result&&j.result.dispatchId)); }
    else { console.log('FAILED '+(j.error&&j.error.code)+' '+(j.error&&j.error.message||'').slice(0,120)); process.exit(3); }
  }catch(e){ console.log('UNPARSED '+s.slice(0,160)); process.exit(4); }
});"
