# Archive: proteus-5 uncommitted work (worktree state of 2026-09-20)

> **Unreviewed edits from an old worktree. Kept for reference only. Not live.**
> Do **not** copy anything from this directory into `tools/orchestration/` or
> `docs/orchestration/specs/` without a review — these are somebody's unfinished edits, not a
> decision that they are correct.

## What this is

The Orca worktree `proteus-5` (branch `fix/shell-onto-pipeline-base`, HEAD `7831121`) held
uncommitted work when the worktree vanished from Orca's registry. Before anything else could happen
to that directory, its uncommitted state was copied out byte-for-byte; this directory is that copy.

The files are the **working-tree versions** — the edits applied on top of `7831121` — not the
committed state. Eight of the ten are modifications to tracked files; two (`await.sh`, `sweep.sh`)
are new files that were never committed anywhere.

Nothing here is wired into anything. No file in this pull request sits at a live path: the original
relative paths are reproduced *beneath this directory*, so the pipeline, the specs and the tooling
that read `tools/orchestration/` and `docs/orchestration/specs/` are untouched by this archive.

## Contents

| File | Origin | Kind |
|---|---|---|
| `docs/orchestration/specs/coder.md` | `docs/orchestration/specs/coder.md` | modified tracked |
| `docs/orchestration/specs/reviewer.md` | `docs/orchestration/specs/reviewer.md` | modified tracked |
| `docs/orchestration/specs/tester.md` | `docs/orchestration/specs/tester.md` | modified tracked |
| `tools/orchestration/close.sh` | `tools/orchestration/close.sh` | modified tracked |
| `tools/orchestration/reap.sh` | `tools/orchestration/reap.sh` | modified tracked |
| `tools/orchestration/spawn.sh` | `tools/orchestration/spawn.sh` | modified tracked |
| `tools/orchestration/start.sh` | `tools/orchestration/start.sh` | modified tracked |
| `tools/orchestration/watch.sh` | `tools/orchestration/watch.sh` | modified tracked |
| `tools/orchestration/await.sh` | `tools/orchestration/await.sh` | new, never committed |
| `tools/orchestration/sweep.sh` | `tools/orchestration/sweep.sh` | new, never committed |
| `status.txt` | — | raw `git status --porcelain=v1` of the source worktree |
| `tracked-changes.patch` | — | `git diff` of the eight modified tracked files |
| `hashes.txt` | — | sha256 of every source file and its copy |

## Provenance and verification

* Rescue copy and its full record: `D:/code/orca-supervisor/evidence/proteus-5-rescue/`
  (`README.txt` describes the method; `scripts/rescue_copy.py` re-runs it read-only).
* `status.txt` — 29 entries: **8 modified tracked files, 19 `.hermes-tmp.*` scratch directories,
  2 new untracked files**. The scratch directories were deliberately **not** copied (they are
  disposable scratch, listed by name and size in the rescue `README.txt` only).
* `tracked-changes.patch` — 8 files changed, 189 insertions, 27 deletions.
* `hashes.txt` — each source file and its copy hashed separately; all pairs matched.
* At the moment this archive was created, every one of the ten payload files and the three metadata
  files was re-verified byte-identical to the rescue copy (10/10 and 3/3 `MATCH`, sha256).

## Why it is inert

* The paths live under `docs/orchestration/archive/proteus-5-2026-09-20/` and nowhere else.
* No CI workflow reads this directory, and none of these files is executable as part of the pipeline:
  the shell scripts here are data, not hooks.
* If any of it turns out to be worth keeping, the change belongs in its own reviewed pull request
  against the live path — with the diff read first, not copied from here.
