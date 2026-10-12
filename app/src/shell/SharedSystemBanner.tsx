import "./SharedSystemBanner.css";

export interface SharedSystemBannerProps {
  name: string;
  tokenCount: number;
  /** Tokens refused for an unsafe value — reported, never applied. */
  dropped: number;
  onOpen: () => void;
  onAdd: () => void;
  onDismiss: () => void;
}

/** One-shot notice for a `?s=` shared-system link (issue #337): names the
    system and its token count, offers Open (session-only) / Add to my
    systems (saved) / Dismiss, and reports refused values. Chrome only —
    the decoded payload arrives via props from App, which owns the decode. */
export function SharedSystemBanner({
  name,
  tokenCount,
  dropped,
  onOpen,
  onAdd,
  onDismiss,
}: SharedSystemBannerProps) {
  return (
    <div className="app-shared-banner" role="status">
      <span className="app-shared-banner-text">
        Shared system: {name} · {tokenCount} token{tokenCount === 1 ? "" : "s"}
        {dropped > 0 ? ` · ${dropped} dropped` : ""}
      </span>
      <span className="app-shared-banner-actions">
        <button type="button" className="app-shared-banner-btn" onClick={onOpen}>
          Open
        </button>
        <button type="button" className="app-shared-banner-btn" onClick={onAdd}>
          Add to my systems
        </button>
        <button type="button" className="app-shared-banner-btn" onClick={onDismiss}>
          Dismiss
        </button>
      </span>
    </div>
  );
}
