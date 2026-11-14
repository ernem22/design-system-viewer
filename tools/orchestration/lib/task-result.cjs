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
  if (!j || typeof j !== 'object') process.exit(4);
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
  // A worker may send its whole report on ONE line: `status: pass | role: reviewer | commit: b383367 ||
  // <prose>` (measured 2026-10-04, reviewer #163, task_3d81f4b051ac). verdict-post reads one field per
  // line, so it took the entire line as the status and refused. Split such a line back into fields:
  // `||` ends the field list, ` | ` separates the fields before it.
  const lines = [];
  for (const text of out) {
    for (const line of text.split(/\r?\n/)) {
      // ...or joined with "; " (measured 2026-10-05, tester #241, task_202f4d88e6fa: `status: pass; role:
      // tester; task: ...; observed: ... . before: ...`). Split only before a known field name (after "; "
      // or ". "), because an observed: value itself holds "; " between findings.
      // ...or with ". " (measured 2026-10-06, tester #244, task_eb8d2c91398b: `status: pass. role: tester.
      // task: ... before: ...`), which the "; " test missed: the whole line became the status.
      // ...or with NO separator at all (measured 2026-10-09, tester #300, task_58208da47e12: `status:
      // passrole: testertask: task_58208da47e12commit: 4059587tests: n-abuild: ...observed: ...before:
      // ...`, the line breaks lost; the whole line became the status). Recognised only when the status
      // word runs straight into the next field name; the line is then split before every field name.
      // ...or joined with plain spaces (measured 2026-10-10, reviewer #332, task_4f36f587a5f1: `status: pass
      // role: reviewer task: ... commit: d4b9e57 scope_ok: yes Correctness: ...`): the same split, before
      // every field name that follows whitespace.
      if (/^\s*status:\s*(?:pass|fail)\s*(?=(?:role|task|commit|tests|build|lint|observed|before|reason|fix_required|scope_ok|source|pr|head)\s*:)/i.test(line)) {
        for (const f of line.split(/(?=(?:status|role|task|commit|tests|build|lint|observed|before|reason|fix_required|scope_ok|source|pr|head)\s*(?:\([^)]*\))?\s*:)/i))
          if (f.trim()) lines.push(f.trim());
      } else if (/^\s*status:\s*[a-z]+\s*[;.]\s/i.test(line)) {
        for (const f of line.split(/[;.]\s+(?=(?:status|role|task|commit|tests|build|lint|observed|before|reason|fix_required|scope_ok|source|pr|head)\s*:)/i))
          if (f.trim()) lines.push(f.trim());
      } else if (/^\s*status:\s*[a-z]+\s*\|/i.test(line)) {
        const cut = line.indexOf('||');
        const head = cut >= 0 ? line.slice(0, cut) : line;
        for (const f of head.split(/\s+\|\s+/)) if (f.trim()) lines.push(f.trim());
        if (cut >= 0 && line.slice(cut + 2).trim()) lines.push(line.slice(cut + 2).trim());
      } else if (/^\s*[A-Za-z][\w-]*\s*:\s*(?:observed|before|build)\b[^:]*:/i.test(line)) {
        // ...or as a labelled list (measured 2026-10-07, tester #294 on space-bunny-free:
        // `VERIFIED-1: observed: ... -> before: ...`, eight such lines and no line starting with
        // observed:). The label is dropped and the line split before each evidence field, after "->",
        // "; " or ". ". Evidence is still required: this only finds fields the Tester did write.
        const body = line.replace(/^\s*[A-Za-z][\w-]*\s*:\s*/, '');
        for (const f of body.split(/\s*(?:->|=>|[;.])\s+(?=(?:observed|before|build|reason|fix_required|scope_ok)\b[^:]*:)/i))
          if (f.trim()) lines.push(f.trim());
      } else if (/[;.]\s+(?:observed|before|build|reason|fix_required|scope_ok)\s*(?:\([^)]*\))?\s*:/i.test(line)) {
        // ...and a multi-line report can still put an evidence field mid-line (measured 2026-10-06:
        // tester #238 `observed: ... '1Source'; before: base ...`, tester #243 `build: ... observed: ...
        // before: ...`). verdict-post reads fields at line start only, so both were refused ("missing:
        // before") though the Tester wrote them, and each Tester ran twice. Split before those field
        // names only: the status/role/commit lines are never taken from prose.
        // (2026-10-07, tester #294: `build: ... . BEFORE (declaration-level, read via git show b85abef): ...
        // . OBSERVED (Playwright Chromium ...): (1) ...` - upper case, and a parenthesis before the colon)
        for (const f of line.split(/[;.]\s+(?=(?:observed|before|build|reason|fix_required|scope_ok)\s*(?:\([^)]*\))?\s*:)/i))
          if (f.trim()) lines.push(f.trim());
      } else lines.push(line);
    }
  }
  // verdict-post matches `^observed:` etc.: an evidence field written `OBSERVED (how it was measured): x`
  // becomes `observed: (how it was measured) x`. Nothing is added; the text is only moved behind the name.
  const EV = /^(observed|before|build|reason|fix_required|scope_ok)\s*(\([^)]*\))?\s*:\s*/i;
  const norm = lines.map((l) => { const m = EV.exec(l); return m ? `${m[1].toLowerCase()}: ${m[2] ? m[2] + ' ' : ''}${l.slice(m[0].length)}` : l; });
  // One-word fields keep one word: `scope_ok: yes Correctness: ...` (reviewer #332, a joined report) was
  // read as scope_ok "yes Correctness: ..." and refused. The rest of the line is kept as its own line.
  const ONE = /^(status|role|scope_ok):\s*(\S+)\s+(\S.*)$/i;
  const out2 = [];
  for (const l of norm) { const m = ONE.exec(l); if (m) out2.push(`${m[1]}: ${m[2]}`, m[3]); else out2.push(l); }
  norm.length = 0; norm.push(...out2);
  process.stdout.write(norm.join('\n') + '\n');
});
