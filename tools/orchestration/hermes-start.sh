#!/usr/bin/env bash
# Cold start for the manager (Hermes): run it first in every session, then arm the watcher.
# It answers "is everything up, and what needs me?" in one read, and fixes the one thing it may fix
# by itself: a dead dispatcher is restarted through the same bootstrap the scheduled task runs.
#
#   hermes-start.sh             check, restart a dead dispatcher, probe each role's model
#   hermes-start.sh --no-probe  the same without the model probes (each probe is one request)
#
# Prints sections, then a final line `NEXT:` with what the manager does now. Changes nothing else:
# a paused pipeline stays paused (the reason is printed), a failing model is reported, not switched.
# Why (2026-10-07): after a session restart the watcher was not running, and the owner had to start
# it by hand; the manager had no single place to learn the state it wakes up into.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
REPO="${DSV_REPO:-ernem22/design-system-viewer}"
PROBE=1; [ "${1:-}" = "--no-probe" ] && PROBE=""
TODO=()

echo "== code"
echo "checkout: $(git -C "$HERE/../.." log --oneline -1 2>/dev/null)"
git -C "$HERE/../.." status --short 2>/dev/null | sed 's/^/local change: /'

echo "== dispatcher"
PID="$(cat "$S/dispatch.lock" 2>/dev/null)"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then echo "alive: pid $PID"
else
  echo "NOT RUNNING (lock: ${PID:-none}); starting it through bootstrap.sh"
  if [ -f "$S/bootstrap.sh" ]; then bash "$S/bootstrap.sh" D:/code/dsv-dispatcher D:/code/design-system-viewer 2>&1 | tail -3
  else bash "$HERE/launch-dispatcher.sh" 2>&1 | tail -3; fi
  sleep 10   # the launcher opens an Orca terminal; measured: alive ~3 s later
  PID="$(cat "$S/dispatch.lock" 2>/dev/null)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then echo "now alive: pid $PID"
  else echo "STILL NOT RUNNING"; TODO+=("dispatcher does not start: read $S/launcher.log and report it"); fi
fi
if command -v schtasks >/dev/null 2>&1; then
  schtasks //Query //TN dsv-dispatcher >/dev/null 2>&1 && echo "keep-alive task: present" \
    || { echo "keep-alive task: MISSING"; TODO+=("the dsv-dispatcher scheduled task is missing: report it (install-dispatcher.ps1)"); }
fi
if [ -f "$S/dispatch.paused" ]; then echo "PAUSED since $(cat "$S/dispatch.paused")"; TODO+=("pipeline paused: check whether the reason still holds before dispatch.sh --resume")
elif [ -f "$S/dispatch.enabled" ]; then echo "acting: yes"
else echo "acting: NO (dispatch.enabled missing, no pause reason)"; TODO+=("dispatch.enabled is missing with no pause reason: report it, do not resume on your own")
fi

echo "== resources"
FREE="$(df -Pm "$S" 2>/dev/null | awk 'NR==2{print $4}')"; echo "disk free on state drive: ${FREE:-?} MB"
[ -n "$FREE" ] && [ "$FREE" -lt "${DISK_MIN_MB:-2048}" ] && TODO+=("disk below ${DISK_MIN_MB:-2048} MB: nothing starts; report the largest folders")
grep -E 'memory: [0-9]+ MB free' "$S/dispatch.log" 2>/dev/null | tail -1

echo "== models"
for C in write readonly tester; do
  M="$(node "$HERE_NATIVE/lib/jget.cjs" model < "$HERE/roles/$C.opencode.json" 2>/dev/null)"
  if [ -n "$PROBE" ]; then
    R="$(bash "$HERE/model-switch.sh" --probe "$M")" || TODO+=("$C model $M does not answer: decide model-switch.sh (see ORCHESTRATION.md)")
    echo "$C: $R"
  else echo "$C: $M"; fi
done

echo "== work"
echo "running: $(ls "$S/running" 2>/dev/null | wc -l | tr -d ' ')  queued: $(ls "$S/queue" 2>/dev/null | wc -l | tr -d ' ')"
echo "last events:"; tail -8 "$S/events.log" 2>/dev/null | sed 's/^/  /'
# the watcher's offset: events after it were not seen by a manager yet
OFF="$(cat "$S/events.hermes-offset" 2>/dev/null || echo 0)"; SIZE="$(wc -c < "$S/events.log" 2>/dev/null | tr -d ' ')"
if [ -n "$SIZE" ] && [ "$SIZE" -gt "$OFF" ]; then
  UNSEEN="$(tail -c +"$((OFF + 1))" "$S/events.log" | grep -cE ' (kept|no-pr|no-push|unknown|start-failed|verdict-refused|merge-refused|leftover|gave-up|down|orphaned|disk-low|provider-error|merged)( |$)')"
  [ "$UNSEEN" -gt 0 ] && TODO+=("$UNSEEN attention/merged event(s) since the last watch: the watcher prints them on its first read; act on them")
fi

echo "== intake"
if command -v gh >/dev/null 2>&1; then
  NEW="$(gh issue list --repo "$REPO" --label agent --state open --json number,labels \
    --jq '.[]|select([.labels[].name]|any(.=="intake-ok" or .=="umbrella" or .=="retired")|not)|.number' 2>/dev/null | tr '\n' ' ')"
  echo "agent issues without intake-ok: ${NEW:-none}"
  [ -n "${NEW// /}" ] && TODO+=("intake check for: $NEW")
fi

echo "== todo"
if [ ${#TODO[@]} -eq 0 ]; then echo "nothing"; else printf -- '- %s\n' "${TODO[@]}"; fi
echo "NEXT: act on the todo list above (ORCHESTRATION.md, Duties), then run in the background with notify-on-complete:"
echo "      bash $HERE_NATIVE/hermes-watch.sh"
