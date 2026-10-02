#!/usr/bin/env python3
"""One reconcile pass: managed worktrees vs the live set, and what to do about the rest.

The old cleanup started from one dispatch and hunted for its worktree, terminal and
processes. Every miss (Orca reporting a state that did not match, path vs name, a worktree
still on disk, a dead dispatch with a live tree) needed another patch, and cases stayed
uncovered. This starts from the other end: what is MANAGED, what is LIVE, and the diff.

Ownership is a marker file, <worktree>/.dsv-worker, written by spawn.sh when it creates a
worker worktree. Only marked worktrees are managed. The owner's own opencode session, the
coordinator, houndshark and the root checkout carry no marker and are invisible here.

Actions, for a managed worktree that is NOT live:
  * processes - kill the tree and verify it is gone. ALWAYS: RAM and evidence are separate
    decisions, so the processes die even when the worktree must be kept.
  * terminal  - close it and verify.
  * worktree  - hand to settle.sh, which settles when a settlement exists or the PR is
    merged and otherwise refuses, keeping the worktree as evidence.

A managed worktree that IS live is never touched.

    reconcile.py --run <run_id> [--json] [--plan-only] [--backfill]

Exit 0 always unless the process table cannot be read; violations are data, not crashes.
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import opencode_trees as ot  # noqa: E402
import calendar  # age_s: UTC stamps must be read as UTC, not as local time

WS_ROOT = ot.WS_ROOT
MARKER = ".dsv-worker"
KILL_LOG = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
                        "orca-orchestration", "design-system-viewer", "inbox",
                        "reconcile.log")


def orca(*args):
    try:
        cp = subprocess.run(["orca"] + list(args), capture_output=True, timeout=120,
                            stdin=subprocess.DEVNULL)
        raw = (cp.stdout or b"").decode("utf-8", errors="replace")
        i = raw.find("{")
        return json.loads(raw[i:]) if i >= 0 else {}
    except (OSError, ValueError, TypeError, subprocess.SubprocessError):
        return {}


def git_worktree_rows():
    """Worktrees git knows about but Orca does not list.

    A worktree made with `git worktree add` is on disk, in nobody's list, and would otherwise
    be invisible to the pass entirely. It is reported like any other unmarked worktree:
    unmanaged, never touched, only named."""
    seen, out = set(), []
    # orca() directly, not worktree_rows(): that one calls back into here, and the union would
    # recurse until the pass died - which is how this line read the first time.
    _o = (orca("worktree", "list", "--json").get("result") or {}).get("worktrees") or []
    bases = [WS_ROOT, "D:/code/design-system-viewer"] + [r.get("path") for r in _o]
    for base in bases:
        if not base:
            continue
        try:
            cp = subprocess.run(["git", "-C", base, "worktree", "list", "--porcelain"],
                                capture_output=True, timeout=60, stdin=subprocess.DEVNULL)
        except (OSError, subprocess.SubprocessError):
            continue
        if cp.returncode != 0:
            continue
        for line in (cp.stdout or b"").decode("utf-8", "replace").splitlines():
            if not line.startswith("worktree "):
                continue
            p = line[len("worktree "):].strip()
            if p and p not in seen:
                seen.add(p)
                out.append({"path": p, "name": os.path.basename(p.replace("\\", "/").rstrip("/")),
                            "gitOnly": True})
        if out:
            break
    return out


def worktree_rows():
    """The union of Orca's list and git's. Orca is authoritative for the ones it manages;
    git catches the rest, so nothing on disk can hide from the pass."""
    j = orca("worktree", "list", "--json")
    rows = list((j.get("result") or {}).get("worktrees") or [])
    have = set()
    for r in rows:
        for key in ("path", "worktreePath"):
            v = r.get(key)
            if v:
                have.add(v.replace("\\", "/").rstrip("/").lower())
    for g in git_worktree_rows():
        p = (g.get("path") or "").replace("\\", "/").rstrip("/")
        if p.lower() not in have:
            rows.append(g)
    return rows


def terminal_rows():
    j = orca("terminal", "list", "--json")
    return (j.get("result") or {}).get("terminals") or []


def worker_rows(run):
    j = orca("orchestration", "worker-list", "--run", run, "--json")
    return (j.get("result") or {}).get("workers") or []


def name_of(path):
    return ot.worktree_of(path) or os.path.basename((path or "").replace("\\", "/").rstrip("/"))


# How long a marker may say state=starting before the worktree stops being protected.
# start.sh waits up to 240 s for capacity, so this is generous by two orders of magnitude
# on purpose: a false negative here kills a worker that was only slow to start.
STARTING_GRACE_S = 30 * 60


def age_s(stamp):
    """Seconds since an ISO stamp we wrote, or a big number when it cannot be read."""
    try:
        t = calendar.timegm(time.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ"))
    except (ValueError, TypeError):
        return 1 << 30
    return max(0.0, time.time() - t)


def read_marker(wt_path):
    p = os.path.join(wt_path, MARKER)
    if not os.path.isfile(p):
        return None
    out = {}
    try:
        with open(p, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if "=" in line:
                    k, _, v = line.partition("=")
                    out[k.strip()] = v.strip()
    except OSError:
        return {}
    out["_path"] = p
    return out


def marker_text(role, handle="", state="dispatched", dispatch="", created_at=None):
    """The marker spawn.sh and start.sh write. start.sh is the only writer that knows the
    dispatch id, which is why spawn.sh leaves that field empty and says state=starting."""
    return ("role=%s\nhandle=%s\nstate=%s\ndispatch=%s\ncreated_at=%s\n"
            % (role, handle, state, dispatch,
               created_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())))


STATE_DIR = (os.environ.get("SUPERVISE_STATE")
             or os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"),
                            "Temp", "supervise-state"))


def ignored_rows():
    """Paths the operator has declared out of scope, with a reason. Keyed by normalised path.

    The Orca workspace root always holds the coordinator's own terminal, so it tripped the
    unmarked-worktree invariant on every pass, and an alarm that is always on is an alarm
    nobody reads. One line per path: "<path>  <reason>". Blank lines and # comments are
    skipped. An ignored path is reported as ignored - never as a violation, never acted on."""
    out = {}
    try:
        with open(os.path.join(STATE_DIR, "reconcile-ignore"), "r", encoding="utf-8",
                  errors="replace") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                parts = s.split(None, 1)
                out[parts[0].replace("\\", "/").rstrip("/").lower()] = (
                    parts[1].strip() if len(parts) > 1 else "no reason given")
    except OSError:
        return {}
    return out


def local_procs_in(name, trees):
    """opencode trees already resolved to this worktree."""
    return [t for t in trees if t["worktree"] == name]


def node_procs_in(wt_path, procs):
    """vite/node/bash whose COMMAND LINE names this worktree and that are NOT opencode.

    The check is the command line and only the command line. This used to claim cwd was
    checked too; it is not, so a preview started as `(cd <wt>/app && npx vite preview)`
    names no path and is invisible here. Reading another process's cwd needs a PEB read,
    and serve.sh owns previews, so this says what it does instead of what it should.
    To be seen, a process must carry the worktree path in its command line.
    """
    want = wt_path.replace("\\", "/").rstrip("/").lower()
    out = []
    for p in procs:
        nm = (p.get("Name") or "").lower()
        if nm in ("opencode.exe", "orca.exe", "system", "idle"):
            continue
        cmd = (p.get("CommandLine") or "").replace("\\", "/").lower()
        if want and want in cmd and nm in ("node.exe", "bun.exe", "vite", "npm.cmd", "npx.cmd"):
            out.append({"pid": p.get("ProcessId"), "name": p.get("Name")})
    return out


def build(run, execute, backfill, only=()):
    trees = ot.snapshot()
    procs = ot.processes()
    wts = worktree_rows()
    terms = terminal_rows()
    workers = worker_rows(run)

    by_name_term = {}
    for t in terms:
        n = name_of(t.get("worktreePath"))
        if n:
            by_name_term.setdefault(n, []).append(t)

    live_handles = set()
    live_dispatch_by_name = {}
    for w in workers:
        st = (w.get("dispatchStatus") or "").lower()
        h = w.get("agentTerminalHandle") or ""
        # A dispatch is live while it is neither completed, failed nor abandoned AND its
        # terminal is still listed: the dispatch record alone is not liveness evidence.
        if st not in ("completed", "failed", "abandoned") and h and any(x.get("handle") == h for x in terms):
            live_handles.add(h)
            for n, ts in by_name_term.items():
                if any(x.get("handle") == h for x in ts):
                    live_dispatch_by_name[n] = w.get("dispatchId")

    managed, unmanaged, backfill_candidates, ignored = [], [], [], []
    ign = ignored_rows()
    for w in wts:
        path = w.get("path") or ""
        if not path:
            continue
        n = name_of(path)
        if not os.path.isdir(path):
            continue
        mk = read_marker(path)
        if mk is None:
            # Ownership proof: a terminal in this worktree whose handle a dispatch names.
            proof = ""
            for t in by_name_term.get(n, []):
                for ww in workers:
                    if ww.get("agentTerminalHandle") and ww.get("agentTerminalHandle") == t.get("handle"):
                        proof = ww.get("dispatchId") or ""
            if proof:
                backfill_candidates.append({"worktree": n, "path": path, "dispatch": proof})
            # An ignored path is out of scope by the operator's own decision: named as ignored with
            # the reason on the line, never a violation. The reason travels with the entry so a pass
            # a year from now can still say why it is silent.
            _key = path.replace("\\", "/").rstrip("/").lower()
            if _key in ign:
                ignored.append({"worktree": n, "path": path, "reason": ign[_key]})
                continue
            # Every unmarked worktree is reported, not just the ones holding a terminal or an
            # opencode tree. A preview started as `cd <wt>/app && npx vite preview` names no path,
            # so filtering on "has a terminal" made a whole class of leak invisible. Reported only:
            # reconcile never acts on an unmarked worktree.
            _terms = list(by_name_term.get(n) or [])
            unmanaged.append({"worktree": n, "path": path, "reason": "no marker",
                              "terminals": _terms,
                              "opencode_roots": [t.get("root_pid") or t.get("pid") for t in local_procs_in(n, trees)],
                              "other_procs": node_procs_in(path, procs)})
            continue
        managed.append({"worktree": n, "path": path, "marker": mk, "row": w})

    if only:
        # A targeted pass sees only the named worktrees: everything else is left out of the
        # plan entirely, so it cannot be acted on by accident.
        managed = [m for m in managed if m["worktree"] in only]

    out = {"ok": True, "run": run, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "managed": [], "unmanaged": unmanaged, "backfill": backfill_candidates,
           "violations": [], "ignored": ignored, "live_handles": sorted(live_handles)}
    # An unmarked worktree holding a process is a leak outside the marker system: named as
    # a violation so it can never be silent, and never killed - reconcile does not act on
    # worktrees it does not own.
    for u in unmanaged:
        _held = (list(u.get("terminals") or []) + list(u.get("opencode_roots") or [])
                 + list(u.get("other_procs") or []))
        if _held:
            out["violations"].append(
                "unmarked worktree %s holds %d process(es) and is not managed"
                % (u["worktree"], len(_held)))

    for m in managed:
        n, path = m["worktree"], m["path"]
        mk = m["marker"]
        state = (mk.get("state") or "").strip().lower()
        # spawn.sh creates the worktree and writes the marker the moment it exists; start.sh
        # then waits for the TUI and for capacity (measured up to 240 s) before worker-start
        # creates the dispatch. In that window the worktree is managed and has no dispatch, so
        # an executing pass would kill its opencode and close its terminal. While the marker
        # says starting and is young, the worktree is protected. Once it is old, start.sh is
        # gone - it died, or capacity timed out - and the worktree is not live like any other.
        starting_recent = (state == "starting"
                           and age_s(mk.get("created_at")) < STARTING_GRACE_S)
        # The dispatch is the marker's own field first, then the dispatch that names this
        # worktree's terminal. spawn.sh cannot know the dispatch id, so a marker that start.sh
        # never promoted has none - and then there is nothing to hand to settle.sh.
        disp = (mk.get("dispatch") or "").strip() or live_dispatch_by_name.get(n, "")
        if not disp:
            h = (mk.get("handle") or "").strip()
            if h:
                for w in workers:
                    if w.get("agentTerminalHandle") == h:
                        disp = w.get("dispatchId") or ""
                        break
        live = (n in live_dispatch_by_name) or starting_recent
        local = local_procs_in(n, trees)
        extra = node_procs_in(path, procs)
        terms_here = [t for t in by_name_term.get(n, [])]
        rec = {
            "worktree": n, "path": path, "live": live,
            "dispatch": disp,
            "opencode_roots": local, "other_procs": extra,
            "terminals": [t.get("handle") for t in terms_here],
            "actions": [],
        }
        rec["starting_recent"] = starting_recent
        if not live:
            if local or extra:
                rec["actions"].append("kill_procs")
            if terms_here:
                rec["actions"].append("close_terminals")
            # settle.sh needs a dispatch id. Without one there is nothing to settle with, and
            # the worktree is kept: the processes still die, the evidence stays.
            if disp:
                rec["actions"].append("settle")
            else:
                rec["actions"].append("keep(no-dispatch)")
            # The processes die either way; only the worktree decision differs, and that one
            # belongs to settle.sh (it refuses when there is no settlement or merged PR).
            rec["keep_worktree"] = True
        out["managed"].append(rec)

    # Every managed worktree that is not live and has no dispatch: killed processes, kept
# worktree. Named here so the daily report cannot let them accumulate unnoticed.
    out["no_dispatch"] = sorted(m["worktree"] for m in out["managed"]
                                if not m["live"] and not m["dispatch"])


    # INVARIANT: every opencode tree in a managed worktree belongs to a live dispatch, and no
    # process is left in a managed worktree that is not live.
    for t in trees:
        n = t["worktree"]
        if not n:
            continue
        mine = [m for m in out["managed"] if m["worktree"] == n]
        if not mine:
            continue  # unmanaged: not this pass's business
        if not mine[0]["live"] and not mine[0].get("starting_recent"):
            out["violations"].append(
                "managed worktree %s is NOT live but still has opencode root %s (%s MB)"
                % (n, t["root_pid"], t["mb"]))
    for m in out["managed"]:
        if (not m["live"] and not m.get("starting_recent") and (m["opencode_roots"] or m["other_procs"] or m["terminals"])):
            out["violations"].append(
                "non-live managed worktree %s holds %d opencode root(s), %d other process(es), %d terminal(s)"
                % (m["worktree"], len(m["opencode_roots"]), len(m["other_procs"]), len(m["terminals"])))

    out["invariant_ok"] = not out["violations"]
    if execute:
        out["executed"] = do_actions(out, run)
    return out


def do_actions(plan, run):
    """Kill processes, close terminals, then hand the worktree to settle.sh."""
    done = []
    for m in plan["managed"]:
        if m["live"] or not m["actions"]:
            continue
        for t in m["opencode_roots"]:
            for pid in [t["root_pid"]] + [p for p in t["pids"] if p != t["root_pid"]]:
                subprocess.run(["taskkill", "-T", "-F", "-PID", str(pid)],
                               capture_output=True)
            alive = _alive(t["root_pid"])
            done.append({"worktree": m["worktree"], "killed_root": t["root_pid"],
                         "mb": t["mb"], "still_alive": alive})
        for p in m["other_procs"]:
            subprocess.run(["taskkill", "-T", "-F", "-PID", str(p["pid"])], capture_output=True)
            done.append({"worktree": m["worktree"], "killed_pid": p["pid"], "name": p["name"]})
        for h in m["terminals"]:
            orca("terminal", "close", "--terminal", h, "--json")
        if m["dispatch"]:
            cp = subprocess.run(["bash", os.path.join(os.path.dirname(HERE), "settle.sh"),
                                 m["dispatch"]], capture_output=True, timeout=600)
            txt = (cp.stdout or b"").decode("utf-8", errors="replace")
            keep = "REFUSED" in txt or "KEEPING" in txt
            done.append({"worktree": m["worktree"], "dispatch": m["dispatch"],
                         "settle": "kept-as-evidence" if keep else
                                   ("done" if "DONE" in txt else "failed"),
                         "tail": txt[-400:]})
    try:
        os.makedirs(os.path.dirname(KILL_LOG), exist_ok=True)
        with open(KILL_LOG, "a", encoding="utf-8") as fh:
            for d in done:
                fh.write(json.dumps(d, ensure_ascii=False) + "\n")
    except OSError:
        pass
    return done


def _alive(pid):
    cp = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                         "if (Get-Process -Id %s -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }" % pid],
                        capture_output=True)
    return (cp.stdout or b"").decode("utf-8", errors="replace").strip() == "yes"


def main(argv):
    run, as_json, execute, backfill, only = "", False, False, False, []
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--run" and i + 1 < len(argv):
            run = argv[i + 1]
            i += 2
            continue
        if a == "--only" and i + 1 < len(argv):
            # A targeted pass. Used to break a deadlock on capacity that the full pass
            # would itself free, and to prove one path against real data.
            only = [x for x in argv[i + 1].split(",") if x]
            i += 2
            continue
        if a == "--json":
            as_json = True
        elif a == "--execute":
            execute = True
        elif a == "--backfill":
            backfill = True
        else:
            print("reconcile: unknown argument %s" % a, file=sys.stderr)
            return 2
        i += 1
    try:
        plan = build(run, execute, backfill, only)
    except Exception as exc:
        print("reconcile: could not read the process table: %r" % (exc,), file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps(plan, ensure_ascii=False))
    else:
        print("reconcile %s  managed=%d unmanaged=%d live=%d invariant=%s ignored=%d no_dispatch=%s"
              % (plan["at"], len(plan["managed"]), len(plan["unmanaged"]),
                 len(plan["live_handles"]), "OK" if plan["invariant_ok"] else "VIOLATED",
                 len(plan.get("ignored") or []),
          ",".join(plan.get("no_dispatch") or []) or "-"))
        for m in plan["managed"]:
            print("  %-24s live=%-5s actions=%s" % (m["worktree"], m["live"],
                                                    ",".join(m["actions"]) or "-"))
        for v in plan["violations"]:
            print("  VIOLATION %s" % v)
        for u in plan["unmanaged"]:
            print("  UNMANAGED %s (%s)" % (u["worktree"], u["reason"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
