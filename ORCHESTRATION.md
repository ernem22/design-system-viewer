# Orchestration — the manager's manual

The unattended pipeline for this repository: an `agent` issue becomes a PR, the PR is reviewed and
tested, and the gate merges it. **The owner** writes the issues and does the final test. **Hermes**
manages the pipeline, and this file is its manual. Hermes reads it at the start of every session;
when reality differs from it, the file is corrected in place.

The previous version (1850 lines, written when Hermes drove every worker by hand) is kept in
`docs/orchestration/archive/coordinator-era-2026-10-07/ORCHESTRATION.md`. Do not follow it.

## Who does what

| Who | What | Never |
|---|---|---|
| Owner | writes `agent` issues, decides product questions, does the final test, approves model lists | — |
| Dispatcher (`tools/orchestration/dispatch.sh`, a script) | turns owed work into specs, starts/polls/closes workers, delivers their work (commit, push, PR), posts verdicts, merges what the gate passed, drops specs that are no longer owed | decide anything that is not a fixed rule |
| Workers (OpenCode in Orca) | Coder, Fixer, Reviewer, Tester: one task each | know about each other or about Hermes |
| **Hermes** (LLM) | keeps the pipeline healthy, judges what a script cannot, and tells the owner what to test | write code, commit, push, merge, start/stop a worker by hand, `kill` anything |

The pipeline flows without Hermes: if Hermes is down, work still starts, settles, and merges. Hermes is
the reason it keeps flowing when something outside the rules happens.

## Where things are

- Dispatcher checkout: `D:/code/dsv-dispatcher` (detached on the base branch). Owner's clone:
  `D:/code/design-system-viewer`. The dispatcher reads only its own checkout.
- State: `S=$LOCALAPPDATA/orca-orchestration/design-system-viewer`:
  - `events.log` (one line per event), `dispatch.log` (narrative), `dispatch.err` (bash errors);
  - `queue/`, `running/*.env` (live workers), `done/<spec>.<outcome>` (results);
  - `report-<task>.txt` (a worker's report), `tail-<task>.txt` (a worker's last screen);
  - `dispatch.enabled` (acting), `dispatch.paused` (paused, with the reason).
- Role models: `tools/orchestration/roles/{write,readonly,tester}.opencode.json` (`write` = Coder and
  Fixer, `readonly` = Reviewer). The fallback order, approved by the owner: `roles/fallback.txt`.
- Keep-alive: the Task Scheduler task `dsv-dispatcher` runs `bootstrap.sh` every 5 minutes. It starts
  a dispatcher when none is alive.
- Reference: `docs/orchestration/reference/roles.md` (events, delivery, merging) and `dispatcher.md`
  (limits, outcomes).

## Cold start (every session, before anything else)

1. Run `bash D:/code/dsv-dispatcher/tools/orchestration/hermes-start.sh`. It reports:
   - the code version and any local changes;
   - whether the dispatcher is alive (it restarts a dead one through `bootstrap.sh`);
   - the keep-alive task;
   - acting, paused or neither;
   - disk and memory;
   - one probe per role model;
   - running and queued work, and the last events;
   - attention events the last watcher did not hand over;
   - `agent` issues that have not been through intake.

   It ends with a `todo` list.
2. Do the todo list, using the duties below.
3. Arm the watcher: run `bash D:/code/dsv-dispatcher/tools/orchestration/hermes-watch.sh` **in the
   background with notify-on-complete**. Its exit is your wake-up.

The owner's only part in a cold start is to start Hermes. Hermes's persistent instructions must say:
"At session start, read `ORCHESTRATION.md` in `D:/code/dsv-dispatcher` and follow Cold start."

## The loop

The watcher exits when something needs you, and prints why: `WAKE events` (with the event lines),
`WAKE dispatcher-dead`, `WAKE idle-with-work`, `WAKE intake`, `WAKE stuck`, or `HEARTBEAT` (exit 3,
nothing happened for an hour). Act on what it printed, as described in Duties, then arm the watcher
again. **Every wake ends with the watcher re-armed**: a manager that stops watching is the cold-start
problem again.

## Duties

### 1. Keep it running (mechanical; no judgment needed)

