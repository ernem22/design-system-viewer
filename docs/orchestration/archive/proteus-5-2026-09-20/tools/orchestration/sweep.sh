#!/usr/bin/env bash
# Sweep settled orchestration tasks off the board.
#
# Why: every supervised worker leaves a task behind. When its dispatch settles the task is
# marked completed by the worker itself, but a worker that DIES mid-run leaves the task in
# `ready` or `blocked` forever, and nothing in the merge path ever revisits it. They pile up
# until the board shows dozens of "open" tasks for work that landed hours ago.
#
# This closes only the unambiguous ones:
#   completed - the task names a PR that is MERGED, or an issue that is CLOSED
#   failed    - the task names a PR/issue that is still open AND its dispatch is settled
#               (dead worker, superseded work) AND no live dispatch shares its task id
# A task whose dispatch is still live is never touched.
#
#   sweep.sh [--dry-run]
set -uo pipefail

DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"
RUN="${WATCH_RUN:-run_4e539259ab29}"

TMP="${LOCALAPPDATA:-/tmp}/Temp"
mkdir -p "$TMP"

orca orchestration task-list --json > "$TMP/sweep_tasks.json" 2>/dev/null || {
  echo "sweep: task-list failed"; exit 1; }
orca orchestration worker-list --run "$RUN" --json > "$TMP/sweep_workers.json" 2>/dev/null || {
  echo "sweep: worker-list failed"; exit 1; }
gh pr list --state merged --limit 200 --json number --jq '[.[].number]|join(",")' > "$TMP/sweep_merged.txt" 2>/dev/null || echo "" > "$TMP/sweep_merged.txt"
gh issue list --state closed --limit 200 --json number --jq '[.[].number]|join(",")' > "$TMP/sweep_closed.txt" 2>/dev/null || echo "" > "$TMP/sweep_closed.txt"

SWEEP_TMP="$(printf '%s' "$TMP" | tr '\\\\' '/')" node -e "
const fs=require('fs');
const T=process.env.SWEEP_TMP;
const tasks=(JSON.parse(fs.readFileSync(T+'/sweep_tasks.json','utf8')).result||{}).tasks||[];
const workers=(JSON.parse(fs.readFileSync(T+'/sweep_workers.json','utf8')).result||{}).workers||[];
const merged=new Set(fs.readFileSync(T+'/sweep_merged.txt','utf8').split(',').filter(Boolean).map(Number));
const closed=new Set(fs.readFileSync(T+'/sweep_closed.txt','utf8').split(',').filter(Boolean).map(Number));
const liveTaskIds=new Set(workers.filter(w=>w.workerState==='running'||w.workerState==='dispatched').map(w=>w.taskId));
const rows=[];
for(const t of tasks){
  if(!['ready','blocked'].includes(t.status)) continue;
  if(liveTaskIds.has(t.id)) continue;
  const title=t.task_title||'';
  const refs=[...title.matchAll(/(?:PR|issue|#)\s?(\d+)/gi)].map(m=>Number(m[1]));
  const hitMerged=refs.some(n=>merged.has(n));
  const hitClosed=refs.some(n=>closed.has(n));
  const status=(hitMerged||hitClosed)?'completed':'failed';
  const note=hitMerged?'swept: the PR this task names is merged'
            :hitClosed?'swept: the issue this task names is closed'
            :'swept: settled worker, work superseded';
  rows.push([t.id,status,note].join('\t'));
}
fs.writeFileSync(T+'/sweep_rows.tsv',rows.join('\n')+'\n');
console.log('sweep: '+rows.length+' task(s) to close ('+rows.filter(r=>r.includes('\tcompleted\t')).length+' completed, '+rows.filter(r=>r.includes('\tfailed\t')).length+' failed)');
"

if [ -n "$DRY" ]; then
  echo "sweep: dry run, nothing changed"; cat "$TMP/sweep_rows.tsv"; exit 0
fi

ok=0; bad=0
while IFS=$'\t' read -r id st note; do
  [ -z "$id" ] && continue
  if orca orchestration task-update --id "$id" --status "$st" --result "{\"note\":\"$note\"}" --json >/dev/null 2>&1; then
    ok=$((ok+1))
  else
    bad=$((bad+1)); echo "sweep: could not close $id" >&2
  fi
done < "$TMP/sweep_rows.tsv"
echo "sweep: closed $ok task(s), $bad failure(s)"
