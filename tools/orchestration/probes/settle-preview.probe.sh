#!/usr/bin/env bash
# Probe: settling a dispatch must not leave the preview that served it behind.
#
# Reproduces the measured leak - 2026-10-02: a preview process still bound to a port while the
# worktree directory it named was gone from disk - inside a FABRICATED dispatch, so settle.sh's own
# path runs end to end (release -> 5b stop-by-worktree -> remove -> 6b orphan sweep) without
# touching the live run. `orca` is shimmed on PATH and answers only the calls settle.sh makes; every
# real thing here is real (a worktree directory, a listening preview process, a port).
#
# Scenario A  the worktree is still known and present: 5b must stop the preview by path.
# Scenario B  Orca no longer reports the worktree (empty agentTerminalHandle) and the directory is
#             already gone: 5b cannot run, so 6b must catch it. This is the crash case.
#
# Exit 0 only when both scenarios end with the preview gone, its port free, and settle.sh at DONE.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
# Two forms of the same directory, and the distinction matters: a `C:\...` path put on PATH is
# split at the drive colon, so the shim would never be found and the probe would silently pass its
# calls to the REAL orca (measured here: settle.sh answered "no dispatch ... in run"). The
# worktree path, by contrast, must be NATIVE, because the preview's command line is what
# serve.sh matches against - an MSYS path there matches nothing.
SCRATCH_NATIVE="$(cygpath -m "${LOCALAPPDATA:-$HOME}/Temp/settle-preview-probe")"
SCRATCH="$(cygpath -u "$SCRATCH_NATIVE")"
NODE_EXE="C:/Program Files/nodejs/node.exe"
PORT_A=8131
PORT_B=8132
FAILED=0

ok()   { printf 'probe: PASS %s\n' "$*"; }
bad()  { printf 'probe: FAIL %s\n' "$*"; FAILED=1; }
step() { printf 'probe: ---- %s\n' "$*"; }

listeners() { powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort $1 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count" 2>/dev/null | tr -d '\r' | tr -d ' '; }

# The preview names its worktree in the command line, exactly as the real `serve2.js <wt> <port>`
# leak did - that is what makes it findable after its directory is gone.
start_preview() {
  local wt="$1" port="$2"
  powershell -NoProfile -Command "Start-Process -FilePath '$NODE_EXE' -ArgumentList '$SCRATCH_NATIVE/preview.cjs','$wt','$port' -WindowStyle Hidden" >/dev/null 2>&1
  local i
  for i in $(seq 1 15); do
    [ "$(curl -s -m 2 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" 2>/dev/null)" = "200" ] && return 0
    sleep 1
  done
  return 1
}

# An orca that answers ONLY what settle.sh asks. An unshimmed subcommand is a loud failure, not a
# silent empty answer: a probe that lets a real call through would be reporting on the wrong system.
write_shim() {
  mkdir -p "$SCRATCH/bin"
  cat > "$SCRATCH/bin/orca" <<'SHIM'
#!/usr/bin/env bash
W="${PROBE_WT:-}"
case "$1 $2" in
  "orchestration worker-list")
    if [ -n "${PROBE_NO_HANDLE:-}" ]; then H=""; else H="term_probe"; fi
    printf '{"ok":true,"result":{"workers":[{"dispatchId":"ctx_probe","taskId":"task_probe","state":"ready","projection":{"liveness":{"verdict":"live"}},"agentTerminalHandle":"%s"}]}}\n' "$H"; exit 0;;
  "orchestration task-list")
    printf '{"ok":true,"result":{"tasks":[{"id":"task_probe","status":"completed"}]}}\n'; exit 0;;
  "orchestration check")
    case "$*" in
      *--ack*) printf '{"ok":true}\n'; exit 0;;
      *) printf '{"ok":true,"result":{"deliveryId":"del_probe","messages":[{"id":"m1","type":"settlement","subject":"probe","from_handle":"term_probe","payload":"ctx_probe settled"}]}}\n'; exit 0;;
    esac;;
  "orchestration worker-release")
    printf '{"ok":true,"result":{"state":"released"}}\n'; exit 0;;
  "worktree list")
    printf '{"ok":true,"result":{"worktrees":[{"path":"%s","branch":"refs/heads/probe-nothing","repoId":"repo_probe"}]}}\n' "$W"; exit 0;;
  "terminal list")
    printf '{"ok":true,"result":{"terminals":[{"handle":"term_probe","worktreePath":"%s","agentIdentity":"opencode"}]}}\n' "$W"; exit 0;;
  "terminal close") printf '{"ok":true}\n'; exit 0;;
  # Orca removes the directory; the preview, started outside that lifecycle, keeps running. That
  # asymmetry IS the bug this probe exists to catch.
  "worktree rm") rm -rf "$W"; printf '{"ok":true}\n'; exit 0;;
  *) printf '{"ok":false,"error":{"code":"probe_unshimmed","message":"probe shim got: %s"}}\n' "$*" >&2; exit 3;;
