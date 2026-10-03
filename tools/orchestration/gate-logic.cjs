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

// The gate is the only thing standing between a PR and the default branch, and this repo
// is public: without an author check, anyone could post a `dsv-verdict` block and approve
// someone else's PR. Measured 2026-09-28 - `evaluate` never saw the commenter at all, and
// the workflow dropped `user.login` when it built its candidate list.
const DEFAULT_ALLOWLIST = ['ernem22'];
const TRUSTED_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];

function normalizeAllowlist(allowlist) {
  const list = Array.isArray(allowlist) && allowlist.length ? allowlist : DEFAULT_ALLOWLIST;
  return list.map((a) => String(a).toLowerCase());
}

/**
 * A verdict counts only when BOTH hold: the login is listed (case-insensitive) and the
 * author_association is trusted. A `[bot]` account is accepted only if it is listed.
 * @param {{login?: string, author_association?: string}} author
 * @param {string[]} [allowlist]
 */
function isAllowedAuthor(author, allowlist) {
  if (!author || !author.login) return false;
  const login = String(author.login).toLowerCase();
  const assoc = String(author.author_association || '').toUpperCase();
  return normalizeAllowlist(allowlist).includes(login) && TRUSTED_ASSOCIATIONS.includes(assoc);
}

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
  // A FAIL must say what is wrong, for EITHER role. Measured twice: PR #135's reviewer fail and PR
  // #163's tester fail both carried `status: fail` with no `reason:` line, and neither could be acted
  // on - a Fixer has nothing to fix, so a whole cycle was spent on a verdict that names nothing. A
  // reason-less fail is unparseable, exactly like a broken fence, and it must not read as a real fail.
  if ((fields.status || '').toLowerCase() === 'fail' && !String(fields.reason || '').trim()) {
    return { ok: false, reason: 'a fail verdict has no `reason:` line, so nothing can be fixed: unparseable rather than a real fail', commit: fields.commit || commitish };
  }
  return { ok: true, fields };
}

/**
 * @param {{head: string, comments: Array<{body: string, at: string}>}} input
 * @returns {{state: 'success'|'failure'|'pending', description: string, detail: object}}
 */
// A verdict's commit names the head only when it is a real abbreviation: 7+ hex digits that the head
// starts with. `head.startsWith(c)` alone let `commit: 4` match any head starting with 4 (hunter H-027).
function namesHead(head, c) {
  return typeof c === 'string' && /^[0-9a-f]{7,40}$/i.test(c) && head.toLowerCase().startsWith(c.toLowerCase());
}

function evaluate(input) {
  const head = input.head || '';
  const shortHead = head.slice(0, 7);
  const comments = input.comments || [];

  const unparsable = [];
  const attempts = [];
  const ignoredAuthors = [];
  for (const c of comments) {
    const p = parseVerdict(c.body);
    if (!p) continue;
    // The author check comes FIRST. A block from a non-allowed author is not a verdict at
    // all: it can neither approve the PR nor lock the gate with a malformed fence.
    if (!isAllowedAuthor(c.author, input.allowlist)) {
      ignoredAuthors.push({
        at: c.at || '',
        login: (c.author && c.author.login) || '(none)',
        association: (c.author && c.author.author_association) || '(none)',
      });
      continue;
    }
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
    if (!namesHead(head, a.commit)) {
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

module.exports = { parseVerdict, evaluate, isAllowedAuthor, normalizeAllowlist, STRICT, TESTER_EVIDENCE_FIELDS };
