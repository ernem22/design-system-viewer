#!/usr/bin/env bash
# Wake the coordinator when something needs acting on.
#
# Why it exists: Orca has no push channel into the coordinator's session, so a
# settlement sat in the queue until a human poked the coordinator — measured at
# 24-31 minutes on this run. This script blocks on Orca's own queue and EXITS the
# moment something informative arrives, so the completion notice of the
# background process *is* the push channel. Run it as:
#
#   terminal(background=true, notify=true): bash tools/orchestration/watch.sh <run-id> [max-seconds]
#
# Then: read its output, act on the settlement, and start a fresh watcher. The
# watcher holds no state; Orca's queue is the only queue.
#
# TWO things count as informative, because a settlement is not the only thing that
# gets missed:
#   1. a settlement in the queue (worker_done / escalation / question / status)
#   2. a STALLED worker — one that is still live but has stopped progressing. This is
#      the case that reads as "it finished" while nothing was posted and nothing ever
#      will be: the agent ended its turn and is waiting for input, or is waiting for a
#      permission it will never get (a plan-mode reviewer asking to exit plan mode is
#      the canonical example — it sat 25 minutes like that).
#
# The stall signal is read off the TUI, which is the only place it exists:
#   - the context counter   `76.7K (8%)`   grows as the agent works
#   - the turn timer        `· 2m 48s`     ticks while a turn is running
# A working worker moves at least one of them between samples; a stopped one moves
# neither, and its footer shows a dotted bar with no timer. Two consecutive frozen
# samples (≈2 polls) is a stall — one sample can be a long tool call.
#
# Exit codes: 0 = something to act on (its report is on stdout)
#             3 = max-seconds elapsed with nothing but heartbeats
#             4 = another waiter already holds this run (Orca allows one)
#
# usage: watch.sh [run-id] [max-seconds] [--skip-existing]
set -uo pipefail

RUN="${1:-run_4e539259ab29}"
MAX="${2:-3600}"
SKIP_EXISTING=""
for arg in "$@"; do [ "$arg" = "--skip-existing" ] && SKIP_EXISTING=1; done
case "$MAX" in --*) MAX=3600 ;; esac
S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
TMP="${LOCALAPPDATA}/Temp/watch_$$.json"
STALLTMP="${LOCALAPPDATA}/Temp/watch_stall_$$.txt"
START=$(date +%s)
: > "$STALLTMP"

# An unacked settlement is redelivered forever, and every watcher wakes on it
# immediately — so an old message makes this script useless. With --skip-existing
# the queue is drained once, printing what it acks, and the watcher then reports
# only what arrives after it started.
if [ -n "$SKIP_EXISTING" ]; then
  orca orchestration check --run "$RUN" --json > "$TMP" 2>/dev/null
  # The ack takes the DELIVERY id (result.deliveryId), not the message id: acking
  # with msg_... returns ok:false and leaves the queue untouched.
  #
  # It also PRINTS what it drains: a drain that acks unread is how a settlement
  # gets lost (tester-69's did, swallowed between a read and an arming). The body
  # is printed before the ack so the log keeps it either way.
  DID=$(node -e "
const fs=require('fs');
try{ const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
  const r=j.result||{};
  const list=r.deliveries||r.messages||[];
  for(const d of list){
    const p=d.payload||{};
    console.log('watch: PRE-EXISTING '+(d.type||'')+' '+(p.taskId||'-')+' at '+String(d.created_at||'').slice(11,19));
    console.log((d.body||'').split('\n').slice(0,25).join('\n'));
    console.log('---');
  }
  console.log('DELIVERY='+(r.deliveryId||''));
}catch(e){}
" "$TMP")
  printf '%s\n' "$DID"
  FIRST=$(printf '%s' "$DID" | grep '^DELIVERY=' | cut -d= -f2)
  if [ -n "$FIRST" ]; then
    orca orchestration check --run "$RUN" --ack "$FIRST" --json >/dev/null 2>&1 \
      && echo "watch: acked pre-existing $FIRST (printed above)"
  fi
fi

# The workers that are still live: those whose TASK is still `dispatched`. Listing every
# opencode terminal instead would flag finished workers too — their terminal lingers after
# their verdict is posted, and calling that "stalled" is a false alarm that trains you to
# ignore the signal.
live_workers() {
  orca orchestration task-list --json 2>/dev/null | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      let j; try{ j=JSON.parse(s); }catch(e){ process.exit(0); }
      for(const t of ((j.result||{}).tasks)||[]){
        if(t.status==='dispatched') console.log(t.id);
      }
    });" | while read -r tid; do
      [ -z "$tid" ] && continue
      orca orchestration dispatch-show --task "$tid" --json 2>/dev/null | node -e "
        let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
          let j; try{ j=JSON.parse(s); }catch(e){ process.exit(0); }
          const d=(j.result||{}).dispatch||{};
          if(d.assignee_handle) console.log(d.assignee_handle+' '+(d.task_id||'').slice(5,13));
        });"
    done
}

