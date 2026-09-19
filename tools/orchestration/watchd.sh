#!/usr/bin/env bash
# watchd.sh — the wake-up channel, with no gap.
#
# watch.sh exits on the first settlement. That exit is what makes Hermes' notification
# fire, but it also opens a hole: between that exit and the coordinator's next manual
# arming there is no listener at all, and a settlement that lands in the hole is read
# by nobody. Tonight that hole is what felt like "the thing that closes finished items
# is broken" — the mechanism was fine, the channel was simply empty.
#
# watchd.sh runs watch.sh in a loop inside ONE long-lived process and prints a line
# starting with `WAKE` every time something needs the coordinator:
#
#   WAKE settlement   a worker_done/escalation/question arrived
#   WAKE drained      a delivery was waiting at arming time (it is acked, and printed)
#   WAKE queue-error  the queue could not be read
#
# Arm it once, with a pattern notification on `WAKE`:
#
#   bash tools/orchestration/watchd.sh run_4e539259ab29 1800
#
# It never exits (that is the point), so the notification must be pattern-based, not
# exit-based. Stop it by creating ${LOCALAPPDATA}/Temp/watchd.stop.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="${1:?usage: watchd.sh <run-id> [window-seconds]}"
SECS="${2:-1800}"
TMP="${LOCALAPPDATA:-/tmp}/Temp"
LOG="$TMP/watchd.log"
STOP="$TMP/watchd.stop"

echo "watchd: supervising run $RUN, ${SECS}s windows, log $LOG" | tee -a "$LOG"

while [ ! -f "$STOP" ]; do
  OUT="$(bash "$HERE/watch.sh" "$RUN" "$SECS" --skip-existing 2>&1)"
  RC=$?
  printf '%s\n' "$OUT" >> "$LOG"

  case "$RC" in
    0)
      echo "WAKE settlement $(date '+%T') — advance, merge, dispatch the next phase"
      ;;
    3)
      printf '%s\n' "$OUT" | grep -q 'acked pre-existing' \
        && echo "WAKE drained $(date '+%T') — a delivery was waiting at arming; read the log" \
        || echo "watchd: $(date '+%T') window expired, nothing new"
      ;;
    4)
      echo "WAKE queue-error $(date '+%T') — the queue could not be read"
      ;;
    *)
      echo "WAKE watchd-rc$RC $(date '+%T') — watcher returned an unexpected code"
      ;;
  esac

  # A watcher that returns instantly every time would spin this loop and flood the
  # notification channel; one second is enough to notice, thirty is enough to not.
  sleep 3
done

echo "watchd: stop file present, exiting"
