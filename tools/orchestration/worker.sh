#!/usr/bin/env bash
# One OpenCode worker through Orca's OWN lifecycle: Orca creates the worktree, Orca opens and owns
# the agent terminal, Orca closes it on release. Replaces spawn.sh + start.sh + settle.sh for the
# dispatcher; those stay in the tree, frozen, for the old path.
#
#   worker.sh start <name> <base-ref> <spec-file> <task-title> [--readonly|--config <role>] [--min <mb>] [--serve <port>]
#   worker.sh start <name> <base-ref> --task <task_id> --retry-of <dispatch> [--readonly] [--min <mb>]
#   worker.sh wait  <dispatch> [--deadline <seconds>] [--interval <seconds>]
#   worker.sh close <dispatch> [--stop]
#   worker.sh run   <name> <base-ref> <spec-file> <task-title> [start flags] [--deadline <seconds>]
#
# Must run in the Orca terminal bound to the Run: worker-start is fenced to it (consumer_fenced).
#
# Why this replaces the old path. Measured 2026-10-03 on this host, Orca 1.4.217:
#   * spawn.sh opened the terminal itself and passed --terminal, so Orca recorded every one of 238
#     dispatches as ownershipState=external / retainedReason=external_terminal. Release never
#     closes an external terminal, which is the leak the settle/reconcile/recover layers chased.
#   * worker-start --agent opencode on an Orca-created worktree, with NO --terminal: the terminal
#     is owned, liveness reads live/agent_status (not unverifiable), worker_done settles the
#     dispatch, release answers released/closed_agent_terminal and the terminal is gone.
#   * The model and permissions come ONLY from opencode.json written into the worktree BEFORE the
#     agent starts. `--worktree new-child` starts the agent first and ran the default model, so the
#     worktree is created here, pinned, and only then started.
#   * Order matters on the way out: release first, worktree rm second. Removing the worktree under
#     a live worker left the release at release_unknown.
#
# Output is KEY=value lines on stdout; the narrative goes to stderr and to $S/worker.log.
# Exit: 0 ok · 2 usage/context · 3 refused (nothing changed) · 4 Orca said no · 5 not ours · 6 unconfirmed
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# node.exe cannot read an MSYS path on this host (MSYS path conversion is disabled; serve.sh notes it).
HERE_NATIVE="$(cygpath -m "$HERE" 2>/dev/null || printf '%s' "$HERE")"
# git worktree commands below run against this checkout, wherever the caller stands.
cd "$HERE/../.." || exit 2
S="${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer"
mkdir -p "$S" 2>/dev/null || true
LOG="$S/worker.log"
MARK=".dsv-worker"
OWNER="owner=worker.sh"

say() { printf '%s worker: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG" >&2; }
jget() { node "$HERE_NATIVE/lib/jget.cjs" "$@"; }
# orca with stdin closed and stderr dropped: orca.exe prints crashpad noise there on this host.
o() { orca "$@" </dev/null 2>/dev/null; }

context() {
  # shellcheck source=/dev/null
  . "$HERE/repo-id.sh" || exit 2
  FROM="${WATCH_FROM:-${ORCA_TERMINAL_HANDLE:-}}"
  [ -n "$FROM" ] || { say "no coordinator handle (ORCA_TERMINAL_HANDLE unset); run in the terminal bound to the Run"; exit 2; }
  RUN="${WATCH_RUN:-$(o orchestration run-current --json | jget result.run.id)}"
  [ -n "$RUN" ] || { say "no Run bound to this terminal (orchestration run-current)"; exit 2; }
}

# worktree id is "<repo-id>::<path>"
wt_path() { printf '%s' "${1#*::}"; }
# 0 = the terminal is listed OR the list could not be read (unknown is not absent, hunter H-007)
listed() { local TL; TL="$(o terminal list --json)"; case "$TL" in *'"ok":true'*|*'"ok": true'*) ;; *) return 0;; esac
  printf '%s' "$TL" | grep -q "\"$1\""; }

