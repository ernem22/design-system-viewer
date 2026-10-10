#!/usr/bin/env bash
# Probe: a dead TUI must read EXITED through supervise.sh's real cycle, and must be REPORTED ONCE.
#
# Two defects, both measured 2026-10-02, both in this path:
#   1. a killed TUI produced no counter, which is byte-identical to "telemetry unavailable", so
#      stall-check said UNKNOWN and supervise said "could not decide; leaving it alone" - the
#      recovery never fired for the one case it was written for (probe-role999 in the sandbox);
#   2. the same report was re-filed on every pass, because the seen-set is only written with --act:
#      2760 notes in the durable inbox naming only 41 distinct dispatches.
#
# `orca` is shimmed and answers a fabricated dispatch whose screen shows a column-0 shell prompt and
# no counter - the exact shape probe-role999 had. The worktree is a real directory, because
# stall-check takes a different path when it is gone (which is a different case: the terminal is
# missing, not the TUI).
#
# Exit 0 only when cycle 1 files ONE note as EXITED and cycle 2 files none.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH_NATIVE="$(cygpath -m "${LOCALAPPDATA:-$HOME}/Temp/supervise-tuifix-probe")"
SCRATCH="$(cygpath -u "$SCRATCH_NATIVE")"
FAILED=0
ok()  { printf 'probe: PASS %s\n' "$*"; }
bad() { printf 'probe: FAIL %s\n' "$*"; FAILED=1; }
step() { printf 'probe: ---- %s\n' "$*"; }

rm -rf "$SCRATCH"
WT="$SCRATCH_NATIVE/wt-probe"
mkdir -p "$WT/app/dist" "$SCRATCH/bin" "$SCRATCH/inbox" "$SCRATCH/state"

cat > "$SCRATCH/bin/orca" <<'SHIM'
#!/usr/bin/env bash
W="${PROBE_WT:-}"
case "$1 $2" in
  # stall-check.sh derives the run from Orca (the RUN fallback fix), so a shim that does not
  # answer this exits 2 before it ever reads a screen - which is indistinguishable, in
  # supervise.sh's output, from the UNKNOWN the probe exists to catch. Measured 2026-10-02:
  # without this case the probe reported "could not decide" for a dead TUI that the code below
  # handles correctly.
  "orchestration run-current")
    printf '{"ok":true,"result":{"run":{"id":"run_probe","status":"active"}}}\n'; exit 0;;
  "orchestration worker-list")
    printf '{"ok":true,"result":{"workers":[{"dispatchId":"ctx_probe","taskId":"task_probe","state":"ready","dispatchStatus":"dispatched","projection":{"liveness":{"verdict":"unverifiable","reason":"stale_status"}},"agentTerminalHandle":"term_probe"}]}}\n'; exit 0;;
  "orchestration task-list")
    printf '{"ok":true,"result":{"tasks":[{"id":"task_probe","task_title":"tester #999: probe"}]}}\n'; exit 0;;
  # The recorded screen, handed back exactly as worker-read hands it back: source=terminal with
  # result.terminal.tail. PROBE_TAIL must be a NATIVE path - node cannot read an MSYS one here.
  "orchestration worker-read")
    node -e 'const fs=require("fs");const lines=fs.readFileSync(process.env.PROBE_TAIL,"utf8").split(/\r?\n/).filter(l=>l.length);process.stdout.write(JSON.stringify({ok:true,result:{source:"terminal",terminal:{tail:lines}}}));'; exit 0;;
  "terminal list")
    printf '{"ok":true,"result":{"terminals":[{"handle":"term_probe","worktreePath":"%s","agentIdentity":"opencode"}]}}\n' "$W"; exit 0;;
  *) printf '{"ok":false,"error":{"code":"probe_unshimmed","message":"probe shim got: %s"}}\n' "$*" >&2; exit 3;;
esac
SHIM
chmod +x "$SCRATCH/bin/orca"

