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

**Both ends of the pipeline belong to the user, not to Hermes.** The user
writes the tasks, and the user approves and merges every PR. Hermes owns the
middle: dispatch, CI verification, review, and delivering a PR that is ready
to be judged. It does not invent work and it does not merge. A Task Creator
role no longer exists in this pipeline; an unreviewed auto-merge no longer
happens.

Because a human now reads every PR, **PR legibility is a hard requirement, not
a courtesy** — see PR Legibility Contract. A correct change in an unreadable PR
is a failed delivery.

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
User-written issue → Coder → CI gate → Reviewer → PR ready → **user approves and merges**
        ↑_______________________________________|
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
| Does the changed UI actually behave correctly when running? | **Tester** worker, via Orca's browser | Judgment; CI cannot do it, and Orca's browser cannot run in CI |
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
- Read the CI verdict from `gh pr checks`. When CI is green **and** Reviewer
  PASS is in hand, the PR is *ready for the user* — post nothing, merge
  nothing, and move on to the next issue. The user merges.
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
- Guess or widen an issue's scope when it is ambiguous — ask the user instead.
- Merge a PR, approve a PR, or close an issue the user has not merged.
- Invent work, or open an issue proposing work, when the backlog is empty. An
  empty backlog means Hermes waits for the user, not that it fills the gap.
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
| Coder | Implements the task in its child worktree, **writes tests for the behaviour it adds** (see `app/` Facts), commits + pushes, opens the PR, flips the issue label | Rely on CI to decide whether its own change is correct; skip tests because "CI will catch it" — CI only runs tests that exist |
| Reviewer (`--agent plan`) | Read-only diff/code review against the issue's stated intent, returns PASS/FAIL + fix list | Edit any file; implement fixes; restate what CI already reports (lint/types/build/unit results are not review findings) |
| Tester | Drives the **running** app through Orca's built-in browser (`orca goto/click/eval/console`) and reports the behaviour it actually observed against what the issue described | Run `npm test`/`tsc` and report counts — CI's job, never worth a dispatch; write or modify any file; take a full `snapshot` as a matter of course (see Driving The App) |
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

## Driving The App (Tester)

Verified working 2026-09-18 against the real built app on `vite preview`.
Loop: `orca tab create --url <url>` → `orca eval` to assert → `orca click
--element @ref` to interact → assert again. `orca console --limit N` reads page
errors; an empty console is itself a signal.

Serve the built app, not the dev server, so the Tester tests what CI built:
`npm --prefix app run build` then `npx vite preview --port 4173`.

Four rules, each one learned the hard way:

- **Never use `.click()` from `eval`.** Radix components activate on
  `mousedown`, so a programmatic `element.click()` returns success and changes
  nothing — the command reports `ok: true`, the tab does not switch, and a
  Tester that only checks for errors reports a false pass. Use
  `orca click --element @ref`, which produces real input. Verified both ways:
  `.click()` on the Compare tab did nothing; `orca click --element @e14`
  switched the tab *and* updated the URL to `?tab=compare`.
- **Scope every selector to the app's own chrome.** The gallery renders Radix
  demo components, so the page has **9** elements with `role=tab` of which only
  3 are the app's views — a bare `role=tab` query, in Orca or Playwright, can
  silently assert against a demo. Query inside `.app-tabs` (or the equivalent
  container) instead. `app-*` is shell, `dsv-*` is gallery.
- **`snapshot` is a last resort, not the loop.** A full snapshot of this app is
  **251 KB** — it will bury a worker's context in one call. A targeted `eval`
  returning a small JSON string costs ~400 bytes. Use `snapshot` only to obtain
  a ref, and filter its output to the roles/names needed rather than reading it
  whole.
- **Retry once on `runtime_unavailable`.** The Orca runtime dropped a connection
  mid-session and recovered on the next call with no intervention. One retry,
  then report; do not treat the first drop as a failed dispatch.

What a Tester reports is the observed behaviour and the URL/DOM state it
observed it in — never "looks correct".

## Model Assignment & Fallback

Chosen by running the same probe through every plausible candidate on
2026-09-18, not by reputation. Probe method and full results in
`Model Selection Evidence` below.

