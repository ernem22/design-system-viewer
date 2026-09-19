#!/usr/bin/env bash
# Stateless spawn: worktree + model pin + terminal for one worker.
# Holds no state of its own; the path is written only so reap.sh can find it.
#
#   spawn.sh <role-slug> [base-branch] [--plan]
#
# Prints: PATH=<worktree path>  ROLE=<role-slug>
# Exit 0 only when the worktree, the opencode.json pin and the terminal exist.
set -euo pipefail

ROLE=""
BASE=""
PLAN=""
for arg in "$@"; do
  case "$arg" in
    --plan) PLAN="--plan" ;;
    -*)
      echo "spawn.sh: unknown flag $arg (usage: spawn.sh <role> [base-branch] [--plan])" >&2
      exit 1 ;;
    *)
      if [ -z "$ROLE" ]; then ROLE="$arg"; else BASE="$arg"; fi ;;
  esac
done
[ -z "$ROLE" ] && { echo "usage: spawn.sh <role> [base-branch] [--plan]" >&2; exit 1; }
[ -z "$BASE" ] && BASE="origin/refactor/full-react-migration"

# A base ref that does not exist makes `orca worktree create` return an error object
# that this script parses into an empty PATH — a silent no-op that looks exactly like a
# successful spawn. It cost a Tester dispatch (a Coder had named its own branch
# `coder/88-gallery-wcag-tokens` and the guessed `ernem22/coder-88` did not exist), so
# the base is verified before anything is created.
git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null \
  || { echo "spawn.sh: base ref '$BASE' does not exist — git fetch, or read the PR's headRefName" >&2; exit 3; }

S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
REPO_ID="294b7f02-d29f-464f-a65c-f6929e0b8ae2"
CMD="opencode"
[ "$PLAN" = "--plan" ] && CMD="opencode --agent plan"

mkdir -p "$S/worktrees"
TMP="${LOCALAPPDATA}/Temp/terminals_$$.json"

RAW=$(orca worktree create --repo "id:$REPO_ID" --name "$ROLE" \
  --base-branch "$BASE" --setup skip --json 2>&1)
P=$(printf '%s' "$RAW" | node -e \
  "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.result.worktree.path||j.result.path)})")

# Model pin AND permission model. The permission block is what stops a worker from
# stalling on an approval prompt:
#   * external_directory: deny — a worker may not touch anything outside its own
#     worktree (this is the D:\ request class: denied, not asked).
#   * "*": allow — inside the worktree everything runs, so no prompt can block a
#     phase. That is the whole point: a prompt is a stall the coordinator has to
#     notice, and denying predictably is cheaper than asking.
#   * destructive git/rm patterns are denied outright; a worker that needs one has
#     to say so in its report.
if [ "$PLAN" = "--plan" ]; then
  # A Reviewer is read-only by contract; enforce it here instead of trusting prose.
  printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "opencode-go/deepseek-v4.1-flash",\n  "permission": {\n    "external_directory": "deny",\n    "edit": "deny",\n    "write": "deny",\n    "*": "allow",\n    "bash": { "*": "deny", "orca *": "allow", "gh *": "allow", "curl *": "allow", "git log *": "allow", "git show *": "allow", "git diff *": "allow", "ls *": "allow", "cat *": "allow", "grep *": "allow", "rg *": "allow", "head *": "allow", "tail *": "allow", "wc *": "allow" }\n  }\n}\n' > "$P/opencode.json"
else
  printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "opencode-go/deepseek-v4.1-flash",\n  "permission": {\n    "external_directory": "deny",\n    "*": "allow",\n    "bash": { "*": "allow", "rm -rf *": "deny", "git push --force*": "deny", "git reset --hard*": "deny", "git clean *": "deny" }\n  }\n}\n' > "$P/opencode.json"
fi

orca terminal create --worktree "id:$REPO_ID::$P" --title "$ROLE" --command "$CMD" --json >/dev/null

sleep 6

# Look the handle up by the worktree PATH, not by the role name: orca suffixes a
# taken name (`role` -> `role-2`), and a name lookup then returns the terminal of
# the older worktree, which worker-start rejects as terminal_worktree_mismatch.
H=$(bash "$(dirname "$0")/handle.sh" "$P" 2>/dev/null | head -1)
[ -z "$H" ] && { echo "NO_TERMINAL_HANDLE for $ROLE (path $P) — inspect: orca terminal list" >&2; exit 2; }

echo "PATH=$P"
echo "HANDLE=$H"
echo "ROLE=$ROLE"
