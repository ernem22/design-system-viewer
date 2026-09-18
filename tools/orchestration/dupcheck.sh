#!/usr/bin/env bash
# Before creating a task, check whether it already exists.
#
# A model asked "is this a duplicate?" answers from memory and is wrong; a search is
# mechanical and cheap. Run this with the finding's distinctive term (a file path, a
# selector, a function name) and it prints open issues, closed issues from the last 30
# days, and recent PRs that mention it — so the coordinator sees a duplicate instead of
# re-deriving one.
#
#   dupcheck.sh "app/src/shell/shell.css"
#   dupcheck.sh "app-rail-indicator"
#
# Exit 0 with no matches means the term is not on the board: safe to create.
set -uo pipefail

Q="${1:?usage: dupcheck.sh <term>}"
echo "=== open issues mentioning '$Q'"
gh issue list --state open --limit 40 --search "$Q" --json number,title --jq '.[]|"#\(.number) \(.title)"' || true
echo "=== closed issues (last 30d) mentioning '$Q'"
gh issue list --state closed --limit 40 --search "$Q" --json number,title,closedAt \
  --jq '.[]|select(.closedAt > (now - 2592000 | todate))|"#\(.number) \(.title)"' 2>/dev/null || true
echo "=== PRs mentioning '$Q'"
gh pr list --state all --limit 40 --search "$Q" --json number,title,state --jq '.[]|"#\(.number) [\(.state)] \(.title)"' || true
echo "=== code hits for '$Q' (the claim should name a line)"
git grep -n -- "$Q" -- 'app/src' 2>/dev/null | head -5 || echo "  none"
