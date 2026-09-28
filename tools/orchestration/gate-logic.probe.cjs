#!/usr/bin/env node
'use strict';
// Probe for gate-logic.js. Every case below is a failure that reached a real merge
// decision in this repository, or the safe form that must keep working.
//
//   node tools/orchestration/gate-logic.probe.js
//
// Exit 0 only when every case matches its expected state. Raw output is what the PR
// body quotes.
const { evaluate, parseVerdict } = require('./gate-logic.cjs');

const HEAD = '12469a25021aecbcbb03a7fa94336c1ff9645966';
const at = (n) => `2026-09-28T16:0${n}:00Z`;

// The gate now ignores any verdict not written by an allowed author, so every existing
// case needs one. `asOwner` supplies it by default and the author cases below override it.
const OWNER = { login: 'ernem22', author_association: 'OWNER' };
const asOwner = (c) => ({ ...c, author: c.author || OWNER });

const good = (role, extra = '') => ({
  body: '```dsv-verdict\n'
    + `status: pass\nrole: ${role}\ncommit: ${HEAD.slice(0, 7)}\n`
    + (role === 'reviewer' ? 'scope_ok: yes\n' : 'observed: perp-ultra-v2 2.84 -> 6.92:1\nbefore: 2.84:1 on index-DpfZuUcb.js\nbuild: index-CIQzABKm.js\n')
    + extra + '```',
  at: at(1),
});

