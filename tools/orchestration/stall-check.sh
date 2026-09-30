#!/usr/bin/env bash
# Is a dispatched worker actually working, or has it frozen?
#
# Why: Orca's `projection.liveness` is not evidence. Measured 2026-09-28: two Fixers sat frozen
# for 1.5-2 hours (token/cost counters unchanged) while their projection read
# `unverifiable/stale_status` - a value that means "I do not know", which the coordinator read as
# "nothing is wrong". The cost was about 3.5 worker-hours. The only signal that told the truth was
# the terminal's own counter, read twice.
#
# The decision is a pure function of TWO readings taken a measured interval apart, plus the
# sampler's own record of the worker's process tree. It never consults the projection.
#
#   stall-check.sh <dispatch_id> [--interval 95] [--limit 40] [--json]
#   stall-check.sh --readings <fileA> <fileB> [--pid-present yes|no] [--json]     # probe mode
#
# Verdicts and exit codes:
#   PROGRESSING  0  the counter moved between the two readings
#   TOOL_ACTIVE  0  the counter is frozen but new tool/server output appeared (a build, a preview)
#   STALL        3  counter unchanged AND tail unchanged AND no tool output AND the pid is alive
#   EXITED       4  the process tree is gone from the sampler (finished or killed, not a stall)
#   USAGE/ERROR  2  bad arguments or an unreadable source
set -uo pipefail

DISPATCH=""; INTERVAL=95; LIMIT=40; JSON=""; A=""; B=""; PID_PRESENT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --interval) INTERVAL="${2:?}"; shift 2;;
    --limit) LIMIT="${2:?}"; shift 2;;
    --json) JSON=1; shift;;
    --readings) A="${2:?}"; B="${3:?}"; shift 3;;
    --pid-present) PID_PRESENT="${2:?}"; shift 2;;
    -*) echo "stall-check: unknown flag $1" >&2; exit 2;;
    *) DISPATCH="$1"; shift;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="${WATCH_RUN:-run_4e539259ab29}"

counter_of() { grep -oE '[0-9.]+K \([0-9]+%\) · \$[0-9.]+' "$1" 2>/dev/null | tail -1; }
tool_active_of() {
  # A line that looks like a command being run, or a server announcing itself, means the model is
  # not producing tokens because a TOOL is running - which is work, not a freeze.
  # The strongest form is OpenCode's own spinner + command line, which worker-read exposes:
  #     ⠹ rg -n "aaa9a0|170, ?169, ?160" systems src
  #     ⠋ gh pr diff 163 --patch -- app/src/tokens/TokenGroup.css
  # Measured 2026-09-29 on fixer-163b: this line was present while the counter sat frozen and the
  # old tail-hash heuristic called it a stall.
  grep -qE '(^|[[:space:]])[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏][[:space:]]+[a-z]' "$1" 2>/dev/null && echo yes && return
  grep -qE '(ready in|Local:|Network:|npm |npx |vite |tsc |vitest |curl |→ Read|→ Write|→ Bash|┃ *\$)' "$1" 2>/dev/null && echo yes || echo no
}
tail_hash_of() { grep -vE '^\s*$' "$1" 2>/dev/null | tail -25 | md5sum | cut -d' ' -f1; }

decide() {
  local a="$1" b="$2" present="$3"
  local ca cb ha hb ta tb
  ca="$(counter_of "$a")"; cb="$(counter_of "$b")"
  ha="$(tail_hash_of "$a")"; hb="$(tail_hash_of "$b")"
  ta="$(tool_active_of "$a")"; tb="$(tool_active_of "$b")"
  if [ "$present" = "no" ]; then
    echo "EXITED|counter '${ca:-none}' -> '${cb:-none}'|Orca reports this dispatch as ${LIVENESS:-unknown} / ${WSTATE:-unknown}, so the worker is gone rather than frozen"
    return 4
  fi
  if [ -n "$ca" ] && [ -n "$cb" ] && [ "$ca" != "$cb" ]; then
    echo "PROGRESSING|counter $ca -> $cb|the model is producing tokens"
    return 0
  fi
  if [ "$tb" = "yes" ] && [ "$ha" != "$hb" ]; then
    echo "TOOL_ACTIVE|counter ${ca:-none} unchanged|new tool or server output appeared, so a tool is running"
    return 0
  fi
  if [ "$ca" = "$cb" ] && [ "$ha" = "$hb" ]; then
    echo "STALL|counter ${ca:-none} unchanged across $INTERVAL s and the tail is identical|no tokens, no tool output, no settlement"
    return 3
  fi
  echo "PROGRESSING|counter '${ca:-none}' -> '${cb:-none}'|output changed between the readings"
  return 0
}

