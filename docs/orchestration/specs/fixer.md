FIXER TEMPLATE — fill every `<>`, delete nothing.

A previous phase read this PR and returned `status: fail` with the findings
below. Apply exactly those findings, nothing else.

TARGET: this worktree, the PR's own branch. Write only under `app/`, and only the
files the findings name: `<file set>`.

THE FINDINGS, verbatim:

  <paste reason + fix_required exactly as the Reviewer or CI wrote them>

**STEP 0 — reproduce each finding before you fix it.** A Reviewer's finding is a claim
too. Reproduce every one on the parent commit (its `where:` line is your pointer) and
record the observed value; the Reviewer's own reading can be half wrong — one said
"`.app-toast-warn` is absent" when the class was applied and only the CSS rule was
missing. A finding you cannot reproduce is reported as `unreproducible` with what you
tried, never silently "fixed".

Fix each one so a reader can point at the line that closes it. Do not re-scope,
do not re-design, do not "improve while you are in there" — an unrequested change
is what makes the next Reviewer return `scope_ok: no` and blocks the merge.

WHEN A FINDING IS UNCLEAR: ask, do not guess at intent — with `--type question`,
using the command shape printed in your dispatch preamble (`--to <coordinator
terminal handle from your preamble>`, plus `--task-id`, `--dispatch-id` and the
capability token). Never retype a send command: the capability token is per-dispatch
and a retyped one is rejected with `dispatch_capability_invalid`.

then wait for the answer. Do not silently drop a finding you disagree with —
say so in the message.

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

Send worker_done once, from this terminal. **Do not retype the command: your
dispatch preamble prints it verbatim, including the `--dispatch-capability dcap_...`
token that is unique to your dispatch.** A hand-written command is rejected with
`dispatch_capability_invalid: The Dispatch capability is missing`, and your report
then reaches the coordinator only as a rejection echo — no settlement, no verdict.
Check the command carries `--task-id`, `--dispatch-id`, `--outcome=succeeded`
(equals sign; the space form is rejected), `--files-modified <csv>` and the
capability token.

**Push to the PR's own branch, never a new one.** A fixer that commits onto
`<role>/<something>` leaves the PR at its old head: the re-review and re-test then run
against code without the fix, and the report looks correct while the change is invisible.
The branch is named in your spec; push with `git push origin HEAD:<that branch>` and say
in your report which branch you pushed to.

**Verify it landed before you report** — this is the check, not a courtesy:

    git ls-remote origin refs/heads/<that branch>     # must show your commit's sha

A commit that only exists in your worktree, or on a branch nobody tracks, is invisible to
every gate: the PR keeps its old head, the coordinator's merge attempt is refused, and the
work is re-done by someone else. It happened three times in one session, so it is the
last thing you do before sending `worker_done`.
