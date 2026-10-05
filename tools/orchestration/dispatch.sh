#!/usr/bin/env bash
# The dispatcher: runs queued worker specs one at a time through worker.sh. No model decides
# anything here; Hermes only WRITES specs into the queue.
#
#   dispatch.sh            loop forever (one instance; a second one exits 0)
#   dispatch.sh --once     one pass, then exit
#   dispatch.sh --status   print the queue, the running worker and the last results
#   dispatch.sh --bind     bind THIS terminal to the dispatcher's Run first, then loop (launcher's form)
#
# Acts only while $S/dispatch.enabled exists. Without it every pass is a dry run that logs what it
# WOULD start - the shadow mode for the cut-over, and the kill switch afterwards.
# Must run in the Orca terminal bound to the Run: worker-start is fenced to it.
#
# QUEUE: one file per worker in $S/queue/, started in name order (prefix a number to order them).
# A header, a `---` line, then the spec body verbatim:
#
#   name: tester-163d                 worktree/branch name (Orca suffixes a taken one)
#   base: origin/ernem22/coder-117    the ref the worktree starts from (a PR's head for tester/fixer)
#   role: tester                      coder|fixer -> write; reviewer -> readonly; tester -> tester (readonly + node/playwright)
#   title: Tester PR #163 @ e0f1d44   the Orca task title
#   deadline: 3600                    seconds before a non-settling worker is stopped (default 3600)
#   serve: 8614                       optional: build + serve this port before the agent starts
#   pr: 163                           reviewer/tester/fixer: the PR (the dispatcher posts its verdict)
#   head: e0f1d44                     reviewer/tester/fixer: the PR head the spec was written for
#   issue: 117                        coder: the issue (needs.sh matches specs on these headers)
#   ---
#   <spec body>
#
# LEVEL-TRIGGERED: the only state is files. $S/running.env names the one live dispatch; on start a
# pass first finishes THAT (wait out its deadline, close it), so a restart of this script, of Orca
# or of the machine resumes instead of starting a second worker beside the first.
#
# VERDICTS: a reviewer/tester never posts to the PR (its config cannot). When it settles succeeded,
# the dispatcher reads the worker's own report from Orca and posts it with verdict-post.sh
# --from-settlement, which copies the lines verbatim and refuses an incomplete block (hunter H-005:
# a verdict a worker could post under the owner's login is a verdict anyone could forge).
#
# MERGES: between workers, at most every CLOSE_EVERY seconds (default 300), close.sh merges what the
# pipeline/verdict gate passed, pinned to the head it read (--dry-run while not acting).
#
# RESULTS: $S/done/<file>.<outcome>, the spec plus a footer with dispatch, task, outcome, attempts.
# A worker that did not settle by itself (exited, timeout, agent_wait, failed) is retried with
# Orca's own --retry-of on the same Task, at most MAX_ATTEMPTS times in all.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
cd "$HERE/../.." || exit 2
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
Q="$S/queue"; DONE="$S/done"; RUNNING="$S/running.env"; LOG="$S/dispatch.log"
INTERVAL="${DISPATCH_INTERVAL:-30}"; MAX_ATTEMPTS="${DISPATCH_MAX_ATTEMPTS:-3}"
mkdir -p "$Q" "$DONE" 2>/dev/null || true

