# Dispatcher (worker.sh + dispatch.sh)

Roles and events: see `roles.md` (the dispatcher is a hand; Hermes manages).

The pipeline's control plane. No model decides anything in it. Hermes writes spec text into a
queue. The dispatcher starts every spec that nothing real blocks, polls the live workers, closes
each one when it settles, posts its verdict and merges what the gate passed.

## Parallel workers and models (2026-10-05)

There is no slot and no "one at a time". A queued spec starts unless something real holds it:

| Limit | Default | Why |
|---|---|---|
| free memory (`WATCH_MIN_MB`) | 600 MB | `worker.sh start` refuses (rc 3) and the spec stays queued; one `start-refused` event per 30 min |
| a Tester's `serve:` port in use | - | specgen gives each PR its own port (`8600 + pr % 100`) |
| a Coder on the same issue / a Fixer on the same PR | - | two writers on one branch collide |
| `DISPATCH_MAX` live workers | 0 (none) | optional manual ceiling; memory decides (next row) |
| memory a start needs | `WORKER_MB` (1500) + growth still owed by live workers (live x `WORKER_MB` - what opencode holds); `WATCH_MIN_MB` when none is live | measured 2026-10-05: a worker starts small and grows to 1.2-1.6 GB, so free memory at start time let 5-6 workers in and bash could not fork |
| `MODEL_CAP_<model>` live workers on one model | 0 (none) | set only from a measured quota |

A blocked spec never holds the ones behind it: the queue is walked in name order and each ready spec starts.
Live workers are read with ONE `orca orchestration worker-list --run <Run>` per pass (`workers.now`);
a worker missing from it falls back to `worker.sh wait --poll 10`.

Models are set per role in `roles/*.opencode.json` and can be overridden per spec with `model:`:

| Role | Model | Why |
|---|---|---|
| Coder, Fixer | `muse-spark-1.3-contributor` | writes the change well (2026-10-05: nine Coders reproduced, fixed and tested); it skips commit/push/PR, which the dispatcher now does (`deliver`, roles.md) |
| Reviewer | `deepseek-v4-pro` | a different family confirms the work; its verdict reached the gate on #231 |
| Tester | `deepseek-v4.1-flash` | runs commands and observes; proven on this repo |

Each result in `done/` carries `MODEL=`, so success per role and model can be counted.

## Who does what

| Part | Does | Never does |
|---|---|---|
| `needs.sh` | Computes from GitHub what each `agent` issue and open PR needs next | start, post, label |
| Hermes | Turns one `needs.sh` line into one spec file in the queue | start workers, post verdicts, merge, edit `tools/orchestration` |
| `dispatch.sh` | Runs the queue: start, wait, close, retry, post verdict, `close.sh` | choose what work exists |
| `worker.sh` | One worker through Orca's own lifecycle | touch a worktree without its owner marker |
| workers | The spec. Reviewer/Tester report their verdict in `worker_done` | post to the PR (their config cannot) |

## Why Orca's own lifecycle (measured 2026-10-03, Orca 1.4.217)

- **The old path leaked terminals.** `spawn.sh` opened the terminal itself and passed `--terminal`.
  Orca therefore recorded every dispatch as `ownershipState: external`, and release never closes an
  external terminal.
- **The new path does not.** `worker.sh` runs `orca worktree create`, then writes the role's
  `opencode.json`, then runs `worker-start --agent opencode` with no `--terminal`. The result:
  - the terminal is `owned`;
  - liveness reads `live/agent_status`;
  - the worker runs the pinned OpenCode Go model;
  - `worker_done` settles the dispatch;
  - release answers `released/closed_agent_terminal`.
- **`--worktree new-child` is not used.** It starts the agent before `opencode.json` can be
  written, so the worker ran the default model.
- **Release comes first, `worktree rm` second.** The reverse order left the release at
  `release_unknown`.
- **`worker-start` is fenced** to the terminal bound to the Run (`consumer_fenced`). The dispatcher
  therefore runs in that terminal.

## The queue

