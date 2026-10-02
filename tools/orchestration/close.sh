#!/usr/bin/env bash
# The closing pass — attempt every open PR, let GitHub's gate decide, report the rest.
#
# Closing used to depend on the coordinator holding each PR's state in its head: which
# ones had CI green, which had both verdicts, which issue to close. That is what stalls —
# a PR sits green and reviewed while the coordinator is busy elsewhere, and the user reads
# it as "we have trouble closing finished things".
#
# Now that `pipeline/verdict` is a required status check, the merge can be attempted
# BLINDLY: GitHub refuses to merge anything the machine has not approved. So this script
# loops over every open PR, merges the ones the gate has passed, closes the issues their
# bodies reference, and prints precisely who owes what for the rest.
#
#   close.sh            # act: merge what the gate passed
#   close.sh --dry-run  # report only
#   close.sh --hygiene  # branch hygiene only, then stop (run this BEFORE a wave)
#
# BRANCH HYGIENE runs first, always: a PR branch created earlier goes stale as the base moves, and a
# wave run against a stale base wastes a whole build (measured twice - a test written against a newer
# `useTokensView` signature landed on a branch that still had the old one, TS2554; and a cherry-pick
# onto an older base produced a tree that does not compile). Measured 2026-10-02: three of the five
# open PRs were 10-27 commits behind, two of them carrying verdicts against their head.
#
# The hygiene pass decides per PR whether a rebase is safe (lib/hygiene-logic.cjs, probed) and NEVER
# pushes: a rebase rewrites the head, and a rewritten head with a force-push is a Fixer's action
# under --force-with-lease, not the closing layer's. What it prints is the decision and the exact
# command, so the coordinator stops holding this in their head.
set -uo pipefail

REPO="ernem22/design-system-viewer"
BASE="refactor/full-react-migration"
DRY=""
HYGIENE_ONLY=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY="--dry-run";;
    --hygiene) HYGIENE_ONLY=1;;
    *) echo "close.sh: unknown flag $arg" >&2; exit 2;;
  esac
done
HERE="$(cd "$(dirname "$0")" && pwd)"
# Native tools cannot read an MSYS path on this host (MSYS path conversion is disabled), so node
# requiring /c/... says "Cannot find module" - measured in settle.sh on 2026-09-28.
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
HYGIENE_JS="$HERE_NATIVE/lib/hygiene-logic.cjs"

git fetch -q origin 2>/dev/null || true

# ---- branch hygiene -------------------------------------------------------------------------
hygiene_refusals=0
for pr in $(gh pr list --repo "$REPO" --state open --json number --jq '.[].number'); do
  head=$(gh pr view "$pr" --repo "$REPO" --json headRefOid --jq .headRefOid)
  behind=$(git rev-list --count "$head".."origin/$BASE" 2>/dev/null || echo '?')
  # An unreadable gate must reach decide() as unreadable, not as "none": that distinction is the
  # whole fail-closed rule.
  gate_raw=$(gh api "repos/$REPO/commits/$head/status" \
               --jq '[.statuses[]|select(.context=="pipeline/verdict")]|.[0]|(.state // "none")' 2>/dev/null)
  decision=$(node -e '
const { decide } = require(process.argv[1]);
const d = decide(process.argv[2], process.argv[3]);
process.stdout.write(d.action + "\t" + d.why);
' "$HYGIENE_JS" "$behind" "$gate_raw" 2>&1)
  action=$(printf '%s' "$decision" | cut -f1)
  why=$(printf '%s' "$decision" | cut -f2-)
  case "$action" in
    rebase)
      echo "hygiene #$pr: REBASE (behind $behind, gate ${gate_raw:-unreadable}) - $why"
      echo "     next: bash tools/orchestration/rebase.sh $pr --push    # a Fixer's action; --force-with-lease only"
      ;;
    refuse)
      hygiene_refusals=$((hygiene_refusals+1))
      echo "hygiene #$pr: REFUSED (behind $behind, gate ${gate_raw:-unreadable}) - $why"
      echo "     a human decides: re-verify on the new base, or accept the merge as it stands"
      ;;
    *)
      echo "hygiene #$pr: ok - $why"
      ;;
  esac
