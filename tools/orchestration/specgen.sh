#!/usr/bin/env bash
# Turn needs.sh's work list into queue specs, deterministically - no model writes a spec.
#
#   specgen.sh            write one spec per need into $S/queue (skips a need already queued)
#   specgen.sh --dry-run  print what it would write
#
# Why: in the first two dispatcher runs (2026-10-04, PR #163) every spec was mechanical. A Tester
# needs the PR, its head and a port, and reads the issue's Verify line itself; a Fixer needs the
# failing verdict's reason:/fix_required: verbatim; a Reviewer and a Coder need the PR / issue
# number. Having an LLM coordinator write them kept a human in the loop - the coordinator only acts
# when spoken to, so nothing advanced until someone asked "sonuç?". The dispatcher calls this when
# its queue is empty; Hermes is no longer needed for the pipeline to move.
#
# Order in the queue: finish open PRs before starting new ones -
#   1xx fixer, 2xx tester, 3xx reviewer, 5xx coder.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
REPO="${DSV_REPO:-ernem22/design-system-viewer}"
BASE="${DSV_BASE:-refactor/full-react-migration}"
PORT="${DSV_TEST_PORT:-8614}"
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
Q="$S/queue"; mkdir -p "$Q" 2>/dev/null || true
DRY=""; [ "${1:-}" = "--dry-run" ] && DRY=1
say() { printf 'specgen: %s\n' "$*" >&2; }

# The issue a PR claims: `(#n)` in the title, or Closes/Fixes/Resolves #n in the body.
issue_of() {
  gh pr view "$1" --repo "$REPO" --json title,body --jq '.title + "\n" + .body' 2>/dev/null \
    | grep -oE '\(#[0-9]+\)|(Closes|Fixes|Resolves|Refs) #[0-9]+' | grep -oE '[0-9]+' | head -1
}

# reason:/fix_required: of the LATEST readable fail verdict per role on this head, verbatim.
findings_of() {
  local pr="$1" head="$2"
  gh api "repos/$REPO/issues/$pr/comments" --paginate --jq '.[] | {at: .created_at, body}' 2>/dev/null \
  | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const head=process.argv[1]; const latest={};
  for (const l of s.split("\n").filter(Boolean)) {
    let c; try { c=JSON.parse(l) } catch(e) { continue }
    const m=/```dsv-verdict\r?\n([\s\S]*?)\r?\n```/.exec(c.body||""); if(!m) continue;
    const f={}; for (const x of m[1].split(/\r?\n/)) { const k=/^\s*([a-z_]+)\s*:\s*(.+?)\s*$/.exec(x); if(k) f[k[1]]=k[2]; }
    if (!f.role || !f.commit || !/^[0-9a-f]{7,40}$/i.test(f.commit) || !head.startsWith(f.commit)) continue;
    if (!latest[f.role] || latest[f.role].at < c.at) latest[f.role]={at:c.at, f};
  }
  const out=[];
  for (const r of Object.keys(latest)) { const f=latest[r].f;
    if ((f.status||"").toLowerCase()!=="fail" || !f.reason) continue;
    out.push("  ("+r+") reason: "+f.reason); if (f.fix_required) out.push("  ("+r+") fix_required: "+f.fix_required);
    if (f.observed) out.push("  ("+r+") observed: "+f.observed);
  }
  process.stdout.write(out.join("\n"));
});' "$head"
}

# Files held by OTHER open PRs, so a Coder does not collide with them.
held_files() {
  gh pr list --repo "$REPO" --base "$BASE" --state open --json number,files --limit 100 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=new Set();for(const p of JSON.parse(s))for(const f of (p.files||[]))o.add(f.path+" (#"+p.number+")");console.log([...o].join(", ")||"none")})'
}

WORKER_DONE_RULES='Send worker_done once, from this terminal. **Do not retype the command: your dispatch
preamble prints it verbatim, including the `--dispatch-capability dcap_...` token.** Check it
carries `--task-id`, `--dispatch-id` and `--outcome=succeeded` (equals sign; the space form is
rejected). Never ask a question (`--type question`): nobody answers it - there is no coordinator,
and a worker waiting on an answer sits until its deadline (measured 2026-10-05, coder-116: two
attempts, ~50 min). If something is ambiguous or blocks you, settle with `status: blocked` and a
`reason:` line saying exactly what and why.'

write_spec() {   # file, header, body
  local F="$Q/$1"
  if [ -n "$DRY" ]; then say "would write $1"; printf '%s\n---\n%s\n' "$2" "$3" | head -12 >&2; return; fi
  # written aside and moved in whole: measured 2026-10-06, a full disk cut 500-coder-248.spec to 215
  # bytes ("printf: write error: No space left on device") and it was still reported "queued"
  if printf '%s\n---\n%s\n' "$2" "$3" > "$Q/.$1.tmp" && mv "$Q/.$1.tmp" "$F"; then say "queued $1"
  else rm -f "$Q/.$1.tmp"; say "could not write $1 (disk full?); not queued"; fi
}

