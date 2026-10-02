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


# The process table and the worktree resolution live in lib/opencode_trees.py, which
# settle.sh and supervise.sh also call. One implementation: a second copy would drift, and
# the copy that drifted would resolve no worktree - which reads as "nothing to kill".
from opencode_trees import snapshot  # noqa: E402  (same directory, imported by path)


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
