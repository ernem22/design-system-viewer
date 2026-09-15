import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

export default function EmptyStateBody() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="dsv-breadcrumb" style={{ marginBottom: "var(--space-4)" }}>
        <a className="dsv-link" href="#screen-empty" style={{ textDecoration: "none" }}>
          Workspace
        </a>
        <Icon name="chevronRight" size={12} />
        <span aria-current="page">Projects</span>
      </div>
      <div className="dsv-card">
        <div className="dsv-empty">
          <span className="glyph">
            <Icon name="plus" size={24} />
          </span>
          <h4>No projects yet</h4>
          <p>Create your first project or import a repository.</p>
          <div className="dsv-inline" style={{ justifyContent: "center" }}>
            <Button>Create project</Button>
            <Button variant="outline">Import repository</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
