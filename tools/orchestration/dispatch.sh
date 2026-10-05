#!/usr/bin/env bash
# The dispatcher: runs queued worker specs through worker.sh, as many at once as resources allow. No model decides
# anything here; Hermes only WRITES specs into the queue.
#
#   dispatch.sh            loop forever (one instance; a second one exits 0)
#   dispatch.sh --once     one pass, then exit
#   dispatch.sh --stop     ask the running dispatcher to exit between passes; waits until it has
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
# LEVEL-TRIGGERED: the only state is files. $S/running/<spec>.env names each live dispatch; every
# pass polls each one (worker.sh wait --poll) and closes it once settled, so a restart of this
# script, of Orca or of the machine resumes every worker instead of starting duplicates.
#
# VERDICTS: a reviewer/tester never posts to the PR (its config cannot). When it settles succeeded,
# the dispatcher reads the worker's own report from Orca and posts it with verdict-post.sh
# --from-settlement, which copies the lines verbatim and refuses an incomplete block (hunter H-005:
# a verdict a worker could post under the owner's login is a verdict anyone could forge).
#
# MERGES: at most every CLOSE_EVERY seconds (default 120, and at once after a worker finishes), close.sh merges what the
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
Q="$S/queue"; DONE="$S/done"; RUN_DIR="$S/running"; RUNNING=""; LOG="$S/dispatch.log"
INTERVAL="${DISPATCH_INTERVAL:-30}"; MAX_ATTEMPTS="${DISPATCH_MAX_ATTEMPTS:-2}"
mkdir -p "$Q" "$DONE" "$RUN_DIR" 2>/dev/null || true

