#!/usr/bin/env bash
# One call settles one worker: ack, release, close, remove, and prove it happened.
#
# Why: every step here was a manual intervention, and each one has already failed silently
# in this repo at least once. reap.sh parsed the *text* table from `orca worktree list`
# (which has no `refs/...` column), its sed produced nothing, and it returned `false`
# without saying so - twice, so the worktree was removed by hand. `worker-release` was
# called on an unsettled dispatch and left two Tasks stuck in `ready`. Local branches were
# left behind because nothing owned deleting them. A stalled TUI kept 341 MB and kept
# sending heartbeats Orca rejected, because nothing listed terminals whose dispatch was gone.
#
#   settle.sh <dispatch_id> [--dry-run] [--kill-ghosts] [--force-remove]
#
# Exit 0 only when every step that applies has been done and read back. It refuses - exit 1
# with the exact commands to run instead - when the dispatch has not settled; an unsettled
# dispatch must be abandoned and retried, never released:
#
#   orca orchestration worker-abandon --dispatch <old>
#   orca orchestration worker-start --task <task_id> --retry-of <old> \
#     --terminal <fresh handle> --worktree "id:<repo>::<fresh path>" --run <run> --from <handle>
#
# Idempotent: running it again on a settled, already-cleaned dispatch changes nothing and
# exits 0. Never prints a success it did not verify.
set -uo pipefail

DISPATCH=""; DRY=""; KILL_GHOSTS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift;;
    --kill-ghosts) KILL_GHOSTS=1; shift;;
    # --force-remove drops the worktree even when no settlement exists. Off by default: a worktree
    # with no settlement is the only evidence of what a dispatch actually did.
    --force-remove) FORCE_REMOVE=1; shift;;
    -*) echo "settle: unknown flag: $1" >&2; exit 2;;
    *) DISPATCH="$1"; shift;;
  esac
done
[ -n "$DISPATCH" ] || { echo "usage: settle.sh <dispatch_id> [--dry-run] [--kill-ghosts]" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
# Native tools (node) cannot read an MSYS path on this host: MSYS path conversion is disabled,
# so /c/Users/... becomes C:\c\Users\... and node says "Cannot find module". Measured
# 2026-09-28 - the ghost check silently saw 0 terminals because of exactly this.
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
# Derive the run from Orca instead of carrying a session constant. The old fallback
# (run_4e539259ab29) was a leftover from the session that created it; every copy of it would
# release and fence dispatches in a run that may not be the current one.
if [ -n "${WATCH_RUN:-}" ]; then
  RUN="$WATCH_RUN"
else
  RUN="$(orca orchestration run-current --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((((JSON.parse(s).result||{}).run)||{}).id||"")}catch(e){}})')"
  if [ -z "$RUN" ]; then
    echo "settle: could not read the current run (orca orchestration run-current); pass WATCH_RUN=<id>" >&2
    exit 2
  fi
fi
FROM="${WATCH_FROM:-${ORCA_TERMINAL_HANDLE:-}}"
INBOX="${INBOX_DIR:-${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/inbox}/settlements"
say() { printf 'settle: %s\n' "$*"; }
die() { printf 'settle: FAILED - %s\n' "$*" >&2; exit 1; }
run_or_show() { if [ -n "$DRY" ]; then say "DRY-RUN would run: $*"; else "$@"; fi; }

# ---- 1. what is this dispatch? ------------------------------------------------------
LIST="$(orca orchestration worker-list --run "$RUN" --json 2>/dev/null)" \
  || die "could not read the worker list"
INFO="$(printf '%s' "$LIST" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).workers||[];
    const x=w.find(y=>y.dispatchId===want);
    if(!x){ process.stdout.write("MISSING"); return; }
    const L=(x.projection&&x.projection.liveness)||{};
    process.stdout.write([x.taskId||"", x.state||"", L.verdict||"", L.reason||""].join("|"));
  }catch(e){ process.stdout.write("PARSE_ERROR"); }
});' "$DISPATCH")"
case "$INFO" in
  MISSING) die "no dispatch $DISPATCH in run $RUN" ;;
  PARSE_ERROR) die "could not parse the worker list" ;;
