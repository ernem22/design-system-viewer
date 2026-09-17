# Orchestration — Source of Truth

Hermes/Orca autonomous pipeline for this repository. Scope: `app/` (React +
TS, `refactor/full-react-migration` branch) only, unless a task explicitly
widens it. This document is the operational contract — Hermes reads it before
touching orchestration, and it is corrected in place, not duplicated, when
reality diverges from it.

## Objective

Hermes is a **control plane**, not a worker. It spawns, tracks, and retires
OpenCode workers through Orca; it never writes code, reviews code, or narrates
what a worker did. Every optimization in this doc exists to cut Hermes's own
token and tool-call cost without weakening the verified pipeline below.

## Current Verified Architecture

```
Hermes (coordinator) → Orca CLI (task-create, worker-start, check --wait) → OpenCode worker (child worktree)
```

No second orchestration layer. A prior `pipeline.py` (Python state machine
wrapping `orca` via subprocess) was built, found to duplicate Orca's own
task/dispatch state, and removed — do not recreate it or anything like it.
Every lifecycle action is a direct Orca CLI tool-call from the coordinator
turn.

**What that prohibition does and does not cover.** The banned thing is a
second store of *pipeline state* — task status, dispatch status, stage
position — because Orca already owns it and two copies drift. It does **not**
ban stateless mechanism: CI workflows, git hooks, and idempotent cleanup
scripts hold no state, cannot drift from Orca, and are the preferred way to
enforce an invariant. Prefer a machine check over a paragraph in this file
whenever the invariant is mechanically decidable; a rule that only exists as
prose is enforced by a model remembering to read it, which is the weakest
enforcement layer available. See Division of Labour.

Verified pipeline shape:

```
Task Creator / GitHub issue → Coder → CI gate → Reviewer → PR merge (Hermes)
                 ↑______________________________|
                 (failure at any stage → fresh worker, fallback model)
```

## Division of Labour: machine vs worker

The single most expensive past mistake in this pipeline was assigning
deterministic work to a free-tier model. A model dispatched to run `tsc` adds
a worktree, a terminal, a model resolution, a fallback chain, a nudge risk and
a token bill, and returns a verdict it is capable of misreporting. CI returns
the same verdict for free and cannot lie about it.

| Work | Owner | Why |
|---|---|---|
| `eslint`, `tsc -b`, `vite build`, `vitest run` | **CI** — `.github/workflows/pr-check.yml`, job/context `app` | Deterministic, machine-decidable, cannot misreport itself |
| Is the diff good code? Does it match what the issue asked? | **Reviewer** worker | Judgment; CI cannot do it |
| Does the changed UI actually behave correctly when running? | **Tester** worker — currently SUSPENDED, see Known Gaps | Judgment; but not executable on this repo yet |
| New tests covering new behaviour | **Coder**, in the same commit | Tester may not write tests, so nobody else can grow coverage |
| Merge decision and execution | **Hermes** | Control-plane action, explicitly in scope |

Consequences Hermes must honour:

- Never dispatch a worker whose entire job is running a command CI already
  runs. If a stage's whole output would be "the suite passed", delete the
  stage and read the check instead.
- Never advance or block a stage on a worker's *claim* about lint, types,
  build or unit tests. Those four facts come from `gh pr checks`, never from a
  `worker_done` body.
- A worker's `tests:` status line field is now advisory only — it records what
  the worker believed, and is not the gate.

## Hermes Responsibilities

- Create Orca Tasks with a scoped, self-contained spec (target, change,
  constraints, acceptance, output-line format).
- Create one child worktree per worker; write that worktree's `opencode.json`
  before starting the terminal.
- Start the worker terminal, wait for `tui-idle`, bind it with
  `orchestration worker-start`.
- Block on `orchestration check --wait` for the settlement message.
- Read the **structured status line** the worker returns (see Worker
  Communication Protocol) — nothing else.
- Decide: pass → advance stage; fail → fresh worker + fallback model (capped
  attempts); ambiguous → escalate to the user.
- Read the CI verdict from `gh pr checks` before merging; merge once the CI
  gate is green **and** Reviewer PASS is in hand.
- Release/close settled workers; clean up worktrees created for a
  since-finished or abandoned attempt.

## Hermes Forbidden Responsibilities

Hermes does **not**:

- Write or edit application code.
- Perform its own code review of a worker's diff (Reviewer's job).
- Re-run a worker's reasoning or "double-check" a PASS verdict by re-reading
  the full diff line-by-line.
- Read a worker's full terminal transcript or chain-of-thought once a
  structured status line has arrived (the bounded tail read below is not a
  transcript read).
- Re-summarize a worker's output back to the user in prose (report the
  structured line; expand only on explicit user request).
