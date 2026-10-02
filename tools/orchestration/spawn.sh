#!/usr/bin/env bash
# Stateless spawn: worktree + model pin + terminal for one worker.
# Holds no state of its own; the path is written only so reap.sh can find it.
#
#   spawn.sh <role-slug> [base-branch] [--plan|--readonly] [--worktree-only]
#
# Prints: PATH=<worktree path>  ROLE=<role-slug>
# Exit 0 only when the worktree, the opencode.json pin and the terminal exist.
# --worktree-only: create the worktree and stop — no terminal, no wait for one, and no
# failure when none registers. rebase.sh wants somewhere to rebase and discards the handle
# anyway, so requiring an agent terminal there turned a created worktree into "could not
# create the worktree" and left it behind.
set -euo pipefail

ROLE=""
BASE=""
PLAN=""
READONLY=""
WORKTREE_ONLY=""
for arg in "$@"; do
  case "$arg" in
    --plan) PLAN="--plan" ;;
    # --readonly: the same deny-based read-only config as --plan, but WITHOUT OpenCode's plan mode.
    # Plan mode is a UI mode: the agent finishes its review and then asks a human to toggle it off
    # before it may post anything, and nothing on the coordinator side can send that toggle.
    # Measured 2026-09-28 on reviewer-162e: "the review is complete and the verdict is ready" while
    # it sat unable to post. The permission block below is what actually enforces read-only, so plan
    # mode was never needed for it.
    --readonly) READONLY="--readonly" ;;
    --worktree-only) WORKTREE_ONLY="1" ;;
    -*)
      echo "spawn.sh: unknown flag $arg (usage: spawn.sh <role> [base-branch] [--plan] [--worktree-only])" >&2
      exit 1 ;;
    *)
      if [ -z "$ROLE" ]; then ROLE="$arg"; else BASE="$arg"; fi ;;
  esac
done
[ -z "$ROLE" ] && { echo "usage: spawn.sh <role> [base-branch] [--plan] [--worktree-only]" >&2; exit 1; }
[ -z "$BASE" ] && BASE="origin/refactor/full-react-migration"

# A base ref that does not exist makes `orca worktree create` return an error object
# that this script parses into an empty PATH — a silent no-op that looks exactly like a
# successful spawn. It cost a Tester dispatch (a Coder had named its own branch
# `coder/88-gallery-wcag-tokens` and the guessed `ernem22/coder-88` did not exist), so
# the base is verified before anything is created.
if ! git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null; then
  # Only a REMOTE ref may exist for this branch: measured 2026-09-30, the local ref for an open PR's
  # branch had been cleaned up while the PR was still open, so spawn.sh refused a base that was
  # perfectly fetchable. Fetch the tracking ref rather than stopping.
  if git fetch --quiet origin "$BASE:$BASE" 2>/dev/null && git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null; then
    echo "spawn.sh: no local ref for '$BASE'; fetched it from origin" >&2
  else
    echo "spawn.sh: base ref '$BASE' does not exist — git fetch, or read the PR's headRefName" >&2
    exit 3
  fi
fi

S="${LOCALAPPDATA}/orca-orchestration/design-system-viewer"
# The Orca repo id is machine state, not a constant: re-importing the folder mints a
# new one, and the old value answers `repo_not_found` — which this script used to turn
# into an empty PATH. Resolve it at runtime (see repo-id.sh).
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$HERE/repo-id.sh"
CMD="opencode"
[ "$PLAN" = "--plan" ] && CMD="opencode --agent plan"
# --readonly deliberately leaves CMD as plain `opencode`: the agent must be able to run the allowed
# commands (gh, git log, curl) to deliver its verdict.

mkdir -p "$S/worktrees"
TMP="${LOCALAPPDATA}/Temp/terminals_$$.json"

RAW=$(orca worktree create --repo "id:$REPO_ID" --name "$ROLE" \
  --base-branch "$BASE" --setup skip --json 2>/dev/null)
P=$(printf '%s' "$RAW" | node -e \
  "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const i=s.indexOf('{');const j=JSON.parse(i>=0?s.slice(i):s);console.log(j.result.worktree.path||j.result.path)})")

# Ownership marker: reconcile.py treats a worktree as MANAGED only when this file exists, so
# everything the pipeline did not create - the owner's own opencode, the coordinator, houndshark,
# the root checkout - stays invisible to it. Written here because this is the one moment the
# worktree path and the role are both known. `dispatch` is filled in once the handle is.
printf 'role=%s\nhandle=\nstate=starting\ndispatch=\ncreated_at=%s\n' "$ROLE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$P/.dsv-worker" 2>/dev/null || true

# The marker and Orca's per-worktree config are untracked by design. Without this the
# worktree is 'dirty', `git worktree remove` refuses, and a settle that printed DONE
# leaves the directory on disk - which is exactly what happened to two probe worktrees.
# info/exclude is per-worktree and untracked, so it never reaches the repo.
GD="$(git -C "$P" rev-parse --git-dir 2>/dev/null || true)"
if [ -n "$GD" ]; then
  mkdir -p "$GD/info" 2>/dev/null || true
  for PAT in .dsv-worker opencode.json; do
    grep -qxF "$PAT" "$GD/info/exclude" 2>/dev/null || printf '%s\n' "$PAT" >> "$GD/info/exclude"
  done
fi

