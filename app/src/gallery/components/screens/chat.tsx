import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import { Avat } from "./screenBits.tsx";
import "./screens.css";

export default function ChatBody() {
  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="dsv-inline"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "var(--border-width-thin) solid var(--color-divider)",
          }}
        >
          <Avat n={12} />
          <div>
            <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
              Grace Hopper
            </div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
              online
            </div>
          </div>
        </div>
        <div className="dsv-chat" style={{ padding: "var(--space-4)" }}>
          <div className="dsv-muted" style={{ textAlign: "center", fontSize: "var(--font-size-xs)" }}>
            Today
          </div>
          <div className="dsv-bubble dsv-bubble--them">Is token bridge working?</div>
          <div className="dsv-bubble dsv-bubble--me">Yes, live via postMessage.</div>
          <div className="dsv-bubble dsv-bubble--them">Great. Let's add more screens.</div>
          <div className="dsv-bubble dsv-bubble--me">This screen is one of them 😄</div>
          <div className="dsv-bubble dsv-bubble--them">
            <span className="dsv-spinner dsv-spinner--xs" /> typing…
          </div>
        </div>
        <div
          className="dsv-inline"
          style={{
            padding: "var(--space-3)",
            borderTop: "var(--border-width-thin) solid var(--color-divider)",
            gap: "var(--space-2)",
          }}
        >
          <input className="dsv-input" placeholder="Write a message…" style={{ flex: 1 }} />
          <Button className="dsv-icon-btn" aria-label="Send">
            <Icon name="chevronRight" size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