report() {
  local verdict="$1" why="$2" detail="$3"
  if [ -n "$JSON" ]; then
    # --json means JSON and NOTHING else: callers parse this stream (a trailing human line made
    # settle.sh's parse fail with UNKNOWN - measured 2026-09-28, the same class of bug as the
    # watcher's 2>&1 mixing).
    printf '{"verdict":"%s","why":"%s","detail":"%s"}\n' "$verdict" "$why" "$detail"
    return
  fi
  printf 'stall-check: %s - %s\n' "$verdict" "$why"
  printf 'stall-check: %s\n' "$detail"
  printf 'stall-check: reading A: counter=%s\n' "$(counter_of "$A")"
  printf 'stall-check: reading B: counter=%s\n' "$(counter_of "$B")"
}

# ---- probe mode: two captured readings decide on their own ---------------------------
if [ -n "$A" ]; then
  [ -f "$A" ] || { echo "stall-check: no reading at $A" >&2; exit 2; }
  [ -f "$B" ] || { echo "stall-check: no reading at $B" >&2; exit 2; }
  [ -n "$PID_PRESENT" ] || PID_PRESENT=yes
  out="$(decide "$A" "$B" "$PID_PRESENT")"; rc=$?
  report "$(printf '%s' "$out" | cut -d'|' -f1)" "$(printf '%s' "$out" | cut -d'|' -f2)" "$(printf '%s' "$out" | cut -d'|' -f3)"
  exit $rc
fi

# ---- normal mode: resolve the dispatch, capture two readings -------------------------
[ -n "$DISPATCH" ] || { echo "usage: stall-check.sh <dispatch_id> [--interval s] | --readings A B" >&2; exit 2; }
INFO="$(orca orchestration worker-list --run "$RUN" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).workers||[]; const x=w.find(y=>y.dispatchId===want);
    if(!x){ process.stdout.write("MISSING"); return; }
    const L=(x.projection&&x.projection.liveness)||{};
    process.stdout.write([x.taskId||"", x.agentTerminalHandle||"", x.dispatchStatus||"", L.verdict||"", L.reason||""].join("|"));
  }catch(e){ process.stdout.write("PARSE_ERROR"); }
});' "$DISPATCH")"
case "$INFO" in
  MISSING) echo "stall-check: no dispatch $DISPATCH in $RUN" >&2; exit 2;;
  PARSE_ERROR) echo "stall-check: could not read the worker list" >&2; exit 2;;
esac
TASK="$(printf '%s' "$INFO" | cut -d'|' -f1)"
H="$(printf '%s' "$INFO" | cut -d'|' -f2)"
DISPATCH_STATUS="$(printf '%s' "$INFO" | cut -d'|' -f3)"
PROJ="$(printf '%s' "$INFO" | cut -d'|' -f4)/$(printf '%s' "$INFO" | cut -d'|' -f5)"
# Orca's own liveness verdict for this dispatch: live / unverifiable / ...
LIVENESS="$(printf '%s' "$INFO" | cut -d'|' -f4)"
WT="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).terminals||[]; const x=t.find(y=>y.handle===want);
    process.stdout.write(x?(x.worktreePath||""):""); }catch(e){}
});' "$H")"

