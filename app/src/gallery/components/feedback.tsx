import { useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import * as Toast from "@radix-ui/react-toast";
import { Button, Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./feedback.css";

function ToastDemo() {
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(false);
    requestAnimationFrame(() => setOpen(true));
  };
  return (
    <Toast.Provider swipeDirection="right">
      <Button variant="outline" onClick={show}>
        Show notification
      </Button>
      <Toast.Root className="dsv-toast" open={open} onOpenChange={setOpen} duration={4000}>
        <div className="dsv-toast-body">
          <Toast.Title className="dsv-toast-title">Saved</Toast.Title>
          <Toast.Description className="dsv-toast-desc">Changes uploaded to cloud.</Toast.Description>
        </div>
        <Toast.Close asChild>
          <Button variant="ghost" size="sm" className="dsv-icon-btn" aria-label="Dismiss notification">
            <Icon name="x" size={14} />
          </Button>
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="dsv-toast-viewport" />
    </Toast.Provider>
  );
}

export default function FeedbackBody() {
  const [progress, setProgress] = useState(66);

  return (
    <>
      <Demo title="Progress">
        <Progress.Root className="dsv-progress" value={progress}>
          {/* width is the one genuinely dynamic value here — everything else
             in this gallery is a static class reading design-system tokens */}
          <Progress.Indicator className="dsv-progress-indicator" style={{ width: `${progress}%` }} />
        </Progress.Root>
        <Button size="sm" variant="ghost" onClick={() => setProgress((v) => (v >= 100 ? 0 : v + 20))}>
          +20
        </Button>
        <span className="dsv-mono dsv-muted">{progress}%</span>
      </Demo>
      <Demo title="Toast">
        <ToastDemo />
      </Demo>
      <Demo title="Badge">
        <span className="dsv-badge">Default</span>
        <span className="dsv-badge dsv-badge--success">
          <Icon name="check" size={12} /> Active
        </span>
        <span className="dsv-badge dsv-badge--warning">Pending</span>
        <span className="dsv-badge dsv-badge--danger">Failed</span>
        <span className="dsv-badge dsv-badge--info">Beta</span>
      </Demo>
      <Demo title="Badge (solid)">
        <span className="dsv-badge dsv-badge--success-solid">Active</span>
        <span className="dsv-badge dsv-badge--warning-solid">Pending</span>
        <span className="dsv-badge dsv-badge--danger-solid">Failed</span>
        <span className="dsv-badge dsv-badge--info-solid">Beta</span>
      </Demo>
      <Demo title="Kbd">
        <span>
          Save: <kbd className="dsv-kbd">⌘</kbd> <kbd className="dsv-kbd">S</kbd>
        </span>
      </Demo>
      <Demo title="State trio — empty / loading / error">
        <div className="dsv-card dsv-feedback-trio-card">
          <div className="dsv-empty dsv-feedback-empty">
            <span className="glyph">
              <Icon name="search" size={20} />
            </span>
            <h4>No projects</h4>
            <p>Create one to get started.</p>
          </div>
        </div>
        <div className="dsv-card dsv-inline dsv-feedback-loading-card">
          <span className="dsv-spinner dsv-spinner--sm" /> <span className="dsv-muted dsv-feedback-loading-text">Loading…</span>
        </div>
        <div className="dsv-callout dsv-callout--danger">
          <span className="ico">
            <Icon name="x" size={16} />
          </span>
          <div>
            Sync failed. <a className="dsv-link" href="#feedback">Retry</a>
          </div>
        </div>
      </Demo>
    </>
  );
}