# WORKERS RUN WHILE THERE IS WORK (2026-10-05: one worker at a time gave 3 product PRs in ~15 h).
# Every queued spec starts as soon as nothing real stops it; each live worker has its own
# $RUN_DIR/<spec>.env. The only limits are real resources:
#   * memory, counted for what workers WILL hold (need_mb below): no fixed worker count;
#   * a model's request quota: at most MODEL_CAP_<model> live workers per model (default 0 = none);
#   * a Tester's port: never two Testers on one port;
#   * one writer per PR: never two Coders on one issue or two Fixers on one PR.
# DISPATCH_MAX (default 0 = none) stays only as an optional manual ceiling.
MAX_WORKERS="${DISPATCH_MAX:-0}"
REPO_SLUG="${DSV_REPO:-ernem22/design-system-viewer}"
role_cfg() { case "$1" in coder|fixer) echo write;; reviewer) echo readonly;; tester) echo tester;; esac; }
model_of() {   # spec file -> the model it will run on (its model: header, else its role's config)
  local M; M="$(hdr model "$1")"
  [ -n "$M" ] || M="$(node "$HERE_NATIVE/lib/jget.cjs" model < "$HERE/roles/$(role_cfg "$(hdr role "$1")").opencode.json" 2>/dev/null)"
  echo "$M"
}
# 0 = no cap. A per-model cap is set only from a measured quota (MODEL_CAP_<model>=n); the old default
# of 2 was a guess, and with Coder, Fixer and Tester on one model it made a Tester wait for Coders.
model_cap() { local V; V="MODEL_CAP_$(printf '%s' "$1" | tr -c 'A-Za-z0-9' '_')"; echo "${!V:-${MODEL_CAP:-0}}"; }
live() { ls -1 "$RUN_DIR"/*.env 2>/dev/null; }   # one file per live worker
live_count() { live | grep -c . ; }
live_with() { local K="$1" V="$2" F N=0; for F in $(live); do [ "$(kv "$K" "$F")" = "$V" ] && N=$((N+1)); done; echo "$N"; }

say() { printf '%s dispatch: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG" >&2; }
# EVENTS for the manager (Hermes): one line each in events.log, `<time> <kind> key=value ...`.
# The dispatcher does not wait for anyone to read them; hermes-watch.sh wakes Hermes on the ones
# that need attention. Kinds: up started finished delivered kept no-pr no-push unknown start-failed
# start-refused verdict-refused merge-refused conflict leftover gave-up down.
event() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$S/events.log"; }
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
  # The lock is removed only while it still names THIS process. It used to be removed blindly:
  # measured 2026-10-05, a dispatcher killed during a child (`sleep`, an orca call) runs its trap
  # only after that child ends, by which time a new dispatcher had written its own pid; the old
  # trap deleted the NEW lock, the launcher saw "no dispatcher" and started another one.
  trap on_exit EXIT
  trap 'say "got SIGTERM"; exit 143' TERM
  trap 'say "got SIGHUP (terminal closed)"; exit 129' HUP
  trap 'say "got SIGINT"; exit 130' INT
}
# Every exit says why: the exit code, the line and the command bash was running. 2026-10-05: three
# dispatchers ended within minutes and nothing recorded a cause.
on_exit() {
  local RC=$? CMD="${BASH_COMMAND:-?}"
  [ "$(cat "$S/dispatch.lock" 2>/dev/null)" = "$$" ] && rm -f "$S/dispatch.lock"
  say "exiting (pid $$, rc $RC, last command: ${CMD:0:200})"
  # rc 0 is a stop that was asked for (--stop); anything else is an exit nobody asked for
  if [ "$RC" -eq 0 ]; then event "stopped pid=$$"; else event "down pid=$$ rc=$RC"; fi
}

# ---- finish the running dispatch (resume after any restart) ---------------------------------
finish_running() {
  [ -f "$RUNNING" ] || return 0
  local DISP FILE DEADLINE_AT NOW LEFT OUTC="" TASK ATTEMPT
  DISP="$(kv DISPATCH "$RUNNING")"; FILE="$(kv FILE "$RUNNING")"; TASK="$(kv TASK "$RUNNING")"
  DEADLINE_AT="$(kv DEADLINE_AT "$RUNNING")"; ATTEMPT="$(kv ATTEMPT "$RUNNING")"
  NOW="$(date +%s)"; LEFT=$(( ${DEADLINE_AT:-$NOW} - NOW )); [ "$LEFT" -lt 1 ] && LEFT=1
  # said once per dispatch, not on every poll
  if [ -z "$(kv SAID "$RUNNING")" ]; then say "running: $DISP ($(basename "$FILE")), up to ${LEFT}s left"; echo "SAID=1" >> "$RUNNING"; fi
  # Every live worker is read from ONE `worker-list` per pass (read_workers), so the pass no longer
  # waits up to 45 s per worker in turn (4 workers = 3 min before anything new could start). Only a
  # worker missing from that list falls back to worker.sh wait, briefly.
  local ROW OUT LIVE EX
  ROW="$(grep -m1 "^$DISP " "$S/workers.now" 2>/dev/null)"
  if [ -n "$ROW" ]; then
    OUT="$(printf '%s' "$ROW" | cut -d' ' -f2)"; LIVE="$(printf '%s' "$ROW" | cut -d' ' -f3)"
    if [ -n "$OUT" ] && [ "$OUT" != "in_progress" ] && [ "$OUT" != "-" ]; then OUTC="$OUT"
    elif [ "$LIVE" = "exited" ]; then
      # two reads in a row, so one stale read cannot end a worker
      EX=$(( $(kv EXITED "$RUNNING" || echo 0) + 1 )); sed -i '/^EXITED=/d' "$RUNNING"; echo "EXITED=$EX" >> "$RUNNING"
      [ "$EX" -ge 2 ] && OUTC="exited"
    else sed -i '/^EXITED=/d' "$RUNNING"
    fi
    [ -z "${OUTC:-}" ] && [ "$NOW" -ge "${DEADLINE_AT:-$NOW}" ] && OUTC="timeout"
    [ -n "${OUTC:-}" ] || return 1
  else
    OUTC="$(bash "$HERE/worker.sh" wait "$DISP" --deadline "$LEFT" --poll "${DISPATCH_POLL:-10}" | sed -n 's/^OUTCOME=//p')"
    [ "$OUTC" = "pending" ] && return 1
    [ -n "$OUTC" ] || { say "wait gave no outcome for $DISP; will look again next pass"; return 1; }
  fi

  local CLOSE_ARGS=("$DISP")
  case "$OUTC" in succeeded|failed|cancelled) ;; *) CLOSE_ARGS+=(--stop) ;; esac
  local CRC=0
  local COUT
  # A tree already closed and KEPT (by a dispatcher that ended before it delivered) is not closed
  # again: measured 2026-10-05, coder-18 - the old dispatcher kept and pushed it, was stopped before
  # `gh pr create`, and the new one's second close found nothing unpushed and removed the tree.
  if [ -n "$(kv KEPT "$RUNNING")" ]; then CRC=0; COUT=""
  else COUT="$(bash "$HERE/worker.sh" close "${CLOSE_ARGS[@]}")" || CRC=$?
  fi
  # 7 = closed, but the tree holds work that is not on the remote: kept for the manager, not removed
  if [ "$CRC" -eq 7 ]; then
    local KEPT; KEPT="$(printf '%s\n' "$COUT" | sed -n 's/^KEPT=//p')"
    echo "KEPT=$KEPT" >> "$RUNNING"; event "kept dispatch=$DISP spec=$(basename "$FILE" | sed "s/^active-//") path=$KEPT"; CRC=0
  fi
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
    event "leftover dispatch=$DISP worktree=$(kv WORKTREE "$RUNNING") rc=$CRC"
  fi

  local BASE; BASE="$(basename "$FILE")"; BASE="${BASE#active-}"
  case "$OUTC" in
    succeeded)
      post_verdict "$FILE" "$TASK" || OUTC="verdict-refused"
      DELIVERED_PR=""; DELIVERED_SHA=""
      if [ "$OUTC" = "succeeded" ] && [ -n "$(kv KEPT "$RUNNING")" ] && deliver "$FILE" "$TASK" "$(kv KEPT "$RUNNING")"; then
        # delivered: the tree now holds nothing that is not on the remote, so it can go
        bash "$HERE/worker.sh" close "$DISP" >/dev/null 2>&1 && sed -i '/^KEPT=/d' "$RUNNING"
      fi
      [ "$OUTC" = "succeeded" ] && OUTC="$(report_status "$FILE" "$TASK")"
      record "$FILE" "$OUTC" ;;
    *)
      if [ "${ATTEMPT:-1}" -lt "$MAX_ATTEMPTS" ]; then
        say "$DISP ended '$OUTC' (attempt ${ATTEMPT:-1}/$MAX_ATTEMPTS): retrying the same Task"
        { printf 'retry_task: %s\nretry_of: %s\nattempt: %s\n' "$TASK" "$DISP" "$(( ${ATTEMPT:-1} + 1 ))"
          sed '/^retry_task:/d; /^retry_of:/d; /^attempt:/d' "$FILE"; } > "$Q/$BASE"
        rm -f "$FILE"
      else
        say "$DISP ended '$OUTC' after $MAX_ATTEMPTS attempts: giving up on $BASE"
        event "gave-up dispatch=$DISP spec=$BASE outcome=$OUTC"
        record "$FILE" "$OUTC"
      fi ;;
  esac
  rm -f "$RUNNING"
  # a finished worker changes what is owed: look at GitHub and merge on the next pass, not in 5 min
  rm -f "$S/specgen.last" "$S/close.last"
}

post_verdict() {
  local FILE="$1" TASK="$2" ROLE PR REP RC=0
  ROLE="$(hdr role "$FILE")"; PR="$(hdr pr "$FILE")"
  case "$ROLE" in reviewer|tester) ;; *) return 0;; esac
  [ -n "$PR" ] || { say "no pr: header on a $ROLE spec; nothing posted"; return 1; }
  REP="$S/report-$TASK.txt"
  orca orchestration task-list --run "$(cat "$S/dispatch.run" 2>/dev/null)" --json </dev/null 2>/dev/null \
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

# A Coder or Fixer settles `succeeded` with `status: blocked` (or unreproducible / failed) in its body:
# the dispatch succeeded, the work did not. Recorded under that status, so needs.sh can tell a
# blocked issue (retried later) from a delivered one (measured 2026-10-05: coder-116 blocked on files
# held by #170 would otherwise have been recorded as succeeded and never retried).
report_status() {
  local FILE="$1" TASK="$2" ROLE ST REP PRN SHA
  ROLE="$(hdr role "$FILE")"
  case "$ROLE" in coder|fixer) ;; *) echo succeeded; return;; esac
  # kept for diagnosis, like a reviewer's report
  REP="$S/report-$TASK.txt"
  orca orchestration task-list --run "$(cat "$S/dispatch.run" 2>/dev/null)" --json </dev/null 2>/dev/null | node "$HERE_NATIVE/lib/task-result.cjs" "$TASK" > "$REP" 2>/dev/null
  ST="$(sed -n 's/^[[:space:]]*status:[[:space:]]*\([a-z]*\).*/\1/p' "$REP" | head -1)"
  # a report without a status line, whose work the dispatcher delivered, is judged by that delivery
  [ -z "$ST" ] && [ -n "${DELIVERED_PR:-}${DELIVERED_SHA:-}" ] && ST=succeeded
  case "$ST" in
    blocked|unreproducible|failed) say "$TASK reported status: $ST"; echo "$ST"; return;;
    succeeded) ;;
    # an unreadable report is not a success (measured 2026-10-05: unread reports were recorded as
    # succeeded, and a succeeded Coder hid its issue)
    *) say "$TASK: no readable status in its report ($REP); recorded as unknown"; echo unknown; return;;
  esac
  # A success is checked against GitHub, not taken from the report: measured 2026-10-05, nine Coders
  # settled "succeeded" and not one branch or PR existed.
  if [ "$ROLE" = "coder" ]; then
    PRN="${DELIVERED_PR:-$(sed -n 's/^[[:space:]]*pr:[[:space:]]*#\{0,1\}\([0-9][0-9]*\).*/\1/p' "$REP" | head -1)}"
    if [ -z "$PRN" ] || [ "$(gh pr view "$PRN" --repo "$REPO_SLUG" --json state --jq .state 2>/dev/null)" != "OPEN" ]; then
      say "$TASK reported succeeded but names no open PR (pr: '${PRN:-none}'); recorded as no-pr"; echo no-pr; return
    fi
  else
    SHA="${DELIVERED_SHA:-$(sed -n 's/^[[:space:]]*commit:[[:space:]]*\([0-9a-fA-F]\{7,40\}\).*/\1/p' "$REP" | head -1)}"
    PRN="$(hdr pr "$FILE")"
    # A report without a commit: line is judged by the PR itself: the head moved off the commit the
    # spec was written for, and only this Fixer writes to the PR while it runs (blocked_by). Measured
    # 2026-10-05, fixer-237: it merged the base in and pushed 2609933, and its report named no commit,
    # so it was recorded no-push.
    if [ -z "$SHA" ]; then
      local NOW0 HEAD0; HEAD0="$(hdr head "$FILE")"
      NOW0="$(gh pr view "$PRN" --repo "$REPO_SLUG" --json headRefOid --jq .headRefOid 2>/dev/null)"
      [ -n "$HEAD0" ] && [ -n "$NOW0" ] && case "$NOW0" in "$HEAD0"*) ;; *) SHA="$NOW0"; say "$TASK: no commit: line; #$PRN moved from $HEAD0 to ${NOW0:0:7}";; esac
    fi
    case "$(gh pr view "$PRN" --repo "$REPO_SLUG" --json headRefOid --jq .headRefOid 2>/dev/null)" in
      "$SHA"*) [ -n "$SHA" ] || { say "$TASK: fixer names no commit; recorded as no-push"; echo no-push; return; } ;;
      *) say "$TASK: fixer commit '${SHA:-none}' is not the head of #$PRN; recorded as no-push"; echo no-push; return;;
    esac
  fi
  echo succeeded
}

