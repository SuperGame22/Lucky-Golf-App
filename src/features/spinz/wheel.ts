/**
 * Wheel geometry for the Spinz page. Angles are degrees clockwise from the top of the
 * wheel, and the pointer sits at the top. Kept free of React so the rules can be tested.
 */

export interface WheelSlice {
  startDeg: number;
  endDeg: number;
  midDeg: number;
}

/** Turns relative slice weights into start/mid/end angles that sum to exactly 360°. */
export function buildSlices(weights: number[]): WheelSlice[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cum = 0;
  return weights.map((w) => {
    const startDeg = (cum / total) * 360;
    cum += w;
    const endDeg = (cum / total) * 360;
    return { startDeg, endDeg, midDeg: (startDeg + endDeg) / 2 };
  });
}

const mod360 = (d: number) => ((d % 360) + 360) % 360;
const EPS = 1e-9;

/**
 * Cumulative rotation that stops the wheel with the middle of a slice under the pointer,
 * after `fullTurns` extra full turns. Rotation is cumulative across spins, so the angle the
 * wheel already stopped at last time is corrected for.
 */
export function rotationToLand(currentRotation: number, midDeg: number, fullTurns: number): number {
  const delta = mod360(mod360(360 - midDeg) - mod360(currentRotation));
  return currentRotation + 360 * fullTurns + delta;
}

/**
 * Index of the slice under the pointer once the wheel has turned `rotationDeg`.
 * A pointer exactly on a border goes to the neighbour that is not gold,
 * so a stop on the line between sand and gold counts as sand.
 */
export function sliceUnderPointer(
  slices: WheelSlice[],
  rotationDeg: number,
  isGold: (index: number) => boolean,
): number {
  const a = mod360(360 - mod360(rotationDeg)); // the point of the wheel under the pointer
  const hits: number[] = [];
  slices.forEach((s, i) => {
    const on = (x: number) => x >= s.startDeg - EPS && x <= s.endDeg + EPS;
    if (on(a) || on(a + 360)) hits.push(i);
  });
  return hits.find((i) => !isGold(i)) ?? hits[0] ?? -1;
}

/**
 * A CSS-style cubic-bezier easing as a plain function of time (0..1) -> progress (0..1), so the wheel can
 * be turned frame by frame from JavaScript. Exactly 0 at the start and exactly 1 at the end.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sy = (s: number) => ((ay * s + by) * s + cy) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) { // Newton's method, fast when the slope is healthy
      const err = sx(s) - t;
      if (Math.abs(err) < 1e-7) return sy(s);
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0, hi = 1;
    s = t;
    for (let i = 0; i < 40; i++) { // bisection fallback, always converges
      const x = sx(s);
      if (Math.abs(x - t) < 1e-7) break;
      if (x < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return sy(s);
  };
}
