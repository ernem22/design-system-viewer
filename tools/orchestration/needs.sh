#!/usr/bin/env bash
# What each `agent` issue and open PR needs next, computed from GitHub - the work list Hermes turns
# into queue specs. Read-only: it starts nothing, posts nothing, labels nothing.
#
#   needs.sh            print one line per need: <role> <ref> <head> <why>
#   needs.sh --json     the same as JSON lines
#
# Why: the hunter's G1 finding - no deterministic code picks up an `agent` issue; the LLM
# coordinator had to notice it. This decides WHAT is owed; Hermes only writes the spec text.
#
# A need is suppressed while a spec for the same <role> and <ref> (and, for PR roles, the same head)
# is queued, running or already finished in $S, so a need is written once per head, not per pass.
# Spec headers it matches on: `role:`, `issue:` (coder) or `pr:` + `head:` (reviewer/tester/fixer).
set -uo pipefail

REPO="${DSV_REPO:-ernem22/design-system-viewer}"
BASE="${DSV_BASE:-refactor/full-react-migration}"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
JSON=""; [ "${1:-}" = "--json" ] && JSON=1

# every spec the dispatcher knows about: queue, active, running, finished
known() {
  local role="$1" key="$2" val="$3" head="${4:-}" f
  for f in "$S"/queue/* "$S"/active-* "$S"/done/*; do
    [ -f "$f" ] || continue
    sed -n '1,/^---$/p' "$f" | grep -qx "role: $role" || continue
    sed -n '1,/^---$/p' "$f" | grep -qx "$key: $val" || continue
    # a finished attempt that failed to start or was rejected does not satisfy the need - for every
    # role: a coder spec that failed to start must not hide its issue forever
    case "$f" in *.rejected|*.start-failed) continue;; esac
    # a blocked result holds the need for BLOCKED_TTL minutes only (default 240): what blocked it -
    # typically another open PR holding the files - is expected to move, and nobody re-queues it
    # ...and only until the base branch moves: what blocks a card is almost always another open PR,
    # and its merge is what unblocks it (measured 2026-10-05: #213 blocked on #170, #170 merged, and
    # #213 still sat out the rest of its 4 hours with the queue empty)
    case "$f" in *.blocked) young "$f" "${BLOCKED_TTL:-240}" && ! newer_base "$f" || continue;; esac
    # Only a delivered result (succeeded) or a human-facing one (unreproducible) holds a need for good.
    # Every other ending holds it for RETRY_TTL minutes (default 180), then the need is owed again.
    # Measured 2026-10-05: two Testers each for #203 and #170 ended verdict-refused, the old rule
    # ("2 refused = done") hid both PRs for good, and the pipeline sat idle with the gates pending.
    case "$f" in *.failed|*.timeout|*.exited|*.agent_wait|*.cancelled|*.unknown|*.no-pr|*.no-push)
      young "$f" "${RETRY_TTL:-180}" || continue;; esac
    # A Coder's success is its open PR, and an issue with an open PR never reaches this check (it is
    # claimed above). So a succeeded Coder result for an unclaimed issue means its PR is gone or never
    # existed: it holds the issue for an hour at most (measured 2026-10-05: nine "succeeded" Coders,
    # no PR, nine issues hidden for good).
    [ "$role" = "coder" ] && case "$f" in *.succeeded) young "$f" "${CODER_OK_TTL:-60}" || continue;; esac
    if [ -n "$head" ]; then
      sed -n '1,/^---$/p' "$f" | grep -qiE "^head:[[:space:]]*${head:0:7}" || continue
      # a worker whose verdict could not be posted is retried at once, twice per role and head (the
      # work ran but nothing reached the gate, measured 2026-10-04, reviewer #163 b383367); after
      # that, each refused result holds the need for RETRY_TTL minutes only
      case "$f" in *.verdict-refused)
        [ "$(refused_count "$role" "$val" "$head")" -ge 2 ] && young "$f" "${RETRY_TTL:-180}" || continue;; esac
    fi
    return 0
  done
  return 1
}

young() { [ -n "$(find "$1" -mmin -"$2" 2>/dev/null)" ]; }   # file, minutes
# the base branch's head commit is newer than the file (a merge landed after that result)
BASE_AT=""
newer_base() {
  [ -n "$BASE_AT" ] || BASE_AT="$(gh api "repos/$REPO/commits/$BASE" --jq '.commit.committer.date' 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=Date.parse(s.trim());console.log(isNaN(t)?0:Math.floor(t/1000))})')"
  [ "${BASE_AT:-0}" -gt "$(stat -c %Y "$1" 2>/dev/null || echo 0)" ]
}

refused_count() {   # role pr head -> number of verdict-refused results for it
  local n=0 f
  for f in "$S"/done/*.verdict-refused; do
    [ -f "$f" ] || continue
    sed -n '1,/^---$/p' "$f" | grep -qx "role: $1" || continue
    sed -n '1,/^---$/p' "$f" | grep -qx "pr: $2" || continue
    sed -n '1,/^---$/p' "$f" | grep -qiE "^head:[[:space:]]*${3:0:7}" || continue
    n=$((n+1))
  done
  echo "$n"
}

emit() {   # role ref head why [branch]
  if [ -n "$JSON" ]; then
    # the why carries the gate's description, which is external text: let JSON.stringify escape it
    node -e 'const [r,f,h,w,b]=process.argv.slice(1);console.log(JSON.stringify({role:r,ref:f,head:h,branch:b,why:w}))' \
      "$1" "$2" "$3" "$4" "${5:--}"
  else
    printf '%-8s %-6s %-8s %s\n' "$1" "$2" "${3:0:7}" "$4"
  fi
}

# ---- issues labelled agent with no open PR claiming them -> coder ----------------------------
PRS_JSON="$(gh pr list --repo "$REPO" --base "$BASE" --state open --json number,title,body,headRefOid,headRefName,mergeable --limit 200 2>/dev/null)" \
  || { echo "needs.sh: cannot list PRs (gh)" >&2; exit 4; }
CLAIMED="$(printf '%s' "$PRS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const n=new Set();for(const p of JSON.parse(s)){for(const m of ((p.title||"")+"\n"+(p.body||"")).matchAll(/(?:\(#|(?:Closes|Fixes|Resolves) #)(\d+)/g))n.add(m[1])}console.log([...n].join(" "))})')"

LIMIT=200
[ "$(printf '%s' "$PRS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))')" -ge "$LIMIT" ] \
  && echo "needs.sh: $LIMIT open PRs listed - the limit; some may be missing" >&2
# gh issue list defaults to 30: past that, agent issues were silently never seen
# `retired`, `umbrella` and `held` issues are not dispatchable: retired by a product decision, an
# umbrella that must be split first, or held on purpose (#116 went to a Coder whole, 2026-10-05).
ISSUES="$(gh issue list --repo "$REPO" --label agent --state open --json number,labels --limit "$LIMIT" \
  --jq '.[]|select([.labels[].name]|any(.=="retired" or .=="umbrella" or .=="held")|not)|.number' 2>/dev/null)" \
  || { echo "needs.sh: cannot list agent issues (gh)" >&2; exit 4; }
[ "$(printf '%s\n' $ISSUES | grep -c .)" -ge "$LIMIT" ] && echo "needs.sh: $LIMIT agent issues listed - the limit; some may be missing" >&2
for n in $ISSUES; do
  case " $CLAIMED " in *" $n "*) continue;; esac
  known coder issue "$n" && continue
  emit coder "#$n" "-" "agent issue with no open PR"
done

# ---- open PRs: the gate's own status says who is owed ------------------------------------------
printf '%s' "$PRS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))console.log(p.number+" "+p.headRefOid+" "+p.headRefName+" "+(p.mergeable||"UNKNOWN"))})' \
| while read -r pr head ref mergeable; do
  [ -n "$pr" ] || continue
  # A PR in conflict with its base cannot merge whatever its verdicts say: a Fixer merges the base in.
  # (Nothing handled this; #142 sat conflicted until resolved by hand, 2026-10-05.)
  if [ "$mergeable" = "CONFLICTING" ]; then
    known fixer pr "$pr" "$head" || emit fixer "#$pr" "$head" "merge conflict with $BASE" "$ref"
    continue
  fi
  gate="$(gh api "repos/$REPO/commits/$head/status" \
    --jq '[.statuses[]|select(.context=="pipeline/verdict")]|.[0]|"\(.state // "none")|\(.description // "")"' 2>/dev/null)" \
    || { echo "needs.sh: gate lookup failed for #$pr; skipped this pass" >&2; continue; }
  state="${gate%%|*}"; desc="${gate#*|}"
  case "$state" in
    success) continue ;;   # close.sh merges it
    failure)
      known fixer pr "$pr" "$head" || emit fixer "#$pr" "$head" "gate failure: $desc" "$ref" ;;
    *)
      # pending / none: whichever verdicts are missing for THIS head
      case "$desc" in *reviewer*|"") known reviewer pr "$pr" "$head" || emit reviewer "#$pr" "$head" "no reviewer verdict for this head" "$ref";; esac
      case "$desc" in *tester*|"")   known tester   pr "$pr" "$head" || emit tester   "#$pr" "$head" "no tester verdict for this head (branch $ref)" "$ref";; esac ;;
  esac
done
