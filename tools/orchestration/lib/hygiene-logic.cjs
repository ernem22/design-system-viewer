'use strict';
// Branch hygiene: may this PR's head be rebased onto the base?
//
// Why a pure function (the same reason gate-logic.cjs exists): the rule is a judgement about
// EVIDENCE, and a judgement that lives inline in a bash loop can only be observed by rewriting a
// real branch and watching what happens. Measured 2026-10-02: three of the five open PRs were
// 10-27 commits behind the base, and two of them carried verdicts posted against their head - a
// rebase rewrites that head, so it silently voids the very signals the gate merges on. The rule
// therefore has to be conservative in one direction only: never rewrite a head that has evidence.
//
//   decide(behind, gateState) -> { action: 'ok' | 'rebase' | 'refuse', why }
//
//     behind    commits the base is ahead of the PR head (0 or more)
//     gateState the pipeline/verdict state for that head:
//                 'none'     -> no verdict block exists yet (close.sh reads this from the status)
//                 'pending'  -> a role still owes a verdict
//                 'success'  -> the gate passed it
//                 'failure'  -> the gate blocked it
//
// 'refuse' is the FAIL-CLOSED answer, and it is the answer whenever the state cannot be
// established. An unreadable gate is not an empty gate: the version of this that treated an empty
// read as "nothing to invalidate" would rebase exactly the PRs whose verdicts it could not see.
function decide(behind, gateState) {
  const n = Number(behind);
  if (!Number.isFinite(n) || n < 0) {
    return { action: 'refuse', why: `could not read the distance to the base (behind='${behind}') - never rewrite a head on a guess` };
  }
  if (n === 0) {
    return { action: 'ok', why: 'the head is up to date with the base' };
  }
  const raw = gateState == null ? '' : String(gateState).trim().toLowerCase();
  if (raw === 'none') {
    return { action: 'rebase', why: `behind by ${n} and no verdict block exists for this head - there is nothing to invalidate` };
  }
  if (raw === '') {
    return { action: 'refuse', why: `behind by ${n} but the verdict state for this head could not be read - refusing rather than risk voiding a verdict` };
  }
  return { action: 'refuse', why: `behind by ${n} with a verdict block already posted (${raw}) - a rebase rewrites the head and voids it` };
}

module.exports = { decide };