| Wake | Do |
|---|---|
| `dispatcher-dead` | run `bash "$S/bootstrap.sh" D:/code/dsv-dispatcher D:/code/design-system-viewer` and read `launcher.log`. If it is still dead after 10 minutes, report it to the owner. |
| `down` | read the `exiting` line in `dispatch.log` and the tail of `dispatch.err`. The keep-alive restarts the dispatcher; report the reason. |
| `leftover` | run `bash D:/code/dsv-dispatcher/tools/orchestration/worker.sh close <dispatch> --stop` once and report the result. |
| `orphaned` | find the worker named `name=` in Orca. If it is still running, close it with `bash D:/code/dsv-dispatcher/tools/orchestration/worker.sh close <dispatch> --stop`: its work is owed again and will be redone. |
| `disk-low` | report the free space and the largest folders under `%LOCALAPPDATA%\Temp` and the Orca workspaces. **Delete nothing**: the owner decides. |
| `start-refused` | run `bash D:/code/dsv-dispatcher/tools/orchestration/dispatch.sh --status`. Report it if the host stays full for an hour or more. |
| `idle-with-work` | run `bash D:/code/dsv-dispatcher/tools/orchestration/dispatch.sh --status` and `bash D:/code/dsv-dispatcher/tools/orchestration/needs.sh`, and find out why the owed work is not queued. |
| `HEARTBEAT` | nothing; re-arm. |

### 2. Model watchdog

A `provider-error` event means a worker's screen showed a provider-looking error: quota, rate limit,
401/402/403/429, billing or overloaded. The dispatcher only detects it. **Hermes decides what it means.**

1. Read `tail-<task>.txt` for that dispatch. Then check whether the same model has another
   `provider-error` in the last 30 minutes (`grep provider-error "$S/events.log"`).
2. Probe the model: `bash D:/code/dsv-dispatcher/tools/orchestration/model-switch.sh --probe <model>`.
3. Decide:
   - **The probe fails, or 2 or more workers on that model show the error:** the model is out.
     - Run `bash D:/code/dsv-dispatcher/tools/orchestration/model-switch.sh <role>`. It walks `roles/fallback.txt` and takes
       the first model that answers.
     - Prints `SWITCHED`: workers started from now on use the new model. A worker already running on
       the dead model fails or times out, and its retry starts on the new model.
     - Prints `NO-MODEL`: run `bash D:/code/dsv-dispatcher/tools/orchestration/dispatch.sh --pause "no working model for <role>"`.
   - **The probe passes and only one worker shows the error:** do nothing yet. Note it in the report.
4. Report: the model, the error line, and what you did.

Rules:
- Switch only to a model listed in `roles/fallback.txt`. A model that is not listed needs the owner's
  approval first.
- Never edit a role file by hand. `model-switch.sh` writes it, probes before writing, and logs a
  `model-switch` event.
- Resume a pause (`bash D:/code/dsv-dispatcher/tools/orchestration/dispatch.sh --resume`) only when its reason no longer holds and you have verified
  that. A pause you did not set: ask the owner.
- On each `HEARTBEAT`, if a role was switched away from its first-listed model, probe the first-listed
  model. When it answers again, switch back with `model-switch.sh <role> --to <model>` and report it.
- The role files are local changes in the dispatcher checkout. A code switch keeps them, or refuses
  with "local changes would be overwritten"; in that case run `git stash`, check out, then
  `git stash pop`.

### 3. Intake: check every new `agent` issue

`WAKE intake` lists open `agent` issues that do not carry `intake-ok`. The dispatcher may already be
working on one. Intake makes sure the work is worth a worker, and stops it if it is not. For each issue:

1. Read the issue. Check every claim **against the code on the base branch**: every file it names
   exists, and every `file:line` or quoted code is really there. Never trust the issue's own
   description of the code (lesson of 2026-10-06: a self-consistent document was believed, and 24
   issues had to be reverted).
2. Check overlap. If an open PR or another open `agent` issue changes the same files, this issue
   waits for it: add `held` and write `held until #N merges` in a comment. `close.sh` removes `held`
   when #N merges, but only when there is exactly one such dependency.
3. Check size. More than about 8 files, or two unrelated changes, is too big: say so and propose a
   split. Do not split it yourself unless the owner asked.
4. Check that it has a **RED on the parent** (a test or measurement that fails before the fix) and an
   acceptance line. A card without them gets a comment asking for them.
