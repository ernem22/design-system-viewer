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

Verified pipeline shape:

```
TaskCreator → Coder → Reviewer → Tester → PR → Hermes merge
                 ↑___________________________|
                 (failure at any stage → fresh worker, fallback model)
```

## Hermes Responsibilities

- Create Orca Tasks with a scoped, self-contained spec (target, change,
  constraints, acceptance).
- Create one child worktree per worker; write that worktree's `opencode.json`
  before starting the terminal.
- Start the worker terminal, wait for `tui-idle`, bind it with
  `orchestration worker-start`.
- Block on `orchestration check --wait` for the settlement message.
- Read the **structured status line** the worker returns (see Worker
  Communication Protocol) — nothing else.
- Decide: pass → advance stage; fail → fresh worker + fallback model (capped
  attempts); ambiguous → escalate to the user.
- Open the PR and perform the merge once Reviewer PASS + Tester PASS are both
  in hand.
- Release/close settled workers; clean up worktrees created for a
  since-finished or abandoned attempt.

## Hermes Forbidden Responsibilities

Hermes does **not**:

- Write or edit application code.
- Perform its own code review of a worker's diff (Reviewer's job).
- Re-run a worker's reasoning or "double-check" a PASS verdict by re-reading
  the full diff line-by-line.
- Read a worker's full terminal transcript or chain-of-thought once a
  structured status line has arrived.
- Re-summarize a worker's output back to the user in prose (report the
  structured line; expand only on explicit user request).
- Poll status in a tight loop (`check` without `--wait`, repeated).
- Re-inspect the repository (`git log`, `ls`, full-tree reads) once scope and
  branch are already established for the run.
- Guess or widen Task Creator's scope when it is ambiguous — escalate instead.
- Invent a second state-tracking layer (file, script, in-context ledger) that
  duplicates what `orca orchestration task-list` / `worker-list` already hold.