# DELIVERY is mechanical, so the dispatcher does it, not the model. Measured 2026-10-05: a Coder on
# muse-spark-1.3 wrote and tested the change in nine trees, committed in one and pushed in none; the
# work was then deleted with the trees. A Coder/Fixer that settled succeeded and left work in its
# kept tree gets it committed (app/ only, the role's own git identity), pushed, and - for a Coder -
# a PR opened with its report as the body. A report that says blocked/failed/unreproducible is not
# delivered. Sets DELIVERED_PR (coder) or DELIVERED_SHA (fixer); returns non-zero if nothing went out.
deliver() {
  local FILE="$1" TASK="$2" P="$3" ROLE ST REP N TITLE BR BASEBR PRN URL BODY
  ROLE="$(hdr role "$FILE")"; case "$ROLE" in coder|fixer) ;; *) return 1;; esac
  [ -d "$P" ] || { say "deliver: $P is gone"; return 1; }
  REP="$S/report-$TASK.txt"
  orca orchestration task-list --run "$(cat "$S/dispatch.run" 2>/dev/null)" --json </dev/null 2>/dev/null \
    | node "$HERE_NATIVE/lib/task-result.cjs" "$TASK" > "$REP" 2>/dev/null
  ST="$(sed -n 's/^[[:space:]]*status:[[:space:]]*\([a-z]*\).*/\1/p' "$REP" | head -1)"
  case "$ST" in blocked|failed|unreproducible) say "deliver: $TASK reported $ST; its tree is kept, not delivered"; return 1;; esac
  ( cd "$P" && bash "$HERE/identity.sh" "$ROLE" ) >/dev/null 2>&1 || { say "deliver: identity.sh $ROLE failed in $P"; return 1; }
  BASEBR="$(hdr base "$FILE")"; BASEBR="${BASEBR#origin/}"
  if [ "$ROLE" = "coder" ]; then
    N="$(hdr issue "$FILE")"
    TITLE="$(gh issue view "$N" --repo "$REPO_SLUG" --json title --jq .title 2>/dev/null | sed 's/^\[[a-z]*\] *//')"
    [ -n "$TITLE" ] || TITLE="issue $N"
    TITLE="[coder] $TITLE (#$N)"
  else
    N="$(hdr pr "$FILE")"; TITLE="[fixer] apply the verdict's findings (#$N)"
  fi
  if [ -n "$(git -C "$P" status --porcelain --untracked-files=normal -- app 2>/dev/null)" ]; then
    git -C "$P" add -A -- app && git -C "$P" commit -q -m "$TITLE" \
      -m "Committed by the dispatcher: the worker settled succeeded and left this work uncommitted ($TASK)." \
      || { say "deliver: commit failed in $P"; return 1; }
  fi
  # Nothing unpushed can also mean an interrupted delivery already pushed it (coder-18, 2026-10-05):
  # then the Coder's branch on origin IS this HEAD, and only the PR is missing.
  local PUSHED="" HEADSHA; HEADSHA="$(git -C "$P" rev-parse HEAD 2>/dev/null)"
  if [ "$(git -C "$P" rev-list --count HEAD --not --remotes=origin 2>/dev/null || echo 0)" -eq 0 ]; then
    if [ "$ROLE" = "coder" ]; then
      BR="$(git -C "$P" rev-parse --abbrev-ref HEAD)"
      [ -n "$HEADSHA" ] && [ "$(git -C "$P" ls-remote origin "refs/heads/$BR" 2>/dev/null | cut -f1)" = "$HEADSHA" ] && PUSHED=1
    fi
    [ -n "$PUSHED" ] || { say "deliver: nothing in $P that is not already on the remote"; return 1; }
    say "deliver: $BR already holds $HEADSHA on origin; opening its PR"
  fi
  if [ "$ROLE" = "fixer" ]; then
    # fast-forward onto the PR branch only; a refused push means the PR moved on, and is reported
    git -C "$P" push -q origin "HEAD:refs/heads/$BASEBR" 2>&1 | sed 's/^/dispatch: deliver: /' >&2
    [ "${PIPESTATUS[0]}" -eq 0 ] || { say "deliver: push to $BASEBR refused"; return 1; }
    DELIVERED_SHA="$(git -C "$P" rev-parse HEAD)"
    event "delivered role=fixer spec=$(basename "$FILE" | sed 's/^active-//') pr=$N commit=${DELIVERED_SHA:0:7}"
    return 0
  fi
  BR="$(git -C "$P" rev-parse --abbrev-ref HEAD)"
  if [ -z "$PUSHED" ]; then
    git -C "$P" push -q -u origin "HEAD:refs/heads/$BR" 2>&1 | sed 's/^/dispatch: deliver: /' >&2
    [ "${PIPESTATUS[0]}" -eq 0 ] || { say "deliver: push of $BR refused"; return 1; }
  fi
  PRN="$(gh pr list --repo "$REPO_SLUG" --head "$BR" --state open --json number --jq '.[0].number // empty' 2>/dev/null)"
  if [ -z "$PRN" ]; then
    BODY="$S/deliver-$TASK.md"
    { echo "Closes #$N"; echo; echo "## Worker report"; echo; report_text "$REP"; echo
      echo "_Delivered by the dispatcher: the worker ($TASK, $(kv MODEL "$RUNNING")) settled succeeded without opening a PR. The Reviewer and Tester gate it as usual._"; } > "$BODY"
    URL="$(gh pr create --repo "$REPO_SLUG" --base "$BASEBR" --head "$BR" --title "$TITLE" --body-file "$BODY" 2>&1)" \
      || { say "deliver: gh pr create failed: $(printf '%s' "$URL" | tr '\n' ' ' | cut -c1-200)"; return 1; }
    PRN="$(printf '%s' "$URL" | grep -oE '/pull/[0-9]+' | grep -oE '[0-9]+' | tail -1)"
  fi
  [ -n "$PRN" ] || { say "deliver: no PR number for $BR"; return 1; }
  DELIVERED_PR="$PRN"
  event "delivered role=coder spec=$(basename "$FILE" | sed 's/^active-//') pr=$PRN branch=$BR"
  return 0
}

