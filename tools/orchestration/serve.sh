#!/usr/bin/env bash
# Serve one worktree's build on one port, deterministically.
#
# Why: three times in one night a Tester was dispatched against a port that answered
# 404 - a preview process from a reaped worktree still held the port and served
# nothing, while `curl` looked "up". A Tester that starts into that state wastes a
# whole phase. This script makes the port true before the worker is started:
#   1. free the port (kill whatever listens on it),
#   2. the caller starts `vite preview` from <worktree>/app - the directory that actually
#      holds dist/ (running it from the worktree root makes vite look for <root>/dist and
#      exit with "The directory dist does not exist"),
#   3. `--wait` blocks until the port answers 200 and prints the asset hash it serves.
#
# A preview is started by the coordinator, OUTSIDE Orca's worktree lifecycle, so removing a
# worktree does NOT stop it: the process keeps the port and the RAM. Measured 2026-10-02 on this
# host: 5 preview servers resident (one orphaned earlier tonight cost 800MB), and a
# `serve2.js ...\Temp\opencode\wt-old 8126` process still bound to port 8126 whose directory no
# longer existed. Stopping a preview therefore takes a SECOND key besides the port - what it
# serves - because after a worktree is removed the port is all that is left to name it by, and
# `--stop <port>` needs a port the coordinator may no longer know.
#
#   serve.sh <worktree-path> <port>      free the port, print the start line
#   serve.sh --wait <port>               block until HTTP 200, print the asset hash
#   serve.sh --stop <port>               kill whatever LISTENS on the port
#   serve.sh --stop-worktree <path>      kill the preview whose command line names <path>
#   serve.sh --orphans [--kill]          report (and with --kill, stop) previews whose
#                                        worktree path is gone from disk
#
# `--stop-worktree` matches the command line, so a preview started as
# `(cd <wt>/app && npx vite preview --port N)` - which names no path, only a cwd - cannot be
# found by path; stop that one by port. Prefer the start line this script prints, which spells
# the worktree out and is therefore reapable.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# Native tools cannot read an MSYS path on this host: MSYS path conversion is disabled, so
# /c/Users/... reaches PowerShell as C:\c\Users\... and the helper is "not found". Measured
# 2026-09-28 in settle.sh, same trap.
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
PREVIEW_PS="$HERE_NATIVE/lib/preview-procs.ps1"

P="${1:?usage: serve.sh <worktree-path> <port> | --wait <port> | --stop <port> | --stop-worktree <path> | --orphans [--kill]}"
ARG2="${2:-}"
PORT="$ARG2"

say() { printf 'serve.sh: %s\n' "$*"; }

# The one place that frees a port. Used by --stop and by the plain serve mode.
stop_port() {
  powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${1} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
}

# One line per matched preview process; 'NONE' when the disk justifies nothing.
preview_procs() { powershell -NoProfile -File "$PREVIEW_PS" "$@" 2>/dev/null; }

case "$P" in
  --stop)
    [ -n "$PORT" ] || { say "--stop needs a port"; exit 2; }
    stop_port "$PORT"
    say "STOPPED preview on port $PORT (if any)"
    exit 0
    ;;
  --stop-worktree)
    WT="${ARG2:?usage: serve.sh --stop-worktree <worktree-path>}"
    # cygpath -m gives the C:/... form the helper normalizes against, so an MSYS path passed in
    # by a caller (/c/Users/...) still matches the Windows command line the process actually has.
    WT_NATIVE="$(cygpath -m "$WT" 2>/dev/null || printf '%s' "$WT")"
    OUT="$(preview_procs -Mode worktree -Path "$WT_NATIVE" -Kill)"
    ROWS="$(printf '%s\n' "$OUT" | grep -E '^[0-9]+\|' || true)"
    if [ -z "$ROWS" ]; then
      say "--stop-worktree $WT_NATIVE: no node process names it (nothing to stop)"
      exit 0
    fi
    printf '%s\n' "$ROWS" | while IFS='|' read -r pid kind state cmd reason; do
      say "  $state pid $pid - $reason"
    done
    printf '%s\n' "$ROWS" | grep -q 'kill-failed' && { say "a preview survived the kill"; exit 1; }
    say "--stop-worktree done"
    exit 0
    ;;
  --orphans)
    KILL_ARG=()
    [ "${ARG2:-}" = "--kill" ] && KILL_ARG=(-Kill)
    OUT="$(preview_procs -Mode orphan "${KILL_ARG[@]+"${KILL_ARG[@]}"}")"
    ROWS="$(printf '%s\n' "$OUT" | grep -E '^[0-9]+\|' || true)"
    if [ -z "$ROWS" ]; then
      say "no orphaned preview (no server-shaped node process names a path that is gone)"
      exit 0
    fi
    printf '%s\n' "$ROWS" | while IFS='|' read -r pid kind state cmd reason; do
      say "  $state pid $pid - $reason"
    done
    printf '%s\n' "$ROWS" | grep -q 'kill-failed' && exit 1
    exit 0
    ;;
  --wait)
    [ -n "$PORT" ] || { say "--wait needs a port"; exit 2; }
    CODE=""
    # A wall-clock deadline, not an attempt count: with -m 3 a dropped request costs 3s, so 60
    # attempts is a 4-minute wait under the message "within 60s". The message has to be true.
    DEADLINE=$(( $(date +%s) + 60 ))
    while [ "$(date +%s)" -lt "$DEADLINE" ]; do
      # -m 3 on every attempt: without it a request to a port that a firewall drops (rather than
      # refuses) hangs curl forever and --wait becomes a hang instead of a timeout. Measured
      # 2026-10-02, the first time this mode was run.
      CODE="$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null)"
      [ "$CODE" = "200" ] && break
      sleep 1
    done
    if [ "$CODE" != "200" ]; then
      say "port $PORT never answered 200 within 60s (last: ${CODE:-none}) - do NOT dispatch a worker at it"
      exit 1
    fi
    # The asset hash is what makes "the build I tested" checkable afterwards: a Tester verdict
    # quotes it, so a stale preview serving an older build is visible in the verdict itself.
    ASSET="$(curl -s -m 5 "http://127.0.0.1:$PORT/" 2>/dev/null | grep -oE '/assets/[^"]+\.js' | head -1)"
    say "SERVING port $PORT (HTTP 200) asset=${ASSET:-none-found}"
    exit 0
    ;;
  --*)
    say "unknown mode $P"
    exit 2
    ;;
esac

[ -n "$PORT" ] || { say "usage: serve.sh <worktree-path> <port>"; exit 2; }
[ -d "$P/app/dist" ] || { say "no build at $P/app/dist - run npm --prefix app run build first"; exit 1; }

# 2. free the port; the preview is started BY THE CALLER as a background process. Backgrounding
#    it from inside this script hangs the caller's tool call: the child keeps the stdout pipe
#    open, so the call never returns.
stop_port "$PORT"
sleep 2
echo "FREED port $PORT - now start: (cd \"$P/app\" && npx vite preview --port $PORT --strictPort)"
echo "then: serve.sh --wait $PORT"
exit 0