One narrow exception: a single `git status --porcelain` (or `git log -1`) after
a Coder/Fixer `worker_done` is allowed as a cheap non-negotiable integrity
check before advancing to Reviewer — it is O(1) tool-calls and catches
"worker lied about outcome" class failures that the structured protocol
cannot self-report. Use `git status --porcelain`/`git log -1`, not
`git diff --stat` alone: a worker that never actually committed can still
report a `commit: <sha>` line by echoing the worktree's starting HEAD, and
`git diff --stat` against an untracked new file shows nothing (untracked
files don't appear in a diff) — it looks clean when it is not. Compare the
reported SHA against the worktree's pre-dispatch HEAD; identical means no
commit happened despite the claim. This exact gap was caught once in this
project's measurement run.

## Worker Roles & Responsibilities

| Role | Does | Does not |
|---|---|---|
| Task Creator | Inspects the **whole** of `app/` with no artificial restriction on task type — missing features, bugs, poor/duplicated code, weak test coverage, anything — and proposes one small, independent, well-scoped task; writes it (e.g. `NEXT_TASK.md`) | Implement anything; narrow itself to one category (e.g. "tests only") unless the user explicitly asked for that category this run |
| Coder | Implements the task in its child worktree, runs the relevant tests itself, commits + pushes | Review or test-suite-wide validation |
| Reviewer (`--agent plan`) | Read-only diff/code review, returns PASS/FAIL + fix list | Edit any file, implement fixes |
| Tester | Runs the existing test suite (+ type-check) against the Coder's pushed branch in a fresh worktree, reports exact pass/fail counts and any build/type errors | Write, add, or modify any test or source file — including a "trivial" one-line fix; a discovered failure is reported (`status: failed`, `reason:`, `retryable:`) and routed to a Fixer Task, never patched in place by the Tester itself |
| Fixer | Applies exactly the fix Reviewer/Tester reported, nothing else | Re-scope or re-design the change |

## Model Assignment & Fallback

Verified working IDs (via `opencode models` on this host and live
`opencode debug config` resolution):

| Role | Primary | Fallback |
|---|---|---|
| Coder | `opencode/muse-spark-1.3-contributor-free` | `openrouter/nex-agi/nex-n2.5-mini:free` |
| Reviewer | `opencode/nemotron-3-ultra-free` | `opencode/nemotron-3.5-lightning-free` |
| Tester | `opencode/nemotron-3.5-lightning-free` | `openrouter/nex-agi/nex-n2.5-mini:free` |
| Fixer | `opencode/muse-spark-1.3-contributor-free` | `openrouter/nex-agi/nex-n2.5-mini:free` |
| Task Creator | `opencode/nemotron-3-ultra-free` | `openrouter/openrouter/free` |

`openrouter/nex-agi/nex-n2.5-pro:free` was the original Coder primary but was
demoted after hitting OpenRouter's daily free-tier cap mid-run
(`Rate limit exceeded: free-models-per-day`) — it is not banned, just no
longer the default; only use it if the user explicitly asks for it or if
every other free-tier option in this table is also rate-limited that day.

**Rate-limit detection (do this on every dispatch, not just on failure):**
before trusting a `worker_done`, and immediately on any suspiciously fast or
empty settlement, read the terminal tail once. A rate-limited model prints
its cap message directly into the OpenCode transcript (verified form:
`Rate limit exceeded: <bucket-name>. Add N credits to unlock ...`) rather
than failing the dispatch cleanly — treat that string appearing anywhere in
the tail as an automatic hard failure for that dispatch, equivalent to
`worker_done outcome: failed`, and apply the normal Failure & Recovery Policy
(fresh worktree + fallback model's `opencode.json`, same Task ID, no
`--retry-of`). Do not wait out the full `check --wait` timeout on a dispatch
already showing this string; abandon early once caught. There is currently
no `opencode`/Orca API that reports remaining daily quota ahead of time — the
only detection mechanism is this transcript string appearing after the
model has already tried and failed a request.

Model selection mechanism (verified, see the `orca-opencode-worker-pipelines`
skill for the exact command sequence and its edge cases):

1. `orca worktree create` the child worktree first.
2. Write **project-level** `<worktree>/opencode.json` with
   `{"model": "<id>"}` — this overrides the user's global OpenCode config.
   Never pass `orca worker-start --model` for an `opencode` agent; it is
   rejected (`Agent opencode does not support launch-time model selection`).
3. Start the terminal with a bare `opencode` command.
4. Verify (not assume) the model actually resolved — `opencode debug config`
   and/or the terminal header line — before trusting the dispatch.

## Task Lifecycle

```
created → coding → review → testing → pr → merging → completed
```

Failure transitions:

```
review_failed → fixing → review
test_failed   → fixing → testing
merge_failed  → fixing → pr
```

A stage only advances on a structured PASS/succeeded signal; it never
advances on Hermes's own inference from partial output.

## Failure & Recovery Policy

Verified sequence (see skill for full detail and the exact rejected
`--retry-of` error):

1. Primary worker fails — `worker_done outcome: failed`, an `escalation`
   message, or a **stalled** worker (identical terminal tail across two reads
   separated by real time, with no settlement — one read never proves a
   stall).
2. Start a **fresh** child worktree + terminal with the fallback model's
   `opencode.json`. Do not reuse the failed worktree/terminal.
3. Re-dispatch the **same Task ID** with plain `orchestration worker-start`
   (no `--retry-of`) — this works because the Task itself is normally still
   `status: ready` after one dispatch failure.
4. `--retry-of <dispatch_id>` is **not** interchangeable with step 3. It was
   tested and rejected (`task_not_startable`) when the Task was still `ready`
   after a single failed dispatch — Orca requires the Task itself to already
   be `failed`/`blocked` before `--retry-of` is accepted. Do not document or
   rely on `--retry-of` as the first-line fallback mechanism; it is an
   escalation-tier action for a Task Orca's own circuit breaker has already
   given up on, not a per-attempt tool.
5. Cap attempts at 3 total per Task; after that, Orca's own dispatch circuit
   breaker marks the Task `failed` — do not layer a second retry counter on
   top of it. On that point, escalate to the user; do not keep retrying.
6. Never re-run a worker that already succeeded "to compare" or "to be sure."

## Token Optimization Rules

- One `check --wait` per worker attempt, not a poll loop. If the client-side
  subprocess wait times out before Orca's own wait resolves, re-issue a
  single **non-blocking** `check` (no `--wait`) — Orca replays the durably
  queued settlement; nothing is lost, and no new worker-side work happened.
- Consume only the structured status line of a `worker_done`/`escalation`
  message; do not read the rest of `body` unless it signals `failed` and the
  reason needs a fix Task written.
- Never call `worker-read`/terminal-read for a worker that already produced
  `worker_done` — that message *is* the report.
- Do not re-run `git log`, `worktree list`, or full-repo scans mid-run once
  the target branch/worktree is established; carry the IDs forward in-turn
  instead of rediscovering them.
- Do not restate a worker's PASS/FAIL verdict back to the user in expanded
  prose during the run — accumulate it, report once, at pipeline end (or on
  failure/escalation).

## Tool-Call Optimization

- `task-create` once per stage, `worktree create` once per worker attempt,
  `terminal create` + `terminal wait` + `worker-start` as the fixed 3-call
  dispatch sequence, `check --wait` once (see above), `worker-release` once
  on settlement. That is the whole per-worker call budget outside of
  fallback.
- Skip `opencode debug config` verification for routine dispatches once a
  role/model pairing has been verified working in this run — re-verify only
  after a config change, a new role, or a suspected model-resolution failure
  (e.g. an unexpected terminal header).
- Batch independent read-only Orca calls (e.g. `worker-list` + `task-list`)
  into the same turn when both are genuinely needed; do not fetch one, decide
  you need the other, and fetch it next turn.
- PR creation and merge are single `gh pr create` / `gh pr merge` calls with
  no intermediate `gh pr view` unless a merge conflict or failed check needs
  diagnosing.

## Worker Communication Protocol

Every worker's `worker_done`/`escalation` must lead with a **structured
status line** as its first line, machine-parseable, before any prose. Hermes
reads only this line to decide the state transition; prose after it is for
human audit trail only and is not re-read by Hermes.

```
status: succeeded | failed
role: coder | reviewer | tester | fixer | task_creator
task: <task_id>
commit: <sha | none>
tests: pass | fail | n/a
```

Reviewer specifically:

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

Encode this line format directly in each Task's spec (the "OBSERVABLE
ACCEPTANCE" / "OUTPUT" clause) — it is the contract, not a suggestion.

Known gap: `--agent plan` (Reviewer) does not automatically send
`worker_done` when it finishes talking — verified in this session. This is
NOT limited to Reviewer/plan-mode: in this project, Nemotron-family models
(`opencode/nemotron-3-ultra-free`, `opencode/nemotron-3.5-lightning-free`) in
ANY role have repeatedly finished their work, visibly printed their verdict
or result in the transcript, and then simply stopped without ever calling
`orchestration send --type worker_done` — observed on Task Creator and
Reviewer dispatches alike, not just plan-mode. Do not treat this as
Reviewer-specific.

**Automatic nudge policy (do this without asking the user):** after a
dispatch has produced **two consecutive** full `check --wait` timeouts with
no message, read the terminal once (`terminal read --screen`). If the tail
shows the model has already produced its final answer/verdict and is sitting
idle (no `⠋ Thinking`/spinner, prompt bar visible, no active tool call), send
the nudge yourself immediately:
`orchestration send --to dispatch:<id> --subject "send worker_done" --body "You must now run: orca orchestration send --from <terminal_handle> --dispatch-capability worker --type worker_done --subject ... --body ... --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded"`,
then resume `check --wait`. Do not wait for a third timeout, and do not ask
the user for permission to nudge — this is routine dispatch housekeeping,
not a judgment call. If the terminal instead shows active work in progress,
keep waiting normally; the nudge is only for a genuinely idle-but-unsettled
worker.

## State & Context Management

- **Durable state** (lives in Orca, not in Hermes's context): Run ID, Task
  IDs, dispatch IDs, worktree IDs/paths, task status. Always re-fetch these
  from `orca orchestration task-list --run <id>` / `worker-list --run <id>`
  if a new coordinator turn needs them and they are not already in the
  current turn's context — do not ask the user to repeat them, and do not
  keep a parallel note of them in a file.
- **Ephemeral runtime state** (fine to hold only in-turn, discard after):
  worker terminal tail excerpts used to diagnose a stall, verification
  command output (`opencode debug config`, `git status --porcelain`).
- Do not persist either kind of state in a bespoke file/DB — that is exactly
  the second-orchestrator anti-pattern this document forbids.

## Scope Control

Task Creator's spec must state the top-level scope boundary explicitly and
literally (e.g. "app/ only, not src/core, not preview/") — an unscoped "find
something small and independent" prompt lets the model choose the wrong
directory (this happened once in this project: an unscoped Task Creator
picked `src/core` when the user meant `app/`). If a task's target scope is
ambiguous from the user's request, Hermes asks the user (or blocks/escalates
in a headless context) rather than guessing a boundary.

**Directory scope is the only boundary Hermes may impose.** Do not also
constrain *what kind* of task Task Creator proposes (e.g. do not tell it
"tests only" or "avoid these recently-touched files") unless the user
explicitly asked for that category or exclusion this run — that is scope
creep in the opposite direction and was caught once in this project: Hermes
added an unrequested "steer away from recently-touched files" constraint,
and Task Creator predictably picked the lowest-risk option (a missing test
file) instead of surveying the whole directory for its most valuable next
task. Give Task Creator the full directory and let it inspect everything in
scope — missing features, bugs, poor or duplicated code, weak abstractions,
missing tests, anything — and choose the best single small independent task
on its own judgment.

## Commit Attribution

Every commit a worker makes must make its own role machine-obvious, and must
NOT be attributed to the worker's personal/model identity:

- **Commit message**: prefix the subject line with the role tag in brackets,
  e.g. `[coder] test(app): add useToasts hook tests`,
  `[fixer] fix(app): satisfy tsc for toasts.test.ts mountProbe container`,
  `[task_creator] docs: NEXT_TASK.md for cycle N`. Valid tags:
  `[task_creator]`, `[coder]`, `[reviewer]`, `[tester]`, `[fixer]`. Encode
  this in every Task spec's commit instruction — it is not optional and not
  left to the worker's own commit-message judgment.
- **Commit author**: never let a worker commit under its own OpenCode/model
  identity or a personal name. Set `git config --worktree user.name`/`user.email`
  in each worker's worktree before it commits (or instruct the worker to do so
  itself as its first step) to a fixed, role-scoped identity such as
  `orca-coder <orca-coder@localhost>` / `orca-fixer <orca-fixer@localhost>` —
  not `ernem22`, not a model name. **Use `--worktree` scope, never bare
  `git config user.name`** (which is `--local` and lives in the shared
  `.git/config` that every worktree of the same repo reads) — a bare `git
  config user.name` set in one worktree silently overwrites the identity
  every other worktree of the same repo sees, including the coordinator's own
  main worktree. This requires `git config extensions.worktreeConfig true`
  once per repo (checked once at the start of a run; it is durable repo
  state, not per-worktree). This exact leak happened once in this project: a
  Coder worktree's identity got overwritten mid-run when the coordinator
  later set its own `git config user.name` without `--worktree`, and a
  Coder's already-pushed commit landed under the coordinator's identity
  instead of `orca-coder`. The coordinator's own commits directly to the
  coordinator worktree (e.g. editing this file) use the **real human/GitHub
  identity** (`ernem22`, not a synthetic `orca-orchestrator` identity) —
  Hermes acting as coordinator on the user's main worktree is not an
  anonymous autonomous worker the same way Coder/Reviewer/Tester/Fixer are;
  only dispatched worker roles get the `orca-<role>` synthetic identity
  treatment.
