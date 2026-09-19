#!/usr/bin/env bash
# Wake the coordinator when a settlement arrives.
#
# Why it exists: Orca has no push channel into the coordinator's session, so a
# settlement sat in the queue until a human poked the coordinator — measured at
# 24-31 minutes on this run. This script blocks on Orca's own queue and EXITS the
# moment an informative settlement arrives, so the completion notice of the
# background process *is* the push channel. Run it as:
#
#   terminal(background=true, notify=true): bash tools/orchestration/watch.sh <run-id> [max-seconds]
#
# Then: read its output, act on the settlement, and start a fresh watcher. The
# watcher holds no state; Orca's queue is the only queue.
#
# Exit codes: 0 = informative settlement (its report is on stdout)
#             3 = max-seconds elapsed with nothing but heartbeats
#             4 = another waiter already holds this run (Orca allows one)
#
# usage: watch.sh [run-id] [max-seconds]
set -uo pipefail

RUN="${1:-run_4e539259ab29}"
MAX="${2:-3600}"
SKIP_EXISTING=""
for arg in "$@"; do [ "$arg" = "--skip-existing" ] && SKIP_EXISTING=1; done
case "$MAX" in --*) MAX=3600 ;; esac
S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
TMP="${LOCALAPPDATA}/Temp/watch_$$.json"
START=$(date +%s)

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

while :; do
  NOW=$(date +%s)
  if [ $((NOW - START)) -ge "$MAX" ]; then
    echo "watch: ${MAX}s elapsed, heartbeats only, no settlement"
    rm -f "$TMP"; exit 3
  fi

  orca orchestration check --run "$RUN" --wait \
    --types "worker_done,escalation,question,status" --timeout-ms 30000 \
    --json > "$TMP" 2>/dev/null

  SUM=$(node "$S/tools/check_summary.js" "$TMP" 2>/dev/null)

  case "$SUM" in
    *informative=true*)
      echo "=== SETTLEMENT $(date +%T)"
      node "$S/tools/parse_check.js" "$TMP" | head -60
      rm -f "$TMP"
      exit 0
      ;;
    "")
      # no parse: could be the one-waiter lock, or Orca refusing the wait
      echo "watch: could not read the queue — $(printf '%s' "$SUM" | head -c 120)"
      rm -f "$TMP"; exit 4
      ;;
    *)
      # heartbeat-only batch: ack it so the queue does not grow, keep waiting
      DID=$(node -e "const fs=require('fs');try{const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const r=j.result||{};console.log(r.deliveryId||('delivery_'+(r.id||'').replace(/^msg_/,''))||'')}catch(e){console.log('')}" "$TMP" 2>/dev/null)
      [ -n "$DID" ] && orca orchestration check --run "$RUN" --ack "$DID" --json >/dev/null 2>&1
      ;;
  esac
done
