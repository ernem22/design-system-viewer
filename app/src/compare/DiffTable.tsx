import { useMemo, useState } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { categorize } from "../../../src/core/taxonomy.js";
import { cssValueEq } from "../lib/cssValueEq.ts";
import { systemTokenMap } from "../systems/store.ts";
import type { DesignSystem } from "../systems/store.ts";

/* CSS-wide keywords the parser accepts as valid `color` values but which are
   not colors to paint a swatch with. happy-dom is also laxer than a browser
   (`none` is accepted there), so this keeps both sides honest. */
const NON_COLOR_KEYWORDS = new Set([
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "auto",
  "normal",
]);

let colorProbe: HTMLSpanElement | null | undefined;

/** A value is a color only when the CSS parser accepts it for `color`.
   A text regex (`/^[a-z]+$/i`) cannot separate a keyword like `bold` or a
   family like `Inter` from `red`; the parser can. It normalizes the value,
   so `#FFF`, `currentColor` and `var(--x)` all survive the round-trip. */
function isColor(v: string): boolean {
  const value = v.trim();
  if (!value || NON_COLOR_KEYWORDS.has(value.toLowerCase())) return false;
  if (colorProbe === undefined) {
    colorProbe = typeof document === "undefined" ? null : document.createElement("span");
  }
  if (!colorProbe) return false;
  colorProbe.style.color = "";
  colorProbe.style.color = value;
  return colorProbe.style.color !== "";
}

/* A token value that is exactly a `var()` reference, with an optional
   fallback: `var(--x)` or `var(--x, #fff)`. */
const VAR_REF = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]*))?\)$/;

/** Resolve `var(--x)` / `var(--x, fallback)` against a single column's own
   value map (issue #323): a swatch must use what the token means in *that*
   system, not whatever `:root` happens to hold. Up to 8 hops; a repeated
   name is a cycle and stops the walk. Returns the final string (possibly an
   unresolved var reference) or null when the reference has no definition. */
function resolveRef(value: string, map: Map<string, string>): string | null {
  let current = value.trim();
  const seen = new Set<string>();
  for (let hops = 0; hops < 8; hops++) {
    const m = current.match(VAR_REF);
    if (!m) break;
    const name = m[1];
    if (seen.has(name)) break;
    seen.add(name);
    const next = map.get(name) ?? (m[2] != null ? m[2].trim() : undefined);
    if (next == null) return null;
    current = next;
  }
  return current;
}

/** The colour a chip should paint for `value` in this column, or null when
   the cell shows no swatch. A plain colour resolves to itself; a `var()`
   reference walks the column's own map first, falling back to the authored
   text when it cannot be resolved (the old behaviour chipped an unresolved
   `var()` because the CSS parser accepts it syntactically). */
function chipColor(value: string, map: Map<string, string>): string | null {
  const resolved = resolveRef(value, map) ?? value.trim();
  return isColor(resolved) ? resolved : null;
}

type RowKind = "same" | "different" | "missing" | "different-missing" | "not-in-reference";
type Filter = "different" | "missing" | "all";

interface DiffRow {
  name: string;
  vals: (string | undefined)[];
  kind: RowKind;
  /** Non-reference systems disagree with the reference. Independent of
      `hasMissing`: a row can be both. */
  differs: boolean;
  /** At least one system lacks the token (including the reference). */
  hasMissing: boolean;
  /** The first column (the reference) defines this token. */
  inReference: boolean;
  categories: string[];
}

interface DiffSection {
  label: string;
  rows: DiffRow[];
}

/** Full token-diff table across every category, for the systems picked as
   compare columns. Ported from preview/src/compare.jsx's DiffTable. */