- Verify this the same way the integrity check already works: `git log -1
  --format='%an <%ae> %s'` after a Coder/Fixer `worker_done`, alongside the
  existing SHA check — a commit with the wrong author or missing role tag is
  a policy violation even if the SHA is real and tests pass. If caught before
  merge (PR still open), amend and force-push
  (`git commit --amend --author="orca-<role> <orca-<role>@localhost>"
  --no-edit && git push --force-with-lease`) rather than leaving it wrong —
  cosmetic-looking author metadata is still worth fixing when the fix is
  cheap and pre-merge. If already merged into the shared branch with other
  work stacked on top, leave the historical commit as-is (rewriting shared
  history with active dependents is not worth the disruption) and just
  ensure the identity is correct going forward.

## Continuous Operation Mode

Once started, Hermes runs cycles **back-to-back without stopping for
confirmation** between them — Task Creator → Coder → Reviewer → Tester →
(Fixer if needed) → PR → merge → next cycle — until either:

1. the user explicitly says stop, or
2. `app/`'s migration is judged complete (no more small independent
   improvements worth proposing; Task Creator itself signals this by
   reporting it found nothing worth doing, or the user says the migration
   goal is met).

Do not pause after a successful merge to ask "should I continue?" — start
the next cycle immediately. Do not narrate each cycle to the user in prose.
Minimize input/output: only surface to the user on failure/escalation that
needs a real decision, on a genuine blocker (e.g. capability gap, ambiguous
scope this document doesn't resolve), or when stopping (user-requested or
migration-complete). A running pipeline that is healthy produces no chat
output at all between cycles — this document and the PR history are the
audit trail, not a running commentary.

