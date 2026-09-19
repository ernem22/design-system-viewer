import { Component, type ErrorInfo, type ReactNode } from "react";
import type { PushToast } from "../lib/toasts.ts";
import "./ErrorBoundary.css";

interface ErrorBoundaryProps {
  children: ReactNode;
  pushToast?: PushToast;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Chrome-level safety net around Shell. Catches render errors anywhere in
 * the Shell tree so one bad section can't blank the whole app — Toasts and
 * AddSystemDialog stay outside (in App.tsx) so the error toast still renders.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log both the error and the React component stack for debugging.
    console.error(error);
    console.error(info.componentStack);
    this.props.pushToast?.("Something went wrong", "err");
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-error" role="alert">
        <div className="app-error-card">
          <h2 className="app-error-title">Something went wrong</h2>
          <p className="app-error-message">
            A section failed to render. Try again, or reload the page if the problem persists.
          </p>
          {this.state.error && (
            <pre className="app-error-details">{this.state.error.message}</pre>
          )}
          <button type="button" className="dsv-btn dsv-btn--solid" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
