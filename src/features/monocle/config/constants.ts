/**
 * Tunable constants for the Monocle wedge rangefinder.
 * Anything a product owner might reasonably want to change lives here or in
 * wedges.ts / campaigns.ts, not inside the algorithms.
 */

export const RANGE = {
  /** Wedge recommendations stop above this distance. */
  wedgeMaxYards: 120,
  /** Hysteresis band around the cut-off so 119/120/121 doesn't flicker the UI. */
  wedgeBandYards: 2,
  /** Closer than this we ask the user to step back (stick fills the frame). */
  minRangeYards: 5,
} as const;

export const STICK = {
  /** Most courses use 7 ft sticks; some use 8 ft. User-configurable. */
  defaultHeightIn: 84,
  minHeightIn: 60,
  maxHeightIn: 120,
  /** Typical stick diameter, used by the synthetic scene and sanity checks. */
  diameterIn: 0.75,
} as const;

export const OPTICS = {
  /**
   * Default focal length in pixels divided by the long side of the video frame.
   * A 26 mm-equivalent main camera is ~0.75; 24 mm is ~0.69; video stabilisation
   * crops push it up a few percent. One-time calibration replaces this guess.
   */
  defaultFocalRatio: 0.75,
  minFocalRatio: 0.3,
  maxFocalRatio: 3.2,
  /** 1-sigma relative error on focal length. */
  uncalibratedRelSigma: 0.07,
  calibratedRelSigma: 0.02,
  /** 1-sigma relative error on the assumed stick height. */
  defaultStickRelSigma: 0.05,
  userStickRelSigma: 0.015,
} as const;

export const ANALYSIS = {
  /** Target analysis rate. The loop skips frames while a previous one is in flight. */
  targetHz: 12,
  /** Minimum stick length in video pixels we trust for a distance. */
  minStickPx: 14,
  /** Ring buffer used to pick the sharpest frame for "tap to bracket". */
  bracketBufferFrames: 6,
  /** Show the bracket button after this long without a lock. */
  bracketOfferMs: 4000,
} as const;

export const STABILIZER = {
  windowMs: 1600,
  minSamples: 8,
  /** Standard error of the median, as a fraction of the distance, needed to lock. */
  maxStdErrPct: 0.022,
  /** Per-sample spread beyond this means we are probably flipping between objects. */
  maxSpreadPct: 0.14,
  minConfidence: 0.45,
  /** Missing detections shorter than this are ignored. */
  dropoutMs: 250,
  /** Keep showing the last locked value (dimmed) this long after losing the target. */
  staleMs: 700,
  /** At least this share of the window must agree, or we are flipping between objects. */
  minInlierFraction: 0.7,
  /** Display moves only when the estimate is this far from the shown integer. */
  displayHysteresisYards: 1.3,
  /** A sustained jump bigger than this re-locks immediately (new target). */
  jumpYards: 4,
  jumpPct: 0.06,
} as const;

export const MOTION = {
  /** Above this rotation rate (deg/s) we ask the user to hold steady. */
  shakeWarnDps: 30,
  shakeHardDps: 55,
  /** Ignore roll estimates beyond this; the phone is probably not held upright. */
  maxRollDeg: 15,
} as const;

export const LIGHT = {
  tooDarkMeanLuma: 38,
  tooBrightClipFraction: 0.35,
} as const;

export const CAMERA = {
  /** Default stream. Detection only touches a small crop, so 1080p keeps this cheap on any phone. */
  baseline: { width: 1920, height: 1080 },
  /** Devices that benchmark fast get more pixels on the stick, which halves the pixel error. */
  precision: { width: 2560, height: 1440 },
  lowFallback: { width: 1280, height: 720 },
  /** Frames this low mean the device cannot keep up; step down in resolution. */
  minHealthyFps: 20,
} as const;