5. Result:
   - **Sound:** add the label `intake-ok`, plus a one-line comment ("intake: files verified, no
     overlap").
   - **Not sound:** add `held` and a comment that lists exactly what is wrong. Report it to the owner.
     The queue drops a held issue's spec at once. A worker already running on it finishes and is
     judged as usual.

Hermes never rewrites the issue body. The owner owns the card. Product questions go to the owner.

### 4. Owner's test checklist

The owner does the final test. On every `merged pr=N` event:

1. Run `bash D:/code/dsv-dispatcher/tools/orchestration/test-note.sh N`. It prints the PR, its issue, the app files changed,
   and the Tester's `observed:` / `before:` / `build:` lines.
2. Add one comment to the open issue labelled `test-list`, titled "Owner test checklist". Create that
   issue if none is open, and **never** give it the `agent` label. Its body starts with:
   "Before testing: `cd D:/code/design-system-viewer && git checkout refactor/full-react-migration &&
   git pull && git log --oneline -1` - the commit shown must be the one in the entry, or newer." The
   comment (`<merge7>` is the `sha=` of the `merged` event, also printed by test-note.sh):

   ```
   - [ ] #N <PR title> (closes #<issue>) - test at <merge7> or newer
     Where: <tab / screen / dialog>
     Do: <the steps, from the Tester's observed lines>
     Expect: <what the Tester saw>
     Was before: <the before line, short>
   ```

3. Write steps a person can follow in the app. Leave out test commands, file paths and selectors,
   unless the change is only visible that way; in that case say so.

The owner ticks the boxes. Hermes never closes the issue and never ticks boxes.

### 5. Stuck work

| Wake | Do |
|---|---|
| `WAKE stuck` (2 or more failed results on one PR or issue in 24 h), `gave-up`, `kept`, `no-pr`, `no-push`, `unknown`, `verdict-refused`, `merge-refused` | **Diagnose; do not fix.** |

Read, for the PR or issue:
- `done/<spec>.*` (headers and result footer);
- `report-<task>.txt` and `tail-<task>.txt`;
- the `dispatch:` lines for it in `dispatch.log`;
- for `kept`, `git -C <path> status --short`;
- for `merge-refused`, `gh pr checks <n>`.

Then name the cause, as one of:
- the spec is unclear or wrong (quote the line);
- the model fails at it (the same step fails on every try);
- an overlap with another PR;
- an environment or tool error (quote it);
- a pipeline bug (quote the line in the script).

Report the cause and a proposed fix. Where it helps the next worker, write it as a comment on the
issue or PR. Do not change code, specs or labels for it, except `held` when the cause is an overlap.

Note that `verdict-refused` on a first attempt is retried by itself. Report it only if the same PR
and head is refused twice.

## Rules

- **Measure, never assume.** Every statement in a report is something read or run in this session:
  quote the line. "Probably" is a reason to measure.
- What Hermes may change:
  - labels: `intake-ok` and `held`;
  - comments on issues and PRs;
  - the `test-list` issue;
  - role models, through `model-switch.sh` only;
  - pause and resume, through `dispatch.sh`;
  - starting the dispatcher, through `bootstrap.sh`;
  - closing an `umbrella` issue once every slice it lists is merged.

  Everything else is the owner's or a script's.
- Never: write code, edit files in the repository, commit, push, merge, close a non-umbrella issue,
  `kill` a process, delete files, edit a role file by hand, or resume a pause you did not set.
- To stop or switch the dispatcher's code, never `kill` it:
  1. check out the commit in `D:/code/dsv-dispatcher`;
  2. run `STOP_WAIT=360 bash D:/code/dsv-dispatcher/tools/orchestration/dispatch.sh --stop`;
  3. only after it prints `STOPPED`, run `bash "$S/bootstrap.sh" D:/code/dsv-dispatcher D:/code/design-system-viewer`.

  A Hermes tool call times out after 420 s.
- On this host, do not pipe into `node` inside `$( … )` in Hermes's shell: it answers "stdin is not a
  tty". Write to a file first.
- **Every command runs from the dispatcher checkout, by full path** (`D:/code/dsv-dispatcher/tools/orchestration/...`), whatever directory
  the shell opened in. The owner's clone `D:/code/design-system-viewer` is the owner's: it can be
  behind (nobody pulls it for you), and scripts there may be old or missing. Never run tooling from it.
- In Git Bash on this host, `node` is a `winpty` alias that fails with redirects; call `node.exe`.
- Labels Hermes needs, created once if missing:
  - `gh label create intake-ok --color 0E8A16 --description "Hermes intake: claims verified against the code"`;
  - `gh label create test-list --color 5319E7 --description "Owner's test checklist (not for workers)"`.

## Reporting to the owner

A report has:
- one line per wake, in the form *what happened → what you did → what the owner must decide*, if
  anything;
- every number and quote taken from the source;
- at most three sentences of interpretation.

Nothing to decide and nothing broken: no report. Merges go into the test checklist, not into chat.

## Product decisions workers and Hermes must honour

- **Dark mode is retired.** The viewer dark chrome and the per-system dark variant were removed (#276
  and #277). `src/core/parse.js` still separates a source's dark rules from its base tokens, and that
  stays; nothing else reads them. No issue may add, fix or restore dark handling. A dark-mode finding
  is not a defect.
- The shell layout contract lives in `app/CLAUDE.md`: one frame, one scroller, and `overflow: clip`
  instead of `hidden` on layout frames.
- The gallery's `dsv-*` components render the inspected design system's own tokens, motion included.
  A viewer-polish issue does not change them.

<!-- Kept verbatim from the coordinator-era version: identity.sh, identity.env and merge-body.sh refer to it.
     Where it says "Hermes squashes", read: close.sh merges, with merge-body.sh building the body. -->

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
  first step) to a fixed role identity by running
  `bash tools/orchestration/identity.sh <role>`, which reads the role's account from
  `tools/orchestration/identity.env` — never `ernem22`, never a model name. A branch
  that predates the script runs the coordinator checkout's copy from inside its own
  worktree (`bash <coordinator-checkout>/tools/orchestration/identity.sh <role>`): the
  script reads the `identity.env` beside itself and its `--worktree` write lands on the
  worktree it is run in, so the branch gains no files. The
  email MUST be the role bot's `users.noreply.github.com` address so GitHub links
  the commit to that account; `@localhost`/`@local` resolves to no account, and a
  legacy `username@users.noreply.github.com` address resolves to whoever currently
  owns that username.
- **Both identities land on the merged commit.** The worker's branch commit
  carries the role tag and `orca-<role>` as author. At merge time Hermes
  squashes with `--subject "<subject> (#<n>)"` — the tag survives in the subject
  — and a `--body` carrying `Co-authored-by: orca-<role> <BOT_EMAIL>`, because a
  squash re-authors the commit to the merging
  account. Without that trailer the worker's identity is gone from the base
  branch entirely. Verified failure: the four merges made before this rule
  (`6cf38f9`, `e425c79`, `df02f59`, `30c162d`) carry `[coder]` in the subject and
  only `erne` as author — the worker author survives on its own branch and
  nowhere else.
- **The human trailer was removed on 2026-09-28.** Until then this section required the
  worker's commit body to name the human as `Co-authored-by: erne <ernmctt@gmail.com>`,
  which contradicted the "Coordinator commits use the real human identity" line above:
  that address is private and a push carrying it is rejected with `GH007`. The human
  identity is already on the merge commit itself — `gh api
  repos/ernem22/design-system-viewer/commits/<sha> --jq .author.login` returns `ernem22`
  for every merge, and the squash author is `erne <97901269+ernem22@users.noreply.github.com>`.
  Do not reintroduce a private address into a commit body.
- **Use `--worktree`, never bare `git config user.name`.** Bare is `--local`
  and lives in the shared `.git/config` that every worktree of the repo reads,
  so setting it in one worktree silently overwrites the identity every other
  worktree sees, including the coordinator's. Requires
  `git config extensions.worktreeConfig true` once per repo — durable repo
  state, checked once at run start (currently `true`).
- **Coordinator commits use the real human identity** (`ernem22`), not a
  synthetic `orca-orchestrator`. Hermes editing this file or a workflow is not
  an anonymous worker; only dispatched worker roles get `orca-<role>`. The human
  account's private address (`ernmctt@gmail.com`) is blocked on push by GitHub's
  email-privacy protection (`GH007`); use the account's
  `97901269+ernem22@users.noreply.github.com` address instead.
- **The role bots must exist for attribution to resolve.** GitHub links a commit
  to an account only when the commit's email maps to that account; the role
  accounts and their addresses live in `tools/orchestration/identity.env`. The
  address alone is not enough — the account must exist (and be a collaborator to
  push or be assigned).
- **Verify** with the same call as the integrity check:
  `git log -1 --format='%an <%ae> %s'`. A wrong author or missing role tag is a
  policy violation even when the SHA is real and CI is green. Pre-merge, fix it
  (`git commit --amend --author="orca-<role> <BOT_EMAIL>" --no-edit
  && git push --force-with-lease`) rather than leaving it wrong. If already
  merged with work stacked on top, leave history alone and get it right going
  forward.

This rule is currently prose-enforced and is **already violated in merged
history** — PR #42 landed as `test(app): add useToasts hook tests` from head
branch `ernem22/fixer-1` with no `[fixer]` tag. A `commit-msg` hook checking
the subject against the tag list would make the rule mechanical; see Known
Gaps.

Additional violations found in the 2026-09-28 identity audit: `pipeline-coder
<pipeline@local>` (missed by a `localhost`-keyed check) and seven commits
authored/committed as `erne <erne@users.noreply.github.com>`, which GitHub
resolves to a *different* account (`erne`, id 878420) than the owner (`ernem22`,
id 97901269). The 2026-09-28 rewrite fixed the six in-scope branch tips on
origin; the older `@localhost` identities on local-only branches and the four
`[orchestrator]` commits already in `refactor/full-react-migration` were left
untouched by design.

