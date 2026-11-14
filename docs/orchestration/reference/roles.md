# Roles: the manager, the hands, the workers (2026-10-05)

Hermes's own manual - cold start, duties per wake, rules - is `ORCHESTRATION.md` at the repo root.
This page is the reference for the layers, the events and what the dispatcher does by itself.

## The rule

**Hermes manages; it does not do the work.** It knows what is happening, keeps every piece running and
calls the hand that fixes a problem. The only thing it writes is specs and issues.
**The dispatcher flows on its own.** If Hermes is slow or gone, workers still start, settle, get
verdicts and merge. Hermes is the guard of the flow, not a step in it.

## Who is who

| Layer | Who | Does | Never |
|---|---|---|---|
| Manager | Hermes (LLM) | cold start, reads events, judges what a script cannot (provider errors, new issues, stuck work), calls a hand (`model-switch.sh`, `dispatch.sh --pause`, `bootstrap.sh`), keeps the owner's test checklist, reports | write code, commit, push, merge, start or stop a worker by hand, edit a role file by hand |
| Hands | scripts in `tools/orchestration/` | one deterministic job each | decide |
| Workers | OpenCode via Orca (`worker.sh`) | Coder, Reviewer, Tester, Fixer | know about each other |

Hands in the live path: `dispatch.sh` (start/poll/close/record), `worker.sh` (one worker through Orca),
`specgen.sh` + `needs.sh` (what is owed), `close.sh` (merge what the gate passed), `verdict-post.sh`
(post a verdict), `prep-tester.sh` + `serve.sh` (Tester build/preview), `wait-capacity.sh` (memory).
Keep-alive: Task Scheduler -> `bootstrap.sh` -> `launch-dispatcher.sh`, every 5 minutes.

Stopping or switching the dispatcher's code: never `kill` it. A kill lands inside a pass (measured
2026-10-05: between coder-18's close and its PR). Instead, in `D:/code/dsv-dispatcher`:

1. check out the new commit;
2. run `bash tools/orchestration/dispatch.sh --stop`. It asks the dispatcher to exit between passes and waits; it prints `STOPPED`, or `STILL RUNNING` after 300 s;
3. after `STOPPED`, start the new code with `bootstrap.sh`, or let the next 5-minute tick do it.

## Events

`dispatch.sh` appends one line per event to `$LOCALAPPDATA/orca-orchestration/design-system-viewer/events.log`:
`<UTC time> <kind> key=value ...`.

