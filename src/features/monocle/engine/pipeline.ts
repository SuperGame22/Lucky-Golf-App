import { ANALYSIS, LIGHT, MOTION, OPTICS } from "../config/constants";
import type { DetectionResult } from "../vision/detector";
import { sampleConfidence } from "./confidence";
import { distanceYards, endpointSigmaFromScore, focalPxFromRatio } from "./distance";
import { clamp } from "./geometry";
import { DistanceStabilizer, RangeGate, StabilizedReading, StabilizerSample } from "./stabilizer";
import type { Hint, Lighting } from "./types";

export interface Optics {
  stickHeightIn: number;
  stickFromUser: boolean;
  focalRatio: number;
  calibrated: boolean;
}

export interface FrameContext {
  /** Milliseconds on any monotonic clock. */
  t: number;
  /** Long side of the video frame in pixels (focal length is expressed against it). */
  longSide: number;
  shakeDps: number | null;
  elevationRad: number | null;
}

/** Detection in crop pixels; the session maps it to video/screen coordinates. */
export interface CropOverlay {
  xTop: number;
  yTop: number;
  xBase: number;
  yBase: number;
  heightPx: number;
  flagEvidence: number;
  ambiguous: boolean;
  confidence: number;
}

export interface PipelineOutput {
  reading: StabilizedReading;
  far: boolean;
  overlay: CropOverlay | null;
  hint: Hint;
  lighting: Lighting;
  shaking: boolean;
  bracketOffered: boolean;
  rawYards: number | null;
  heightPx: number | null;
  score: number | null;
  /** The sample fed to the stabilizer this frame (null if the frame was rejected). */
  sample: StabilizerSample | null;
  /** The previous-frame hint for the detector, to keep a lock sticky. */
  prior: { xBase: number; yTop: number; yBase: number } | null;
  locked: boolean;
  newLock: boolean;
}

/**
 * Everything that turns one detector result into a steadier reading, with no
 * camera or DOM in sight so it can be tested on synthetic frames.
 */
export class MeasurementPipeline {
  private stabilizer = new DistanceStabilizer();
  private gate = new RangeGate();
  private prior: PipelineOutput["prior"] = null;
  private startedAt: number | null = null;
  private lastSeenAt = -Infinity;
  private lastLockedAt: number | null = null;
  private wasLocked = false;

  constructor(private getOptics: () => Optics) {}

  setMaxYards(max: number) {
    this.gate.setMax(max);
  }

  reset() {
    this.stabilizer.reset();
    this.gate.reset();
    this.prior = null;
    this.startedAt = null;
    this.lastSeenAt = -Infinity;
    this.lastLockedAt = null;
    this.wasLocked = false;
  }

  process(result: DetectionResult, ctx: FrameContext): PipelineOutput {
    this.startedAt ??= ctx.t;
    const optics = this.getOptics();
    const { best, stats } = result;

    const lighting: Lighting =
      stats.meanLuma < LIGHT.tooDarkMeanLuma ? "dark" : stats.clipHigh > LIGHT.tooBrightClipFraction ? "bright" : "ok";
    const shaking = ctx.shakeDps != null && ctx.shakeDps >= MOTION.shakeWarnDps;

    let sample: StabilizerSample | null = null;
    let overlay: CropOverlay | null = null;
    let rawYards: number | null = null;
    let tooFar = false;
    let tooClose = false;
    let ambiguous = false;

    if (best) {
      tooClose = best.clipped;
      tooFar = !best.clipped && best.heightPx < ANALYSIS.minStickPx;
      ambiguous = best.topAmbiguous;
      const usable = !best.clipped && !tooFar;
      const elevation = ctx.elevationRad != null ? clamp(ctx.elevationRad, -0.44, 0.44) : 0;
      const focalPx = focalPxFromRatio(ctx.longSide, optics.focalRatio);
      const yards = usable ? distanceYards({ heightPx: best.heightPx, stickHeightIn: optics.stickHeightIn, focalPx, elevationRad: elevation }) : NaN;
      rawYards = Number.isFinite(yards) ? yards : null;

      const confidence = sampleConfidence({
        score: best.score,
        heightPx: best.heightPx,
        flagEvidence: best.flagEvidence,
        shakeDps: ctx.shakeDps,
        clipped: best.clipped,
      });
      overlay = {
        xTop: best.xTop,
        yTop: best.yTop,
        xBase: best.xBase,
        yBase: best.yBase,
        heightPx: best.heightPx,
        flagEvidence: best.flagEvidence,
        ambiguous: best.topAmbiguous,
        confidence,
      };

      if (rawYards != null && !ambiguous) {
        this.lastSeenAt = ctx.t;
        const relSys = Math.hypot(
          optics.calibrated ? OPTICS.calibratedRelSigma : OPTICS.uncalibratedRelSigma,
          optics.stickFromUser ? OPTICS.userStickRelSigma : OPTICS.defaultStickRelSigma,
        );
        sample = {
          t: ctx.t,
          yards: rawYards,
          sigmaPixel: (rawYards * Math.SQRT2 * endpointSigmaFromScore(best.score)) / best.heightPx,
          sigmaSystematic: rawYards * relSys,
          confidence,
        };
        this.prior = { xBase: best.xBase, yTop: best.yTop, yBase: best.yBase };
      } else {
        this.prior = null;
      }
    } else {
      this.prior = null;
    }

    const reading = this.stabilizer.push(sample, ctx.t);
    const far = this.gate.update(reading.yards);

    const locked = reading.status === "locked";
    const newLock = locked && !this.wasLocked;
    this.wasLocked = locked || reading.status === "stale";
    if (locked) this.lastLockedAt = ctx.t;

    const closeNumber = reading.yards != null && reading.yards < 5;
    const hint = this.pickHint({
      tooClose: tooClose || closeNumber,
      shaking,
      lighting,
      ambiguous,
      tooFar,
      t: ctx.t,
    });

    const sinceLock = ctx.t - (this.lastLockedAt ?? this.startedAt);
    const bracketOffered = hint === "top-hidden" || (!locked && sinceLock >= ANALYSIS.bracketOfferMs);

    return {
      reading,
      far,
      overlay,
      hint,
      lighting,
      shaking,
      bracketOffered,
      rawYards,
      heightPx: best?.heightPx ?? null,
      score: best?.score ?? null,
      sample,
      prior: this.prior,
      locked,
      newLock,
    };
  }

  private pickHint(f: { tooClose: boolean; shaking: boolean; lighting: Lighting; ambiguous: boolean; tooFar: boolean; t: number }): Hint {
    if (f.tooClose) return "step-back";
    if (f.shaking) return "hold-steady";
    if (f.lighting === "dark") return "too-dark";
    if (f.lighting === "bright") return "too-bright";
    if (f.ambiguous) return "top-hidden";
    if (f.tooFar) return "too-far";
    const since = f.t - Math.max(this.lastSeenAt, this.startedAt ?? f.t);
    if (since > 2500) return "no-flag";
    return "point-at-flag";
  }
}
