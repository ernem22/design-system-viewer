#!/usr/bin/env node
// Print the worker's own report for one Task, as plain text, from `orca orchestration task-list --json`.
//
//   orca orchestration task-list --json | node lib/task-result.cjs <task_id>
//
// The report shape is Orca's, not ours, so every string under the task's result is printed, newest
// structure first: a body that holds `status: / role: / commit: ...` lines comes out as those lines,
// which is what verdict-post.sh --from-settlement reads. Exit 3 when the task or its result is absent.
let s = '';
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  const id = process.argv[2];
  let j;
  try { const i = s.indexOf('{'); j = JSON.parse(i >= 0 ? s.slice(i) : s); } catch (e) { process.exit(4); }
  const r = j.result || {};
  const tasks = Array.isArray(r) ? r : r.tasks || r.items || [];
  const t = tasks.find((x) => x && (x.id === id || x.taskId === id || x.task_id === id));
  if (!t) process.exit(3);
  let res = t.result;
  if (typeof res === 'string') { try { res = JSON.parse(res); } catch (e) { /* plain text */ } }
  if (res == null) process.exit(3);
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(res);
  if (!out.length) process.exit(3);
  process.stdout.write(out.join('\n') + '\n');
});
