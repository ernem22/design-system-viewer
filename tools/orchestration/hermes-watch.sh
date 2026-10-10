#!/usr/bin/env bash
# Wake the manager (Hermes) when the pipeline needs attention. The process EXIT is the wake: Hermes
# runs this in the background with notify-on-complete, reads what it printed, acts, and runs it again.
# (A stdout pattern cannot be the wake: this host caps pattern wakes at 8 per process, measured
# 2026-09-28. Orca's own mailbox cannot be either: Hermes's terminal is fenced off the dispatcher's
# Run, `check` answers consumer_fenced, measured 2026-10-05.)
#
#   hermes-watch.sh [--max-wait <seconds>]      (default 3600)
#
# Prints, then exits 0, when any of these appears:
#   * an attention event in events.log (written by dispatch.sh):
#       kept no-pr no-push unknown start-failed start-refused verdict-refused merge-refused leftover gave-up down
#       orphaned disk-low provider-error merged
#   * dispatcher-dead: dispatch.lock has held no live pid for DEAD_AFTER seconds (default 600; the
#     scheduled bootstrap restarts it every 5 min, so this means the restart itself is failing)
#   * idle-with-work: no worker live and nothing queued for IDLE_AFTER seconds (default 1800) while
#     needs.sh still lists owed work
#   * intake: an open `agent` issue without `intake-ok` (or umbrella/retired) that no wake has named
#     yet (GitHub read at most every 5 min)
#   * stuck: one PR or issue collected 2 or more failed results (failed, timeout, exited, agent_wait,
#     blocked, verdict-refused, no-pr, no-push, unknown, start-failed) in the last 24 h; named once a day
# Exits 3 after --max-wait with nothing to report (a heartbeat: just run it again).
# Routine events (up, started, finished) are read and skipped; they never wake anyone.
# Reads only. It starts, stops and changes nothing.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
EV="$S/events.log"; OFF="$S/events.hermes-offset"; LOCK="$S/hermes-watch.lock"
MAX_WAIT=3600; [ "${1:-}" = "--max-wait" ] && MAX_WAIT="${2:?--max-wait needs seconds}"
DEAD_AFTER="${DEAD_AFTER:-600}"; IDLE_AFTER="${IDLE_AFTER:-1800}"; TICK=15
ATTN='^[^ ]+ (kept|no-pr|no-push|unknown|start-failed|start-refused|verdict-refused|merge-refused|leftover|gave-up|down|orphaned|disk-low|provider-error|merged)( |$)'
REPO="${DSV_REPO:-ernem22/design-system-viewer}"

# one watcher at a time; a lock left by a dead watcher is taken over
if ! mkdir "$LOCK" 2>/dev/null; then
  OLD="$(cat "$LOCK/pid" 2>/dev/null)"
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then echo "hermes-watch: another watcher is running (pid $OLD)"; exit 4; fi
  rm -rf "$LOCK"; mkdir "$LOCK" || exit 2
fi
echo $$ > "$LOCK/pid"; trap 'rm -rf "$LOCK"' EXIT

T0="$(date +%s)"; DEAD_SINCE=""; IDLE_SINCE=""; LAST_NEEDS=0
while :; do
  NOW="$(date +%s)"
  # 1. events
  if [ -f "$EV" ]; then
    SIZE="$(wc -c < "$EV" | tr -d ' ')"; O="$(cat "$OFF" 2>/dev/null || echo 0)"
    [ "$SIZE" -lt "$O" ] && O=0
    if [ "$SIZE" -gt "$O" ]; then
      NEW="$(tail -c +"$((O + 1))" "$EV")"; echo "$SIZE" > "$OFF"
      HIT="$(printf '%s\n' "$NEW" | grep -E "$ATTN")"
      if [ -n "$HIT" ]; then printf 'WAKE events\n%s\n' "$HIT"; exit 0; fi
    fi
  fi
  # 2. dispatcher alive
  PID="$(cat "$S/dispatch.lock" 2>/dev/null)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then DEAD_SINCE=""
  else
    DEAD_SINCE="${DEAD_SINCE:-$NOW}"
    if [ $((NOW - DEAD_SINCE)) -ge "$DEAD_AFTER" ]; then
      printf 'WAKE dispatcher-dead\nno live dispatcher for %ss (lock pid: %s); last launcher lines:\n' "$((NOW - DEAD_SINCE))" "${PID:-none}"
      tail -5 "$S/launcher.log" 2>/dev/null; exit 0
    fi
  fi
  # 3. idle while work is owed (needs.sh asks GitHub, so at most every 5 min)
  if ! ls "$S"/running/*.env >/dev/null 2>&1 && [ -z "$(ls -A "$S/queue" 2>/dev/null)" ]; then
    IDLE_SINCE="${IDLE_SINCE:-$NOW}"
    if [ $((NOW - IDLE_SINCE)) -ge "$IDLE_AFTER" ] && [ $((NOW - LAST_NEEDS)) -ge 300 ]; then
      LAST_NEEDS="$NOW"; OWED="$(bash "$HERE/needs.sh" 2>/dev/null)"
      if [ -n "$OWED" ]; then printf 'WAKE idle-with-work\nnothing live or queued for %ss, but needs.sh lists:\n%s\n' "$((NOW - IDLE_SINCE))" "$OWED"; exit 0; fi
    fi
  else IDLE_SINCE=""
  fi
  # 4. intake: agent issues no manager has checked yet
  if [ $((NOW - ${LAST_INTAKE:-0})) -ge 300 ]; then
    LAST_INTAKE="$NOW"
    NEWI="$(gh issue list --repo "$REPO" --label agent --state open --json number,labels \
      --jq '.[]|select([.labels[].name]|any(.=="intake-ok" or .=="umbrella" or .=="retired")|not)|.number' 2>/dev/null \
      | while read -r n; do grep -qx "$n" "$S/intake.woken" 2>/dev/null || echo "$n"; done)"
    if [ -n "$NEWI" ]; then printf '%s\n' $NEWI >> "$S/intake.woken"
      printf 'WAKE intake\nagent issues not checked yet: %s\n' "$(echo $NEWI)"; exit 0; fi
  fi
  # 5. stuck: repeated failures on one PR/issue (done/ files of the last 24 h)
  if [ $((NOW - ${LAST_STUCK:-0})) -ge 600 ]; then
    LAST_STUCK="$NOW"
    STUCK="$(find "$S/done" -maxdepth 1 -type f -mmin -1440 2>/dev/null \
      | grep -E '\.(failed|timeout|exited|agent_wait|blocked|verdict-refused|no-pr|no-push|unknown|start-failed)$' \
      | while read -r f; do r="$(sed -n '1,/^---$/s/^role: *//p' "$f" | head -1)"; k="$(sed -n '1,/^---$/s/^\(pr\|issue\): *//p' "$f" | head -1)"; [ -n "$k" ] && echo "$r #$k"; done \
      | sort | uniq -c | awk '$1>=2{print $2" "$3" ("$1" failed results)"}' \
      | while read -r line; do key="$(date -u +%F) $line"; k2="$(printf '%s' "$line" | cut -d' ' -f1-2)"; grep -qF "$(date -u +%F) $k2" "$S/stuck.woken" 2>/dev/null || { echo "$(date -u +%F) $k2" >> "$S/stuck.woken"; echo "$line"; }; done)"
    if [ -n "$STUCK" ]; then printf 'WAKE stuck\n%s\n' "$STUCK"; exit 0; fi
  fi
  [ $((NOW - T0)) -ge "$MAX_WAIT" ] && { echo "HEARTBEAT nothing needs attention"; exit 3; }
  sleep "$TICK"
done