# The report as a reader wants it: task-result.cjs prints EVERY string of Orca's result, so a report
# without status:/commit: lines comes with Orca's own fields mixed in (measured 2026-10-05, #235's body:
# worker_report, succeeded, msg_..., term_... twice, an ISO time). Those lines are dropped here only;
# verdict-post.sh reads the unfiltered report.
report_text() {
  grep -vE '^[[:space:]]*(worker_report|succeeded|failed|blocked|msg_[0-9a-f]+|term_[0-9a-f-]+|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z)[[:space:]]*$' "$1" \
    | sed '/./,$!d'
}

record() {
  local FILE="$1" OUTC="$2" DST
  DST="$(basename "$FILE")"; DST="${DST#active-}"
  # a re-queued spec has the same name: keep every result (needs.sh counts verdict-refused ones)
  if [ -e "$DONE/$DST.$OUTC" ]; then DST="$DONE/$DST.$(date +%s).$OUTC"; else DST="$DONE/$DST.$OUTC"; fi
  { cat "$FILE"; printf '\n--- result\n'; cat "$RUNNING"; printf 'OUTCOME=%s\nFINISHED=%s\n' "$OUTC" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"; } > "$DST"
  rm -f "$FILE"
  say "recorded $(basename "$DST")"
  event "finished spec=$(basename "$FILE" | sed 's/^active-//') outcome=$OUTC model=$(kv MODEL "$RUNNING")"
  case "$OUTC" in no-pr|no-push|unknown|verdict-refused) event "$OUTC spec=$(basename "$FILE" | sed 's/^active-//') dispatch=$(kv DISPATCH "$RUNNING")";; esac
}

