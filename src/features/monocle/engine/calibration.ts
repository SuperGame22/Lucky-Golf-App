import { OPTICS } from "../config/constants";

export interface CalibrationRecord {
  /** Focal length in pixels divided by the long side of the video frame. */
  ratio: number;
  /** ISO timestamp. */
  at: string;
}

export type CalibrationMap = Record<string, CalibrationRecord>;

export interface CalibrationMeasurement {
  /** Apparent length of the reference object in video pixels. */
  heightPx: number;
  objectHeightIn: number;
  distanceIn: number;
  longSidePx: number;
  elevationRad?: number;
}

/** Solve the pinhole model for focal ratio given an object of known size and distance. */
export function focalRatioFromMeasurement(m: CalibrationMeasurement): number | null {
  if (!(m.heightPx > 0) || !(m.objectHeightIn > 0) || !(m.distanceIn > 0) || !(m.longSidePx > 0)) return null;
  const cosEl = Math.cos(m.elevationRad ?? 0);
  const focalPx = (m.distanceIn * m.heightPx) / (m.objectHeightIn * cosEl);
  const ratio = focalPx / m.longSidePx;
  if (!(ratio >= OPTICS.minFocalRatio && ratio <= OPTICS.maxFocalRatio)) return null;
  return ratio;
}

export interface CalibrationPreset {
  id: string;
  label: string;
  objectHeightIn: number;
  defaultDistanceFt: number;
}

export const CALIBRATION_PRESETS: CalibrationPreset[] = [
  { id: "door", label: "Standard door (80 in)", objectHeightIn: 80, defaultDistanceFt: 14 },
  { id: "stick-7", label: "7 ft flagstick", objectHeightIn: 84, defaultDistanceFt: 30 },
  { id: "stick-8", label: "8 ft flagstick", objectHeightIn: 96, defaultDistanceFt: 30 },
];

/**
 * Identify a camera well enough to remember its calibration. Browsers do not
 * expose a stable model id, so combine what they do give us. Phones with the
 * same screen and the same camera label share a key, which is acceptable
 * because they usually share optics too.
 */
export function cameraKey(parts: {
  label?: string;
  aspect: number;
  screenW: number;
  screenH: number;
  dpr: number;
}): string {
  const label = (parts.label || "camera").toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  const [a, b] = [parts.screenW, parts.screenH].sort((x, y) => x - y);
  return `${label}|${parts.aspect.toFixed(2)}|${a}x${b}@${parts.dpr}`;
}

export function resolveFocalRatio(map: CalibrationMap | undefined, key: string): { ratio: number; calibrated: boolean } {
  const rec = map?.[key];
  if (rec && rec.ratio >= OPTICS.minFocalRatio && rec.ratio <= OPTICS.maxFocalRatio) {
    return { ratio: rec.ratio, calibrated: true };
  }
  return { ratio: OPTICS.defaultFocalRatio, calibrated: false };
}
