'use strict';
// The merge gate's decision, as a pure function.
//
// Why this file exists: the gate used to be inline inside
// .github/workflows/pipeline-gate.yml, so its behaviour could only be observed by
// pushing a commit and waiting for Actions. That is not a probe. The workflow now
// requires this module and the probe (gate-logic.probe.js) calls the same function
// with the same inputs, so "the probe passes" and "the gate does this" are the same
// statement.
//
// Rules this implements, each one a failure that actually happened:
//   * ONE verdict comment per role per head is what counts; the latest matching
//     head wins, an older head is ignored (never approved) - the pipeline once
//     merged on a verdict against a stale head.
//   * a verdict block must be fenced with EXACTLY three backticks. A comment that
//     tries to be a verdict but does not parse is a FAILURE with a reason, not a
//     silent `pending`: on PR #134 a `\\\dsv-verdict` fence parsed as nothing and
//     the gate sat pending forever while a maintainer read a PASS in the thread.
//   * a Tester PASS must carry its evidence - `observed:`, `before:` and the build
//     asset hash it measured (`build:`). A PASS with no evidence is not a PASS;
//     before this rule the gate could not tell an evidenced PASS from an empty one.

const VERDICT_FENCE = 'dsv-verdict';
const STRICT = /```dsv-verdict[ \t]*\r?\n([\s\S]*?)```/;

const TESTER_EVIDENCE_FIELDS = ['observed', 'before', 'build'];

/** Parse one comment body. Returns null when the body is not a verdict attempt at all. */
function parseVerdict(body) {
  const text = body || '';
  if (!text.includes(VERDICT_FENCE)) return null; // not a verdict, not our business

  const m = STRICT.exec(text);
  // Best-effort commit for a malformed attempt: the gate only treats a malformed block as
  // fatal when it is about the CURRENT head, so it needs to know which head it names.
  const commitish = (/commit:\s*([0-9a-fA-F]{7,40})/.exec(text) || [])[1] || '';
  if (!m) {
    return { ok: false, reason: `a verdict block is fenced with the wrong delimiter (the block after "dsv-verdict" must open with exactly three backticks, and close)`, commit: commitish };
  }
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([a-z_]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (kv) fields[kv[1]] = kv[2];
  }
  if (!fields.role) {
    return { ok: false, reason: 'a verdict block has no `role:` line', commit: fields.commit || commitish };
  }
  if (!['reviewer', 'tester'].includes(fields.role)) {
    return { ok: false, reason: `a verdict block has an unknown role: ${fields.role}`, commit: fields.commit || commitish };
  }
  return { ok: true, fields };
}

/**
 * @param {{head: string, comments: Array<{body: string, at: string}>}} input
 * @returns {{state: 'success'|'failure'|'pending', description: string, detail: object}}
 */
function evaluate(input) {
  const head = input.head || '';
  const shortHead = head.slice(0, 7);
  const comments = input.comments || [];

  const unparsable = [];
  const attempts = [];
  for (const c of comments) {
    const p = parseVerdict(c.body);
    if (!p) continue;
    if (!p.ok) {
      unparsable.push({ at: c.at || '', reason: p.reason, commit: p.commit || '' });
      continue;
    }
    attempts.push({ ...p.fields, at: c.at || '' });
  }

  if (unparsable.length) {
    // A malformed attempt is louder than a missing one - but only when it is ABOUT THIS
    // HEAD. Failing on any comment that ever mentioned the token would let one stale typo
    // lock a PR forever (CodeRabbit: "limit unparsable-verdict failures to current,
    // relevant attempts"). An attempt counts as current when it names this head's short
    // sha, or names no commit at all (so a fence typo on a fresh verdict still fails).
    const relevant = unparsable.filter((u) => !u.commit || head.startsWith(u.commit));
    if (relevant.length) {
      const first = relevant.sort((a, b) => String(a.at).localeCompare(String(b.at)))[0];
      return {
        state: 'failure',
        description: `unparsable verdict comment - ${first.reason} - head ${shortHead}`,
        detail: { unparsable: relevant, ignoredUnparsable: unparsable.filter((u) => !relevant.includes(u)) },
      };
    }
  }

  const latest = {};
  const ignored = [];
  for (const a of attempts) {
    if (!a.commit || !head.startsWith(a.commit)) {
      ignored.push({ role: a.role, commit: a.commit || '(none)' });
      continue;
    }
    if (!latest[a.role] || String(latest[a.role].at) < String(a.at)) latest[a.role] = a;
  }

  const reviewer = latest.reviewer;
  const tester = latest.tester;
  if (!reviewer || !tester) {
    const missing = [!reviewer && 'reviewer', !tester && 'tester'].filter(Boolean).join(' + ');
    return {
      state: 'pending',
      description: `waiting on ${missing} verdict for head ${shortHead}`,
      detail: { ignored, reviewer: reviewer || null, tester: tester || null },
    };
  }

  const missingEvidence = TESTER_EVIDENCE_FIELDS.filter((f) => !tester[f]);
  if (tester.status === 'pass' && missingEvidence.length) {
    return {
      state: 'failure',
      description: `tester PASS for head ${shortHead} carries no evidence: missing ${missingEvidence.join(', ')}`,
      detail: { tester },
    };
  }

  const ok = reviewer.status === 'pass' && tester.status === 'pass' && reviewer.scope_ok === 'yes';
  const why = `reviewer=${reviewer.status}${reviewer.scope_ok ? ` scope_ok=${reviewer.scope_ok}` : ''} tester=${tester.status} head=${shortHead}`;
  if (ok) return { state: 'success', description: why, detail: { reviewer, tester } };

  const reason = reviewer.status !== 'pass' ? 'reviewer failed'
    : tester.status !== 'pass' ? 'tester failed'
      : 'reviewer scope_ok is not yes';
  return { state: 'failure', description: `${reason} - ${why}`, detail: { reviewer, tester } };
}

module.exports = { parseVerdict, evaluate, STRICT, TESTER_EVIDENCE_FIELDS };
