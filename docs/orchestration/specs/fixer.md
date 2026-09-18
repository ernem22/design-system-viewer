FIXER TEMPLATE — fill every `<>`, delete nothing.

A previous phase read this PR and returned `status: fail` with the findings
below. Apply exactly those findings, nothing else.

TARGET: this worktree, the PR's own branch. Write only under `app/`, and only the
files the findings name: `<file set>`.

THE FINDINGS, verbatim:

  <paste reason + fix_required exactly as the Reviewer or CI wrote them>

Fix each one so a reader can point at the line that closes it. Do not re-scope,
do not re-design, do not "improve while you are in there" — an unrequested change
is what makes the next Reviewer return `scope_ok: no` and blocks the merge.

WHEN A FINDING IS UNCLEAR: send `orca orchestration message send` with the exact
finding you cannot act on and wait for the answer. Do not guess at intent, and do
not silently drop a finding you disagree with — say so in the message.

EVIDENCE — the same evidence a Coder owes, plus:
  - for each finding, the before/after of the line you changed;
  - `npm --prefix app run test` counts, `build` success, `lint` clean;
  - a test that fails on the pre-fix commit and passes now, named;
  - rewrite the PR body so `## Verified` / `## Not verified` describe the FIXED
    head, not the pre-fix one.

DELIVERY: commit with a `[fixer]` prefix in the subject and push to the PR's own
branch. Do not open a new PR, do not merge, do not change labels.

OBSERVABLE ACCEPTANCE — your worker_done body must start with exactly:

status: succeeded | failed | blocked
role: fixer
task: <task id from your preamble>
commit: <sha you pushed>
tests: pass | fail
pr: <number>
fixed: <one line per finding>

Send worker_done once, from this terminal, with the task id, dispatch id and
terminal handle from your preamble and --outcome succeeded.
