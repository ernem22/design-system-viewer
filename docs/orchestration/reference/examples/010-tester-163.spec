name: tester-163d
base: origin/ernem22/coder-117
role: tester
title: Tester PR #163 @ e0f1d44 (dispatcher)
pr: 163
head: e0f1d44
serve: 8614
deadline: 3600
---
You verify behaviour in a RUNNING app. You write no file: no test, no fix, no
scratch file inside the repo, no commit, no push, no label change. Your only
outbound actions are `orca orchestration send` (type `status` or `worker_done`)
and nothing else.

YOUR RUNNING APP: the dispatcher already installed, built and served this
worktree at **http://127.0.0.1:8614** (vite preview).

**STEP 0 — prove the build is the PR's build, before testing anything else.**
Run `git log -1 --format='%h %s'` in this worktree and compare it with the PR's head
commit (`gh pr view 163 --json headRefOid`). State both in your report. If the
worktree is not on the PR head, report

    status: blocked
    role: tester
    blocked: served build <sha> is not PR 163 head <sha> — worktree provisioned from the wrong branch

and stop.

This is a RE-TEST of PR #163 at e0f1d44. An earlier Tester (tester-163c) reported FAIL
at this head, but its verdict carried no `reason:` line, so the gate could not read it
and nothing could be fixed from it. Its observation was: "the Compare column head
resolves at :root rather than the column scope: gs5 head 18px vs its own lg 16px, and
ds-new2 head 18px over a 19px lede". Re-measure that yourself; do not copy it.

Read the issue first: `gh issue view 117 --json number,title,body`. Its stated outcome
and its `Verify:` line are the contract. The PR body (`gh pr view 163 --json body`)
lists the heading roles it claims: section 24px, subsection 18px, label 14px, and
exactly one <h1>.

THE BEHAVIOUR TO VERIFY:
  1. **Before.** The base commit is 54136c4. Read the base declarations with
     `git show 54136c4:<file>` for the files the PR body lists (e.g.
     `app/src/tokens/TokenGroup.css`, `app/src/gallery/gallery.css`,
     `app/src/compare/compare.css`) and report the base size of each heading role
     you test. This is a declaration-level before; say so in `before:`.
  2. **After.** In the running app, with a headless browser
     (`npx playwright ...` or `node` driving it), read `getComputedStyle(el).fontSize`
     for: the Preview section heading, a Tokens group heading, a Preview block
     heading, a props-panel block label, and the Compare column heads with two
     systems loaded. Also count `document.querySelectorAll('h1').length`.
  3. **Negative control.** No heading may be smaller than the body/lede text it
     introduces: for each heading above, report its computed size next to the
     computed size of the first text element under it. Re-check the Compare case
     tester-163c named, for both columns.
  4. **No regression:** the rail's accordion `<h3>` (nav label) keeps its base size.

Report each step as `observed: <what you did> -> <value>` and pair it with
`before: <base value>`. A step you could not produce goes under `## Not verified`
with the reason.

PORT: 8614 is yours. If it stops answering, restart the preview yourself from
`app/` in this worktree on the same port with `--host 127.0.0.1` (it is the only
process you may start).

OUTPUT — worker_done body:

status: pass | fail
role: tester
task: <task id from your preamble>
commit: <short sha of the build you verified: git rev-parse --short HEAD>
tests: n/a
build: <asset hash served on :8614>
observed: <...>
before: <...>

A fail MUST carry `reason: <why it failed>` (the gate reads a reason-less fail as
unparseable) and should carry `fix_required: <what must change>`. `observed:`,
`before:` and `build:` are required whether you pass or fail.

DO NOT POST ANYTHING TO THE PR. Your worker_done body IS the verdict: the dispatcher
reads it after you settle and posts the gate's `dsv-verdict` block itself through
`tools/orchestration/verdict-post.sh`, which copies your lines verbatim and refuses an
incomplete one. You have no permission to comment on the PR, by design.

Report `status: pass` only if every step you could produce held. Then send
worker_done once, from this terminal. **Do not retype the command: your dispatch
preamble prints it verbatim, including the `--dispatch-capability dcap_...` token.**
Check the command carries `--task-id`, `--dispatch-id` and `--outcome=succeeded`
(equals sign; the space form is rejected).
