# 2026-09-28 — Orca worker commit identity: rewrite + future-proofing

## Outcome
Agent commits on origin now attribute to real, linkable bot accounts instead of
`@localhost`/stale addresses. Six in-scope branch tips on origin were re-identified;
all other refs, the protected base, and GitHub signatures were left byte-identical.
Future worker commits get the right identity automatically (identity.env + identity.sh
+ spec/contract updates).

## Problem
Worker commits were authored as `orca-<role> <orca-<role>@localhost>` (no GitHub
account → no avatar), one commit as `pipeline-coder <pipeline@local>`, and seven
commits as `erne <erne@users.noreply.github.com>` — which GitHub resolves to a
**different account** (`erne`, id 878420) than the owner (`ernem22`, id 97901269).

## Design
One bot account per role (deliberate):
- coder    = `ernem22-coder`    (334651921)
- tester   = `ernem22-tester`   (334654881)
- reviewer = `ernem22-reviewer` (334659304, no seat — public read is implicit)
- fixer    = `ernem22-fixer`    (334656510)

Role is derived from the original author email (`orca-<role>@localhost`,
`pipeline@local` → tester) and, only for the ambiguous `erne@users…` address, from
the `[role]` subject tag (no tag → human).

## What was done
1. **Backup**: `ds-backup.git` mirror (20 branches) + `ds-backup.bundle` (`--all`,
   110 refs).
2. **Rewrite**: abandoned `git filter-repo` (see lesson) in favour of a targeted
   `git commit-tree` amendment of the **6 in-scope commits, all of which are branch
   tips**, preserving tree, parents, exact message bytes, and author/committer dates.
   Base head stayed `8a854ffc7d5bd5d638eaca8a276399ad72469460`.
3. **Push**: explicit 6-ref allowlist (no `--all`, no `--tags`):
   | branch | old | new | role |
   |---|---|---|---|
   | `ernem22/app-coder-9d668e` | `58ed195d` | `1930fa5f` | tester |
   | `ernem22/coder-2b` | `f67c9e17` | `0337d974` | coder |
   | `ernem22/coder-3` | `74091860` | `f2b0b250` | coder |
   | `ernem22/coder-4` | `5d883c4f` | `3f57c9ee` | coder |
   | `ernem22/coder-5` | `789c4ba2` | `7817a478` | coder |
   | `fix/shell-onto-pipeline-base` | `7831121a` | `5085f573` | human (noreply) |
4. **Phase 6 proof** (`gh api .../commits/<sha>`): each tip resolves to
   `ernem22-tester`, `ernem22-coder` (×4), and `ernem22` respectively.
5. **Future-proofing**: `tools/orchestration/identity.env` (accounts) +
   `tools/orchestration/identity.sh <role>` (sets `--worktree` identity, rejects any
   non-`users.noreply.github.com` email); `ORCHESTRATION.md` §Commit Attribution and
   `coder.md`/`fixer.md` DELIVERY updated.

## Lesson — `git filter-repo` strips GPG signatures and cascades
`git filter-repo` rewrites **every** commit it parses and drops the `gpgsig` header.
GitHub-signed web merges therefore changed hash even when the callback was a no-op,
cascading new SHAs into shared ancestry:
- with `--refs` (6 branches): base preserved but the 4 skip commits got new SHAs;
- without `--refs`: base head itself changed (`8a854ff` → `00a3d5de`).
Raw object diff proved the only change was the missing `gpgsig`.
Additionally, filter-repo's `--commit-callback` value is the **body** of a function
(not a `def`); `from module import f` / `exec(open(...).read())` silently no-op.

**Rule:** for identity-only fixes where the target commits are ref tips, amend with
`git commit-tree` instead of a history rewriter — it touches nothing else, so
signatures, ancestors, and protected refs are untouched. Always verify fidelity by
diffing raw commit objects with `author`/`committer` lines removed.

## Left intentionally untouched
- `refactor/full-react-migration` (protected; force-push disabled, admins enforced)
  and its 4 `[orchestrator]` `@localhost` commits.
- The 18 in-scope commits that live only on local, never-pushed branches, and the two
  local `safety/*` tags. They are not public; fixing them would require publishing
  branches, which we refused.
- Open PRs #126, #93, #92 — disjoint from the rewritten refs, zero disruption.

## Follow-ups
- Accept the pending `ernem22-fixer` write invitation (needed for future fixer pushes;
  none of the 6 tips were fixer-authored, so it was not a blocker).
- Optional `commit-msg` hook (role tag + reject `@localhost`) remains a Known Gap.

## Addendum — remaining identities LEFT UNFIXED ON PURPOSE (do not reopen)

A follow-up re-scan of the **remote** refs found two leftovers this change does not
fix. Both are deliberate cost/benefit calls, not oversights. Do not re-open either
without new information.

### 1. PR #92 (`ernem22/coder-27`, commit `994b970`) — leave as-is
Still authored/committed as `erne <erne@users.noreply.github.com>` (resolves to the
unrelated account `erne`, id 878420). It is a pre-existing **open PR with its own
accumulated review / CI / `pipeline/verdict` history**. Force-pushing it to fix a
cosmetic identity would reset that state for no functional gain. Excluded by design.

### 2. The four `[orchestrator]` `orca-coder@localhost` commits in
`refactor/full-react-migration` — leave as-is
They are ancestors of the protected base, so they surface on the base history and on
every branch descended from it. This is **not** a wrong-person misattribution — they
render as "no avatar," a neutral cosmetic gap. Fixing them would require rewriting
the protected base branch, temporarily disabling its protection
(`allow_force_pushes:false`, `enforce_admins:true` — the pipeline's actual merge
gate), and cascading the rewrite to all 20 branches, disrupting all four open PRs
(#129, #126, #93, #92). Cost wildly disproportionate to benefit. **The base and its
branch protection must not be touched under any circumstances.**

### Method note that caused the initial miss
The in-scope list was computed from the local repo's `git log --all`, which had not
yet fetched `origin/ernem22/tooling-guardrails`, so the `erne` commit on PR #129
(`b4b78431`) was missed and fixed later by a follow-up tip amend
(`b4b78431` → `1ec5dea5`, now `ernem22 <97901269+ernem22@users.noreply.github.com>`).
Lesson: enumerate **remote** refs (`git ls-remote`, or a freshly fetched
`refs/remotes/origin/*`), never a possibly-stale local `--all`.
