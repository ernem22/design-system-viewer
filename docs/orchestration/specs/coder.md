CODER TEMPLATE — fill every `<>`, delete nothing.

You work in this worktree only. Write only under `app/`, and only these files:
`<file set>`. Do not touch any file outside `app/`. Do not touch
`<files held by other open PRs>` — other workers hold those.

Read the issue in full first: `gh issue view <n> --json number,title,body`.
Honour its stated outcome and its `Verify:` line exactly; do not widen it.
<Where the user-visible behaviour currently goes wrong, in one paragraph, with
the file:line the issue names.>

**STEP 0 — reproduce the claim before you change anything.** An issue is a claim, not a
fact, and a fix for a claim that is not true is a regression with a test. Before writing
code: reproduce the behaviour the issue describes on the parent commit and record the
exact command or steps plus the observed value. If you cannot reproduce it, STOP and
report `status: unreproducible` with what you tried and what you saw instead — the
coordinator closes or re-scopes the issue. Never implement a fix for behaviour you could
not observe. (An issue labelled `scan:agent` without `measured:live` has never been
observed on a running build at all; treat its text as a hypothesis.)

WHAT SUCCESS LOOKS LIKE:
  - <observable criterion 1 — a wrong answer must be visible, not arguable>
  - <observable criterion 2>
  - <observable criterion 3, including the empty/unknown-input path>

EVIDENCE — run all of these and paste the real numbers into the PR body:
  - `npm --prefix app run test` → suite file/test counts, before and after.
  - `npm --prefix app run build` → must succeed.
  - `npm --prefix app run lint` → clean.
  - A test that fails on the parent commit and passes on yours: say which one,
    and paste its failing assertion.
  - Anything you could not run, in a `## Not verified` section — no guessing.

DELIVERY: commit with a `[coder]` prefix in the subject, push your branch, then open the
PR with the base PINNED. Never let it default: the repo's default branch is `main`, which
is NOT the pipeline's base, and a PR that defaults there drags the whole migration into it
(one did, and the diff was 245 files instead of 3).

    gh pr create --base refactor/full-react-migration \
      --title "[coder] <fix|feat|perf>(app): <what changed> (#<n>)" --body-file <file>

Title format `[coder] <fix|feat|perf>(app): <what changed> (#<n>)`, and label the issue
`needs-review`. Do not merge, do not close the issue, do not approve anything.

OBSERVABLE ACCEPTANCE — your worker_done body must start with exactly:

status: succeeded | failed | blocked
role: coder
task: <task id from your preamble>
commit: <sha you pushed>
tests: pass | fail
pr: <number>
changed: <files, one line>

Send worker_done once, from this terminal. **Do not retype the command: your
dispatch preamble prints it verbatim, including the `--dispatch-capability dcap_...`
token that is unique to your dispatch.** A hand-written or remembered command is
rejected with `dispatch_capability_invalid: The Dispatch capability is missing`, and
your report then reaches the coordinator only as a rejection echo — no settlement, no
verdict, and the phase looks finished while it is stalled. Check the command you are
about to run carries all of:

    --task-id <task id> --dispatch-id <dispatch id>
    --outcome=succeeded          (equals sign; the space form is rejected)
    --files-modified <csv>
    --dispatch-capability <token from your preamble>

**Push to the PR's own branch, never a new one.** A commit sitting on
`<role>/<something>` instead of the branch the PR tracks leaves the PR at its old head:
the coordinator sees the old commit, the review and test waves run against code that does
not contain your fix, and your report looks correct while the change is invisible. The
branch is named in your spec; push with `git push origin HEAD:<that branch>` and say in
your report which branch you pushed to.

TWO OPERATIONAL RULES, both learned from a real failure:
  - **`--outcome=succeeded`, with the equals sign.** The space form
    (`--outcome succeeded`) is rejected by the CLI.
  - **Send worker_done once, with the final body.** A settled dispatch revokes the
    capability: a placeholder first (e.g. a probe subject) burns the settlement and
    the report you send afterwards never reaches the coordinator. Write the body
    first, send second. If you settle early by mistake, put the full report in the
    terminal output — the coordinator can read a retained terminal — and say in it
    that the settlement was empty.

If the issue leaves a requirement genuinely ambiguous, ask instead of guessing — with
`--type question`, using the command shape from your dispatch preamble again
(`--to <coordinator terminal handle from your preamble>`, plus `--task-id`,
`--dispatch-id` and the capability token), never a retyped one.

then wait. Never invent a requirement.
