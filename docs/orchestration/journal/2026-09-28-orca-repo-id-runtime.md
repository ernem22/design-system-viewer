# 2026-09-28 — The Orca repo id is resolved at runtime, not hard-coded

## Outcome
`spawn.sh`, `reap.sh` and `start.sh` no longer carry an Orca uuid. The repo id now comes
from `orca repo list --json` matched by `path` against the root checkout
(`tools/orchestration/repo-id.sh`, sourced by all four scripts that touch a worktree). An
id that cannot be resolved unambiguously stops the caller loudly instead of producing the
silent failure below. `start.sh` also stopped carrying a dead coordinator handle, and
`rebase.sh` stopped depending on a checkout that no longer exists.

## Problem
The three scripts held `REPO_ID="294b7f02-d29f-464f-a65c-f6929e0b8ae2"`. That folder was
re-imported into Orca on 2026-09-27 (`addedAt 1790552853818`, method
`imported-existing-folder`), and Orca now reports `9e918a40-bf6d-4981-9a8d-2a28e66d2586`
for that path. The old uuid is not in the registry at all — `orca repo show --repo
id:294b7f02-…` → `repo_not_found`.

Observed 2026-09-28, raw:

    $ bash tools/orchestration/spawn.sh reviewer-126 origin/feature/116-import-stepper --plan
    (exit 1, empty stdout)
    $ bash -x tools/orchestration/spawn.sh ...
    + orca worktree create --repo id:294b7f02-d29f-464f-a65c-f6929e0b8ae2 --name reviewer-126 ...
    + RAW='{"ok": false, "error": {"code": "repo_not_found", "message": "repo_not_found"}}'

`spawn.sh` parses that error object into an empty `PATH` and exits 1 with nothing on
stdout, so what the coordinator sees is "could not create the worktree" with no reason
attached. Every dispatch *and* every reap was dead for as long as the constant stayed
stale; it was found because the first dispatch of the 2026-09-28 cycle failed.

## Design
- One shared helper. `repo-id.sh` is sourced, never copied, so the lookup cannot drift
  between callers.
- Match by `path` against the ROOT checkout, resolved from `git rev-parse
  --path-format=absolute --git-common-dir` — that path is identical from any worktree of
  the repo, so the helper works from a child worktree too. Normalised for slashes and case.
- **Zero matches and more than one match are both hard errors.** Guessing would create a
  worktree in the wrong repository.
- `ORCA_REPO_ID` is an explicit operator override; there is deliberately no built-in
  default.
- `start.sh`: the coordinator handle is derived from `ORCA_TERMINAL_HANDLE` (measured set
  in this session's terminal) with `WATCH_FROM` as the override; neither set is a hard
  error, not a guess.
- `rebase.sh`: the git anchor is the checkout it is started from, and the worktree path
  comes from `spawn.sh --worktree-only`. Its old anchor,
  `<orca-workspaces>/design-system-viewer/proteus-5`, survives only as an archived
  directory with no `.git`, so `git -C` failed there and the "behind by N commits" line
  silently read 0.

## Verification
Raw output is on the PR: the helper resolving the id, then a throwaway
`spawn.sh … --worktree-only` creating a worktree and `reap.sh` removing it.

## Follow-ups
- The standing run id (`run_4e539259ab29`) is still a hard-coded default in `advance.sh`,
  `attention.sh`, `packet.sh`, `start.sh` and `watch.sh`. Every occurrence is overridable
  and it is the repo's standing Run, so it was left alone pending a decision on whether it
  should be derived from `orca orchestration run-current` instead.
- `/tmp` scratch paths remain in `attention.sh` and `rebase.sh`. Portable inside MSYS, but
  inconsistent with the `${LOCALAPPDATA}/Temp` convention the other scripts use.
- `serve.sh` prints "then: serve.sh --wait $PORT" for a `--wait` mode the script does not
  implement (pre-existing, unrelated to machine state).
