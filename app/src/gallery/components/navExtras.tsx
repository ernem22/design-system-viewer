import { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./navExtras.css";

const STEPS: [string, string][] = [
  ["Account", "done"],
  ["Profile", "done"],
  ["Plan", "active"],
  ["Confirm", ""],
];

export default function NavExtrasBody() {
  const [page, setPage] = useState(3);
  const [seg, setSeg] = useState("week");
  return (
    <>
      <Demo title="Breadcrumb">
        <nav className="dsv-breadcrumb">
          <a className="dsv-link" href="#data-display" style={{ textDecoration: "none" }}>
            Home
          </a>
          <Icon name="chevronRight" size={12} />
          <a className="dsv-link" href="#data-display" style={{ textDecoration: "none" }}>
            Projects
          </a>
          <Icon name="chevronRight" size={12} />
          <span aria-current="page">design-system-viewer</span>
        </nav>
      </Demo>
      <Demo title="Prose links">
        <p className="dsv-prose" style={{ margin: 0 }}>
          Read the{" "}
          <a className="dsv-link" href="#patterns">
            patterns guide
          </a>
          , then open the{" "}
          <a className="dsv-link" href="#data-display">
            component index
          </a>{" "}
          to see every token in context.
        </p>
      </Demo>

      <Demo title="Pagination">
        <div className="dsv-pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous"
          >
            <Icon name="chevronLeft" size={14} />
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>
              {n}
            </button>
          ))}
          <button disabled={page === 5} onClick={() => setPage((p) => p + 1)} aria-label="Next">
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      </Demo>

      <Demo title="Steps">
        <div className="dsv-steps" role="list" aria-label="Checkout progress">
          {STEPS.map(([label, st], i, arr) => (
            <div
              key={label}
              role="listitem"
              aria-current={st === "active" ? "step" : undefined}
              className={`dsv-step ${st === "done" ? "dsv-step--done" : st === "active" ? "dsv-step--active" : ""}`}
            >
              <span className="dot">{st === "done" ? <Icon name="check" size={12} /> : i + 1}</span>
              <span className="label">{label}</span>
              {i < arr.length - 1 && <span className="bar" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Segmented control">
        <div className="dsv-segmented">
          {(
            [
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
            ] as [string, string][]
          ).map(([v, l]) => (
            <button key={v} aria-pressed={seg === v} onClick={() => setSeg(v)}>
              {l}
            </button>
          ))}
        </div>
      </Demo>

      <Demo title="Button group">
        <div className="dsv-btn-group">
          <Button variant="outline" size="sm">
            <Icon name="alignLeft" size={14} />
          </Button>
          <Button variant="outline" size="sm">
            <Icon name="alignCenter" size={14} />
          </Button>
          <Button variant="outline" size="sm">
            <Icon name="alignRight" size={14} />
          </Button>
        </div>
        <Tooltip.Provider>
          <div className="dsv-btn-group">
            <Button variant="outline" size="sm">
              Save
            </Button>
            <Button variant="outline" size="sm" className="dsv-icon-btn">
              <Icon name="chevronDown" size={14} />
            </Button>
          </div>
        </Tooltip.Provider>
        <div className="dsv-btn-group">
          <Button variant="solid" size="lg">
            <Icon name="alignLeft" size={16} />
          </Button>
          <Button variant="solid" size="lg">
            <Icon name="alignCenter" size={16} />
          </Button>
          <Button variant="solid" size="lg">
            <Icon name="alignRight" size={16} />
          </Button>
        </div>
      </Demo>

      <Demo title="Footer links">
        <div className="dsv-inline" style={{ gap: "var(--space-4)", fontSize: "var(--font-size-sm)" }}>
          <a className="dsv-link" href="#nav-extras">
            Docs
          </a>
          <a className="dsv-link" href="#nav-extras">
            API
          </a>
          <a className="dsv-link" href="#nav-extras">
            Status
          </a>
          <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
            © 2026 Acme
          </span>
        </div>
      </Demo>
    </>
  );
}