esac
SHIM
  chmod +x "$SCRATCH/bin/orca"
}

run_settle() {
  PATH="$SCRATCH/bin:$PATH" \
  PROBE_WT="$1" PROBE_NO_HANDLE="${2:-}" \
  WATCH_RUN=run_probe ORCA_REPO_ID=repo_probe ORCA_TERMINAL_HANDLE=term_coord \
  INBOX_DIR="$SCRATCH/inbox" \
  bash "$HERE/settle.sh" ctx_probe 2>&1
}

rm -rf "$SCRATCH"
mkdir -p "$SCRATCH/inbox"
# Leftovers from an interrupted earlier run: previews whose directory this rm just deleted are
# orphans, and a probe that starts from a dirty host would report on the wrong process.
bash "$HERE/serve.sh" --orphans --kill >/dev/null 2>&1
cat > "$SCRATCH/preview.cjs" <<'JS'
const http = require("http");
http.createServer((q, s) => { s.writeHead(200, {"content-type": "text/html"}); s.end("probe"); })
  .listen(Number(process.argv[3]), "127.0.0.1");
JS
write_shim

for SCEN in A B; do
  WT="$SCRATCH_NATIVE/wt-$SCEN"
  # Each scenario gets its own inbox: the second one sharing the first's settlement would take the
  # "already settled" path and stop exercising the ack.
  rm -rf "$SCRATCH/inbox"; mkdir -p "$SCRATCH/inbox"
  if [ "$SCEN" = "A" ]; then PORT="$PORT_A"; NO_HANDLE=""; else PORT="$PORT_B"; NO_HANDLE=1; fi
  mkdir -p "$WT/app/dist"; echo "<html>probe</html>" > "$WT/app/dist/index.html"

  step "scenario $SCEN: preview up on $PORT naming $WT"
  start_preview "$WT" "$PORT" || bad "scenario $SCEN: the preview never answered 200 (setup failed)"
  [ "$(listeners "$PORT")" = "1" ] || bad "scenario $SCEN: expected exactly 1 listener on $PORT, got $(listeners "$PORT")"

  # B is the crash case: the directory is already gone before settle.sh runs.
  [ "$SCEN" = "B" ] && rm -rf "$WT"

  step "scenario $SCEN: settle.sh (real path, shimmed orca)"
  OUT="$(run_settle "$WT" "$NO_HANDLE")"
  printf '%s\n' "$OUT" | sed 's/^/probe:   /'

  printf '%s\n' "$OUT" | grep -q 'DONE ctx_probe' || bad "scenario $SCEN: settle.sh did not reach DONE"
  [ "$(listeners "$PORT")" = "0" ] || bad "scenario $SCEN: port $PORT is STILL served after settling"
  [ "$(listeners "$PORT")" = "0" ] && ok "scenario $SCEN: port $PORT free after settling"
  [ -d "$WT" ] && bad "scenario $SCEN: the worktree directory still exists"
  # The stop must be attributable: A settles because 5b named the worktree, B only because 6b
  # matched a path that is gone. A quiet pass would not say which mechanism did the work.
  if [ "$SCEN" = "A" ]; then
    printf '%s\n' "$OUT" | grep -q 'killed pid .* names ' || bad "scenario $SCEN: 5b did not stop the preview by worktree"
    printf '%s\n' "$OUT" | grep -q 'killed pid .* names ' && ok "scenario $SCEN: 5b stopped the preview by worktree name"
  else
    printf '%s\n' "$OUT" | grep -q 'serves missing path' || bad "scenario $SCEN: 6b did not catch the orphan"
    printf '%s\n' "$OUT" | grep -q 'serves missing path' && ok "scenario $SCEN: 6b caught the orphan by its missing path"
  fi
done

rm -rf "$SCRATCH"
[ "$FAILED" -eq 0 ] && { echo "probe: ALL PASS"; exit 0; }
echo "probe: FAILURES ABOVE"; exit 1
