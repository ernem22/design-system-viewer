#!/usr/bin/env bash
# Block until the Run has something for the coordinator, then print it and exit.
#
# Why: watchd.sh prints WAKE lines into a log nobody is reading at the right moment, and a
# notify pattern on it either floods or hits its lifetime cap. A settlement that is only
# noticed when the operator happens to ask is a settlement we "failed to catch".
#
# This exits the moment a non-heartbeat delivery appears, so it can be run as a background
# process with notify_on_complete: the ping IS the settlement.
#
#   await.sh [timeout_seconds] [poll_seconds]
set -uo pipefail

RUN="${WATCH_RUN:-run_4e539259ab29}"
TIMEOUT="${1:-1500}"
POLL="${2:-20}"
TMP="${LOCALAPPDATA:-/tmp}/Temp"
mkdir -p "$TMP"
TMPF="$(printf '%s' "$TMP" | tr '\\\\' '/')"

# A worker can finish WITHOUT sending a message: it opens its PR, its dispatch settles, and
# nothing lands in the mailbox. Watching only the mailbox misses exactly that, so we also
# snapshot which dispatches are already settled and report the new ones.
settled_snapshot() {
  orca orchestration worker-list --run "$RUN" --json > "$TMP/await_workers.json" 2>/dev/null || true
  AWAIT_TMP="$TMPF" node -e "
    const fs=require('fs');
    let j; try{ j=JSON.parse(fs.readFileSync(process.env.AWAIT_TMP+'/await_workers.json','utf8')); }catch(e){ process.exit(0); }
    const ws=((j.result||{}).workers)||[];
    for(const w of ws){
      if(['succeeded','failed','abandoned','cancelled'].includes(w.workerState||'')) console.log(w.dispatchId||'');
    }
  " 2>/dev/null | sort -u
}
settled_snapshot > "$TMP/await_settled_before.txt"

deadline=$(( $(date +%s) + TIMEOUT ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  orca orchestration check --run "$RUN" --json > "$TMP/await_check.json" 2>/dev/null || true
  hit="$(AWAIT_TMP="$TMPF" node -e "
    const fs=require('fs');
    let j; try{ j=JSON.parse(fs.readFileSync(process.env.AWAIT_TMP+'/await_check.json','utf8')); }catch(e){ console.log(''); process.exit(0); }
    if(!j.ok){ console.log(''); process.exit(0); }
    const r=j.result||{}; const ms=(r.messages||[]).filter(m=>m.type!=='heartbeat');
    if(!ms.length){ console.log(''); process.exit(0); }
    console.log(r.deliveryId||'delivery');
    for(const m of ms){
      console.log('--- '+m.type+' | '+String(m.subject||'').slice(0,120));
      console.log(String(m.body||'').slice(0,2000));
    }
  " 2>/dev/null)"

  new_settled="$(settled_snapshot | comm -13 "$TMP/await_settled_before.txt" - | head -5)"

  if [ -n "$hit" ] || [ -n "$new_settled" ]; then
    echo "AWAIT signal at $(date +%H:%M:%S)"
    [ -n "$hit" ] && echo "$hit"
    if [ -n "$new_settled" ]; then
      echo "--- settled dispatch(es) with no message:"
      echo "$new_settled"
      settled_snapshot > "$TMP/await_settled_before.txt"
    fi
    exit 0
  fi
  sleep "$POLL"
done
echo "AWAIT timeout after ${TIMEOUT}s — nothing arrived"
exit 3
