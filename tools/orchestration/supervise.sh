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
# SUPERVISE_READ_GAP overrides the gap between the two readings (default 20s) so a probe can run a
# whole scan in seconds; SUPERVISE_STATE / SUPERVISE_LOG / INBOX_DIR override its state, log and
# inbox, which is how a probe keeps its notes out of the durable inbox.
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

INTERVAL=120; ACT=""; RUN=""; MAX_REC=3; ONCE=""; READ_GAP="${SUPERVISE_READ_GAP:-20}"
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
SEEN_FILE="$STATE_DIR/seen-dispatches"
NOTED_FILE="$STATE_DIR/noted-dispatches"
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
    # SEEN-SET: a dispatch is considered once. Measured 2026-10-01: the scan picked up 31 historical
    # failed dispatches and re-examined every one on every pass, writing an inbox item for each
    # refusal. The set is only written when --act is on, so a dry run cannot poison it.
    if [ -f "$SEEN_FILE" ] && grep -qx "$DISP" "$SEEN_FILE" 2>/dev/null; then continue; fi
    n=$((n+1))
    local V
    V="$(bash "$HERE/stall-check.sh" "$DISP" --interval "$READ_GAP" --json 2>/dev/null \
         | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).verdict)}catch(e){process.stdout.write("UNKNOWN")}})')"
    case "$V" in
      PROGRESSING|TOOL_ACTIVE|SETTLED) say "$DISP ($TITLE) -> $V" ;;
      STALL|EXITED)
        say "$DISP ($TITLE) -> $V  *** needs recovery"
        # ONCE PER (dispatch, verdict), whether or not --act is on. Measured 2026-10-02: 2760 notes
        # in the inbox naming only 41 distinct dispatches - up to 91 copies of the same one - because
        # the seen-set below is written only with --act, so a dry run re-filed the identical report
        # on every pass, forever, and the inbox stopped answering "is anything new?". The seen-set
        # still governs ACTIONS and stays --act-only; this one governs the REPORT, so a verdict that
        # CHANGES (STALL -> EXITED) is still filed, and a repeat of the same one is not.
        if [ -f "$NOTED_FILE" ] && grep -qx "$DISP|$V" "$NOTED_FILE" 2>/dev/null; then
          say "  already reported as $V - not filing it again"
        else
          mkdir -p "$STATE_DIR"; echo "$DISP|$V" >> "$NOTED_FILE"
          {
            printf '# Supervisor: %s on %s\n\n' "$V" "$DISP"
            printf -- '- task: %s\n- title: %s\n- verdict: %s\n- at: %s\n- run: %s\n' \
              "$TASK" "$TITLE" "$V" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RUN"
            printf '\nThe worker is not producing: %s. The supervisor %s.\n' \
              "$V" "$([ -n "$ACT" ] && echo 'recovered it (abandon + retry)' || echo 'only reported it (run with --act to recover)')"
          } > "$INBOX_DIR/$(date -u +%Y%m%dT%H%M%SZ)-supervise-$DISP-$V.md"
        fi
        [ -n "$ACT" ] && recover "$DISP" "$TASK" "$TITLE" "$V"
        # Considered once: with --act on, this dispatch is done with (recovered, refused, or left for
        # a human) and must not be re-examined on the next pass.
        [ -n "$ACT" ] && { mkdir -p "$STATE_DIR"; echo "$DISP" >> "$SEEN_FILE"; }
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
    // A TUI that dies leaves the dispatch failed/abandoned, not dispatched - measured 2026-09-30 on
    // tester-163, whose death was invisible to a scan that only looked at `dispatched`. Those are
    // scanned too, so a dead worker is recovered instead of needing a human.
    const liveTasks=new Set(w.filter(y=>y.dispatchStatus==="dispatched").map(y=>y.taskId));
    for(const x of w){
      const st=x.dispatchStatus;
      const dead=(st==="failed"||st==="abandoned");
      if(st!=="dispatched" && !dead) continue;
      if(!x.agentTerminalHandle) continue;
      // A dead dispatch whose task already has a LIVE dispatch is a duplicate of work in flight.
      if(dead && liveTasks.has(x.taskId)) continue;
      process.stdout.write([x.dispatchId, x.taskId||"", x.agentTerminalHandle||"", (titles[x.taskId]||"")+" ["+st+"]"].join("|")+"\n");
    }
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
    for(const x of w){ if(x.dispatchStatus!=="completed" && x.dispatchStatus!=="failed" && x.dispatchStatus!=="abandoned") continue;
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
  say "recovering $DISP: fence if needed -> spawn $NEW from $REF -> worker-start --retry-of"
  # A dispatch that already reads failed/abandoned is fenced: abandoning it again fails and would stop
  # the recovery before it starts (tester-163's TUI died and left the dispatch abandoned, so this
  # call has to be conditional or the whole recovery is dead on arrival).
  local WST
  WST="$(orca orchestration worker-show --dispatch "$DISP" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const r=JSON.parse(s).result||{}; process.stdout.write(((r.worker||{}).state)||""); }catch(e){}
});')"
  case "$WST" in
    failed|abandoned|released)
      say "  $DISP already reads $WST; skipping the abandon"
      ;;
    *)
      orca orchestration worker-abandon --dispatch "$DISP" --json >/dev/null 2>&1 \
        || { say "abandon of $DISP failed; leaving it"; return; }
      ;;
  esac
  mkdir -p "$STATE_DIR"; date -u +%Y-%m-%dT%H:%M:%SZ > "$STATE_DIR/$DISP.abandoned-by-us"
  # A recovered REVIEWER must keep its read-only boundary. spawn.sh --readonly is what writes the
  # deny-based permission block; omitting it silently hands the replacement the writable default,
  # which is an authority change, not a preservation of the original worker's policy (CodeRabbit
  # High on PR #167 - correct, and fixed here rather than argued with).
  # CLOSE THE OLD WORKER FIRST. Measured 2026-10-01: the recovery spawned a new worktree+TUI per
  # attempt and left the old one running, so six duplicate testers drained a 7.5 GB machine to 34 MB,
  # bash could not fork, and the watcher stopped working. The recovery was producing a worse problem
  # than the one it fixed - a self-reinforcing collapse. Never leave both alive: close the old
  # terminal, then remove its worktree (force: the reason is recorded in the inbox note above, which
  # is the evidence this removal would otherwise destroy), and only then spawn the replacement.
  local OLD_H OLD_WT
  OLD_H="$(orca orchestration worker-list --run "$RUN" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).workers||[]; const x=w.find(y=>y.dispatchId===want);
    process.stdout.write(x?(x.agentTerminalHandle||""):""); }catch(e){}
});' "$DISP")"
  if [ -n "$OLD_H" ]; then
    OLD_WT="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).terminals||[]; const x=t.find(y=>y.handle===want);
    process.stdout.write(x?(x.worktreePath||""):""); }catch(e){}
});' "$OLD_H")"
    say "  closing the old worker first: terminal $OLD_H ${OLD_WT:+worktree $OLD_WT}"
    # settle.sh FIRST, not the blunt close: its own worktree resolution needs the terminal
    # still registered (worker-list -> agentTerminalHandle -> terminal list -> worktreePath),
    # and it closes the terminal itself as part of its own sequence. Closing the terminal here
    # first makes settle.sh fall through to the raw rm -rf every single time, so the careful
    # path never actually runs at this call site. Blunt close only if settle.sh itself fails.
    if [ -n "$OLD_WT" ] && [ -d "$OLD_WT" ]; then
      if ! bash "$HERE/settle.sh" "$DISP" --force-remove >/dev/null 2>&1; then
        orca terminal close --terminal "$OLD_H" --json >/dev/null 2>&1
        rm -rf "$OLD_WT" 2>/dev/null
      fi
      git worktree prune >/dev/null 2>&1
    else
      orca terminal close --terminal "$OLD_H" --json >/dev/null 2>&1
    fi
  fi
  local SPAWN_ARGS=("$NEW" "$REF") SPAWN_OUT SPAWN_RC
  [ "$ROLE" = "reviewer" ] && SPAWN_ARGS+=("--readonly")
  SPAWN_OUT="$(bash "$HERE/spawn.sh" "${SPAWN_ARGS[@]}" 2>&1)"; SPAWN_RC=$?
  if [ "$SPAWN_RC" -ne 0 ]; then
    say "spawn of $NEW failed; $DISP is abandoned and needs a human"
    printf '# Supervisor: recovery of %s failed at spawn\n\n- dispatch: %s\n- task: %s\n- role: %s\n- ref: %s\n- spawn output: %s\n- at: %s\n\nThe old dispatch was abandoned and the replacement could not be created, so this task now holds\nnothing. Re-dispatch it by hand or close it.\n' \
      "$DISP" "$DISP" "$TASK" "$ROLE" "$REF" "$(printf '%s' "$SPAWN_OUT" | head -c 400)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      > "$INBOX_DIR/$(date -u +%Y%m%dT%H%M%SZ)-supervise-$TASK-spawn-failed.md"
    return
  fi
  # Use the path and handle the launcher actually returned instead of reconstructing them from
  # workstation-specific strings.
  local P H
  P="$(printf '%s' "$SPAWN_OUT" | sed -n 's/^PATH=//p' | head -1)"
  H="$(printf '%s' "$SPAWN_OUT" | sed -n 's/^HANDLE=//p' | head -1)"
  if [ -z "$P" ] || [ -z "$H" ]; then
    say "spawn of $NEW returned no PATH/HANDLE; not dispatching (output: $(printf '%s' "$SPAWN_OUT" | head -c 160))"
    return
  fi
  # Wait for the terminal to register its agent and settle, exactly as start.sh does. Without this the
  # worker-start lands on a terminal whose TUI is not up yet and fails with agent_unconfigured -
  # measured on the first live --act run, where the recovery got as far as worker-start and stopped
  # there (tester-163).
  local A i
  for i in $(seq 1 15); do
    A="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).terminals||[]; const x=t.find(y=>y.handle===want);
    process.stdout.write(x?(x.agentIdentity||""):""); }catch(e){}
});' "$H")"
    [ "$A" = "opencode" ] && break
    sleep 5
  done
  if [ "$A" != "opencode" ]; then
    say "  terminal $H has no opencode agent after ~75s; the recovery is incomplete"
  fi
  orca terminal wait --terminal "$H" --for tui-idle --timeout-ms 90000 --json >/dev/null 2>&1
  local REPO_ID
  REPO_ID="$(cd /d/code/design-system-viewer 2>/dev/null && bash "$HERE/repo-id.sh" >/dev/null 2>&1; printf '%s' "${REPO_ID:-}")"
  [ -n "$REPO_ID" ] || REPO_ID="$(orca worktree list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const w=(JSON.parse(s).result||{}).worktrees||[];const x=w.find(y=>String(y.path).indexOf("design-system-viewer")>=0&&String(y.path).split("/").length<8);process.stdout.write(x?(x.repoId||""):"")}catch(e){}})')"
  local OUT
  OUT="$(orca orchestration worker-start --task "$TASK" --retry-of "$DISP" --terminal "$H" \
        --worktree "id:$REPO_ID::$P" \
        --run "$RUN" --from "${ORCA_TERMINAL_HANDLE:-}" --json 2>/dev/null)"
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
