#!/usr/bin/env bash
# What did the human say on a PR?
#
# GitHub blocks review actions on your own PR, and every PR here is authored by the
# credential owner (the PR author comes from the token, not from the commit author),
# so the maintainer cannot press "Request changes". Their review therefore arrives as
# a comment or a plain review comment - and a comment is easy for a polling loop to
# miss, which would look like the maintainer said nothing.
#
#   reviews.sh <pr-number>
#
# Prints every review and comment that is NOT from the PR author, oldest first, with
# the author and the body. A `CHANGES_REQUESTED` review prints as a change request; a
# comment starting with `request changes:` prints as one too. Either way the pipeline
# must answer it with a Fixer carrying the text verbatim, not with a merge.
set -uo pipefail

PR="${1:?usage: reviews.sh <pr-number>}"

gh pr view "$PR" --json reviews,comments,author --jq '
  (.author.login) as $a
  | ([.reviews[] | select(.author.login != $a) | {kind:"review", author:.author.login, state:.state, body:.body, at:.submittedAt}]
     + [.comments[] | select(.author.login != $a) | {kind:"comment", author:.author.login, state:"", body:.body, at:.createdAt}]
    )
  | sort_by(.at)
  | .[]
  | "=== \(.kind) by \(.author) \(.state) at \(.at)\n\(.body)\n"'

echo "--- change requests in the above:"
gh pr view "$PR" --json reviews,comments,author --jq '
  (.author.login) as $a
  | ([.reviews[] | select(.author.login != $a and .state=="CHANGES_REQUESTED")] | length) as $r
  | ([.comments[] | select(.author.login != $a and (.body | test("^request changes:|^changes requested:|^REWORK"; "i")))] | length) as $c
  | "reviews: \($r) | flagged comments: \($c)"'