# Model pin AND permission model. The permission block is what stops a worker from
# stalling on an approval prompt:
#   * external_directory: deny — a worker may not touch anything outside its own
#     worktree (this is the D:\ request class: denied, not asked).
#   * "*": allow — inside the worktree everything runs, so no prompt can block a
#     phase. That is the whole point: a prompt is a stall the coordinator has to
#     notice, and denying predictably is cheaper than asking.
#   * destructive git/rm patterns are denied outright; a worker that needs one has
#     to say so in its report. Note the force-push pattern is `git push --force *`
#     (with the space), NOT `git push --force*`: the pipeline requires
#     `--force-with-lease` to publish a rebase onto a moved base, and the wildcard
#     form swallowed it too. The lease form refuses when the remote has moved, so it
#     cannot destroy work the way a plain --force can — denying both cost a whole
#     fixer round trip, with the worker correctly stopping to ask.
#     Two gaps survived that fix, both closed on 2026-09-27:
#       - a flag positioned AFTER the remote matched no pattern at all, so
#         `git push origin HEAD --force` and `git push --force-if-includes origin x`
#         were both allowed. The patterns below now cover the flag first, last and in
#         the middle, plus the `+refspec` force form. `--force-with-lease` matches
#         none of them: no pattern ends in `--force*` any more.
#       - `git reset --hard*` had the same shape of gap in the other direction
#         (`git reset origin/main --hard` was allowed), so the reset rule enumerates
#         positions too. Verified against opencode's own matcher by the probe recorded
#         in this change's PR description, not assumed from the patterns.
#     Three more gaps, found by the review bots on that PR and closed the same day:
#       - the BARE forms matched no pattern either. Every replacement above needs a space
#         plus an argument, so `git push --force` and `git reset --hard` with nothing after
#         them fell through to the catch-all allow — forms the OLD wildcard did catch, so
#         that was a regression, not a pre-existing hole. The bare keys are now explicit.
#       - `--force-if-includes` was denied outright, which also killed
#         `git push --force-if-includes --force-with-lease origin x`: git documents the flag
#         as an add-on to a lease, not a force of its own. It stays denied standing alone;
#         the two orders that pair it with `--force-with-lease` are explicit allows.
#       - `rebase.sh` calls this script for a worktree and discards the handle, so the agent
#         wait below turned a created worktree into "could not create the worktree". That
#         caller now passes --worktree-only.
#     The order in the map matters: opencode resolves the LAST matching pattern, so the two
#     lease-pair allows sit before the positional force and `+refspec` denies. A lease pair
#     that also carries a plain `--force`, or a `+refspec`, still hits a later deny — the
#     allow only decides when nothing below it matches.
if [ "$PLAN" = "--plan" ] || [ "$READONLY" = "--readonly" ]; then
  # A Reviewer is read-only by contract; enforce it here instead of trusting prose.
  printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "opencode-go/deepseek-v4.1-flash",\n  "permission": {\n    "external_directory": "deny",\n    "edit": "deny",\n    "write": "deny",\n    "*": "allow",\n    "bash": { "*": "deny", "orca *": "allow", "gh *": "allow", "curl *": "allow", "git log *": "allow", "git show *": "allow", "git diff *": "allow", "ls *": "allow", "cat *": "allow", "grep *": "allow", "rg *": "allow", "head *": "allow", "tail *": "allow", "wc *": "allow" }\n  }\n}\n' > "$P/opencode.json"
else
  printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "opencode-go/deepseek-v4.1-flash",\n  "permission": {\n    "external_directory": "deny",\n    "*": "allow",\n    "bash": { "*": "allow", "rm -rf *": "deny", "git push --force-if-includes": "deny", "git push --force-if-includes *": "deny", "git push --force-if-includes --force-with-lease *": "allow", "git push --force-with-lease --force-if-includes *": "allow", "git push --force": "deny", "git push --force *": "deny", "git push * --force": "deny", "git push * --force *": "deny", "git push -f": "deny", "git push -f *": "deny", "git push * -f": "deny", "git push * -f *": "deny", "git push * +*": "deny", "git reset --hard": "deny", "git reset --hard *": "deny", "git reset * --hard": "deny", "git reset * --hard *": "deny", "git clean *": "deny" }\n  }\n}\n' > "$P/opencode.json"
fi

# --worktree-only stops here: the caller wants a worktree, not a worker. Skipping the terminal
# also skips the agent wait below, which is the point — rebase.sh needs the directory, and a
# missing agent terminal must not read to it as "no worktree".
if [ -n "$WORKTREE_ONLY" ]; then
  echo "PATH=$P"
  echo "ROLE=$ROLE"
  exit 0
fi

orca terminal create --worktree "id:$REPO_ID::$P" --title "$ROLE" --command "$CMD" --json >/dev/null

sleep 6

# Look the handle up by the worktree PATH, not by the role name: orca suffixes a
# taken name (`role` -> `role-2`), and a name lookup then returns the terminal of
# the older worktree, which worker-start rejects as terminal_worktree_mismatch.
# Wait for the AGENT terminal, not the first terminal in the worktree. A worktree gets
# a plain shell at creation and the opencode TUI registers a few seconds later; taking
# the shell binds the dispatch to a terminal with no agent in it, so the worker never
# runs and never reports — a silent dead dispatch with no settlement to recover.
H=""
for _ in $(seq 1 25); do
  H=$(bash "$HERE/handle.sh" "$P" --agent-only 2>/dev/null | head -1)
  [ -n "$H" ] && break
  sleep 3
done
[ -z "$H" ] && { echo "NO_TERMINAL_HANDLE for $ROLE (path $P) — the agent terminal never registered; inspect: orca terminal list" >&2; exit 2; }

# dispatch without guessing from names.
printf 'role=%s\nhandle=%s\nstate=starting\ndispatch=\ncreated_at=%s\n' "$ROLE" "${H:-}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$P/.dsv-worker" 2>/dev/null || true

echo "PATH=$P"
echo "HANDLE=$H"
echo "ROLE=$ROLE"
