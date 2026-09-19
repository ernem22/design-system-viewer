#!/usr/bin/env bash
# Stateless reap: release the worker, close its terminal, remove its worktree.
# The counterpart of spawn.sh. This is the pair the failure ledger calls
# "ack and release are one atomic pair" plus the third step, teardown.
#
#   reap.sh <role-slug> [dispatch-id]
#
# State: none. The worktree path is read from `orca worktree list` — Orca owns
# it, so this script cannot drift from it. Ack is not done here: ack needs the
# delivery id, which belongs to the settlement the caller just read.
#
# Prints one line per step so the caller can see what actually happened.
set -uo pipefail

ROLE="${1:?usage: reap.sh <role-slug> [dispatch-id]}"
DISPATCH="${2:-}"
S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
REPO_ID="294b7f02-d29f-464f-a65c-f6929e0b8ae2"

# Orca owns the worktree list; ask it, do not cache it.
P=$(orca worktree list 2>/dev/null | grep -E "^$REPO_ID::" | grep "/$ROLE\$" | head -1 | sed -E 's/^[^:]*::(.*)  refs.*/\1/')
if [ -z "$P" ]; then
  # fall back to a plain path column hit, then give up loudly rather than silently
  P=$(orca worktree list 2>/dev/null | grep "/$ROLE\$" | head -1 | awk '{print $1}')
fi

if [ -n "$DISPATCH" ]; then
  ST=$(orca orchestration worker-release --dispatch "$DISPATCH" --json 2>&1 \
       | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).result.state)}catch(e){console.log('unparsed')}})")
  echo "release $DISPATCH: $ST"
else
  echo "release: skipped (no dispatch id)"
fi

if [ -n "$P" ]; then
  orca terminal close --worktree "id:$REPO_ID::$P" --all --json >/dev/null 2>&1 \
    && echo "terminals closed: $ROLE" || echo "terminals: none for $ROLE"

  RM=$(orca worktree rm --worktree "id:$REPO_ID::$P" --force --json 2>&1 \
       | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).ok)}catch(e){console.log('unparsed')}})")
  echo "worktree rm $ROLE: $RM ($P)"
else
  echo "worktree: orca does not list a worktree for $ROLE"
fi