esac
TASK="$(printf '%s' "$INFO" | cut -d'|' -f1)"
STATE="$(printf '%s' "$INFO" | cut -d'|' -f2)"
LIVENESS="$(printf '%s' "$INFO" | cut -d'|' -f3)"
say "dispatch $DISPATCH  task=$TASK  state=$STATE  liveness=$LIVENESS"

# ---- 2. is it settled? An unsettled dispatch is never released -----------------------
TASK_STATUS="$(orca orchestration task-list --run "$RUN" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).tasks||[]; const x=t.find(y=>y.id===want);
    process.stdout.write(x?(x.status||"?"):"MISSING"); }catch(e){ process.stdout.write("PARSE_ERROR"); }
});' "$TASK")"
# An inbox file only counts as "already handled" when it records an ACK. A file alone
# proves nothing (CodeRabbit Major): a --dry-run item, an item whose ack then failed, and
# the informational "nothing to ack" note must all leave the delivery unhandled.
INBOX_HIT="$(grep -l -E '^acked: (yes|n/a)' "$INBOX"/*"$DISPATCH"* 2>/dev/null | wc -l | tr -d ' ')"
INBOX_ANY="$(ls "$INBOX" 2>/dev/null | grep -c -- "$DISPATCH" || true)"
say "task status=$TASK_STATUS  acked settlement in inbox: ${INBOX_HIT:-0} (files naming it: ${INBOX_ANY:-0})"

SETTLED=""
case "$TASK_STATUS" in completed|failed) SETTLED=1;; esac
[ "${INBOX_HIT:-0}" -gt 0 ] && SETTLED=1
case "$STATE" in abandoned|revoked) SETTLED="";; esac

if [ -z "$SETTLED" ]; then
  echo "settle: REFUSED - $DISPATCH has not settled (task=$TASK_STATUS, state=$STATE)." >&2
  if [ -n "${FORCE_REMOVE:-}" ]; then
    # --force-remove means a deliberate, recorded removal: the caller (supervise.sh's recovery) has
    # already written the reason to the durable inbox, so the refusal to fence an unsettled dispatch
    # must not block the removal. Measured 2026-10-01: without this, every recovery of a dead worker
    # fell through to the blunt rm -rf and settle.sh's own sequence never ran - the careful path was
    # structurally unreachable for exactly the case it was called for.
    echo "settle: --force-remove given, so the refusal is bypassed; the dispatch stays fenced as it is" >&2
  else
  # Before telling the operator to fence it, ask whether it is actually still working. Orca's
  # projection is not evidence (measured: it read "unverifiable" while two Fixers sat frozen for
  # 1.5-2 hours); two readings of the terminal's own counter are.
  SC="$(bash "$HERE/stall-check.sh" "$DISPATCH" --interval "${STALL_INTERVAL:-95}" --json 2>/dev/null)"
  SCV="$(printf '%s' "$SC" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).verdict)}catch(e){process.stdout.write("UNKNOWN")}})')"
  case "$SCV" in
    STALL)
      echo "  stall-check: STALL - $(printf '%s' "$SC" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).why)}catch(e){}})')" >&2
      echo "  The worker is frozen: fence it and retry. Run:" >&2
      ;;
    PROGRESSING|TOOL_ACTIVE)
      echo "  stall-check: $SCV - it is still working (counter or tool output moved), so WAIT rather than fencing." >&2
      echo "  If you still want to fence it, the commands are:" >&2
      ;;
    EXITED)
      echo "  stall-check: EXITED - the process tree is gone from the sampler; this is a finished or killed worker, not a stall." >&2
      echo "  Fence the dispatch so the Task stops reading 'dispatched':" >&2
      ;;
    *)
      echo "  stall-check: could not decide ($SCV). Treat as unknown and inspect the terminal by hand." >&2
      ;;
  esac
  echo "    orca orchestration worker-abandon --dispatch $DISPATCH" >&2
  echo "    orca orchestration worker-start --task $TASK --retry-of $DISPATCH \\" >&2
  echo "      --terminal <fresh agent handle> --worktree \"id:<repo>::<fresh path>\" \\" >&2
  echo "      --run $RUN --from ${FROM:-<coordinator handle>}" >&2
  echo "  (--task and --spec are mutually exclusive; the Task already carries its spec)" >&2
  if [ -z "${FORCE_REMOVE:-}" ]; then exit 1; fi
  fi
fi