# ---- start ---------------------------------------------------------------------------------
cmd_start() {
  local NAME="" BASE="" SPEC="" TITLE="" READONLY="" CONFIG="" MIN="${WATCH_MIN_MB:-600}" TASK="" RETRY_OF="" SERVE="" MODEL=""
  local pos=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --readonly) READONLY=1; shift;;
      --config) CONFIG="${2:?--config needs a role config name}"; shift 2;;
      --min) MIN="${2:?--min needs mb}"; shift 2;;
      --task) TASK="${2:?--task needs an id}"; shift 2;;
      --retry-of) RETRY_OF="${2:?--retry-of needs a dispatch}"; shift 2;;
      --serve) SERVE="${2:?--serve needs a port}"; shift 2;;
      --model) MODEL="${2:?--model needs a model id}"; shift 2;;
      --deadline|--interval) shift 2;;   # belong to wait; tolerated so `run` can pass everything
      -*) say "start: unknown flag $1"; exit 2;;
      *) pos+=("$1"); shift;;
    esac
  done
  NAME="${pos[0]:-}"; BASE="${pos[1]:-}"; SPEC="${pos[2]:-}"; TITLE="${pos[3]:-}"
  if [ -n "$RETRY_OF" ] || [ -n "$TASK" ]; then
    # Orca: --retry-of needs --task naming the failed Task; --spec would create a new Task.
    [ -n "$NAME" ] && [ -n "$BASE" ] && [ -n "$TASK" ] && [ -n "$RETRY_OF" ] \
      || { say "start: a retry needs <name> <base> --task <id> --retry-of <dispatch>"; exit 2; }
  else
    [ -n "$NAME" ] && [ -n "$BASE" ] && [ -n "$SPEC" ] && [ -n "$TITLE" ] \
      || { say "usage: worker.sh start <name> <base-ref> <spec-file> <task-title> [--readonly] [--min mb]"; exit 2; }
    [ -f "$SPEC" ] || { say "start: no spec at $SPEC"; exit 2; }
  fi
  context

  # Everything that can refuse runs BEFORE anything is created, so a refusal leaves nothing behind.
  if ! git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null; then
    git fetch --quiet origin "${BASE#origin/}" 2>/dev/null || true
    git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null \
      || { say "start: base ref '$BASE' does not exist"; exit 3; }
  fi
  local CAP_RC=0
  bash "$HERE/wait-capacity.sh" --min "$MIN" --timeout "${WATCH_CAP_TIMEOUT:-900}" --note "dispatch: $NAME" >&2 || CAP_RC=$?
  [ "$CAP_RC" -eq 0 ] || { say "start: capacity did not reach ${MIN} MB; nothing created"; exit 3; }
  bash "$HERE/serve.sh" --orphans --kill 2>&1 | sed 's/^/worker: port: /' >&2
  if [ -n "$SPEC" ] && [ -z "$SERVE" ]; then
    local SPEC_PORT
    SPEC_PORT="$(grep -oiE 'ports?[: ]+[0-9]{4,5}' "$SPEC" 2>/dev/null | grep -oE '[0-9]{4,5}' | head -1)"
    if [ -n "$SPEC_PORT" ] && ! bash "$HERE/serve.sh" --wait "$SPEC_PORT" 2>&1 | sed 's/^/worker: port: /' >&2; then
      say "start: the spec names port $SPEC_PORT and it is not serving; nothing created"; exit 3
    fi
  fi

  # 1. Orca creates the worktree.
  local RAW WTID P
  RAW="$(o worktree create --repo "id:$REPO_ID" --name "$NAME" --base-branch "$BASE" --setup skip --json)"
  { read -r OK; read -r WTID; read -r P; } < <(printf '%s' "$RAW" | jget ok result.worktree.id result.worktree.path)
  if [ "${OK:-}" != "true" ] || [ -z "$WTID" ] || [ -z "$P" ]; then
    say "start: orca worktree create failed for $NAME:"; printf '%s\n' "$RAW" | head -c 1500 >&2; echo >&2
    exit 4
  fi
  say "start: worktree $WTID"

  # From here on, a failure removes what this call created.
  rollback() {
    say "start: rolling back $WTID"
    bash "$HERE/serve.sh" --stop-worktree "$P" >/dev/null 2>&1
    o terminal close --worktree "id:$WTID" --all --json >/dev/null
    o worktree rm --worktree "id:$WTID" --force --json >/dev/null
  }

  # 2. Ownership marker, untracked-by-design files excluded, model + permission pin.
  printf 'role=%s\n%s\nstate=starting\nworktree=%s\ndispatch=\ncreated_at=%s\n' \
    "$NAME" "$OWNER" "$WTID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$P/$MARK" || { say "start: cannot write $P/$MARK"; rollback; exit 4; }
  local GD; GD="$(git -C "$P" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -n "$GD" ]; then
    mkdir -p "$GD/info" 2>/dev/null || true
    for PAT in "$MARK" opencode.json; do
      grep -qxF "$PAT" "$GD/info/exclude" 2>/dev/null || printf '%s\n' "$PAT" >> "$GD/info/exclude"
    done
  fi
  local CFG="$HERE/roles/write.opencode.json"; [ -n "$READONLY" ] && CFG="$HERE/roles/readonly.opencode.json"
  [ -n "$CONFIG" ] && CFG="$HERE/roles/$CONFIG.opencode.json"
  [ -f "$CFG" ] || { say "start: no role config $CFG"; rollback; exit 4; }
  cp "$CFG" "$P/opencode.json" || { say "start: cannot pin $P/opencode.json"; rollback; exit 4; }
  if [ -n "$MODEL" ]; then
    node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.model=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(j,null,2)+"\n")' \
      "$(cygpath -m "$P/opencode.json" 2>/dev/null || printf '%s' "$P/opencode.json")" "$MODEL" \
      || { say "start: cannot set model $MODEL"; rollback; exit 4; }
  fi
  echo "MODEL=$(node "$HERE_NATIVE/lib/jget.cjs" model < "$P/opencode.json")"

  # 2b. A Tester needs the PR's build served before it starts (it writes nothing itself).
  if [ -n "$SERVE" ]; then
    local PREP
    # Never inside $(...): a long-lived process started under it holds the pipe open on MSYS
    # (measured 2026-10-04, tester-163d). Output goes to a file; stdin is closed.
    local PREPLOG="$S/prep-$NAME.log"
    PREP_WORKTREE_ID="$WTID" bash "$HERE/prep-tester.sh" "$P" "$SERVE" > "$PREPLOG" 2>&1 </dev/null \
      || { cat "$PREPLOG" >&2; say "start: prep-tester failed (log $PREPLOG)"; rollback; exit 4; }
    grep -E '^(SERVING|ASSET)=' "$PREPLOG"
  fi

  # 3. Orca starts the agent in its own terminal. No --terminal: that is what makes it owned.
  local WHAT=()
  if [ -n "$RETRY_OF" ]; then WHAT=(--task "$TASK" --retry-of "$RETRY_OF")
  else WHAT=(--spec "$(cat "$SPEC")" --task-title "$TITLE"); fi
  RAW="$(o orchestration worker-start "${WHAT[@]}" --worktree "id:$WTID" --agent opencode \
    --run "$RUN" --from "$FROM" --json)"
  local DISP TASKID STATE ERR
  { read -r OK; read -r DISP; read -r TASKID; read -r STATE; read -r ERR; } < <(printf '%s' "$RAW" \
    | jget ok result.dispatchId result.taskId result.state error.code)
  if [ "${OK:-}" != "true" ] || [ -z "$DISP" ]; then
    say "start: worker-start refused ($ERR):"; printf '%s\n' "$RAW" | head -c 1500 >&2; echo >&2
    # outcome_unknown can still carry a dispatch: stop and release it before removing the tree.
    DISP="$(printf '%s' "$RAW" | jget error.data.dispatchId result.dispatchId | grep -m1 . || true)"
    if [ -n "$DISP" ]; then
      o orchestration worker-stop --dispatch "$DISP" --json >/dev/null
      o orchestration worker-release --dispatch "$DISP" --json >/dev/null
    fi
    rollback; exit 4
  fi

  sed -i "s/^state=.*/state=dispatched/; s/^dispatch=.*/dispatch=$DISP/" "$P/$MARK" 2>/dev/null || true
  say "start: $NAME dispatched $DISP (task $TASKID, $STATE)"
  echo "DISPATCH=$DISP"
  echo "TASK=$TASKID"
  echo "WORKTREE=$WTID"
  echo "PATH=$P"
}

