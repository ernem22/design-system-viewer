// The agent terminal handles that the run's dispatches still name.
//
// Used by settle.sh's ghost check: a worker terminal whose handle is absent from this list has no
// dispatch behind it any more. Prints one handle per line.
let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  try {
    const w = (JSON.parse(s).result || {}).workers || [];
    process.stdout.write(w.map(x => x.agentTerminalHandle).filter(Boolean).join('\n'));
  } catch (e) { /* unreadable: print nothing, so the caller treats no handle as named */ }
});