# ---- 3. the settlement into the durable inbox, THEN ack ------------------------------
if [ "${INBOX_HIT:-0}" -eq 0 ]; then
  mkdir -p "$INBOX" || die "cannot create $INBOX"
  Q="$(orca orchestration check --run "$RUN" --json 2>/dev/null)" || die "could not read the delivery queue"
  PARSED="$(printf '%s' "$Q" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const r=JSON.parse(s).result||{};
    const hit=(r.messages||[]).filter(m=>(m.payload||"").indexOf(want)>=0);
    if(!hit.length){ process.stdout.write("NONE"); return; }
    process.stdout.write(r.deliveryId+"\n"+hit.map(m=>"--- "+m.type+" | "+m.subject+" | "+m.id+" | "+(m.from_handle||"")+"\n"+(m.body||"")).join("\n"));
  }catch(e){ process.stdout.write("PARSE_ERROR"); }
});' "$DISPATCH")"
  case "$PARSED" in
    NONE)
      # The queue is empty whenever the watcher got there first: it drains and acks every
      # delivery, so `check` sees nothing. Measured 2026-09-28 on the throwaway probe
      # dispatch, which settled into watchd.log with the queue reading count: 0. Until the
      # watcher writes settlements straight into this inbox (issue for (b)), the log is the
      # second source - and a settlement found there needs no ack, because the watcher
      # already acked it.
      LOG="${LOCALAPPDATA:-$HOME}/Temp/watchd.log"
      SETTLE_LOG="$(dirname "$INBOX")/settlements.log"
      BLOCK=""
      if [ -f "$LOG" ]; then
        BLOCK="$(awk -v want="$DISPATCH" '
          BEGIN{RS="=== SETTLEMENT"}
          index($0, want) { last=$0 }
          END{ if (last!="") print "=== SETTLEMENT" last }' "$LOG")"
      fi
      # Third source: the inbox the newer watcher (watch-settlements.sh) appends to. It
      # drains the queue itself, so a settlement can be in neither the queue nor watchd.log
      # and still be on disk - measured on reviewer-136b, whose settlement only ever
      # existed there.
      if [ -z "$BLOCK" ] && [ -f "$SETTLE_LOG" ]; then
        BLOCK="$(awk -v want="$DISPATCH" '
          BEGIN{RS="=== SETTLEMENT"}
          index($0, want) { last=$0 }
          END{ if (last!="") print "=== SETTLEMENT" last }' "$SETTLE_LOG")"
        [ -n "$BLOCK" ] && say "settlement found in the watcher's own inbox ($SETTLE_LOG)"
      fi
      if [ -n "$BLOCK" ]; then
        ITEM="$INBOX/$(date -u +%Y%m%dT%H%M%SZ)-$DISPATCH-from-watchd-log.md"
        { printf 'acked: n/a (the watcher had already acked it)\n'; printf '%s\n' "$BLOCK"; } > "$ITEM" || die "could not write $ITEM"
        say "settlement recovered from watchd.log into $ITEM (the watcher had already acked it)"
      else
        NOTE="$INBOX/$(date -u +%Y%m%dT%H%M%SZ)-$DISPATCH-task-settled-no-delivery.md"
        printf 'acked: no (nothing to ack)\ndispatch: %s\ntask: %s\ntask status: %s\nnote: the Task reads %s but no delivery was in the queue and no settlement was in watchd.log; nothing was acked.\n' \
          "$DISPATCH" "$TASK" "$TASK_STATUS" "$TASK_STATUS" > "$NOTE"
        say "no delivery in the queue and none in the log; wrote $NOTE"
        # No settlement exists, so this dispatch produced nothing we can point at. The worktree is
        # then the only evidence of what happened (measured 2026-09-30: coder-125's TUI died at
        # spawn, Orca still marked the dispatch completed, and the sweep removed the worktree).
        NO_DELIVERY=1
      fi
      ;;
    PARSE_ERROR) die "could not parse the delivery queue" ;;
    *)
      DELIVERY="$(printf '%s' "$PARSED" | head -1)"
      ITEM="$INBOX/${DELIVERY}-$DISPATCH.md"
      if [ -n "$DRY" ]; then
        say "DRY-RUN would write $ITEM and ack $DELIVERY (nothing written)"
      else
        { printf 'acked: pending\n'; printf '%s\n' "$PARSED" | tail -n +2; } > "$ITEM" || die "could not write $ITEM"
        [ -s "$ITEM" ] || die "wrote an empty inbox item $ITEM"
        orca orchestration check --run "$RUN" --ack "$DELIVERY" --json >/dev/null 2>&1 \
          || die "could not ack $DELIVERY (the inbox item stays marked 'pending', so a later run will retry)"
        # Only now is it acked; record that, because the next run reads this marker.
        printf 'acked: yes %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$ITEM"
        say "settlement written to $ITEM and acked ($DELIVERY)"
      fi
      ;;
  esac