# ---- start the next queued spec ---------------------------------------------------------------
# why a queued spec cannot start now (empty = it can)
blocked_by() {
  local F="$1" ROLE M P K
  ROLE="$(hdr role "$F")"; M="$(model_of "$F")"
  [ "$MAX_WORKERS" -gt 0 ] && [ "$(live_count)" -ge "$MAX_WORKERS" ] && { echo "$MAX_WORKERS workers live"; return; }
  local CAP; CAP="$(model_cap "$M")"
  [ -n "$M" ] && [ "$CAP" -gt 0 ] && [ "$(live_with MODEL "$M")" -ge "$CAP" ] && { echo "model $M at its cap"; return; }
  P="$(hdr serve "$F")"
  [ -n "$P" ] && [ "$(live_with SERVE "$P")" -gt 0 ] && { echo "port $P in use"; return; }
  case "$ROLE" in
    coder) K="ISSUE"; P="$(hdr issue "$F")";;
    fixer) K="PR"; P="$(hdr pr "$F")";;
    *) K="";;
  esac
  if [ -n "$K" ] && [ -n "$P" ]; then
    local G; for G in $(live); do
      [ "$(kv ROLE "$G")" = "$ROLE" ] && [ "$(kv "$K" "$G")" = "$P" ] && { echo "a $ROLE already works on $P"; return; }
    done
  fi
}

