#!/usr/bin/env bash
# The facts the manager needs to write one entry of the owner's test checklist for a merged PR.
# Reads only: GitHub (the PR, its issue) and the Tester's own report from the state dir.
#
#   test-note.sh <pr-number>
#
# Prints: the PR title and merge time, the issue it closes, the changed app files, and the Tester's
# `observed:` / `before:` / `build:` lines for the head that was merged (what was seen working, and
# how). The manager turns this into "where to go, what to do, what you should see" for the owner.
set -uo pipefail
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
REPO="${DSV_REPO:-ernem22/design-system-viewer}"
PR="${1:?usage: test-note.sh <pr-number>}"

gh pr view "$PR" --repo "$REPO" --json number,title,mergedAt,headRefOid,body \
  --jq '"PR #\(.number): \(.title)\nmerged: \(.mergedAt // "not merged")\nhead: \(.headRefOid[0:7])\ncloses: \((.body // "") | [scan("(?i)(?:closes|fixes|resolves) #([0-9]+)")[][]] | join(", "))"' 2>/dev/null \
  || { echo "cannot read PR #$PR"; exit 3; }
echo "app files changed:"
gh pr view "$PR" --repo "$REPO" --json files --jq '.files[].path | select(startswith("app/"))' 2>/dev/null | sed 's/^/  /'

HEAD="$(gh pr view "$PR" --repo "$REPO" --json headRefOid --jq '.headRefOid[0:7]' 2>/dev/null)"
T="$(ls -t "$S"/done/200-tester-"$PR"-"$HEAD"*.succeeded 2>/dev/null | head -1)"
[ -n "$T" ] || T="$(ls -t "$S"/done/200-tester-"$PR"-*.succeeded 2>/dev/null | head -1)"
if [ -z "$T" ]; then echo "tester: no succeeded Tester result found for #$PR"; exit 0; fi
TASK="$(sed -n 's/^TASK=//p' "$T" | head -1)"
echo "tester: $(basename "$T") (task ${TASK:-?})"
R="$S/report-$TASK.txt"
if [ -f "$R" ]; then
  grep -E '^[[:space:]]*(observed|before|build)[^:]*:' "$R" | sed 's/^[[:space:]]*/  /' | cut -c1-600
else echo "  (report-$TASK.txt not found)"; fi
