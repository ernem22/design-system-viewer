import { useMemo, useState } from "react";
import { lintTokens, parseTokens } from "../../../src/core/parse.js";
import { coverage } from "../../../src/core/schema.js";
import type { CoverageInfo, LintWarning } from "../tokens/useTokensView.ts";
import { extraSuggestions } from "../lib/systemImport.ts";
import { removeTokenValue, renameToken, setTokenValue, tokenValueMap } from "../lib/tokenCss.ts";
import "./SchemaFill.css";

/**
 * The schema fill surface (#124) — the answer to "432 names through one
 * textarea".
 *
 * The schema is already grouped (54 groups in `REFERENCE`) and `coverage()`
 * already returns each group's `present`/`missing`, so this is a render of
 * derived data, not a second token store: every edit goes through `tokenCss`
 * into the same CSS string the paste box holds, and the grouped view and the
 * paste view stay the same system seen two ways.
 *
 * A row is only rendered for an open group (or while a filter is active), so
 * the 432-row surface is navigable instead of merely long: the group outline
 * and the filters are how you get to a name, not scrolling.
 */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function isColorName(name: string): boolean {
  return name.startsWith("--color-");
}

export function SchemaFill({ css, onChange }: { css: string; onChange: (next: string) => void }) {
  const values = useMemo(() => tokenValueMap(css), [css]);
  const cov = useMemo(() => coverage([...values.keys()]) as CoverageInfo, [values]);
  const extras = useMemo(() => extraSuggestions(css), [css]);
  const lintByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of lintTokens(parseTokens(css)) as LintWarning[]) map.set(w.name, w.msg);
    return map;
  }, [css]);

  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [groupFilter, setGroupFilter] = useState("");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  // Row drafts: a value being typed must render as typed (a trailing space is
  // stripped when it is written into the CSS), and is dropped on blur so the
  // CSS text stays the only lasting copy.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const filtering = query.trim() !== "" || missingOnly || groupFilter !== "";
  const shown = useMemo(
    () => (groupFilter ? cov.groups.filter((g) => g.id === groupFilter) : cov.groups),
    [cov.groups, groupFilter],
  );
  const needle = query.trim().toLowerCase();

  const commit = (name: string, value: string) => {
    setDrafts((d) => ({ ...d, [name]: value }));
    onChange(setTokenValue(css, name, value));
  };
  const dropDraft = (name: string) =>
    setDrafts((d) => {
      if (!(name in d)) return d;
      const { [name]: _dropped, ...rest } = d;
      return rest;
    });

  const toggle = (id: string) =>
    setOpenIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="app-fill">
      <div className="app-fill-controls">
        <input
          className="tok-input app-fill-search"
          type="search"
          value={query}
          placeholder="Filter by name…"
          aria-label="Filter tokens by name"
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="app-fill-check">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
          />
          Only missing
        </label>
        <select
          className="tok-input app-fill-groups"
          value={groupFilter}
          aria-label="Filter by group"
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">All {cov.groups.length} groups</option>
          {cov.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label} ({g.present.length}/{g.expected})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tok-btn"
          onClick={() => setOpenIds(new Set(cov.groups.map((g) => g.id)))}
        >
          Expand all
        </button>
        <button type="button" className="tok-btn" onClick={() => setOpenIds(new Set())}>
          Collapse all
        </button>
      </div>

      <p className="tok-dialog-meta app-fill-summary" aria-live="polite">
        <b className={cov.missing ? "" : "ok"}>
          {cov.present}/{cov.expected}
        </b>{" "}
        schema tokens
        {cov.missing > 0 && <span className="warn"> · {cov.missing} missing</span>}
        {extras.length > 0 && <span className="warn"> · {extras.length} extra</span>}
        {lintByName.size > 0 && <span className="warn"> · {lintByName.size} value warnings</span>}
      </p>

      <div className="app-fill-sections">
        {shown.map((g) => {
          const rows = g.present
            .map((name) => ({ name, present: true }))
            .concat(g.missing.map((name) => ({ name, present: false })))
            .filter((r) => (!missingOnly || !r.present) && (!needle || r.name.toLowerCase().includes(needle)));
          if (!rows.length) return null;
          const open = filtering || openIds.has(g.id);
          return (
            <section className="app-fill-group" key={g.id}>
              <button
                type="button"
                className="app-fill-head"
                aria-expanded={open}
                onClick={() => toggle(g.id)}
              >
                <span className="app-fill-caret" aria-hidden="true">
                  {open ? "▾" : "▸"}
                </span>
                <span className="app-fill-label">{g.label}</span>
                <span className="app-fill-prog">
                  {g.present.length}/{g.expected}
                </span>
                {g.missing.length > 0 && (
                  <span className="app-fill-miss">{g.missing.length} missing</span>
                )}
              </button>
              {open && (
                <div className="app-fill-rows">
                  {rows.map(({ name, present }) => {
                    const value = drafts[name] ?? values.get(name) ?? "";
                    const warning = lintByName.get(name);
                    return (
                      <div className="app-fill-row" key={name}>
                        <span
                          className={`app-fill-dot${present ? " is-present" : ""}${warning ? " is-warn" : ""}`}
                          title={warning ?? (present ? "present" : "missing")}
                          aria-hidden="true"
                        />
                        <span className="app-fill-key">
                          {isColorName(name) && HEX.test(value.trim()) && (
                            <span className="app-fill-swatch" style={{ background: value.trim() }} />
                          )}
                          <code className="app-fill-name">{name}</code>
                        </span>
                        <input
                          className="tok-input app-fill-input"
                          value={value}
                          spellCheck={false}
                          placeholder={present ? "" : "not set"}
                          aria-label={name}
                          title={warning}
                          onChange={(e) => commit(name, e.target.value)}
                          onBlur={() => dropDraft(name)}
                        />
                        {value !== "" && (
                          <button
                            type="button"
                            className="app-fill-clear"
                            aria-label={`Clear ${name}`}
                            title={`Clear ${name}`}
                            onClick={() => {
                              dropDraft(name);
                              onChange(removeTokenValue(css, name));
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {!shown.some((g) =>
          g.present
            .concat(g.missing)
            .some((n) => (!missingOnly || !values.has(n)) && (!needle || n.toLowerCase().includes(needle))),
        ) && <p className="tok-dialog-meta">No token matches this filter.</p>}
      </div>

      {extras.length > 0 && (
        <section className="app-fill-extras">
          <div className="app-fill-head-static">
            {extras.length} extra — Preview only reads the {cov.expected} schema names
          </div>
          {extras.map(({ name, suggest }) => (
            <div className="app-fill-row app-fill-extra-row" key={name}>
              <code className="app-fill-name">{name}</code>
              {suggest && (
                <button
                  type="button"
                  className="tok-btn"
                  title={`Rename ${name} to ${suggest}`}
                  onClick={() => onChange(renameToken(css, name, suggest))}
                >
                  rename to {suggest}
                </button>
              )}
              <button
                type="button"
                className="tok-btn"
                title={`Remove ${name}`}
                onClick={() => onChange(removeTokenValue(css, name))}
              >
                remove
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
