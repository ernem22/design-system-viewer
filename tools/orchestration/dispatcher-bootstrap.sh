#!/usr/bin/env bash
# What Task Scheduler runs (install-dispatcher.ps1 copies this file OUT of every worktree, into the
# state dir). It makes sure the dispatcher's own code tree exists, then hands over to its launcher.
#
#   bootstrap.sh <code-tree> <root-checkout> [launcher args...]     (base branch: $DSV_BASE)
#
# Why: the scheduled task used to run the launcher straight from the code tree, so the restart
# guarantee lived inside the thing it guarded. Measured 2026-10-04: D:/code/dsv-dispatcher was
# removed from git's worktree list while a Coder ran; the dispatcher lost its scripts, the launcher
# was gone with them, and nothing could bring either back until a human re-created the tree.
# A missing tree is re-created detached at the base branch's tip - every commit there was merged
# through CI, so that is the version to run anyway.
set -uo pipefail
CODE="${1:?usage: bootstrap.sh <code-tree> <root-checkout> [launcher args...]}"
ROOT="${2:?usage: bootstrap.sh <code-tree> <root-checkout> [launcher args...]}"
shift 2
BASE="${DSV_BASE:-refactor/full-react-migration}"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
mkdir -p "$S" 2>/dev/null || true
say() { printf '%s bootstrap: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$S/launcher.log"; printf '%s\n' "$*" >&2; }
L="$CODE/tools/orchestration/launch-dispatcher.sh"

if [ ! -f "$L" ]; then
  say "code tree $CODE is missing (no launcher); re-creating it at origin/$BASE"
  # git runs FROM the root checkout, never `git -C <path>`: MSYS path conversion is off on this host.
  cd "$ROOT" || { say "root checkout $ROOT not found; cannot re-create"; exit 1; }
  git worktree prune 2>/dev/null
  git fetch -q origin "$BASE" 2>/dev/null || say "fetch failed; using the local origin/$BASE"
  [ -e "$CODE" ] && { say "$CODE exists but holds no launcher; leaving it for a human"; exit 1; }
  git worktree add -q --detach "$CODE" "origin/$BASE" 2>&1 | while IFS= read -r l; do say "git: $l"; done
  [ -f "$L" ] || { say "re-create failed; next tick tries again"; exit 1; }
  say "re-created $CODE at $(cd "$CODE" && git log --oneline -1)"
fi
exec bash "$L" "$@"