**Task Creator is not mandatory every cycle.** The real backlog lives in
**GitHub Issues** (`gh issue list --repo <owner>/<repo> --state open --label
agent`), not in Orca's internal `orchestration task-list` — Orca Tasks are
per-dispatch plumbing, not the durable backlog. Before dispatching a new
Task Creator, run `gh issue list --state open --label agent` once and check
for an open issue not already claimed by an in-flight Coder this run. If one
exists, skip Task Creator for this cycle and dispatch a Coder directly
against that issue (its number, title, and body become the Coder Task's
spec) instead of spawning another Task Creator — there is no value in
generating more proposals when dozens are already open and unclaimed. Only
dispatch a fresh Task Creator when the open-and-unclaimed issue backlog is
empty.

**Issue lifecycle**: Task Creator's job, when run, is to open a new GitHub
issue (`gh issue create`, labelled `agent` + `bug`/`enhancement` as
appropriate) for a task it identifies — not to write a local `NEXT_TASK.md`
that only this run can see (a prior cycle's NEXT_TASK.md-in-worktree approach
does not survive worktree cleanup and is not discoverable by future runs;
GitHub Issues are the durable, cross-run store). An Orca Task whose spec
merely says `MISSING` or targets a since-superseded local file (an artifact
of a stale worktree, not a GitHub issue) is not real backlog — recognize and
ignore it.

