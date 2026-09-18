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

**The user owns what gets built, and owns what the next proposal looks at.**
They write the issues, and they can hold any one of them back with
`human-merge`; when they want more issues than exist, they tell Hermes the focus
(an area, a theme, a "we have no issue for X") and a Task Creator turns that
focus into one new issue. Hermes never invents a direction on its own — an empty
backlog with no stated focus means Hermes says the queue is empty and stops
there.

The split is by blast radius, not by novelty. A large self-contained addition
is safer to merge unread than a three-line edit to a file everything renders
through, so the user's `human-merge` marker tracks how far a change reaches
rather than how big or how new it is. A Task Creator role exists, but only runs
on a focus the user stated — see Task Creator.

## Operational Contract (apply this without reading further)

1. One Run per session; every dispatch carries `--run <id> --from <handle>`.
2. Per worker: worktree → `opencode.json` (the model) → terminal →
   `worker-start --spec`. Tester worktrees get their harness installed, built and
   served by the coordinator, one port each — the worker never starts a server.
3. Read `check --wait` FIFO batches. Ack heartbeat-only batches; never ack a
   batch you have not parsed. `check --all` recovers a settlement you think you
   lost.
4. A stall is an identical tail **and** a frozen token counter across two reads
   ≥90s apart → `worker-abandon --dispatch <old>`, then `worker-start --task <id>
   --retry-of <old>` with a fresh worktree.
5. A PR advances only on CI green (`gh pr checks`) + Reviewer PASS (`scope_ok:
   yes`) + Tester PASS (`observed:` and `before:` lines). All three in hand →
   merge, then close the issue — unless the issue carries `human-merge`.
6. While a review or verification wave waits, keep a Coder in flight for every
   free `app/src` area.
7. Never write application code, never re-review a PASS, never report an
   unverifiable result as success.
8. Every merged commit carries both identities: the `[role]` tag in the subject,
   `erne` as author, and the worker as a `Co-authored-by:` trailer.

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
User-written issue → Coder → CI gate → Reviewer → Tester ─→ all three pass → Hermes merges
        ↑_________________________________________________|   `human-merge` → the user does
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
| Does the changed UI actually behave correctly when running? | **Tester** worker — a required stage for every PR that changes `app/src` (see Tester) | Judgment over the *running* app; CI cannot do it, and Orca's browser cannot run in CI |
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
- Dispatch a Tester against the PR branch for every PR that changes `app/src`
  (see Tester), once CI is green and Reviewer PASS is in hand. Testers run in
  parallel with other dispatches — see Parallel Worker Spawning.
- Read the CI verdict from `gh pr checks`. When CI is green, Reviewer PASS and
  Tester PASS are all in hand, Hermes merges the PR and closes the issue in the
  same turn — unless the issue carries the user's `human-merge` label, in which
  case the PR is left at `ready-for-review`. Nothing else authorizes either
  action.
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
- Merge a PR that has not passed all three signals (CI green, Reviewer PASS,
  Tester PASS), or add or remove the user's `human-merge` label.
- Merge on a Reviewer PASS that reported `scope_ok: no`.
- Run a Task Creator without a focus the user stated. An empty backlog plus no
  stated focus means Hermes stops and says so — not that it invents a direction.
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
| Task Creator | On a focus the **user** stated, inspects all of `app/` and opens **one** GitHub issue for one small, independent, well-scoped task, labelled `agent` | Propose anything when no focus was stated; open a second issue in a cycle; narrow itself to a category the user did not ask for; write a local `NEXT_TASK.md` |
| Coder | Implements the task in its child worktree, **writes tests for the behaviour it adds** (see `app/` Facts), commits + pushes, opens the PR, flips the issue label | Rely on CI to decide whether its own change is correct; skip tests because "CI will catch it" — CI only runs tests that exist |
| Reviewer (`--agent plan`) | Read-only diff/code review against the issue's stated intent, returns PASS/FAIL + fix list | Edit any file; implement fixes; restate what CI already reports (lint/types/build/unit results are not review findings) |
| Tester | Drives the **running build** through Orca's built-in browser and reports the behaviour it observed, before and after the change (see Tester). A required stage for every PR that changes `app/src`, and it does gate the merge | Run `npm test`/`tsc` and report counts — CI's job; write, add or modify any file; write tests; commit; take a full `snapshot` as a matter of course |
| Fixer | Applies exactly the fix Reviewer or a failing CI check reported, nothing else | Re-scope or re-design the change |

## The Wake-Up Loop (and why there is no dispatcher role)

The pipeline's delay was measured, not guessed. Four settlements landed while the
coordinator was idle on 2026-09-18:

    19:11:50  tester   PR 68   → processed within the minute (the coordinator was mid-turn)
    19:16:07  tester   PR 63   → 31 minutes
    19:20:17  coder    PR 69   → 27 minutes
    19:23:52  coder    PR 70   → 24 minutes

Orca has no push channel into the coordinator's session, so a settlement sat in
the queue until a human poked the session. That was the entire delay: teardown and
the next spawn are cheap, but they ran on the human's clock.

**Rejected fix: a dispatcher role.** A worker that authored specs, spawned and
reaped other workers was built and run. It dies with its terminal — the first one
was closed externally mid-run and left two PRs ungated — it cannot merge, so the
coordinator is still in the loop for every PR, and it puts a second model's
latency in front of every phase. It is not a role here any more.

**Accepted fix: the settlement wakes the coordinator.** `watch.sh` blocks on
Orca's own queue and exits the moment an informative settlement arrives. Run as a
background process with a completion notice, that notice *is* the push channel,
and the coordinator's loop becomes: act on the settlement (ack → release → reap →
spawn the next phase), then start a fresh watcher.

    bash tools/orchestration/watch.sh <run-id> [max-seconds]
      exit 0 = settlement waiting (report on stdout)
      exit 3 = heartbeats only for <max-seconds>
      exit 4 = another waiter already holds this run

**Exit-based notification has a hole, and the supervisor closes it.** A watcher that
exits in order to notify leaves the channel empty until the coordinator arms the next
one, and a settlement landing in that gap is read by nobody. That is not hypothetical:
it is exactly how "the thing that closes finished items is broken" felt, with the
mechanism working perfectly and simply nobody listening. `watchd.sh` runs `watch.sh`
in a loop inside ONE process that never exits, and prints a line starting with `WAKE`
whenever something needs the coordinator — so the notification is *pattern*-based, not
exit-based, and there is never a gap:

    terminal(background=true, notify=["WAKE"]):
      bash tools/orchestration/watchd.sh <run-id> [window-seconds]
      WAKE settlement  = a worker_done / escalation / question arrived
      WAKE drained     = a delivery was waiting at arming time (acked, and printed to the log)
      WAKE queue-error = the queue could not be read
      stop it with: touch ${LOCALAPPDATA}/Temp/watchd.stop

`watch.sh` stays the primitive — its exit codes are how `watchd.sh` classifies a
window — and `watchd.sh` is how it is armed in practice. One watcher per run: Orca
permits a single waiter, so a second exits instead of queueing behind the first. The
settlement it reports must be acked: an unacked one is redelivered and looks like new
work.

## Mechanism beats prose

Every lifecycle action stays a direct Orca CLI call, because Orca owns task,
dispatch and worktree state and nothing may keep a second copy of it. What may be
scripted is the *stateless sequencing* of those calls, so a model turn is not
spent on it:

    tools/orchestration/spawn.sh  <role> [base-branch] [--plan]  → PATH, HANDLE
    tools/orchestration/reap.sh   <role> [dispatch-id]           → release, close, rm
    tools/orchestration/packet.sh <pr> [run-id] [task-id ...]    → the merge packet
    tools/orchestration/watch.sh  [run-id] [max-seconds]         → exit on settlement
    tools/orchestration/attention.sh [run-id]                    → who waits on a human, and on what

`spawn.sh` reads nothing and stores nothing; `reap.sh` asks Orca for the worktree
rather than caching the path. `packet.sh` prints the packet shape below, with each
role's verdict *chain* (`fail -> pass`), so a superseded fail cannot hide and an
unsuperseded one cannot pass silently. A gate whose verdict cannot be tied to the
PR's head prints `NOT verified on this head` — that is a re-run, not a merge.

