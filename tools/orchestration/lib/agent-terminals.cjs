// Worker terminals that are candidates for ghost cleanup.
//
// A ghost is an AGENT terminal whose handle no dispatch in the run names any more. Only worker
// terminals qualify: a terminal whose agent identity is the coordinator ("hermes") owns no
// dispatch, so a "named by no dispatch" test would condemn the coordinator's own terminal -
// measured 2026-09-28, when a dry run proposed closing the session that was running it.
//
// Prints one line per candidate: handle|worktreePath|agentIdentity
const me = process.env.ORCA_TERMINAL_HANDLE || '';
let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  try {
    const t = (JSON.parse(s).result || {}).terminals || [];
    const out = t
      .filter(x => x.agentIdentity === 'opencode' && x.handle !== me)
      .map(x => x.handle + '|' + (x.worktreePath || '') + '|' + x.agentIdentity);
    process.stdout.write(out.join('\n'));
  } catch (e) { /* no terminals readable: print nothing rather than guess */ }
});