## Issue-Label State Machine (parallel-safe)

Coordination across parallel Coder/Reviewer/Tester dispatches happens through
GitHub issue labels, not through Hermes holding it all in one turn's context.
This lets multiple issues move through the pipeline concurrently without
Hermes serializing every stage of every issue:

```
(open, unlabeled agent work) → coder picks it up, comments "claimed"
  → Coder pushes branch + opens PR with "Closes #<n>", labels the issue
    `needs-review`, removes any `in-progress` label
  → Hermes scans open issues for `needs-review` label → dispatches a
    Reviewer worktree against that issue's PR branch
  → Reviewer PASS: Hermes swaps the label `needs-review` → `needs-test`
  → Reviewer FAIL: Hermes creates a Fixer Task referencing the PR/issue,
    leaves label at `needs-review` (or a `changes-requested` label if you
    add one) so it re-enters the Reviewer queue after the Fixer pushes
  → Hermes scans open issues for `needs-test` label → dispatches a Tester
    worktree (report-only, per the Tester role rules above) against that PR
    branch
  → Tester PASS: Hermes opens/finalizes the PR merge, issue auto-closes via
    "Closes #<n>", labels are irrelevant post-merge (issue is closed)
  → Tester FAIL: Hermes creates a Fixer Task with the exact failing output,
    label goes back to `needs-review` (a Fixer's patch should be re-reviewed
    before re-testing, not trusted blind)
```

