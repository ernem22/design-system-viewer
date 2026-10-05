#!/usr/bin/env bash
# dispatcher-host.probe.sh - measure worker.sh + dispatch.sh on the host. MEASURE ONLY.
# Run from the coordinator (Hermes) terminal - worker-start is fenced to it:
#   git show origin/claude/friendly-goodall-2hrqac:tools/orchestration/probes/dispatcher-host.probe.sh > /d/code/test-pr199.sh && bash /d/code/test-pr199.sh
# Uses its own state dir, never merges (close.sh is held off), starts at most TWO throwaway
# workers (one direct, one through the dispatcher), each closed and removed by the code under test.
# Output: $LOCALAPPDATA/orca-orchestration/test-pr199.txt  (last line: path + line count)
set -u
OUT="${LOCALAPPDATA}/orca-orchestration/test-pr199.txt"; : > "$OUT"
ROOT="${PROBE_ROOT:-D:/code/design-system-viewer}"
WT="${PROBE_CODE_WT:-$(dirname "$ROOT")/pr199-code}"
BR="claude/friendly-goodall-2hrqac"
T="${LOCALAPPDATA}/orca-orchestration/pr199-test"      # isolated LOCALAPPDATA for the code under test
sec() { printf '\n===== %s  [%s]\n' "$1" "$(date -u +%H:%M:%SZ)" >> "$OUT"; }
run() { printf '$ %s\n' "$*" >> "$OUT"; "$@" >> "$OUT" 2>&1; printf '[rc=%s]\n' "$?" >> "$OUT"; }
# the code under test, with its own state dir and close.sh held off (no merges during the test)
ut() { LOCALAPPDATA="$T" CLOSE_EVERY=99999999999 DISPATCH_INTERVAL=15 "$@"; }

sec "0: context"
run orca orchestration run-current --json
echo "ORCA_TERMINAL_HANDLE=${ORCA_TERMINAL_HANDLE:-unset}" >> "$OUT"
ls "${LOCALAPPDATA}/orca-orchestration/design-system-viewer/state/" 2>&1 | grep -i reconcile >> "$OUT"

sec "1: PR #199 code into its own worktree (code only; the main checkout is not touched)"
run git -C "$ROOT" fetch origin "$BR"
[ -d "$WT" ] || run git -C "$ROOT" worktree add --detach "$WT" "origin/$BR"
run git -C "$WT" checkout --detach "origin/$BR"
run git -C "$WT" log --oneline -5
O="$WT/tools/orchestration"
mkdir -p "$T"

sec "2: static checks"
for f in "$O"/worker.sh "$O"/dispatch.sh "$O"/needs.sh "$O"/prep-tester.sh "$O"/close.sh; do run bash -n "$f"; done
run node "$O/gate-logic.probe.cjs"
run node -e "for (const f of ['write','readonly']) JSON.parse(require('fs').readFileSync('$O/roles/'+f+'.opencode.json','utf8')); console.log('roles json ok')"

sec "3: needs.sh against real GitHub (read-only)"
run ut bash "$O/needs.sh"

SPEC="$T/probe-spec.txt"
printf 'Run: sleep 30. Then send worker_done using the exact command in your preamble with body READY. Do nothing else.\n' > "$SPEC"

sec "4: worker.sh run - one throwaway READ-ONLY worker, start -> wait -> close"
run ut bash "$O/worker.sh" run "pr199-direct" "origin/refactor/full-react-migration" "$SPEC" "pr199 direct probe" --readonly --deadline 600
sec "4: leftovers after worker.sh run"
run git -C "$ROOT" worktree list
orca terminal list --json 2>/dev/null | grep -c 'pr199-direct' | sed 's/^/terminals naming pr199-direct: /' >> "$OUT"
run tail -20 "$T/orca-orchestration/design-system-viewer/worker.log"

Q="$T/orca-orchestration/design-system-viewer/queue"; mkdir -p "$Q"
printf 'name: pr199-queued\nbase: origin/refactor/full-react-migration\nrole: reviewer\ntitle: pr199 dispatcher probe\ndeadline: 600\n---\n' > "$Q/010-probe.spec"
cat "$SPEC" >> "$Q/010-probe.spec"

sec "5: dispatcher SHADOW pass (no dispatch.enabled) - must start nothing"
run ut bash "$O/dispatch.sh" --once
run ut bash "$O/dispatch.sh" --status

sec "6: dispatcher ACTING - pass 1 starts, pass 2 waits it out, closes, records"
touch "$T/orca-orchestration/design-system-viewer/dispatch.enabled"
run ut bash "$O/dispatch.sh" --once
run ut bash "$O/dispatch.sh" --status
run ut bash "$O/dispatch.sh" --once
rm -f "$T/orca-orchestration/design-system-viewer/dispatch.enabled"
run ut bash "$O/dispatch.sh" --status
for f in "$T"/orca-orchestration/design-system-viewer/done/*; do [ -f "$f" ] && { echo "--- $f" >> "$OUT"; tail -14 "$f" >> "$OUT"; }; done

sec "7: leftovers after the dispatcher"
run git -C "$ROOT" worktree list
orca terminal list --json 2>/dev/null | grep -c 'pr199-' | sed 's/^/terminals naming pr199-: /' >> "$OUT"
run tail -30 "$T/orca-orchestration/design-system-viewer/dispatch.log"

sec "SUMMARY (grep, no interpretation)"
{
  echo "rc!=0 count: $(grep -c '^\[rc=[1-9]' "$OUT")"
  echo "probes: $(grep -m1 -E 'PROBES PASS|FAIL' "$OUT")"
  echo "worker.sh outcome: $(grep -m1 '^OUTCOME=' "$OUT")  closed: $(grep -m1 '^CLOSED=' "$OUT")"
  echo "shadow line: $(grep -m1 'DRY RUN' "$OUT" | cut -c1-120)"
  echo "dispatcher results: $(ls "$T"/orca-orchestration/design-system-viewer/done 2>/dev/null | tr '\n' ' ')"
  echo "worktrees named pr199- still in git: $(git -C "$ROOT" worktree list | grep -c 'pr199-direct\|pr199-queued')"
} >> "$OUT"
echo "$OUT $(wc -l < "$OUT") lines"