| Role | Primary | Fallback |
|---|---|---|
| Coder | `opencode/muse-spark-1.3-contributor-free` | `orcarouter/deepseek/deepseek-v4-flash-free` |
| Reviewer | `opencode/mimo-v2.5-free` | `openrouter/thinkingmachines/inkling:free` |
| Fixer | `opencode/muse-spark-1.3-contributor-free` | `orcarouter/deepseek/deepseek-v4-flash-free` |

**Never pick a model for a role without probing that role.** The clearest
result of the measurement run: `openrouter/thinkingmachines/inkling:free` is
one of the best Reviewers available here (correct verdict, exact output format,
11s) and is **completely unusable as a Coder** — given a file to write it
mangled the Windows path to `/workspaces/...` and died on a permission
rejection. A single "best free model" does not exist; read-only reasoning and
file-editing tool use are different capabilities and must be measured
separately.

Reviewer changed away from the Nemotron family deliberately. All three of
`mimo-v2.5-free`, `nemotron-3-ultra-free` and `inkling:free` produced the
correct verdict in the correct format, so the tiebreak is the verified
`worker_done` tax: Nemotron models in this project repeatedly finish and then
fail to settle, costing a nudge per dispatch (see Worker Communication
Protocol). At equal correctness there is no reason to pay it.

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
  → Reviewer PASS → Hermes swaps the label to `ready-for-review` and stops.
    The user reads the PR, merges it, and closes the issue
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
  permanently-inflated backlog makes the queue-empty stop condition
  unreachable, because completed work still looks unclaimed.

