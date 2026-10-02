#!/usr/bin/env bash
# Drives cases (a) and (b) end to end, unattended: spawn, dispatch, observe, abandon, reap, verify,
# clean up. Writes one verdict line to state/reconcile-probe.result. Hard deadline 30 min.
#
#   (a) while dispatched   - a live managed worktree is never touched
#   (b) after worker-abandon - the tree is reaped, the worktree is KEPT as evidence
#
# Nobody watches this. It must therefore be conservative: it only ever abandons the dispatch it
# created itself, it only ever executes a targeted pass (--only its own worktree), and it cleans
# up whatever it made even when it fails.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
STATE_DIR="${SUPERVISE_STATE:-${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/state}"
RUN="${PROBE_RUN:-run_4e539259ab29}"
ROOT="${PROBE_ROOT:-C:/Users/zurza/orca/workspaces/design-system-viewer}"
NAME="probe-ab"
W="$ROOT/$NAME"
RESULT="$STATE_DIR/reconcile-probe.result"
LOG="$STATE_DIR/reconcile-probe.log"
DEADLINE=$(( $(date +%s) + 1800 ))

V_a=NOT_EXERCISED; V_b=NOT_EXERCISED
say() { printf '%s\n' "$*" | tee -a "$LOG"; }
expired() { [ "$(date +%s)" -gt "$DEADLINE" ]; }

finish() {
  say "a=$V_a b=$V_b"
  printf 'a=%s b=%s\n' "$V_a" "$V_b" > "$RESULT"
  exit 0
}

: > "$LOG"
say "start $(date -u +%Y-%m-%dT%H:%M:%SZ)  deadline=$DEADLINE"

# ---- fixture ------------------------------------------------------------------------------
git -C "$HERE/../.." worktree remove --force "$W" >/dev/null 2>&1
rm -rf "$W" 2>/dev/null
SPAWN_OUT="$(bash "$HERE/spawn.sh" "$NAME" 2>&1)"
say "spawn: $(printf '%s' "$SPAWN_OUT" | tail -1)"
W="$(printf '%s' "$SPAWN_OUT" | sed -n 's/^PATH=//p' | head -1 | tr -d '\r')"
[ -n "$W" ] || W="$ROOT/$NAME"
say "worktree: $W"
if [ ! -f "$W/.dsv-worker" ]; then say "no marker - nothing to exercise"; finish; fi

# ---- dispatch -----------------------------------------------------------------------------
# start.sh takes <worktree-path> <spec-file> <task-title>; the spec is throwaway and the worker
# is told to do nothing. This run only needs a real dispatch id to exist and then to be abandoned.
printf '# probe-ab (throwaway)\n\nDo nothing. Do not read files, do not run commands, do not commit.\nReply with the single word READY and stop.\n' > "$STATE_DIR/probe-ab.spec.md"
SPEC="$STATE_DIR/probe-ab.spec.md"
say "spec: $SPEC"
bash "$HERE/start.sh" "$W" "$SPEC" "probe-ab (a/b) throwaway" >>"$LOG" 2>&1 &
START_PID=$!
say "start.sh pid=$START_PID; waiting for the marker to carry a dispatch (max 20 min)"

DISP=""
while :; do
  if expired; then say "deadline hit while waiting for the dispatch"; break; fi
  sleep 15
  DISP="$(sed -n 's/^dispatch=//p' "$W/.dsv-worker" 2>/dev/null | tr -d '\r' | head -1)"
  [ -n "$DISP" ] && break
  kill -0 "$START_PID" 2>/dev/null || { say "start.sh exited without a dispatch"; break; }
done
say "dispatch=$DISP"

plan_json() { python "$HERE/lib/reconcile.py" --run "$RUN" --json 2>/dev/null; }

# ---- (a) while dispatched -----------------------------------------------------------------
if [ -n "$DISP" ]; then
  sleep 20
  P="$(plan_json)"
  A_ACT="$(printf '%s' "$P" | python -c "
import json,sys
d=json.load(sys.stdin)
print(','.join(next((m.get('actions') or [] for m in (d.get('managed') or []) if m['worktree']=='$NAME'), ['NO-ENTRY'])))" 2>/dev/null)"
  A_LIVE="$(printf '%s' "$P" | python -c "
import json,sys
d=json.load(sys.stdin)
print(next((bool(m.get('live')) for m in (d.get('managed') or []) if m['worktree']=='$NAME'), False))" 2>/dev/null)"
  say "(a) live=$A_LIVE actions=[$A_ACT]"
  if [ "$A_LIVE" = "True" ] && [ -z "$A_ACT" ]; then
    V_a=PASS
  else
    V_a=FAIL
  fi
  say "(a) $V_a"

  # ---- abandon, without retry -------------------------------------------------------------
  say "abandoning $DISP"
  orca orchestration worker-abandon --dispatch "$DISP" < /dev/null >>"$LOG" 2>&1
  kill "$START_PID" 2>/dev/null || true
  sleep 10

  # ---- (b) after the abandon: targeted execute, reaps the tree, keeps the worktree ---------
  python "$HERE/lib/reconcile.py" --run "$RUN" --only "$NAME" --execute >>"$LOG" 2>&1
  sleep 5
  P="$(plan_json)"
  B_ACT="$(printf '%s' "$P" | python -c "
import json,sys
d=json.load(sys.stdin)
print(','.join(next((m.get('actions') or [] for m in (d.get('managed') or []) if m['worktree']=='$NAME'), ['NO-ENTRY'])))" 2>/dev/null)"
  B_LIVE="$(printf '%s' "$P" | python -c "
import json,sys
d=json.load(sys.stdin)
print(next((bool(m.get('live')) for m in (d.get('managed') or []) if m['worktree']=='$NAME'), False))" 2>/dev/null)"
  say "(b) after execute: live=$B_LIVE actions=[$B_ACT] worktree-on-disk=$([ -d "$W" ] && echo yes || echo no)"
  if [ "$B_LIVE" = "False" ] && [ -d "$W" ]; then
    V_b=PASS
  else
    V_b=FAIL
  fi
  say "(b) $V_b"
fi

# ---- clean up what this run made ----------------------------------------------------------
kill "$START_PID" 2>/dev/null || true
for _try in 1 2 3 4 5; do
  sleep 3
  git -C "$HERE/../.." worktree remove --force "$W" >/dev/null 2>&1
  rm -rf "$W" 2>/dev/null
  [ -d "$W" ] || break
done
say "fixture removed: $([ -d "$W" ] && echo no || echo yes)"
finish
