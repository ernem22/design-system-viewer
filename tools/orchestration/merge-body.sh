#!/usr/bin/env bash
# Append the role's Co-authored-by trailer to a squash-merge body, so it cannot be forgotten.
#
# Why: ORCHESTRATION.md's Commit Attribution section requires the worker's bot identity on the
# merge commit, and nothing checked it. Measured 2026-09-28 over the base branch's first-parent
# line: 31 of 40 squash merges carry no `Co-authored-by: orca-*` trailer at all, and the recent
# ones are the ones missing it (#134, #136, #138, #140, #144, #147, #149, #153). The trailer was
# in the body only when the body happened to be copied from a template, so the rule held by luck.
#
#   merge-body.sh <coder|reviewer|tester|fixer> <body-file> [--out <file>]
#
# Writes the body with the trailer appended (or prints it to stdout with no --out). Idempotent:
# a body that already carries a Co-authored-by line is left alone and says so.
# Exit 2 on an unknown role or a missing body - never silently produces an unattributed body.
set -uo pipefail

ROLE="${1:?usage: merge-body.sh <coder|reviewer|tester|fixer> <body-file> [--out <file>]}"
BODY="${2:?usage: merge-body.sh <role> <body-file> [--out <file>]}"
OUT=""
[ "${3:-}" = "--out" ] && OUT="${4:?--out needs a path}"

HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/identity.env" ] || { echo "merge-body: no identity.env beside this script" >&2; exit 2; }
# shellcheck source=/dev/null
. "$HERE/identity.env"

UP="$(printf '%s' "$ROLE" | tr '[:lower:]-' '[:upper:]_')"
eval "USER_V=\${${UP}_USERNAME:-}"; eval "EMAIL_V=\${${UP}_EMAIL:-}"
if [ -z "$USER_V" ] || [ -z "$EMAIL_V" ]; then
  echo "merge-body: unknown role '$ROLE' (no ${UP}_USERNAME/${UP}_EMAIL in identity.env)" >&2
  echo "  known roles: coder reviewer tester fixer" >&2
  exit 2
fi
[ -f "$BODY" ] || { echo "merge-body: no body at $BODY" >&2; exit 2; }

if grep -q '^Co-authored-by:' "$BODY"; then
  echo "merge-body: $BODY already carries a Co-authored-by trailer; left unchanged" >&2
  [ -n "$OUT" ] && cp "$BODY" "$OUT" || cat "$BODY"
  exit 0
fi

TRAILER="Co-authored-by: orca-$ROLE <$EMAIL_V>"
if [ -n "$OUT" ]; then
  { cat "$BODY"; printf '\n\n%s\n' "$TRAILER"; } > "$OUT"
  echo "merge-body: $OUT written with trailer: $TRAILER" >&2
else
  cat "$BODY"; printf '\n\n%s\n' "$TRAILER"
fi