say() { printf '%s dispatch: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG" >&2; }
acting() { [ -f "$S/dispatch.enabled" ]; }
hdr() { sed -n "1,/^---\$/s/^$1:[[:space:]]*//p" "$2" | head -1; }
body() { sed '1,/^---$/d' "$1"; }
kv() { sed -n "s/^$1=//p" "$2" | head -1; }

# ---- single instance ----------------------------------------------------------------------
lock() {
  local L="$S/dispatch.lock"
  if [ -f "$L" ]; then
    local PID; PID="$(cat "$L" 2>/dev/null)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then say "already running as pid $PID"; exit 0; fi
  fi
  echo $$ > "$L"
  trap 'rm -f "$S/dispatch.lock"' EXIT
}

# ---- finish the running dispatch (resume after any restart) ---------------------------------
finish_running() {
  [ -f "$RUNNING" ] || return 0
  local DISP FILE DEADLINE_AT NOW LEFT OUTC TASK ATTEMPT
  DISP="$(kv DISPATCH "$RUNNING")"; FILE="$(kv FILE "$RUNNING")"; TASK="$(kv TASK "$RUNNING")"
  DEADLINE_AT="$(kv DEADLINE_AT "$RUNNING")"; ATTEMPT="$(kv ATTEMPT "$RUNNING")"
  NOW="$(date +%s)"; LEFT=$(( ${DEADLINE_AT:-$NOW} - NOW )); [ "$LEFT" -lt 1 ] && LEFT=1
  say "running: $DISP ($(basename "$FILE")), up to ${LEFT}s left"
  OUTC="$(bash "$HERE/worker.sh" wait "$DISP" --deadline "$LEFT" | sed -n 's/^OUTCOME=//p')"
  [ -n "$OUTC" ] || { say "wait gave no outcome for $DISP; will look again next pass"; return 1; }

  local CLOSE_ARGS=("$DISP")
  case "$OUTC" in succeeded|failed|cancelled) ;; *) CLOSE_ARGS+=(--stop) ;; esac
  local CRC=0
  bash "$HERE/worker.sh" close "${CLOSE_ARGS[@]}" >/dev/null || CRC=$?
  # 5 = released but the tree is not ours to remove: the dispatch IS finished, record it.
  # Anything else non-zero is unconfirmed: keep running.env and try the close again next pass.
  if [ "$CRC" -ne 0 ] && [ "$CRC" -ne 5 ]; then
    # Bounded: a close that keeps failing must not stall the whole pipeline. Measured 2026-10-04 on
    # coder-111: the worker had settled, the close returned rc 6 every pass, and the queue stood
    # still with its deadline draining. After CLOSE_MAX tries the result is recorded anyway and the
    # unclosed dispatch is listed in leftovers.txt for a later sweep.
    local TRIES; TRIES=$(( $(kv CLOSE_TRIES "$RUNNING" || echo 0) + 1 ))
    sed -i '/^CLOSE_TRIES=/d' "$RUNNING"; echo "CLOSE_TRIES=$TRIES" >> "$RUNNING"
    if [ "$TRIES" -lt "${CLOSE_MAX:-10}" ]; then
      say "close of $DISP unconfirmed (rc $CRC, try $TRIES/${CLOSE_MAX:-10}); retrying next pass"; return 1
    fi
    say "close of $DISP still unconfirmed after $TRIES tries (rc $CRC); recording the result and moving on"
    printf '%s dispatch=%s worktree=%s rc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$DISP" \
      "$(kv WORKTREE "$RUNNING")" "$CRC" >> "$S/leftovers.txt"
  fi

  local BASE; BASE="$(basename "$FILE")"; BASE="${BASE#active-}"
  case "$OUTC" in
    succeeded)
      post_verdict "$FILE" "$TASK" || OUTC="verdict-refused"
      record "$FILE" "$OUTC" ;;
    *)
      if [ "${ATTEMPT:-1}" -lt "$MAX_ATTEMPTS" ]; then
        say "$DISP ended '$OUTC' (attempt ${ATTEMPT:-1}/$MAX_ATTEMPTS): retrying the same Task"
        { printf 'retry_task: %s\nretry_of: %s\nattempt: %s\n' "$TASK" "$DISP" "$(( ${ATTEMPT:-1} + 1 ))"
          sed '/^retry_task:/d; /^retry_of:/d; /^attempt:/d' "$FILE"; } > "$Q/$BASE"
        rm -f "$FILE"
      else
        say "$DISP ended '$OUTC' after $MAX_ATTEMPTS attempts: giving up on $BASE"
        record "$FILE" "$OUTC"
      fi ;;
  esac
  rm -f "$RUNNING"
}