# The screens the shim hands back. PROBE_TAIL is the file worker-read's tail lines are read from.
printf '%s\n' "PS C:\\Users\\zurza\\orca\\workspaces\\design-system-viewer\\probe-role999>" > "$SCRATCH_NATIVE/tail-dead.txt"
printf '%s\n' "  ┃  PS C:\\Users\\zurza\\orca\\workspaces\\design-system-viewer\\probe-sandbox>" "     ▣  Build · DeepSeek V4.1 Flash" "  18.6K (2%) · \$0.00" > "$SCRATCH_NATIVE/tail-live.txt"

run_cycle() {
  PATH="$SCRATCH/bin:$PATH" PROBE_WT="$WT" PROBE_TAIL="$1" \
  SUPERVISE_STATE="$SCRATCH/state" SUPERVISE_LOG="$SCRATCH/supervise.log" \
  INBOX_DIR="$SCRATCH/inbox" SUPERVISE_READ_GAP=1 \
  bash "$HERE/supervise.sh" --once --run run_probe 2>&1
}

count_notes() { ls "$SCRATCH/inbox" 2>/dev/null | grep -c 'supervise-ctx_probe' || true; }

step "cycle 1: a dead TUI (col-0 prompt, no counter)"
OUT1="$(run_cycle "$SCRATCH_NATIVE/tail-dead.txt")"
printf '%s\n' "$OUT1" | sed 's/^/probe:   /'
printf '%s\n' "$OUT1" | grep -qF 'ctx_probe (tester #999: probe [dispatched]) -> EXITED' || bad "cycle 1 did not read the dead TUI as EXITED"
printf '%s\n' "$OUT1" | grep -qF 'ctx_probe (tester #999: probe [dispatched]) -> EXITED' && ok "cycle 1 reads the dead TUI as EXITED"
printf '%s\n' "$OUT1" | grep -q 'could not decide' && bad "cycle 1 still fell through to 'could not decide' (the old UNKNOWN)"
[ "$(count_notes)" = "1" ] || bad "cycle 1 filed $(count_notes) notes, expected exactly 1"
[ "$(count_notes)" = "1" ] && ok "cycle 1 filed one note"
ls "$SCRATCH/inbox" | grep -q 'EXITED' || bad "the note is not named EXITED"

step "cycle 2: the same dispatch, same verdict - nothing new may be filed"
BEFORE="$(count_notes)"
OUT2="$(run_cycle "$SCRATCH_NATIVE/tail-dead.txt")"
printf '%s\n' "$OUT2" | sed 's/^/probe:   /'
printf '%s\n' "$OUT2" | grep -q 'already reported as EXITED' || bad "cycle 2 did not recognise the repeat"
printf '%s\n' "$OUT2" | grep -q 'already reported as EXITED' && ok "cycle 2 recognises the repeat"
[ "$(count_notes)" = "$BEFORE" ] || bad "cycle 2 filed $(($(count_notes) - BEFORE)) more note(s)"
[ "$(count_notes)" = "$BEFORE" ] && ok "cycle 2 filed nothing new ($BEFORE note still)"

step "control: a LIVE screen (gutter-prefixed prompt, counter present) must not read EXITED"
rm -f "$SCRATCH/state/noted-dispatches"
OUT3="$(run_cycle "$SCRATCH_NATIVE/tail-live.txt")"
printf '%s\n' "$OUT3" | sed 's/^/probe:   /'
printf '%s\n' "$OUT3" | grep -q -- '-> EXITED' && bad "the live screen was read as EXITED"
printf '%s\n' "$OUT3" | grep -q -- '-> EXITED' || ok "the live screen is not read as EXITED"

rm -rf "$SCRATCH"
[ "$FAILED" -eq 0 ] && { echo "probe: ALL PASS"; exit 0; }
echo "probe: FAILURES ABOVE"; exit 1
