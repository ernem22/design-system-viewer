#!/usr/bin/env bash
# Drives cases (a), (b) and (f) end to end, unattended: spawn, dispatch, observe, abandon, reap,
# verify, clean up. Writes one verdict line to state/reconcile-probe.result. Hard deadline 30 min.
#
#   (a) while dispatched     - a live managed worktree is never touched
#   (b) after worker-abandon - the tree is reaped, the worktree is KEPT as evidence
#   (f) a settled dispatch   - a settlement exists, so reconcile REMOVES the worktree
#
# (f) exists because (b) passed while settle.sh never ran at all: "the worktree is still on
# disk" is true whether the settle succeeded, refused, or never started. Only (f) asserts that
# settle ran (DONE) and that the directory is gone.
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

V_a=NOT_EXERCISED; V_b=NOT_EXERCISED; V_f=NOT_EXERCISED
say() { printf '%s\n' "$*" | tee -a "$LOG"; }
expired() { [ "$(date +%s)" -gt "$DEADLINE" ]; }

# Remove a fixture THROUGH Orca. A plain `git worktree remove` + rm leaves Orca's registry
# pointing at a directory that is gone: the next spawn of that name then silently takes a -2
# suffix (measured 2026-10-03: probe-settle-2) or binds its terminal to the stale row and dies
# with `FAILED terminal_worktree_mismatch` - which reads like a product bug and is not one.
fixture_rm() {
  local br=""
  br="$(git -C "$1" rev-parse --abbrev-ref HEAD 2>/dev/null)"
  orca worktree rm --worktree "path:$1" --force --json >/dev/null 2>&1
  git -C "$HERE/../.." worktree remove --force "$1" >/dev/null 2>&1
  rm -rf "$1" 2>/dev/null
  # ...and its branch: a branch left behind is what makes the next run take a -N suffix
  # (measured 2026-10-03: ernem22/probe-ab stayed taken and this file's fixture became
  # probe-ab-2). Probe namespace only, and only when the branch carries no work of its own.
  case "$br" in
    ernem22/probe-*)
      # no work of its own: its tip is an ancestor of the base the fixture was cut from
      git -C "$HERE/../.." merge-base --is-ancestor "$br" HEAD 2>/dev/null &&
        git -C "$HERE/../.." branch -D "$br" >/dev/null 2>&1
      ;;
  esac
}

finish() {
  say "a=$V_a b=$V_b f=$V_f"
  printf 'a=%s b=%s f=%s\n' "$V_a" "$V_b" "$V_f" > "$RESULT"
  exit 0
}

: > "$LOG"
say "start $(date -u +%Y-%m-%dT%H:%M:%SZ)  deadline=$DEADLINE"

# ---- fixture ------------------------------------------------------------------------------
# Clear any leftover with this name FIRST: Orca suffixes the workspace when the name is taken
# (measured 2026-10-03: a leftover probe-ab turned this run's fixture into probe-ab-2 while every
# lookup below still asked for probe-ab, so (a) read NO-ENTRY and FAILED while (b) "passed" with
# nothing having run at all - the hollow PASS that (f) exists to stop).
for OLD in "$ROOT/$NAME" "$ROOT/$NAME-2" "$ROOT/$NAME-3" "$ROOT/$NAME-4"; do fixture_rm "$OLD"; done
SPAWN_OUT="$(bash "$HERE/spawn.sh" "$NAME" 2>&1)"
say "spawn: $(printf '%s' "$SPAWN_OUT" | tail -1)"
W="$(printf '%s' "$SPAWN_OUT" | sed -n 's/^PATH=//p' | head -1 | tr -d '\015')"
[ -n "$W" ] || W="$ROOT/$NAME"
# The REAL name, not the requested one: every lookup below matches on it.
NAME="$(basename "$W")"
say "worktree: $W"
if [ ! -f "$W/.dsv-worker" ]; then say "no marker - nothing to exercise"; finish; fi

