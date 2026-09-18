#!/usr/bin/env bash
# Advance one settled phase in a single command: ack the delivery, release the
# worker, reap its worktree.
#
# Why: this is four tool calls when done by hand (ack, release, terminal close,
# worktree rm), and every coordinator turn re-sends the whole conversation — the
# coordinator's own context is the largest cost line in this pipeline. Collapsing
# the mechanical half of a settlement into one command is a direct token saving,
# and it removes the failure mode where a step is forgotten (an unreleased dispatch
# leaks a terminal; an unacked delivery is redelivered forever).
#
#   advance.sh <delivery-id> <role-slug> [dispatch-id]
#
# Prints one line per step. Exit 0 when the ack succeeded.
set -uo pipefail

DID="${1:?usage: advance.sh <delivery-id> <role-slug> [dispatch-id]}"
ROLE="${2:?usage: advance.sh <delivery-id> <role-slug> [dispatch-id]}"
DISPATCH="${3:-}"
RUN="${WATCH_RUN:-run_4e539259ab29}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# ack takes the DELIVERY id (delivery_...), never the message id (msg_...):
# acking with the wrong id returns ok:false and leaves the queue untouched, so the
# settlement is redelivered to every new watcher.
ACK=$(orca orchestration check --run "$RUN" --ack "$DID" --json 2>&1 \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).ok?'ok':'FAILED')}catch(e){console.log('unparsed')}})")
echo "ack $DID: $ACK"

bash "$HERE/reap.sh" "$ROLE" "$DISPATCH"
