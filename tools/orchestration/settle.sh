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
#   settle.sh <dispatch_id> [--dry-run] [--kill-ghosts]
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
    -*) echo "settle: unknown flag: $1" >&2; exit 2;;
    *) DISPATCH="$1"; shift;;
  esac
done
[ -n "$DISPATCH" ] || { echo "usage: settle.sh <dispatch_id> [--dry-run] [--kill-ghosts]" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="${WATCH_RUN:-run_4e539259ab29}"
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
INBOX_HIT="$(ls "$INBOX" 2>/dev/null | grep -c -- "$DISPATCH" || true)"
say "task status=$TASK_STATUS  settlement in inbox: ${INBOX_HIT:-0}"

SETTLED=""
case "$TASK_STATUS" in completed|failed) SETTLED=1;; esac
[ "${INBOX_HIT:-0}" -gt 0 ] && SETTLED=1
case "$STATE" in abandoned|revoked) SETTLED="";; esac

if [ -z "$SETTLED" ]; then
  echo "settle: REFUSED - $DISPATCH has not settled (task=$TASK_STATUS, state=$STATE)." >&2
  echo "  A dispatch that never settled must be fenced, not released. Run:" >&2
  echo "    orca orchestration worker-abandon --dispatch $DISPATCH" >&2
  echo "    orca orchestration worker-start --task $TASK --retry-of $DISPATCH \\" >&2
  echo "      --terminal <fresh agent handle> --worktree \"id:<repo>::<fresh path>\" \\" >&2
  echo "      --run $RUN --from ${FROM:-<coordinator handle>}" >&2
  echo "  (--task and --spec are mutually exclusive; the Task already carries its spec)" >&2
  exit 1
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
      BLOCK=""
      if [ -f "$LOG" ]; then
        BLOCK="$(awk -v want="$DISPATCH" '
          BEGIN{RS="=== SETTLEMENT"}
          index($0, want) { last=$0 }
          END{ if (last!="") print "=== SETTLEMENT" last }' "$LOG")"
      fi
      if [ -n "$BLOCK" ]; then
        ITEM="$INBOX/$(date -u +%Y%m%dT%H%M%SZ)-$DISPATCH-from-watchd-log.md"
        printf '%s\n' "$BLOCK" > "$ITEM" || die "could not write $ITEM"
        say "settlement recovered from watchd.log into $ITEM (the watcher had already acked it)"
      else
        NOTE="$INBOX/$(date -u +%Y%m%dT%H%M%SZ)-$DISPATCH-task-settled-no-delivery.md"
        printf 'dispatch: %s\ntask: %s\ntask status: %s\nnote: the Task reads %s but no delivery was in the queue and no settlement was in watchd.log; nothing was acked.\n' \
          "$DISPATCH" "$TASK" "$TASK_STATUS" "$TASK_STATUS" > "$NOTE"
        say "no delivery in the queue and none in the log; wrote $NOTE"
      fi
      ;;
    PARSE_ERROR) die "could not parse the delivery queue" ;;
    *)
      DELIVERY="$(printf '%s' "$PARSED" | head -1)"
      ITEM="$INBOX/${DELIVERY}-$DISPATCH.md"
      printf '%s\n' "$PARSED" | tail -n +2 > "$ITEM" || die "could not write $ITEM"
      [ -s "$ITEM" ] || die "wrote an empty inbox item $ITEM"
      say "settlement written to $ITEM ($(wc -l < "$ITEM") lines)"
      if [ -z "$DRY" ]; then
        orca orchestration check --run "$RUN" --ack "$DELIVERY" --json >/dev/null 2>&1 \
          || die "could not ack $DELIVERY"
        say "acked $DELIVERY (after the inbox write)"
      else
        say "DRY-RUN would ack $DELIVERY"
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
SETTLE_ITEM="$(ls -t "$INBOX"/*"$DISPATCH"* 2>/dev/null | head -1)"
SRC_HANDLE=""
[ -n "$SETTLE_ITEM" ] && SRC_HANDLE="$(grep -oE 'term_[0-9a-f]{8}-[0-9a-f-]{27}' "$SETTLE_ITEM" 2>/dev/null | head -1)"
[ -n "$SRC_HANDLE" ] || SRC_HANDLE="${SETTLE_FROM_HANDLE:-}"
WT=""
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

# ---- 5. release, then close the terminals, then remove the worktree -------------------
if [ -n "$WT" ]; then
  if [ -z "$DRY" ]; then
    REL="$(orca orchestration worker-release --dispatch "$DISPATCH" --json 2>&1 | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const j=JSON.parse(s); process.stdout.write(j.ok?((j.result&&j.result.state)||"released"):("ERR:"+((j.error&&j.error.code)||"?"))); }
  catch(e){ process.stdout.write("UNPARSED"); }
});')"
    say "release -> $REL"
    case "$REL" in
      ERR:*|UNPARSED) say "release did not confirm; the dispatch may already be fenced - continuing" ;;
    esac
  else
    say "DRY-RUN would release $DISPATCH"
  fi

  . "$HERE/repo-id.sh" 2>/dev/null || true
  [ -n "${REPO_ID:-}" ] || die "could not resolve the Orca repo id (see repo-id.sh)"
  run_or_show orca terminal close --worktree "id:$REPO_ID::$WT" --all --json >/dev/null 2>&1
  run_or_show orca worktree rm --worktree "id:$REPO_ID::$WT" --force --json >/dev/null 2>&1
  if [ -z "$DRY" ]; then
    [ -d "$WT" ] && die "worktree directory still exists after rm: $WT"
    say "worktree removed and verified gone: $WT"
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
GHOSTS="$(orca terminal list --json 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{ const t=(JSON.parse(s).result||{}).terminals||[];
    const out=t.filter(x=>!x.orphaned).map(x=>x.handle+" "+(x.worktreePath||"")+" "+(x.agentIdentity||"-"));
    process.stdout.write(out.join("\n"));
  }catch(e){}
});')"
say "terminals seen: $(printf '%s' "$GHOSTS" | grep -c . || true) (ghost detection needs the dispatch map; run --kill-ghosts to act)"
if [ -n "$KILL_GHOSTS" ]; then
  say "ghost handling is driven by the coordinator's dispatch list, not by this script alone"
fi

say "DONE $DISPATCH"
exit 0