- Poll status in a tight loop (`check` without `--wait`, repeated).
- Re-inspect the repository (`git log`, `ls`, full-tree reads) once scope and
  branch are already established for the run.
- Guess or widen Task Creator's scope when it is ambiguous — escalate instead.
- Invent a second store of pipeline state that duplicates what
  `orca orchestration task-list` / `worker-list` already hold (see the
  architecture note on what this does and does not cover).

Two bounded exceptions, both O(1) and both in the per-worker call budget:

1. **Commit integrity check.** A single `git log -1 --format='%H %an <%ae> %s'`
   after a Coder/Fixer `worker_done`, before advancing. This catches the
   "worker lied about its outcome" class the structured protocol cannot
   self-report. Use `git log -1` / `git status --porcelain`, **not**
   `git diff --stat` alone: a worker that never committed can still print a
   `commit: <sha>` line by echoing the worktree's starting HEAD, and a diff
   against an untracked new file shows nothing, so it looks clean when it is
   not. Compare the reported SHA against the worktree's pre-dispatch HEAD —
   identical means no commit happened despite the claim. The same call also
   verifies author and role tag (see Commit Attribution).
2. **Rate-limit tail read.** One terminal tail read per dispatch, per the
   Model Assignment section. This is deliberately part of the budget, not a
   violation of the "no transcript reads" rule.

## Worker Roles & Responsibilities

| Role | Does | Does not |
|---|---|---|
| Task Creator | Inspects the **whole** of `app/` with no artificial restriction on task type — missing features, bugs, poor/duplicated code, weak test coverage, anything — and opens **one GitHub issue** for one small, independent, well-scoped task | Implement anything; write a local `NEXT_TASK.md`; narrow itself to one category (e.g. "tests only") unless the user explicitly asked for that category this run |
| Coder | Implements the task in its child worktree, **writes tests for the behaviour it adds** (see `app/` Facts), commits + pushes, opens the PR, flips the issue label | Rely on CI to decide whether its own change is correct; skip tests because "CI will catch it" — CI only runs tests that exist |
| Reviewer (`--agent plan`) | Read-only diff/code review against the issue's stated intent, returns PASS/FAIL + fix list | Edit any file; implement fixes; restate what CI already reports (lint/types/build/unit results are not review findings) |
| Tester | **SUSPENDED** — see Known Gaps. Contract when re-enabled: exercise the *running* app and confirm the issue's described behaviour actually happens, reporting the observed behaviour | Run `npm test`/`tsc` and report the counts — that is CI's job and never justified a worker dispatch; write, add or modify any file |
| Fixer | Applies exactly the fix Reviewer or a failing CI check reported, nothing else | Re-scope or re-design the change |

## `app/` Facts Workers Must Be Told

Repo-specific traps, verified 2026-09-18. Each Coder/Fixer Task spec must
carry the ones relevant to its change, because a worker that discovers them
by trial produces a silent false pass.

- **Commands are `--prefix app`.** Root `npm test` runs
  `src/core`/`src/server` only and root `npm run build` builds `preview/` —
  **neither touches `app/` at all**. The real commands are
  `npm --prefix app test`, `npm --prefix app run build`,
  `npm --prefix app run lint`. A worker running the root scripts gets a green
  result that proves nothing about its change.
- **A `.tsx` test file is silently ignored.** `app/vitest.config.ts` sets
  `include: ['src/**/*.test.ts']`, which does not match `*.test.tsx`. Verified
  by probe: a `.tsx` test whose body was `expect(1).toBe(2)` was not collected
  and the suite still exited 0. A Coder that names a component test
  `Component.test.tsx` produces a test that never runs, and both the Coder and
  CI report green.
- **Test environment is `node`, not a DOM.** Same config. DOM-dependent tests
  must construct their own environment.
- **The established pattern for testing a hook/component** is
  `app/src/lib/toasts.test.ts`: a `.ts` file, `createElement` instead of JSX,
  a hand-built `happy-dom` `Window`, and `react-dom/client` imported lazily so
  it never sees a document-less module scope. `@testing-library/react` is
  **not** a dependency. Point Coders at that file as the template rather than
  letting them invent an approach.
- Current coverage, for calibration: 4 test files / 34 tests, all in
  `src/lib/`, against 103 `.ts`/`.tsx` source files. There are zero component
  tests. Treat "add a test" tasks as genuinely valuable, not as busywork.

## Model Assignment & Fallback

Verified working IDs (via `opencode models` on this host and live
`opencode debug config` resolution):