export function DiffTable({ cols }: { cols: DesignSystem[] }) {
  const [filter, setFilter] = useState<Filter>("different");

  /* One value map per column, from the same helper every other reader uses
     (css then groups), so the diff cannot disagree with the column or the
     Tokens view. A token can sit under a different `g.label` in each system:
     union every label (first-seen order) instead of letting the first
     system's label win. Tokens authored only in `css` get their label from
     the taxonomy, so they still appear under a sensible category. */
  const { catOrder, byCat, valueMaps, categories } = useMemo(() => {
    const catOrder: string[] = [];
    const byCat = new Map<string, Set<string>>();
    const categories = new Map<string, string[]>();
    const valueMaps = cols.map((s) => systemTokenMap(s));
    for (const s of cols) {
      for (const g of s.groups ?? []) {
        for (const t of g.tokens) {
          const labels = categories.get(t.name);
          if (!labels) categories.set(t.name, [g.label]);
          else if (!labels.includes(g.label)) labels.push(g.label);
        }
      }
    }
    for (let i = 0; i < cols.length; i++) {
      for (const name of valueMaps[i].keys()) {
        if (categories.has(name)) continue;
        const [hit] = categorize([{ name, value: "" }]) as { label?: string }[];
        categories.set(name, [hit?.label ?? "Other"]);
      }
    }
    for (const [name, labels] of categories) {
      const primary = labels[0];
      if (!byCat.has(primary)) {
        byCat.set(primary, new Set());
        catOrder.push(primary);
      }
      byCat.get(primary)?.add(name);
    }
    return { catOrder, byCat, valueMaps, categories };
  }, [cols]);

  let different = 0;
  let missing = 0;
  let same = 0;
  let total = 0;
  const sections: DiffSection[] = catOrder
    .map((label) => {
      const names = [...(byCat.get(label) ?? [])].sort();
      const rows = names
        .map((name) => {
          const vals = valueMaps.map((m) => m.get(name));
          // The reference is the first column, explicitly — not "the first
          // system that happens to define the token". Every non-reference
          // cell is compared against it, so a token the reference lacks is
          // *not* a difference (there is nothing to differ from); it is a
          // missing token and gets its own label instead.
          const refVal = vals[0];
          const inReference = refVal != null;
          const hasMissing = vals.some((v) => v == null);
          // Issue #323 / T12: `differs` and `hasMissing` are independent, not
          // exclusive. A row where a non-reference system disagrees with the
          // reference AND another system lacks the token is both a difference
          // and a missing token, so it must surface under the default
          // "Different" filter too. Run after notation normalisation
          // (`cssValueEq`): values CSS treats as equal (`.5rem` vs `0.5rem`)
          // are the same token value. Cells still render `v` as authored.
          const differs =
            inReference &&
            vals.some((v, i) => i > 0 && v != null && !cssValueEq(v, refVal));
          let kind: RowKind;
          if (!inReference) kind = "not-in-reference";
          else if (differs && hasMissing) kind = "different-missing";
          else if (differs) kind = "different";
          else if (hasMissing) kind = "missing";
          else kind = "same";
          total++;
          if (differs) different++;
          if (hasMissing) missing++;
          if (kind === "same") same++;
          return {
            name,
            vals,
            kind,
            differs,
            hasMissing,
            inReference,
            categories: categories.get(name) ?? [],
          };
        })
        .filter(
          (r) =>
            filter === "all" ||
            (filter === "different" ? r.differs : r.hasMissing),
        );
      return rows.length ? { label, rows } : null;
    })
    .filter((s): s is DiffSection => s != null);

  return (
    <div className="cmp-diff">
      <div className="cmp-diff-bar">
        <div className="cmp-diff-stats">
          <span className="cmp-stat">
            <b>{total}</b> tokens
          </span>
          <span className="cmp-stat-sep" aria-hidden="true">·</span>
          <span className="cmp-stat cmp-stat-diff">
            <b>{different}</b> different
          </span>
          <span className="cmp-stat-sep" aria-hidden="true">·</span>
          <span className="cmp-stat cmp-stat-missing">
            <b>{missing}</b> missing
          </span>
          <span className="cmp-stat-sep" aria-hidden="true">·</span>
          <span className="cmp-stat cmp-stat-same">
            <b>{same}</b> same
          </span>
        </div>
        {/* Issue #323: the "only differences" checkbox could not express the
            new missing/different split, so it is a three-way segmented
            control named "Show", defaulting to Different. */}
        <ToggleGroup.Root
          type="single"
          aria-label="Show"
          value={filter}
          onValueChange={(v) => {
            if (v === "different" || v === "missing" || v === "all") setFilter(v);
          }}
          className="cmp-seg"
        >
          <ToggleGroup.Item value="different">Different</ToggleGroup.Item>
          <ToggleGroup.Item value="missing">Missing</ToggleGroup.Item>
          <ToggleGroup.Item value="all">All</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
      <table className="cmp-diff-table">
        <thead>
          <tr>
            <th scope="col">token</th>
            {cols.map((s, i) => (
              <th key={s.slug} scope="col">
                {s.name}
                {i === 0 && <span className="cmp-diff-ref">Reference</span>}
              </th>
            ))}
          </tr>
        </thead>
        {sections.map(({ label, rows }) => (
          /* One tbody per category (issue #279): each category is its own
             content-visibility unit, with the category row first in it. */
          <tbody key={label}>
            <tr className="cmp-diff-cat">
              <th colSpan={cols.length + 1} scope="rowgroup">
                {label}
              </th>
            </tr>
            {rows.map(({ name, vals, kind, differs, inReference, categories: cats }) => (
              <tr key={name} className={kind === "same" ? "" : "is-diff"}>
                <td className="cmp-diff-name">
                  {name}
                  {!inReference && <span className="cmp-diff-not-ref">not in reference</span>}
                  {cats.length > 1 && (
                    <span
                      className="dsv-muted"
                      style={{ marginLeft: "var(--space-2)", fontSize: "var(--font-size-xs)" }}
                      title={cats.join(" · ")}
                    >
                      {cats.join(" · ")}
                    </span>
                  )}
                </td>
                {vals.map((v, i) => {
                  // Issue #323: mark *which* system differs. The first column
                  // is the reference and is never marked; a non-reference cell
                  // that differs from the reference is `is-changed`; a missing
                  // cell is `is-missing` (a row can carry both cues). When the
                  // reference itself lacks the token nothing is "changed".
                  const changed =
                    differs && i > 0 && v != null && !cssValueEq(v, vals[0] ?? "");
                  const className = `cmp-diff-val${v == null ? " is-missing" : ""}${changed ? " is-changed" : ""}`;
                  const chip = v == null ? null : chipColor(v, valueMaps[i]);
                  return (
                    <td key={i} className={className}>
                      {v == null ? (
                        <span className="cmp-diff-missing">—</span>
                      ) : (
                        <span className="cmp-diff-cell">
                          {chip && <span className="cmp-diff-chip" style={{ background: chip }} />}
                          <code spellCheck={false}>{v}</code>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      {!sections.length && (
        <p className="dsv-muted" style={{ padding: "var(--space-4)" }}>
          {filter === "different"
            ? "No differences — selected systems match on these tokens."
            : filter === "missing"
              ? "No missing tokens — every selected system defines every token."
              : "No tokens in the selected systems."}
        </p>
      )}
    </div>
  );
}