# start every queued spec that nothing real blocks, in name order (1xx fixer < 2xx tester <
# 3xx reviewer < 5xx coder), at most DISPATCH_STARTS per pass so the live workers keep being polled
start_ready() {
  local F N=0 WHY
  for F in $(ls -1 "$Q" 2>/dev/null | grep -v '^\.' | sort); do
    [ "$N" -ge "${DISPATCH_STARTS:-2}" ] && break
    [ -f "$Q/$F" ] || continue
    WHY="$(blocked_by "$Q/$F")"
    [ -z "$WHY" ] || continue
    start_one "$Q/$F" && N=$((N+1))
  done
}

# MEMORY decides how many workers run, not a count. Measured 2026-10-05 on this 7.5 GB host: one
# opencode worker holds 1.2-1.6 GB private once working, but starts small - so "is 600 MB free now"
# let a 5th and 6th worker in, free RAM fell to 56 MB, and bash could no longer fork (0xC000012D).
# A start therefore needs room for itself (WORKER_MB) PLUS the growth still owed by live workers:
# live x WORKER_MB minus what opencode already holds. Closing other programs lets more workers in
# by itself. With nothing live the old floor (WATCH_MIN_MB) applies, so the pipeline never stalls.
need_mb() {
  local N W OC RES; N="$(live_count)"; W="${WORKER_MB:-1500}"
  [ "$N" -gt 0 ] || { echo "${WATCH_MIN_MB:-600}"; return; }
  OC="$(powershell -NoProfile -Command "[int]((Get-Process opencode -ErrorAction SilentlyContinue | Measure-Object PrivateMemorySize64 -Sum).Sum/1MB)" 2>/dev/null | tr -dc '0-9')"
  # unreadable -> assume no live worker has grown yet (the safe side)
  RES=$(( N * W - ${OC:-0} )); [ "$RES" -lt 0 ] && RES=0
  say "memory: $N live, opencode holds ${OC:-unread} MB, growth still owed ${RES} MB -> a start needs $(( W + RES )) MB free"
  echo $(( W + RES ))
}

