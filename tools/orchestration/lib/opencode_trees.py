#!/usr/bin/env python3
"""opencode process TREES and the worktree each one belongs to.

One implementation, two callers: lib/sampler.py samples these trees every 15 s, and
settle.sh asks for the trees of a specific worktree before it closes a terminal, so it can
prove they are gone afterwards.

Why this exists as a module rather than a copy: opencode's own command line never names its
worktree. The worktree is only recoverable from the terminal's shell-integration script, which
Orca passes as `-EncodedCommand <base64 UTF-16LE>` and which ends with
`Set-Location -LiteralPath '<the worktree>'`. Two copies of that decode would drift, and the
one that drifted would silently resolve no worktree at all - which reads as "nothing to kill".

CLI (used by the shell scripts):
    opencode_trees.py --worktree <name> [--json]   roots whose worktree == <name>
    opencode_trees.py --orphans [--json]           roots whose worktree is gone from disk
    opencode_trees.py --all [--json]               every root (measurement)
Exit 0 on success, 2 on an unreadable process table.
"""
import base64
import json
import os
import re
import subprocess
import sys

TREE_ROOT_NAME = "opencode.exe"
WS_ROOT = os.environ.get("DSV_WORKSPACES",
                         r"C:\Users\zurza\orca\workspaces\design-system-viewer")

PS_DUMP = (
    "Get-CimInstance Win32_Process | "
    "Select-Object ProcessId,ParentProcessId,Name,WorkingSetSize,CommandLine | "
    "ConvertTo-Json -Compress -Depth 2"
)


def processes():
    """Every process as dicts. Raises on a non-zero exit so a failure is loud.

    Decoded with errors="replace": a process CommandLine on this host carries CP1254 bytes
    (0xfa seen live), and a strict utf-8 decode returns no output at all - which is how the
    first version failed silently into stdout=None.
    """
    cp = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", PS_DUMP],
        capture_output=True, timeout=90,
    )
    if cp.returncode != 0:
        err = (cp.stderr or b"").decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"powershell exit {cp.returncode}: {err[:200]}")
    raw = (cp.stdout or b"").decode("utf-8", errors="replace").strip()
    if not raw:
        raise RuntimeError("powershell produced no output")
    data = json.loads(raw)
    return data if isinstance(data, list) else [data]


def decode_ps_blob(cmd):
    """The decoded -EncodedCommand payload of a process, or ''."""
    m = re.search(r"-EncodedCommand\s+([A-Za-z0-9+/=]+)", cmd or "")
    if not m:
        return ""
    try:
        return base64.b64decode(m.group(1)).decode("utf-16-le", errors="replace")
    except Exception:
        return ""


def worktree_of(*texts):
    """Best effort: a 'workspaces/design-system-viewer/<name>' path in any given text."""
    for text in texts:
        if not text:
            continue
        for marker in ("workspaces\\design-system-viewer\\", "workspaces/design-system-viewer/"):
            idx = text.find(marker)
            if idx < 0:
                continue
            rest = text[idx + len(marker):]
            name = ""
            for ch in rest:  # take the leading run, not a filtered copy: the decoded
                if ch.isalnum() or ch in "-_":  # script continues `' -ErrorAction Stop ...`
                    name += ch
                else:
                    break
            if name:
                return name
    return ""


def ancestor_texts(node, by_pid, hops=6):
    """Command lines of the ancestors, each plus its decoded EncodedCommand payload."""
    out, cur, i = [], node["ppid"], 0
    while cur and i < hops:
        up = by_pid.get(cur)
        if not up:
            break
        out.append(up["cmd"] or "")
        out.append(decode_ps_blob(up["cmd"]))
        cur = up["ppid"]
        i += 1
    return out


def snapshot():
    """Every opencode worker ROOT with its tree, worktree and RSS.

    A worker is TWO opencode.exe processes: a ~3 MB launcher and the TUI it spawns as its
    child. Counting every opencode.exe as a root therefore reports each worker twice
    (measured: 200.7/200.3 and 548.4/545.6 MB pairs). Only a root with no opencode.exe
    ancestor is a worker.
    """
    procs = processes()
    by_pid, children = {}, {}
    for p in procs:
        try:
            pid = int(p.get("ProcessId"))
            ppid = int(p.get("ParentProcessId") or 0)
        except (TypeError, ValueError):
            continue
        by_pid[pid] = {"pid": pid, "ppid": ppid, "name": p.get("Name") or "",
                       "ws": int(p.get("WorkingSetSize") or 0),
                       "cmd": p.get("CommandLine") or ""}
        children.setdefault(ppid, []).append(pid)

    def tree(pid):
        out, stack = [], [pid]
        while stack:
            cur = stack.pop()
            n = by_pid.get(cur)
            if n:
                out.append(n)
                stack.extend(children.get(cur, []))
        return out

    rows = []
    for node in by_pid.values():
        if node["name"].lower() != TREE_ROOT_NAME:
            continue
        anc, cur, hops = [], node["ppid"], 0
        while cur and hops < 8:
            up = by_pid.get(cur)
            if not up:
                break
            anc.append(up["name"].lower())
            cur = up["ppid"]
            hops += 1
        if TREE_ROOT_NAME[: -len(".exe")] in " ".join(anc):
            continue
        nodes = tree(node["pid"])
        blob = " ".join((n["cmd"] or "") for n in nodes)
        rows.append({
            "root_pid": node["pid"],
            "worktree": worktree_of(node["cmd"], blob, *ancestor_texts(node, by_pid)),
            "mb": round(sum(n["ws"] for n in nodes) / (1024 * 1024), 1),
            "pids": [n["pid"] for n in nodes],
            "names": sorted({n["name"] for n in nodes}),
        })
    return rows


def _select(rows, mode, worktree):
    if mode == "all":
        return rows
    if mode == "worktree":
        return [r for r in rows if r["worktree"] == worktree]
    if mode == "orphans":
        try:
            existing = set(os.listdir(WS_ROOT))
        except OSError:
            return []
        # Only a tree whose worktree is GONE. An unresolved worktree is NOT reaped: identity
        # must be proven before anything is killed, and "I could not tell" is not proof.
        return [r for r in rows if r["worktree"] and r["worktree"] not in existing]
    return []


def main(argv):
    mode, worktree, as_json = None, "", False
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--worktree" and i + 1 < len(argv):
            mode, worktree = "worktree", argv[i + 1]
            i += 2
            continue
        if a == "--orphans":
            mode = "orphans"
        elif a == "--all":
            mode = "all"
        elif a == "--json":
            as_json = True
        else:
            print("opencode-trees: unknown argument %s" % a, file=sys.stderr)
            return 2
        i += 1
    if not mode:
        print("opencode-trees: need --worktree <name>, --orphans or --all", file=sys.stderr)
        return 2
    try:
        rows = _select(snapshot(), mode, worktree)
    except Exception as exc:
        print("opencode-trees: could not read the process table: %r" % (exc,), file=sys.stderr)
        return 2
    if as_json:
        print(json.dumps({"ok": True, "mode": mode, "worktree": worktree, "roots": rows}))
    else:
        for r in rows:
            print("%d\t%s\t%s MB\t%s" % (r["root_pid"], r["worktree"] or "?", r["mb"],
                                         ",".join(str(p) for p in r["pids"])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
