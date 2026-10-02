#!/usr/bin/env bash
# Reconcile probe: five cases, raw before/after for each. Read the output, do not trust a summary.
#
#   (a) normal settle path            - a managed worktree whose dispatch is finished is settled by
#                                       the reconcile pass, and its tree is gone afterwards.
#   (b) dispatch without a settlement - the tree is reaped anyway (RAM), the worktree is KEPT as
#                                       evidence (settle.sh refuses without a settlement).
#   (c) unmarked worktree with a running opencode - untouched, byte for byte.
#   (d) live worker                   - untouched.
#   (e) worker held in wait-capacity  - the marker says state=starting until worker-start returns,
#                                       so the whole wait is protected; reconcile must show no action.
#
# (a) and (b) can only be observed when a managed worktree with a dispatch exists; when none does,
# they are reported as not observable rather than failing. A case that cannot happen is not a
# failure - a case that happens and gets the wrong treatment is.
#
# This probe waits for capacity instead of refusing: it calls wait-capacity.sh (60 min) and runs by
# itself when the host frees memory. Refusing only on timeout is what keeps a human out of the loop.
#
# Usage: reconcile.probe.sh [--keep]     (--keep leaves the scratch dir behind for inspection)
set -uo pipefail

# HERE must be a NATIVE path (D:/...), not the MSYS form (/d/...): python, node and orca are
# native binaries and do not translate /d/code into D:\code. `pwd -W` is MSYS's Windows form.
HERE="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
LIB="$HERE/lib"
RUN="${PROBE_RUN:-run_4e539259ab29}"
KEEP="${1:-}"
SCRATCH="${LOCALAPPDATA:-$HOME}/Temp/reconcile-probe"
FAILS=0

say() { printf 'probe: %s\n' "$*"; }
fail() { FAILS=$((FAILS + 1)); say "FAIL $*"; }
pass() { say "PASS $*"; }

avail_mb() {
  powershell.exe -NoProfile -NonInteractive -Command \
    "'{0}' -f [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024,0)" \
    2>/dev/null | tr -d '\r'
}

plan() { python "$LIB/reconcile.py" --run "$RUN" --json 2>/dev/null; }

trees() { python "$LIB/opencode_trees.py" --all 2>/dev/null; }

# The plan is parsed ONCE, from a file, by python. An earlier version piped it through `node -e`
# one-liners nested two layers deep in quotes; those printed "?" instead of a number when they
# broke, and a "?" was then reported as a failure. One parse, one file, no nesting.
PLAN_JSON=""
plan_file() {
  mkdir -p "$SCRATCH"
  PLAN_JSON="$SCRATCH/plan.json"
  plan > "$PLAN_JSON" 2>/dev/null
  if [ ! -s "$PLAN_JSON" ]; then
    # stderr: stdout of this function is the path itself, and a message caught there becomes the
    # path (that is how an earlier version turned its own error into a filename).
    printf 'probe: FATAL: the plan produced no JSON (reconcile.py failed) - nothing can be judged\n' >&2
    exit 2
  fi
  printf '%s' "$PLAN_JSON"
}

# jget <file> <python-expression over d>   - prints "?" only when the parse itself fails, and a
# parse failure is a failure of the probe, never silently a value.
jget() {
  python -c "import json,sys
d=json.load(open(sys.argv[1]))
print(eval(sys.argv[2]))" "$1" "$2" 2>/dev/null || printf '?'
}

# ---------------- preconditions ----------------
A="$(avail_mb)"
say "available_mb=$A  run=$RUN"
if [ "${A:-0}" -lt 600 ]; then
  # Do not make a human re-trigger this. Wait for the host to free itself, the same way a
  # dispatch does, and refuse only when the wait itself times out.
  say "available_mb=$A is under the 600 MB dispatch floor; waiting up to 60 min for capacity"
  bash "$HERE/wait-capacity.sh" --min 600 --timeout 60 --note "reconcile probe a-e" >&2 || {
    say "REFUSING: capacity did not reach 600 MB within 60 min (wait-capacity exit $?)"
    exit 3
  }
  A="$(avail_mb)"
  say "capacity arrived: available_mb=$A"
fi

rm -rf "$SCRATCH"; mkdir -p "$SCRATCH"
say "=== BEFORE: every opencode tree on the host ==="
trees | sed 's/^/  /'
BEFORE="$(trees)"
PF="$(plan_file)"
say "plan written to $PF"

# ---------------- (c) unmarked worktree with a running opencode is untouched ----------------
say ""
say "=== (c) unmarked worktree ==="
UNMANAGED="$(jget "$PF" '" ".join(u["worktree"] for u in (d.get("unmanaged") or []))')"
if [ "$UNMANAGED" = "?" ]; then
  fail "could not read the unmanaged list out of the plan"
