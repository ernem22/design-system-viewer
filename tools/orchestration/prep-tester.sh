#!/usr/bin/env bash
# Build and serve one worktree for a Tester, BEFORE the agent starts (worker.sh start --serve <port>).
#
#   prep-tester.sh <worktree-path> <port>
#
# Prints SERVING=<port> ASSET=<hash> on success. Exit non-zero leaves no preview running.
#
# The coordinator did this by hand before every Tester. Two traps it fell into are closed here:
#   * the preview bound [::1] only and serve.sh --wait probes 127.0.0.1, so a healthy preview read
#     as "never answered 200" (measured 2026-10-03 on tester-163c) - this binds --host 127.0.0.1;
#   * `(cd app && npx vite preview ...)` names no path on its command line, so serve.sh
#     --stop-worktree cannot find it after the worktree is gone - this starts vite by its absolute
#     path inside the worktree, so the command line names the tree and the preview is reapable.
# node_modules is copied from the root checkout when the lockfiles match: npm ci peaks near 1.8 GB
# on this 7.5 GB host, a copy does not.
set -uo pipefail

P="${1:?usage: prep-tester.sh <worktree-path> <port>}"
PORT="${2:?usage: prep-tester.sh <worktree-path> <port>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
say() { printf 'prep-tester: %s\n' "$*" >&2; }
native() { cygpath -m "$1" 2>/dev/null || printf '%s' "$1"; }

[ -f "$P/app/package.json" ] || { say "no app/package.json in $P"; exit 2; }

if [ ! -d "$P/app/node_modules" ]; then
  if [ -d "$ROOT/app/node_modules" ] && cmp -s "$ROOT/app/package-lock.json" "$P/app/package-lock.json"; then
    say "copying node_modules from the root checkout (lockfiles match)"
    if command -v robocopy >/dev/null 2>&1; then
      robocopy "$(native "$ROOT/app/node_modules")" "$(native "$P/app/node_modules")" /E /NFL /NDL /NJH /NJS /NP /MT:8 >/dev/null
      [ $? -lt 8 ] || { say "robocopy failed"; exit 3; }
    else
      cp -r "$ROOT/app/node_modules" "$P/app/node_modules" || { say "copy failed"; exit 3; }
    fi
  else
    say "lockfiles differ (or no root node_modules): npm ci"
    npm --prefix "$P/app" ci --no-audit --no-fund >&2 || { say "npm ci failed"; exit 3; }
  fi
fi

npm --prefix "$P/app" run build >&2 || { say "build failed"; exit 3; }
bash "$HERE/serve.sh" "$P" "$PORT" >&2 || { say "serve.sh could not free port $PORT"; exit 3; }

mkdir -p "$S" 2>/dev/null || true
VITE="$(native "$P/app/node_modules/vite/bin/vite.js")"
( cd "$P/app" && nohup node "$VITE" preview --port "$PORT" --strictPort --host 127.0.0.1 \
    > "$S/preview-$PORT.log" 2>&1 & )

if ! OUT="$(bash "$HERE/serve.sh" --wait "$PORT" 2>&1)"; then
  say "$OUT"
  bash "$HERE/serve.sh" --stop-worktree "$P" >&2
  exit 3
fi
say "$OUT"
echo "SERVING=$PORT"
echo "ASSET=$(printf '%s' "$OUT" | sed -n 's/.*asset=//p')"
