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
#
# This script carries no machine path and no uuid of its own. Its git anchor is the
# checkout it is started from, and the worktree comes from `spawn.sh --worktree-only`,
# which also resolves the Orca repo id. It used to anchor both to
# `<orca-workspaces>/design-system-viewer/proteus-5`; that checkout no longer exists (the
# directory survives as an archive with no `.git`, so `git -C` answers "not a git
# repository" and the "behind by N commits" line silently read 0).
set -uo pipefail

PR="${1:?usage: rebase.sh <pr-number> [--push]}"
PUSH="${2:-}"
REPO="ernem22/design-system-viewer"
BASE="origin/refactor/full-react-migration"
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$HERE/repo-id.sh"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$ROOT" ] || { echo "rebase.sh: not inside a git checkout" >&2; exit 2; }

BRANCH=$(gh pr view "$PR" --repo "$REPO" --json headRefName --jq .headRefName)
HEAD=$(gh pr view "$PR" --repo "$REPO" --json headRefOid --jq .headRefOid)
git -C "$ROOT" fetch -q origin
behind=$(git -C "$ROOT" rev-list --count "$HEAD..$BASE" 2>/dev/null || echo 0)
echo "PR #$PR ($BRANCH) head=${HEAD:0:7} behind $BASE by ${behind} commit(s)"

if [ "${behind:-0}" -eq 0 ]; then
  echo "  already up to date — nothing to do"
  exit 0
fi

# Reuse a worktree left by an earlier run if one is still registered, else create one. The
# path comes from Orca — Orca decides where its worktrees live — never from a constant.
WT=$(orca worktree list --json </dev/null 2>/dev/null | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  const want = process.argv[1], repoId = process.argv[2];
  try {
    const list = ((JSON.parse(s).result || {}).worktrees) || [];
    const hit = list.find(w => w.repoId === repoId
      && String(w.path || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase().endsWith("/" + want));
    if (hit) console.log(hit.path);
  } catch (e) {}
});
' "rebase-$PR" "$REPO_ID")

if [ -z "$WT" ]; then
  OUT=$(bash "$HERE/spawn.sh" "rebase-$PR" "origin/$BRANCH" --worktree-only 2>&1) || {
    echo "  could not create the worktree — dispatch a Fixer instead" >&2
    printf '%s\n' "$OUT" | sed 's/^/    /' >&2
    exit 2; }
  WT=$(printf '%s\n' "$OUT" | sed -n 's/^PATH=//p' | head -1)
fi
[ -n "$WT" ] || { echo "rebase.sh: no worktree path for rebase-$PR" >&2; exit 2; }

# A reused worktree can be stale. If the PR head moved since it was created, rebasing it
# and pushing with --force-with-lease would republish the OLD head and drop the commits
# pushed since — the lease is satisfied, because the fetch above just refreshed the
# remote-tracking ref, so nothing refuses it. Reuse only a worktree that is actually at
# the PR head; anything else is the operator's to remove, not ours to reset (it may hold
# an abandoned conflict resolution).
WTH=$(git -C "$WT" rev-parse HEAD 2>/dev/null || echo "")
if [ "$WTH" != "$HEAD" ]; then
  echo "  refusing to reuse $WT: it is at ${WTH:0:7}, the PR head is ${HEAD:0:7}" >&2
  echo "  remove it and re-run:  orca worktree rm --worktree \"id:\$REPO_ID::$WT\" --force" >&2
  exit 4
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
