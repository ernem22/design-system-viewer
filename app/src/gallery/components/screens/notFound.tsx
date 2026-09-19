import { Button } from "../../ui.tsx";
import "./screens.css";

export default function NotFoundBody() {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}>
      <div className="dsv-display" style={{ color: "var(--color-text)" }}>
        404
      </div>
      <p className="dsv-lede" style={{ margin: "var(--space-4) 0" }}>
        This page wandered off the grid.
      </p>
      <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-6)" }}>
        The link may be broken — or the page was moved.{" "}
        <a className="dsv-link" href="#screen-dashboard">
          Back to dashboard
        </a>
      </p>
      <div className="dsv-inline" style={{ justifyContent: "center" }}>
        <Button>Go home</Button>
        <Button variant="outline">Contact support</Button>
      </div>
    </div>
  );
}
