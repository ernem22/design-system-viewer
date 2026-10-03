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
    if [ -n "$head" ]; then
      sed -n '1,/^---$/p' "$f" | grep -qiE "^head: ${head:0:7}" || continue
      # a finished attempt that failed to start or was rejected does not satisfy the need
      case "$f" in *.rejected|*.start-failed) continue;; esac
    fi
    return 0
  done
  return 1
}

emit() {
  if [ -n "$JSON" ]; then
    printf '{"role":"%s","ref":"%s","head":"%s","why":"%s"}\n' "$1" "$2" "$3" "$(printf '%s' "$4" | sed 's/"/\\"/g')"
  else
    printf '%-8s %-6s %-8s %s\n' "$1" "$2" "${3:0:7}" "$4"
  fi
}

# ---- issues labelled agent with no open PR claiming them -> coder ----------------------------
PRS_JSON="$(gh pr list --repo "$REPO" --base "$BASE" --state open --json number,title,body,headRefOid,headRefName --limit 100 2>/dev/null)" \
  || { echo "needs.sh: cannot list PRs (gh)" >&2; exit 4; }
CLAIMED="$(printf '%s' "$PRS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const n=new Set();for(const p of JSON.parse(s)){for(const m of ((p.title||"")+"\n"+(p.body||"")).matchAll(/(?:\(#|(?:Closes|Fixes|Resolves) #)(\d+)/g))n.add(m[1])}console.log([...n].join(" "))})')"

for n in $(gh issue list --repo "$REPO" --label agent --state open --json number --jq '.[].number' 2>/dev/null); do
  case " $CLAIMED " in *" $n "*) continue;; esac
  known coder issue "$n" && continue
  emit coder "#$n" "-" "agent issue with no open PR"
done

# ---- open PRs: the gate's own status says who is owed ------------------------------------------
printf '%s' "$PRS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))console.log(p.number+" "+p.headRefOid+" "+p.headRefName)})' \
| while read -r pr head ref; do
  [ -n "$pr" ] || continue
  gate="$(gh api "repos/$REPO/commits/$head/status" \
    --jq '[.statuses[]|select(.context=="pipeline/verdict")]|.[0]|"\(.state // "none")|\(.description // "")"' 2>/dev/null)"
  state="${gate%%|*}"; desc="${gate#*|}"
  case "$state" in
    success) continue ;;   # close.sh merges it
    failure)
      known fixer pr "$pr" "$head" || emit fixer "#$pr" "$head" "gate failure: $desc" ;;
    *)
      # pending / none: whichever verdicts are missing for THIS head
      case "$desc" in *reviewer*|"") known reviewer pr "$pr" "$head" || emit reviewer "#$pr" "$head" "no reviewer verdict for this head";; esac
      case "$desc" in *tester*|"")   known tester   pr "$pr" "$head" || emit tester   "#$pr" "$head" "no tester verdict for this head (branch $ref)";; esac ;;
  esac
done