Labels in use: `in-progress` (a Coder holds it), `needs-review` (PR pushed,
awaiting a Reviewer dispatch), `ready-for-review` (CI green + Reviewer PASS —
**this one means the user's turn**). Check `gh label list` and create missing
ones once with `gh label create <name> --color <hex>`.

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

**One Coder per area at a time.** Parallel dispatch is throughput, but two
Coders editing the same area produce PRs that both pass CI and then conflict on
merge — and conflict resolution lands on the user, who did not write either
change. `strict: false` on the branch protection deliberately does not force
branches up to date, so nothing catches this for you.

Areas are the `app/src` subtrees: `shell/`, `gallery/`, `tokens/`, `compare/`,
`preview/`, `systems/`, `lib/`. Before dispatching a Coder, read the areas of
the issues already `in-progress`; if the new issue touches an area already
claimed, leave it and take the next one. The open backlog clusters heavily —
several issues each in compare and in fonts — so this check is not theoretical.
When an issue spans two areas, it counts as claiming both.

**Parallel dispatch is expected.** Hermes may have several Coder/Reviewer/Fixer
worktrees in flight against different issues at once. Each still follows the
fixed per-worker budget; running several budgets concurrently is the intended
way to keep throughput up. Route each settlement to its own next stage
independently — do not serialize to one issue at a time once more than one has
entered the pipeline.

**The backlog is user-owned.** Each cycle starts with
`gh issue list --state open --label agent`. Dispatch a Coder against an open,
unclaimed issue; its number, title and body become the Coder Task's spec.
When no unclaimed issue is left, Hermes says the queue is empty and **waits** —
it does not generate proposals to keep itself busy. An Orca Task whose spec
merely says `MISSING` or targets a since-superseded local file is a
stale-worktree artifact, not backlog; ignore it.

If an issue's scope is unclear, ask the user before dispatching. A Coder given
an ambiguous issue produces a PR the user then has to decipher, which spends
more of the user's attention than the question would have.

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
role: coder | reviewer | tester | fixer
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
`orchestration send --type worker_done` — observed across roles, not only in
plan mode.

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
  Valid tags: `[coder]`, `[reviewer]`, `[tester]`, `[fixer]`. Encode this in every Task
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

## Delivery & Approval

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
- **Hermes never merges.** Auto-merge is enabled on the repo and
  `gh pr merge --auto` would work — do not use it. The merge is the user's
  approval gate and the only point where a human reads the change.
- `delete_branch_on_merge` is enabled, so the merged head branch is deleted
  automatically. The explicit remote-branch deletion in the cleanup checklist
  is now only needed for branches abandoned without a merge.
- Squash-merge unless the repo's convention says otherwise. All merged PRs base
  onto `refactor/full-react-migration`.
- The user closes the issue after merging. GitHub will not do it — see the
  Issue-Label State Machine. Hermes does not close issues.
- Coder/Fixer must commit **and push** — Reviewer worktrees cannot see
  uncommitted changes in a sibling worktree, and `--base-branch` off a branch
  with only uncommitted work silently falls back to that branch's last real
  commit.
- A PR is **delivered** when: CI `app` is green, Reviewer returned PASS, the
  body satisfies the PR Legibility Contract, and the issue is linked. Hermes
  then stops touching it and moves to the next issue. If the user later asks
  why a PR is unmerged, the answer comes from `gh pr checks` and the stored
  Reviewer verdict — not from Hermes re-reading the diff.

## PR Legibility Contract

The user reads every PR and merges it or does not. That makes the PR body part
of the deliverable, held to the same standard as the code. A correct change
nobody can evaluate is a failed delivery, and it costs the user more than a
wrong change that is easy to read.

The canonical structure lives in `.github/pull_request_template.md`. Every
Coder/Fixer Task spec must require it by section name, because `gh pr create
--body` bypasses the template silently — passing `--body` means the template is
never applied, so the spec, not the file, is what actually enforces it.

Required sections, and what makes each one pass:

| Section | Passes when | Fails when |
|---|---|---|
| `## What this changes` | Links the issue; one plain-language paragraph a reader who never opened the file can follow | Restates the diff in words, or is jargon a reviewer has to decode |
| `## Why this way` | Names the alternative considered and why it lost, or states plainly that there was no choice | Silent about a real design decision |
| `## Verified` | Pasted real command output, and for a UI change what was actually observed happening | "Tests pass", "works as expected", or an expectation written as an observation |
| `## Not verified` | Names what the reviewer should look at with their own eyes, and any known unresolved risk | Claims nothing is unverified when something is |
| `## Scope` | Checkboxes honestly ticked | Ticked without checking |

Two rules that matter more than the rest:

- **Evidence, not assertion.** `tests: pass` in a status line is a worker's
  belief. The PR body must carry output. CI is the authority on lint, types,
  build and unit tests, so a body that merely repeats those claims adds
  nothing — what it must add is the behaviour a machine did not check.
- **An honest gap is cheap.** A worker that writes "I did not check whether
  other callsites need the same guard" saves the user from discovering it after
  merge. A worker that hides it burns the user's trust in every later PR. Grade
  `## Not verified` as the most valuable section, not the most embarrassing.

Hermes checks the body against this contract before calling a PR delivered. A
PR missing a required section is the same class of failure as a missing
`worker_done` — send it back to the worker, do not fix the body on the worker's
behalf.

## Model Selection Evidence

Recorded so the next model change is a measurement, not an opinion. Two probes,
run through every plausible free candidate on this host, 2026-09-18.

**Reviewer probe** — a diff whose `useEffect` creates a `setTimeout` and never
clears it, plus a demand for exactly three output lines. Scored on finding the
missing cleanup and on obeying the format.

| Model | Verdict | Format | Time |
|---|---|---|---|
| `opencode/mimo-v2.5-free` | correct | exact | 9.3s |
| `opencode/nemotron-3-ultra-free` | correct | exact | 10.8s |
| `openrouter/thinkingmachines/inkling:free` | correct | exact | 11.3s |
| `openrouter/poolside/laguna-s-2.1:free` | **false PASS** | — | 50.7s |
| `apinex/free/qwen-3.8-max` | unusable — paid subscription | — | 8.8s |
| `tokenrouter/z-ai/glm-5.3-free` | unusable — no available channel | — | 79.7s |
| `openrouter/z-ai/glm-5.2:free` | unusable — no tool-use endpoint | — | 6.4s |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | no output in 10+ min | — | — |

**Coder probe** — write one small module under four mechanically checkable
constraints (named export, specific edge-case behaviour, exactly one WHY
comment, explicit `.ts` import extensions).

| Model | Constraints | Tool use | Time |
|---|---|---|---|
| `opencode/muse-spark-1.3-contributor-free` | 4/4 | read the dir, wrote the file | 20.8s |
| `orcarouter/deepseek/deepseek-v4-flash-free` | 4/4 | globbed, wrote the file | 22.1s |
| `openrouter/cohere/north-mini-code:free` | 3.5/4 | printed only, never wrote | 17.4s |
| `openrouter/thinkingmachines/inkling:free` | 0/4 | **mangled the Windows path**, permission-rejected | 14.2s |

Three findings worth carrying forward:

- **`free` in a model id does not mean usable.** `apinex/free/qwen-3.8-max`
  demands a subscription; `glm-5.3-free` has no channel; `glm-5.2:free` has no
  tool-use endpoint. Probe reachability before planning around a model.
- **A false PASS is the worst Reviewer failure and it is not rare.**
  `laguna-s-2.1` spent 50s and approved code with an obvious bug. A Reviewer
  that never fails anything is indistinguishable from no Reviewer.
- **Bigger is not better on free tiers.** The 550B Nemotron produced nothing in
  ten minutes; the fastest correct Reviewer took nine seconds.

## Continuous Operation Mode

Once started, Hermes runs cycles **back-to-back without stopping for
confirmation** — open issue → Coder → CI → Reviewer → (Fixer if needed) → PR
delivered → next issue. It does **not** wait for the user to merge PR N before
starting issue N+1; delivered PRs queue up for review while work continues.

It stops when the user says stop, or when no unclaimed issue is left. An empty
queue is a stop, not a prompt to invent work.

Do not pause after a successful merge to ask "should I continue?" Do not
narrate each cycle. Surface to the user only on a failure or escalation that
needs a real decision, on a genuine blocker (capability gap, ambiguous scope
this document does not resolve), or when stopping. A healthy running pipeline
produces no chat output between cycles — this document and the PR history are
the audit trail, not a running commentary.

## Scope Control

Every Coder/Fixer Task spec states the scope boundary explicitly and literally
("app/ only, not src/core, not preview/"). Left implicit, a model will wander
into the wrong directory — it happened once here, with `src/core` edited when
the user meant `app/`.

**Hermes narrows an issue's scope, never widens it, and never reinterprets it.**
The issue body is the user's instruction; a Coder that "also fixed" something
adjacent has produced a PR the user now has to separate in their head. If an
issue looks like it should be bigger, that is a question for the user, not a
liberty for the Coder. Encode "change nothing the issue did not ask for" in the
spec, and keep the `## Scope` checkboxes in the PR template as the visible
receipt.

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
| `laguna-s-2.1:free` reviewed a diff with an obvious missing-cleanup bug and returned `status: pass` | Probe every Reviewer candidate with a planted bug; a Reviewer that never fails anything is no Reviewer |
| `inkling:free` reviewed perfectly but, told to write a file, mangled the Windows path to `/workspaces/...` | Probe per role; read-only reasoning and file-editing tool use are different capabilities |
| Three ids containing `free` were unusable — one needs a subscription, one had no channel, one had no tool-use endpoint | Probe reachability before planning around a model |
| `element.click()` from `eval` reported success and did not switch a Radix tab | Use `orca click --element @ref`; programmatic clicks miss `mousedown` activation |
| A bare `role=tab` query matched 9 elements, 6 of them gallery demos | Scope selectors to `.app-tabs` / the app's own container, in Orca and Playwright alike |
| A full `orca snapshot` of the app was 251 KB | Assert with targeted `eval`; use `snapshot` only to obtain a ref, filtered |
| Tester dispatched to run `tsc`/`npm test` — a worker spent on a deterministic check it could misreport | Division of Labour; CI owns machine-decidable checks |
| Root `npm test` green while testing zero `app/` code | All commands `--prefix app`, stated in every spec |
| `.tsx` test with a failing assertion silently not collected; suite exited 0 | `app/` Facts: `.ts` only, node env, `toasts.test.ts` as template |
| PR #42 merged without its `[fixer]` role tag | Attribution verified via `git log -1`; hook recommended |
| `Closes #15/#21/#23` on merged PRs #44/#45/#46 closed nothing; issues still open and labelled | Auto-close needs the default branch; Hermes closes issues explicitly |

## Known Gaps

Real, unfixed, and not to be papered over.

- **Behavioural verification exists, but not in CI.** Orca's built-in browser
  drives the real app and the Tester role uses it (see Driving The App). What it
  cannot do is gate a merge: a client-hosted page renders in the paired
  desktop's browser engine and every command returns `browser_host_unavailable`
  while that desktop is closed, so it cannot run in GitHub Actions. The
  consequence to hold onto: **a green CI check still does not mean the UI
  works.** CI proves it compiles, lints and passes the unit suite. Behaviour is
  proven by a Tester dispatch or by the user, both of which need this machine
  awake.
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
