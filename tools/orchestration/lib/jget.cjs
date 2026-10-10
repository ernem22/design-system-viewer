#!/usr/bin/env node
// Read one Orca --json reply on stdin and print the values at the given dotted paths, one per line.
//
//   orca ... --json | node lib/jget.cjs ok result.dispatchId result.worker.worktreeId
//
// orca.exe can print crashpad noise before the JSON, so parsing starts at the first '{'.
// A missing path prints an empty line, never "undefined", so a caller's `read` stays aligned.
// Unparseable input exits 4 and prints nothing: the caller must treat that as "unknown", not "no".
// A reader that takes only the first line (`| grep -m1 .`) closes the pipe early; that is not an error.
process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); throw e; });
let s = '';
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  let j;
  try {
    const i = s.indexOf('{');
    j = JSON.parse(i >= 0 ? s.slice(i) : s);
  } catch (e) {
    process.exit(4);
  }
  for (const path of process.argv.slice(2)) {
    let v = j;
    for (const k of path.split('.')) v = v == null ? undefined : v[k];
    if (v == null) v = '';
    process.stdout.write((typeof v === 'object' ? JSON.stringify(v) : String(v)) + '\n');
  }
});