### Merge packet — what one merge decision needs

    pr: <number>
    head: <sha>
    ci: green <run url>
    reviewer: pass scope_ok: <yes|no>
    tester: pass <build asset hash> on :<port>
    evidence: <one line per gate, the strongest observed value>
    open risk: <what no gate covered, or: none>

A packet with a missing field is not sent — it goes back to the phase that owes
the field. The coordinator never reconstructs it, because reconstructing it means
re-reading the raw settlement, which is the cost this role exists to remove.

## Specification Templates

A spec is a **filled template, never prose written from scratch**. Hand-written
specs drift in shape — a missing evidence section, an absent forbidden-actions
list — and that drift surfaces three phases later as a false pass.

Every spec carries, in this order:

1. the phase, and the issue/PR it serves;
2. what the worker may touch, and which files open PRs already hold;
3. what to prove, phrased so a wrong answer is observable rather than arguable;
4. the evidence to paste — real command output, never a summary of it;
5. the delivery: commit prefix, branch, PR title, labels, and what not to do;
6. the acceptance block: the exact first lines of the `worker_done` body the
   coordinator will parse.

Templates live in `docs/orchestration/specs/` (`coder.md`, `reviewer.md`,
`tester.md`, `fixer.md`). The coordinator reads the template and fills it. Editing
a template is a deliberate act, because a template is the contract, not a
per-cycle artifact.

## `app/` Facts Workers Must Be Told

Repo-specific traps, verified 2026-09-18. Each Coder/Fixer Task spec must
carry the ones relevant to its change, because a worker that discovers them
by trial produces a silent false pass.

- **The shell layout contract lives in `app/CLAUDE.md` (`## Shell layout`).** One
  frame, one scroller: the shell owns the topbar/rail/props/content regions, a tab
  supplies rail *content* rather than its own rail frame, exactly one region scrolls
  (`.app-main`), and `overflow: hidden` is banned on layout containers because it still
  scrolls programmatically. A change that adds a rail frame or a second scroll
  container is out of contract, and every spec touching `shell/` must say so.
- **Commands are `--prefix app`.** Root `npm test` runs
  `src/core`/`src/server` only and root `npm run build` builds `preview/` —
  **neither touches `app/` at all**. The real commands are
  `npm --prefix app test`, `npm --prefix app run build`,
  `npm --prefix app run lint`. A worker running the root scripts gets a green
  result that proves nothing about its change.
- **The old `.tsx` include gap is fixed — do not repeat the stale warning.**
  PR #47 put `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']` into
  `app/vitest.config.ts`, so a `.test.tsx` file now *is* collected. Verified
  2026-09-18 by reading the config and by `npm --prefix app test`, which
  collects `app/src/shell/Toasts.test.tsx`. A Coder told the old "`.tsx` is
  silently ignored" story will avoid the one file layout the suite supports.
- **Test environment is `node`, not a DOM.** Same config, and it is deliberate.
  A file that needs a DOM opts in per file with a
  `// @vitest-environment happy-dom` docblock — `app/src/shell/Toasts.test.tsx`
  is the worked example. DOM-dependent tests without the docblock must build
  their own `Window`.
- **A fresh child worktree has no `app/node_modules`.** It is gitignored, and a
  git worktree does not share one (verified: `app-reviewer-9d668e` and `coder-1`
  have none; the two directories that do have one are ones where a worker ran
  an install). Every Coder/Tester/Fixer spec that builds, tests or serves the
  app must start with `npm --prefix app ci` — without it `vite build` and
  `vitest` fail in ways a worker misreads as a broken change.
- **The established pattern for testing a hook/component** is
  `app/src/lib/toasts.test.ts`: a `.ts` file, `createElement` instead of JSX,
  a hand-built `happy-dom` `Window`, and `react-dom/client` imported lazily so
  it never sees a document-less module scope. `@testing-library/react` is
  **not** a dependency. Point Coders at that file as the template rather than
  letting them invent an approach.
- Current coverage, for calibration: 5 test files / 39 tests against 99
  non-test `.ts`/`.tsx` source files, all in `app/` and counted 2026-09-18 with
  `npm --prefix app test`. Four of the five are `src/lib/` unit tests;
  `src/shell/Toasts.test.tsx` is the only component test. Treat "add a test"
  tasks as genuinely valuable, not as busywork.

## Tester

The Tester is a pipeline stage, not an on-demand tool: every PR that changes
`app/src` gets a Tester dispatch before the merge decision. It is the only stage
that observes the app *running*, so it is the only stage that can catch a change
that compiles, lints, passes the unit suite and still does not do what the issue
asked.

**Setup is the coordinator's job, done before the dispatch.** Install, build and
serve in the Tester's worktree, then hand the Tester a URL:

```
# coordinator, in the Tester's worktree, before worker-start:
npm --prefix app ci
npm --prefix app run build
npx vite preview --port <port> --strictPort      # one port per concurrent Tester
```

The spec then says: a server is already serving this worktree's `app/` on
`http://localhost:<port>`; **do not start a server, and do not use PowerShell
`Start-Process`**. To serve a different build, rebuild in place
(`npm --prefix app run build`) — the running server reads the files per request
— and add `?v=<epoch>` if a cached asset worries you.

Why the coordinator owns this, verified 2026-09-18: a Tester that launched the
server itself with `Start-Process ... -RedirectStandardOutput` hung forever,
because PowerShell waits on the detached child's inherited handles before the
command returns. Two Testers died that way mid-verification, one of them twice,
each burning a dispatch and 30-60 minutes of wall clock. The install and the
build also come off the Tester's critical path, which is where the machine's
disk and memory pressure used to break them.

`orca eval` takes one expression, and inline quotes, `?` and `:` get eaten by
the layers between the shell and the page. Write the expression to a file and
pass `orca eval --expression "$(cat expr.js)"`.

**The loop.** `orca tab create --url http://localhost:4173/` → `orca eval` to
assert → `orca click --element <ref>` to interact → assert again. Read page
errors with `orca console --json`: an empty `messages` array is itself a signal.
Verified 2026-09-18 — pass `--json`, because the default text renderer crashes
on an empty list (`Cannot read properties of undefined (reading 'length')`)
while `--json` returns `{"messages": []}` cleanly.

