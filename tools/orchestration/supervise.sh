#!/usr/bin/env bash
# Watch the LIVE dispatches, not just the delivery queue, and act on a stall.
#
# Why: every tool built today DETECTS but none of them ACTS, and the watcher cannot see a stall at
# all - `check --wait` blocks on a message that a stalled worker will never send. Measured
# 2026-09-28: two workers died (a Bun panic; a hung generation) and both were only noticed when the
# owner asked "is it stale?". Detection that needs a human to ask is not automation.
#
#   supervise.sh [--interval 120] [--act] [--run <id>] [--max-recoveries 3] [--once]
#
# Every cycle, for each dispatch whose dispatchStatus is `dispatched`:
#   1. resolve its agent terminal and worktree,
#   2. take two counter readings a short interval apart, plus the sampler's pid record,
#   3. PROGRESSING / TOOL_ACTIVE / SETTLED -> say nothing (the watcher owns settlements),
#      STALL or EXITED -> write a durable inbox item and, with --act, recover:
#         worker-abandon --dispatch <old>
#         spawn.sh <role> <base>            (a fresh worktree and terminal)
#         worker-start --task <task> --retry-of <old>
#
# --act is off by default: it is the switch that turns a report into a mutation. Without it this
# script only writes the inbox item, so it can be run anywhere without side effects.
#
# Role and base are derived from the task title (`reviewer #162: ...`, `fixer #163: ...`): a reviewer
# rebases on the base branch, a fixer/coder on the PR's own branch when one is open for the number in
# the title, so a recovery lands on the same PR instead of opening a new one.
set -uo pipefail

INTERVAL=120; ACT=""; RUN=""; MAX_REC=3; ONCE=""; READ_GAP=20
while [ $# -gt 0 ]; do
  case "$1" in
    --interval) INTERVAL="${2:?}"; shift 2;;
    --act) ACT=1; shift;;
    --once) ONCE=1; shift;;
    --max-recoveries) MAX_REC="${2:?}"; shift 2;;
    --run) RUN="${2:?}"; shift 2;;
    -*) echo "supervise: unknown flag $1" >&2; exit 2;;
    *) shift;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
if [ -z "$RUN" ]; then
  RUN="$(orca orchestration run-current --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((((JSON.parse(s).result||{}).run)||{}).id||"")}catch(e){}})')"
  [ -n "$RUN" ] || { echo "supervise: no run readable (orca orchestration run-current)" >&2; exit 2; }
fi
BASE="${SUPERVISE_BASE:-origin/refactor/full-react-migration}"
INBOX_DIR="${INBOX_DIR:-${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/inbox}"
LOG="${SUPERVISE_LOG:-${LOCALAPPDATA:-$HOME}/Temp/supervise.log}"
STATE_DIR="${SUPERVISE_STATE:-${LOCALAPPDATA:-$HOME}/Temp/supervise-state}"
RECOVERIES=0

