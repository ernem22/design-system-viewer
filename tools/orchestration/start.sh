#!/usr/bin/env bash
# Start one worker in one short command: resolve the handle by worktree PATH, wait
# for the TUI to be idle, then worker-start.
#
# Why: doing this inline in a composite shell command kept losing the dispatch when
# the session was interrupted mid-call — the handle lookup, the wait and the start
# are three steps that must run together.
#
#   start.sh <worktree-path> <spec-file> <task-title> [--retry-of <dispatch>] [--min <mb>]
#
# --retry-of   fence-and-retry: pass the OLD dispatch id through to worker-start. Doing this by
#              hand was a mechanical intervention (the contract says a dispatch that never settled
#              must be abandoned and retried with --retry-of, never released) and this script did
#              not support it, so the coordinator had to write the worker-start call by hand.
# --min        the capacity floor in MB for this dispatch (default 600, the stopgap A4 threshold;
#              override with WATCH_MIN_MB or this flag).
#
# Prints the worker-start result line. Exit 0 only when ok=true.
set -uo pipefail

P=""; SPEC=""; TITLE=""; RETRY_OF=""; MIN_MB="${WATCH_MIN_MB:-600}"
POS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --retry-of) RETRY_OF="${2:?--retry-of needs a dispatch id}"; shift 2;;
    --min) MIN_MB="${2:?--min needs a number}"; shift 2;;
    -*) echo "start.sh: unknown flag $1" >&2; exit 2;;
    *) POS+=("$1"); shift;;
  esac
done
[ "${#POS[@]}" -ge 3 ] || { echo "usage: start.sh <worktree-path> <spec-file> <task-title> [--retry-of <dispatch>] [--min <mb>]" >&2; exit 2; }
P="${POS[0]}"; SPEC="${POS[1]}"; TITLE="${POS[2]}"
# Derive the run from Orca instead of carrying a session constant (same fix as settle.sh and
# watch-settlements.sh, which already did this). The old fallback was a leftover from the
# session that created it: every copy of it would dispatch and fence in a run that may not be
# the current one.
if [ -n "${WATCH_RUN:-}" ]; then
  RUN="$WATCH_RUN"
else
  RUN="$(orca orchestration run-current --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((((JSON.parse(s).result||{}).run)||{}).id||"")}catch(e){}})' )"
  if [ -z "$RUN" ]; then
    echo "could not read the current run (orca orchestration run-current); pass WATCH_RUN=<id>" >&2
    exit 2
  fi
fi
# Both are overridable so the capacity gate can be probed with a fake reading and a short timeout.
CAPACITY_JS="${CAPACITY_JS:-D:/code/orca-supervisor/src/capacity.js}"
CAP_TIMEOUT="${WATCH_CAP_TIMEOUT:-900}"
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

# CAPACITY IS A GATE, NOT ADVICE. Measured 2026-09-28: three dispatches went out at 334, 419 and
# 426 MB available, below the documented 400 MB floor, because the rule lived in prose and this
# script never consulted it. wait-capacity.sh waits rather than stopping (the machine frees itself;
# closing idle terminals does not help, measured 740 -> 681 MB), and gives up only after its
# timeout - writing an inbox item and exiting 1. On a timeout we do NOT dispatch: proceeding anyway
# is what the gate exists to prevent.
echo "start.sh: available_mb before dispatch: $(node "$CAPACITY_JS" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).available_mb))}catch(e){process.stdout.write("?")}})')"
CAP_RC=0
bash "$HERE/wait-capacity.sh" --min "$MIN_MB" --timeout "$CAP_TIMEOUT" --note "dispatch: $TITLE" >&2 || CAP_RC=$?
if [ "$CAP_RC" -ne 0 ]; then
  echo "start.sh: NOT dispatching '$TITLE' - capacity did not reach ${MIN_MB} MB in time (wait-capacity exit $CAP_RC)." >&2
  echo "  An inbox item was written; do other work and retry. This is not a stop signal." >&2
  exit 1
fi

RETRY_ARG=()
[ -n "$RETRY_OF" ] && RETRY_ARG=(--retry-of "$RETRY_OF")

orca orchestration worker-start --spec "$(cat "$SPEC")" --task-title "$TITLE" \
  --terminal "$H" --worktree "id:$REPO_ID::$P" --run "$RUN" --from "$FROM" \
  ${RETRY_ARG[@]+"${RETRY_ARG[@]}"} --json 2>/dev/null \
  | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try{ const i=s.indexOf('{'); const j=JSON.parse(i>=0?s.slice(i):s);
    if(j.ok){ console.log('STARTED task='+(j.result&&j.result.taskId)+' dispatch='+(j.result&&j.result.dispatchId)); }
    else { console.log('FAILED '+(j.error&&j.error.code)+' '+(j.error&&j.error.message||'').slice(0,120)); process.exit(3); }
  }catch(e){ console.log('UNPARSED '+s.slice(0,160)); process.exit(4); }
});"
