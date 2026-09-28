#!/usr/bin/env bash
# Post ONE dsv-verdict comment per role per head, from the worker's own words.
#
# Why: two interventions in one session were the coordinator hand-typing a verdict
# fence. On PR #134 a hand-written "correction" comment fenced with three backslashes
# parsed as nothing and the gate sat pending while the thread read PASS. On PR #133 the
# coordinator typed the fence while the worker's settlement already carried the same
# fields, so the PR comment and the settlement could disagree with nothing to compare.
#
# This script makes the worker's structured output the single source: it reads the
# `status: / role: / commit: / observed: / before: / build: / scope_ok:` lines out of a
# settlement and copies them verbatim into the block. It refuses - loudly, exit 1 -
# rather than posting something the gate cannot read:
#
#   * the named commit must equal the PR's current head (a verdict about another build
#     is not evidence about this one);
#   * a Tester PASS must carry observed:, before: and build: (the asset hash);
#   * a Reviewer verdict must carry scope_ok:;
#   * --status must be pass or fail.
#
# Idempotent: re-running for the same (pr, role, head) edits that same comment instead
# of creating a second one, so "one verdict comment per role per head" is a property of
# the tool rather than a habit.
#
#   verdict-post.sh --pr 136 --role tester --from-settlement <file|-> [--note "..."]
#   verdict-post.sh --pr 136 --role reviewer --status pass --commit 12469a2 --scope-ok yes
#
# Exit 0 only after the comment exists and its body has been read back and verified.
set -uo pipefail

PR=""; ROLE=""; STATUS=""; COMMIT=""; SCOPE_OK=""; REASON=""; FIXREQ=""
OBSERVED=""; BEFORE=""; BUILD=""; SETTLE=""; NOTE=""; SOURCE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --pr) PR="${2:?}"; shift 2;;
    --role) ROLE="${2:?}"; shift 2;;
    --status) STATUS="${2:?}"; shift 2;;
    --commit) COMMIT="${2:?}"; shift 2;;
    --scope-ok) SCOPE_OK="${2:?}"; shift 2;;
    --reason) REASON="${2:?}"; shift 2;;
    --fix-required) FIXREQ="${2:?}"; shift 2;;
    --observed) OBSERVED="${2:?}"; shift 2;;
    --before) BEFORE="${2:?}"; shift 2;;
    --build) BUILD="${2:?}"; shift 2;;
    --from-settlement) SETTLE="${2:?}"; shift 2;;
    --source) SOURCE="${2:?}"; shift 2;;
    --note) NOTE="${2:?}"; shift 2;;
    *) echo "verdict-post: unknown argument: $1" >&2; exit 2;;
  esac
done

fail() { echo "verdict-post: REFUSED - $*" >&2; exit 1; }
[ -n "$PR" ] || fail "--pr is required"
[ -n "$ROLE" ] || fail "--role is required"
case "$ROLE" in reviewer|tester) ;; *) fail "--role must be reviewer or tester (got '$ROLE')";; esac

# --- take the worker's own lines when a settlement is given -------------------------
if [ -n "$SETTLE" ]; then
  if [ "$SETTLE" = "-" ]; then TEXT="$(cat)"; else
    [ -f "$SETTLE" ] || fail "settlement file not found: $SETTLE"
    TEXT="$(cat "$SETTLE")"
  fi
  pick() { printf '%s\n' "$TEXT" | grep -m1 -E "^[[:space:]]*$1:" | sed -E "s/^[[:space:]]*$1:[[:space:]]*//" | tr -d '\r'; }
  [ -n "$STATUS" ] || STATUS="$(pick status)"
  [ -n "$COMMIT" ] || COMMIT="$(pick commit)"
  [ -n "$SCOPE_OK" ] || SCOPE_OK="$(pick scope_ok)"
  [ -n "$REASON" ] || REASON="$(pick reason)"
  [ -n "$FIXREQ" ] || FIXREQ="$(pick fix_required)"
  [ -n "$OBSERVED" ] || OBSERVED="$(pick observed)"
  [ -n "$BEFORE" ] || BEFORE="$(pick before)"
  [ -n "$BUILD" ] || BUILD="$(pick build)"
fi

case "$STATUS" in pass|fail) ;; "") fail "--status is required (or a settlement with a 'status:' line)";; *) fail "--status must be pass or fail (got '$STATUS')";; esac

# --- the head this verdict is about --------------------------------------------------
HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid 2>/dev/null)"
[ -n "$HEAD" ] || fail "could not read the head of PR #$PR"
case "$HEAD" in "$COMMIT"*) ;; *) fail "commit $COMMIT is not the head of PR #$PR ($HEAD) - refusing to post a verdict about another build";; esac
[ -n "$COMMIT" ] || COMMIT="$HEAD"

# --- what each role must carry --------------------------------------------------------
if [ "$ROLE" = tester ] && [ "$STATUS" = pass ]; then
  MISSING=""
  [ -n "$OBSERVED" ] || MISSING="$MISSING observed"
  [ -n "$BEFORE" ] || MISSING="$MISSING before"
  [ -n "$BUILD" ] || MISSING="$MISSING build"
  [ -z "$MISSING" ] || fail "a tester PASS must carry its evidence; missing:$MISSING (a PASS with no evidence is not a PASS)"
