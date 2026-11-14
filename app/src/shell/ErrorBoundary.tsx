import { Component, type ErrorInfo, type ReactNode } from "react";
import "./ErrorBoundary.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Chrome-level safety net around Shell. Catches render errors anywhere in
 * the Shell tree so one bad section can't blank the whole app.
 *
 * Recovery must not re-render the same deterministic throw, so the fallback
 * offers a plain reload and a reset that clears the persisted selection (the
 * active system and the URL's tab/section state) before reloading. The
 * fallback surface is painted from viewer-private --app-error-* literals: the
 * inspected system's tokens may be what crashed the shell in the first place.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only — the fallback copy stays user-safe and leaks no internals.
    console.error(error);
    console.error(info.componentStack);
  }

  private cardRef = (el: HTMLDivElement | null): void => {
    el?.focus();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    try {
      localStorage.removeItem("dsv.app.active");
    } catch {
      /* storage unreachable — the reload still starts from a clean URL */
    }
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* non-http contexts (file://) — reload below still clears in-memory state */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-error">
        <div
          className="app-error-card"
          role="alert"
          aria-labelledby="app-error-title"
          aria-describedby="app-error-desc"
          tabIndex={-1}
          ref={this.cardRef}
        >
          <h2 id="app-error-title" className="app-error-title">
            Something went wrong
          </h2>
          <p id="app-error-desc" className="app-error-message">
            This view stopped unexpectedly. Reload the page, or reset to a safe view if the
            problem keeps happening.
          </p>
          <div className="app-error-actions">
            <button
              type="button"
              className="app-error-btn app-error-btn--primary"
              onClick={this.handleReload}
            >
              Reload
            </button>
            <button type="button" className="app-error-btn" onClick={this.handleReset}>
              Reset to a safe view
            </button>
          </div>
        </div>
      </div>
    );
  }
}
