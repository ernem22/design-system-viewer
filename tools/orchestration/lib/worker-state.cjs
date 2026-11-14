// Live state of one worker: is its counter moving, what does its tail say, is it stalled?
// Usage: node worker-state.cjs <worktree-substring> [interval-seconds]
// Reads the terminal twice, a measured interval apart, and prints both readings - the same signal
// stall-check.sh uses, so a coordinator can see the truth without guessing from a projection.
const { execFileSync } = require('child_process');

const want = process.argv[2];
const interval = parseInt(process.argv[3] || '0', 10);

function orca(args) {
  return execFileSync('orca', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function handleFor(sub) {
  const t = (JSON.parse(orca(['terminal', 'list', '--json'])).result || {}).terminals || [];
  // Only the AGENT terminal for this worktree. A worktree can hold two terminals (a plain shell and
  // the opencode TUI); matching on path alone picks the shell, which sits at a prompt with no
  // counter and reads as STALL. Measured 2026-09-28 on coder-118 - the same class of bug the ghost
  // check had.
  const x = t.find(y => String(y.worktreePath || '').indexOf(sub) >= 0 && y.agentIdentity === 'opencode');
  return x ? x.handle : '';
}
function read(h) {
  const t = (JSON.parse(orca(['terminal', 'read', '--terminal', h, '--limit', '14', '--json'])).result || {}).terminal || {};
  const tail = (t.tail || []).join('\n');
  const m = tail.match(/([0-9.]+K) \(([0-9]+)%\) [^0-9]*([0-9.]+)/);
  return { counter: m ? m[1] + ' ' + m[2] + '% $' + m[3] : 'none', tail };
}
function wait(ms) { const t = Date.now(); while (Date.now() - t < ms) {} }

const h = handleFor(want);
if (!h) { console.log('worker-state: no terminal for "' + want + '"'); process.exit(0); }
const a = read(h);
console.log('  handle   : ' + h);
console.log('  counter A: ' + a.counter);
if (interval > 0) {
  wait(interval * 1000);
  const b = read(h);
  console.log('  counter B: ' + b.counter);
  const verdict = a.counter !== b.counter ? 'PROGRESSING'
    : (a.tail === b.tail ? 'STALL' : 'OUTPUT_CHANGED');
  console.log('  verdict  : ' + verdict + (verdict === 'STALL' ? '  <- no tokens, no output in ' + interval + 's' : ''));
  console.log('  tail     :');
  for (const l of b.tail.split('\n').slice(-6)) console.log('    ' + l.slice(0, 104));
} else {
  console.log('  tail     :');
  for (const l of a.tail.split('\n').slice(-8)) console.log('    ' + l.slice(0, 104));
}
