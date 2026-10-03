# Dispatcher (worker.sh + dispatch.sh)

The pipeline's control plane. No model decides anything in it. Hermes writes spec text into a
queue. The dispatcher starts those specs one at a time, waits each one out, closes it, posts its
verdict and merges what the gate passed.

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
| `running.env` | the one live dispatch; a pass finishes it before starting anything (restart-safe) |
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

`close.sh` runs every `CLOSE_EVERY` seconds (300) while no worker is running. It runs with
`--dry-run` while `dispatch.enabled` is absent. Its merges are pinned with `--match-head-commit`.