post_verdict() {
  local FILE="$1" TASK="$2" ROLE PR REP RC=0
  ROLE="$(hdr role "$FILE")"; PR="$(hdr pr "$FILE")"
  case "$ROLE" in reviewer|tester) ;; *) return 0;; esac
  [ -n "$PR" ] || { say "no pr: header on a $ROLE spec; nothing posted"; return 1; }
  REP="$S/report-$TASK.txt"
  orca orchestration task-list --json </dev/null 2>/dev/null \
    | node "$HERE_NATIVE/lib/task-result.cjs" "$TASK" > "$REP" || { say "no report for $TASK; nothing posted"; return 1; }
  # the report must be about the head this spec was written for: verdict-post checks it against the
  # PR's head NOW, which a push between spec and settlement can make a different build
  local SPEC_HEAD REP_COMMIT
  SPEC_HEAD="$(hdr head "$FILE" | tr -d "\r ")"
  REP_COMMIT="$(sed -n 's/^[[:space:]]*commit:[[:space:]]*\([0-9a-fA-F]\{7,40\}\).*/\1/p' "$REP" | head -1)"
  if [ -n "$SPEC_HEAD" ] && [ -n "$REP_COMMIT" ]; then
    case "$SPEC_HEAD" in "$REP_COMMIT"*) ;; *) case "$REP_COMMIT" in "$SPEC_HEAD"*) ;; *)
      say "report commit $REP_COMMIT is not the spec head $SPEC_HEAD; nothing posted"; return 1;; esac;; esac
  fi
  bash "$HERE/verdict-post.sh" --pr "$PR" --role "$ROLE" --from-settlement "$REP" \
    --source "dispatch $TASK" 2>&1 | sed 's/^/dispatch: verdict: /' | tee -a "$LOG" >&2
  RC="${PIPESTATUS[0]}"
  [ "$RC" -eq 0 ] && say "posted $ROLE verdict for #$PR from $TASK" || say "verdict-post refused $TASK (rc $RC); report kept at $REP"
  return "$RC"
}

