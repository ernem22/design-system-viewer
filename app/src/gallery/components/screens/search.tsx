import { useState } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Icon } from "../../../lib/icons.tsx";
import { REFERENCE_TOKEN_COUNT } from "../../../../../src/core/schema.js";
import "./screens.css";

type Facet = "All" | "Docs" | "Components" | "People";

const FACETS: Facet[] = ["All", "Docs", "Components", "People"];

const RESULTS: [string, string, string, Exclude<Facet, "All">][] = [
  ["Token reference", `Schema of ${REFERENCE_TOKEN_COUNT} tokens with coverage…`, "#patterns", "Docs"],
  ["Token schema", "Required, optional and inferred keys…", "#patterns", "Docs"],
  ["Design tokens guide", "Naming, aliasing and coverage rules…", "#patterns", "Docs"],
  ["Preview app", "Radix primitives styled by tokens…", "#screen-dashboard", "Components"],
  ["Button", "Solid, soft, outline, ghost and danger…", "#forms", "Components"],
  ["Data table", "Toolbar, search, dialog and row menu…", "#screen-table", "Components"],
  ["Compare mode", "Diff two systems side by side…", "#screen-table", "Components"],
  ["Ada Lovelace", "Component maintainer…", "#screen-team", "People"],
  ["Grace Hopper", "Design systems lead…", "#screen-team", "People"],
];

const PER_PAGE = 3;

export default function SearchBody() {
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<Facet>("All");
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const filtered = RESULTS.filter(
    ([title, body, , kind]) =>
      (facet === "All" || kind === facet) &&
      (!q || `${title} ${body}`.toLowerCase().includes(q)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
        }}
        style={{ marginBottom: "var(--space-3)" }}
      >
        <div className="dsv-input-wrap dsv-input-wrap--prefix">
          <span className="dsv-adorn dsv-adorn--prefix">
            <Icon name="search" size={14} />
          </span>
          <input
            className="dsv-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search docs, components, people…"
            aria-label="Search"
          />
        </div>
      </form>
      <ToggleGroup.Root
        type="single"
        value={facet}
        onValueChange={(next) => {
          if (next) {
            setFacet(next as Facet);
            setPage(1);
          }
        }}
        aria-label="Filter results by type"
        className="dsv-segmented"
        style={{ marginBottom: "var(--space-4)" }}
      >
        {FACETS.map((f) => (
          <ToggleGroup.Item key={f} value={f}>
            {f}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <p className="dsv-muted" role="status" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-3)" }}>
        {filtered.length} result{filtered.length === 1 ? "" : "s"}
        {facet === "All" ? "" : ` in ${facet}`}
      </p>
      <ul
        role="list"
        aria-label="Search results"
        className="dsv-stack"
        style={{ gap: "var(--space-4)", listStyle: "none", margin: 0, padding: 0 }}
      >
        {visible.map(([t, b, href]) => (
          <li key={t}>
            <a
              className="dsv-link"
              href={href}
              style={{ fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-medium)" }}
            >
              {t}
            </a>
            <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "var(--space-1) 0 0" }}>
              {b}
            </p>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
          No results match this query.
        </p>
      )}
      <div className="dsv-pagination" aria-label="Result pages" style={{ marginTop: "var(--space-5)" }}>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            aria-current={n === current ? "page" : undefined}
            aria-label={`Page ${n}`}
            onClick={() => setPage(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
