#!/usr/bin/env bash
# Wake the coordinator on a settlement, without patterns and without a match cap.
#
# Why the old watcher was replaced. It woke the coordinator with a *pattern* on the
# background process's stdout, and this host caps patterns at 8 delivered matches per
# process ("Watch patterns disabled ... reached the lifetime cap of 8 delivered
# matches"). Measured 2026-09-28: it hit that cap five times in one session, and after
# each cap the coordinator stopped being woken at all - settlements were then found by
# grepping the log, which is exactly the manual step this file exists to remove. The same
# watcher also re-announced settlements it had already delivered (a WAKE for 19:08:02
# arrived after that settlement had been processed), because the wake was driven by a
# line on stdout rather than by the identity of a delivery.
#
# The shape now: ONE wait process per settlement, whose EXIT is the wake. The coordinator
# arms it with notify_on_complete, so the notification is the process ending - no pattern,
# no cap, and no way to be woken twice for the same delivery.
#
#   watch-settlements.sh [--once] [--supervise] [--run <id>] [--timeout-ms <n>] [--inbox <file>]
#
#   --once (default)  wait for one settlement, write it to the inbox, ack it, print the
#                     WAKE line, exit 0. This is the wake.
#   --supervise       keep waiting in a loop, one settlement at a time, printing a WAKE
#                     line per settlement and never exiting on a transient error.
#
# Guarantees this file owns:
#   * single instance - a lock directory holding the pid; a second start refuses, and a
#     lock left by a dead process is detected and taken over;
#   * every settlement body is appended to a durable inbox file BEFORE its delivery is
#     acked, so an ack never destroys the only copy;
#   * no --skip-existing anywhere: a delivery that was already waiting is read, not
#     silently dropped;
#   * a transient failure of the wait call is retried with backoff rather than exiting
#     quietly (the "self-restart" case).
set -uo pipefail

MODE="once"; RUN="${WATCH_RUN:-}"; TIMEOUT_MS=60000
INBOX="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/inbox/settlements.log"
LOCK="${LOCALAPPDATA:-$HOME}/Temp/dsv-watch.lock"
while [ $# -gt 0 ]; do
  case "$1" in
    --once) MODE="once"; shift;;
    --supervise) MODE="supervise"; shift;;
    --run) RUN="${2:?}"; shift 2;;
    --timeout-ms) TIMEOUT_MS="${2:?}"; shift 2;;
    --inbox) INBOX="${2:?}"; shift 2;;
    --lock) LOCK="${2:?}"; shift 2;;
    *) echo "watch-settlements: unknown argument: $1" >&2; exit 2;;
  esac
done
say() { printf 'watch-settlements: %s\n' "$*"; }

# Derive the run from Orca when neither --run nor WATCH_RUN is set. The hardcoded fallback this
# replaces (run_4e539259ab29) was a session constant, and measured 2026-10-01 the coordinator does NOT
# pass --run - so the constant was silently the run in use, and any re-import or new run would leave
# this watcher polling a run nobody is working in.
if [ -z "$RUN" ]; then
  RUN="$(orca orchestration run-current --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((((JSON.parse(s).result||{}).run)||{}).id||"")}catch(e){}})')"
  if [ -z "$RUN" ]; then
    echo "watch-settlements: no run readable from orca orchestration run-current; pass --run <id>" >&2
    exit 2
  fi
  echo "watch-settlements: run derived from orca orchestration run-current: $RUN" >&2
fi

# ---- single instance -----------------------------------------------------------------
pid_alive() { [ -n "${1:-}" ] && powershell.exe -NoProfile -Command "if (Get-Process -Id $1 -ErrorAction SilentlyContinue) { 'yes' }" 2>/dev/null | grep -q yes; }
if ! mkdir "$LOCK" 2>/dev/null; then
  HOLD="$(cat "$LOCK/pid" 2>/dev/null || echo "")"
  if pid_alive "$HOLD"; then
    echo "watch-settlements: REFUSED - another watcher is running (pid $HOLD, lock $LOCK)" >&2
    exit 3
  fi
  say "stale lock from pid ${HOLD:-unknown} (not alive) - taking it over"
  rm -rf "$LOCK" 2>/dev/null || { echo "watch-settlements: cannot clear $LOCK" >&2; exit 2; }
  mkdir "$LOCK" || { echo "watch-settlements: cannot take $LOCK" >&2; exit 2; }
