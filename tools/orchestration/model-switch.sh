#!/usr/bin/env bash
# Move one role to the next working model in roles/fallback.txt. The manager (Hermes) decides WHEN
# (a provider-error it judged to be the model, not one worker); this hand does the mechanical part.
#
#   model-switch.sh <coder|fixer|reviewer|tester> [--to <model>]
#   model-switch.sh --probe <model>              one request; prints OK or the error, changes nothing
#   model-switch.sh --list                       each config's current model and its fallback order
#
# Without --to it tries, in order, every model listed AFTER the current one, and takes the first that
# answers a one-line probe (`opencode run -m <model>`, 90 s; on a timeout the whole process tree is killed). --to must name a listed model and is
# probed too. Nothing is written unless a probe passed. On success: the role config's "model" is
# rewritten, a `model-switch` event is written, and it prints SWITCHED <config> <from> -> <to>.
# No model answering: prints NO-MODEL and exits 1 (the manager then pauses: dispatch.sh --pause).
#
# Why (2026-10-07): the OpenCode Go quota ran out mid-run; finding the role files, the model ids and
# the provider prefix by hand took an hour while workers failed.
# The config files live in this checkout (D:/code/dsv-dispatcher), so a switch is a local change
# there: a later code checkout keeps it, or refuses ("local changes would be overwritten") - then
# git stash, checkout, git stash pop.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
FB="$HERE/roles/fallback.txt"

cfg_of() { case "$1" in coder|fixer|write) echo write;; reviewer|readonly) echo readonly;; tester) echo tester;; *) return 1;; esac; }
current() { node "$HERE_NATIVE/lib/jget.cjs" model < "$HERE/roles/$1.opencode.json" 2>/dev/null; }
order() { sed -n "s/^$1:[[:space:]]*//p" "$FB" | head -1; }
probe() {   # model -> 0 when it answers
  # Not `timeout opencode ...`: on Windows `opencode` is a launcher that starts the real opencode.exe as
  # a child, and timeout kills only the launcher. Measured 2026-10-07: with no worker running, two
  # opencode.exe held 1486 + 894 MB and no start could pass the memory check. The probe runs in the
  # background and, on a timeout, its whole process tree is killed (taskkill /T).
  local OUT RC P W i=0 F="$S/probe.$$.out"
  opencode run -m "$1" "Reply with exactly: OK" </dev/null > "$F" 2>&1 &
  P=$!
  while kill -0 "$P" 2>/dev/null && [ "$i" -lt "${PROBE_TIMEOUT:-90}" ]; do sleep 1; i=$((i+1)); done
  if kill -0 "$P" 2>/dev/null; then
    W="$(cat "/proc/$P/winpid" 2>/dev/null)"
    if [ -n "$W" ] && command -v taskkill >/dev/null 2>&1; then taskkill //T //F //PID "$W" >/dev/null 2>&1; else pkill -9 -P "$P" 2>/dev/null; kill -9 "$P" 2>/dev/null; fi
    wait "$P" 2>/dev/null; RC=124
  else wait "$P"; RC=$?; fi
  OUT="$(cat "$F" 2>/dev/null)"; rm -f "$F"
  if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'OK'; then echo "OK $1"; return 0; fi
  echo "FAIL $1 (rc $RC): $(printf '%s' "$OUT" | grep -v '^[[:space:]]*$' | tail -2 | tr '\n' ' ' | cut -c1-200)"; return 1
}

case "${1:-}" in
  --probe) probe "${2:?--probe needs a model}"; exit $? ;;
  --list)
    for C in write readonly tester; do echo "$C: now $(current "$C") | order: $(order "$C")"; done; exit 0 ;;
  ""|-*) sed -n '2,12p' "$0" >&2; exit 2 ;;
esac

CFG="$(cfg_of "$1")" || { echo "unknown role '$1' (coder|fixer|reviewer|tester)" >&2; exit 2; }
[ "$1" = "fixer" ] && echo "note: Coder and Fixer share roles/write.opencode.json; both move" >&2
FROM="$(current "$CFG")"; ORDER="$(order "$CFG")"
[ -n "$ORDER" ] || { echo "no fallback line for '$CFG' in $FB" >&2; exit 2; }

CANDIDATES=()
if [ "${2:-}" = "--to" ]; then
  TO="${3:?--to needs a model}"
  case " $ORDER " in *" $TO "*) CANDIDATES=("$TO");; *) echo "$TO is not in the fallback list for $CFG ($FB)" >&2; exit 2;; esac
else
  # the models after the current one; if the current one is not listed, the whole list
  AFTER=""; SEEN=""
  for M in $ORDER; do
    if [ -n "$SEEN" ]; then AFTER="$AFTER $M"; fi
    [ "$M" = "$FROM" ] && SEEN=1
  done
  [ -n "$SEEN" ] || AFTER="$ORDER"
  for M in $AFTER; do CANDIDATES+=("$M"); done
fi

for M in "${CANDIDATES[@]}"; do
  [ "$M" = "$FROM" ] && continue
  if probe "$M"; then
    F="$HERE/roles/$CFG.opencode.json"
    node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.model=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(j,null,2)+"\n")' \
      "$(cygpath -m "$F" 2>/dev/null || printf '%s' "$F")" "$M" || { echo "could not write $F" >&2; exit 3; }
    printf '%s model-switch config=%s from=%s to=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CFG" "$FROM" "$M" >> "$S/events.log"
    echo "SWITCHED $CFG $FROM -> $M"
    exit 0
  fi
done
echo "NO-MODEL: nothing after $FROM in the $CFG list answered"
exit 1
