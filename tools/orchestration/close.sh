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
set -uo pipefail

REPO="ernem22/design-system-viewer"
BASE="refactor/full-react-migration"
DRY="${1:-}"

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
  #
  # Compare against the PR's OWN base, never the pipeline's. A PR opened against the repo's
  # default branch (`main`) instead of the pipeline base shows a diff of the entire
  # migration — 245 files where the real change is 3 — and against `$BASE` it merely looks
  # "1 commit behind", so the wrong comparison hides the fault instead of reporting it.
  prbase=$(gh pr view "$pr" --repo "$REPO" --json baseRefName --jq .baseRefName 2>/dev/null)
  [ -z "$prbase" ] && prbase="$BASE"
  behind=$(git rev-list --count "$head".."origin/$prbase" 2>/dev/null || echo 0)
  note=""
  [ "${behind:-0}" -gt 0 ] && note=" [BEHIND $prbase by $behind commits — rebase before the next wave]"
  [ "$prbase" != "$BASE" ] && note="$note [WRONG BASE: this PR targets $prbase; the pipeline merges into $BASE]"

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