| Kind | Meaning |
|---|---|
| `up` | dispatcher started |
| `stopped` | the dispatcher exited because `--stop` asked it to (routine) |
| `started`, `finished` | a worker started / settled (routine, never wakes Hermes) |
| `delivered` | the dispatcher committed/pushed a worker's left-over work (and opened the Coder's PR) (routine) |
| `kept` | a Coder/Fixer tree holds work that is not on the remote; it was NOT removed (`path=`) |
| `no-pr` | a Coder said succeeded but names no open PR |
| `no-push` | a Fixer's commit is not its PR's head |
| `unknown` | a worker's report had no readable status |
| `verdict-refused` | a Reviewer/Tester verdict could not be posted |
| `start-failed` | `worker.sh start` failed (not a refusal) |
| `start-refused` | a start was refused (memory/base/port); at most one per 30 min |
| `leftover` | a close could not be confirmed after 10 tries |
| `merge-refused` | `close.sh` found the gate green but GitHub refused the merge (CI red, protection) |
| `gave-up` | a spec failed on every attempt |
| `down` | the dispatcher exited (`rc=`; the reason line is in `dispatch.log`, bash's own error in `dispatch.err`) |
| `dropped` | a queued spec was no longer owed when its turn came (issue closed / not `agent` / held; PR head moved; spec cut short) and went to `done/<spec>.dropped` with `why=` (routine, never wakes Hermes) |
| `orphaned` | an `active-<spec>` had no running env (a start a dead dispatcher never finished); moved to `done/<spec>.orphaned`, its work is owed again |
| `disk-low` | the state/worktree drive has less than `DISK_MIN_MB` (2048) free; nothing starts; at most one per 30 min |
| `provider-error` | a worker's screen showed a provider-looking error (quota, rate limit, 401/402/403/429, billing); `model=`, `msg=`; the screen is in `tail-<task>.txt` |
| `merged` | `close.sh` merged a PR (`pr=`, `sha=`); the manager adds it to the owner's test checklist |
| `paused`, `resumed` | `dispatch.sh --pause "<reason>"` / `--resume`: new starts stop / restart (live workers and merges go on) |
| `model-switch` | `model-switch.sh` moved a role config to another model (`config=`, `from=`, `to=`) |

Hermes never reads Orca's mailbox for the dispatcher's Run: its terminal is fenced off it
(`check` answers `consumer_fenced`, measured 2026-10-05).

## How Hermes is woken, and what it does

`hermes-watch.sh` exits (= wakes Hermes) on an attention event, `dispatcher-dead`, `idle-with-work`,
`intake` (an `agent` issue without `intake-ok`) or `stuck` (2+ failed results on one PR/issue in 24 h);
with nothing to report it exits 3 after an hour. What Hermes does on each - and its cold start
(`hermes-start.sh`) - is in `ORCHESTRATION.md`, Duties.

What Hermes may change is listed in `ORCHESTRATION.md`, Rules. A worker cannot ask Hermes anything (questions are denied; `reply` on
the dispatcher's Run is fenced).

## Worktree closing (known trouble, kept in view)

Measured: terminals left open after a tree was removed; `release_unknown` / `retained` loops (#204);
the dispatcher's own tree removed (#208); eight Coders' finished work deleted with their trees
(2026-10-05). Orca lists the trees we create with `orca worktree create` as `user_owned` /
`retained` (`user_takeover`); only 4 live terminals existed while 11 records said retained, so those
records are bookkeeping, not leaks (measured 2026-10-05).

Rules in `worker.sh close`:
- release before removing the tree;
- only a tree carrying the `.dsv-worker` marker is ever removed;
- a Coder/Fixer tree with uncommitted paths or unpushed commits is **kept** (exit 7) and reported (`kept`);
- a close that cannot be confirmed 10 times is recorded and reported (`leftover`).

Open: `worker-start --worktree new-child` lets Orca create the tree itself, but OpenCode reads its
model from `opencode.json`, which must exist before the agent starts; a new-child started the agent
before that file existed (measured earlier). Not used until that is solved.

## Delivery (the dispatcher's, not the model's)

Committing, pushing and opening a PR are mechanical, so a hand does them. Measured 2026-10-05: a
Coder on `muse-spark-1.3` wrote and tested its change in nine trees, committed in one and pushed in
none, and the work was deleted with the trees. Now, when a Coder or Fixer settles `succeeded` and its
tree holds work that is not on the remote (`kept`), `dispatch.sh` `deliver`:

- skips it if the report says `blocked`, `failed` or `unreproducible` (the tree stays kept);
- sets the role's git identity (`identity.sh`), commits only `app/`, pushes;
- Coder: opens the PR (`[coder] <issue title> (#n)`, body = `Closes #n` + the worker's report);
- Fixer: pushes fast-forward onto the PR branch (never force);
- then closes the now clean tree. The PR is gated by the Reviewer and Tester like any other.

## Merge conflicts

`needs.sh` reads each open PR's `mergeable`. A `CONFLICTING` PR gets a Fixer whose spec is: merge the
base in (a merge commit, never rebase/force), keep both sides' intent, stop as `blocked` when one
intent must lose, test/lint/build, push fast-forward.

## Merging

`close.sh` merges a PR only when the gate passed with a Reviewer and a Tester. A PR that changes
nothing under `app/src` (tooling, docs) gets "gate not applicable" and is **not** merged by
`close.sh`; it is merged by hand after it is verified on the host.

## Open decisions

- The legacy scripts (`spawn.sh`, `start.sh`, `settle.sh`, `handle.sh`, `supervise.sh`,
  `watch-settlements.sh`, `stall-check.sh`, `lib/reconcile.py` and their helpers) are called by nothing
  live: archive or delete.
