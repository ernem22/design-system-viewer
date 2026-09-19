import { Icon } from "../lib/icons.tsx";
import "./Welcome.css";

/** Zero-systems state (legacy .welcome): paste or upload a first system. */
export function Welcome({ onPaste, onUpload }: { onPaste: () => void; onUpload: () => void }) {
  return (
    <div className="app-welcome">
      <h2>No systems yet</h2>
      <p>
        Paste a block of <code>--token: value;</code> lines and get a categorized gallery, a live component
        preview, and a side-by-side diff.
      </p>
      <div className="app-welcome-actions">
        <button type="button" className="app-welcome-card" onClick={onPaste}>
          <Icon name="copy" size={22} />
          <b>Paste CSS</b>
          <span>Or fetch a stylesheet from a URL</span>
        </button>
        <button type="button" className="app-welcome-card" onClick={onUpload}>
          <Icon name="file" size={22} />
          <b>Upload a file</b>
          <span>Pick a .css file, or drop one anywhere</span>
        </button>
      </div>
      <p className="app-welcome-hint">Nothing is uploaded — systems stay in this browser.</p>
    </div>
  );
}

/** Full-page hint while a file is dragged over the window. */
export function DropOverlay() {
  return (
    <div className="app-drop" aria-hidden="true">
      <div className="app-drop-box">Drop a .css file to import it</div>
    </div>
  );
}
