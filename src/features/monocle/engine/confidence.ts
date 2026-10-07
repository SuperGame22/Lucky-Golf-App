import { clamp } from "./geometry";

export interface SampleQuality {
  /** Detector line-evidence score (see vision/detector.ts). */
  score: number;
  heightPx: number;
  /** 0..1: how much a flag-like blob sits at the top of the stick. */
  flagEvidence: number;
  /** Rotation rate in deg/s, or null when the device has no motion sensors. */
  shakeDps: number | null;
  /** The detected line runs off the edge of the analysis region. */
  clipped: boolean;
}

/** Score at which the detector is 50% sure the line is real, and how sharply that rises. */
export const SCORE_MID = 30;
export const SCORE_WIDTH = 9;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * 0..1 belief that this single frame contains the flagstick and measured it
 * well. This is *detection* confidence; the +/- shown next to the number is
 * the separate *accuracy* estimate (see distance.ts).
 */
export function sampleConfidence(q: SampleQuality): number {
  const detect = sigmoid((q.score - SCORE_MID) / SCORE_WIDTH);
  const size = 0.35 + 0.65 * clamp((q.heightPx - 12) / 18, 0, 1);
  const motion = q.shakeDps == null ? 0.9 : clamp(1 - (q.shakeDps - 10) / 30, 0, 1);
  const flag = 0.85 + 0.15 * clamp(q.flagEvidence, 0, 1);
  const clip = q.clipped ? 0.3 : 1;
  return clamp(detect * size * motion * flag * clip, 0, 1);
}