| Role | Primary | Fallback |
|---|---|---|
| Coder | `opencode/muse-spark-1.3-contributor-free` | `openrouter/nex-agi/nex-n2.5-mini:free` |
| Reviewer | `opencode/nemotron-3-ultra-free` | `opencode/nemotron-3.5-lightning-free` |
| Fixer | `opencode/muse-spark-1.3-contributor-free` | `openrouter/nex-agi/nex-n2.5-mini:free` |
| Task Creator | `opencode/nemotron-3-ultra-free` | `openrouter/openrouter/free` |

`openrouter/nex-agi/nex-n2.5-pro:free` was the original Coder primary but was
demoted after hitting OpenRouter's daily free-tier cap mid-run
(`Rate limit exceeded: free-models-per-day`) — not banned, just no longer the
default; use it only if the user asks or if every other free-tier option here
is also capped that day.

**One fallback is shared by three roles.** `nex-n2.5-mini:free` backs Coder,
Tester and Fixer. If the daily cap is per-account, a single rate-limit event
exhausts all three fallbacks at once, and per-dispatch fallback logic will
walk into the same wall three times. So: once a model emits the rate-limit
string, treat it as **exhausted for the remainder of the session** and skip it
in every later fallback decision — do not re-select it and re-discover the cap
per dispatch. This is run-scoped ephemeral state held in-turn, not a persisted
ledger.

**Rate-limit detection (every dispatch, not just on failure).** Before
trusting a `worker_done`, and immediately on any suspiciously fast or empty
settlement, read the terminal tail **once**. A rate-limited model prints its
cap message into the OpenCode transcript (verified form:
`Rate limit exceeded: <bucket-name>. Add N credits to unlock ...`) rather than
failing the dispatch cleanly. That string anywhere in the tail is an automatic
hard failure for the dispatch, equivalent to `worker_done outcome: failed` —
apply the Failure & Recovery Policy and mark the model exhausted. Abandon such
a dispatch immediately; do not wait out the remaining `check --wait`. No
`opencode`/Orca API reports remaining daily quota ahead of time; this
transcript string, appearing only after the model has already failed a
request, is the sole detection mechanism.

Model selection mechanism (verified; see the `orca-opencode-worker-pipelines`
skill for the exact command sequence and edge cases):

1. `orca worktree create` the child worktree first.
2. Write **project-level** `<worktree>/opencode.json` with `{"model": "<id>"}`
   — this overrides the user's global OpenCode config. Never pass
   `orca worker-start --model` for an `opencode` agent; it is rejected
   (`Agent opencode does not support launch-time model selection`).
3. Start the terminal with a bare `opencode` command.
4. Verify the model actually resolved — `opencode debug config` and/or the
   terminal header — before trusting the dispatch. Skip this for a
   role/model pairing already verified working in this run; re-verify after a
   config change, a new role, or an unexpected terminal header.

A garbled or invalid `opencode.json` model ID does **not** error cleanly:
OpenCode silently substitutes a different model and the worker can hang.
Detect it by the terminal header (`Build · <model>`) showing the wrong name,
never by waiting for an error.

## Dispatch Sequence & Call Budget

Fixed per-worker sequence, and the whole budget outside of fallback:

```
worktree create → terminal create → terminal wait (tui-idle) → worker-start
  → check --wait → [tail read] → [integrity check] → worker-release
```

- 5 Orca calls + 1 release, plus the two bounded reads from Hermes Forbidden
  Responsibilities. No polling loop.
- One `check --wait` per attempt. If the client-side subprocess wait times out
  before Orca's own wait resolves, re-issue a single **non-blocking** `check`
  (no `--wait`) — Orca replays the durably queued settlement, nothing is lost,
  and no new worker-side work happened.
- Consume only the structured status line of a `worker_done`/`escalation`. Read
  further into `body` only when it signals `failed` and a fix Task needs
  writing.
- Never call `worker-read`/terminal-read for a worker that already produced
  `worker_done` — that message *is* the report. The bounded tail read above is
  a separate, budgeted call, not a licence to read transcripts.
- Batch independent read-only calls (e.g. `worker-list` + `task-list`) into one
  turn. Do not fetch one, decide you need the other, and fetch it next turn.
- Do not re-run `git log`, `worktree list`, or repo-wide scans mid-run once the
  target branch/worktree is established; carry IDs forward in-turn.
- Do not restate a worker's PASS/FAIL back to the user in expanded prose during
  the run — accumulate, report once at pipeline end or on failure.

## Task Lifecycle

```
created → coding → ci → review → pr → merging → completed
```

Failure transitions:

```
ci_failed     → fixing → ci
review_failed → fixing → review
merge_failed  → fixing → pr
```

A stage advances only on a structured PASS/succeeded signal or a green CI
check; never on Hermes's own inference from partial output.

## Issue-Label State Machine (parallel-safe)

