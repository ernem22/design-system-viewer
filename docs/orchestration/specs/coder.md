CODER TEMPLATE — fill every `<>`, delete nothing.

You work in this worktree only. Write only under `app/`, and only these files:
`<file set>`. Do not touch any file outside `app/`. Do not touch
`<files held by other open PRs>` — other workers hold those.

Read the issue in full first: `gh issue view <n> --json number,title,body`.
Honour its stated outcome and its `Verify:` line exactly; do not widen it.
<Where the user-visible behaviour currently goes wrong, in one paragraph, with
the file:line the issue names.>

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

DELIVERY: commit with a `[coder]` prefix in the subject, push your branch, open a
PR against `refactor/full-react-migration` titled
`[coder] <fix|feat|perf>(app): <what changed> (#<n>)`, and label the issue
`needs-review`. Do not merge, do not close the issue, do not approve anything.

OBSERVABLE ACCEPTANCE — your worker_done body must start with exactly:

status: succeeded | failed | blocked
role: coder
task: <task id from your preamble>
commit: <sha you pushed>
tests: pass | fail
pr: <number>
changed: <files, one line>

Send worker_done once, from this terminal, with the task id, dispatch id and
terminal handle from your preamble — the exact call is:

    orca orchestration send --run <run id> --from <your terminal handle> \
      --type worker_done --subject "coder <n> done" \
      --body "<the acceptance block below + your prose>" \
      --task-id <task id> --dispatch-id <dispatch id> \
      --outcome succeeded --files-modified <csv> --json

If the issue leaves a requirement genuinely ambiguous, ask instead of guessing:

    orca orchestration send --run <run id> --from <your terminal handle> \
      --type question --subject "<the one thing you cannot decide>" \
      --body "<what you know, what you need>" \
      --to <coordinator terminal handle from your preamble> \
      --task-id <task id> --dispatch-id <dispatch id> --json

then wait. Never invent a requirement.
