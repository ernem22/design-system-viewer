#!/usr/bin/env bash
# Keep exactly one dispatcher alive, in its own Orca terminal (hunter H-002: nothing restarted the
# pipeline after a crash, an Orca restart or a reboot). Run by Task Scheduler at logon and every
# 5 minutes (install-dispatcher.ps1); idempotent, so running it more often is harmless.
#
#   launch-dispatcher.sh            start the dispatcher if none is alive
#   launch-dispatcher.sh --status   say whether one is alive, and where
#
# Level-triggered: it looks, and only acts when no dispatcher holds the lock. Orca not running yet
# (right after logon) is not an error - the next tick tries again.
#
# The dispatcher must run INSIDE an Orca terminal: worker-start is fenced to the terminal bound to
# the Run, and dispatch.sh --bind makes its own terminal that one. Orca terminals start in a shell
# whose quoting rules are not ours, so the terminal runs a one-line .cmd written here, which calls
# Git Bash by full path (a bare `bash` can resolve to WSL's bash.exe on Windows).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
mkdir -p "$S" 2>/dev/null || true
LOG="$S/launcher.log"
say() { printf '%s launcher: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG"; printf '%s\n' "$*" >&2; }
native() { cygpath -m "$1" 2>/dev/null || printf '%s' "$1"; }
winpath() { cygpath -w "$1" 2>/dev/null || printf '%s' "$1"; }

alive() {
  local PID; PID="$(cat "$S/dispatch.lock" 2>/dev/null)"
  [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && { echo "$PID"; return 0; }
  return 1
}

if [ "${1:-}" = "--status" ]; then
  if P="$(alive)"; then echo "dispatcher alive: pid $P, Run $(cat "$S/dispatch.run" 2>/dev/null)"; else echo "no dispatcher running"; fi
  exit 0
fi

alive >/dev/null && exit 0

# Orca up? A cheap read; no answer means Orca is not running yet.
orca orchestration run-list --limit 1 --json </dev/null >/dev/null 2>&1 || { say "Orca not answering; next tick"; exit 0; }

# shellcheck source=/dev/null
. "$HERE/repo-id.sh" || { say "repo id not resolvable; next tick"; exit 0; }
ROOT="$(dirname "$(git -C "$HERE" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")"
BASH_EXE="$(winpath "$(command -v bash)")"
CMD_FILE="$S/dispatcher.cmd"
printf '@echo off\r\n"%s" -l "%s" --bind\r\n' "$BASH_EXE" "$(native "$HERE/dispatch.sh")" > "$CMD_FILE"

OUT="$(orca terminal create --worktree "id:$REPO_ID::$(native "$ROOT")" --title dsv-dispatcher \
  --command "cmd.exe /c $(winpath "$CMD_FILE")" --json </dev/null 2>/dev/null)"
H="$(printf '%s' "$OUT" | node "$(native "$HERE")/lib/jget.cjs" result.terminal.handle)"
if [ -z "$H" ]; then
  say "terminal create failed: $(printf '%s' "$OUT" | tr '\n' ' ' | cut -c1-300)"; exit 1
fi
say "started dispatcher terminal $H ($CMD_FILE)"

# confirm it came up: the dispatcher writes its lock within a few seconds of starting
for _ in $(seq 1 20); do alive >/dev/null && { say "dispatcher alive (pid $(alive))"; exit 0; }; sleep 3; done
say "dispatcher terminal $H opened but no lock after 60s; see $S/dispatch.log and the terminal"
exit 1