Location: `%LOCALAPPDATA%\orca-orchestration\design-system-viewer\queue\`. One file per worker,
started in name order (`010-…`, `020-…`). Each file is a header, a `---` line, then the filled
template from `docs/orchestration/specs/<role>.md`:

```
name: tester-163d
base: origin/ernem22/coder-117
role: tester
title: Tester PR #163 @ e0f1d44
pr: 163
head: e0f1d44
serve: 8614
deadline: 3600
---
<the filled tester template>
```

Header fields:

- **`role`** chooses the permission config:
  - `coder` and `fixer` get `roles/write.opencode.json`;
  - `reviewer` and `tester` get `roles/readonly.opencode.json`.
- **`base`** is the ref the worktree starts from:
  - the base branch for a coder;
  - the PR's head ref for reviewer, tester and fixer.
- **`serve`** applies to a tester only. `prep-tester.sh` builds the worktree and serves it on that
  port before the agent starts. The preview binds 127.0.0.1 and names its worktree on its command
  line, so `serve.sh --stop-worktree` can find it later.
- **`issue`, `pr` and `head`** are what `needs.sh` matches on. A need stays suppressed while a spec
  for the same role, ref and head exists in the queue, is active, or is done.

## State and results (all under the same directory)

| File | Meaning |
|---|---|
| `dispatch.enabled` | present: act; absent: every pass logs what it WOULD start (shadow mode, kill switch) |
| `running/<spec>.env` | one per live worker; every pass polls each (restart-safe). A legacy `running.env` is adopted |
| `active-<spec>` | the spec of the running worker |
| `done/<spec>.<outcome>` | spec + result footer; outcome is one of the values below |
| `report-<task>.txt` | the worker's own report, as handed to `verdict-post.sh` |
| `dispatch.log`, `worker.log` | narrative |

Possible outcomes in `done/`:

- `succeeded`
- `failed`
- `timeout`
- `exited`
- `agent_wait`
- `verdict-refused`
- `rejected`
- `start-failed`

Retries:

- A worker that did not settle by itself is retried on the same Orca Task with `--retry-of`, up to
  `DISPATCH_MAX_ATTEMPTS` (3). This covers `exited`, `timeout`, a prompt nobody answers, and
  `failed`.
- A start that `worker.sh` refused before creating anything (capacity, base ref, port) leaves the
  spec in the queue.

## Running it

From the terminal bound to the Run:

```
bash tools/orchestration/dispatch.sh            # loop; a second instance exits 0
bash tools/orchestration/dispatch.sh --status
bash tools/orchestration/needs.sh
```

`close.sh` runs every `CLOSE_EVERY` seconds (120) and right after a worker finishes. It runs with
`--dry-run` while `dispatch.enabled` is absent. Its merges are pinned with `--match-head-commit`.

## Keeping it alive (H-002)

- `install-dispatcher.ps1` registers a Task Scheduler entry, `dsv-dispatcher`. It runs at logon and
  every 5 minutes. Remove it with `-Uninstall`.
- The task runs `bootstrap.sh` from the state dir, a copy of `dispatcher-bootstrap.sh` kept outside
  every worktree. If the code tree is gone it re-creates it, detached at `origin/<base>`, then runs
  that tree's `launch-dispatcher.sh`. Measured 2026-10-04: the code tree vanished from git's worktree
  list while a Coder ran, and the launcher went with it.
- Write workers may not run `git worktree`, `orca worktree|terminal`, `orca orchestration
  worker-*|run-*` or a recursive `rm` (`roles/write.opencode.json`).
- The launcher does nothing while a dispatcher holds `dispatch.lock`. Otherwise it opens an Orca
  terminal titled `dsv-dispatcher` running `dispatch.sh --bind`.
- `--bind` takes the Run for that terminal with `run-use`. The Run id comes from
  `dispatch.run`; the first time, the dispatcher creates a fresh Run instead.
- Measured 2026-10-04: `run-use` from a second terminal takes the Run, and the old holder then reads
  `run-current = null` and gets `run_required`. After the cut-over, Hermes can no longer start
  workers.
- Installing the task is therefore the cut-over. Until then, run the dispatcher by hand from the
  coordinator terminal.
