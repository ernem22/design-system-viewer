#!/usr/bin/env bash
# Resolve this repository's Orca repo id at runtime.
#
#   . "$HERE/repo-id.sh"          # sets REPO_ID, or exits non-zero with a message
#
# Why a lookup and not a constant: Orca mints a repo id when a folder is added to
# Orca, so re-importing that folder mints a new one. The constant this replaces
# (`294b7f02-d29f-464f-a65c-f6929e0b8ae2`, in spawn.sh, reap.sh and start.sh) went
# stale exactly that way on 2026-09-27, when the folder was re-imported and Orca
# began reporting `9e918a40-bf6d-4981-9a8d-2a28e66d2586` for it. Every dispatch
# then failed with `repo_not_found`, which spawn.sh parsed into an empty PATH — a
# silent "could not create the worktree" that cost a whole run to find.
#
# The match is by `path`, against the ROOT checkout. The root is resolved from git
# (`--git-common-dir` is shared by every worktree of a repo, so this script works
# from a child worktree as well as from the coordinator checkout) and normalised
# for slashes and case. Zero matches and more than one match are BOTH hard errors:
# picking one of several would create a worktree in the wrong repository.
#
# ORCA_REPO_ID, when exported, is an explicit operator override and skips the
# lookup. There is deliberately no built-in default value.

orca_root_checkout() {
  local common
  common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 1
  [ -n "$common" ] || return 1
  dirname "$common"
}

orca_repo_id_for_path() {
  local want="$1" json
  json="$(orca repo list --json </dev/null 2>/dev/null)" || return 1
  [ -n "$json" ] || return 1
  # The want path is passed as an argument rather than interpolated, so a path
  # containing quotes or spaces cannot break out of the program text.
  printf '%s' "$json" | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  const want = process.argv[1];
  let repos;
  try { repos = ((JSON.parse(s).result || {}).repos) || []; }
  catch (e) { console.error("repo-id.sh: could not parse `orca repo list --json`"); process.exit(3); }
  const norm = p => String(p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const hits = repos.filter(r => norm(r.path) === want);
  if (hits.length !== 1) {
    console.error("repo-id.sh: expected exactly 1 Orca repo with path " + want + ", found " + hits.length);
    process.exit(4);
  }
  console.log(hits[0].id);
});
' "$want"
}

if [ -n "${ORCA_REPO_ID:-}" ]; then
  REPO_ID="$ORCA_REPO_ID"
else
  _repo_id_root="$(orca_root_checkout)" || { echo "repo-id.sh: not inside a git checkout" >&2; exit 2; }
  _repo_id_want="$(printf '%s' "$_repo_id_root" | tr '\\' '/' | tr '[:upper:]' '[:lower:]' | sed -E 's#/+#/#g; s#/+$##')"
  REPO_ID="$(orca_repo_id_for_path "$_repo_id_want")" || {
    echo "repo-id.sh: no unambiguous Orca repo for $_repo_id_want." >&2
    echo "  Add the folder in Orca (or fix the registered path), or set ORCA_REPO_ID" >&2
    echo "  to the id this prints for it:  orca repo list --json" >&2
    exit 2
  }
  unset _repo_id_root _repo_id_want
fi
