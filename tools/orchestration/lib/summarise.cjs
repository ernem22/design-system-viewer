// Summarise the RAM sampler: per-worker tree MB (first / peak / last) and the
// available_mb series, from the CSV the sampler has been writing.
const fs = require('fs');
const dir = process.env.LOCALAPPDATA + '/Temp/dsv-ram';
const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort();
const rows = [];
for (const f of files) {
  const lines = fs.readFileSync(`${dir}/${f}`, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(1)) {
    const [ts, avail, pid, wt, mb] = line.split(',');
    rows.push({ ts, avail: Number(avail), pid, wt: (wt || '').trim(), mb: mb === '' ? null : Number(mb) });
  }
}
console.log('sampler rows:', rows.length, '| files:', files.join(', '));
if (!rows.length) process.exit(0);

const first = rows[0].ts, last = rows[rows.length - 1].ts;
console.log(`window: ${first} -> ${last}`);

// available_mb series
const av = rows.map((r) => r.avail).filter((n) => Number.isFinite(n));
const minAv = Math.min(...av), maxAv = Math.max(...av);
const minRow = rows.find((r) => r.avail === minAv);
console.log(`available_mb  min ${minAv} (at ${minRow.ts})  max ${maxAv}  samples ${av.length}`);
const buckets = {};
for (const r of rows) { if (r.avail < 400) buckets['<400'] = (buckets['<400'] || 0) + 1; else if (r.avail < 600) buckets['400-599'] = (buckets['400-599'] || 0) + 1; else buckets['>=600'] = (buckets['>=600'] || 0) + 1; }
console.log('samples by band:', JSON.stringify(buckets));

// per worker tree
const byWt = {};
for (const r of rows) {
  if (!r.wt || r.mb === null) continue;
  (byWt[r.wt] = byWt[r.wt] || []).push(r);
}
console.log('\nper-worker opencode tree (opencode + descendants):');
console.log('worktree        samples  first   peak    last   firstSeen  lastSeen   pids');
for (const [wt, rs] of Object.entries(byWt).sort((a, b) => a[1][0].ts.localeCompare(b[1][0].ts))) {
  const mbs = rs.map((r) => r.mb);
  const pids = [...new Set(rs.map((r) => r.pid))];
  console.log(
    wt.padEnd(15),
    String(rs.length).padStart(6),
    String(mbs[0]).padStart(7),
    String(Math.max(...mbs)).padStart(7),
    String(mbs[mbs.length - 1]).padStart(7),
    rs[0].ts.slice(11, 19).padStart(10),
    rs[rs.length - 1].ts.slice(11, 19).padStart(9),
    '  ' + pids.join(','),
  );
}

// how many trees were live at each sample
const perTs = {};
for (const r of rows) { perTs[r.ts] = (perTs[r.ts] || 0) + (r.wt ? 1 : 0); }
const counts = Object.values(perTs);
console.log(`\ntrees live per sample: min ${Math.min(...counts)} max ${Math.max(...counts)}`);
const total = {};
for (const r of rows) if (r.wt) total[r.ts] = (total[r.ts] || 0) + r.mb;
const tot = Object.entries(total).map(([ts, v]) => [ts, Math.round(v)]);
tot.sort();
console.log('total opencode MB (last 6 samples):', tot.slice(-6).map(([t, v]) => `${t.slice(11, 19)}=${v}`).join('  '));
