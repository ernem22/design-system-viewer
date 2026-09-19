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
build: <asset hash served on :PORT>
observed: <...>
before: <...>

**Reporting is the last step and the one that wedges workers, so make it boring.** Write the
body to a file, then pass the file — never fight the shell over multi-line quoting:

    cat > /tmp/body.txt <<'EOF'
    status: pass
    role: tester
    task: <task id>
    commit: n/a
    tests: n/a
    build: <asset hash>
    observed: <...>
    before: <...>
    EOF
    # bash:  orca orchestration send ... --body "$(cat /tmp/body.txt)"
    # if the body cannot be passed whole (a shell that eats newlines), send a ONE-LINE
    # body with just `status: <x> role: tester task: <id> build: <hash>` and put the
    # detail in a PR comment instead: `gh pr comment <n> --body-file /tmp/detail.md`.
    # A one-line verdict that lands beats a perfect multi-line one that never does.

Then post the verdict block as a PR comment, which is what the merge gate reads:

    gh pr comment <n> --body "$(printf '```dsv-verdict\nstatus: pass\nrole: tester\ncommit: %s\nbuild: %s\n```\n' "$(git rev-parse --short HEAD)" "<the asset hash you served>")"

`commit:` must be the head whose build you verified (your STEP 0 answer). A verdict whose
commit is not the PR's current head does not count — that field exists because a Tester
once verified a build from the wrong branch, and the coordinator merged on the strength
of it.

Report `status: pass` only if every step you could produce held. Then send
worker_done once, from this terminal. **Do not retype the command: your dispatch
preamble prints it verbatim, including the `--dispatch-capability dcap_...` token
that is unique to your dispatch.** A hand-written command is rejected with
`dispatch_capability_invalid: The Dispatch capability is missing`, and your verdict
then reaches the coordinator only as a rejection echo — no settlement, no gate.
Check the command carries `--task-id`, `--dispatch-id` and `--outcome=succeeded`
(equals sign; the space form is rejected).
