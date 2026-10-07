import { OPTICS } from "../config/constants";

export interface DistanceInput {
  /** Apparent stick length in video pixels (top to base). */
  heightPx: number;
  stickHeightIn: number;
  /** Focal length in pixels. */
  focalPx: number;
  /** Camera line-of-sight elevation; foreshortens a vertical stick by cos(elevation). */
  elevationRad?: number;
}

/** Pinhole model: distance = real height * cos(el) * focal / apparent height. */
export function distanceYards({ heightPx, stickHeightIn, focalPx, elevationRad = 0 }: DistanceInput): number {
  if (!(heightPx > 0)) return Infinity;
  const stickYards = stickHeightIn / 36;
  return (stickYards * Math.cos(elevationRad) * focalPx) / heightPx;
}

/** Inverse of distanceYards: how many pixels tall a stick appears at a distance. */
export function heightPxAtDistance(yards: number, stickHeightIn: number, focalPx: number): number {
  return ((stickHeightIn / 36) * focalPx) / yards;
}

export function focalPxFromRatio(longSidePx: number, focalRatio: number): number {
  return longSidePx * focalRatio;
}

export interface UncertaintyInput {
  heightPx: number;
  distanceYds: number;
  /** 1-sigma pixel error of each endpoint. */
  endpointSigmaPx: number;
  calibrated: boolean;
  stickHeightFromUser: boolean;
}

/**
 * 1-sigma distance error in yards. Pixel quantisation grows with range, while
 * focal-length and stick-height errors scale with distance. They are
 * independent, so they add in quadrature.
 */
export function distanceSigmaYards(u: UncertaintyInput): number {
  const relPixel = (Math.SQRT2 * u.endpointSigmaPx) / Math.max(1, u.heightPx);
  const relFocal = u.calibrated ? OPTICS.calibratedRelSigma : OPTICS.uncalibratedRelSigma;
  const relStick = u.stickHeightFromUser ? OPTICS.userStickRelSigma : OPTICS.defaultStickRelSigma;
  return u.distanceYds * Math.sqrt(relPixel ** 2 + relFocal ** 2 + relStick ** 2);
}

/** Round an uncertainty for display: never promise better than 1 yard. */
export function displayPlusMinus(sigmaYds: number): number {
  return Math.max(1, Math.round(sigmaYds));
}

/** Per-endpoint pixel error as a function of detection strength. */
export function endpointSigmaFromScore(score: number): number {
  return 0.55 + 6 / Math.max(6, score);
}