The durable backlog is **GitHub Issues**, not Orca's `task-list` — Orca Tasks
are per-dispatch plumbing. Coordination across parallel dispatches happens
through issue labels, so Hermes does not have to hold every stage of every
issue in one turn's context.

```
(open, unlabeled agent work)
  → Coder claims it (comment + `in-progress`), implements, pushes,
    opens PR with "Closes #<n>", swaps label to `needs-review`
  → CI runs automatically on the PR — no dispatch, no label
  → Hermes scans `--label needs-review`; if CI is green, dispatches a Reviewer
    against that PR branch; if CI is red, dispatches a Fixer with the failing
    output instead and leaves the label alone
  → Reviewer PASS → Hermes merges (see Merge Policy), then **explicitly closes
    the issue** — `gh issue close <n>`
  → Reviewer FAIL → Hermes creates a Fixer Task referencing the PR/issue and
    leaves the label at `needs-review` so it re-enters the queue after the
    Fixer pushes
```

**`Closes #<n>` does not close anything in this pipeline.** GitHub auto-closes
a linked issue only when the PR merges into the repository's **default
branch**. This repo's default is `main`, and every pipeline PR merges into
`refactor/full-react-migration`, so the link never fires. Verified: PRs #44,
#45 and #46 each carry `Closes #15` / `Closes #21` / `Closes #23`, all three
merged, and all three issues are still open and still labelled `needs-test`.

Consequences Hermes must honour:

- Closing the issue after a merge is **Hermes's explicit step**, not a
  side-effect. Keep `Closes #<n>` in the PR body for traceability, but treat
  `gh issue close <n>` as part of the merge action.
- The open-issue backlog is therefore only as accurate as that step. A
  permanently-inflated backlog silently disables the "skip Task Creator when
  unclaimed issues exist" rule, because completed work still looks unclaimed.

Labels in use: `needs-review`, `in-progress`. Check `gh label list` and create
missing ones once with `gh label create <name> --color <hex>`.