# ---- dispatch -----------------------------------------------------------------------------
# start.sh takes <worktree-path> <spec-file> <task-title>; the spec is throwaway and the worker
# is told to do nothing. This run only needs a real dispatch id to exist and then to be abandoned.
# The spec must HOLD the worker, not just occupy it: measured 2026-10-03, a "reply READY and stop"
# spec settled the dispatch in well under the 20 s the (a) observation used to wait, so (a) planned
# against a finished dispatch and read live=False. The single blocking command keeps the dispatch
# live across the observation and the abandon.
printf '# probe-ab (throwaway)\n\nYour only action: run this exact command and wait for it to return.\n\n    sleep 420\n\nDo not read files, do not run any other command, do not commit. When it returns, reply with\nthe single word READY and stop.\n' > "$STATE_DIR/probe-ab.spec.md"
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
  sleep 8
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
  B_OUT="$(python "$HERE/lib/reconcile.py" --run "$RUN" --only "$NAME" --execute --json 2>/dev/null)"
  printf '%s\n' "$B_OUT" >>"$LOG"
  sleep 5
  P="$(plan_json)"
  B_SETTLE="$(printf '%s' "$B_OUT" | python -c "
import json,sys
d=json.load(sys.stdin)
e=[x for x in (d.get('executed') or []) if x.get('worktree')=='$NAME']
print(e[-1].get('settle') if e else 'NO-ENTRY')" 2>/dev/null)"
  B_ACT="$(printf '%s' "$P" | python -c "
import json,sys
d=json.load(sys.stdin)
print(','.join(next((m.get('actions') or [] for m in (d.get('managed') or []) if m['worktree']=='$NAME'), ['NO-ENTRY'])))" 2>/dev/null)"
  B_LIVE="$(printf '%s' "$P" | python -c "
import json,sys
d=json.load(sys.stdin)
print(next((bool(m.get('live')) for m in (d.get('managed') or []) if m['worktree']=='$NAME'), False))" 2>/dev/null)"
  say "(b) after execute: live=$B_LIVE actions=[$B_ACT] settle=$B_SETTLE worktree-on-disk=$([ -d "$W" ] && echo yes || echo no)"
  # settle=NO-ENTRY means reconcile never acted on the fixture at all - the reading that let a
  # never-started settle hide behind a green (b) for a whole session. The worktree surviving is
  # evidence only when something actually tried to remove it.
  if [ "$B_LIVE" = "False" ] && [ -d "$W" ] && [ "$B_SETTLE" != "NO-ENTRY" ]; then
    V_b=PASS
  else
    V_b=FAIL
  fi
  say "(b) $V_b"
fi

# ---- (f) a dispatch WITH a settlement: reconcile REMOVES the worktree ----------------------
# (b) asserted only that the worktree survived an abandon, and that reads the same whether or
# not settle.sh ever ran. That is how a settle which never started - a bare `bash` resolving to
# the WSL launcher, empty stdout, recorded as "failed" with tail "" - stayed invisible for a
# whole session: nothing asserted that settle ever ran, let alone that it removed anything.
# (f) drives the other half and asserts it: a dispatch whose task has SETTLED and which has a
# settlement on disk -> settle.sh must REMOVE the worktree and print DONE.
#
# The settlement block below is CONSTRUCTED. That is a limit of this host, not a shortcut: a real
# one needs a worker_done delivery, whose `--dispatch-capability dcap_...` token exists only in
# the worker's own dispatch preamble. Measured 2026-10-03: the preamble cannot be read back
# (`orca terminal read` with source=screen returns the last 32 rows, with source=stream returns 0
# lines), and a worker told to deliver on its own does not (two fixtures exited with no delivery
# at all; inbox/settlements.log has taken no new block since 2026-10-01). So the block is written
# in the watcher's own format naming this dispatch, which is what settle.sh's inbox fallback
# matches on. The dispatch, its task and its worktree are real.
say ""
say "=== (f) dispatch WITH a settlement -> reconcile removes the worktree ==="
V_f=NOT_EXERCISED
NAME_F="probe-settle"
W_F="$ROOT/$NAME_F"
SETTLE_INBOX="$STATE_DIR/../inbox/settlements.log"
for OLD in "$W_F" "$W_F-2" "$W_F-3" "$W_F-4"; do fixture_rm "$OLD"; done
SPAWN_F="$(bash "$HERE/spawn.sh" "$NAME_F" 2>&1)"
say "spawn(f): $(printf '%s' "$SPAWN_F" | tail -1)"
W_F="$(printf '%s' "$SPAWN_F" | sed -n 's/^PATH=//p' | head -1 | tr -d '\015')"
[ -n "$W_F" ] || W_F="$ROOT/$NAME_F"
NAME_F="$(basename "$W_F")"
say "(f) worktree: $W_F"
if [ ! -f "$W_F/.dsv-worker" ]; then
  say "(f) no marker - nothing to exercise"
