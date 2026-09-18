TESTER TEMPLATE — fill every `<>`, delete nothing.

You verify behaviour in a RUNNING app. You write no file: no test, no fix, no
scratch file inside the repo, no commit, no push, no label change. Your only
outbound actions are `orca orchestration send` (type `status` or `worker_done`)
and nothing else.

YOUR RUNNING APP: the coordinator already installed, built and served this
worktree at **http://localhost:<port>** (vite preview). 

**STEP 0 — prove the build is the PR's build, before testing anything else.**
Run `git log -1 --format='%h %s'` in this worktree and compare it with the PR's head
commit (`gh pr view <pr> --json headRefOid`). State both in your report. If the
worktree is on the base branch instead of the PR's branch, the fix under test is
not in the bundle: report

    status: blocked
    role: tester
    blocked: served build <sha> is not PR <n> head <sha> — worktree provisioned from the wrong branch

and stop. A wrong build is a provisioning failure, not a code failure, and a
`status: fail` for it wastes a Fixer cycle and hides the real defect. The reverse
also holds: if the build IS the PR head and a criterion fails, that is a genuine
`fail` — say so with the observed value.

<If this is a re-test after a Fixer commit, say so here and say why the earlier
pass does not carry over — which behaviour changed.>

THE BEHAVIOUR TO VERIFY:
  1. **Before.** <the pre-change behaviour, from the base commit: what the user
     saw, with the base bundle hash.>
  2. **After.** <the same procedure on the head: the value that must differ, and
     the strongest form it can take — a count, a DOM attribute, a class list.>
  3. **Negative control.** <what must NOT happen: the state must not silently
     refill, the placeholder must return, the count must stay.>
  4. **No regression:** <the adjacent behaviour that must be unchanged.>

Do all of it through the running app — drive the DOM, read localStorage, read
computed style; the console may not be read from a script. Report each step as
`observed: <what you did> -> <value>` and pair it with `before: <base value>`.
A step you could not produce goes under `## Not verified` with the reason —
do not claim it, and do not fake the environment to make it producible.

PORT: <port> is yours. If it stops answering, restart the preview yourself from
`app/` in this worktree on the same port (it is the only process you may start).

OUTPUT — worker_done body:

status: pass | fail
role: tester
task: <task id from your preamble>
commit: n/a
tests: n/a
build: <asset hash served on :<port>>
observed: <...>
before: <...>

Report `status: pass` only if every step you could produce held. Then send
worker_done once, from this terminal, with the task id, dispatch id and terminal
handle from your preamble and --outcome succeeded:

    orca orchestration send --run <run id> --from <your terminal handle> \
      --type worker_done --subject "tester issue <n>" \
      --body "<the acceptance block above + your observed/before lines>" \
      --task-id <task id> --dispatch-id <dispatch id> --outcome=succeeded --json
