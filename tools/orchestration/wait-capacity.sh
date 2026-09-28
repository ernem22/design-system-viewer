#!/usr/bin/env bash
# Wait for capacity instead of stopping the pipeline for it.
#
# Why: "pause and tell the user to free RAM" was a manual intervention, and it was the
# most frequent one - the coordinator sat on free_slots=0 several times a session while
# nothing was actually wrong. The machine frees itself: measured on this host, closing
# idle terminals does NOT create headroom (740 MB -> 681 MB in capacity.js's own notes)
# and free RAM moved 977 -> 1,850 MB while load was being added. So the correct move is
# to wait, with a bound, and to keep doing other work while waiting.
#
#   wait-capacity.sh --min 600 [--timeout 900] [--interval 15] [--note "..."]
#
# Exit 0  -> available_mb >= --min, proceed with the dispatch.
# Exit 1  -> the timeout passed. An inbox item is written (durable, outside every repo)
#            and the caller continues with other work; this is NOT a stop signal.
#
# The reading comes from D:/code/orca-supervisor/src/capacity.js - the same number the
# dispatch decision uses, read live, never cached (that file is the only thing this
# script touches there, and it only reads it).
set -uo pipefail

MIN=""; TIMEOUT=900; INTERVAL=15; NOTE=""; CAPACITY_JS="${CAPACITY_JS:-D:/code/orca-supervisor/src/capacity.js}"
while [ $# -gt 0 ]; do
  case "$1" in
    --min) MIN="${2:?}"; shift 2;;
    --timeout) TIMEOUT="${2:?}"; shift 2;;
    --interval) INTERVAL="${2:?}"; shift 2;;
    --note) NOTE="${2:?}"; shift 2;;
    --capacity-js) CAPACITY_JS="${2:?}"; shift 2;;
    *) echo "wait-capacity: unknown argument: $1" >&2; exit 2;;
  esac
done
[ -n "$MIN" ] || { echo "wait-capacity: --min <mb> is required" >&2; exit 2; }
case "$MIN" in ''|*[!0-9]*) echo "wait-capacity: --min must be a number of MB (got '$MIN')" >&2; exit 2;; esac

INBOX_DIR="${INBOX_DIR:-${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/inbox}"

# read available_mb, loudly: a missing or unparseable reader is never treated as "fine"
read_avail() {
  [ -f "$CAPACITY_JS" ] || { echo "wait-capacity: capacity reader not found: $CAPACITY_JS" >&2; return 1; }
  local out
  out="$(node "$CAPACITY_JS" 2>&1)" || { echo "wait-capacity: capacity reader failed: $out" >&2; return 1; }
  local mb
  mb="$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.available_mb))}catch(e){process.stdout.write("")}})' 2>/dev/null)"
  case "$mb" in ''|*[!0-9]*) echo "wait-capacity: could not parse available_mb from: $out" >&2; return 1;; esac
  printf '%s' "$mb"
}

START="$(date +%s)"
while :; do
  AVAIL="$(read_avail)" || exit 2
  NOW="$(date +%s)"; ELAPSED=$((NOW - START))
  printf 'wait-capacity: available_mb=%s min=%s elapsed=%ss\n' "$AVAIL" "$MIN" "$ELAPSED"
  if [ "$AVAIL" -ge "$MIN" ]; then
    printf 'wait-capacity: PROCEED (available_mb %s >= %s)\n' "$AVAIL" "$MIN"
    exit 0
  fi
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    mkdir -p "$INBOX_DIR" || { echo "wait-capacity: cannot create inbox $INBOX_DIR" >&2; exit 2; }
    STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
    ITEM="$INBOX_DIR/${STAMP}-capacity-timeout.md"
    {
      printf '# Capacity wait timed out\n\n'
      printf -- '- at: %s\n' "$STAMP"
      printf -- '- wanted: available_mb >= %s\n' "$MIN"
      printf -- '- last reading: %s MB after %ss\n' "$AVAIL" "$ELAPSED"
      printf -- '- reader: %s\n' "$CAPACITY_JS"
      [ -n "$NOTE" ] && printf -- '- note: %s\n' "$NOTE"
      printf -- '- what this means: no dispatch happened for this reason. This is not a stop\n'
      printf '  signal - the caller continues with other work. If several of these pile up,\n'
      printf '  the machine is genuinely out of headroom and a human should look at what holds RAM.\n'
    } > "$ITEM"
    printf 'wait-capacity: TIMEOUT after %ss at %s MB; inbox item written: %s\n' "$ELAPSED" "$AVAIL" "$ITEM"
    exit 1
  fi
  sleep "$INTERVAL"
done