done
echo "close.sh: hygiene: $hygiene_refusals PR(s) where a rebase would void evidence"

if [ -n "$HYGIENE_ONLY" ]; then
  echo "close.sh: --hygiene given, stopping after the hygiene pass"
  exit 0
fi

merged=0
for pr in $(gh pr list --repo "$REPO" --state open --json number --jq '.[].number'); do
  head=$(gh pr view "$pr" --repo "$REPO" --json headRefOid --jq .headRefOid)
  ci=$(gh pr checks "$pr" --repo "$REPO" 2>/dev/null | awk '{print $1"="$2}' | tr '\n' ' ')
  gate=$(gh api "repos/$REPO/commits/$head/status" \
           --jq '[.statuses[]|select(.context=="pipeline/verdict")]|.[0]|"\(.state // "none"): \(.description // "")"' 2>/dev/null)

  # A wave run against a stale base wastes a whole build: the PR's own commits may not
  # compile against the API main has since moved to (this happened twice — a test written
  # against a newer `useTokensView` signature landed on a branch that still had the old
  # one). Report it here, before anyone dispatches a Tester.
  behind=$(git rev-list --count "$head".."origin/$BASE" 2>/dev/null || echo 0)
  note=""
  [ "${behind:-0}" -gt 0 ] && note=" [BEHIND $BASE by $behind commits — rebase before the next wave]"

  case "$gate" in
    success*)
      if [ "$DRY" = "--dry-run" ]; then
        echo "#$pr: READY — gate success, ci: $ci"
      else
        if gh pr merge "$pr" --repo "$REPO" --squash --delete-branch >/dev/null 2>&1; then
          sha=$(gh pr view "$pr" --repo "$REPO" --json mergeCommit --jq '.mergeCommit.oid[0:7]')
          echo "#$pr: MERGED $sha  (ci: $ci)"
          merged=$((merged+1))
          # Close the issues the PR claims. `Closes #n` only fires on the repo's DEFAULT
          # branch and this pipeline merges into $BASE, so it is done here — and the
          # claim is read from BOTH the body (`Closes #n`, `Fixes #n`) and the title,
          # because these PRs carry the issue in the title as `(#n)` and a body-only
          # match silently leaves the issue open.
          claimed=$( { gh pr view "$pr" --repo "$REPO" --json body,title --jq '.body + "\n" + .title' \
                       | grep -oE '(Closes|Fixes|Resolves) #[0-9]+' | grep -oE '[0-9]+'
                     gh pr view "$pr" --repo "$REPO" --json title --jq .title \
                       | grep -oE '\(#[0-9]+\)' | grep -oE '[0-9]+'; } | sort -u )
          for n in $claimed; do
            gh issue close "$n" --repo "$REPO" \
              --comment "Closed by the merge of #$pr ($sha): the gate passed reviewer+tester on the same head." >/dev/null 2>&1 \
              && echo "     issue #$n closed"
          done
        else
          echo "#$pr: gate says success but the merge was refused — run it by hand and read why"
        fi
      fi
      ;;
    none*)
      echo "#$pr: waiting — no verdict block yet (ci: $ci). Who owes: reviewer + tester.$note"
      ;;
    pending*)
      echo "#$pr: waiting — ${gate#*: } (ci: $ci)$note"
      ;;
    failure*)
      echo "#$pr: BLOCKED by the gate — ${gate#*: }$note"
      ;;
    *)
      echo "#$pr: unknown gate state '${gate:-none}' (ci: $ci)"
      ;;
  esac
done

[ "$DRY" = "--dry-run" ] || echo "close.sh: merged $merged PR(s)"
