import type { Candidate } from "../vision/detector";
import type { Rect } from "./geometry";
import type { StabilizedReading } from "./stabilizer";

/** Reason the app is not showing a number, in priority order. */
export type Hint =
  | "point-at-flag"
  | "no-flag"
  | "hold-steady"
  | "too-dark"
  | "too-bright"
  | "step-back"
  | "too-far"
  | "top-hidden"
  | null;

export type Lighting = "ok" | "dark" | "bright";

/** The latest detection, in video pixels (not crop pixels), for drawing the lock markers. */
export interface DetectionOverlay {
  xTop: number;
  yTop: number;
  xBase: number;
  yBase: number;
  heightPx: number;
  flagEvidence: number;
  ambiguous: boolean;
  confidence: number;
}

export interface DebugInfo {
  camWidth: number;
  camHeight: number;
  camFps: number | null;
  analysisHz: number;
  procMsAvg: number;
  procMsP95: number;
  usingWorker: boolean;
  roi: Rect | null;
  focalRatio: number;
  rawYards: number | null;
  heightPx: number | null;
  score: number | null;
  rollDeg: number | null;
  elevationDeg: number | null;
  shakeDps: number | null;
  meanLuma: number | null;
  candidates: Pick<Candidate, "xBase" | "yTop" | "yBase" | "heightPx" | "score" | "rank" | "flagEvidence" | "clipped" | "topAmbiguous">[];
}

export interface SessionSnapshot {
  running: boolean;
  paused: boolean;
  reading: StabilizedReading;
  /** True while the shown distance is beyond the wedge range (with hysteresis). */
  far: boolean;
  detection: DetectionOverlay | null;
  hint: Hint;
  lighting: Lighting;
  shaking: boolean;
  motionAvailable: boolean;
  /** Offer "tap to bracket": no lock for a while, or the flag top is hard to see. */
  bracketOffered: boolean;
  calibrated: boolean;
  debug: DebugInfo;
}

export interface BracketFrame {
  image: ImageData;
  roi: Rect;
  rollRad: number;
  elevationRad: number;
  /** Detector's best guess in crop pixels, to pre-place the handles. */
  suggestion: { xTop: number; yTop: number; xBase: number; yBase: number } | null;
  longSide: number;
}

export interface BracketHandles {
  xTop: number;
  yTop: number;
  xBase: number;
  yBase: number;
}

export interface BracketResult {
  yards: number;
  plusMinus: number;
  heightPx: number;
  handles: BracketHandles;
  snapped: boolean;
}

export interface SessionSummary {
  durationMs: number;
  frames: number;
  locks: number;
  brackets: number;
  avgProcMs: number;
  avgFps: number | null;
  camWidth: number;
  camHeight: number;
  maxLockedYards: number | null;
}
