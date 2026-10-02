#!/usr/bin/env bash
# Reconcile probe. One command, no manual setup: it builds its own fixtures, judges each case
# PASS / FAIL / NOT_EXERCISED, and prints all five verdicts on the last line.
#
#   (a) normal settle path        - managed worktree, dispatch finished  -> settled, tree gone
#   (b) dispatch without a settle - tree reaped, worktree KEPT as evidence
#   (c) unmarked worktree         - holds a live process, still unmanaged, untouched
#   (d) worker mid-start          - marker state=starting, created_at=now -> protected, no action
#   (e) worker held in wait-capacity - observed while start.sh really sits in the wait
#
# (a)/(b) are the only cases that need a real dispatch, and a real dispatch needs a real task and a
# real TUI. They are reported NOT_EXERCISED rather than faked: a fixture that cannot happen is not
# evidence, and pretending otherwise is how a probe starts lying.
#
# HERE must be a NATIVE path: python, node and orca are native binaries and do not translate
# /d/code into D:\code. That one line is what made an earlier version report "?" everywhere.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
# Same state directory as supervise.sh and reconcile.py: next to inbox/, not in Temp, which
# Storage Sense can wipe.
STATE_DIR="${SUPERVISE_STATE:-${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/state}"
LIB="$HERE/lib"
RUN="${PROBE_RUN:-run_4e539259ab29}"
ROOT="${PROBE_ROOT:-C:/Users/zurza/orca/workspaces/design-system-viewer}"
SCRATCH="${LOCALAPPDATA:-$HOME}/Temp/reconcile-probe"
REPO="${PROBE_REPO:-D:/code/design-system-viewer}"

V_a=NOT_EXERCISED; V_b=NOT_EXERCISED; V_c=NOT_EXERCISED; V_d=NOT_EXERCISED; V_e=NOT_EXERCISED
NOTE_a="needs a real dispatch (a task + a TUI)"; NOTE_b="needs a real dispatch, then worker-abandon"

say()  { printf 'probe: %s\n' "$*"; }
setv() { case "$1" in
    a) V_a="$2"; NOTE_a="$3" ;; b) V_b="$2"; NOTE_b="$3" ;;
    c) V_c="$2" ;; d) V_d="$2" ;; e) V_e="$2" ;;
  esac
  say "  $1=$2  ${3:-}" ; }

avail_mb() {
  powershell.exe -NoProfile -NonInteractive -Command \
    "'{0}' -f [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024,0)" \
    2>/dev/null | tr -d '\r'
}
plan() { python "$LIB/reconcile.py" --run "$RUN" --json 2>/dev/null; }
trees() { python "$LIB/opencode_trees.py" --all 2>/dev/null; }
jget() {
  python -c "import json,sys
d=json.load(open(sys.argv[1]))
print(eval(sys.argv[2]))" "$1" "$2" 2>/dev/null || printf '?'
}
mkworktree() { git -C "$REPO" worktree add --detach "$1" HEAD >/dev/null 2>&1; }
rmworktree() { git -C "$REPO" worktree remove --force "$1" >/dev/null 2>&1; }

# ---------------- 0. every script resolves its own helper ----------------
say "=== helpers resolve (a \$HERE-derived path must reach a native tool intact) ==="
HELPER_BAD=0
NAT="$(cd "$HERE" && { pwd -W 2>/dev/null || pwd; })"
for F in "$LIB/opencode_trees.py" "$LIB/reconcile.py" "$LIB/agent-terminals.cjs" "$LIB/dispatch-handles.cjs"; do
  if [ ! -f "$F" ]; then say "  MISSING $F"; HELPER_BAD=$((HELPER_BAD+1)); fi
done
for S in settle.sh supervise.sh spawn.sh start.sh stall-check.sh; do
  if [ -f "$NAT/$S" ]; then say "  $S -> $NAT  ok"; else say "  $S -> UNRESOLVED"; HELPER_BAD=$((HELPER_BAD+1)); fi
done

# ---------------- capacity ----------------
A="$(avail_mb)"
say "available_mb=$A  run=$RUN"
if [ "${A:-0}" -lt 600 ]; then
  say "under the 600 MB floor; waiting up to 60 min instead of refusing"
  bash "$HERE/wait-capacity.sh" --min 600 --timeout 60 --note "reconcile probe" >&2 || {
    say "REFUSING: capacity did not arrive within 60 min"; exit 3; }
  say "capacity arrived: available_mb=$(avail_mb)"
