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
S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
TMP="${LOCALAPPDATA}/Temp/watch_$$.json"
START=$(date +%s)

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