say() { printf '%s supervise: %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$LOG"; }

workers_json() { orca orchestration worker-list --run "$RUN" --json 2>/dev/null; }
# Task titles live in task-list, not in the worker list; recover() derives the role and the PR number
# from the title, so an empty title would silently disable recovery.
task_titles_json() { orca orchestration task-list --run "$RUN" --json 2>/dev/null; }

# One cycle: report the live dispatches and their verdicts.
cycle() {
  local W JSON n=0
  JSON="$(workers_json)"
  [ -n "$JSON" ] || { say "could not read the worker list; skipping this cycle"; return; }
  while IFS='|' read -r DISP TASK TERM TITLE; do
    [ -n "$DISP" ] || continue
    n=$((n+1))
    local V
    V="$(bash "$HERE/stall-check.sh" "$DISP" --interval "$READ_GAP" --json 2>/dev/null \
         | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).verdict)}catch(e){process.stdout.write("UNKNOWN")}})')"
    case "$V" in
      PROGRESSING|TOOL_ACTIVE|SETTLED) say "$DISP ($TITLE) -> $V" ;;
      STALL|EXITED)
        say "$DISP ($TITLE) -> $V  *** needs recovery"
        {
          printf '# Supervisor: %s on %s\n\n' "$V" "$DISP"
          printf -- '- task: %s\n- title: %s\n- verdict: %s\n- at: %s\n- run: %s\n' \
            "$TASK" "$TITLE" "$V" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RUN"
          printf '\nThe worker is not producing: %s. The supervisor %s.\n' \
            "$V" "$([ -n "$ACT" ] && echo 'recovered it (abandon + retry)' || echo 'only reported it (run with --act to recover)')"
        } > "$INBOX_DIR/$(date -u +%Y%m%dT%H%M%SZ)-supervise-$DISP-$V.md"
        [ -n "$ACT" ] && recover "$DISP" "$TASK" "$TITLE" "$V"
        ;;
      *) say "$DISP ($TITLE) -> $V (could not decide; leaving it alone)" ;;
    esac
  done < <(printf '%s\n---SPLIT---\n%s' "$JSON" "$(task_titles_json)" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{
    const parts=s.split("\n---SPLIT---\n");
    const w=(JSON.parse(parts[0]).result||{}).workers||[];
    const titles={};
    try{ for(const t of ((JSON.parse(parts[1]).result||{}).tasks||[])) titles[t.id]=t.task_title||""; }catch(e){}
    for(const x of w){ if(x.dispatchStatus!=="dispatched") continue;
      process.stdout.write([x.dispatchId, x.taskId||"", x.agentTerminalHandle||"", titles[x.taskId]||""].join("|")+"\n"); }
  }catch(e){}
});')
  [ "$n" -eq 0 ] && say "no live dispatches"
  # THE SECOND CLOSING PATH. Settling used to depend entirely on the watcher's wake plus a human
  # running settle.sh - measured 2026-09-30: five finished dispatches sat with live terminals and
  # worktrees because the wake is an optimisation, not a guarantee (and settle.sh itself was failing
  # to resolve the worktree, printing DONE while closing nothing). This sweep closes any dispatch
  # that is done but not yet closed, so nothing stays open longer than one interval even with the
  # watcher fully down.
  sweep_settle
}

# Close dispatches that are finished but still holding a terminal or a worktree.
sweep_settle() {
  local W JSON pending
  JSON="$(workers_json)"
  [ -n "$JSON" ] || { say "sweep: could not read the worker list"; return; }
  pending="$(printf '%s' "$JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const w=(JSON.parse(s).result||{}).workers||[];
    for(const x of w){ if(x.dispatchStatus!=="completed" && x.dispatchStatus!=="failed") continue;
      if(!x.agentTerminalHandle) continue;
      process.stdout.write(x.dispatchId+"|"+(x.taskId||"")+"|"+x.dispatchStatus+"\n"); }
  }catch(e){}
});')"
  local n=0
  while IFS='|' read -r DISP TASK ST; do
    [ -n "$DISP" ] || continue
    local H
    H="$(printf '%s' "$JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).workers||[]; const x=w.find(y=>y.dispatchId===want);
    process.stdout.write(x?(x.agentTerminalHandle||""):""); }catch(e){}
});' "$DISP")"
    local ALIVE
    ALIVE="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).terminals||[];
    process.stdout.write(t.some(x=>x.handle===want)?"yes":"no"); }catch(e){ process.stdout.write("no"); }
});' "$H")"
    if [ "$ALIVE" = "yes" ]; then
      n=$((n+1))
      say "sweep: $DISP ($TASK, $ST) still holds terminal $H - settling"
      if [ -n "$ACT" ]; then
        bash "$HERE/settle.sh" "$DISP" 2>&1 | grep -E "worktree removed|DONE|FAILED|REFUSED" | sed 's/^/  sweep:   /' | tee -a "$LOG"
      else
        say "sweep:   (dry run; run with --act to close it)"
      fi
    fi
  done <<< "$pending"
  [ "$n" -eq 0 ] && say "sweep: nothing finished is still holding a terminal"
}