start_one() {
  local FILE="$1" MODEL; MODEL="$(model_of "$1")"
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
  [ -n "$(hdr model "$ACTIVE")" ] && ARGS+=(--model "$MODEL")

  say "starting $ROLE '$NAME' on $MODEL (attempt $ATTEMPT, $(live_count) live) from $(basename "$FILE")"
  # with workers live, a memory shortfall must not hold this loop (and their polling) for 15 minutes:
  # refuse fast (rc 3, the spec stays queued) and look again next pass
  local CAPT="${WATCH_CAP_TIMEOUT:-900}"; [ "$(live_count)" -gt 0 ] && CAPT=10
  local NEED; NEED="$(need_mb)"; ARGS+=(--min "$NEED")
  OUT="$(WATCH_CAP_TIMEOUT="$CAPT" bash "$HERE/worker.sh" "${ARGS[@]}")"; RC=$?
  rm -f "$SPEC"
  local DISP TASK
  DISP="$(printf '%s\n' "$OUT" | sed -n 's/^DISPATCH=//p')"; TASK="$(printf '%s\n' "$OUT" | sed -n 's/^TASK=//p')"
  if [ "$RC" -ne 0 ] || [ -z "$DISP" ]; then
    if [ "$RC" -eq 3 ]; then
      # refused before anything was created (capacity, base, port): back to the queue unchanged
      say "start refused (rc 3); $(basename "$FILE") stays queued"; mv "$ACTIVE" "$FILE"
      # refused for memory/base/port: one event per 30 min at most, so a host that cannot start
      # anything is seen without flooding the manager
      local RL="$S/refused.last"; [ $(( $(date +%s) - $(cat "$RL" 2>/dev/null || echo 0) )) -ge 1800 ] \
        && { date +%s > "$RL"; event "start-refused spec=$(basename "$FILE") live=$(live_count)"; }
      return 1
    else
      say "start failed (rc $RC) for $(basename "$FILE")"
      event "start-failed spec=$(basename "$FILE") rc=$RC"
      { cat "$ACTIVE"; printf '\n--- result\nSTART_RC=%s\n%s\n' "$RC" "$OUT"; } > "$DONE/$(basename "$FILE").start-failed"
      rm -f "$ACTIVE"
    fi
    return 1
  fi
  RUNNING="$RUN_DIR/$(basename "$FILE").env"
  printf 'DISPATCH=%s\nTASK=%s\nFILE=%s\nNAME=%s\nROLE=%s\nATTEMPT=%s\nSTARTED=%s\nDEADLINE_AT=%s\nSERVE=%s\nISSUE=%s\nPR=%s\n' \
    "$DISP" "$TASK" "$ACTIVE" "$NAME" "$ROLE" "$ATTEMPT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$(( $(date +%s) + DEADLINE ))" "$SERVE" "$(hdr issue "$ACTIVE")" "$(hdr pr "$ACTIVE")" > "$RUNNING"
  printf '%s\n' "$OUT" | sed -n 's/^\(WORKTREE\|PATH\|SERVING\|ASSET\|MODEL\)=/&/p' >> "$RUNNING"
  grep -q '^MODEL=' "$RUNNING" || echo "MODEL=$MODEL" >> "$RUNNING"
  say "dispatched $DISP for $(basename "$FILE")"
  event "started dispatch=$DISP spec=$(basename "$FILE") model=$MODEL"
}

close_pass() {
  local STAMP="$S/close.last" NOW; NOW="$(date +%s)"
  [ $(( NOW - $(cat "$STAMP" 2>/dev/null || echo 0) )) -ge "${CLOSE_EVERY:-120}" ] || return 0
  echo "$NOW" > "$STAMP"
  local ARG=(); acting || ARG=(--dry-run)
  bash "$HERE/close.sh" "${ARG[@]+"${ARG[@]}"}" 2>&1 | grep -E 'MERGED|refused|BLOCKED|issue #|merged [0-9]|held' \
    | sed 's/^/close: /' | while IFS= read -r l; do
        say "$l"
        case "$l" in *"merge was refused"*) event "merge-refused $(printf '%s' "$l" | sed 's/^close: //' | cut -c1-200)";; esac
      done
}

# The queue is topped up from GitHub by specgen.sh (needs.sh -> one spec per need) at most every
# SPECGEN_EVERY seconds, so the pipeline advances without anyone writing a spec or asking "sonuc?".
# It runs even when the queue is not empty: measured 2026-10-04, with four Coders queued (up to 90 min
# each) the Reviewer/Testers owed on open PRs would have waited hours behind them, because they were
# only generated once the queue drained. Name order (1xx fixer < 2xx tester < 3xx reviewer < 5xx
# coder) then runs them first; needs.sh never re-queues a spec that is already queued.
fill_queue() {
  local STAMP="$S/specgen.last" NOW; NOW="$(date +%s)"
  [ $(( NOW - $(cat "$STAMP" 2>/dev/null || echo 0) )) -ge "${SPECGEN_EVERY:-120}" ] || return 0
  echo "$NOW" > "$STAMP"
  bash "$HERE/specgen.sh" 2>&1 | while IFS= read -r l; do say "$l"; done
}