const cases = [
  {
    name: '1. the broken fence, verbatim bytes from PR #134 (three backslashes, no backticks) - it names the OLD head 5dbe297, so it must NOT lock this PR',
    head: HEAD,
    comments: [
      { body: 'CORRECTION - supersedes prior comment on this PR (that verdict was posted in error).\n\n'
        + '\\\\\\dsv-verdict\nstatus: pass\nrole: reviewer\ncommit: 5dbe297\nscope_ok: yes\n\\\\\\nconflicts: none',
        at: at(2) },
      good('tester'),
    ],
    expect: 'pending', // CodeRabbit: "limit unparsable-verdict failures to current, relevant attempts"
  },
  {
    name: '1b. the same malformed fence, but naming the CURRENT head - that one is fatal',
    head: HEAD,
    comments: [
      { body: 'CORRECTION - supersedes prior comment.\n\n'
        + '\\\\\\dsv-verdict\nstatus: pass\nrole: reviewer\ncommit: ' + HEAD.slice(0, 7) + '\nscope_ok: yes\n',
        at: at(2) },
      good('tester'),
    ],
    expect: 'failure',
  },
  {
    name: '2. a Tester PASS with no observed:/before:/build:',
    head: HEAD,
    comments: [
      good('reviewer'),
      { body: `\`\`\`dsv-verdict\nstatus: pass\nrole: tester\ncommit: ${HEAD.slice(0, 7)}\n\`\`\``, at: at(2) },
    ],
    expect: 'failure',
  },
  {
    name: '3. a stale head (the verdict names the previous commit)',
    head: HEAD,
    comments: [
      { body: '```dsv-verdict\nstatus: pass\nrole: reviewer\ncommit: 5dbe297\nscope_ok: yes\n```', at: at(1) },
      { body: '```dsv-verdict\nstatus: pass\nrole: tester\ncommit: 5dbe297\nobserved: x\nbefore: y\nbuild: z\n```', at: at(1) },
    ],
    expect: 'pending',
  },
  {
    name: '4. the good verdict (both roles, current head, evidence present)',
    head: HEAD,
    comments: [good('reviewer'), good('tester')],
    expect: 'success',
  },
  {
    name: '5. reviewer pass but scope_ok: no (must never approve)',
    head: HEAD,
    comments: [
      { body: `\`\`\`dsv-verdict\nstatus: pass\nrole: reviewer\ncommit: ${HEAD.slice(0, 7)}\nscope_ok: no\n\`\`\``, at: at(1) },
      good('tester'),
    ],
    expect: 'failure',
  },
  {
    name: '6. a plain-text verdict with no fence at all (reviewer-134 also did this)',
    head: HEAD,
    comments: [{ body: 'status: fail\nrole: reviewer\ncommit: 5dbe297\nscope_ok: yes\nreason: relies on display:none', at: at(1) }, good('tester')],
    expect: 'pending', // no fence and no "dsv-verdict" token: not a verdict attempt, so the PR simply has no reviewer verdict yet
  },
  {
    name: '7. the safe form: a fail verdict keeps the gate red and says why',
    head: HEAD,
    comments: [
      { body: `\`\`\`dsv-verdict\nstatus: fail\nrole: reviewer\ncommit: ${HEAD.slice(0, 7)}\nscope_ok: yes\nreason: display:none of functional controls\n\`\`\``, at: at(1) },
      good('tester'),
    ],
    expect: 'failure',
  },
  {
    name: '8. a forged author with a perfect verdict is IGNORED (no valid verdict, not pass)',
    head: HEAD,
    comments: [
      { ...good('reviewer'), author: { login: 'attacker', author_association: 'NONE' } },
      { ...good('tester'), author: { login: 'attacker', author_association: 'NONE' } },
    ],
    expect: 'pending',
  },
  {
    name: '9. an allowed author works, with the allowlist passed explicitly',
    head: HEAD,
    comments: [good('reviewer'), good('tester')],
    allowlist: ['ernem22'],
    expect: 'success',
  },
  {
    name: '10. a case-variant login of an allowed author works',
    head: HEAD,
    comments: [
      { ...good('reviewer'), author: { login: 'ERNEM22', author_association: 'OWNER' } },
      { ...good('tester'), author: { login: 'ErneM22', author_association: 'COLLABORATOR' } },
    ],
    expect: 'success',
  },
  {
    name: '11. a non-listed collaborator is ignored',
    head: HEAD,
    comments: [
      { ...good('reviewer'), author: { login: 'someone-else', author_association: 'COLLABORATOR' } },
      { ...good('tester'), author: { login: 'someone-else', author_association: 'COLLABORATOR' } },
    ],
    expect: 'pending',
  },
  {
    name: '12. an edited comment from a non-allowed author is ignored too',
    head: HEAD,
    comments: [
      { ...good('reviewer'), author: { login: 'ernem22', author_association: 'OWNER' } },
      { body: good('tester').body, at: at(9), author: { login: 'attacker', author_association: 'OWNER' } },
    ],
    expect: 'pending', // the tester verdict is ignored, so only the reviewer is present
  },
  {
    name: '13. a listed login whose association is NOT trusted is ignored',
    head: HEAD,
    comments: [
      { ...good('reviewer'), author: { login: 'ernem22', author_association: 'CONTRIBUTOR' } },
      { ...good('tester'), author: { login: 'ernem22', author_association: 'CONTRIBUTOR' } },
    ],
    expect: 'pending',
  },
  {
    name: '14. a non-allowed author cannot lock the gate with a malformed fence either',
    head: HEAD,
    comments: [
      { body: '\\\dsv-verdict\nstatus: pass\nrole: reviewer\ncommit: ' + HEAD.slice(0, 7) + '\nscope_ok: yes', at: at(2), author: { login: 'attacker', author_association: 'NONE' } },
      good('tester'),
      good('reviewer'),
    ],
    expect: 'success', // the forged malformed block is ignored, and the real reviewer approves
  },
];

let bad = 0;
for (const c of cases) {
  const got = evaluate({ head: c.head, comments: c.comments.map(asOwner), allowlist: c.allowlist });
  const ok = got.state === c.expect;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  expected=${c.expect.padEnd(8)} got=${got.state.padEnd(8)} :: ${c.name}`);
  console.log(`      description: ${got.description}`);
}

// parseVerdict must not claim a non-verdict comment.
const notAVerdict = parseVerdict('just a normal review comment, no block here');
console.log(`${notAVerdict === null ? 'PASS' : 'FAIL'}  a comment with no block is not a verdict -> ${notAVerdict === null}`);
if (notAVerdict !== null) bad++;

console.log(bad === 0 ? `\nALL ${cases.length + 1} PROBES PASS` : `\n${bad} PROBE(S) FAILED`);
process.exit(bad === 0 ? 0 : 1);