# "<timer>|<counter>" for one terminal — either part may be empty.
progress_of() {
  orca terminal read --terminal "$1" 2>&1 | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g' \
    | grep -aoE '[0-9]+\.[0-9]K \([0-9]+%\)|· [0-9]+m [0-9]+s|· [0-9]+s' | tail -2 | tr '\n' '|'
}

# Print one line per stalled worker, or nothing.
stalled_workers() {
  local handle name sig prev n out=""
  while read -r handle name; do
    [ -z "$handle" ] && continue
    sig="$(progress_of "$handle")"
    prev="$(grep -F "$handle " "$STALLTMP" 2>/dev/null | head -1 | cut -d' ' -f2- | cut -d: -f2)"
    if [ -n "$sig" ] && [ "$sig" = "$prev" ]; then
      n="$(grep -F "$handle " "$STALLTMP" 2>/dev/null | head -1 | cut -d: -f1 | awk '{print $2}')"
      n=$(( ${n:-0} + 1 ))
      grep -vF "$handle " "$STALLTMP" > "$STALLTMP.new" 2>/dev/null; mv "$STALLTMP.new" "$STALLTMP" 2>/dev/null
      echo "$handle $n:$sig" >> "$STALLTMP"
      [ "$n" -ge 2 ] && out="$out  $name ($handle) — frozen at $sig for $((n * 30))s, turn ended, no settlement"$'\n'
    else
      grep -vF "$handle " "$STALLTMP" > "$STALLTMP.new" 2>/dev/null; mv "$STALLTMP.new" "$STALLTMP" 2>/dev/null
      echo "$handle 0:$sig" >> "$STALLTMP"
    fi
  done < <(live_workers)
  printf '%s' "$out"
}

while :; do
  NOW=$(date +%s)
  if [ $((NOW - START)) -ge "$MAX" ]; then
    echo "watch: ${MAX}s elapsed, heartbeats only, no settlement"
    rm -f "$TMP" "$STALLTMP"; exit 3
  fi

  orca orchestration check --run "$RUN" --wait \
    --types "worker_done,escalation,question,status" --timeout-ms 30000 \
    --json > "$TMP" 2>/dev/null

  SUM=$(node "$S/tools/check_summary.js" "$TMP" 2>/dev/null)

  case "$SUM" in
    *informative=true*)
      echo "=== SETTLEMENT $(date +%T)"
      node "$S/tools/parse_check.js" "$TMP" | head -60
      rm -f "$TMP" "$STALLTMP"
      exit 0
      ;;
    "")
      # no parse: could be the one-waiter lock, or Orca refusing the wait
      echo "watch: could not read the queue — $(printf '%s' "$SUM" | head -c 120)"
      rm -f "$TMP" "$STALLTMP"; exit 4
      ;;
    *)
      # heartbeat-only batch: ack it so the queue does not grow, keep waiting
      DID=$(node -e "const fs=require('fs');try{const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const r=j.result||{};console.log(r.deliveryId||('delivery_'+(r.id||'').replace(/^msg_/,''))||'')}catch(e){console.log('')}" "$TMP" 2>/dev/null)
      [ -n "$DID" ] && orca orchestration check --run "$RUN" --ack "$DID" --json >/dev/null 2>&1
      ;;
  esac

  # Nothing in the queue — but is anyone still working?
  STALLED="$(stalled_workers)"
  if [ -n "$STALLED" ]; then
    echo "=== STALLED WORKER(S) $(date +%T)"
    echo "A live dispatch whose turn has ended and whose progress signal has not moved."
    echo "It will not settle on its own: nudge it (terminal send), or reap and re-dispatch."
    printf '%s' "$STALLED"
    rm -f "$TMP" "$STALLTMP"
    exit 0
  fi
done
