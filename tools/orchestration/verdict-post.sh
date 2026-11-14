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
#   * a Tester verdict - pass OR fail - must carry observed:, before: and build: (the asset
#     hash). The payload is checked before the head, so the refusal needs no network call
#     and the Tester is still alive to fix it;
#   * the named commit must equal the PR's current head (a verdict about another build
#     is not evidence about this one);
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
  # only the leading sha: tester #294 (2026-10-07) wrote `commit: da8d79a (local HEAD da8d79a == gh pr view
  # 294 headRefOid ...)`, and the whole line failed the head check below. The sha must still be the head.
  # A commit line with no leading sha keeps its raw text, so it still fails the head check (an empty one
  # would pass it).
  if [ -z "$COMMIT" ]; then RAWC="$(pick commit)"; COMMIT="$(printf '%s' "$RAWC" | grep -oE '^[0-9a-fA-F]{7,40}' | head -1)"; COMMIT="${COMMIT:-$RAWC}"; fi
  [ -n "$SCOPE_OK" ] || SCOPE_OK="$(pick scope_ok)"
  [ -n "$REASON" ] || REASON="$(pick reason)"
  [ -n "$FIXREQ" ] || FIXREQ="$(pick fix_required)"
  [ -n "$OBSERVED" ] || OBSERVED="$(pick observed)"
  [ -n "$BEFORE" ] || BEFORE="$(pick before)"
  [ -n "$BUILD" ] || BUILD="$(pick build)"
fi

case "$STATUS" in pass|fail) ;; "") fail "--status is required (or a settlement with a 'status:' line)";; *) fail "--status must be pass or fail (got '$STATUS')";; esac

# --- what each role must carry, BEFORE any network call -------------------------------
# The payload is checked first so a thin verdict is refused without a gh round-trip: the
# Tester is still alive when it reads the refusal, and this can be tested offline.
# A tester verdict - PASS OR FAIL - must carry its evidence: observed:, before: and the
# build asset hash. Measured 2026-10-03 on PR #163: a Tester posted
# "status: fail / role: tester / commit: e0f1d44 / build: index-CVUkIPe1.js" - no observed,
# no before - and this script accepted it, because the evidence rule only applied to PASS.
# docs/orchestration/specs/tester.md printed the same thin shape as its example, so the
# spec was teaching it.
if [ "$ROLE" = tester ]; then
  MISSING=""
  [ -n "$OBSERVED" ] || MISSING="$MISSING observed"
  [ -n "$BEFORE" ] || MISSING="$MISSING before"
  [ -n "$BUILD" ] || MISSING="$MISSING build"
  [ -z "$MISSING" ] || fail "a tester verdict must carry its evidence; missing:$MISSING (a verdict with no observed/before/build is not evidence)"
fi
if [ "$ROLE" = reviewer ]; then
  case "$SCOPE_OK" in yes|no) ;; *) fail "a reviewer verdict must carry --scope-ok (yes|no)";; esac
fi
# The gate reads a fail with no `reason:` line as UNPARSEABLE (gate-logic.cjs), so a fail carrying only
# fix_required was posted here and then locked the gate instead of failing it - measured on PR #163 @
# e0f1d44 (2026-10-04, needs.sh: "unparsable verdict comment - a fail verdict has no reason: line").
if [ "$STATUS" = fail ] && [ -z "$REASON" ]; then
  fail "a fail verdict must carry --reason (the gate treats a reason-less fail as unparseable)"
fi

# --- the head this verdict is about --------------------------------------------------
HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid 2>/dev/null)"
[ -n "$HEAD" ] || fail "could not read the head of PR #$PR"
case "$HEAD" in "$COMMIT"*) ;; *) fail "commit $COMMIT is not the head of PR #$PR ($HEAD) - refusing to post a verdict about another build";; esac
[ -n "$COMMIT" ] || COMMIT="$HEAD"

# --- render into a FILE: exactly three backticks, one field per line -------------------
# Not into a variable: `$(printf 'x\n')` strips the trailing newline, so building the
# body by concatenating command substitutions silently glues every line together. That
# is what the first version of this script did, and the probe caught it: the block
# posted as "```dsv-verdictstatus: passrole: testercommit: ...", which no parser can
# read -- the same class of defect this script exists to prevent.
BODYF="$(mktemp "$(cd "${TMPDIR:-/tmp}" >/dev/null 2>&1 && { pwd -W 2>/dev/null || pwd; })/dsv-verdict.XXXXXX")" || fail "could not create a temp file"
# Sanitise every value that goes inside the block. Two bot findings, both real: a value
# containing three backticks would CLOSE the fence early, and a value with a newline would
# break the one-field-per-line shape. The block is a wire format, so the text is made
# safe rather than trusted.
sanitize() { printf '%s' "$1" | tr '\n\r' '  ' | sed 's/```/` ` `/g'; }
OBSERVED="$(sanitize "$OBSERVED")"; BEFORE="$(sanitize "$BEFORE")"; BUILD="$(sanitize "$BUILD")"
REASON="$(sanitize "$REASON")"; FIXREQ="$(sanitize "$FIXREQ")"; SOURCE="$(sanitize "$SOURCE")"; NOTE="$(sanitize "$NOTE")"
{
  printf '%s\n' '```dsv-verdict'
  printf 'status: %s\n' "$STATUS"
  printf 'role: %s\n' "$ROLE"
  printf 'commit: %s\n' "$COMMIT"
  if [ "$ROLE" = reviewer ]; then
    printf 'scope_ok: %s\n' "$SCOPE_OK"
  else
    [ -n "$OBSERVED" ] && printf 'observed: %s\n' "$OBSERVED"
    [ -n "$BEFORE" ] && printf 'before: %s\n' "$BEFORE"
    [ -n "$BUILD" ] && printf 'build: %s\n' "$BUILD"
  fi
  # Both roles. Measured 2026-10-04 on PR #163: reason:/fix_required: were rendered for a reviewer
  # only, so a Tester FAIL whose own report carried both was posted without them, and the gate
  # read the reason-less fail as unparseable - the PR stayed locked instead of failing.
  [ -n "$REASON" ] && printf 'reason: %s\n' "$REASON"
  [ -n "$FIXREQ" ] && printf 'fix_required: %s\n' "$FIXREQ"
  [ -n "$SOURCE" ] && printf 'source: %s\n' "$SOURCE"
  printf '%s\n' '```'
  [ -n "$NOTE" ] && printf '\n%s\n' "$NOTE"
} > "$BODYF"