**Before/after is the point.** Asserting "the Compare tab works" on the PR head
proves nothing about the change; the same assertion has to fail on what preceded
it. In the Tester's worktree: observe the PR head, then `git checkout
<base-commit>`, rebuild, re-serve, re-run the identical assertion, then
`git checkout` back to the PR head. An assertion that passes on both sides has
tested nothing about the change — report that instead of a pass, and report
`before: not-run (<reason>)` when the change is genuinely non-behavioural
(docs-only, test-only, type-only). Never omit the line.

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
  whole. Measured 2026-09-18: `orca snapshot --json` is 251,578 bytes, of which
  127,747 is the text tree and the rest a `refs` map (`"e14": {"role":"tab",
  "name":"Compare"}`). Parse it and read `result.refs` directly — the app's own
  tab strip is `refs.e5` (tablist "Views") with `e12`/`e13`/`e14` =
  Tokens/Preview/Compare. Pass refs bare (`--element e14`), not `@e14`.
- **Retry once on `runtime_unavailable`.** The Orca runtime dropped a connection
  mid-session and recovered on the next call with no intervention. One retry,
  then report; do not treat the first drop as a failed dispatch.

What a Tester reports is the observed behaviour and the URL/DOM state it
observed it in — never "looks correct". A Tester writes nothing: no test, no
fix, no scratch artefact inside the repo. `git status --porcelain` in its
worktree must be clean after its `worker_done` (the dispatch's own
`opencode.json` aside); a diff on a tracked file means the Tester overstepped
and the dispatch failed whatever its verdict said. A discovered failure is a
finding, not a fix — it goes into the report, and a separate Fixer dispatch
fixes it.

## UI Audit

**A read-only role that hunts interface defects with evidence.** It exists because
the pipeline's other roles only ever look at what a PR touched: a Coder proves its
own change, a Reviewer judges the diff, a Tester verifies the issue's behaviour. None
of them looks at the interface as a whole, so whole-interface rot — a literal colour
where a variable belongs, an unreachable focus ring, a panel with no empty state —
survives every gate. The UI audit is that missing pass.

Contract, identical in shape to the Tester's:

  - **It writes nothing.** No test, no fix, no issue, no comment, no commit. Its
    permission block is the Reviewer's (`edit`/`write` denied, `orca`/`gh`/`curl`/git
    reads allowed) because it must be able to drive the browser and report.
  - **It drives the running app**, served by the coordinator on its own port, through
    Orca's browser automation: `orca tab create --url`, `orca snapshot` (accessibility
    tree with `@e1` refs), `orca eval --expression` for computed styles and arithmetic,
    `orca click`/`keypress`/`fill` for the interactive paths.
  - **Evidence is text.** A screenshot is not citable; every finding carries the
    selector or DOM path, the observed value, the expected value, the exact repro and
    a one-line fix. Contrast ratios are computed and printed with the two numbers
    divided, never eyeballed.
  - **Seven axes:** token discipline (values that bypass the 432 custom properties),
    contrast in both light and dark, keyboard and focus behaviour, legacy parity
    (behaviours the legacy viewer has and the port lacks, cited by file:line), state
    completeness (empty/loading/error per panel), layout robustness (overflow,
    clipping, truncation without an affordance), and dead or dishonest UI (controls
    that do nothing, labels that lie, duplicates).
  - **Plus the shell contract axis**, because the layout standard in `app/CLAUDE.md` is
    only real if something measures it: one scroller (`.app-main`) and no other
    element programmatically scrollable; the chrome's position measured before and
    after a rail click (a rail click once moved the whole layout by the topbar height);
    and no `overflow: hidden` on a layout container.
  - **A user-journey sweep comes first**, because a bug a user can feel outranks a nit a
    reader can find: drive the app's own journeys end to end — load a system, fetch a
    stylesheet by URL, edit a token value and Reset, compare two systems, export, copy a
    link, switch every tab and toggle every panel — and report each deviation from the
    expected or legacy behaviour with its measurement. Static reading is the fallback,
    not the method: a finding no journey can produce is a hypothesis and must be
    labelled as one, not written as a defect.
  - **It reports findings, the coordinator decides.** A finding is not a fix and not
    an issue: the coordinator triages the list into issues, Coders or Fixers. Capped
    at the ten worst per axis, because a list nobody can act on is worse than a short
    one they can.

## Model Assignment & Fallback

**Uniform by user decision, 2026-09-18: every worker role runs
`opencode-go/deepseek-v4.1-flash`.** Primary and fallback are the same id, by
instruction rather than because no second provider exists. What that costs is
spelled out below; the probe-driven table it replaces is kept as history in
`Model Selection Evidence`.

| Role | Primary | Fallback |
|---|---|---|
| Coder | `opencode-go/deepseek-v4.1-flash` | `opencode-go/deepseek-v4.1-flash` |
| Reviewer | `opencode-go/deepseek-v4.1-flash` | `opencode-go/deepseek-v4.1-flash` |
| Tester | `opencode-go/deepseek-v4.1-flash` | `opencode-go/deepseek-v4.1-flash` |
| Fixer | `opencode-go/deepseek-v4.1-flash` | `opencode-go/deepseek-v4.1-flash` |

Verified 2026-09-18 — the one claim in this section that was observed rather
than inherited: a project-level `<worktree>/opencode.json` holding
`{"model": "opencode-go/deepseek-v4.1-flash"}` resolves to exactly that id under
`opencode debug config`, the agent terminal's header reads `DeepSeek V4.1 Flash
OpenCode Go`, and two workers dispatched on it performed a real read and settled
with `worker_done` in 18s. What is **not** measured is this model in the Coder
and Reviewer seats specifically — the probe-per-role rule below still stands, and
that is the first thing to re-measure if it disappoints.

**The cost of uniformity, stated plainly.** The rule that a fallback must live
on a different provider is now deliberately broken: one rate-limit event on
`opencode-go` takes every role down at once, and there is no second provider to
walk to. So the exhausted-model rule below becomes the stop rule — on the first
rate-limit string, stop dispatching and escalate to the user, rather than
re-dispatching into the same wall. Do not quietly reintroduce a second provider
to fix that; choosing one is the user's call, not a dispatch decision.

The quota-derived reasoning that picked the previous table — Gemini's 1,500
request/day for volume, OpenCode Zen's 100/day for batch review, OpenRouter's
50/day account-wide bucket — is retained in `Model Selection Evidence` rather
than here, because none of it drives the assignment any more. It is still the
reference to re-open if the uniform assignment is ever revisited.

**A fallback must live on a different provider than its primary.** Quotas are
enforced per account per provider, not per model, so a same-provider fallback
shares the bucket that just emptied and fails for the identical reason. The
current table is a knowing exception to this, requested by the user; exceptions
are asked for, never assumed.

**Never pick a model for a role without probing that role.** The clearest
result of the measurement run: `openrouter/thinkingmachines/inkling:free` is
one of the best Reviewers available here (correct verdict, exact output format,
11s) and is **completely unusable as a Coder** — given a file to write it
mangled the Windows path to `/workspaces/...` and died on a permission
rejection. A single "best free model" does not exist; read-only reasoning and
file-editing tool use are different capabilities and must be measured
separately.

The Reviewer was previously chosen away from the Nemotron family deliberately.
All three of `mimo-v2.5-free`, `nemotron-3-ultra-free` and `inkling:free`
produced the correct verdict in the correct format, so the tiebreak was the
verified `worker_done` tax: Nemotron models in this project repeatedly finish
and then fail to settle, costing a nudge per dispatch (see Worker Communication
Protocol). That is still a rule — it just no longer selects the model, since the
assignment is uniform. The automatic nudge stays in force for whichever model
skips `worker_done`.

`openrouter/nex-agi/nex-n2.5-pro:free` was the original Coder primary but was
demoted after hitting OpenRouter's daily free-tier cap mid-run
(`Rate limit exceeded: free-models-per-day`) — not banned, just no longer the
default; use it only if the user asks or if every other free-tier option here
is also capped that day.

**One model backs every role, so one cap stops the pipeline.** A single
rate-limit event on `opencode-go` now exhausts Coder, Reviewer, Tester and Fixer
at once, and there is no second provider in the table to walk to. So: once the
rate-limit string appears, treat the model as **exhausted for the remainder of
the session** — stop dispatching, treat every in-flight claim as unsettled, and
escalate to the user with the exact string. Do not re-select the model and
rediscover the cap per dispatch, and do not silently substitute another
provider. This is run-scoped ephemeral state held in-turn, not a persisted
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

## Parallel Worker Spawning

Hermes spawns several workers at once — that is the shape of the pipeline, not
an optimization to defer. Nothing in the per-worker budget changes; running N
budgets concurrently is intended, and the bounds are the ones below.

**One Run, then a wave.** Bind one Run for the session and start every
independent worker of the wave *before* waiting on any of them:

```
orca orchestration run-create --objective "<cycle objective>" --from <coordinator_handle> --json
orca orchestration worker-start --spec "<worker A spec>" --terminal <handle A> --worktree "id:<wt A>" --run <run_id> --from <coordinator_handle> --json
orca orchestration worker-start --spec "<worker B spec>" --terminal <handle B> --worktree "id:<wt B>" --run <run_id> --from <coordinator_handle> --json
orca orchestration check --run <run_id> --wait --types "worker_done,escalation,question" --timeout-ms <n> --json
```

`--spec` creates the Task and its attempt in one call, replacing the separate
`task-create`; with a terminal and a worktree already prepared that is three
calls per worker instead of five. Verified 2026-09-18: two workers dispatched
back-to-back into one Run both started, both did real reads on
`opencode-go/deepseek-v4.1-flash`, and both settled with structured
`worker_done` lines 18s after dispatch.

**Deliveries are FIFO, one batch at a time.** A blocking `check` returns the
oldest unacknowledged delivery, not the whole wave — two workers settle into
two deliveries, and the second only arrives after `--ack <delivery_id>` on the
first. So the shape is: `check --wait` → process and release that dispatch →
`check --ack <delivery_id> --wait` → repeat until every dispatch of the wave has
settled. A timeout or an empty result is a checkpoint, never a failure, and
never a licence to re-dispatch.

**Heartbeats share that queue, and an ack is forever.** Workers emit `heartbeat`
messages on their own cadence, and those arrive in the same FIFO delivery
stream as settlements — so `check --wait --types "worker_done,..."` returns
promptly with a heartbeat-only batch, and the queue does not advance until that
batch is acknowledged. Two consequences, both paid for on 2026-09-18:

- A wait loop must ack heartbeat-only batches to make progress, and must **never
  ack a batch it has not parsed**. A helper whose summary parse failed acked
  three real settlements unread; the run only recovered because
  `check --all` replays every message for the handle without marking it read.
  `--all` is the recovery path for a settlement you believe you lost — reach for
  it before re-dispatching anything.
- Never conclude "it never settled" from a wait that timed out while
  `worker-list` still shows a live row for that dispatch: the message may be
  sitting behind a heartbeat batch, not missing.

**A waiting stage is not a reason to idle the pipeline.** Review and
verification are the long pole; a Coder costs one worktree, not a port or a
browser. While any PR is in review or under test, claim the next unclaimed issue
whose `app/src` area is free and dispatch its Coder — that is the intended
steady state, not extra credit. The 2026-09-18 cycle ran three Coders, then
review, then test with **no Coder working for forty minutes**; that
serialization is the failure this rule exists to prevent, and it is the shape to
avoid whenever "run the next stage" is mistaken for "wait for the wave".

**One preview port per concurrent Tester.** Every Tester serves the built app
with `vite preview`, and two Testers on one port collide. Name the port
explicitly in each Tester spec (4173, 4174, 4175, … — verified with four
Testers at once), and free the port before re-dispatching that Tester, because a
stalled dispatch can leave its `vite preview` listening.

**`--from <coordinator_handle>` is mandatory when calling from a plain shell.**
Invoked outside the coordinator's own Orca terminal, `run-create` and
`worker-start` are fenced with `consumer_fenced: worker-start requires the
coordinator terminal currently bound to the Task Run` until the Run is bound to
a handle. Pass the coordinator terminal's handle explicitly, and the same
identity on every call of the wave.

**Fan-out bounds.** One Coder per `app/src` area at a time (see the Issue-Label
State Machine) — a conflict rule, not a rate limit. Beyond that, size the wave
to what the coordinator can process: the budget assumes roughly one `check
--wait` per wave. Review and verification are per PR now, so the seats to fan
out are Coders and Testers; the Reviewer's cross-PR conflict block is what keeps
several live PRs from colliding at merge.

## Task Lifecycle

There is no separate lifecycle enum to keep in sync — the states live in the two
systems that already own them:

- **Orca** owns per-dispatch state: `ready` → `working` → `succeeded`/`failed`,
  `blocked` after an abandon, `abandoned` after a fence. Read it from
  `worker-list --run <id>`; never restate it here.
- **GitHub labels** own per-issue state, and the happy path is one label at a
  time: `in-progress` → `needs-review` → (`needs-verify`) → merged and closed,
  with `human-merge` as the user's hold. The Issue-Label State Machine section is
  the authority; this section deliberately repeats none of it.

A stage advances only on a structured `PASS`/`succeeded` signal or a green CI
check; never on Hermes's own inference from partial output.

**A claim is verified before it is fixed.** Every issue carries its provenance —
`reported:user` (the user saw it), `measured:live` (a worker observed it on a running
build), `scan:agent` (a code scan inferred it). An issue that has never been observed
live (`scan:agent` without `measured:live`) is **not a Coder task yet**: it goes to a
**claim verification** dispatch first — a read-only worker with the app served, whose
only job is to reproduce the claim and report the observed value, or `unreproducible`.
Verified → `measured:live`, and a Coder. Unreproducible → the issue is closed with the
record of the attempt.

Three rules make this cheap, and each one cost a real failure to learn:

  - **The dispatch text quotes the issue body.** It is never written from a summary: a
    summary once produced a task for a different issue than its card.
  - **Every fix PR contains something RED on the parent commit** — a failing test, or a
    live measurement that disagrees. A claim nobody can make red was never a defect.
  - **A worker that cannot verify says so.** `## Not verified` with the reason is a
    first-class result; a plausible-sounding gap filled by invention is the one outcome
    the gates cannot catch.

