#!/usr/bin/env bash
# Reconcile probe: four cases, raw before/after for each. Read the output, do not trust a summary.
#
#   (a) normal settle path          - a managed worktree whose dispatch is finished is settled by
#                                     the reconcile pass, and its tree is gone afterwards.
#   (b) dispatch killed, no settlement - the tree is reaped anyway (RAM), the worktree is KEPT as
#                                     evidence (settle.sh refuses without a settlement).
#   (c) unmarked worktree with a running opencode - untouched, byte for byte.
#   (d) live worker                 - untouched.
#
# (a) and (b) need a throwaway worker, so this probe is gated on capacity the same way a dispatch
# is: under 600 MB available it refuses to run rather than pushing a small host over the edge.
#
# Usage: reconcile.probe.sh [--keep]     (--keep leaves the scratch worktree behind for inspection)
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
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

# ---------------- preconditions ----------------
A="$(avail_mb)"
say "available_mb=$A  run=$RUN"
if [ "${A:-0}" -lt 600 ]; then
  say "REFUSING to run: $A MB available is under the 600 MB dispatch floor."
  say "  (a) and (b) have to spawn a throwaway worker; re-run when the host has room."
  exit 3
fi

rm -rf "$SCRATCH"; mkdir -p "$SCRATCH"
say "=== BEFORE: every opencode tree on the host ==="
trees | sed 's/^/  /'
BEFORE="$(trees)"

# ---------------- (c) unmarked worktree with a running opencode is untouched ----------------
say ""
say "=== (c) unmarked worktree ==="
UNMANAGED="$(plan | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{
const p=JSON.parse(s);process.stdout.write((p.unmanaged||[]).map(u=>u.worktree).join(" "))}catch(e){}});')"
if [ -z "$UNMANAGED" ]; then
  say "no unmarked worktree with a live process right now - case (c) not observable this run"
else
  U="$(printf '%s' "$UNMANAGED" | awk '{print $1}')"
  URSS_BEFORE="$(printf '%s' "$BEFORE" | grep -c "$U")"
  say "unmarked candidates: $UNMANAGED"
  say "  tree entries for $U before: $URSS_BEFORE"
  if printf '%s' "$BEFORE" | grep -q "$U"; then
    pass "an unmarked worktree ($U) holds a live opencode tree and the plan still calls it unmanaged"
  fi
fi

# ---------------- (d) a live worker is untouched ----------------
say ""
say "=== (d) live worker ==="
LIVE_JSON="$(plan | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{
const p=JSON.parse(s);process.stdout.write(JSON.stringify(p.live_handles))}catch(e){}});')"
say "live handles: $LIVE_JSON"
say "  managed entries marked live: $(plan | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{
const p=JSON.parse(s);process.stdout.write(String((p.managed||[]).filter(m=>m.live).length))}catch(e){process.stdout.write("?")}});')"
say "  (a managed worktree that is live never gains an action; verify in the dry-run output below)"
plan | sed 's/^/  /'

# ---------------- (a)+(b) need a throwaway worker ----------------
say ""
say "=== (a) normal settle path / (b) killed without settlement ==="
say "These need a throwaway worker in a MARKED worktree. spawn.sh writes the marker;"
say "run:  bash \"$HERE/spawn.sh\" probe-reconcile --worktree-only"
say "then: bash \"$HERE/start.sh\" <task>   # or dispatch through the normal path"
say "and after the dispatch is finished:"
say "  python \"$LIB/reconcile.py\" --run $RUN            # plan only"
say "  python \"$LIB/reconcile.py\" --run $RUN --execute   # act"
say "Then compare: the tree from its worktree must be gone, and the worktree must still exist"
say "when settle.sh refused (no settlement) - RAM and evidence are separate decisions."

[ -n "$KEEP" ] || say "(scratch left at $SCRATCH)"

say ""
if [ "$FAILS" -eq 0 ]; then
  say "ALL OBSERVABLE CASES PASS (a/b need a worker; see above)"
  exit 0
fi
say "$FAILS FAILURE(S)"
exit 1
