#!/usr/bin/env bash
# verdict-post probe. Offline by construction: every case runs verdict-post.sh with a stub `gh`
# first in PATH, so no case can reach GitHub - not even the ones that get past the payload gate
# and would otherwise do a real head lookup.
#
# Why this probe exists: on PR #163 a Tester posted
#   ```dsv-verdict / status: fail / role: tester / commit: e0f1d44 / build: index-CVUkIPe1.js
# - no observed:, no before: - and verdict-post.sh accepted it, because the evidence rule
# applied only to a PASS. A thin FAIL sailed through the tool whose whole job is to stop thin
# verdicts, and docs/orchestration/specs/tester.md printed the same thin shape as its example,
# so the shape was being taught rather than merely tolerated.
#
#   (A) thin FAIL, no observed/before        -> refused, and the refusal NAMES the fields
#   (B) thin PASS, no observed/before        -> refused, names them
#   (C) complete inline payload              -> past the payload gate (stops at the head check)
#   (D) reviewer with no scope_ok            -> refused
#   (E) settlement missing observed/before   -> refused, names them
#   (F) settlement carrying them             -> past the payload gate
#
# Exits non-zero if any case is not PASS.
#
# HERE must be a NATIVE path: bash, node and gh are native binaries here and do not translate
# /d/code into D:\code.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
STATE_DIR="${SUPERVISE_STATE:-${LOCALAPPDATA:-$HOME}/orca-orchestration/design-system-viewer/state}"
VP="$HERE/verdict-post.sh"
RESULT="$STATE_DIR/verdict-post-probe.result"
SETTLE_F="$STATE_DIR/verdict-post-probe.settlement"
STUB_DIR="${LOCALAPPDATA:-$HOME}/Temp/verdict-post-probe-stub"
# The stub directory must exist BEFORE its path is resolved: on a machine that has never run
# this probe, `cd` fails, STUB_PATH comes out empty, and the cases that clear the payload gate
# would fall through to the real gh. Created here, resolved on the next line.
mkdir -p "$STUB_DIR"
# MSYS-style path for PATH. A Windows-style "C:/..." entry is split at its drive colon, so the
# stub was silently skipped and the case reached the real gh (measured: with that form, `which
# gh` still answered /c/Program Files/GitHub CLI/gh and the case read a real, empty head).
STUB_PATH="$(cd "$STUB_DIR" 2>/dev/null && pwd)"
[ -n "$STUB_PATH" ] || { printf 'probe: could not resolve the stub directory %s\n' "$STUB_DIR"; exit 2; }

V_A=NOT_EXERCISED; V_B=NOT_EXERCISED; V_C=NOT_EXERCISED
V_D=NOT_EXERCISED; V_E=NOT_EXERCISED; V_F=NOT_EXERCISED

say() { printf 'probe: %s\n' "$*"; }
setv() {
  case "$1" in
    A) V_A="$2" ;; B) V_B="$2" ;; C) V_C="$2" ;;
    D) V_D="$2" ;; E) V_E="$2" ;; F) V_F="$2" ;;
  esac
  say "  ($1) $3 -> $2"
}

[ -f "$VP" ] || { say "verdict-post.sh not found at $VP"; exit 2; }

# The probe's own gh. It answers the head lookup with a head this verdict is NOT about, so a
# case that clears the payload gate stops at the head check: no network, and nothing posted.
mkdir -p "$STUB_DIR"
cat > "$STUB_DIR/gh" <<'STUB'
#!/usr/bin/env bash
# verdict-post probe stub: no case in this probe may reach GitHub.
case "$*" in
  *"pr view"*) printf 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111\n' ;;
  *) printf 'verdict-post probe stub gh: unexpected call: %s\n' "$*" >&2; exit 1 ;;
esac
STUB
chmod +x "$STUB_DIR/gh" 2>/dev/null

# judge <letter> <label> <expect: refused|past-gate> <substring|-> <args...>
judge() {
  local L="$1" label="$2" expect="$3" want="$4"; shift 4
  local out rc verdict=PASS why=""
  out="$(PATH="$STUB_PATH:$PATH" bash "$VP" "$@" 2>&1)"; rc=$?
  if [ "$expect" = refused ]; then
    [ "$rc" -ne 0 ] || { verdict=FAIL; why="exit 0, but a refusal was required"; }
    case "$out" in
      *"$want"*) ;;
      *) verdict=FAIL; why="the refusal did not name '$want' (got: $(printf '%s' "$out" | head -1))" ;;
    esac
  else
    # Past the payload gate: it must not be refused for missing fields, and it must be the
    # head check that stopped it - the stubbed head, never a real PR.
    case "$out" in
      *"missing:"*) verdict=FAIL; why="refused for missing fields: $(printf '%s' "$out" | head -1)" ;;
      *"is not the head"*) ;;
      *) verdict=FAIL; why="never reached the head check (got: $(printf '%s' "$out" | head -1))" ;;
    esac
  fi
  printf '%s\n' "$out" | head -2 | sed 's/^/       /'
  setv "$L" "$verdict" "$label${why:+ - $why}"
}

say "verdict-post probe: $(date -u +%Y-%m-%dT%H:%M:%SZ)  target=$VP"
say "gh is stubbed at $STUB_PATH/gh, so no case can reach GitHub"

# (A)/(B) the thin shape, in both directions
judge A "thin FAIL (no observed/before)" refused "missing: observed before" \
  --pr 999999 --role tester --status fail --commit deadbeef --build index-CVUkIPe1.js
judge B "thin PASS (no observed/before)" refused "missing: observed before" \
  --pr 999999 --role tester --status pass --commit deadbeef --build index-CVUkIPe1.js

# (C) the complete payload: the gate must let it through
judge C "complete payload" past-gate - \
  --pr 999999 --role tester --status pass --commit deadbeef --build index-CVUkIPe1.js \
  --observed "clicked Clear -> 3 items removed" --before "clicked Clear -> 0 items removed"

# (D) the reviewer rule is untouched
judge D "reviewer with no scope_ok" refused "scope-ok" \
  --pr 999999 --role reviewer --status pass --commit deadbeef

# (E)/(F) the same two readings through the path a worker actually uses
printf 'status: fail\nrole: tester\ncommit: deadbeef\nbuild: index-CVUkIPe1.js\n' > "$SETTLE_F"
judge E "settlement missing observed/before" refused "missing: observed before" \
  --pr 999999 --role tester --from-settlement "$SETTLE_F"
printf 'status: fail\nrole: tester\ncommit: deadbeef\nbuild: index-CVUkIPe1.js\nobserved: clicked Clear -> 3 items removed\nbefore: clicked Clear -> 0 items removed\nreason: the count stayed\n' > "$SETTLE_F"
judge F "settlement carrying them" past-gate - \
  --pr 999999 --role tester --from-settlement "$SETTLE_F"
rm -f "$SETTLE_F"

say ""
say "A=$V_A B=$V_B C=$V_C D=$V_D E=$V_E F=$V_F"
printf 'A=%s B=%s C=%s D=%s E=%s F=%s\n' "$V_A" "$V_B" "$V_C" "$V_D" "$V_E" "$V_F" > "$RESULT"

# A probe that prints FAIL and exits 0 is a probe nobody can trust from a shell script.
rc=0
for v in "$V_A" "$V_B" "$V_C" "$V_D" "$V_E" "$V_F"; do
  [ "$v" = PASS ] || rc=1
done
[ "$rc" -eq 0 ] || say "probe FAILED: at least one case is not PASS"
exit "$rc"
