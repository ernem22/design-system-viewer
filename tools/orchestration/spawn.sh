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

printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "opencode-go/deepseek-v4.1-flash"\n}\n' > "$P/opencode.json"

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
