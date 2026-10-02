#!/usr/bin/env bash
# Print the opencode terminal handle for one worktree PATH — the exact worktree,
# not the first terminal whose title looks like the role.
#
# Why this exists: orca appends a suffix when a worktree name is taken
# (`reviewer-pr69c` -> `reviewer-pr69c-2`), and a name-based lookup then returns a
# terminal belonging to the OLD worktree. `worker-start` rejects that with
# `terminal_worktree_mismatch`, which is how the bug surfaced.
#
#   handle.sh <worktree-path>
set -uo pipefail

P="${1:?usage: handle.sh <worktree-path> [--agent-only]}"
AGENT_ONLY="${2:-}"
TMP="${LOCALAPPDATA}/Temp/handles_$$.json"
# stderr must NOT be merged in. Every `orca` invocation on this host writes a crashpad
# registration banner to stderr (`[MMDD/HHMMSS.ms:ERROR:...registration_protocol_win.cc:108]
# CreateFile: ...`), and `2>&1` put it in front of the JSON. JSON.parse then threw, the catch
# below took its own exit-path, and this script printed nothing while still exiting 0 - so
# spawn.sh waited its full 75 s and reported "the agent terminal never registered" for a
# terminal that had in fact registered seconds earlier. Measured 2026-10-03 on probe-ab:
# `orca terminal list --json` banner lines on stdout 0/0/0, on stderr 1/1/1.
orca terminal list --json > "$TMP" 2>/dev/null

node -e "
const fs=require('fs');
let j; try{ const raw=fs.readFileSync(process.argv[1],'utf8'); const i=raw.indexOf('{'); j=JSON.parse(i>=0?raw.slice(i):raw); }catch(e){ process.exit(0); }
const want=process.argv[2].replace(/\\\\/g,'/').replace(/\/+\$/,'');
const agentOnly=process.argv[3]==='--agent-only';
const list=(j.result&&(j.result.terminals||j.result.items))||[];
const matches=list.filter(t=>{
  const p=String(t.worktreePath||'').replace(/\\\\/g,'/').replace(/\/+\$/,'');
  if(p===want) return true;
  return String(t.ptyId||'').includes(want);
});
// A worktree can hold more than one terminal: the agent's, and a plain shell.
// worker-start needs the agent's — it rejects a shell with agent_unconfigured.
// The agent terminal registers a few seconds after the worktree is created, so
// --agent-only exists for callers that should wait rather than fall back.
const agent=matches.find(t=>t.agentIdentity && t.agentIdentity!=='undefined');
if(agentOnly && !agent) process.exit(3);
const hit=agent||matches[0];
if(hit) console.log(hit.handle);
" "$TMP" "$P" "$AGENT_ONLY"

rm -f "$TMP"