**`needs-test` is retired, but must be drained, not deleted.** Four issues
(#41, #23, #21, #15) still carry it from the Tester-stage era, where it meant
"Reviewer already passed, awaiting Tester". Under this document Hermes scans
only `needs-review`, so those four would be orphaned. Drain each one before
removing the label from the repo: find the PR that references it; if that PR
is already merged, the work is done and the issue only needs
`gh issue close <n>`; if no PR exists or it is still open, strip `needs-test`
and put the issue back to `needs-review` (or unlabeled, if no Coder has
claimed it) so it re-enters the normal queue. If the Tester role is ever
re-enabled (Known Gaps), use a fresh `needs-verify` label rather than reviving
`needs-test`, whose old meaning was "run the suite".

**The Coder — not Hermes — flips its own labels**, because the Coder is what
knows its PR is ready. Encode the exact
`gh issue edit <n> --add-label needs-review --remove-label in-progress` in
every Coder/Fixer Task spec, immediately after the push step. Hermes scans for
labels and dispatches the next role; it does not flip a label a worker owned,
except as a corrective action when a `worker_done` claims the flip and the
label is verifiably still missing.

**Parallel dispatch is expected.** Hermes may have several Coder/Reviewer/Fixer
worktrees in flight against different issues at once. Each still follows the
fixed per-worker budget; running several budgets concurrently is the intended
way to keep throughput up. Route each settlement to its own next stage
independently — do not serialize to one issue at a time once more than one has
entered the pipeline.

**Task Creator is not mandatory every cycle.** Before dispatching one, run
`gh issue list --state open --label agent` once. If an open, unclaimed issue
exists, skip Task Creator and dispatch a Coder directly against it (its number,
title and body become the Coder Task's spec). Only dispatch a fresh Task
Creator when that backlog is empty — there is no value in generating more
proposals while dozens sit open. An Orca Task whose spec merely says `MISSING`
or targets a since-superseded local file is a stale-worktree artifact, not
backlog; recognize and ignore it.

## Failure & Recovery Policy

1. A dispatch has failed when any of these holds: `worker_done outcome:
   failed`; an `escalation` message; the rate-limit string in the tail; or a
   **stall**.
2. **Stall definition (concrete).** Two terminal reads at least 90 seconds
   apart return an identical tail, with no settlement and no active spinner or
   tool call. One read never proves a stall. 90s is a chosen default, not a
   measured optimum — adjust it if a legitimately slow model trips it.
3. Start a **fresh** child worktree + terminal with the fallback model's
   `opencode.json`. Do not reuse the failed worktree or terminal.
4. Re-dispatch the **same Task ID** with plain `orchestration worker-start`
   (no `--retry-of`). This works because the Task is normally still
   `status: ready` after one dispatch failure.
5. `--retry-of <dispatch_id>` is **not** interchangeable with step 4. It was
   tested and rejected (`task_not_startable`) with the Task still `ready` after
   a single failed dispatch — Orca requires the Task itself to be
   `failed`/`blocked` first. It is an escalation-tier action for a Task Orca's
   own circuit breaker has given up on, not a per-attempt tool.
6. Cap at 3 attempts per Task; after that Orca's own dispatch circuit breaker
   marks the Task `failed`. Do not layer a second retry counter on top. At that
   point escalate to the user; do not keep retrying.
7. Never re-run a worker that already succeeded "to compare" or "to be sure."

## Worker Communication Protocol

Every worker's `worker_done`/`escalation` must lead with a **structured status
line** as its first line, machine-parseable, before any prose. Hermes reads
only this line to decide the transition; prose after it is a human audit trail
and is not re-read.

```
status: succeeded | failed
role: coder | reviewer | fixer | task_creator
task: <task_id>
commit: <sha | none>
tests: pass | fail | n/a      # advisory only — CI is the gate
```

Reviewer:

```
status: pass | fail
reason: <short reason, only if fail>
fix_required: <short actionable instruction, only if fail>
```

Failure:

```
status: failed
role: <role>
reason: <short structured reason>
retryable: true | false
```

Encode this format directly in each Task's spec ("OBSERVABLE ACCEPTANCE" /
"OUTPUT" clause) — it is the contract, not a suggestion.

**Known gap: models that finish without settling.** `--agent plan` (Reviewer)
does not automatically send `worker_done` when it stops talking. This is not
plan-mode-specific: Nemotron-family models (`nemotron-3-ultra-free`,
`nemotron-3.5-lightning-free`) in **any** role have repeatedly finished, printed
their verdict in the transcript, and simply stopped without calling
`orchestration send --type worker_done` — observed on Task Creator and Reviewer
dispatches alike.

**Automatic nudge policy — do this without asking the user.** After **two
consecutive** full `check --wait` timeouts with no message, read the terminal
once (`terminal read --screen`). If the tail shows a final answer already
produced and the worker sitting idle (no spinner, prompt bar visible, no active
tool call), send the nudge immediately:

```
orchestration send --to dispatch:<id> --subject "send worker_done" \
  --body "You must now run: orca orchestration send --from <terminal_handle> \
  --dispatch-capability worker --type worker_done --subject ... --body ... \
  --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded"
```

Then resume `check --wait`. Do not wait for a third timeout and do not ask
permission — this is routine dispatch housekeeping. If the terminal shows work
in progress, keep waiting; the nudge is only for an idle-but-unsettled worker.
Record the run's `check --wait` timeout value once at run start so "two
consecutive timeouts" is a concrete duration rather than a feeling.

## Commit Attribution

Every worker commit must make its role machine-obvious and must not carry the
worker's model or personal identity.

- **Message**: prefix the subject with the role tag —
  `[coder] test(app): add useToasts hook tests`,
  `[fixer] fix(app): satisfy tsc for toasts.test.ts mountProbe container`,
  `[task_creator] docs: open issue for cycle N`. Valid tags: `[task_creator]`,
  `[coder]`, `[reviewer]`, `[tester]`, `[fixer]`. Encode this in every Task
  spec's commit instruction; it is not left to the worker's judgment.
- **Author**: set `git config --worktree user.name`/`user.email` in each
  worker's worktree before it commits (or instruct the worker to do so as its
  first step) to a fixed role identity — `orca-coder
  <orca-coder@localhost>`, `orca-fixer <orca-fixer@localhost>` — never
  `ernem22`, never a model name.
- **Use `--worktree`, never bare `git config user.name`.** Bare is `--local`
  and lives in the shared `.git/config` that every worktree of the repo reads,
  so setting it in one worktree silently overwrites the identity every other
  worktree sees, including the coordinator's. Requires
  `git config extensions.worktreeConfig true` once per repo — durable repo
  state, checked once at run start (currently `true`).
- **Coordinator commits use the real human identity** (`ernem22`), not a
  synthetic `orca-orchestrator`. Hermes editing this file or a workflow is not
  an anonymous worker; only dispatched worker roles get `orca-<role>`.
- **Verify** with the same call as the integrity check:
  `git log -1 --format='%an <%ae> %s'`. A wrong author or missing role tag is a
  policy violation even when the SHA is real and CI is green. Pre-merge, fix it
  (`git commit --amend --author="orca-<role> <orca-<role>@localhost>" --no-edit
  && git push --force-with-lease`) rather than leaving it wrong. If already
  merged with work stacked on top, leave history alone and get it right going
  forward.

