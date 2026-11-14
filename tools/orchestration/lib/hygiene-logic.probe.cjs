#!/usr/bin/env node
'use strict';
// Probe for lib/hygiene-logic.cjs. Every case is either a state this repository was actually in on
// 2026-10-02, or the safe form that must keep working.
//
//   node tools/orchestration/lib/hygiene-logic.probe.cjs
//
// Exit 0 only when every case matches. Raw output is what the PR body quotes.
const { decide } = require('./hygiene-logic.cjs');

const cases = [
  // [behind, gateState, expected action, why this case is here]
  [0, 'none', 'ok', 'up to date; a verdict-less head still has nothing to rebase'],
  [0, 'success', 'ok', 'up to date and ready'],
  [10, 'none', 'rebase', 'the only case a rebase is safe: PR #170 before its wave'],
  [10, 'pending', 'refuse', 'PR #170 as measured: 10 behind WITH a verdict posted'],
  [14, 'failure', 'refuse', 'PR #163 as measured: 14 behind, tester failed on that head'],
  [27, 'success', 'refuse', 'PR #135-adjacent shape: rebasing a passed head voids the pass'],
  [27, 'pending', 'refuse', 'PR #135 as measured: 27 behind, tester still owed'],
  [10, '', 'refuse', 'an UNREADABLE gate is not an empty gate (fail closed)'],
  [10, '   ', 'refuse', 'whitespace is not a state either'],
  [10, 'garbage', 'refuse', 'an unknown state must never authorise a rewrite'],
  ['?', 'none', 'refuse', 'an unreadable distance must never authorise a rewrite'],
  [-1, 'none', 'refuse', 'a negative distance is nonsense, not a licence'],
];

let failed = 0;
for (const [behind, gate, want, note] of cases) {
  const got = decide(behind, gate);
  const pass = got.action === want;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'} decide(${JSON.stringify(behind)}, ${JSON.stringify(gate)}) -> ${got.action} (want ${want})`);
  console.log(`       ${note}`);
  console.log(`       why: ${got.why}`);
}

// The safety property, asserted separately from the cases: the ONLY inputs that may authorise a
// rewrite are "behind, with no verdict block". If a future edit widens it, this fails even if every
// case above still passes.
const headIsEvidence = (g) => !(g === 'none');
let widened = 0;
for (const g of ['none', 'pending', 'success', 'failure', '', 'error', 'garbage']) {
  for (const b of [1, 5, 99]) {
    const got = decide(b, g);
    if (got.action === 'rebase' && headIsEvidence(g)) {
      console.log(`FAIL state ${JSON.stringify(g)} authorised a rebase - evidence would be voided`);
      widened++;
    }
  }
}
if (widened) failed += widened;
else console.log('PASS no state other than "none" ever authorises a rebase');

console.log(failed === 0 ? 'probe: ALL PASS' : `probe: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