gen_tester() {   # pr head branch
  local pr="$1" head="${2:0:7}" br="$3" n; n="$(issue_of "$pr")"
  # a port per PR, so Testers of different PRs can run at the same time (the dispatcher still never
  # starts two Testers on one port)
  local PORT=$(( ${DSV_TEST_PORT_BASE:-8600} + pr % 100 ))
  write_spec "200-tester-$pr-$head.spec" "name: tester-$pr-$head
base: origin/$br
role: tester
title: Tester PR #$pr @ $head
pr: $pr
head: $head
serve: $PORT
deadline: 3600" "You verify behaviour in a RUNNING app. You write no file, commit nothing, push nothing,
change no label. Your only outbound action is \`orca orchestration send\`.

YOUR RUNNING APP: the dispatcher built and served this worktree at http://127.0.0.1:$PORT.

STEP 0 - prove the build is the PR's build: \`git log -1 --format='%h %s'\` here vs
\`gh pr view $pr --json headRefOid\`. If they differ, report \`status: blocked\` with both shas and stop.

THE CONTRACT: issue #${n:-?} (\`gh issue view ${n:-<n>} --json number,title,body\`), its stated outcome
and its \`Verify:\` line, and the PR body (\`gh pr view $pr --json body\`). Verify the issue, not the
PR's prose about itself.

THE BEHAVIOUR TO VERIFY:
  1. Before: the base commit's behaviour for what the issue names. There is no base server; read the
     base code with \`git show <base sha>:<file>\` and say in \`before:\` that it is declaration-level.
  2. After: the same thing in the running app - drive the DOM with a headless browser
     (\`npx playwright ...\` or \`node\`), read computed style, attributes, counts. The strongest form.
  3. Negative control: what must NOT happen.
  4. No regression: the adjacent behaviour that must be unchanged.
Report each as \`observed: <what you did> -> <value>\` paired with \`before: <value>\`.

OUTPUT - worker_done body:

status: pass | fail
role: tester
task: <task id from your preamble>
commit: <git rev-parse --short HEAD>
tests: n/a
build: <asset hash served on :$PORT>
observed: <...>
before: <...>

A fail MUST carry \`reason: <why>\` and should carry \`fix_required: <what must change>\`.
DO NOT POST TO THE PR: the dispatcher posts your verdict from this body.

$WORKER_DONE_RULES"
}

gen_reviewer() {   # pr head branch
  local pr="$1" head="${2:0:7}" br="$3" n; n="$(issue_of "$pr")"
  write_spec "300-reviewer-$pr-$head.spec" "name: reviewer-$pr-$head
base: origin/$br
role: reviewer
title: Reviewer PR #$pr @ $head
pr: $pr
head: $head
deadline: 2400" "You are read-only. Do not edit, create, delete or commit any file; do not run npm, vitest,
tsc, eslint or vite - CI already did. Your entire output is one report.

INPUT - read exactly these:
  1. the issue:      gh issue view ${n:-<n>} --json number,title,body
  2. the full diff:  gh pr diff $pr
  3. the PR body:    gh pr view $pr --json number,title,body,headRefOid
  4. the commits:    git log --oneline origin/$BASE..HEAD, and git show for each

WHAT TO JUDGE:
  - Correctness against the ISSUE's stated intent and its Verify line, not the PR's prose.
  - The trap: the edge case this change is most likely to get wrong (empty input, a scoped
    override, a first-wins rule, a stale value) - name the one you checked.
  - The other direction: the default / no-override path must keep working.
  - Do the new tests fail on the parent commit? Name one that does.
  - scope_ok: did the PR change anything outside the issue's scope? \`no\` if it did.

OUTPUT - worker_done body:

status: pass | fail
role: reviewer
task: <task id from your preamble>
commit: <git rev-parse --short HEAD>
scope_ok: yes | no
reason: <required for fail>
fix_required: <required for fail>

then one short paragraph per criterion naming the file:line you checked.
DO NOT POST TO THE PR: the dispatcher posts your verdict from this body.

$WORKER_DONE_RULES"
}

gen_conflict() {   # pr head branch - the PR conflicts with the base: merge the base in, nothing else
  local pr="$1" head="${2:0:7}" br="$3"
  write_spec "100-fixer-$pr-$head.spec" "name: fixer-$pr-$head
base: origin/$br
role: fixer
title: Fixer PR #$pr @ $head (merge conflict)
pr: $pr
head: $head
deadline: 3600" "PR #$pr (branch \`$br\`, head $head) conflicts with \`$BASE\`. Merge the base into it and resolve the
conflicts; change nothing else.

STEPS: \`git fetch origin $BASE\`, then \`git merge origin/$BASE\` (a merge commit: never rebase, never
--force). Resolve each conflict keeping the intent of BOTH sides; where both changed the same logic and
one must lose, stop and report \`status: blocked\` with \`reason:\` naming the file and the two intents.
Then \`npm --prefix app run test\`, \`lint\` and \`build\` must pass.

DELIVERY: \`bash tools/orchestration/identity.sh fixer\` first, commit the merge, then
\`git push origin HEAD:$br\` (fast-forward only, never --force). No new PR, no labels.

OUTPUT - worker_done body:

status: succeeded | failed | blocked
role: fixer
task: <task id from your preamble>
reason: <one line; required for blocked and failed>
commit: <sha you pushed>
tests: pass | fail
pr: $pr
fixed: merge conflict with $BASE (<files resolved>)

$WORKER_DONE_RULES"
}

gen_fixer() {   # pr head branch
  local pr="$1" head="${2:0:7}" br="$3" FIND
  if [ "$(gh pr view "$pr" --repo "$REPO" --json mergeable --jq .mergeable 2>/dev/null)" = "CONFLICTING" ]; then
    gen_conflict "$pr" "$head" "$br"; return
  fi
  FIND="$(findings_of "$pr" "$2")"
  if [ -z "$FIND" ]; then say "#$pr @ $head: gate failure but no readable fail verdict (reason:) on this head - no fixer spec"; return; fi
  write_spec "100-fixer-$pr-$head.spec" "name: fixer-$pr-$head
base: origin/$br
role: fixer
title: Fixer PR #$pr @ $head
pr: $pr
head: $head
deadline: 3600" "A verdict on this PR's head returned \`status: fail\`. Apply exactly these findings, nothing else.

TARGET: PR #$pr, branch \`$br\`, head $head. This worktree starts at that head on its own local
branch; push with the explicit refspec below. Write only under \`app/\`, only the files the findings need.

THE FINDINGS, verbatim:

$FIND

STEP 0 - reproduce each finding on $head before fixing it, and record the observed value. A finding
you cannot reproduce is reported as unreproducible, never silently \"fixed\". Keep every existing test
green; if you believe a test is wrong, report `status: blocked` with the reason instead of changing what it asserts.

Do not re-scope, re-design or \"improve while you are in there\".

EVIDENCE in the PR body: the before/after of each changed line; \`npm --prefix app run test\` counts,
\`build\` success, \`lint\` clean; a test that fails on $head and passes on your commit, named; rewrite
\`## Verified\` / \`## Not verified\` for the fixed head.

DELIVERY: \`bash tools/orchestration/identity.sh fixer\` first. Commit with a \`[fixer]\` prefix, then
\`git push origin HEAD:$br\` (fast-forward only, never --force). No new PR, no merge, no labels.

OUTPUT - worker_done body:

status: succeeded | failed | blocked
role: fixer
task: <task id from your preamble>
commit: <sha you pushed>
tests: pass | fail
pr: $pr
fixed: <one line per finding>

$WORKER_DONE_RULES"
}

gen_coder() {   # issue
  local n="$1" HELD; HELD="$(held_files)"
  write_spec "500-coder-$n.spec" "name: coder-$n
base: origin/$BASE
role: coder
title: Coder issue #$n
issue: $n
deadline: 5400" "You work in this worktree only. Write only under \`app/\`. Do not touch files held by other
open PRs: $HELD.

Read the issue in full first: \`gh issue view $n --json number,title,body\`. Honour its stated outcome
and its \`Verify:\` line exactly; do not widen it.

STEP 0 - reproduce the claim on the parent commit before changing anything, and record the exact
steps and the observed value. If you cannot reproduce it, STOP and report \`status: unreproducible\`.
\`unreproducible\` means the claim does not hold on the parent commit - nothing else. If the remaining
work needs a file held by an open PR listed above, or depends on an open PR, report \`status: blocked\`
with \`reason: needs <files> held by #<pr>\`; an open PR is not "already delivered".

EVIDENCE - real numbers in the PR body: \`npm --prefix app run test\` counts before/after; \`build\`
succeeds; \`lint\` clean; a test that fails on the parent and passes on yours, named, with its
failing assertion; anything not run under \`## Not verified\`.

DELIVERY: \`bash tools/orchestration/identity.sh coder\` first. Commit with a \`[coder]\` prefix, push
this branch, open a PR against \`$BASE\` titled \`[coder] <fix|feat|perf>(app): <what changed> (#$n)\`.
Do not merge, do not close the issue, do not approve anything.

OUTPUT - worker_done body:

status: succeeded | failed | blocked | unreproducible
role: coder
task: <task id from your preamble>
reason: <one line; required for blocked, failed and unreproducible>
commit: <sha you pushed>
tests: pass | fail
pr: <number>
changed: <files, one line>

$WORKER_DONE_RULES"
}

NEEDS="$(bash "$HERE/needs.sh" --json)" || { say "needs.sh failed; nothing written"; exit 4; }
[ -n "$NEEDS" ] || { say "nothing is owed"; exit 0; }
printf '%s\n' "$NEEDS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const l of s.split("\n").filter(Boolean)){const j=JSON.parse(l);console.log([j.role,j.ref.replace("#",""),j.head,j.branch].join("\t"))}})' \
| while IFS=$'\t' read -r role ref head branch; do
  case "$role" in
    tester)   gen_tester "$ref" "$head" "$branch" ;;
    reviewer) gen_reviewer "$ref" "$head" "$branch" ;;
    fixer)    gen_fixer "$ref" "$head" "$branch" ;;
    coder)    gen_coder "$ref" ;;
  esac
done