else
  say "settlement already in the inbox for $DISPATCH - not acking again"
fi

# ---- 4. which worktree and terminals belong to it? -----------------------------------
# The dispatch record does not name its worktree, and the worktree is named by ROLE
# (`probe-1`), not by dispatch id - so matching the dispatch id against the path never
# matches. The settlement does name the source terminal, and that handle maps to a
# worktree. Measured 2026-09-28 on the throwaway probe.
WT_JSON="$(orca worktree list --json 2>/dev/null)" || die "could not read the worktree list"
SETTLE_ITEM="$(ls -t "$INBOX"/*"$DISPATCH"* 2>/dev/null | grep -v 'task-settled-no-delivery' | head -1)"
SRC_HANDLE=""
[ -n "$SETTLE_ITEM" ] && SRC_HANDLE="$(grep -oE 'term_[0-9a-f]{8}-[0-9a-f-]{27}' "$SETTLE_ITEM" 2>/dev/null | head -1)"
[ -n "$SRC_HANDLE" ] || SRC_HANDLE="${SETTLE_FROM_HANDLE:-}"
WT=""
# FIRST: ask Orca which terminal this dispatch owns. This is the reliable mapping - the worker record
# carries agentTerminalHandle, and the terminal carries its worktreePath. The two older lookups below
# both failed on real dispatches (measured 2026-09-30 on reviewer-162g, tester-162 and reviewer-163b):
# the settlement file is named per dispatch only AFTER this script writes one, and matching the
# dispatch id against the worktree PATH can never match, because paths are named by role.
WT="$(orca orchestration worker-list --run "$RUN" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).workers||[]; const x=w.find(y=>y.dispatchId===want);
    process.stdout.write(x?(x.agentTerminalHandle||""):""); }catch(e){}
});' "$DISPATCH")"
if [ -n "$WT" ]; then
  SRC_HANDLE="$WT"
  WT="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).terminals||[]; const hit=t.find(x=>x.handle===want);
    process.stdout.write(hit?(hit.worktreePath||""):""); }catch(e){}
});' "$SRC_HANDLE")"
  [ -n "$WT" ] && say "worktree from the dispatch's own terminal $SRC_HANDLE: $WT"
fi
if [ -n "$SRC_HANDLE" ]; then
  WT="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const t=(JSON.parse(s).result||{}).terminals||[];
    const hit=t.find(x=>x.handle===want);
    process.stdout.write(hit?(hit.worktreePath||""):"");
  }catch(e){ process.stdout.write(""); }
});' "$SRC_HANDLE")"
  [ -n "$WT" ] && say "worktree from the settlement terminal $SRC_HANDLE: $WT"
fi
if [ -z "$WT" ]; then
  WT="$(printf '%s' "$WT_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).worktrees||[];
    const hit=w.find(x=>String(x.path||"").indexOf(want)>=0);
    process.stdout.write(hit?hit.path:"");
  }catch(e){ process.stdout.write("PARSE_ERROR"); }
});' "${SETTLE_WORKTREE_HINT:-$DISPATCH}")"
fi
case "$WT" in
  PARSE_ERROR) die "could not parse 'orca worktree list --json' (this is the reap.sh failure mode)" ;;
  "") say "no worktree matches this dispatch - nothing to remove" ;;
  *)  say "worktree: $WT" ;;
esac

