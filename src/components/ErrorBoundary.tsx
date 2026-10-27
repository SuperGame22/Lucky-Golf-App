import { Component, type ErrorInfo, type ReactNode } from "react";

const RELOAD_FLAG = "lg_chunk_reload";

/** A page file from an older release is gone (common right after a deploy): reload once to get the new one. */
export const isChunkLoadError = (e: unknown) =>
  e instanceof Error &&
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    `${e.name} ${e.message}`,
  );

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

/** Catches a crash in one page so the whole app doesn't go blank; offers Reload / Home. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
    if (isChunkLoadError(error)) {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem(RELOAD_FLAG) === "1"; sessionStorage.setItem(RELOAD_FLAG, "1"); } catch { /* ignore */ }
      if (!reloaded) window.location.reload();
    }
  }

  componentDidMount() {
    // The one-time reload is allowed again once the app has been running fine for a while.
    window.setTimeout(() => { try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ } }, 30_000);
  }

  componentDidUpdate(prev: Props) {
    // Moving to another page clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center" role="alert">
        <div className="max-w-sm space-y-4">
          <h1 className="text-xl font-display font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">This page hit a problem. Reloading usually fixes it.</p>
          <div className="flex gap-3 justify-center">
            <button type="button" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button type="button" className="px-4 py-2 rounded-lg border border-border" onClick={() => { window.location.href = "/"; }}>
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