This rule is currently prose-enforced and is **already violated in merged
history** — PR #42 landed as `test(app): add useToasts hook tests` from head
branch `ernem22/fixer-1` with no `[fixer]` tag. A `commit-msg` hook checking
the subject against the tag list would make the rule mechanical; see Known
Gaps.

## Merge Policy

- The CI gate is `.github/workflows/pr-check.yml`, job/context **`app`**,
  running `npm run lint`, `npm run build` (`tsc -b && vite build`) and
  `npm test` inside `app/`. Every step runs even when an earlier one fails, so
  one run yields the complete fix list for a Fixer instead of one error at a
  time. Added 2026-09-18 (commits `d73f482`, `2982eec`); all three commands
  verified green locally at that point.
- The job's `name: app` **is** the required-status-check context string.
  Verified on PR #47: `gh pr checks` reports the context as `app`. Renaming the
  job silently un-gates the branch.
- The workflow only has to exist on the **base** branch. A `pull_request` event
  evaluates workflows from the PR's merge ref (base + head), so a Coder branch
  cut before the workflow landed is still checked — verified on PR #48, whose
  head predates `pr-check.yml` and was checked anyway. Do not rebase an
  in-flight branch just to pick up a CI change.
- PR opens after the Coder pushes. Merge requires **CI green** (`gh pr checks
  <pr>`) **and Reviewer PASS**. Both, always.
- Use `gh pr merge --squash --auto`. Auto-merge is enabled on this repo, so
  GitHub merges the PR itself the moment the `app` check goes green and Hermes
  does not block waiting for it. Only fall back to
  `gh pr checks <pr> --watch` + `gh pr merge --squash` if `--auto` is refused.
- `delete_branch_on_merge` is enabled, so the merged head branch is deleted
  automatically. The explicit remote-branch deletion in the cleanup checklist
  is now only needed for branches abandoned without a merge.
- Squash-merge unless the repo's convention says otherwise. All merged PRs base
  onto `refactor/full-react-migration`.
- After the merge, `gh issue close <n>` for the issue the PR resolves. GitHub
  will not do it — see the Issue-Label State Machine.
- Coder/Fixer must commit **and push** — Reviewer worktrees cannot see
  uncommitted changes in a sibling worktree, and `--base-branch` off a branch
  with only uncommitted work silently falls back to that branch's last real
  commit.
- Hermes performs the merge directly; this is a control-plane decision,
  explicitly in scope.

## Continuous Operation Mode

Once started, Hermes runs cycles **back-to-back without stopping for
confirmation** — issue/Task Creator → Coder → CI → Reviewer → (Fixer if
needed) → merge → next cycle — until either the user says stop, or `app/`'s
migration is judged complete (Task Creator reports nothing worth doing, or the
user says the goal is met).

Do not pause after a successful merge to ask "should I continue?" Do not
narrate each cycle. Surface to the user only on a failure or escalation that
needs a real decision, on a genuine blocker (capability gap, ambiguous scope
this document does not resolve), or when stopping. A healthy running pipeline
produces no chat output between cycles — this document and the PR history are
the audit trail, not a running commentary.

## Scope Control

Task Creator's spec must state the top-level scope boundary explicitly and
literally ("app/ only, not src/core, not preview/"). An unscoped "find
something small and independent" lets the model pick the wrong directory.

