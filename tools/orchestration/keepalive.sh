#!/usr/bin/env bash
# The dsv-dispatcher Task Scheduler entry (install-dispatcher.ps1) is the only thing that restarts the
# dispatcher after a crash, an Orca restart or a reboot. Measured 2026-10-18: hermes-start reported it
# MISSING, and nothing put it back - installing it was a step a human had to remember.
#
#   keepalive.sh            print "present" or "missing" (exit 0 / 1); "unknown" (exit 2) off Windows
#   keepalive.sh --ensure   install it when missing (exit 0 when present afterwards)
#
# The query runs in PowerShell, not `schtasks //Query`: MSYS path conversion is off on this host, so
# the doubled slashes reach schtasks.exe as written.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TASK=dsv-dispatcher
PS="$(command -v powershell.exe || command -v powershell)" || { echo unknown; exit 2; }
winpath() { cygpath -w "$1" 2>/dev/null || printf '%s' "$1"; }
# coreutils timeout only: on Windows a bare `timeout` can resolve to System32's, which only waits.
TO=(); timeout --version >/dev/null 2>&1 && TO=(timeout 120)
ps() { "${TO[@]}" "$PS" -NoProfile -NonInteractive -ExecutionPolicy Bypass "$@" </dev/null; }

present() { ps -Command "if (Get-ScheduledTask -TaskName '$TASK' -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >/dev/null 2>&1; }

if present; then echo present; exit 0; fi
[ "${1:-}" = "--ensure" ] || { echo missing; exit 1; }
OUT="$(ps -File "$(winpath "$HERE/install-dispatcher.ps1")" 2>&1 | tr '\r\n' '  ' | cut -c1-300)"
if present; then echo "reinstalled: $OUT"; exit 0; fi
echo "missing; install failed: $OUT"; exit 1
