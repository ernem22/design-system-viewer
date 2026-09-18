#!/usr/bin/env bash
# Serve one worktree's build on one port, deterministically.
#
# Why: three times tonight a Tester was dispatched against a port that answered
# 404 — a preview process from a reaped worktree still held the port and served
# nothing, while `curl` looked "up". A Tester that starts into that state wastes a
# whole phase. This script makes the port true before the worker is started:
#   1. kill whatever listens on the port (any stale preview),
#   2. start `vite preview` from <worktree>/app — the directory that actually holds
#      dist/ (running it from the worktree root makes vite look for <root>/dist and
#      exit with "The directory dist does not exist"),
#   3. wait until the port answers 200, and print the asset hash it serves.
#
#   serve.sh <worktree-path> <port>
#
# Exit 0 only with HTTP 200 and a printed asset hash.
set -uo pipefail

P="${1:?usage: serve.sh <worktree-path> <port>}"
PORT="${2:?usage: serve.sh <worktree-path> <port>}"
LOG="${LOCALAPPDATA}/Temp/preview_${PORT}.log"

[ -d "$P/app/dist" ] || { echo "serve.sh: no build at $P/app/dist — run npm --prefix app run build first" >&2; exit 1; }

# 2. free the port is done; the preview is started BY THE CALLER as a background
#    process. Backgrounding it from inside this script hangs the caller's tool
#    call: the child keeps the stdout pipe open, so the call never returns.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
sleep 2
echo "FREED port $PORT — now start: (cd \"$P/app\" && npx vite preview --port $PORT --strictPort)"
echo "then: serve.sh --wait $PORT"
exit 0