**Directory scope is the only boundary Hermes may impose.** Do not also
constrain *what kind* of task Task Creator proposes ("tests only", "avoid
recently-touched files") unless the user asked for that category this run.
Give Task Creator the full directory, let it inspect everything in scope —
missing features, bugs, duplicated code, weak abstractions, missing tests —
and let it choose on its own judgment.

## State & Context Management

- **Durable state** (lives in Orca/GitHub, not in Hermes's context): Run ID,
  Task IDs, dispatch IDs, worktree IDs/paths, task status, issue labels.
  Re-fetch from `orca orchestration task-list --run <id>` / `worker-list --run
  <id>` / `gh issue list` when a new coordinator turn needs them. Do not ask
  the user to repeat them and do not keep a parallel note.
- **Ephemeral runtime state** (fine to hold in-turn, discard after): terminal
  tail excerpts used to diagnose a stall, verification output
  (`opencode debug config`, `git log -1`), the session's exhausted-model set.
- Do not persist either kind in a bespoke file or DB.

## Safety / Guardrails

- Never write directly to the coordinator/main worktree — all Coder/Fixer work
  happens in a dedicated child worktree. Coordinator-owned infrastructure
  (this file, workflows) is the exception and uses the human identity.
- **Nothing reaches the base branch except through a PR, including this file.**
  `enforce_admins: true` means required checks apply to admins too, so a direct
  `git push` to `refactor/full-react-migration` is rejected — a pushed commit
  has no check run on it yet.

  Status of that last claim: it follows from GitHub's documented behaviour for
  required status checks under `enforce_admins`, and it is **not empirically
  verified here** — deliberately. Two ways of checking it both fail on purpose.
  `git push --dry-run` reports the ref update it would make without consulting
  the server's protection hook, so it prints a success line either way and
  settles nothing; one was run and it proved nothing in either direction. And
  an actual direct push *is* an attempt to bypass the CI gate — not something
  to do to satisfy curiosity. Treat the rule as binding, route everything
  through a PR, and if a direct push ever does land, record it here as a
  finding — discovered by accident, not by trying. Coordinator infrastructure edits therefore take
  the same route as app changes: branch, push, PR, green `app` check, squash
  merge. This is a deliberate cost of making the gate binding, not an
  oversight.
- Never delete or reset uncommitted work in a worktree Hermes did not create
  for this run.
- Never fabricate a model ID, a test result, or a "verified" claim. Every
  "verified" in this document was observed as command output, a terminal
  header, or a re-run result. Anything else is labeled `assumed`.

## Cleanup Checklist

Before dispatching any worker:

- [ ] Task spec states target, change, constraints, the relevant `app/` Facts,
      and the structured output-line format.
- [ ] Child worktree created from the correct base branch (one `git log -1` in
      the new worktree for the run's first worker on that branch; skip after).
- [ ] `opencode.json` written with the role's primary model, and that model is
      not in the session's exhausted set.
- [ ] Terminal started, `tui-idle` reached, `worker-start` bound.

Before advancing a stage:

- [ ] Settlement message received with a structured status line.
- [ ] For a Coder/Fixer: integrity check done (SHA differs from pre-dispatch
      HEAD, author is `orca-<role>`, subject carries the role tag).
- [ ] `status: succeeded`/`pass` → advance. `failed` → fallback per policy.
      Ambiguous → escalate, do not guess.
- [ ] **`worker-release` called for every settled dispatch, in the same batch
      as the ack and integrity check** — before starting the next stage's
      worktree. "Ack the settlement" and "release the dispatch" are one atomic
      pair, not two independently-optional steps.

Cleanup is three distinct steps, not one:

- [ ] `worker-release` the dispatch.
- [ ] Close its terminal.
- [ ] `orca worktree rm --worktree "id:<repo>::<path>" --force` once no
      downstream worktree still needs that worktree's uncommitted state —
      i.e. its work is pushed and every next-stage worktree was created from
      the pushed commit. Releasing and closing do **not** remove the worktree
      from disk.
- [ ] If the `worktree rm` result includes `preservedBranch`, git refused to
      delete the branch. **Do not use an ancestry or SHA comparison to decide
      whether it is safe to delete** — this pipeline squash-merges, so the
      merge commit on the base branch is a brand-new SHA and the branch's own
      commit is never an ancestor of it. `git log -1 <branch>` vs
      `origin/<branch>` therefore *never* matches after a squash merge, and a
      rule built on it would preserve every branch forever. Ask the question
      that actually matters instead: is the PR for this branch merged?

      ```
      gh pr list --head <branch> --state merged --json number,mergedAt
      ```

      A merged PR means the content landed regardless of SHA — then
      `git branch -D <branch>` (force, because `-d` applies the same
      ancestry test and will refuse) and
      `git push origin --delete <branch>`.
- [ ] **Delete the remote branch too.** `gh pr merge --delete-branch` does not
      always get there: it deletes the remote branch *after* trying to switch
      the local checkout, and in a worktree setup that switch fails
      (`'<base>' is already checked out at ...`), taking the branch deletion
      down with it. Verified on PR #47. When that happens the merge itself has
      still succeeded — check `gh pr view <n> --json state` before treating it
      as a failure — and the remote branch needs an explicit
      `git push origin --delete <branch>`.
- [ ] This has already been missed for a while: `ernem22/coder-1`,
      `coder-2b`, `coder-3`, `coder-4`, `coder-5`, `fixer-1`,
      `app-coder-9d668e`, `fix-isref-nullish` and three `issue-*` branches are
      all still on the remote from earlier cycles. Drain them the same way —
      merged PR → delete; no PR → leave it and ask.

## Failure Ledger

Incidents already paid for. Each is a rule above; this table is the index so
the rules do not have to carry their narrative.

| Symptom observed | Rule it produced |
|---|---|
| `pipeline.py` duplicated Orca's task/dispatch state | No second state layer; stateless mechanism is fine |
| Worker reported `commit: <sha>` having never committed; `git diff --stat` looked clean because the file was untracked | Integrity check via `git log -1`, compare against pre-dispatch HEAD |
| `--retry-of` rejected `task_not_startable` on a still-`ready` Task | Plain re-dispatch on the same Task ID is the first-line fallback |
| `nex-n2.5-pro:free` hit `free-models-per-day` mid-run | Rate-limit tail read every dispatch; model demoted; exhausted-for-session set |
| Nemotron models finished, printed a verdict, never sent `worker_done` | Automatic nudge after two consecutive timeouts |
| Unscoped Task Creator picked `src/core` when the user meant `app/` | Scope boundary stated literally in every spec |
| Hermes added an unrequested "avoid recently-touched files" constraint; Task Creator then picked the lowest-risk task | Directory scope is the only boundary Hermes may impose |
| Bare `git config user.name` in one worktree overwrote every worktree's identity; a Coder commit landed as the coordinator | `--worktree` scope always; `extensions.worktreeConfig true` |
| Dispatch settled and next stage started, but `worker-release` never called — terminal leaked | Ack and release are one atomic pair |
| Worktree left on disk after release + terminal close | `worktree rm` is a separate third step |
| `worktree rm` preserved `ernem22/coder-3` and `coder-5` branches | Check `preservedBranch`, then decide by merged-PR state, not by SHA ancestry |
| Squash merge made the branch's commit a non-ancestor, so an ancestry check said "unique commits, do not delete" for fully-merged work | Ask `gh pr list --head <branch> --state merged`, never `git log -1` vs `origin/<branch>` |
| `gh pr merge --delete-branch` left the remote branch alive: the local checkout switch failed first in a worktree setup | Verify `state: MERGED` separately; delete the remote branch explicitly |
| Protection was set with `enforce_admins: false` while the coordinator is a repo admin — the gate did not bind the actor it existed to bind | `enforce_admins: true`; the gate is only real when the merging actor cannot bypass it |
| Tester dispatched to run `tsc`/`npm test` — a worker spent on a deterministic check it could misreport | Division of Labour; CI owns machine-decidable checks |
| Root `npm test` green while testing zero `app/` code | All commands `--prefix app`, stated in every spec |
| `.tsx` test with a failing assertion silently not collected; suite exited 0 | `app/` Facts: `.ts` only, node env, `toasts.test.ts` as template |
| PR #42 merged without its `[fixer]` role tag | Attribution verified via `git log -1`; hook recommended |
| `Closes #15/#21/#23` on merged PRs #44/#45/#46 closed nothing; issues still open and labelled | Auto-close needs the default branch; Hermes closes issues explicitly |

## Known Gaps

Real, unfixed, and not to be papered over.

- **Behavioural verification is not automated.** The Tester role is suspended
  because it is not executable here: `app/` has no Playwright, Puppeteer or
  `@testing-library/react`, so a worker cannot drive the UI, and Tester is
  forbidden to write files. Until a headless browser is added — or
  `vitest.config.ts` is fixed to collect `.tsx` under a DOM environment so
  component tests are possible — **whether the migrated UI actually works is
  verified by the human, not by this pipeline.** CI proves it compiles, lints
  and passes 34 lib tests. That is all it proves.
- **CI's unit-test leg is nearly empty.** 4 files, 0 component tests, and the
  `.tsx` include gap means a well-intentioned component test can be added and
  silently never run. Fixing `vitest.config.ts` (add `.tsx` to `include`, set a
  DOM environment, wire the existing `@vitejs/plugin-react-swc`) is the
  highest-value change available to this pipeline and belongs as a GitHub
  issue, not as a coordinator-side edit.
- **Attribution and cleanup are prose-enforced.** The role tag, the
  `orca-<role>` author and the release/rm/branch-delete sequence are all
  mechanically checkable and all currently depend on a model reading this file.
  A `commit-msg` hook (versioned under `.githooks/`, enabled once with
  `git config core.hooksPath .githooks`) would make the first two mechanical.
  Not installed yet: adding a hook that rejects commits mid-run would surface
  to a worker as an unexplained commit failure, so it needs a quiet moment and
  a Task spec that mentions it.
- ~~Branch protection is not enabled.~~ **Resolved.**
  `refactor/full-react-migration` is protected with required context `app`,
  `strict: false`, and `enforce_admins: true` — verified live. Because the
  coordinator is a repo admin, `enforce_admins: true` is what makes the gate
  binding on Hermes rather than advisory; with it `false` the gate would not
  constrain the one actor it exists to constrain.

  If CI ever breaks for a reason unrelated to the change under test, the
  pipeline jams. The one-command release valve is
  `gh api -X DELETE repos/<owner>/<repo>/branches/refactor%2Ffull-react-migration/protection/enforce_admins`,
  re-enabled with `-X POST` on the same path. Prefer fixing CI.
- **Token/tool-call savings** in this document are measured only for the one
  comparison run in this project's history. They are not a guaranteed
  percentage for future tasks.