**Creating a task is the one step with no downstream check, so it carries its own.**
Before an issue is opened:

  - run `tools/orchestration/dupcheck.sh "<distinctive term>"` — a model asked "is this a
    duplicate?" answers from memory and is wrong, while the search is mechanical. (It
    paid for itself on its first run: the shell refactor's area already had three issues,
    #18, #16 and the closed #15.)
  - fill the evidence fields of `.github/ISSUE_TEMPLATE/agent-finding.md`: provenance,
    the reproduction, the **observed value**, the `file:line`, and how a fix would be RED
    on the parent. The observed value is the field that decides — a description of a
    defect is not evidence of one.
  - an issue that cannot fill them is opened with `repro:missing` and does not reach a
    Coder. It goes to a verification dispatch, or it is closed with the record of the
    attempt. Neither is a failure: "cannot verify" is a result.

**A confidence score is not a gate.** Asking a model whether it is more than 70% sure
returns "yes" from the same confident state that produced the wrong claim; the gate has
to be external and falsifiable — a reproduction someone else can re-run.

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
  → Hermes scans `--label needs-review`. CI red → dispatch a Fixer with the
    failing output and leave the label alone. CI green → dispatch the Reviewer
    and the Tester for that PR in ONE wave; they depend on the same gate and not
    on each other's verdict, so serializing them only adds latency
  → both PASS (Reviewer `scope_ok: yes`, Tester with real `observed:` and
    `before:` lines) → Hermes merges and closes the issue, unless the issue
    carries `human-merge`, in which case it swaps the label to
    `ready-for-review` and stops, and the user merges and closes
  → Reviewer FAIL → Hermes creates a Fixer Task referencing the PR/issue and
    puts the label back to `needs-review` so it re-enters the queue after the
    Fixer pushes
  → Tester FAIL → Hermes creates a Fixer Task carrying the exact observed
    behaviour and puts the label back to `needs-review`: a fixed PR is
    re-reviewed and re-tested, never re-tested on the Fixer's word
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

