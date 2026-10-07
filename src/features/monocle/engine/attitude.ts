import { clamp } from "./geometry";

const RAD = Math.PI / 180;

/**
 * Gravity direction (pointing down) in device coordinates, derived from the
 * W3C DeviceOrientation Euler angles (ZXY). Using orientation rather than
 * accelerometer values avoids the iOS/Android sign-convention mismatch.
 * Upright portrait (beta 90, gamma 0) gives (0, -1, 0).
 */
export function gravityFromEuler(betaDeg: number, gammaDeg: number): [number, number, number] {
  const b = betaDeg * RAD;
  const g = gammaDeg * RAD;
  return [Math.cos(b) * Math.sin(g), -Math.sin(b), -Math.cos(b) * Math.cos(g)];
}

/**
 * Clockwise tilt (radians) of world-vertical in the camera image, i.e. how far
 * a plumb flagstick leans to the right. `screenAngleDeg` is
 * `screen.orientation.angle` (0 in natural portrait).
 */
export function rollFromGravity(g: [number, number, number], screenAngleDeg = 0): number {
  const a = screenAngleDeg * RAD;
  const right = -g[0] * Math.cos(a) + g[1] * Math.sin(a);
  const up = -g[0] * Math.sin(a) - g[1] * Math.cos(a);
  return Math.atan2(right, up);
}

/** Elevation (radians) of the camera's line of sight above horizontal. */
export function elevationFromGravity(g: [number, number, number]): number {
  return Math.asin(clamp(g[2], -1, 1));
}

export interface Attitude {
  rollRad: number;
  elevationRad: number;
}

export function attitudeFromEuler(betaDeg: number, gammaDeg: number, screenAngleDeg = 0): Attitude {
  const g = gravityFromEuler(betaDeg, gammaDeg);
  return { rollRad: rollFromGravity(g, screenAngleDeg), elevationRad: elevationFromGravity(g) };
}

/** Angular speed (deg/s) from a DeviceMotion rotationRate triple. */
export function rotationSpeedDps(alpha: number | null, beta: number | null, gamma: number | null): number | null {
  if (alpha == null || beta == null || gamma == null) return null;
  return Math.hypot(alpha, beta, gamma);
}
