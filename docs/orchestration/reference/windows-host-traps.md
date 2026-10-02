# Windows host traps

Every entry below cost real time on this host (Windows 11, git-bash/MSYS shell, MSYS path
conversion disabled). Each one is written as: what happens, the evidence, and the form that
works. Scripts in `tools/orchestration/` should avoid all of them by construction.

## 1. A native binary cannot read an MSYS path

`gh`, `node`, `git` and `python` are native Windows binaries. `mktemp` hands back
`/tmp/dsv-verdict.XXXXXX`, and `gh pr comment --body-file /tmp/...` fails with no useful
message because the binary cannot resolve it.

**Evidence:** `verdict-post.sh`'s first version refused with `could not post the verdict
comment on PR #138` while the file existed and was readable from the shell.

**Works:** resolve a native path before handing it over.

```bash
mktemp "$(cd "${TMPDIR:-/tmp}" >/dev/null 2>&1 && { pwd -W 2>/dev/null || pwd; })/name.XXXXXX"
```

## 2. `taskkill //F //PID` is a silent no-op

The doubled-slash form MSYS documentation suggests does nothing here and reports success.

**Works:** `taskkill -F -PID <pid>`, and `taskkill -F -T -PID <pid>` to take the tree.

**Evidence:** an orphaned `check --wait` child survived a `//F` kill for minutes; the `-F`
form removed it.

## 3. A PowerShell filter matches its own command line

`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*watchd.sh*' }` matches
the PowerShell process running that very filter, so it kills itself mid-command.

**Evidence:** a cleanup command returned an empty output and exit code `4294967295`.

**Works:** exclude the current process (`$_.ProcessId -ne $PID`) and never let the pattern
appear literally in the command you are running.

## 4. `$(printf 'x\n')` eats the trailing newline

Command substitution strips trailing newlines, so a body assembled by concatenating them
glues every line onto one:

```
```dsv-verdictstatus: passrole: testercommit: 2fd0a69
```

No parser can read that. **Works:** write into a file with a single `{ ... } > "$FILE"`
block, then prove the first line is byte-exact (`grep -qxF`).

**Evidence:** the first `verdict-post.sh` posted two such comments on PR #138 before its own
read-back refused them.

## 5. `gh` converts LF to CRLF when it reads a file

A body written with LF arrives with CRLF, so an anchored regex over the stored text fails on
the trailing `\r`.

**Evidence:** `/^role:\s*([a-z]+)$/m` matched nothing against a comment whose line was
`role: tester`; `/^role:\s*([a-z]+)\s*$/m` matched.

**Works:** always allow trailing whitespace (`\s*$`) or split on `/\r?\n/`.

## 6. `cut -f1` over a multi-line payload splits per line

`cut` works line by line, so `cut -d'|' -f1` on `1|present|<body with newlines>` returns the
body as well as the count.

**Evidence:** `verdict-post.sh`'s read-back compared the comment body to the string
`present`, and refused a write that had actually succeeded.

**Works:** put the scalar fields on the first line and parse with `head -1`, then take the
rest with `tail -n +2`.

## 7. `tail` on the RAM sampler misleads

`dsv-ram/<date>.csv` writes one row per worker per sample. `tail -2` therefore shows two of
the three workers and looks exactly like "one worker died".

**Evidence:** twice in one session the coordinator reported a vanished worker from a
`tail -2`; counting rows by pid showed 179/190 and 20/20 presence.

**Works:** query by pid, never by tail.

## 8. The patch tool mangles regex escapes

A patch whose old/new string contains `\r?\n` can be written back with a REAL newline in its
place, turning a regex literal into an unterminated one:

```
const STRICT = /```dsv-verdict[ \t]*
?\n([\s\S]*?)```/;          ->  SyntaxError: Invalid regular expression: missing /
```

**Evidence:** `gate-logic.cjs` failed to load after the allowlist edit; `node -e
"require('./tools/orchestration/gate-logic.cjs')"` reported the syntax error at the `STRICT`
line.

**Works:** for any line containing backslash escapes, do the edit with a targeted script
(read, `indexOf`, splice, write) instead of the patch tool, and verify by loading the module.
Never trust a patch on an escaped line without a load check.

## 9. `NODE_ENV=production` is inherited by the shell

`npm ci` then skips devDependencies (exit 0, no `node_modules/.bin`), and the production React
build exports no `act`, so DOM tests die with `act is not a function`.

**Works:** `npm ci --include=dev`, and run tests with `NODE_ENV=test`.

## 10. `terminal(background=true)` evaluates the command twice

A single background launch can produce two instances of the command, which is why every
long-lived tool here needs a single-instance lock.

**Evidence:** two watchers ran at once and announced every settlement twice; a duplicate
sampler wrote each row twice.

**Works:** an atomic lock (a directory holding the owner's pid), and a refusal — not a
second start — when the lock is held by a live process.

## 11. Reading a delivery marks it read

`orca orchestration check --json` marks messages read without acknowledging them. Read a
settlement and never ack it, and no later source can find it: the queue no longer returns it
and no watcher logged it.

**Evidence:** reviewer-136b's settlement was read this way and was unrecoverable from every
tooling source.

**Works:** persist the settlement to a durable file **before** acking, and record the ack
state in that file.

## 12. `du -sh` over a large Windows tree can time out

MSYS `du` on a big tree can exceed the tool timeout and print nothing.

**Works:** PowerShell, e.g.
`Get-ChildItem -Recurse -File | Measure-Object Length -Sum`.

## 13. A `C:\...` path on PATH is split at the drive colon

`PATH="C:\Users\x\bin:$PATH"` puts a two-piece entry on PATH (`C` and `\Users\x\bin`), so a
shimmed binary there is never found. Worse, the failure is silent when the caller has a fallback:
a probe that shims `orca` this way ran the REAL CLI and reported on the wrong system.

**Evidence:** `probes/settle-preview.probe.sh` answered "no dispatch ctx_probe in run run_probe"
— settle.sh had called the real `orca`, which knew no such dispatch.

**Works:** `cygpath -u` for anything that goes on PATH or is read by a bash builtin; the native
`C:/...` form for anything a Windows process must read (a node script reading a file).

## 14. `grep` reads a leading dash as an option, and `[...]` as a character class

`grep -q '-> EXITED'` fails with "unknown option -- >", and `grep -q '[dispatched]'` matches any
single character from that set instead of the literal text — so an assertion can pass or fail for
a reason that has nothing to do with what it is checking.

**Works:** `grep -q -- '-> EXITED'` for a leading dash, `grep -qF` for literal text (this also
removes every regex-escape question).

## 15. Never edit a script that a running bash is reading

bash re-reads a loop body as it iterates, so editing a long-running script in place can make the
running instance execute garbage. `supervise.sh` and `watch-settlements.sh` run for hours from
the root checkout — the same path a coordinator edits.

**Measured 2026-10-02:** three `supervise.sh` instances were live in the root worktree while its
`supervise.sh` was edited.

**Works:** commit the fix on a branch, and leave the root worktree on the branch the long-running
watchers were started from.
