#!/usr/bin/env bash
# Stateless merge packet: read Orca's own state for one PR and print the packet
# the coordinator parses. Holds no state of its own — Orca owns it all.
#
#   packet.sh <pr-number> [run-id] [task-id ...]
#
# The task ids are the ones the caller started for THIS PR in this cycle. They
# are what makes the packet precise: a gate's verdict is matched to the PR by
# task id (the caller knows the mapping because it started them), by the PR
# number appearing in the body, or by the verdict naming the PR's head sha.
#
# "on this head" is decided by: the verdict names the head sha, or the verdict
# arrived after the head commit was written (a verdict that predates the last
# commit cannot have seen it).
#
# A field that cannot be filled prints UNKNOWN: send the PR back to the phase
# that owes it rather than guessing.
set -uo pipefail

PR="${1:?usage: packet.sh <pr-number> [run-id] [task-id ...]}"
RUN="${2:-run_4e539259ab29}"
shift 2 2>/dev/null || shift 1
TASKS="$*"
TMP="${LOCALAPPDATA}/Temp/packet_$$.json"

HEAD=$(gh pr view "$PR" --json headRefOid --jq .headRefOid 2>/dev/null)
STATE=$(gh pr view "$PR" --json state --jq .state 2>/dev/null)
TITLE=$(gh pr view "$PR" --json title --jq .title 2>/dev/null)
HEADDATE=$(gh pr view "$PR" --json commits --jq '.commits[-1].committedDate' 2>/dev/null)
CI_RAW=$(gh pr checks "$PR" 2>&1 | head -1)
case "$CI_RAW" in
  *pass*) CI="green" ;;
  *fail*) CI="failed" ;;
  *)      CI="pending" ;;
esac

orca orchestration check --run "$RUN" --all --json > "$TMP" 2>/dev/null

node -e '
const fs=require("fs");
const pr=process.argv[1], head=(process.argv[2]||""), headDate=(process.argv[3]||"");
const tasks=(process.argv[4]||"").split(/\s+/).filter(Boolean);
let j; try{ j=JSON.parse(fs.readFileSync(process.argv[5],"utf8")); }catch(e){ j=null; }
const list=(j&&j.result&&(j.result.deliveries||j.result.messages))||[];
const short=head.slice(0,7);
const out=[];
for(const role of ["reviewer","tester"]){
  const hits=[];
  for(const d of list){
    const blob=JSON.stringify(d);
    const b=(d.body||d.text||(d.payload&&d.payload.body)||"");
    if(!b) continue;
    const r=(b.match(/^role:\s*(\w[\w -]*)$/m)||[])[1];
    if(r!==role) continue;
    const task=(d.payload&&d.payload.taskId)||(b.match(/^task:\s*(\S+)/m)||[])[1]||"";
    const byTask = task && tasks.includes(task);
    const byName = blob.includes("/pull/"+pr) || blob.includes("#"+pr) ||
                   b.includes("pr: "+pr) || b.includes("PR "+pr);
    const said=(b.match(/^commit:\s*(\S+)/m)||[])[1]||"";
    const byHead = !!said && said!=="none" && (said===head || said.startsWith(short));
    if(!byTask && !byName && !byHead) continue;
    const at=d.created_at||d.delivered_at||d.at||d.createdAt||(d.payload&&d.payload.at)||"";
    hits.push({
      at,
      status:(b.match(/^status:\s*(\w+)/m)||[])[1]||"UNKNOWN",
      scope:(b.match(/^scope_ok:\s*(\w+)/m)||[])[1]||"",
      build:(b.match(/^build:\s*(.+)$/m)||[])[1]||"",
      obs:(b.match(/^observed:\s*(.+)$/m)||[])[1]||"",
      byHead,
      afterHead: !!(at && headDate && at > headDate),
      how: byHead?"names the head sha":(byTask?"matched by task id":"matched by PR number only")
    });
  }
  if(!hits.length){ out.push(role+": UNKNOWN"); continue; }
  hits.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  const chain=hits.map(h=>h.status).join(" -> ");
  const last=hits[hits.length-1];
  const onHead=last.byHead||last.afterHead;
  let line=role+": "+chain;
  if(hits.length>1) line+=" (latest: "+last.status+(last.scope?" scope_ok: "+last.scope:"")+")";
  else if(last.scope) line+=" scope_ok: "+last.scope;
  if(role==="tester"&&last.build) line+=" on "+last.build;
  line+=" ["+(onHead?(last.byHead?last.how:"delivered after the head commit — "+last.how)
                     :"NOT verified on this head — re-run this gate")+"]";
  out.push(line);
  const ev=hits.filter(x=>x.obs).pop();
  if(ev) out.push(role+" evidence: "+ev.obs.slice(0,140));
}
console.log(out.join("\n"));
' "$PR" "$HEAD" "$HEADDATE" "$TASKS" "$TMP"

rm -f "$TMP"

echo "pr: $PR"
echo "title: ${TITLE:-UNKNOWN}"
echo "head: ${HEAD:-UNKNOWN}"
echo "state: ${STATE:-UNKNOWN}"
echo "ci: $CI ($CI_RAW)"