Label names to actually use on this repo (create them once if missing via
`gh label create <name> --color <hex>` — check `gh label list` first):
`needs-review`, `needs-test`, `in-progress` (optional, marks an issue with an
active Coder dispatch so a second concurrent cycle doesn't double-claim it).

**Parallel dispatch is expected, not just tolerated.** Hermes may have
multiple Coder/Reviewer/Tester worktrees running concurrently against
different issues — one issue's Coder, another issue's Reviewer, a third
issue's Tester, all in-flight at once. Each dispatch still follows the fixed
per-worker call budget (worktree create → terminal create → terminal wait →
worker-start → check --wait → worker-release); running several of these
budgets concurrently across different issues is the intended way to keep
throughput up without violating any single-worker rule in this document.
When waiting on multiple dispatches, poll/check each dispatch's run
messages and route each settlement to its own next stage independently —
do not force a strict single-issue-at-a-time serialization once more than
one issue has entered the pipeline.

**The Coder — not Hermes — flips `needs-review`/`needs-test` labels**,
because the Coder is the one that knows its own PR is ready; encode the
exact `gh issue edit <n> --add-label needs-review --remove-label
in-progress` (or equivalent) command in every Coder/Fixer Task spec's commit
instructions, immediately after the push step. Hermes's job is to *scan* for
those labels each cycle (`gh issue list --state open --label needs-review`,
`--label needs-test`) and dispatch the next role — Hermes does not manually
flip a label a worker was supposed to flip, except as a corrective action if
a worker's `worker_done` claims the flip but the label is verifiably still
missing (same class of integrity check as the SHA-diff check elsewhere in
this document).

**Tester must actually test — no shortcuts.** Do not accept a Tester
`worker_done` that skips actually invoking `npm run test`/`npm run build` in
favor of only reading the diff or trusting the Reviewer's verdict. If a
Tester's `body` doesn't show real command output (exact pass/fail counts,
or the literal failing error text), treat it the same as a missing
`worker_done` — nudge/re-dispatch, don't advance the stage on an unverified
claim.

- Coder/Fixer commits and pushes its own branch — Reviewer/Tester worktrees
  cannot see uncommitted changes in a sibling worktree; `--base-branch` off a
  branch with only uncommitted work silently falls back to that branch's last
  real commit.
- PR opens only after Reviewer PASS **and** Tester PASS are both held.
- Hermes performs the merge (`gh pr merge`) directly — this is a control-plane
  decision, not implementation, and is explicitly in-scope for Hermes.
- Squash-merge unless the repository's existing convention says otherwise.

## Safety / Guardrails

- Never write directly to the coordinator/main worktree — all Coder/Fixer
  work happens in a dedicated child worktree.
- Never delete or reset uncommitted work in a worktree Hermes did not create
  for this run.
- Never fabricate a model ID, a test result, or a "verified" claim — see
  Observability below.
- A garbled/invalid `opencode.json` model ID does not error cleanly; OpenCode
  silently substitutes a different model and the worker can hang. Detect this
  by the terminal header (`Build · <model>`) showing the wrong name, not by
  waiting for an error.

## Observability & Minimal Reporting

Hermes reports to the user only:

- Per completed pipeline run: role → model used → PASS/FAIL, final PR/merge
  link or failure reason. One line per stage, not a transcript.
- On failure/escalation: the structured failure line plus the concrete next
  action (fallback triggered / user input needed / capped-out and blocked).
- Never a re-narration of a worker's implementation reasoning.
- Every claim of "verified" must have been actually observed this run
  (command output, terminal header, re-run test result) — otherwise it is
  labeled `not verified` / `assumed`, never asserted as fact.

## Known Limitations

- `--retry-of` has not been verified to work as a first-attempt fallback
  mechanism (see Failure & Recovery Policy §4) — only plain re-dispatch on
  the same Task ID has been verified.
- Reviewer (`--agent plan`) requires a manual nudge to emit `worker_done`;
  this is a known, unfixed per-dispatch cost, not a solved problem.
- No CI/status-check integration exists on this repo's PRs yet
  (`statusCheckRollup` was empty in the verified run) — merge decisions
  currently rest entirely on Reviewer + Tester worker verdicts.
- Token/tool-call savings from this document are only measured for the one
  comparison run recorded in the project history; they are not a guaranteed
  percentage for arbitrary future tasks.

## Operational Checklist

Before dispatching any worker:

- [ ] Task spec states target, change, constraints, and the structured
      output-line format.
- [ ] Child worktree created from the correct base branch (verify with one
      `git log -1` in the new worktree if this is the first worker of the
      run on that branch — skip on subsequent workers of the same run).
- [ ] `opencode.json` written with the correct primary model for the role.
- [ ] Terminal started, `tui-idle` reached, `worker-start` bound.

Before advancing a stage:

- [ ] Settlement message received with a structured status line.
- [ ] `status: succeeded`/`pass` — advance. `failed` — fallback per policy.
      Ambiguous — escalate, do not guess.

Before merge:

- [ ] Reviewer PASS held.
- [ ] Tester PASS held.
- [ ] PR mergeable (`gh pr view --json mergeable,mergeStateStatus`).

## Optimization Targets

Concrete, checkable claims — not aspirational numbers:

- Per-worker dispatch: fixed at 5 Orca tool-calls (worktree create, terminal
  create, terminal wait, worker-start, check --wait) + 1 release = 6, plus at
  most 1 verification call (`opencode debug config` or
  `git status --porcelain`) when warranted. No polling loop.
- Zero full-transcript reads (`worker-read`) on the happy path — only on a
  suspected stall.
- Zero repo-wide re-scans per worker once the run's branch/scope is fixed.

## Future Improvements

- Wire real CI/status checks into the PR so merge decisions are not solely
  worker-verdict-based.
- Investigate whether Orca's Task-level circuit breaker state can be queried
  cheaply enough to replace the "check task-list status before choosing
  --retry-of vs plain re-dispatch" step with a single call instead of two.
- If OpenCode ever ships native model fallback, re-evaluate whether the
  coordinator-level fallback in this document is still needed or can be
  simplified.