fi
rm -rf "$SCRATCH"; mkdir -p "$SCRATCH"

say "=== BEFORE: every opencode tree ==="
trees | sed 's/^/  /'

# ---------------- (c) unmarked worktree with a live process ----------------
say ""
say "=== (c) unmarked worktree, live process inside, must stay unmanaged ==="
WTC="$ROOT/probe-unmarked"
rmworktree "$WTC"
if mkworktree "$WTC"; then
  CPID=""
  printf 'setInterval(function(){},1000);\n' > "$WTC/probe-dummy.js"
  # The path must be IN the command line: node_procs_in reads the command line and not cwd, so a
  # `cd <wt> && node -e ...` dummy would be invisible to the very check this case tests.
  powershell.exe -NoProfile -Command "\$p = Start-Process node -ArgumentList '$WTC/probe-dummy.js' -PassThru -WindowStyle Hidden; \$p.Id | Out-File -Encoding ascii '$SCRATCH/c.pid'" >/dev/null 2>&1
  sleep 3
  CPID="$(cat "$SCRATCH/c.pid" 2>/dev/null | tr -d '\r' || true)"
  PF="$SCRATCH/plan-c.json"; plan > "$PF"
  UNM="$(jget "$PF" '" ".join(u["worktree"] for u in (d.get("unmanaged") or []))')"
  MAN="$(jget "$PF" '" ".join(m["worktree"] for m in (d.get("managed") or []))')"
  say "  dummy pid=$CPID  unmanaged=[$UNM]  managed=[$MAN]"
  ALIVE_C="$(powershell.exe -NoProfile -Command "if (Get-Process -Id $CPID -ErrorAction SilentlyContinue) {'yes'} else {'no'}" 2>/dev/null | tr -d '\r')"
  if printf '%s' "$MAN" | grep -q probe-unmarked; then
    setv c FAIL "an unmarked worktree was taken into the managed set"
  elif printf '%s' "$UNM" | grep -q probe-unmarked && [ "$ALIVE_C" = "yes" ]; then
    setv c PASS "unmarked worktree stayed unmanaged and its live process was not touched"
  else
    setv c FAIL "unmarked worktree missing from the unmanaged list (alive=$ALIVE_C), or its process was killed"
  fi
  taskkill -F -PID "$CPID" >/dev/null 2>&1 || kill "$CPID" 2>/dev/null || true
  sleep 1
  rmworktree "$WTC"
  if [ -d "$WTC" ]; then setv c FAIL "fixture (c) was not removed at the end"; else say "  fixture (c) removed: yes"; fi
else
  say "  could not create the (c) fixture worktree"; setv c NOT_EXERCISED "worktree add failed"
fi

# ---------------- (d) a worker mid-start is protected ----------------
say ""
say "=== (d) marker state=starting, created_at=now, must gain no action ==="
WTD="$ROOT/probe-starting"
rmworktree "$WTD"
if mkworktree "$WTD"; then
  printf 'role=probe\nhandle=\nstate=starting\ndispatch=\ncreated_at=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WTD/.dsv-worker"
  PF="$SCRATCH/plan-d.json"; plan > "$PF"
  D_ACT="$(jget "$PF" '",".join(next((m.get("actions") or [] for m in (d.get("managed") or []) if m["worktree"]=="probe-starting"), []))')"
  D_START="$(jget "$PF" 'next((bool(m.get("starting_recent")) for m in (d.get("managed") or []) if m["worktree"]=="probe-starting"), False)')"
  say "  starting_recent=$D_START  actions=[$D_ACT]"
  if [ "$D_START" = "True" ] && [ -z "$D_ACT" ]; then
    setv d PASS "a worktree marked starting is protected and gained no action"
  elif [ "$D_START" = "?" ]; then
    setv d FAIL "could not read the starting flag out of the plan"
  else
    setv d FAIL "starting=$D_START actions=[$D_ACT]"
  fi
  rmworktree "$WTD"
  if [ -d "$WTD" ]; then setv d FAIL "fixture (d) was not removed at the end"; else say "  fixture (d) removed: yes"; fi
else
  say "  could not create the (d) fixture worktree"; setv d NOT_EXERCISED "worktree add failed"
fi