# The fence is the gate: prove it is byte-exact before anything is posted.
grep -qxF '```dsv-verdict' "$BODYF" || fail "internal error: the fence line is not exactly three backticks + dsv-verdict"
LINES="$(wc -l < "$BODYF")"
[ "$LINES" -ge 5 ] || fail "internal error: the rendered block is $LINES lines"

# --- one comment per role per head: edit the existing one, else create -----------------
# One JSON object per line from an explicit repo: `--paginate --slurp` and the {owner}/{repo}
# placeholder both depend on the gh version and the caller's checkout, and measured 2026-10-04 the
# lookup came back empty from the dispatcher's worktree, so a SECOND verdict comment was created.
REPO_SLUG="${DSV_REPO:-ernem22/design-system-viewer}"
list_comments() { gh api "repos/$REPO_SLUG/issues/$PR/comments" --paginate --jq '.[] | {id, body}' 2>/dev/null; }
EXISTING="$(list_comments | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const head=process.argv[1], role=process.argv[2];
  let out="";
  try{ const a=s.split("\n").filter(Boolean).map(l=>JSON.parse(l));
    for(const c of a){ const b=c.body||"";
      if(b.indexOf("```dsv-verdict")<0) continue;
      const m=/^role:\s*([a-z]+)\s*$/m.exec(b), k=/^commit:\s*([0-9a-fA-F]+)\s*$/m.exec(b);
      if(m && m[1]===role && k && head.startsWith(k[1])) out=String(c.id);
    }
  }catch(e){}
  process.stdout.write(out);
});' "$HEAD" "$ROLE")"

if [ -n "$EXISTING" ]; then
  gh api --method PATCH "repos/$REPO_SLUG/issues/comments/$EXISTING" -F body=@"$BODYF" >/dev/null 2>&1 \
    || fail "could not edit comment $EXISTING"
  ACTION="edited comment $EXISTING"
else
  URL="$(gh pr comment "$PR" --body-file "$BODYF" 2>&1 | grep -oE 'https://[^ ]+' | head -1)"
  [ -n "$URL" ] || fail "could not post the verdict comment on PR #$PR"
  ACTION="created $URL"
fi
rm -f "$BODYF"

# --- read it back: a write that is not verified is not a write -------------------------
VERIFY="$(list_comments | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const head=process.argv[1], role=process.argv[2];
  let hit=null, n=0;
  try{ const a=s.split("\n").filter(Boolean).map(l=>JSON.parse(l));
    for(const c of a){ const b=c.body||"";
      if(b.indexOf("```dsv-verdict")<0) continue;
      const m=/^role:\s*([a-z]+)\s*$/m.exec(b), k=/^commit:\s*([0-9a-fA-F]+)\s*$/m.exec(b);
      if(m&&m[1]===role&&k&&head.startsWith(k[1])){ n++; hit=b; }
    }
  }catch(e){}
  process.stdout.write(n+"|"+(hit?"present":"missing")+"\n"+(hit||""));
});' "$HEAD" "$ROLE")"
# The payload carries the body, which is multi-line: parse the first line only. `cut -f1`
# over the whole string splits per line and silently returns the body too.
FIRST="$(printf '%s\n' "$VERIFY" | head -1)"
COUNT="${FIRST%%|*}"
STATE="${FIRST##*|}"
BODY="$(printf '%s\n' "$VERIFY" | tail -n +2)"
[ "$STATE" = present ] || fail "posted, but no $ROLE verdict for head $HEAD reads back"
# The gate keeps the LATEST verdict per role, so what must hold is that the latest one is ours.
printf '%s\n' "$BODY" | grep -qx "status: $STATUS" || fail "the latest $ROLE verdict for head $HEAD is not the one just written"
if [ "$STATUS" = fail ]; then printf '%s\n' "$BODY" | grep -q '^reason: .' || fail "the latest $ROLE fail for head $HEAD reads back with no reason:"; fi
[ "$COUNT" = 1 ] || echo "verdict-post: note: $COUNT $ROLE verdicts exist for head ${HEAD:0:7} (older ones predate this tool); the gate reads the latest" >&2
echo "verdict-post: $ACTION"
echo "verdict-post: latest $ROLE verdict for head ${HEAD:0:7} reads back as written ($COUNT on the head)"
echo "--- body as stored ---"
printf '%s\n' "$BODY"
exit 0
