#!/usr/bin/env python3
"""dsv RAM sampler — stopgap A5 of the coordinator brief.

Writes one CSV row per opencode process TREE every 15 s:
    timestamp,available_mb,tree_pid,tree_worktree,tree_mb

available_mb uses the same metric as D:/code/orca-supervisor/src/capacity.js
(os.freemem(), which capacity.js documents as matching Win32_PerfFormattedData
AvailableMBytes within 7 MB) -- read here through GlobalMemoryStatusEx so the
sampler spawns no node process of its own.

Never writes inside a repo: everything lands in dsv-ram/ under LOCALAPPDATA/Temp.
Memory-full / timeout events are appended to events.csv beside the daily file.
"""
import base64
import csv
import ctypes
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

OUT_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "Temp", "dsv-ram")
INTERVAL_S = 15
TREE_ROOT_NAME = "opencode.exe"


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def available_mb():
    st = MEMORYSTATUSEX()
    st.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st)):
        raise OSError("GlobalMemoryStatusEx failed")
    return int(st.ullAvailPhys // (1024 * 1024))


PS_DUMP = (
    "Get-CimInstance Win32_Process | "
    "Select-Object ProcessId,ParentProcessId,Name,WorkingSetSize,CommandLine | "
    "ConvertTo-Json -Compress -Depth 2"
)


def processes():
    """Every process as dicts. Raises on a non-zero exit so a failure is loud.

    Decoded with errors="replace": a process CommandLine on this host carries
    CP1254 bytes (0xfa seen live), and a strict utf-8 decode returns no output at
    all -- which is how the first version failed silently into stdout=None.
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
    """Orca's terminal shell gets its shell-integration script through
    `-EncodedCommand <base64 UTF-16LE>`, and that script ends with
    `Set-Location -LiteralPath '<the worktree>'`. So the worktree a worker runs in
    is recoverable from its terminal's command line even though opencode's own
    command line never names it.
    """
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
        for marker, sep in (("workspaces\\design-system-viewer\\", "\\"),
                            ("workspaces/design-system-viewer/", "/")):
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
    procs = processes()
    by_pid = {}
    children = {}
    for p in procs:
        try:
            pid = int(p.get("ProcessId"))
            ppid = int(p.get("ParentProcessId") or 0)
        except (TypeError, ValueError):
            continue
        ws = int(p.get("WorkingSetSize") or 0)
        by_pid[pid] = {"pid": pid, "ppid": ppid, "name": p.get("Name") or "",
                       "ws": ws, "cmd": p.get("CommandLine") or ""}
        children.setdefault(ppid, []).append(pid)

    def tree(pid):
        out, stack = [], [pid]
        while stack:
            cur = stack.pop()
            node = by_pid.get(cur)
            if node:
                out.append(node)
            stack.extend(children.get(cur, []))
        return out

    rows = []
    for node in by_pid.values():
        if node["name"].lower() != TREE_ROOT_NAME:
            continue
        # A worker is TWO opencode.exe processes: a ~3 MB launcher and the TUI it
        # spawns as its child. Counting every opencode.exe as a root therefore
        # reports each worker twice (measured: 200.7/200.3 and 548.4/545.6 MB
        # pairs). Only a root with no opencode.exe ancestor is a worker.
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
            "tree_pid": node["pid"],
            "tree_worktree": worktree_of(node["cmd"], blob, *ancestor_texts(node, by_pid)),
            "tree_mb": round(sum(n["ws"] for n in nodes) / (1024 * 1024), 1),
        })
    return rows


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    day = datetime.now().strftime("%Y-%m-%d")
    path = os.path.join(OUT_DIR, f"{day}.csv")
    events = os.path.join(OUT_DIR, "events.csv")
    new = not os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        if new:
            w.writerow(["timestamp", "available_mb", "tree_pid", "tree_worktree", "tree_mb"])
        while True:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            try:
                avail = available_mb()
                rows = snapshot()
            except Exception as exc:  # loud, never silent
                with open(events, "a", newline="", encoding="utf-8") as ef:
                    csv.writer(ef).writerow([ts, "sampler_error", repr(exc)[:200]])
                fh.flush()
                time.sleep(INTERVAL_S)
                continue
            if rows:
                for r in rows:
                    w.writerow([ts, avail, r["tree_pid"], r["tree_worktree"], r["tree_mb"]])
            else:
                w.writerow([ts, avail, "", "", ""])
            fh.flush()
            time.sleep(INTERVAL_S)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