Labels in use: `human-merge` (**set by the user on the issue**; the only thing
that holds a PR back), `in-progress` (a Coder holds it), `needs-review` (PR
pushed, awaiting review), `needs-verify` (the PR is in a verification wave),
`ready-for-review` (pipeline-passed but held by `human-merge` — the user's turn).
`auto-ok` is retired as a gate: the pipeline merges on its own three signals (CI
green + Reviewer PASS + Tester PASS). Check `gh label list` and create missing
ones once with `gh label create <name> --color <hex>`.

**`needs-test` is retired.** The four issues that carried it (#41, #23, #21,
#15) were drained and closed; the label stays in the repo as history and is
never applied again. The Tester stage uses `needs-verify` — never revive
`needs-test`, whose old meaning was "run the suite", which is CI's job.

**The Coder — not Hermes — flips its own labels**, because the Coder is what
knows its PR is ready. Encode the exact
`gh issue edit <n> --add-label needs-review --remove-label in-progress` in
every Coder/Fixer Task spec, immediately after the push step. Hermes scans for
labels and dispatches the next role; it does not flip a label a worker owned,
except as a corrective action when a `worker_done` claims the flip and the
label is verifiably still missing.

**One Coder per file, one Coder per area as the proxy.** Parallel dispatch is
throughput, but two Coders editing the same file produce PRs that both pass CI
and then conflict on merge — and conflict resolution lands on the user, who did
not write either change. `strict: false` on the branch protection deliberately
does not force branches up to date, so nothing catches this for you. The real
invariant is the *file*: when the areas of two issues look claimed but their
file sets are disjoint (different files inside `lib/`, say), dispatching both is
correct — check the files, not just the subtree name.

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

**The backlog is user-owned, and so is the direction it grows in.** Each cycle
starts with `gh issue list --state open --label agent`. Dispatch a Coder against
an open, unclaimed issue; its number, title and body become the Coder Task's
spec. When no unclaimed issue is left: if the user has stated a focus for new
work, dispatch a Task Creator against that focus (see Task Creator); if they have
not, say the queue is empty and wait. What decides the *next* dispatch is not the
calendar but the pipeline's capacity — a free `app/src` area and the memory to
work in it. An Orca Task whose spec merely says `MISSING` or targets a
since-superseded local file is a stale-worktree artifact, not backlog; ignore it.

If an issue's scope is unclear, ask the user before dispatching. A Coder given
an ambiguous issue produces a PR the user then has to decipher, which spends
more of the user's attention than the question would have.

## Task Creator

Enabled 2026-09-18, on a leash. It runs **only** against a focus the user
stated — an area, a theme, "we have no issue for X", or an explicit instruction
to scan the **Default focus list** below. The list is a menu, not a standing
authorization: a user who names nothing has stated no focus, so the queue-empty
stop rule (see Continuous Operation Mode) stays reachable. The role exists to
turn the stated focus into a well-formed issue, not to generate a backlog.

- **Scope:** `app/` only, stated literally in the spec ("app/ only, not
  src/core, not preview/"). The *directory* is the boundary; the focus the user
  gave is the subject. Do not also filter by task category unless the focus is
  itself a category.
- **Output:** exactly one new GitHub issue per dispatch — `gh issue create
  --label agent` plus `bug`/`enhancement` — carrying the file and line
  references the model actually read and a `Verify:` line saying how the
  behaviour can be observed. An issue nobody can verify is not actionable here.
- **Dedupe:** read the open *and* closed list first
  (`gh issue list --state all --label agent --limit 200`). Do not re-propose
  anything open, closed as `wontfix`/`invalid`/`duplicate`, or already carrying
  a merged PR.
- **Cap:** one issue per cycle, and do not dispatch a Task Creator at all while
  12 or more unclaimed `agent` issues are open — the pipeline is already
  queue-bound, so a new proposal only adds latency.
- **Not its job:** implementing anything, writing a local task file, or widening
  the focus the user gave.

**Default focus list — a pre-approved menu, not an authorization.** When the
user states a focus (including "scan the default list"), take the smallest
verifiable task from it in this scan order. It is a set of suggestions the user
already approved, not a focus statement that fires on its own:

1. **Legacy parity gaps.** Behaviours the legacy code sitting beside `app/`
   (`preview/`, `src/`) has and `app/` has not ported — `export` is the named
   example. One-way: port the behaviour, never re-import a legacy quirk or bug.
   `app/` is the corrected port, not a copy of it.
2. **`preview/` item completeness.** Every gallery section, screen, component
   and control `preview/` renders should exist in `app/`.
3. Missing test coverage.
4. Accessibility.
5. Performance.
6. Dead code.
7. Error-message consistency: the same failure says the same thing in the same
   tone, everywhere it can happen.
8. **Token discipline.** Every visual value bound to the token set —
   `app/src/tokens/tokens.css` defines **432** custom properties (verified
   2026-09-18; 449 across all of `app/`'s CSS). No hardcoded colour, size, font
   or spacing outside that set.
9. None of the above is satisfied by "it compiles": the behaviour has to work
   without errors when the app actually runs, which is what the Tester stage
   verifies and what the issue's `Verify:` line must be written for.

One issue per cycle, taken from whichever item yields the smallest verifiable
task. The list is a scan order — it is not a licence to widen the scope of an
issue once written, and it does not override the `app/`-only directory boundary.

It reports `status: succeeded` plus `issue: <number>`, or `status: failed` with
`reason: no remaining proposal in <focus>` — an exhausted focus is a valid,
useful outcome and is not retried.

## Failure & Recovery Policy

1. A dispatch has failed when any of these holds: `worker_done outcome:
   failed`; an `escalation` message; the rate-limit string in the tail; or a
   **stall**.
2. **Stall definition (concrete).** Two terminal reads at least 90 seconds
   apart return an identical tail, with no settlement and no active spinner or
   tool call. One read never proves a stall. A **frozen token/cost counter**
   across those reads is equally decisive even when the TUI still paints a
   spinner — observed 2026-09-18 on a Tester: fifteen minutes of identical
   frames, `23.4K (2%) · $0.00` unchanged, `attention=stale`, liveness
   `unverifiable`. 90s is a chosen default, not a measured optimum — adjust it
   if a legitimately slow model trips it.
3. Start a **fresh** child worktree + terminal with the fallback model's
   `opencode.json`. Do not reuse the failed worktree or terminal. Free the port
   first if the dead attempt was a Tester — its `vite preview` can still be
   listening.
4. **Free the Task before re-dispatching it.** A dispatch that never settled
   leaves its Task `dispatched`, and a plain `worker-start --task <id>` is then
   refused with `task_not_startable` ("only a ready Task can start" / "the Task
   already has an active Dispatch"). Fence the dead attempt first:
   `orchestration worker-abandon --dispatch <old_dispatch_id>` — verified
   2026-09-18, it returns `state: abandoned` with
   `Possibly-live resources were retained; no process was stopped or deleted`.
5. The abandon flips the Task to `blocked`, which plain re-dispatch also
   refuses, so the re-dispatch is
   `worker-start --task <task_id> --retry-of <old_dispatch_id>` with the fresh
   terminal and worktree. Verified accepted immediately after the abandon.
   `--retry-of` is therefore **the normal retry path for a dispatch that failed
   without settling**, not an escalation-tier tool. It stays invalid while the
   old dispatch is still active and needs the Task `failed`/`blocked` — which is
   exactly what the abandon produces. A dispatch that settled with
   `outcome: failed` is the other case: that Task is still `ready`, and there
   plain re-dispatch on the same Task ID is correct.
6. Cap at 3 attempts per Task; after that Orca's own dispatch circuit breaker
   marks the Task `failed`. Do not layer a second retry counter on top. At that
   point escalate to the user; do not keep retrying.
7. Never re-run a worker that already succeeded "to compare" or "to be sure."
8. **A retry that changes the instructions needs a new Task.** `--task` and
   `--spec` are mutually exclusive, and `worker-start --task <id> --retry-of
   <dispatch>` replays the spec stored on that Task. So a retry whose spec must
   change — a rewritten harness, a corrected port, a constraint the worker
   misread — cannot reuse the Task: create it fresh with `--spec`, and accept
   that the old Task stays `blocked`, which is an honest record of the attempt
   that failed. Verified 2026-09-18, when a Tester retry had to be a new Task
   precisely because its stored spec contained the sequence that had wedged it.

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

Tester:

```
status: pass | fail
observed: <what actually happened, one line, as it was observed>
before: <the same assertion against the base commit, or: not-run (<reason>)>
evidence: <the URL / DOM state / console result the observation came from>
fix_required: <short actionable instruction, only if fail>
```

A Tester `pass` with no `observed:` and no `before:` line is not a pass — it is
an unverifiable claim, the same class as a missing `worker_done`, and it goes
back to the Tester rather than forward to a merge.

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
- **Both identities land on the merged commit.** The worker's branch commit
  carries the role tag and `orca-<role>` as author, and its body must also name
  the human: `Co-authored-by: erne <ernmctt@gmail.com>`. At merge time Hermes
  squashes with `--subject "<subject> (#<n>)"` — the tag survives in the subject
  — and a `--body` carrying `Co-authored-by: orca-<role>
  <orca-<role>@localhost>`, because a squash re-authors the commit to the merging
  account. Without that trailer the worker's identity is gone from the base
  branch entirely. Verified failure: the four merges made before this rule
  (`6cf38f9`, `e425c79`, `df02f59`, `30c162d`) carry `[coder]` in the subject and
  only `erne` as author — the worker author survives on its own branch and
  nowhere else.
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
- **The pipeline decides, not a label.** Hermes merges the moment all three
  signals are in hand — CI green on the `app` check, Reviewer PASS with
  `scope_ok: yes`, and Tester PASS with real `observed:`/`before:` lines — and
  then closes the issue, in the same turn. All three, always; nothing else
  authorizes a merge, and no fourth signal is waited for.
- **The opt-out is one label the user sets on the issue: `human-merge`.** With
  it, the PR is left at `ready-for-review` for the user to read and merge. This
  replaced the old opt-in (`auto-ok`): waiting for a human on every PR handed
  the pipeline's throughput to the user, while the three signals above are what
  the gate was actually protecting. Hermes never adds or removes
  `human-merge`.

  `human-merge` is set by the user — when they write the issue, or later — because
  they already know whether this one is worth reading themselves. Its accuracy
  is not machine-checked anywhere, deliberately: the cost of being wrong is one
  PR merged that the user would have wanted to read, and the Reviewer's "changed
  nothing the issue did not ask for" rule plus the Tester's before/after evidence
  are what guard the default path.
- `delete_branch_on_merge` is enabled, so the merged head branch is deleted
  automatically. The explicit remote-branch deletion in the cleanup checklist
  is now only needed for branches abandoned without a merge.
- Squash-merge unless the repo's convention says otherwise. All merged PRs base
  onto `refactor/full-react-migration`.
- Whoever merges also closes the issue — `gh issue close <n>`. GitHub will not
  do it (see the Issue-Label State Machine), so for a `human-merge` PR that step
  belongs to the user, and for everything else to Hermes at merge time.
- Coder/Fixer must commit **and push** — Reviewer worktrees cannot see
  uncommitted changes in a sibling worktree, and `--base-branch` off a branch
  with only uncommitted work silently falls back to that branch's last real
  commit.
- A PR is **done** when it is merged, or labelled `ready-for-review` because the
  issue carries the user's `human-merge`. Either way Hermes stops touching it and
  moves to the next issue.

## PR Body

Most PRs are read by the Reviewer and then merged by the pipeline; only
`human-merge` ones reach the user. So the body is a short audit record, not an
essay. Four headings, from `.github/pull_request_template.md`:

```
## What this changes     — links the issue, one plain paragraph
## Verified              — pasted command output, and observed behaviour if UI changed
## Not verified          — what nobody checked, and any known risk
## Scope                 — app/ only, nothing unrelated touched
```

One rule carries the weight: **evidence, not assertion.** `tests: pass` is a
worker's belief; CI is the authority on lint, types, build and unit tests, so
repeating those claims adds nothing. What the body must add is what a machine
did not check — which is exactly what `## Not verified` is for. A worker that
writes "I did not check the other callsites" is doing its job, not confessing.

`gh pr create --body` bypasses the template silently, so the Coder Task spec,
not the template file, is what actually enforces these headings.

## Model Selection Evidence

**History, not the current assignment.** The assignment is uniform
`opencode-go/deepseek-v4.1-flash` (see Model Assignment & Fallback); everything
below records the 2026-09-18 probe run that chose the table it replaced, and is
kept so that re-picking a model stays a measurement rather than an opinion. Two
probes, run through every plausible free candidate on this host, 2026-09-18.

**Provider quotas, researched 2026-09-18 and then probed.** The published limit
and the usable limit are different numbers; both columns matter.

| Provider | Published free limit | What a probe actually did |
|---|---|---|
| `google` | Gemini 3 Flash: 1,500 req/day, 10 RPM, 250k tok/min | Passed both probes with real tool use. The only candidate whose quota also fits sustained agent work |
| `opencode` (Zen) | not published | `muse-spark-1.3` 4/4 Coder, `mimo-v2.5` correct Reviewer. No cap seen in this project's history |
| `orcarouter` | not published | `deepseek-v4-flash-free` 4/4 Coder |
| `openrouter` | **50 req/day account-wide**, all `:free` models sharing one bucket | Works per call, but the bucket is far too small for agentic dispatch — this is what the recorded `free-models-per-day` failure was |
| `groq` | 1,000 req/day, but **8,000 tok/min** | **Could not complete one request.** The agent's own context is ~14k tokens: `Limit 8000, Requested 14170`. Structurally unusable here, not merely tight |
| `cerebras` | 1M tok/day, but **8,192-token context cap** | Not probed — the context cap alone cannot hold a file plus instructions |
| `mistral` | ~1B tok/month, but **2 RPM** | `codestral-latest` 4/4 in 10s (fastest correct Coder), then `magistral-medium` hit `Rate limit exceeded` on the very next call. 2 RPM cannot support parallel dispatch |
| `nvidia` | 40 RPM account-wide | `nemotron-3-super-120b` correct Reviewer in 27.7s. `qwen3-coder-480b` returned **410 Gone — end of life 2026-06-11** |
| `deepseek` (native) | paid | `Insufficient Balance` on both flash and pro |
| `apinex` | advertised as free | `qwen-3.8-max` demands a subscription |
| `tokenrouter` | — | `glm-5.3-free`: no available channel |

Read that table as one lesson: **a free tier fails in whichever dimension you
did not check.** Groq's request/day looked generous and its tokens/minute made
it useless. Cerebras's tokens/day is the largest here and its context cap makes
it useless. Mistral has a billion tokens a month behind a 2-requests-minute
door. OpenRouter publishes per-model pages and enforces one account-wide
counter. Check requests/day, requests/minute, tokens/minute, tokens/day and
context window before adopting a model, then probe it anyway.

Runners-up worth remembering, in case a primary has to be replaced:
`mistral/codestral-latest` (correct and fastest, but printed rather than wrote
the file, and 2 RPM), `nvidia/nemotron-3-super-120b-a12b` (correct Reviewer,
40 RPM shared, Nemotron `worker_done` tax), `opencode/nemotron-3-ultra-free`
and `openrouter/thinkingmachines/inkling:free` (both correct Reviewers, both
carrying a tax — Nemotron's settle failure, OpenRouter's 50/day bucket).

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
| `google/gemini-3-flash-preview` | correct | exact | 16.6s |
| `nvidia/nvidia/nemotron-3-super-120b-a12b` | correct | exact | 27.7s |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | no output in 10+ min | — | — |
| `groq/openai/gpt-oss-120b` | unusable — 8k tok/min < 14k context | — | — |
| `mistral/magistral-medium-latest` | unusable — `Rate limit exceeded` at 2 RPM | — | 80.9s |
| `deepseek/deepseek-v4-pro` | unusable — `Insufficient Balance` | — | 13.4s |

**Coder probe** — write one small module under four mechanically checkable
constraints (named export, specific edge-case behaviour, exactly one WHY
comment, explicit `.ts` import extensions).

| Model | Constraints | Tool use | Time |
|---|---|---|---|
| `opencode/muse-spark-1.3-contributor-free` | 4/4 | read the dir, wrote the file | 20.8s |
| `orcarouter/deepseek/deepseek-v4-flash-free` | 4/4 | globbed, wrote the file | 22.1s |
| `google/gemini-3-flash-preview` | 4/4 | wrote the file | 20.9s |
| `mistral/codestral-latest` | 4/4 | printed only, never wrote | 10.1s |
| `openrouter/cohere/north-mini-code:free` | 3.5/4 | printed only, never wrote | 17.4s |
| `openrouter/thinkingmachines/inkling:free` | 0/4 | **mangled the Windows path**, permission-rejected | 14.2s |
| `groq/openai/gpt-oss-120b` | — | unusable — 8k tok/min < 14k context | — |
| `deepseek/deepseek-v4-flash` | — | unusable — `Insufficient Balance` | 9.6s |
| `nvidia/qwen/qwen3-coder-480b-a35b-instruct` | — | unusable — **410 Gone**, EOL 2026-06-11 | 6.0s |

Three findings worth carrying forward:

- **`free` in a model id does not mean usable.** `apinex/free/qwen-3.8-max`
  demands a subscription; `glm-5.3-free` has no channel; `glm-5.2:free` has no
  tool-use endpoint. Probe reachability before planning around a model.
- **A false PASS is the worst Reviewer failure and it is not rare.**
  `laguna-s-2.1` spent 50s and approved code with an obvious bug. A Reviewer
  that never fails anything is indistinguishable from no Reviewer.
- **Bigger is not better on free tiers.** The 550B Nemotron produced nothing in
  ten minutes; the fastest correct Reviewer took nine seconds.

## Review

One Reviewer dispatch per PR, in the same wave as that PR's Tester: they depend
on the same green `app` check and not on each other's verdict, so serializing
them only adds latency.

Batching (3-5 PRs per dispatch) existed for a quota that is no longer in play —
OpenCode Zen's 100 requests/day. The current model has no such cap, so the batch
is gone and per-PR review is the shape. What batching bought is kept as one
extra block, because it is the one thing a per-PR read cannot see.

**Input** per PR: the issue body, `gh pr diff <n>`, the PR body. Nothing else.

**Output** — one block per PR:

```
pr: <number>
status: pass | fail
reason: <short, only if fail>
fix_required: <short actionable, only if fail>
scope_ok: yes | no        # did it change anything the issue did not ask for?
```

**A report missing the block for the PR it was dispatched on is rejected whole**
— same class as a missing `worker_done`. Never infer a PASS for a PR the
reviewer did not name.

`scope_ok` is load-bearing, not decoration: the pipeline merges on the
Reviewer's word, so this field is the only thing standing between an
over-reaching Coder and an unreviewed merge. A `no` blocks the merge regardless
of `status` — Hermes holds that PR for the user and says why.

**Cross-PR conflicts are the one thing a per-PR review structurally cannot see.**
Every PR branches from the same base with `strict: false`, so two PRs touching
one file both report green and collide only at merge. When more than one PR is
open or in flight, ask the same Reviewer for one extra block:

```
conflicts: <pr>+<pr> on <path> | none
```

Require it even when it is `none`. A line naming two live PRs means: hold the
later one and report it, never merge into a known conflict.

## Continuous Operation Mode

Once started, Hermes runs cycles **back-to-back without stopping for
confirmation** — open issue → Coder → CI → review → Tester → merge
(`human-merge` held) → next issue. It does not wait for the user on a
`human-merge` PR before starting the next issue; those queue up while work
continues.

It stops when the user says stop, when the queue is empty and the user has stated
no focus for new work, or when a wave has no resources left to grow into (no
free `app/src` area, no free memory). An empty queue **with** a stated focus is
Task Creator's turn, not a stop; an empty queue without one is a stop, not a
prompt to invent work.

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
- **The coordinator's own context is the one thing that does not survive a long
  run — so compression runs itself.** Hermes's context compression is enabled
  (`compression.enabled: true`, `compression.threshold: 0.75`,
  `compression.progress_notices: true`; verified with
  `hermes config get compression`), and `/compact` (`/compress`) forces one by
  hand when the coordinator wants a checkpoint. Because every fact above is
  re-derivable from Orca and GitHub, a compressed coordinator loses nothing it
  needs: after a compression, re-read `worker-list --run <id>`, `task-list` and
  `gh pr list` rather than trusting a remembered dispatch id, and never assert
  an in-flight state from memory.
- **Compact at a stage boundary, not mid-dispatch.** Compression is safest when
  nothing is half-decided: between processing a settlement and issuing the next
  dispatch, or between cycles. If a compression notice arrives while a dispatch
  is mid-flight, finish that settlement's bookkeeping — ack, release, labels,
  merge — first, then continue.

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
- **Never fabricate a model ID, a test result, or a "verified" claim.** The
  words carry evidence requirements: `verified` is a command this run ran with
  its output quoted; `observed` (Tester) is a DOM/URL/console fact read from the
  running app, named with the URL it was read at; `PASS` (Reviewer) is a
  judgement with the file:line it rests on. Anything without its evidence is
  `assumed` — and an unverifiable result is never reported as success. The
  honest alternatives are `status: failed`, `before: not-run (<reason>)`, or a
  question to the user.

## Cleanup Checklist

Before dispatching any worker:

- [ ] Task spec states target, change, constraints, the relevant `app/` Facts,
      and the structured output-line format.
- [ ] For a Tester spec: the PR branch, the issue's exact reproduction steps,
      and the base commit the before/after assertion compares against (`npm
      --prefix app ci` first — a fresh worktree has no `app/node_modules`).
- [ ] Child worktree created from the correct base branch (one `git log -1` in
      the new worktree for the run's first worker on that branch; skip after).
- [ ] `opencode.json` written with the role's primary model, and that model is
      not in the session's exhausted set.
- [ ] Terminal started, `tui-idle` reached, `worker-start` bound.

Before advancing a stage:

- [ ] Settlement message received with a structured status line.
- [ ] For a Coder/Fixer: integrity check done (SHA differs from pre-dispatch
      HEAD, author is `orca-<role>`, subject carries the role tag).
- [ ] For a Tester: `git status --porcelain` clean in its worktree, and its
      report carries `observed:` plus a `before:` line — or an explicit
      `not-run (<reason>)`.
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

## The merge gate is GitHub's, not the coordinator's

Reading three signals by hand (CI green, Reviewer PASS, Tester PASS) has one failure the
coordinator cannot check reliably: whether each verdict was produced against the *current*
head. It got that wrong once — a Tester verified a build provisioned from the wrong
branch and the PASS looked perfectly valid.

So the gate is a **commit status computed by GitHub** (`.github/workflows/pipeline-gate.yml`):

  - every Reviewer and Tester posts its verdict as a PR comment in a fenced block:

        ```dsv-verdict
        status: pass
        role: reviewer
        commit: 422f8cb
        scope_ok: yes
        ```

  - the workflow parses comments and reviews, keeps the latest verdict per role **whose
    `commit:` matches the PR head**, and posts `pipeline/verdict` on that head: success
    only when reviewer=pass with `scope_ok: yes` AND tester=pass on the same head;
    failure otherwise; pending while a verdict is missing. A verdict without a commit, or
    from an older head, can never approve anything.
  - a PR that changes nothing under `app/src/` is **not applicable** and passes
    automatically, so documentation and tooling PRs do not wait for reviewers they do
    not need.
  - **branch protection requires `pipeline/verdict` alongside `app`**, with
    `enforce_admins: true`, so the coordinator cannot merge a PR the machine has not
    approved even by accident. That is the point: the coordinator's judgement is no
    longer load-bearing at the gate.

**The maintainer's channel is comments, parsed literally.** `/hold` freezes a PR (the
status goes red and stays red), `/rework` sends it back for a fix, `/resume` clears both
— accepted only from `OWNER`/`MEMBER`/`COLLABORATOR`, and each answered with a comment so
the thread records what happened. Free-text comments are still read by the coordinator
(`tools/orchestration/reviews.sh`), which routes them to a Fixer; a comment is not a
verdict and cannot approve, which is deliberate — only the machine-readable block moves
the gate.

## Failure Ledger

Incidents already paid for. Each is a rule above; this table is the index so
the rules do not have to carry their narrative.

| Symptom observed | Rule it produced |
|---|---|
| `pipeline.py` duplicated Orca's task/dispatch state | No second state layer; stateless mechanism is fine |
| Specs told workers to run `orca orchestration message send` / `worker-done` — neither command exists | The exact CLI call, flags included, belongs in the template: a worker that has to guess the spelling of the command it reports with is a worker that reports nothing |
| An empty `worker_done` arrived (`subject: probe`, empty body) after the worker sent a placeholder first | `worker_done` is one-shot: a settled dispatch revokes the reporting capability, so a placeholder burns the settlement and the real body never lands. State both rules in every template: `--outcome=succeeded` (equals form) and write the body before you send. The coordinator's recovery path is the retained terminal, which is authoritative |
| A worker asked permission to touch `D:\` — outside its worktree — and sat waiting for an answer | Every worktree's `opencode.json` (written by `spawn.sh`) carries a permission block: `external_directory: deny` (no prompt, an immediate no), everything inside the worktree allowed, destructive git/rm patterns denied, and a Reviewer additionally has `edit`/`write` denied so its read-only contract is machine-enforced. A prompt is a stall the coordinator has to notice; a deny is a result the worker can report. `attention.sh` lists whatever still waits on a human, with the terminal tail and the exact reply command |
| The wake-up loop spun on one stale settlement for two hours | `--ack` takes the **delivery** id (`result.deliveryId`), not the message id (`msg_...`, which returns `ok:false` and acks nothing); and an unacked settlement is redelivered to every new waiter instantly, so a watcher started on a dirty queue reports old news as if it were the wake-up. Drain before arming: `watch.sh --skip-existing` |
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
| A user-reported layout shift ("the whole layout jumps up ~50px when I click a rail item") turned out to be `overflow: hidden` on the shell plus an anchor without `preventDefault`: hidden still scrolls programmatically, and native fragment navigation walks every scrollable ancestor | A one-line patch fixes the symptom; the class of bug needs a standard. The shell contract now lives in `app/CLAUDE.md` (one frame, one scroller, `overflow: clip` instead of `hidden`, in-app scroll targets the content scroller), is enforced by `shell/shellContract.test.ts`, and is measured every audit by the shell axis. When a bug is a layout *invariant* violation, write the invariant down and make something check it |
| Every open issue was treated as a fact, and two claims turned out to be wrong: the coordinator's dispatch text for #27 described a different issue than its card, and a Reviewer's "`.app-toast-warn` is absent" was half wrong (the class was applied; only the CSS rule was missing) | A claim is verified before it is fixed. Provenance labels (`reported:user` / `measured:live` / `scan:agent`), a claim-verification dispatch for anything never observed on a running build, a reproduce-first STEP 0 in the Coder and Fixer templates, and the hard rule that every fix PR contains something RED on the parent commit — a claim nobody can make red was never a defect |
| A bare `role=tab` query matched 9 elements, 6 of them gallery demos | Scope selectors to `.app-tabs` / the app's own container, in Orca and Playwright alike |
| A Coder was handed dispatch text that described a different issue than its card — I wrote "an override on an undefined token is lost" for #27, whose real subject is "value-edits became permanent; Reset only clears swaps" | The coordinator's dispatch text is derived from the issue body — `gh issue view <n>` first, quoted — never from a summary or a filename. The worker caught it and asked; a less careful worker would have built the wrong feature and passed every gate |
| Three Reviewers finished their analysis and could not report: `orca orchestration send` was denied by the reviewer permission allowlist I had just written (`gh`/`git`/`ls` allowed, `orca` missing) | Any read-only permission block must allow `orca *`. Reporting is the worker's only exit; a blocked report leaves a live-looking dispatch and an idle phase, and the verdict has to be recovered from the terminal by hand |
| Two Coders sent correct reports that Orca rejected: `dispatch_capability_invalid`. They had retyped the send command from a template | The command comes from the dispatch preamble, verbatim, because it carries a per-dispatch capability token no template can contain. Quote the rejection string in every template so the failure is recognisable |
| Three reaped Testers left live preview servers behind — 176MB free RAM, 37 node processes, and a `fork: Resource temporarily unavailable` that killed a spawn | A preview is started outside Orca's worktree lifecycle, so `reap.sh` does not kill it. Every Tester reap is followed by `serve.sh --stop <port>` |
| A full `orca snapshot` of the app was 251 KB | Assert with targeted `eval`; use `snapshot` only to obtain a ref, filtered |
| Tester dispatched to run `tsc`/`npm test` — a worker spent on a deterministic check it could misreport | Division of Labour; CI owns machine-decidable checks |
| Root `npm test` green while testing zero `app/` code | All commands `--prefix app`, stated in every spec |
| `.tsx` test with a failing assertion silently not collected; suite exited 0 | `app/` Facts must state the *current* config — the include glob was fixed in PR #47, and a stale warning steers Coders away from the layout the suite now supports |
| PR #42 merged without its `[fixer]` role tag | Attribution verified via `git log -1`; hook recommended |
| `Closes #15/#21/#23` on merged PRs #44/#45/#46 closed nothing; issues still open and labelled | Auto-close needs the default branch; Hermes closes issues explicitly |
| Two workers settled into one Run, but the first `check --wait` returned one delivery | Deliveries are FIFO — ack the delivery, then check again for the rest of the wave |
| `worker-start` refused with `consumer_fenced` for a Run created from a plain shell | Bind the Run to a coordinator handle and pass `--from <handle>` on every call of the wave |
| `orca console` (text renderer) crashed on an empty log: `Cannot read properties of undefined (reading 'length')` | Read console logs with `orca console --json`; `{"messages": []}` is the valid empty answer |
| `worker-release` on a manually created terminal returned `state: retained, reason: external_terminal` | Manually created terminals are external — release does not stop them; close the terminal explicitly |
| A fresh child worktree had no `app/node_modules`, so `vite build` and `vitest` failed as if the change were broken | `npm --prefix app ci` is the first step of every spec that builds, tests or serves the app |
| A stalled Tester left its Task `dispatched`; plain re-dispatch was refused twice with `task_not_startable` | Free the Task with `worker-abandon`, then re-dispatch the same Task with `--retry-of` |
| A wait helper acked a batch whose summary had failed to parse, swallowing three settlements unread | Never ack a batch you have not parsed; recover with `check --all`, which replays without marking read |
| Worker `heartbeat` messages share the FIFO delivery stream with settlements, so `check --wait` returns on them | Ack heartbeat-only batches to advance the queue, and do not read a timeout as "it never settled" while `worker-list` shows a live row |
| Three Coders ran to completion, then review and test ran with no Coder working for ~40 minutes | Keep a Coder in flight for every free `app/src` area while a review or verification wave is waiting |
| Two Testers would have shared `vite preview` port 4173 | One named port per concurrent Tester, freed before a re-dispatch |
| A stalled dispatch showed a frozen tail *and* a frozen token counter while `attention=stale`, liveness `unverifiable` | Stall evidence includes a frozen counter, not only a frozen tail — abandon and retry instead of waiting indefinitely |
| The new Reviewer model returned 4/4 PASS with no findings on its first real batch | Not proof of a bad Reviewer, but exactly the profile of one — the planted-bug probe for this model is still outstanding (Known Gaps) |
| A worker launched `vite preview` via PowerShell `Start-Process ... -RedirectStandardOutput`; its tool call never returned | The coordinator installs, builds and serves before the dispatch; the spec forbids the worker from starting any server |
| `npm ci` died with `TAR_ENTRY_ERROR ENOSPC` and the failure read like a broken install | Check free disk before blaming a change; a full disk breaks installs and slows every build on the box |
| `orca` calls inside a background (non-TTY) shell returned `stdin is not a tty`, and a pipe swallowed the exit code | Keep orca calls in the foreground; background only `npm` steps |
| A worker abandoned with `worker-abandon` kept heartbeating; Orca rejected it `dispatch_capability_invalid` | The process is still alive after an abandon — close its terminal and remove its worktree explicitly |
| One `npm ci` took 80s alone and 4.5 minutes with three siblings on the same box | Concurrency is not free: installs and builds contend, so a wider wave has a wall-clock ceiling and disk pressure makes it worse |

## Known Gaps

Real, unfixed, and not to be papered over.

- **Behavioural verification needs this desktop awake.** The Tester drives the
  real app through Orca's built-in browser and is a pipeline stage (see Tester),
  so it does gate a merge — but only on a machine where the Orca desktop is
  running. A client-hosted page renders in the paired desktop's browser engine
  and every command returns `browser_host_unavailable` while that desktop is
  closed, so it can never run in GitHub Actions. A Tester dispatch that hits
  that reports `status: failed` with the exact string, never a pass: **a green
  CI check still does not mean the UI works.** CI proves it compiles, lints and
  passes the unit suite; behaviour is proven by the Tester, or by the user when
  the desktop is down.
- **CI's unit-test leg is thin, and the `.tsx` gap is closed.** The
  `vitest.config.ts` fix landed in PR #47 (`.tsx` added to `include`, with
  per-file `happy-dom` opt-in via docblock), so the "a component test is added
  and silently never collected" trap is gone. What remains is volume: 5 files /
  39 tests against 99 non-test source files, one component test. Growing that is
  Coder work in the normal issue flow, not a coordinator-side edit.
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
- **The Reviewer seat has not been *measured* for the current model.**
  `opencode-go/deepseek-v4.1-flash` was verified as a dispatch (it starts, reads,
  settles). Its first Review batch came back **4/4 PASS, `scope_ok: yes`, no
  findings** — fast, cheap, and exactly the signature the Failure Ledger records
  for `laguna-s-2.1:free`, the Reviewer that once approved a diff with a missing
  `setTimeout` cleanup. Then, on PR #59, the same model returned **`fail`** with
  three specific findings, quoted the PR's own measurement back at it (the probe
  showed a call-count win but 15.64ms new vs 1.80ms old in wall time), a Fixer
  closed all three, and a second review confirmed each closure file:line by
  file:line. So it is not a rubber stamp — but "it failed one PR well and passed
  four others" is not a score either. The planted-bug probe (a diff with a known
  defect, scored on whether the Reviewer finds it) is what would make this
  measurable, and it is still outstanding.
- **Token/tool-call savings** in this document are measured only for the one
  comparison run in this project's history. They are not a guaranteed
  percentage for future tasks. Cost data points from 2026-09-18, for scale: a
  13-minute Tester dispatch (install, two builds, browser verification) reported
  **$0.02** and 48K tokens on `opencode-go/deepseek-v4.1-flash`.