# Each pass: poll every live worker (close the settled ones), merge what the gate passed, top the
# queue up from GitHub, then start whatever is ready.
# one Orca read for every live worker: "<dispatchId> <outcome> <liveness>" per line in workers.now
# (fields measured on the host 2026-10-05: workers[].dispatchId, projection.outcome,
# projection.liveness.verdict). An unreadable list leaves the file empty, and each worker falls back.
read_workers() {
  : > "$S/workers.now"
  live >/dev/null || return 0
  orca orchestration worker-list --run "$(cat "$S/dispatch.run" 2>/dev/null)" --json </dev/null 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const i=s.indexOf("{");const j=JSON.parse(s.slice(i));
        for(const w of ((j.result||{}).workers||[])){const p=w.projection||{};
          console.log([w.dispatchId,p.outcome||"-",(p.liveness||{}).verdict||"-"].join(" "))}}catch(e){}})' > "$S/workers.now" 2>/dev/null
}

pass() {
  local F
  read_workers
  # the one-worker dispatcher kept its live worker in running.env: adopt it
  if [ -f "$S/running.env" ]; then
    F="$RUN_DIR/$(basename "$(kv FILE "$S/running.env")").env"
    mv "$S/running.env" "$F" && say "adopted running.env as $(basename "$F")"
  fi
  for F in $(live); do RUNNING="$F"; finish_running || true; done
  close_pass
  fill_queue
  start_ready
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

stop_asked() { [ -f "$S/dispatch.stop" ] || return 0; rm -f "$S/dispatch.stop"; say "stop requested; exiting between passes"; exit 0; }

status() {
  echo "enabled: $(acting && echo yes || echo 'no (dry run)')"
  local F; echo "running ($(live_count)$([ "$MAX_WORKERS" -gt 0 ] && echo " of max $MAX_WORKERS")):"
  for F in $(live) "$S/running.env"; do [ -f "$F" ] && { echo "  [$(basename "$F" .env)]"; sed 's/^/    /' "$F"; }; done
  echo "queue:"; ls -1 "$Q" 2>/dev/null | sed 's/^/  /'
  echo "last results:"; ls -1t "$DONE" 2>/dev/null | head -10 | sed 's/^/  /'
}

case "${1:-}" in
  --status) status ;;
  --once) lock; pass ;;
  --stop)
      # Stop the running dispatcher BETWEEN passes, never inside one. 2026-10-05: a `kill` landed between
      # coder-18's close and its delivery; the pushed work was left without a PR and its tree removed.
      P0="$(cat "$S/dispatch.lock" 2>/dev/null)"
      [ -n "$P0" ] && kill -0 "$P0" 2>/dev/null || { echo "STOPPED (no dispatcher was running)"; rm -f "$S/dispatch.stop"; exit 0; }
      touch "$S/dispatch.stop"; echo "asked pid $P0 to stop after its current pass"
      for _ in $(seq 1 "${STOP_WAIT:-300}"); do kill -0 "$P0" 2>/dev/null || { echo "STOPPED (pid $P0)"; exit 0; }; sleep 1; done
      echo "STILL RUNNING after ${STOP_WAIT:-300}s (pid $P0): its pass has not ended; look at dispatch.log"; exit 1 ;;
  --bind) lock
      # bash's own errors (e.g. "unbound variable") go to stderr only; keep a copy on disk so a
      # dispatcher that ends by itself leaves its reason behind, not just in a closed terminal.
      exec 2> >(tee -a "$S/dispatch.err" >&2)
      bind_run; say "dispatcher up (pid $$, Run $(cat "$S/dispatch.run"), $(acting && echo acting || echo 'dry run'))"; event "up pid=$$"
      rm -f "$S/dispatch.stop"
      while :; do pass; stop_asked; sleep "$INTERVAL"; stop_asked; done ;;
  "") lock; say "dispatcher up (pid $$, $(acting && echo acting || echo 'dry run'))"
      rm -f "$S/dispatch.stop"
      while :; do pass; stop_asked; sleep "$INTERVAL"; stop_asked; done ;;
  *) sed -n '2,8p' "$0" >&2; exit 2 ;;
esac