# ---- wait ----------------------------------------------------------------------------------
# Settled = projection.outcome leaves in_progress (the worker's worker_done, or Orca's own verdict).
# Never the screen text: the task title itself contains "worker_done" (measured, probe v3).
# An unreadable reply is UNKNOWN and never ends the wait early (hunter H-007).
cmd_wait() {
  local DISP="${1:-}"; shift || true
  local DEADLINE=3600 INTERVAL=15 POLL=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --deadline) DEADLINE="${2:?}"; shift 2;;
      --interval) INTERVAL="${2:?}"; shift 2;;
      # --poll N: look for at most N seconds, then answer OUTCOME=pending (the dispatcher polls each
      # slot in turn instead of blocking on one worker until it settles)
      --poll) POLL="${2:?}"; shift 2;;
      *) shift;;
    esac
  done
  [ -n "$DISP" ] || { say "usage: worker.sh wait <dispatch> [--deadline s]"; exit 2; }
  local T0 NOW OUT LIVE WAITING EXITED=0 BLOCKED=0
  T0="$(date +%s)"
  while :; do
    { read -r OUT; read -r LIVE; read -r WAITING; } < <(o orchestration worker-show --dispatch "$DISP" --json \
      | jget result.projection.outcome result.projection.liveness.verdict result.observation.agentWait)
    if [ -n "${OUT:-}" ] && [ "$OUT" != "in_progress" ]; then
      say "wait: $DISP settled: $OUT"; echo "OUTCOME=$OUT"; return 0
    fi
    # The process is gone but nothing settled: two reads in a row, so one stale read cannot end it.
    if [ "${LIVE:-}" = "exited" ]; then EXITED=$((EXITED+1)); else EXITED=0; fi
    [ "$EXITED" -ge 2 ] && { say "wait: $DISP exited without settling"; echo "OUTCOME=exited"; return 0; }
    # Waiting on an approval/permission prompt: nobody will answer it, so it is a stall.
    if [ -n "${WAITING:-}" ] && [ "$WAITING" != "null" ]; then BLOCKED=$((BLOCKED+1)); else BLOCKED=0; fi
    [ "$BLOCKED" -ge 3 ] && { say "wait: $DISP is waiting on a prompt: $WAITING"; echo "OUTCOME=agent_wait"; return 0; }
    NOW="$(date +%s)"
    if [ $((NOW - T0)) -ge "$DEADLINE" ]; then
      say "wait: $DISP passed its ${DEADLINE}s deadline"; echo "OUTCOME=timeout"; return 0
    fi
    [ -n "$POLL" ] && [ $((NOW - T0)) -ge "$POLL" ] && { echo "OUTCOME=pending"; return 0; }
    sleep "$INTERVAL"
  done
}