fi
if [ "$ROLE" = reviewer ]; then
  case "$SCOPE_OK" in yes|no) ;; *) fail "a reviewer verdict must carry --scope-ok (yes|no)";; esac
fi
if [ "$STATUS" = fail ] && [ -z "$REASON" ] && [ -z "$FIXREQ" ]; then
  fail "a fail verdict must carry --reason and/or --fix-required"
fi

# --- render into a FILE: exactly three backticks, one field per line -------------------
# Not into a variable: `$(printf 'x\n')` strips the trailing newline, so building the
# body by concatenating command substitutions silently glues every line together. That
# is what the first version of this script did, and the probe caught it: the block
# posted as "```dsv-verdictstatus: passrole: testercommit: ...", which no parser can
# read -- the same class of defect this script exists to prevent.
BODYF="$(mktemp "${TMPDIR:-/tmp}/dsv-verdict.XXXXXX")" || fail "could not create a temp file"
{
  printf '%s\n' '```dsv-verdict'
  printf 'status: %s\n' "$STATUS"
  printf 'role: %s\n' "$ROLE"
  printf 'commit: %s\n' "$COMMIT"
  if [ "$ROLE" = reviewer ]; then
    printf 'scope_ok: %s\n' "$SCOPE_OK"
    [ -n "$REASON" ] && printf 'reason: %s\n' "$REASON"
    [ -n "$FIXREQ" ] && printf 'fix_required: %s\n' "$FIXREQ"
  else
    [ -n "$OBSERVED" ] && printf 'observed: %s\n' "$OBSERVED"
    [ -n "$BEFORE" ] && printf 'before: %s\n' "$BEFORE"
    [ -n "$BUILD" ] && printf 'build: %s\n' "$BUILD"
  fi
  [ -n "$SOURCE" ] && printf 'source: %s\n' "$SOURCE"
  printf '%s\n' '```'
  [ -n "$NOTE" ] && printf '\n%s\n' "$NOTE"
} > "$BODYF"

# The fence is the gate: prove it is byte-exact before anything is posted.
grep -qxF '```dsv-verdict' "$BODYF" || fail "internal error: the fence line is not exactly three backticks + dsv-verdict"
LINES="$(wc -l < "$BODYF")"
[ "$LINES" -ge 5 ] || fail "internal error: the rendered block is $LINES lines"

# --- one comment per role per head: edit the existing one, else create -----------------
EXISTING="$(gh api "repos/{owner}/{repo}/issues/$PR/comments" --paginate 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const head=process.argv[1], role=process.argv[2];
  let out="";
  try{ const a=JSON.parse(s);
    for(const c of a){ const b=c.body||"";
      if(b.indexOf("```dsv-verdict")<0) continue;
      const m=/^role:\s*([a-z]+)$/m.exec(b), k=/^commit:\s*([0-9a-fA-F]+)$/m.exec(b);
      if(m && m[1]===role && k && head.startsWith(k[1])) out=String(c.id);
    }
  }catch(e){}
  process.stdout.write(out);
});' "$HEAD" "$ROLE")"

if [ -n "$EXISTING" ]; then
  gh api --method PATCH "repos/{owner}/{repo}/issues/comments/$EXISTING" -F body=@"$BODYF" >/dev/null 2>&1 \
    || fail "could not edit comment $EXISTING"
  ACTION="edited comment $EXISTING"
else
  URL="$(gh pr comment "$PR" --body-file "$BODYF" 2>&1 | grep -oE 'https://[^ ]+' | head -1)"
  [ -n "$URL" ] || fail "could not post the verdict comment on PR #$PR"
  ACTION="created $URL"
fi
rm -f "$BODYF"

# --- read it back: a write that is not verified is not a write -------------------------
VERIFY="$(gh api "repos/{owner}/{repo}/issues/$PR/comments" --paginate 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const head=process.argv[1], role=process.argv[2];
  let hit=null, n=0;
  try{ const a=JSON.parse(s);
    for(const c of a){ const b=c.body||"";
      if(b.indexOf("```dsv-verdict")<0) continue;
      const m=/^role:\s*([a-z]+)$/m.exec(b), k=/^commit:\s*([0-9a-fA-F]+)$/m.exec(b);
      if(m&&m[1]===role&&k&&head.startsWith(k[1])){ n++; hit=b; }
    }
  }catch(e){}
  process.stdout.write(n+"|"+(hit?"present":"missing")+"|"+(hit||""));
});' "$HEAD" "$ROLE")"
COUNT="$(printf '%s' "$VERIFY" | cut -d'|' -f1)"
STATE="$(printf '%s' "$VERIFY" | cut -d'|' -f2)"
[ "$STATE" = present ] || fail "posted, but no $ROLE verdict for head $HEAD reads back"
[ "$COUNT" = 1 ] || fail "read back $COUNT $ROLE verdicts for head $HEAD; there must be exactly one"
echo "verdict-post: $ACTION"
echo "verdict-post: $ROLE verdicts for head ${HEAD:0:7} now: $COUNT (must be 1)"
echo "--- body as stored ---"
printf '%s' "$VERIFY" | cut -d'|' -f3-
exit 0