else
  # The worker's job here is only to make the dispatch real and then settle it by exiting: Orca
  # marks the dispatch on its own once the worker is done, and settle.sh refuses to remove a
  # dispatch whose task has not settled. It is explicitly told NOT to deliver - measured
  # 2026-10-03 on tester-163b and on two fixtures, a worker does not send worker_done unless a
  # human is watching, and the capability token it would need cannot be recovered by the probe.
  printf '# probe-settle (throwaway)\n\nDo nothing at all: no files, no commands, no commits, no comments. Reply with the single word READY and stop.\n' > "$STATE_DIR/probe-settle.spec.md"
  SPEC_F="$STATE_DIR/probe-settle.spec.md"
  bash "$HERE/start.sh" "$W_F" "$SPEC_F" "probe-settle (f) throwaway" >>"$LOG" 2>&1 &
  START_F=$!
  DISP_F=""
  while :; do
    if expired; then say "(f) deadline hit waiting for the dispatch"; break; fi
    sleep 15
    DISP_F="$(sed -n 's/^dispatch=//p' "$W_F/.dsv-worker" 2>/dev/null | tr -d '\015' | head -1)"
    [ -n "$DISP_F" ] && break
    kill -0 "$START_F" 2>/dev/null || { say "(f) start.sh exited without a dispatch"; break; }
  done
  say "(f) dispatch=$DISP_F"
  if [ -n "$DISP_F" ]; then
    TASK_F="$(sed -n 's/.*STARTED task=\(task_[0-9a-f]*\) dispatch='"$DISP_F"'.*/\1/p' "$LOG" 2>/dev/null | tail -1)"
    say "(f) task=$TASK_F"
    # settle.sh REFUSES a dispatch that has not settled, and reconcile never settles one that is
    # still LIVE (that is case (a)), so wait for BOTH: a completed task AND a dead tree. The
    # worker above does nothing and exits on its own - that is what settles the dispatch, the
    # same way tester-163b's task came to read completed. worker-stop does NOT do it (measured
    # 2026-10-03: it leaves the task `blocked`, and `task-update --status completed` refuses while
    # the dispatch is active).
    F_STATUS="?"; F_LIVE="?"
    for _ in $(seq 1 60); do
      expired && break
      F_STATUS="$(orca orchestration task-list --run "$RUN" --json 2>/dev/null | python -c "
import json,sys
d=json.load(sys.stdin)
t=((d.get('result') or {}).get('tasks') or [])
x=[y for y in t if y.get('id')=='$TASK_F']
print((x[0].get('status') or '?') if x else 'MISSING')" 2>/dev/null)"
      F_LIVE="$(python "$HERE/lib/reconcile.py" --run "$RUN" --only "$NAME_F" --json 2>/dev/null | python -c "