fi
echo "$BASHPID" > "$LOCK/pid"
printf 'watcher_pid=%s\nwatcher_started=%s\nrun=%s\n' "$BASHPID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$RUN" >> "$LOCK/info"
# The wait child is tracked so this process can kill it on the way out: a `check --wait`
# that outlives its watcher holds the run's only waiter slot and blocks every later
# watcher (measured 2026-09-28, three orphans). Acceptance: a human never cleans a waiter.
WAIT_OUT="$(mktemp "$(cd "${TMPDIR:-/tmp}" >/dev/null 2>&1 && { pwd -W 2>/dev/null || pwd; })/dsv-wait.XXXXXX")"
CHILD_PID=""
cleanup() {
  if [ -n "$CHILD_PID" ] && pid_alive "$CHILD_PID"; then
    taskkill -F -T -PID "$CHILD_PID" >/dev/null 2>&1 \
      && say "tree-killed wait child $CHILD_PID on exit" \
      || say "could not kill wait child $CHILD_PID (it may already be gone)"
  fi
  rm -f "$WAIT_OUT" 2>/dev/null || true
  # Only remove a lock this process still owns: a dying instance must not delete the lock
  # a successor already took over (measured 2026-09-28 - the new watcher ran lockless
  # because the old one's trap fired after the takeover).
  if [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$BASHPID" ]; then
    rm -rf "$LOCK" 2>/dev/null || true
  else
    say "not removing $LOCK: it belongs to another instance now"
  fi
}
trap cleanup EXIT

mkdir -p "$(dirname "$INBOX")" || { echo "watch-settlements: cannot create $(dirname "$INBOX")" >&2; exit 2; }
say "watching run $RUN, mode=$MODE, inbox=$INBOX, lock=$LOCK (pid $BASHPID)"

FAILS=0
OUTAGE=0
POLL=""
POLL_ROUNDS=0
while :; do
  rm -f "$WAIT_OUT" "${WAIT_OUT}.err"
  # stderr goes to its OWN file: merging it into the JSON stream (2>&1) is what made every
  # wait unparseable - measured 2026-09-28 by dumping the raw output, which is one
  # pretty-printed JSON document spanning 53 lines plus whatever stderr had to say.
  # With POLL set, the run's waiter slot is held by something we must not kill - measured: a
  # candidate whose parent is orca.exe, i.e. the Orca app's own waiter. Poll the queue WITHOUT
  # --wait instead of exiting, because exiting leaves the coordinator with no wakes at all.
  if [ -n "$POLL" ]; then
    POLL_ROUNDS=$((POLL_ROUNDS + 1))
    if [ "$POLL_ROUNDS" -ge "${POLL_RETRY_EVERY:-10}" ]; then
      # Measured 2026-10-01: POLL was never reset, so a single waiter_exists conflict parked the
      # watcher in 30s polling for the rest of its life. Every N poll rounds it tries --wait again;
      # if the slot is still held, the refusal path sets POLL=1 again, so this is self-correcting.
      say "poll round $POLL_ROUNDS reached; trying --wait again to leave polling mode"
      POLL=""; POLL_ROUNDS=0
      orca orchestration check --run "$RUN" --wait --types "worker_done,escalation,question" --timeout-ms "$TIMEOUT_MS" --json > "$WAIT_OUT" 2>"${WAIT_OUT}.err" &
    else
      orca orchestration check --run "$RUN" --json > "$WAIT_OUT" 2>"${WAIT_OUT}.err" &
    fi
  else
    orca orchestration check --run "$RUN" --wait --types "worker_done,escalation,question" --timeout-ms "$TIMEOUT_MS" --json > "$WAIT_OUT" 2>"${WAIT_OUT}.err" &
  fi
  CHILD_PID=$!
  printf 'child_pid=%s\nchild_started=%s\nchild_cmd=%s\n' "$CHILD_PID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "orca orchestration check --run $RUN --wait --types worker_done,escalation,question --timeout-ms $TIMEOUT_MS" > "$LOCK/child"
  wait "$CHILD_PID"
  RC=$?
  CHILD_PID=""
  OUT="$(cat "$WAIT_OUT" 2>/dev/null)"
  if [ $RC -ne 0 ] || ! printf '%s' "$OUT" | grep -q '"result"'; then
    # A keepalive is NOT a failure: `check --wait` emits {"_keepalive":true,...} while it is
    # still waiting, and treating that as an error made the watcher count five "failures"
    # and exit on a healthy long wait (measured 2026-09-28 - every instance died this way).
    if printf '%s' "$OUT" | grep -q '_keepalive'; then
      continue
    fi
    # Orca allows ONE attached waiter per Run: "Run <id> already has an active actionable
    # waiter" (error code waiter_exists). A waiter whose OWNER died stays attached and holds
    # the slot indefinitely - measured 2026-09-28: an `orca ... check --wait` process (pid
    # 31872) outlived every watcher script and blocked all later watchers, which is why the
    # coordinator stopped being woken. So: clear waiters whose parent is gone, once, then retry.
    if printf '%s' "$OUT" | grep -q 'waiter_exists'; then
      if [ -z "${CLEARED_ORPHAN:-}" ]; then
        # Identity proof, never a guess: a candidate must (a) be an orca process whose
        # command line carries THIS run's id and a --types argument, (b) not be our own
        # child, and (c) not have the Orca app in its parent chain - the runtime's own
        # delivery machinery must never be killed. Anything unproven is left alone and
        # reported.
        CAND="$(powershell.exe -NoProfile -Command "
          \$all = Get-CimInstance Win32_Process
          \$me = \$PID
          \$all | Where-Object {
            \$_.ProcessId -ne \$me -and \$_.Name -like '*orca*' -and
            \$_.CommandLine -like '*orchestration check*--wait*' -and
            \$_.CommandLine -like '*--run $RUN*' -and
            \$_.CommandLine -like '*--types*'
          } | ForEach-Object {
            \$ppid = \$_.ParentProcessId
            \$p = \$all | Where-Object { \$_.ProcessId -eq \$ppid } | Select-Object -First 1
            \$pname = if (\$p) { \$p.Name } else { 'NONE' }
            \$gppid = if (\$p) { \$p.ParentProcessId } else { 0 }
            \$g = \$all | Where-Object { \$_.ProcessId -eq \$gppid } | Select-Object -First 1
            \$gname = if (\$g) { \$g.Name } else { 'NONE' }
            '{0}|{1}|{2}|{3}|{4}' -f \$_.ProcessId, \$_.CreationDate.ToString('s'), \$pname, \$gname, ((\$_.CommandLine -replace '\s+',' ').Substring(0,[Math]::Min(140,(\$_.CommandLine -replace '\s+',' ').Length)))
          }" 2>/dev/null | tr -d '\r')"
        KILLED=""
        if [ -n "$CAND" ]; then
          say "waiter candidates proven by command line (run + --types):"
          while IFS='|' read -r cpid cstart cparent cgp ccmd; do
            [ -n "$cpid" ] || continue
            say "  candidate pid=$cpid started=$cstart parent=$cparent grandparent=$cgp"
            say "    cmd=$ccmd"
            if [ "$cpid" = "${CHILD_PID:-}" ]; then say "    -> that is my own child; skipping"; continue; fi
            case "$cparent$cgp" in
              *Orca*|*orca.exe*) say "    -> NOT killing: the Orca app is in its parent chain (runtime's own)"; continue;;
            esac
            say "    -> proven mine (parent $cparent is not the Orca app); killing the tree"
            taskkill -F -T -PID "$cpid" >/dev/null 2>&1 && KILLED="$KILLED $cpid" || say "    -> kill failed"
          done <<< "$CAND"
        else
          say "no waiter candidate carries this run id and --types; nothing proven"
        fi
        if [ -n "$KILLED" ]; then
          CLEARED_ORPHAN=1
          say "took over the waiter slot from:$KILLED"
          sleep 2
          continue
        fi
      fi
      echo "watch-settlements: REFUSED - the run already has an attached waiter." >&2
      echo "  No candidate could be proven to be a leftover of mine, so nothing was killed." >&2
      # Do NOT exit. The slot can be held by the Orca app's own waiter, which must never be killed;
      # exiting here is what leaves the coordinator with no wakes at all. Poll instead.
      say "falling back to polling every ${POLL_INTERVAL:-30}s (no --wait) until the slot frees"
      POLL=1
      sleep "${POLL_INTERVAL:-30}"
      continue
    fi
    FAILS=$((FAILS + 1))
    say "wait call failed (rc=$RC, consecutive=$FAILS): $(printf '%s' "$OUT" | head -c 160)"
    # A dead app is not a dead watcher. Measured 2026-09-29: an Orca restart killed this process -
    # it exited after five failures (25 s) and the coordinator sat idle until a human noticed and
    # restarted it, which is exactly the manual step this script exists to remove. The delivery queue
    # and the inbox both survive the outage (measured: 10 settlements across the restart, none lost),
    # so the right move is to wait for the app to come back and then drain the backlog.
    case "$OUT" in
      *runtime_unavailable*|*"Could not connect"*|*"connect to the running Orca app"*)
        OUTAGE=$((OUTAGE + 1))
        BACKOFF=$((FAILS * 5)); [ "$BACKOFF" -gt 60 ] && BACKOFF=60
        say "the Orca runtime is unreachable (outage retry $OUTAGE); backing off ${BACKOFF}s and staying alive"
        if [ "$MODE" = once ]; then
          echo "watch-settlements: runtime unreachable (--once, not waiting)" >&2
          exit 4
        fi
        sleep "$BACKOFF"
        continue
        ;;
    esac
    if [ "$MODE" = once ] || [ "$FAILS" -ge 5 ]; then
      echo "watch-settlements: giving up after $FAILS failed wait(s)" >&2
      exit 4
    fi
    sleep $((FAILS * 5))
    continue
  fi
  if [ "${OUTAGE:-0}" -gt 0 ]; then
    say "the Orca runtime is back after $OUTAGE outage retry/retries; draining the backlog"
    OUTAGE=0
  fi
  FAILS=0

  # One settlement: write it to the inbox, then ack it, then wake.
  DECISION="$(printf '%s' "$OUT" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  // The output is ONE pretty-printed JSON document (measured: 53 lines, ~2 KB), not JSONL,
  // so parse it whole. Take the last line that parses and carries a result as a fallback,
  // in case the runtime ever streams several documents.
  let r=null;
  try{ const j=JSON.parse(s); if(j && j.result) r=j.result; }catch(e){}
  if(!r){
    const lines=String(s).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    for(let i=lines.length-1;i>=0;i--){
      try{ const j=JSON.parse(lines[i]); if(j && j.result){ r=j.result; break; } }catch(e){}
    }
  }
  if(!r){ process.stdout.write("PARSE_ERROR"); return; }
  try{
    const msgs=(r.messages||[]).filter(m=>m.type!=="heartbeat");
    if(!msgs.length){ process.stdout.write("NONE"); return; }
    const stamp=new Date().toISOString().replace(/\.\d+Z$/,"Z");
    const body=msgs.map(m=>`--- ${m.type} | ${m.subject} | from ${m.from_handle} | ${m.id}\n${m.body||""}`).join("\n");
    process.stdout.write("WAKE\n"+r.deliveryId+"\n"+stamp+"\n"+body+"\n");
  }catch(e){ process.stdout.write("PARSE_ERROR"); }
});')"

  case "$DECISION" in
    NONE) say "heartbeats only - still waiting"; continue;;
    PARSE_ERROR) say "could not parse the delivery payload"; continue;;
  esac

  DELIVERY="$(printf '%s' "$DECISION" | sed -n '2p')"
  STAMP="$(printf '%s' "$DECISION" | sed -n '3p')"
  BODY="$(printf '%s' "$DECISION" | tail -n +4)"

  # 1. inbox first - an ack must never be the only copy
  {
    printf '=== SETTLEMENT %s | delivery %s\n' "$STAMP" "$DELIVERY"
    printf '%s\n' "$BODY"
  } >> "$INBOX" || { echo "watch-settlements: cannot append to $INBOX" >&2; exit 2; }
  if ! grep -q "$DELIVERY" "$INBOX"; then
    echo "watch-settlements: inbox write did not read back; NOT acking $DELIVERY" >&2
    exit 2
  fi
  say "settlement $DELIVERY written to $INBOX"

  # 2. only now ack
  if ! orca orchestration check --run "$RUN" --ack "$DELIVERY" --json >/dev/null 2>&1; then
    say "ack of $DELIVERY did not confirm (the inbox copy is already durable)"
  fi

  # 3. the wake
  echo "WAKE settlement $STAMP — inbox $INBOX (delivery $DELIVERY)"
  if [ "$MODE" = once ]; then
    say "exiting so the coordinator's notify_on_complete fires (this exit IS the wake)"
    exit 0
  fi
done
