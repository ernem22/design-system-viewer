#!/usr/bin/env bash
# Set this worktree's git identity to the Orca role identity for <role>.
#
#   tools/orchestration/identity.sh <coder|reviewer|tester|fixer>
#
# One bot account per role: the email is that role's users.noreply.github.com
# address from identity.env, so GitHub links the commit to the bot account instead
# of showing no avatar. A bare @localhost/@local address resolves to no account and
# must never be used. `--worktree` scope is mandatory: bare `git config` is
# `--local` and would overwrite every worktree's identity, including the
# coordinator's.
set -euo pipefail

# An inherited GIT_DIR/GIT_WORK_TREE/GIT_COMMON_DIR would send both the guard below and the
# --worktree writes to a DIFFERENT repository than the one we are standing in, which is the
# opposite of what this script promises. Clear them first.
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR

role="${1:?usage: identity.sh <coder|reviewer|tester|fixer>}"
case "$role" in
  coder|reviewer|tester|fixer) ;;
  *) echo "identity.sh: unknown role '$role' (want coder|reviewer|tester|fixer)" >&2; exit 2 ;;
esac

here="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$here/identity.env" ]; then
  echo "identity.sh: missing $here/identity.env — see ORCHESTRATION.md §Commit Attribution" >&2
  exit 2
fi
# shellcheck source=/dev/null
. "$here/identity.env"

# Resolve the role to its account email (uppercase var name).
case "$role" in
  coder)    email="${CODER_EMAIL:-}" ;;
  reviewer) email="${REVIEWER_EMAIL:-}" ;;
  tester)   email="${TESTER_EMAIL:-}" ;;
  fixer)    email="${FIXER_EMAIL:-}" ;;
esac

# Fail loudly rather than bake a non-resolving address into history.
case "$email" in
  *@users.noreply.github.com) ;;
  *) echo "identity.sh: ${role} email must be a users.noreply.github.com address, got '${email:-<unset>}'" >&2; exit 2 ;;
esac

# `--worktree` only takes effect in a repository that has opted in. Without it git falls
# back to the shared local config and rewrites EVERY worktree's identity, the
# coordinator's included — the exact failure this script exists to prevent. Refuse
# instead of writing, and write nothing at all.
if [ "$(git config --get extensions.worktreeConfig 2>/dev/null || true)" != "true" ]; then
  echo "identity.sh: extensions.worktreeConfig is not enabled in this repository." >&2
  echo "  'git config --worktree' would fall back to the shared config and change the" >&2
  echo "  identity of every worktree, not just this one. Nothing was written." >&2
  echo "  Enable it once per repository, then re-run:" >&2
  echo "    git config extensions.worktreeConfig true" >&2
  exit 3
fi

git config --worktree user.name  "orca-$role"
git config --worktree user.email "$email"
printf 'worktree identity: orca-%s <%s>\n' "$role" "$email"