# ---- close ---------------------------------------------------------------------------------
cmd_close() {
  local DISP="${1:-}" STOP=""
  [ "${2:-}" = "--stop" ] && STOP=1
  [ -n "$DISP" ] || { say "usage: worker.sh close <dispatch> [--stop]"; exit 2; }
  local OUT WTID H P
  { read -r OUT; read -r WTID; read -r H; } < <(o orchestration worker-show --dispatch "$DISP" --json \
    | jget result.projection.outcome result.worker.worktreeId result.worker.agentTerminalHandle)
  [ -n "${OUT:-}" ] || { say "close: cannot read $DISP (unknown is not absent); nothing changed"; exit 6; }
  P="$(wt_path "$WTID")"

  # Only a tree this script created is ever removed (hunter H-021: no rm -rf on a guessed path).
  local OURS=""
  [ -n "$P" ] && [ -f "$P/$MARK" ] && grep -qxF "$OWNER" "$P/$MARK" && OURS=1

  # 1. A live worker is stopped only when asked; release refuses an unsettled one anyway.
  if [ "$OUT" = "in_progress" ]; then
    [ -n "$STOP" ] || { say "close: $DISP is still in progress; pass --stop"; exit 3; }
    o orchestration worker-stop --dispatch "$DISP" --json >/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      OUT="$(o orchestration worker-show --dispatch "$DISP" --json | jget result.projection.outcome)"
      [ -n "$OUT" ] && [ "$OUT" != "in_progress" ] && break
      sleep 3
    done
    # worker-stop does not reach an agent blocked on its own question (measured 2026-10-05,
    # coder-116: "did not stop" on every pass while it waited for an answer nobody sends). For our
    # own tree the agent's terminal is closed instead; the release below then finds it gone.
    if [ "$OUT" = "in_progress" ] && [ -n "$OURS" ] && [ -n "$H" ]; then
      say "close: $DISP did not stop; closing its agent terminal $H"
      o terminal close --terminal "$H" --json >/dev/null
      for _ in 1 2 3 4 5 6 7 8 9 10; do
        OUT="$(o orchestration worker-show --dispatch "$DISP" --json | jget result.projection.outcome)"
        [ -n "$OUT" ] && [ "$OUT" != "in_progress" ] && break
        listed "$H" || break
        sleep 3
      done
      listed "$H" && { say "close: $DISP terminal $H is still listed (or the list is unreadable)"; exit 6; }
    elif [ "$OUT" = "in_progress" ]; then
      say "close: $DISP did not stop"; exit 6
    fi
  fi

  # 2. Release: Orca closes the terminal it owns. Retried once with a fresh request id on
  #    release_unknown; then the terminal list decides (an observed fact, not an absence).
  local RS
  RS="$(o orchestration worker-release --dispatch "$DISP" --json | jget result.state error.code | grep -m1 .)"
  if [ "$RS" = "release_unknown" ]; then
    sleep 3
    RS="$(o orchestration worker-release --dispatch "$DISP" --json | jget result.state error.code | grep -m1 .)"
  fi
  case "$RS" in
    released|already_released) say "close: $DISP released" ;;
    retained)
      # Orca settled the dispatch but kept its terminal. Measured 2026-10-04 on coder-111
      # (ctx_89e71e81ff2b): every release answered `retained` after the dispatcher had been restarted
      # mid-run, and the close looped for 10+ minutes. The dispatch is settled and the worktree is
      # ours (owner marker), so its terminals are closed with the tree in step 3; without the
      # marker nothing is touched. Orca's own reason is logged so the cause stays visible.
      local WHY
      WHY="$(o orchestration worker-show --dispatch "$DISP" --json | jget result.terminalResource.retainedReason)"
      if [ -z "$OURS" ]; then say "close: $DISP retained (${WHY:-no reason}) and the tree is not ours; kept"; exit 6; fi
      say "close: $DISP retained by Orca (${WHY:-no reason}); closing the terminals of our own worktree" ;;
    *)
      if [ -n "$H" ] && o terminal list --json | grep -q "\"$H\""; then
        say "close: $DISP release '$RS' and terminal $H is still listed; worktree kept"; exit 6
      fi
      say "close: $DISP release '$RS' but terminal $H is gone; continuing" ;;
  esac

  # 3. The worktree: its other terminals and its preview, then Orca removes it from Orca and git.
  if [ -z "$OURS" ]; then
    [ -n "$P" ] && [ -d "$P" ] && { say "close: $P has no $OWNER marker; released, not removed"; echo "CLOSED=$DISP"; exit 5; }
    echo "CLOSED=$DISP"; return 0
  fi
  bash "$HERE/serve.sh" --stop-worktree "$P" 2>&1 | sed 's/^/worker: /' >&2
  o terminal close --worktree "id:$WTID" --all --json >/dev/null
  o worktree rm --worktree "id:$WTID" --force --json >/dev/null
  if git worktree list --porcelain 2>/dev/null | grep -qiF "worktree $P"; then
    say "close: orca left $P registered in git; removing that one tree"
    git worktree remove --force "$P" 2>/dev/null; git worktree prune 2>/dev/null
  fi
  if git worktree list --porcelain 2>/dev/null | grep -qiF "worktree $P"; then
    say "close: $P is still a worktree"; exit 6
  fi
  say "close: $DISP closed, $P removed"
  echo "CLOSED=$DISP"
}

# ---- run = start + wait + close --------------------------------------------------------------
cmd_run() {
  local DEADLINE=3600 a=("$@") i
  for ((i=0; i<${#a[@]}; i++)); do [ "${a[$i]}" = "--deadline" ] && DEADLINE="${a[$((i+1))]}"; done
  local START DISP OUTC
  START="$(cmd_start "$@")" || exit $?
  printf '%s\n' "$START"
  DISP="$(printf '%s\n' "$START" | sed -n 's/^DISPATCH=//p')"
  OUTC="$(cmd_wait "$DISP" --deadline "$DEADLINE" | sed -n 's/^OUTCOME=//p')"
  echo "OUTCOME=$OUTC"
  case "$OUTC" in
    succeeded|failed|cancelled) cmd_close "$DISP" ;;
    *) cmd_close "$DISP" --stop ;;
  esac
}

case "${1:-}" in
  start) shift; cmd_start "$@";;
  wait)  shift; cmd_wait "$@";;
  close) shift; cmd_close "$@";;
  run)   shift; cmd_run "$@";;
  *) sed -n '2,11p' "$0" >&2; exit 2;;
esac