record() {
  local FILE="$1" OUTC="$2" DST
  DST="$(basename "$FILE")"; DST="${DST#active-}"
  # a re-queued spec has the same name: keep every result (needs.sh counts verdict-refused ones)
  if [ -e "$DONE/$DST.$OUTC" ]; then DST="$DONE/$DST.$(date +%s).$OUTC"; else DST="$DONE/$DST.$OUTC"; fi
  { cat "$FILE"; printf '\n--- result\n'; cat "$RUNNING"; printf 'OUTCOME=%s\nFINISHED=%s\n' "$OUTC" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"; } > "$DST"
  rm -f "$FILE"
  say "recorded $(basename "$DST")"
}

# ---- start the next queued spec ---------------------------------------------------------------
start_next() {
  local FILE; FILE="$(ls -1 "$Q" 2>/dev/null | grep -v '^\.' | sort | head -1)"
  [ -n "$FILE" ] || return 0
  FILE="$Q/$FILE"
  local NAME BASE ROLE TITLE DEADLINE SERVE RTASK ROF ATTEMPT
  NAME="$(hdr name "$FILE")"; BASE="$(hdr base "$FILE")"; ROLE="$(hdr role "$FILE")"
  TITLE="$(hdr title "$FILE")"; DEADLINE="$(hdr deadline "$FILE")"; SERVE="$(hdr serve "$FILE")"
  RTASK="$(hdr retry_task "$FILE")"; ROF="$(hdr retry_of "$FILE")"; ATTEMPT="$(hdr attempt "$FILE")"
  DEADLINE="${DEADLINE:-3600}"; ATTEMPT="${ATTEMPT:-1}"

  local BAD="" RO=()
  [ -n "$NAME" ] && [ -n "$BASE" ] && [ -n "$TITLE" ] || BAD="name/base/title missing"
  case "$ROLE" in coder|fixer) RO=();; reviewer) RO=(--readonly);; tester) RO=(--config tester);; *) BAD="${BAD:+$BAD; }role '$ROLE' unknown";; esac
  grep -qx -- '---' "$FILE" || BAD="${BAD:+$BAD; }no --- line"
  if [ -n "$BAD" ]; then
    say "rejecting $(basename "$FILE"): $BAD"; mv "$FILE" "$DONE/$(basename "$FILE").rejected"; return 0
  fi

  if ! acting; then
    say "DRY RUN (no dispatch.enabled): would start $ROLE '$NAME' from $BASE${SERVE:+ serving $SERVE} - $(basename "$FILE")"
    return 0
  fi

  local ACTIVE="$S/active-$(basename "$FILE")" SPEC="$S/spec-$$.txt" OUT RC
  mv "$FILE" "$ACTIVE"
  body "$ACTIVE" > "$SPEC"
  local ARGS=(start "$NAME" "$BASE")
  if [ -n "$RTASK" ] && [ -n "$ROF" ]; then ARGS+=(--task "$RTASK" --retry-of "$ROF")
  else ARGS+=("$SPEC" "$TITLE"); fi
  ARGS+=("${RO[@]+"${RO[@]}"}")
  [ -n "$SERVE" ] && ARGS+=(--serve "$SERVE")

  say "starting $ROLE '$NAME' (attempt $ATTEMPT) from $(basename "$FILE")"
  OUT="$(bash "$HERE/worker.sh" "${ARGS[@]}")"; RC=$?
  rm -f "$SPEC"
  local DISP TASK
  DISP="$(printf '%s\n' "$OUT" | sed -n 's/^DISPATCH=//p')"; TASK="$(printf '%s\n' "$OUT" | sed -n 's/^TASK=//p')"
  if [ "$RC" -ne 0 ] || [ -z "$DISP" ]; then
    if [ "$RC" -eq 3 ]; then
      # refused before anything was created (capacity, base, port): back to the queue unchanged
      say "start refused (rc 3); $(basename "$FILE") stays queued"; mv "$ACTIVE" "$FILE"
    else
      say "start failed (rc $RC) for $(basename "$FILE")"
      { cat "$ACTIVE"; printf '\n--- result\nSTART_RC=%s\n%s\n' "$RC" "$OUT"; } > "$DONE/$(basename "$FILE").start-failed"
      rm -f "$ACTIVE"
    fi
    return 0
  fi
  printf 'DISPATCH=%s\nTASK=%s\nFILE=%s\nNAME=%s\nROLE=%s\nATTEMPT=%s\nSTARTED=%s\nDEADLINE_AT=%s\n' \
    "$DISP" "$TASK" "$ACTIVE" "$NAME" "$ROLE" "$ATTEMPT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$(( $(date +%s) + DEADLINE ))" > "$RUNNING"
  printf '%s\n' "$OUT" | sed -n 's/^\(WORKTREE\|PATH\|SERVING\|ASSET\)=/&/p' >> "$RUNNING"
  say "dispatched $DISP for $(basename "$FILE")"
}

close_pass() {
  local STAMP="$S/close.last" NOW; NOW="$(date +%s)"
  [ -f "$RUNNING" ] && return 0
  [ $(( NOW - $(cat "$STAMP" 2>/dev/null || echo 0) )) -ge "${CLOSE_EVERY:-300}" ] || return 0
  echo "$NOW" > "$STAMP"
  local ARG=(); acting || ARG=(--dry-run)
  bash "$HERE/close.sh" "${ARG[@]+"${ARG[@]}"}" 2>&1 | grep -E 'MERGED|refused|BLOCKED|issue #|merged [0-9]' \
    | sed 's/^/close: /' | while IFS= read -r l; do say "$l"; done
}

