#!/usr/bin/env bash
# Who is waiting on a human, and what are they asking?
#
# A worker that hits an approval prompt or a question stops making progress while
# the run still looks healthy: it is live, it is "working", and nothing arrives.
# Orca marks those dispatches with `attention=`, so this script lists them and
# prints the tail of each terminal — the prompt or the question is on screen, not
# in a message.
#
#   attention.sh [run-id]
#
# Answers are made with `orca orchestration send` for a real question (a design
# decision, a blocker) or `orca terminal send --terminal <handle> --text <answer>
# --enter` for a TUI prompt. Approval prompts should not happen at all: every
# worktree's opencode.json carries a permission block (external_directory denied,
# inside allowed), so a worker that wants something outside its worktree is told
# no immediately instead of asking.
set -uo pipefail

RUN="${1:-run_4e539259ab29}"
NOISE='attention=none|attention=unverifiable|attention=unverifiable,root_completion|attention=root_completion'

echo "=== waiting on a human (run $RUN)"
orca orchestration worker-list --run "$RUN" 2>&1 | grep -E '\[ready/(working|waiting)\]' | grep -vE "$NOISE" > /tmp/_att.txt || true
if [ ! -s /tmp/_att.txt ]; then
  echo "none — every live dispatch is unblocked"
  rm -f /tmp/_att.txt
  exit 0
fi

cat /tmp/_att.txt | sed -E 's/workspace=[^ ]+//; s/provider[^ ]*//'
rm -f /tmp/_att.txt

while IFS= read -r line; do
  H=$(printf '%s' "$line" | grep -oE 'terminal=[^ ]+' | cut -d= -f2)
  [ -z "$H" ] && continue
  printf '\n--- %s\n' "$H"
  orca terminal read --terminal "$H" 2>&1 | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g' | grep -v '^\s*$' | tail -14
  printf 'answer a question:  orca orchestration send --run %s --to %s --type status --subject "..." --body "..." --json\n' "$RUN" "$H"
  printf 'answer a TUI prompt: orca terminal send --terminal %s --text "<answer>" --enter\n' "$H"
done < <(orca orchestration worker-list --run "$RUN" 2>&1 | grep -E '\[ready/(working|waiting)\]' | grep -vE "$NOISE")