import json,sys
d=json.load(sys.stdin)
m=[x for x in (d.get('managed') or []) if x.get('worktree')=='$NAME_F']
print(bool(m[0].get('live')) if m else 'NO-ENTRY')" 2>/dev/null)"
      say "(f) waiting: task=$F_STATUS live=$F_LIVE"
      case "$F_STATUS" in completed|failed) [ "$F_LIVE" = "False" ] && break;; esac
      sleep 15
    done
    say "(f) task status=$F_STATUS live=$F_LIVE"
    if ! grep -q "$DISP_F" "$SETTLE_INBOX" 2>/dev/null; then
      printf '=== SETTLEMENT %s | delivery fixture-probe-settle\nack: n/a (probe fixture - constructed by tools/orchestration/probes/reconcile-ab.sh)\ndispatch: %s\ntask: %s\nnote: constructed because a real worker_done needs the dispatch capability token, which\n  exists only in the worker preamble and cannot be read back.\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$DISP_F" "$TASK_F" >> "$SETTLE_INBOX"
    fi
    say "(f) settlement for $DISP_F is in $SETTLE_INBOX"
    kill "$START_F" 2>/dev/null || true
    sleep 5
    F_OUT="$(python "$HERE/lib/reconcile.py" --run "$RUN" --only "$NAME_F" --execute --json 2>/dev/null)"
    F_SETTLEV="$(printf '%s' "$F_OUT" | python -c "
import json,sys
d=json.load(sys.stdin)
e=[x for x in (d.get('executed') or []) if x.get('dispatch')=='$DISP_F']
print(e[-1].get('settle') if e else 'NO-ENTRY')" 2>/dev/null)"
    F_TAIL="$(printf '%s' "$F_OUT" | python -c "
import json,sys
d=json.load(sys.stdin)
e=[x for x in (d.get('executed') or []) if x.get('dispatch')=='$DISP_F']
print((e[-1].get('tail') or '') if e else '')" 2>/dev/null)"
    case "$F_TAIL" in *"DONE $DISP_F"*) F_DONE=yes;; *) F_DONE=no;; esac
    say "(f) settle=$F_SETTLEV settle-printed-DONE=$F_DONE worktree-on-disk=$([ -d "$W_F" ] && echo yes || echo no)"
    if [ "$F_SETTLEV" = "done" ] && [ "$F_DONE" = "yes" ] && [ ! -d "$W_F" ]; then
      V_f=PASS
    else
      V_f=FAIL
    fi
    say "(f) $V_f"
  fi
fi
# Whatever happened, leave nothing behind: on PASS reconcile already removed it.
kill "$START_F" 2>/dev/null || true
for _try in 1 2 3 4 5; do
  [ -d "$W_F" ] || break
  sleep 3
  for OLD in "$W_F" "$W_F-2" "$W_F-3" "$W_F-4"; do fixture_rm "$OLD"; done
done
say "(f) fixture removed: $([ -d "$W_F" ] && echo no || echo yes)"
# ...and the constructed settlement goes with it, so the inbox is left exactly as it was found.
# The block text is in this log above, and reconcile's executed record keeps the settle=done.
if [ -n "${DISP_F:-}" ]; then
  python - "$SETTLE_INBOX" "$DISP_F" >>"$LOG" 2>&1 <<'PY'
import io, sys
p, d = sys.argv[1], sys.argv[2]
s = io.open(p, encoding="utf-8", errors="replace").read()
segs = s.split("=== SETTLEMENT")
keep = [segs[0]]
dropped = False
for seg in segs[1:]:
    if d in seg and "fixture-probe-settle" in seg:
        dropped = True
        continue
    keep.append(seg)
if dropped:
    io.open(p, "w", encoding="utf-8", newline="").write("=== SETTLEMENT".join(keep))
    print("(f) settlement block for %s removed from %s" % (d, p))
else:
    print("(f) no settlement block for %s to remove" % d)
PY
fi

# ---- clean up what this run made ----------------------------------------------------------
kill "$START_PID" 2>/dev/null || true
for _try in 1 2 3 4 5; do
  sleep 3
  for OLD in "$W" "$W-2" "$W-3" "$W-4"; do fixture_rm "$OLD"; done
  [ -d "$W" ] || break
done
say "fixture removed: $([ -d "$W" ] && echo no || echo yes)"
finish
