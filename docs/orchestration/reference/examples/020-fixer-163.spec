name: fixer-163e
base: origin/ernem22/coder-117
role: fixer
title: Fixer PR #163 @ e0f1d44 - Compare column head scope (dispatcher)
pr: 163
head: e0f1d44
deadline: 3600
---
A previous phase read this PR and returned `status: fail` with the findings
below. Apply exactly those findings, nothing else.

TARGET: PR #163, branch `ernem22/coder-117`, head e0f1d44. This worktree was
created FROM that branch's head but sits on its own local branch, so you push
with an explicit refspec (see DELIVERY). Write only under `app/`, and only the
files the finding needs: `app/src/compare/compare.css`,
`app/src/compare/CompareColumn.tsx`, `app/src/tokens/tokens.css`,
`app/src/compare/columnHeadingScale.test.ts`, `app/src/gallery/headingScale.test.ts`.

THE FINDING, verbatim (Tester, dispatch task_83f933632961, measured live in
Chromium on :8614 at e0f1d44):

  reason: The Compare column-head role does not resolve in the column scope.
  --heading-column is declared only at :root as var(--font-size-lg), so it
  computes once on :root (18px) and every .cmp-col inherits that fixed value,
  ignoring the column's own re-scoped --font-size-lg. For ds-new2 (column lg =
  19px) the head stays 18px and is smaller than the first content it introduces
  (19px), violating issue #117 acceptance that every heading is at least as
  large as the content it heads.
  fix_required: Resolve --heading-column inside the .cmp-col scope (declare
  --heading-column: var(--font-size-lg) on .cmp-col, or set it per-column
  inline with the other token overrides) so it re-substitutes against that
  column's lg: ds-new2 head must then be >= 19px and gs5 head 16px.

A CONSTRAINT THE FINDING DOES NOT MENTION: the earlier Reviewer required "one role
one size", and `app/src/gallery/headingScale.test.ts` asserts every `--heading-*`
role is declared exactly once in `tokens.css` and zero times in other stylesheets.
A `--heading-column:` declaration in `compare.css` would break that test. The
inline route (CompareColumn.tsx already re-scopes every `--font-size-*` inline on
`.cmp-col`; see `useCompareView.ts`) keeps the stylesheet rule intact. Choose the
route that satisfies BOTH the finding and the existing tests; if you believe the
tests are wrong, ask (below) instead of changing what they assert.

**STEP 0 — reproduce the finding before you fix it.** On the parent commit e0f1d44,
show that `--heading-column` resolves to the :root value inside a `.cmp-col` whose
system has a different lg (a unit test with jsdom/computed style, or a test that
renders CompareColumn with ds-new2 and gs5 and reads the custom property). Record
the observed value. If you cannot reproduce it, report `unreproducible` with what
you tried — do not "fix" it blind.

Fix it so a reader can point at the line that closes it. Do not re-scope, do not
re-design, do not "improve while you are in there".

WHEN A FINDING IS UNCLEAR: ask with `--type question`, using the command shape
printed in your dispatch preamble (`--to <coordinator terminal handle from your
preamble>`, plus `--task-id`, `--dispatch-id` and the capability token). Never
retype a send command.

EVIDENCE — put the real numbers in the PR body:
  - the before/after of the line you changed;
  - `npm --prefix app run test` counts, `npm --prefix app run build` success,
    `npm --prefix app run lint` clean;
  - a test that fails on e0f1d44 and passes on your commit, named, with its
    failing assertion (ds-new2 column head must resolve >= 19px, gs5 to 16px);
  - rewrite the PR body's `## Verified` / `## Not verified` for the FIXED head.

DELIVERY: `bash tools/orchestration/identity.sh fixer` first (this branch has it).
Commit with a `[fixer]` prefix in the subject, then push to the PR's own branch:

    git push origin HEAD:ernem22/coder-117

(a plain fast-forward; never --force). Do not open a new PR, do not merge, do not
change labels.

OBSERVABLE ACCEPTANCE — your worker_done body must start with exactly:

status: succeeded | failed | blocked
role: fixer
task: <task id from your preamble>
commit: <sha you pushed>
tests: pass | fail
pr: 163
fixed: <one line per finding>

Send worker_done once, from this terminal. **Do not retype the command: your
dispatch preamble prints it verbatim, including the `--dispatch-capability dcap_...`
token.** Check it carries `--task-id`, `--dispatch-id`, `--outcome=succeeded`
(equals sign), `--files-modified <csv>` and the capability token.
