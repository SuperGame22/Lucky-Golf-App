/**
 * The developer overlay is invisible to normal users.
 *
 *   dev builds:        add ?monocle_debug=1 to the URL
 *   production builds: add ?monocle_debug=<VITE_MONOCLE_DEBUG_TOKEN>; with no
 *                      token configured, debug is off in production entirely
 *
 * Once enabled it stays on for the browser tab (sessionStorage).
 */
const KEY = "lucky.monocle.debug";

export interface DebugConfig {
  enabled: boolean;
  /** Use the built-in synthetic scene instead of the camera: ?monocle_source=synthetic&dist=87 */
  synthetic: boolean;
  syntheticDistance: number;
}

export function readDebugConfig(search = typeof location !== "undefined" ? location.search : ""): DebugConfig {
  const off: DebugConfig = { enabled: false, synthetic: false, syntheticDistance: 87 };
  try {
    const q = new URLSearchParams(search);
    const given = q.get("monocle_debug");
    const token = import.meta.env.VITE_MONOCLE_DEBUG_TOKEN as string | undefined;
    const allowed = given != null && (import.meta.env.DEV ? true : !!token && given === token);
    let enabled = allowed;
    try {
      if (allowed) sessionStorage.setItem(KEY, "1");
      else if (given == null) enabled = sessionStorage.getItem(KEY) === "1" && (import.meta.env.DEV || !!token);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
    if (!enabled) return off;
    const dist = Number(q.get("dist"));
    return {
      enabled: true,
      synthetic: q.get("monocle_source") === "synthetic",
      syntheticDistance: Number.isFinite(dist) && dist > 0 ? dist : 87,
    };
  } catch {
    return off;
  }
}
