import { useEffect } from "react";

/** Keep the screen awake while Monocle is live (best effort; not every browser supports it). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        const l = await nav.wakeLock?.request("screen");
        if (cancelled) void l?.release();
        else lock = l ?? null;
      } catch {
        /* denied or unsupported */
      }
    };
    void request();
    const onVis = () => {
      if (!document.hidden && !lock) void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [active]);
}