# ---- 5. release (always, even with no worktree), then close, then remove --------------
# CodeRabbit Major: the release used to live inside `if [ -n "$WT" ]`, so a dispatch whose
# worktree was already gone was never released and the script still printed DONE. The
# release is now unconditional, and an unconfirmed one is fatal instead of a log line.
if [ -z "$DRY" ]; then
  REL="$(orca orchestration worker-release --dispatch "$DISPATCH" --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const i=s.indexOf("{"); const j=JSON.parse(i>=0?s.slice(i):s); process.stdout.write(j.ok?((j.result&&j.result.state)||"released"):("ERR:"+((j.error&&j.error.code)||"?"))); }
  catch(e){ process.stdout.write("UNPARSED"); }
});')"
  say "release -> $REL"
  case "$REL" in
    ERR:*|UNPARSED) die "release did not confirm ($REL) - the dispatch may still be held" ;;
    retained) say "release reported 'retained' (measured on this host: it does not free the dispatch); continuing" ;;
    *) say "release state: $REL" ;;
  esac
else
  say "DRY-RUN would release $DISPATCH"
fi

if [ -n "$WT" ]; then
  . "$HERE/repo-id.sh" 2>/dev/null || true
  [ -n "${REPO_ID:-}" ] || die "could not resolve the Orca repo id (see repo-id.sh)"
  run_or_show orca terminal close --worktree "id:$REPO_ID::$WT" --all --json >/dev/null 2>&1
  if [ -n "${NO_DELIVERY:-}" ] && [ -z "${FORCE_REMOVE:-}" ]; then
    # Keep it: with no settlement, the worktree is the only record of what the dispatch did.
    say "KEEPING the worktree as evidence: no settlement exists for $DISPATCH (pass --force-remove to drop it)"
  else
  run_or_show orca worktree rm --worktree "id:$REPO_ID::$WT" --force --json >/dev/null 2>&1
  if [ -z "$DRY" ]; then
    [ -d "$WT" ] && die "worktree directory still exists after rm: $WT"
    say "worktree removed and verified gone: $WT"
  fi
  fi

  # ---- 6. the local branch, only when a merged PR contains its tip -------------------
  BR="$(printf '%s' "$WT_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const want=process.argv[1];
  try{ const w=(JSON.parse(s).result||{}).worktrees||[];
    const hit=w.find(x=>String(x.path||"")===want);
    process.stdout.write(hit?(hit.branch||"").replace(/^refs\/heads\//,""):"");
  }catch(e){}
});' "$WT")"
  if [ -n "$BR" ]; then
    TIP="$(git -C "$WT" rev-parse --short HEAD 2>/dev/null || git rev-parse --short "$BR" 2>/dev/null || echo "")"
    if [ -n "$TIP" ]; then
      PROOF="$(gh api "repos/{owner}/{repo}/commits/$TIP/pulls" --jq '[.[] | select(.merged_at != null) | "#\(.number)"] | join(",")' 2>/dev/null)"
      if [ -n "$PROOF" ]; then
        run_or_show git branch -D "$BR"
        say "local branch $BR deleted (tip $TIP is in merged PR $PROOF)"
      else
        say "local branch $BR KEPT: no merged PR contains tip $TIP (prove it first)"
      fi
    fi
  fi
fi

# ---- 7. ghost terminals: a terminal whose dispatch is gone ---------------------------
AGENTS="$(orca terminal list --json 2>/dev/null | node "$HERE_NATIVE/lib/agent-terminals.cjs")"
N_AGENTS="$(printf '%s' "$AGENTS" | grep -c . || true)"
say "agent terminals seen: $N_AGENTS"
# A ghost is an AGENT terminal whose handle no dispatch in this run names any more - the shape that
# kept 341 MB and kept sending heartbeats Orca rejected. The coordinator's own terminal and plain
# shells are never candidates: only terminals with an agent identity are considered, and each
# decision prints its evidence before anything is closed.
if [ -n "$KILL_GHOSTS" ]; then
  LIVE_HANDLES="$(orca orchestration worker-list --run "$RUN" --json 2>/dev/null | node "$HERE_NATIVE/lib/dispatch-handles.cjs")"
  say "dispatch-named handles: $(printf '%s' "$LIVE_HANDLES" | grep -c . || true)"
  printf '%s\n' "$AGENTS" | while IFS='|' read -r h w a; do
    [ -n "$h" ] || continue
    if printf '%s\n' "$LIVE_HANDLES" | grep -qx "$h"; then
      say "  keep  $h ($a) - a dispatch in $RUN still names it"
    else
      say "  ghost $h ($a) at $w - no dispatch in $RUN names it; closing"
      run_or_show orca terminal close --terminal "$h" --json
    fi
  done
fi

say "DONE $DISPATCH"
exit 0