elif [ -z "$UNMANAGED" ]; then
  say "no unmarked worktree right now - case (c) not observable this run"
else
  say "unmarked candidates: $UNMANAGED"
  for U in $UNMANAGED; do
    if printf '%s' "$BEFORE" | grep -q "$U"; then
      pass "unmarked worktree ($U) holds a live opencode tree and the plan still calls it unmanaged"
    else
      say "  ($U is unmarked but holds no tree right now - nothing to protect)"
    fi
  done
fi

# ---------------- (d) a live worker is untouched ----------------
say ""
say "=== (d) live worker ==="
LIVE="$(jget "$PF" 'json.dumps(d.get("live_handles") or [])')"
LIVE_MANAGED="$(jget "$PF" 'sum(1 for m in (d.get("managed") or []) if m.get("live"))')"
LIVE_ACTIONED="$(jget "$PF" 'sum(1 for m in (d.get("managed") or []) if m.get("live") and (m.get("actions") or []))')"
say "live handles: $LIVE"
say "  managed entries marked live: $LIVE_MANAGED"
case "$LIVE_MANAGED$LIVE_ACTIONED" in
  *\?*) fail "could not read the live set out of the plan" ;;
  0*|*0) if [ "$LIVE_MANAGED" = "0" ]; then
           say "  no live dispatch right now - case (d) not observable this run"
         elif [ "$LIVE_ACTIONED" = "0" ]; then
           pass "every live managed worktree ($LIVE_MANAGED of them) gained no action"
         else
           fail "a live managed worktree gained actions"
         fi ;;
esac
say "  plan:"
sed 's/^/    /' "$PF" | head -3

# ---------------- (a)+(b): a managed worktree with a dispatch that is not live ----------------
say ""
say "=== (a) normal settle path / (b) dispatch without a settlement ==="
FINISHED="$(jget "$PF" '" ".join(m["worktree"] for m in (d.get("managed") or []) if not m.get("live") and m.get("dispatch"))')"
NO_DISP="$(jget "$PF" '" ".join(m["worktree"] for m in (d.get("managed") or []) if not m.get("live") and not m.get("dispatch"))')"
if [ "$FINISHED" = "?" ] || [ "$NO_DISP" = "?" ]; then
  fail "could not read the finished/no-dispatch split out of the plan"
else
  say "  managed + dispatch + not live (settle path candidates): ${FINISHED:--}"
  say "  managed + no dispatch + not live (keep-as-evidence):   ${NO_DISP:--}"
  if [ -z "$FINISHED" ] && [ -z "$NO_DISP" ]; then
    say "  no managed worktree is waiting to be reaped - cases (a)/(b) not observable this run"
    say "  (a real run of (b) is on record: tester-163f/tester-172805, trees 33192/29848 killed,"
    say "   both worktrees kept on disk - see the task thread)"
  else
    say "  running the pass over them:"
    python "$LIB/reconcile.py" --run "$RUN" --json --execute 2>/dev/null | sed 's/^/    /' | head -2
    for W in $FINISHED $NO_DISP; do
      if printf '%s' "$(trees)" | grep -q "$W"; then
        fail "($W) still holds an opencode tree after the pass"
      else
        pass "($W) tree reaped; worktree still on disk: $([ -d "$(jget "$PF" '"".join(m["path"] for m in (d.get("managed") or []) if m["worktree"]==sys.argv[3])' "$W")" ] && echo yes || echo NO)"
      fi
    done
  fi
fi

# ---------------- (e) a worker held in wait-capacity is untouched ----------------
say ""
say "=== (e) worker held in wait-capacity ==="
say "start.sh writes the marker before it waits, and worker-start - which promotes the marker to"
say "state=dispatched - runs only AFTER wait-capacity returns. The whole wait is inside the"
say "starting window, so reconcile must show no actions for such a worktree."
STARTERS="$(jget "$PF" '" | ".join(m["worktree"]+" actions="+(",".join(m.get("actions") or []) or "-") for m in (d.get("managed") or []) if m.get("starting_recent")) or "none"')"
say "  managed worktrees protected as starting: $STARTERS"
case "$STARTERS" in
  \?) fail "could not read the starting set out of the plan" ;;
  none) say "  no worktree is mid-start right now - case (e) not observable this run" ;;
  *actions=-) pass "a starting worktree is protected and gained no action" ;;
  *) fail "a starting worktree gained actions: $STARTERS" ;;
esac

say ""
if [ "$FAILS" -eq 0 ]; then
  say "NO FAILURES - every case that was observable behaved correctly"
  say "(cases reported as not observable had no matching state on this host)"
  [ -n "$KEEP" ] || rm -rf "$SCRATCH"
  exit 0
fi
say "$FAILS FAILURE(S)"
exit 1