if [ -z "$H" ] || [ ! -d "${WT:-/nonexistent}" ]; then
  # The dispatch has no live agent terminal (or its worktree is gone). That is itself the answer,
  # and it is the answer the projection refuses to give: measured on task_d1c9482f9215, the
  # projection read "unverifiable/missing_status" for a worker that no longer existed.
  PID_PRESENT=no
  A="$(mktemp "${TMPDIR:-/tmp}/stallA.XXXXXX")"; B="$(mktemp "${TMPDIR:-/tmp}/stallB.XXXXXX")"
  printf 'no terminal\n' > "$A"; printf 'no terminal\n' > "$B"
  out="$(decide "$A" "$B" "$PID_PRESENT")"; rc=$?
  report "$(printf '%s' "$out" | cut -d'|' -f1)" "$(printf '%s' "$out" | cut -d'|' -f2)" "$(printf '%s' "$out" | cut -d'|' -f3)"
  printf 'stall-check: dispatch=%s task=%s terminal=%s dispatchStatus=%s projection=%s\n' "$DISPATCH" "$TASK" "${H:-none}" "${DISPATCH_STATUS:-?}" "$PROJ" >&2
  rm -f "$A" "$B"
  exit $rc
fi

A="$(mktemp "${TMPDIR:-/tmp}/stallA.XXXXXX")"; B="$(mktemp "${TMPDIR:-/tmp}/stallB.XXXXXX")"
capture() { orca orchestration worker-read --dispatch "$DISPATCH" --source auto --limit "$LIMIT" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  // worker-read prefers the provider transcript and falls back to the terminal screen, so this is
  // one call for both sources and it names the source it used. Measured 2026-09-29: for a live
  // OpenCode worker it returns result.terminal.tail with the running tool line visible.
  try{ const r=JSON.parse(s).result||{}; const t=(r.terminal||{}); process.stdout.write((t.tail||[]).join("\n")); }
  catch(e){}
});' > "$1"; }

# A dispatch that already COMPLETED is not a stall: its counter is frozen because the worker is
# done. Measured 2026-09-28 on the coder for #118, whose counter sat at 172.9K with
# dispatchStatus=completed while the two-reading test called it STALL.
if [ "$DISPATCH_STATUS" = "completed" ]; then
  printf '{"verdict":"SETTLED","why":"dispatchStatus=completed","detail":"the worker finished; a frozen counter here is expected, not a stall"}\n'
  printf 'stall-check: SETTLED - dispatchStatus=completed, so the frozen counter is expected\n' >&2
  exit 0
fi

capture "$A"
echo "stall-check: reading A taken at $(date -u +%H:%M:%SZ); waiting ${INTERVAL}s for reading B" >&2
sleep "$INTERVAL"
capture "$B"

# Is the worker alive? Ask Orca, not a CSV. The sampler pid search is gone entirely: it read a
# comma-delimited file as pipe-delimited and reported EVERY dispatch as EXITED (measured 2026-09-29
# on fixer-163b), and it needed a second process to be alive before it could say anything at all.
PID_PRESENT="no"
case "${LIVENESS:-}" in
  live) PID_PRESENT="yes" ;;
  *)
    # Orca cannot say it is live, so ask worker-show what happened to the dispatch. Only a terminal
    # state counts as gone; an ambiguous liveness must never be read as EXITED.
    WSTATE="$(orca orchestration worker-show --dispatch "$DISPATCH" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const r=JSON.parse(s).result||{}; process.stdout.write(((r.worker||{}).state)||""); }catch(e){}
});')"
    case "$WSTATE" in
      abandoned|failed|completed|released) PID_PRESENT="no" ;;
      *) PID_PRESENT="yes" ;;
    esac
    printf 'stall-check: liveness=%s worker.state=%s -> present=%s\n' "${LIVENESS:-unknown}" "${WSTATE:-unknown}" "$PID_PRESENT" >&2
    ;;
esac

out="$(decide "$A" "$B" "$PID_PRESENT")"; rc=$?
VERDICT="$(printf '%s' "$out" | cut -d'|' -f1)"
# The MB-movement heuristic that used to live here is gone: it needed the sampler CSV (the same file
# whose delimiter bug caused the false EXITED verdicts) and it only worked when a build happened to
# grow the tree. worker-read exposes OpenCode's own running-tool line instead, and decide() reads it
# through tool_active_of().
report "$VERDICT" "$(printf '%s' "$out" | cut -d'|' -f2)" "$(printf '%s' "$out" | cut -d'|' -f3)"
printf 'stall-check: dispatch=%s task=%s worktree=%s liveness=%s present=%s\n' "$DISPATCH" "$TASK" "$WT" "${LIVENESS:-unknown}" "$PID_PRESENT" >&2
rm -f "$A" "$B"
exit $rc
