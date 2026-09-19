#!/usr/bin/env bash
# Bring a PR branch up to date with the base branch, mechanically.
#
# Why this is a script and not a judgement call: a PR branch created early goes stale as
# main moves, and a wave run against a stale base wastes a whole build. It bit twice — a
# test written against a newer `useTokensView` signature landed on a branch that still had
# the old one (`TS2554: Expected 2 arguments, but got 3`), and a cherry-pick of a newer
# commit onto an older base produced a tree that does not compile. `close.sh` reports the
# distance; this script removes it.
#
#   rebase.sh <pr-number> [--push]
#
# Without --push it only reports whether the rebase is clean. With --push it force-pushes
# the rebased branch (safe here: the branch is a PR under review, and the PR body records
# what the branch claims, so a rewritten head is visible in the PR timeline).
set -uo pipefail

PR="${1:?usage: rebase.sh <pr-number> [--push]}"
PUSH="${2:-}"
REPO="ernem22/design-system-viewer"
BASE="origin/refactor/full-react-migration"
WT_ROOT="C:/Users/zurza/orca/workspaces/design-system-viewer"
HERE="$(cd "$(dirname "$0")" && pwd)"

BRANCH=$(gh pr view "$PR" --repo "$REPO" --json headRefName --jq .headRefName)
HEAD=$(gh pr view "$PR" --repo "$REPO" --json headRefOid --jq .headRefOid)
behind=$(git -C "$WT_ROOT/proteus-5" rev-list --count "$HEAD..$BASE" 2>/dev/null || echo 0)
echo "PR #$PR ($BRANCH) head=${HEAD:0:7} behind $BASE by ${behind} commit(s)"

if [ "${behind:-0}" -eq 0 ]; then
  echo "  already up to date — nothing to do"
  exit 0
fi

WT="$WT_ROOT/rebase-$PR"
git -C "$WT_ROOT/proteus-5" fetch -q origin
if [ ! -d "$WT" ]; then
  bash "$HERE/spawn.sh" "rebase-$PR" "origin/$BRANCH" >/dev/null 2>&1 || {
    echo "  could not create the worktree — dispatch a Fixer instead"; exit 2; }
fi

cd "$WT" || exit 2
if git rebase "$BASE" >/tmp/rebase-$PR.log 2>&1; then
  echo "  rebase clean: $(git log --oneline -1)"
  if [ "$PUSH" = "--push" ]; then
    git push -q --force-with-lease origin HEAD:"$BRANCH" && echo "  pushed -> $BRANCH ($(git rev-parse --short HEAD))"
  else
    echo "  (dry: re-run with --push to publish)"
  fi
else
  echo "  CONFLICTS — a Fixer has to resolve them; the log is /tmp/rebase-$PR.log"
  git rebase --abort 2>/dev/null
  exit 3
fi
