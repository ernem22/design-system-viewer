REVIEWER TEMPLATE — fill every `<>`, delete nothing.

You are read-only. Do not edit, create, delete or commit any file. Do not run
`npm`, `vitest`, `tsc`, `eslint` or `vite` — CI already did. Do not add or change
any label, PR comment or issue comment. Your entire output is one report.

INPUT — read exactly these and nothing else:
  1. the issue:      gh issue view <n> --json number,title,body
  2. the full diff:  gh pr diff <pr>
  3. the PR body:    gh pr view <pr> --json number,title,body,headRefOid
  4. the commit:     git show <sha>

THE CLAIM: <what the PR says it does, in one paragraph.>

WHAT TO JUDGE:
  - **Correctness against the issue's stated intent**, not against the PR's own
    prose. A rule stated in prose that the code does not implement is a fail, not
    a documentation nit.
  - **The trap.** <the specific edge case this change is most likely to get wrong
    — a falsy zero, a first-wins rule, a source-of-truth split, a stale cache.>
  - **The other direction.** <the path that must keep working: the default, the
    empty input, the no-override case.>
  - **Side effects:** no render-time mutation of a shared store, no lost state,
    no new render loop.
  - Do the new tests fail on the parent commit? Name one that does.
  - `scope_ok` answers one question: did the PR change anything outside the
    issue's stated scope? `no` if it did.

OUTPUT — exactly this block, then one short prose paragraph per criterion above,
each naming the file:line you checked:

status: pass | fail
reason: <one short line, only if fail>
fix_required: <one short actionable instruction, only if fail>
scope_ok: yes | no

OBSERVABLE ACCEPTANCE — worker_done body starts with exactly:

status: pass | fail
role: reviewer
task: <task id from your preamble>
commit: none
tests: n/a

THEN POST THE SAME BLOCK AS A PR COMMENT — the merge gate is computed by GitHub from
comments, not from the coordinator reading your message:

    gh pr comment <n> --body "$(printf '```dsv-verdict\nstatus: pass\nrole: reviewer\ncommit: %s\nscope_ok: yes\n```\n' "$(git rev-parse --short HEAD)")"

`commit:` must be the head you actually reviewed. A verdict whose commit is not the PR's
current head does not count — a verdict about a different build is not evidence about
this one, and that field is the whole reason the gate is machine-computed.

Send worker_done once, from this terminal. **Do not retype the command: your
dispatch preamble prints it verbatim, including the `--dispatch-capability dcap_...`
token that is unique to your dispatch.** A hand-written command is rejected with
`dispatch_capability_invalid: The Dispatch capability is missing`, and your verdict
then reaches the coordinator only as a rejection echo — no settlement, no gate.
Check the command carries `--task-id`, `--dispatch-id` and `--outcome=succeeded`
(equals sign; the space form is rejected).