# Recover one stalled dispatch: abandon it, then retry the SAME task on a fresh worktree.
# Capped per TASK, not per run: at most two automatic retries, then it stops and writes an inbox item
# for human judgment. A task that keeps dying is systemically broken (measured 2026-09-28: a Bun
# panic and a hung generation killed four workers in one evening), and retrying it forever would burn
# the machine without ever finishing. The counter is persisted, so a supervisor restart does not
# reset the budget.
recover() {
  local DISP="$1" TASK="$2" TITLE="$3" VERDICT="$4"
  mkdir -p "$STATE_DIR"
  # WHO stopped it? Before retrying anything that reads as stopped/exited, find out whether OUR OWN
  # abandon caused it. Orca's guide (stablyai/orca#23713, open) says its recovery table retries ANY
  # stopped attempt without checking who stopped it - following that blindly would retry workers we
  # deliberately fenced, and would fight a human who stopped one on purpose.
  local TERM WHO
  TERM="$(orca orchestration worker-show --dispatch "$DISP" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const d=((JSON.parse(s).result||{}).dispatch)||{};
    process.stdout.write([d.terminationReason||"", d.status||"", d.capabilityRevokedAt||""].join("|"));
  }catch(e){}
});')"
  WHO="$(printf '%s' "$TERM" | cut -d'|' -f1)"
  # Our own abandon also revokes the capability, so "revoked" alone does not mean "someone else did
  # it". The supervisor records every abandon it performs; anything else is foreign.
  if [ -f "$STATE_DIR/$DISP.abandoned-by-us" ]; then
    say "$DISP was abandoned by this supervisor at $(cat "$STATE_DIR/$DISP.abandoned-by-us") - safe to retry"
  else
  case "$WHO" in
    ""|null)
      # No termination reason recorded. If a capability was revoked, an actor fenced it (us or a
      # human) - that is not ours to undo automatically.
      if [ -n "$(printf '%s' "$TERM" | cut -d'|' -f3)" ]; then
        say "$DISP has a revoked capability and no termination reason: something fenced it deliberately. Not retrying; writing an inbox item."
        printf '# Supervisor: %s was fenced deliberately - not retrying\n\n- dispatch: %s\n- task: %s\n- status: %s\n- capabilityRevokedAt: %s\n- at: %s\n\nNo termination reason is recorded, so the supervisor cannot tell its own abandon from a human\nstop. Retrying would fight whoever fenced it (see stablyai/orca#23713).\n' \
          "$DISP" "$DISP" "$TASK" "$(printf '%s' "$TERM" | cut -d'|' -f2)" "$(printf '%s' "$TERM" | cut -d'|' -f3)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          > "$INBOX_DIR/$(date -u +%Y%m%dT%H%M%SZ)-supervise-$DISP-fenced-not-retried.md"
        return
      fi
      ;;
    *)
      say "$DISP records terminationReason='$WHO' - that is a deliberate stop by someone else; not retrying"
      return
      ;;
  esac
  fi
  local COUNT_FILE="$STATE_DIR/$TASK.count" COUNT
  COUNT="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  if [ "$COUNT" -ge 2 ]; then
    say "$TASK has already been retried $COUNT times automatically; NOT retrying again"
    {
      printf '# Supervisor: task %s keeps failing - human judgment needed\n\n' "$TASK"
      printf -- '- task: %s\n- title: %s\n- last dispatch: %s\n- last verdict: %s\n- automatic retries so far: %s\n- at: %s\n' \
        "$TASK" "$TITLE" "$DISP" "$VERDICT" "$COUNT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf '\nThe same task has failed %s times under automatic recovery. Retrying it again would\n' "$COUNT"
      printf 'loop on a systemically broken task, so the supervisor stopped. A human decides: fix the\n'
      printf 'cause (see the Bun-panic investigation), re-dispatch by hand, or close the task.\n'
    } > "$INBOX_DIR/$(date -u +%Y%m%dT%H%M%SZ)-supervise-$TASK-retry-cap.md"
    return
  fi
  if [ "$RECOVERIES" -ge "$MAX_REC" ]; then
    say "recovery budget exhausted ($MAX_REC); $DISP left for a human"
    return
  fi
  local ROLE REF NUM NEW
  ROLE="$(printf '%s' "$TITLE" | sed -n 's/^\([a-z]*\) .*/\1/p')"
  case "$ROLE" in coder|reviewer|tester|fixer) ;; *) say "$DISP: cannot derive a role from '$TITLE'; not recovering"; return;; esac
  NUM="$(printf '%s' "$TITLE" | grep -oE '#[0-9]+' | head -1 | tr -d '#')"
  REF="$BASE"
  if [ -n "$NUM" ]; then
    local PRBR
    PRBR="$(gh pr list --state open --json number,headRefName 2>/dev/null \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);const n=process.argv[1];const x=a.find(p=>String(p.number)===n);process.stdout.write(x?x.headRefName:"")}catch(e){}}) ' "$NUM")"
    # A fixer works on the PR's own branch so its fix lands on that PR, not in a new one.
    [ -n "$PRBR" ] && [ "$ROLE" = "fixer" ] && REF="$PRBR"
  fi
  NEW="$ROLE-$(date -u +%H%M%S)"
  say "recovering $DISP: abandon -> spawn $NEW from $REF -> worker-start --retry-of"
  orca orchestration worker-abandon --dispatch "$DISP" --json >/dev/null 2>&1 \
    || { say "abandon of $DISP failed; leaving it"; return; }
  mkdir -p "$STATE_DIR"; date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_DIR/$DISP.abandoned-by-us"
  if ! bash "$HERE/spawn.sh" "$NEW" "$REF" >/dev/null 2>&1; then
    say "spawn of $NEW failed; $DISP is abandoned and needs a human"
    return
  fi
  local P H
  P="$(cd /d/code/design-system-viewer 2>/dev/null && bash "$HERE/handle.sh" "C:/Users/zurza/orca/workspaces/design-system-viewer/$NEW" --agent-only 2>/dev/null | head -1)"
  H="$P"
  [ -n "$H" ] || { say "no agent terminal for $NEW yet; retry it by hand with --task $TASK --retry-of $DISP"; return; }
  local REPO_ID
  REPO_ID="$(cd /d/code/design-system-viewer 2>/dev/null && bash "$HERE/repo-id.sh" >/dev/null 2>&1; printf '%s' "${REPO_ID:-}")"
  [ -n "$REPO_ID" ] || REPO_ID="$(orca worktree list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const w=(JSON.parse(s).result||{}).worktrees||[];const x=w.find(y=>String(y.path).indexOf("design-system-viewer")>=0&&String(y.path).split("/").length<8);process.stdout.write(x?(x.repoId||""):"")}catch(e){}})')"
  local OUT
  OUT="$(orca orchestration worker-start --task "$TASK" --retry-of "$DISP" --terminal "$H" \
        --worktree "id:$REPO_ID::C:/Users/zurza/orca/workspaces/design-system-viewer/$NEW" \
        --run "$RUN" --from "${ORCA_TERMINAL_HANDLE:-}" --json 2>&1)"
  if printf '%s' "$OUT" | grep -q '"ok": *true'; then
    RECOVERIES=$((RECOVERIES+1))
    mkdir -p "$STATE_DIR"; echo "$((COUNT+1))" > "$COUNT_FILE"
    say "recovered $DISP -> $(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((JSON.parse(s).result||{}).dispatchId||"?")}catch(e){process.stdout.write("?")}})') (task $TASK retry $((COUNT+1))/2)"
  else
    say "worker-start failed for $TASK: $(printf '%s' "$OUT" | head -c 160)"
  fi
}

say "supervising run $RUN every ${INTERVAL}s (act=$([ -n "$ACT" ] && echo yes || echo no))"
while :; do
  cycle
  [ -n "$ONCE" ] && break
  sleep "$INTERVAL"
done
