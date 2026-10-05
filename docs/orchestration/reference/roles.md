# Roles: the manager, the hands, the workers (2026-10-05)

This page supersedes the coordinator sections of `ORCHESTRATION.md` (Hermes Responsibilities,
Wake-Up Loop): those describe Hermes driving every worker by hand, which is no longer the design.

## The rule

**Hermes manages; it does not do the work.** It knows what is happening, keeps every piece running and
calls the hand that fixes a problem. The only thing it writes is specs and issues.
**The dispatcher flows on its own.** If Hermes is slow or gone, workers still start, settle, get
verdicts and merge. Hermes is the guard of the flow, not a step in it.

## Who is who

| Layer | Who | Does | Never |
|---|---|---|---|
| Manager | Hermes (LLM) | reads events, decides, calls a hand, writes specs/issues, reports to the user | write code, commit, push, merge, start or stop a worker by hand |
| Hands | scripts in `tools/orchestration/` | one deterministic job each | decide |
| Workers | OpenCode via Orca (`worker.sh`) | Coder, Reviewer, Tester, Fixer | know about each other |

Hands in the live path: `dispatch.sh` (start/poll/close/record), `worker.sh` (one worker through Orca),
`specgen.sh` + `needs.sh` (what is owed), `close.sh` (merge what the gate passed), `verdict-post.sh`
(post a verdict), `prep-tester.sh` + `serve.sh` (Tester build/preview), `wait-capacity.sh` (memory).
Keep-alive: Task Scheduler -> `bootstrap.sh` -> `launch-dispatcher.sh`, every 5 minutes.

## Events

`dispatch.sh` appends one line per event to `$LOCALAPPDATA/orca-orchestration/design-system-viewer/events.log`:
`<UTC time> <kind> key=value ...`.

| Kind | Meaning |
|---|---|
| `up` | dispatcher started |
| `started`, `finished` | a worker started / settled (routine, never wakes Hermes) |
| `kept` | a Coder/Fixer tree holds work that is not on the remote; it was NOT removed (`path=`) |
| `no-pr` | a Coder said succeeded but names no open PR |
| `no-push` | a Fixer's commit is not its PR's head |
| `unknown` | a worker's report had no readable status |
| `verdict-refused` | a Reviewer/Tester verdict could not be posted |
| `start-failed` | `worker.sh start` failed (not a refusal) |
| `start-refused` | a start was refused (memory/base/port); at most one per 30 min |
| `leftover` | a close could not be confirmed after 10 tries |
| `gave-up` | a spec failed on every attempt |

Hermes never reads Orca's mailbox for the dispatcher's Run: its terminal is fenced off it
(`check` answers `consumer_fenced`, measured 2026-10-05).

## How Hermes is woken

```
bash D:/code/dsv-dispatcher/tools/orchestration/hermes-watch.sh     # background, notify on completion
```

It exits (= wakes Hermes) with `WAKE events` + the attention lines, `WAKE dispatcher-dead` (no live
dispatcher for 10 min, i.e. the scheduled restart is failing), or `WAKE idle-with-work` (nothing live
or queued for 30 min while `needs.sh` lists work). With nothing to report it exits 3 after an hour.
Hermes acts, then runs it again. The exit is the wake because this host caps stdout pattern wakes at 8
per process (measured 2026-09-28).

## What Hermes does on each wake

| Wake | Hermes calls / does |
|---|---|
| `kept` | reads `git -C <path> status --short` and `git -C <path> log --oneline -3 --not --remotes`, reports to the user. Delivery (commit/push/PR of kept work) has no hand yet: the user decides |
| `no-pr` | if a `kept` line names the same dispatch, as above; otherwise nothing: `needs.sh` re-queues the issue after `RETRY_TTL` |
| `no-push`, `unknown` | reads `report-<task>.txt`; reports if the same spec repeats |
| `verdict-refused` | reads the `dispatch: verdict:` lines in `dispatch.log` and `report-<task>.txt`; reports the reason |
| `start-failed` | reads the tail of `done/<spec>.start-failed`; reports |
| `start-refused` | reads `dispatch.sh --status`; reports if the host stays full |
| `leftover` | calls `bash tools/orchestration/worker.sh close <dispatch> --stop` once; reports the result |
| `gave-up` | reports the spec and its last outcome to the user |
| `dispatcher-dead` | calls `bash "$LOCALAPPDATA/orca-orchestration/design-system-viewer/bootstrap.sh" D:/code/dsv-dispatcher D:/code/design-system-viewer`; reports the launcher log |
| `idle-with-work` | runs `dispatch.sh --status` and `needs.sh`; reports why the owed work is not queued |
| heartbeat (exit 3) | nothing; runs the watcher again |

Specs and issues are the only things Hermes writes: splitting an issue, labelling `held`/`umbrella`,
answering what a card means. A worker cannot ask Hermes anything (questions are denied; `reply` on
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

## Merging

`close.sh` merges a PR only when the gate passed with a Reviewer and a Tester. A PR that changes
nothing under `app/src` (tooling, docs) gets "gate not applicable" and is **not** merged by
`close.sh`; it is merged by hand after it is verified on the host.

## Open decisions

- Who delivers a Coder's work: the model (it did with `deepseek-v4.1-flash`; `muse-spark-1.3` wrote
  the code but committed once in nine and never pushed) or a dispatcher hand.
- The legacy scripts (`spawn.sh`, `start.sh`, `settle.sh`, `handle.sh`, `supervise.sh`,
  `watch-settlements.sh`, `stall-check.sh`, `lib/reconcile.py` and their helpers) are called by nothing
  live: archive or delete.