# The queue is topped up from GitHub by specgen.sh (needs.sh -> one spec per need) at most every
# SPECGEN_EVERY seconds, so the pipeline advances without anyone writing a spec or asking "sonuc?".
# It runs even when the queue is not empty: measured 2026-10-04, with four Coders queued (up to 90 min
# each) the Reviewer/Testers owed on open PRs would have waited hours behind them, because they were
# only generated once the queue drained. Name order (1xx fixer < 2xx tester < 3xx reviewer < 5xx
# coder) then runs them first; needs.sh never re-queues a spec that is already queued.
fill_queue() {
  [ -f "$RUNNING" ] && return 0
  local STAMP="$S/specgen.last" NOW; NOW="$(date +%s)"
  [ $(( NOW - $(cat "$STAMP" 2>/dev/null || echo 0) )) -ge "${SPECGEN_EVERY:-300}" ] || return 0
  echo "$NOW" > "$STAMP"
  bash "$HERE/specgen.sh" 2>&1 | while IFS= read -r l; do say "$l"; done
}

# close_pass runs BEFORE start_next: it only acts while no worker runs, and start_next starts one
# whenever the queue is not empty - measured 2026-10-04, with the queue never empty #163, #135 and
# #206 sat with a green gate for hours and nothing merged them.
pass() {
  finish_running || return 0
  close_pass
  fill_queue
  start_next
}

# The dispatcher owns its Run: `run-use` from this terminal takes the Run from whichever terminal held
# it (measured 2026-10-04: the old holder then reads run-current=null and gets run_required), so after
# this Hermes can no longer start workers - the point of the design. The Run id is kept in
# $S/dispatch.run; the first bind creates a fresh Run (the old one holds 240 dispatches of history).
bind_run() {
  local WANT CUR
  WANT="$(cat "$S/dispatch.run" 2>/dev/null)"
  CUR="$(orca orchestration run-current --json </dev/null 2>/dev/null | node "$HERE_NATIVE/lib/jget.cjs" result.run.id)"
  if [ -z "$WANT" ]; then
    WANT="$(orca orchestration run-create --objective "dsv dispatcher" --json </dev/null 2>/dev/null \
      | node "$HERE_NATIVE/lib/jget.cjs" result.run.id)"
    [ -n "$WANT" ] || { say "bind: run-create failed"; exit 4; }
    echo "$WANT" > "$S/dispatch.run"; say "bind: created Run $WANT"
  elif [ "$CUR" != "$WANT" ]; then
    orca orchestration run-use --id "$WANT" --json </dev/null >/dev/null 2>&1 || { say "bind: run-use $WANT failed"; exit 4; }
    say "bind: this terminal now holds Run $WANT"
  fi
  [ "$(orca orchestration run-current --json </dev/null 2>/dev/null | node "$HERE_NATIVE/lib/jget.cjs" result.run.id)" = "$WANT" ] \
    || { say "bind: run-current is not $WANT after binding"; exit 4; }
}

status() {
  echo "enabled: $(acting && echo yes || echo 'no (dry run)')"
  echo "running:"; [ -f "$RUNNING" ] && sed 's/^/  /' "$RUNNING" || echo "  (none)"
  echo "queue:"; ls -1 "$Q" 2>/dev/null | sed 's/^/  /'
  echo "last results:"; ls -1t "$DONE" 2>/dev/null | head -10 | sed 's/^/  /'
}

case "${1:-}" in
  --status) status ;;
  --once) lock; pass ;;
  --bind) lock; bind_run; say "dispatcher up (pid $$, Run $(cat "$S/dispatch.run"), $(acting && echo acting || echo 'dry run'))"
      while :; do pass; sleep "$INTERVAL"; done ;;
  "") lock; say "dispatcher up (pid $$, $(acting && echo acting || echo 'dry run'))"
      while :; do pass; sleep "$INTERVAL"; done ;;
  *) sed -n '2,8p' "$0" >&2; exit 2 ;;
esac
