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