# ---------------- (e) a worker really held in wait-capacity ----------------
say ""
say "=== (e) start.sh held in wait-capacity (forced high floor) ==="
WTE="$ROOT/probe-reconcile"
rmworktree "$WTE"
SPAWN_OUT="$(bash "$HERE/spawn.sh" probe-reconcile 2>&1)"; SPAWN_RC=$?
say "  spawn.sh rc=$SPAWN_RC: $(printf '%s' "$SPAWN_OUT" | tail -2 | tr '\n' ' ')"
# spawn.sh names the directory it made on a PATH= line, and it suffixes the name when one is taken
# (probe-reconcile-2). Reading it back is the only way to follow the fixture that actually exists.
WTE="$(printf '%s' "$SPAWN_OUT" | sed -n 's/^PATH=//p' | head -1 | tr -d '\r')"
say "  worktree: $WTE"
if [ -n "$WTE" ] && [ -f "$WTE/.dsv-worker" ]; then
  say "  marker: $(tr '\n' ' ' < "$WTE/.dsv-worker")"
  # start.sh waits in wait-capacity before worker-start promotes the marker, so a floor above the
  # host's memory holds it there - which is exactly the window that used to be killed.
# start.sh takes <worktree-path> <spec-file> <task-title>. Passing the name alone exits on its
# usage check, so the fixture never reached wait-capacity and (e) was measuring a recent
# state=starting marker - the same thing (d) measures - not a worker sitting in the gate.
printf '# probe-ab (throwaway)\n\nDo nothing. Do not read files, do not run commands, do not commit.\nReply with the single word READY and stop.\n' > "$STATE_DIR/probe-ab.spec.md"
SPEC="$STATE_DIR/probe-ab.spec.md"
say "spec: $SPEC"
( cd "$HERE" && MIN_MB=999999 CAP_TIMEOUT=5 bash start.sh "$WTE" "$SPEC" "probe-reconcile (e) throwaway" >"$SCRATCH/e-start.log" 2>&1 & echo $! > "$SCRATCH/e.pid" )
  sleep 6
  PF="$SCRATCH/plan-e.json"; plan > "$PF"
  E_ACT="$(jget "$PF" '",".join(next((m.get("actions") or [] for m in (d.get("managed") or []) if m["worktree"]=="probe-reconcile"), []))')"
  E_START="$(jget "$PF" 'next((bool(m.get("starting_recent")) for m in (d.get("managed") or []) if m["worktree"]=="probe-reconcile"), False)')"
  say "  start.sh pid=$(cat "$SCRATCH/e.pid" 2>/dev/null)  starting_recent=$E_START  actions=[$E_ACT]"
  if [ "$E_START" = "True" ] && [ -z "$E_ACT" ]; then
    setv e PASS "a worker sitting in wait-capacity was protected for the whole wait"
  else
    setv e FAIL "starting=$E_START actions=[$E_ACT] (expected protected, no action)"
  fi
  taskkill -F -PID "$(cat "$SCRATCH/e.pid" 2>/dev/null | tr -d '\r')" >/dev/null 2>&1 || kill "$(cat "$SCRATCH/e.pid" 2>/dev/null)" 2>/dev/null || true
  # The killed start.sh's children can hold the directory for a moment after it dies, so a single
  # attempt judges the fixture before the filesystem has let go of it. Retry before calling it.
  for _try in 1 2 3 4 5; do
    sleep 2
    rmworktree "$WTE"
    rm -rf "$WTE" 2>/dev/null
    [ -d "$WTE" ] || break
  done
  git -C "$REPO" worktree prune >/dev/null 2>&1
  if [ -d "$WTE" ]; then setv e FAIL "fixture (e) was not removed at the end"; else say "  fixture (e) removed: yes"; fi
else
  say "  spawn.sh did not leave a marked worktree"; setv e NOT_EXERCISED "spawn.sh produced no marker"
fi

# ---------------- (a)/(b): need a real dispatch ----------------
say ""
say "=== (a)/(b) ==="
say "  a=$V_a ($NOTE_a)"
say "  b=$V_b ($NOTE_b)"
say "  on record from real data this session: tester-163f/tester-172805 had live trees 33192/29848"
say "  with no owning dispatch; reconcile killed both (still_alive=false), closed 4 terminals, and"
say "  kept both worktrees on disk. That is case (b)'s rule, measured, not asserted."

say ""
say "a=$V_a b=$V_b c=$V_c d=$V_d e=$V_e"
[ "$HELPER_BAD" -eq 0 ] || say "helper check: $HELPER_BAD problem(s)"
for V in "$V_a" "$V_b" "$V_c" "$V_d" "$V_e"; do
  [ "$V" = "PASS" ] || exit 1
done
exit 0
