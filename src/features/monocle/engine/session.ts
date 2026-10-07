import { ANALYSIS } from "../config/constants";
import type { MotionTracker } from "../device/motion";
import type { DetectorClient } from "../vision/detectorClient";
import { RoiGrabber } from "../vision/frameGrabber";
import { distanceSigmaYards, distanceYards, focalPxFromRatio } from "./distance";
import { analysisRoi, clamp, cropPointToVideo, Rect, Size } from "./geometry";
import { focalRatioFromMeasurement } from "./calibration";
import { MeasurementPipeline, Optics } from "./pipeline";
import type {
  BracketFrame,
  BracketHandles,
  BracketResult,
  DebugInfo,
  DetectionOverlay,
  SessionSnapshot,
  SessionSummary,
} from "./types";

export interface SessionDeps {
  video: HTMLVideoElement;
  /** Size of the on-screen box the video fills (CSS px). */
  container: () => Size;
  optics: () => Optics;
  maxYards: () => number;
  motion: MotionTracker;
  detector: DetectorClient;
}

interface RingEntry {
  image: ImageData;
  roi: Rect;
  roll: number;
  elevation: number;
  sharpness: number;
  shake: number;
  t: number;
  suggestion: BracketFrame["suggestion"];
}

const EMPTY_READING = {
  status: "searching" as const,
  yards: null,
  plusMinus: null,
  confidence: 0,
  samples: 0,
  medianYards: null,
  stdErrPct: null,
  spreadPct: null,
};

type Listener = (s: SessionSnapshot) => void;

/**
 * Drives the live loop: grab a crop of the video, run the detector, feed the
 * result to the measurement pipeline and publish a snapshot for the UI. All
 * processing happens on the device; frames are never stored or uploaded.
 */
export class MonocleSession {
  private pipeline: MeasurementPipeline;
  private grabber = new RoiGrabber();
  private listeners = new Set<Listener>();
  private running = false;
  private paused = false;
  private rafId: number | null = null;
  private vfcId: number | null = null;
  private lastAnalysisAt = 0;
  private lastEmitAt = 0;
  private startedAt = 0;
  private ring: RingEntry[] = [];
  private procTimes: number[] = [];
  private analysisTimes: number[] = [];
  private camFrames = 0;
  private camFrameWindowStart = 0;
  private camFps: number | null = null;
  private prior: { xBase: number; yTop: number; yBase: number } | null = null;
  private snapshot: SessionSnapshot;
  private frames = 0;
  private locks = 0;
  private brackets = 0;
  private maxLocked: number | null = null;
  private slowFrames = 0;
  /** Called when processing is persistently too slow; the page can restart the camera at a lower resolution. */
  onSlow?: () => void;

  constructor(private deps: SessionDeps) {
    this.pipeline = new MeasurementPipeline(deps.optics);
    this.snapshot = this.emptySnapshot();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  getSnapshot() {
    return this.snapshot;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.startedAt = performance.now();
    this.camFrameWindowStart = this.startedAt;
    this.pipeline.reset();
    this.pipeline.setMaxYards(this.deps.maxYards());
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    const v = this.deps.video as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
    if (this.vfcId != null) v.cancelVideoFrameCallback?.(this.vfcId);
    this.rafId = null;
    this.vfcId = null;
    this.ring = [];
    this.publish(true);
  }

  pause() {
    this.paused = true;
    this.publish(true);
  }

  resume() {
    this.paused = false;
    this.pipeline.reset();
    this.ring = [];
    this.publish(true);
  }

  summary(): SessionSummary {
    const v = this.deps.video;
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    return {
      durationMs: Math.round(performance.now() - this.startedAt),
      frames: this.frames,
      locks: this.locks,
      brackets: this.brackets,
      avgProcMs: Math.round(avg(this.procTimes) * 10) / 10,
      avgFps: this.camFps,
      camWidth: v.videoWidth,
      camHeight: v.videoHeight,
      maxLockedYards: this.maxLocked,
    };
  }

  // ---- live loop --------------------------------------------------------

  private schedule() {
    if (!this.running) return;
    const v = this.deps.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number;
    };
    if (typeof v.requestVideoFrameCallback === "function") {
      this.vfcId = v.requestVideoFrameCallback(() => this.tick());
    } else {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  }

  private tick() {
    if (!this.running) return;
    this.schedule();
    const now = performance.now();

    this.camFrames++;
    if (now - this.camFrameWindowStart >= 1000) {
      this.camFps = (this.camFrames * 1000) / (now - this.camFrameWindowStart);
      this.camFrames = 0;
      this.camFrameWindowStart = now;
    }

    if (this.paused || this.deps.detector.busy) return;
    if (now - this.lastAnalysisAt < 1000 / ANALYSIS.targetHz - 4) return;
    void this.analyze(now);
  }

  private async analyze(now: number) {
    const video = this.deps.video;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2) return;
    const container = this.deps.container();
    if (!container.w || !container.h) return;

    this.lastAnalysisAt = now;
    const roi = analysisRoi({ w: vw, h: vh }, container);
    const motion = this.deps.motion.snapshot();
    const roll = motion.rollRad ?? 0;

    let frame: ImageData;
    try {
      frame = this.grabber.grab(video, { w: vw, h: vh }, roi, roll);
    } catch {
      return; // the video can briefly refuse to be read while it restarts
    }

    let out;
    try {
      out = await this.deps.detector.detect(frame, this.prior);
    } catch {
      return;
    }
    if (!this.running || this.paused) return;

    const tDone = performance.now();
    this.frames++;
    this.procTimes.push(out.ms);
    if (this.procTimes.length > 60) this.procTimes.shift();
    this.analysisTimes.push(tDone);
    if (this.analysisTimes.length > 30) this.analysisTimes.shift();

    const res = this.pipeline.process(out.result, {
      t: tDone,
      longSide: Math.max(vw, vh),
      shakeDps: motion.shakeDps,
      elevationRad: motion.elevationRad,
    });
    this.prior = res.prior;
    if (res.newLock) {
      this.locks++;
    }
    if (res.locked && res.reading.yards != null) this.maxLocked = Math.max(this.maxLocked ?? 0, res.reading.yards);

    const best = out.result.best;
    this.ring.push({
      image: frame,
      roi,
      roll,
      elevation: motion.elevationRad ?? 0,
      sharpness: out.result.stats.sharpness,
      shake: motion.shakeDps ?? 0,
      t: tDone,
      suggestion: best ? { xTop: best.xTop, yTop: best.yTop, xBase: best.xBase, yBase: best.yBase } : null,
    });
    while (this.ring.length > ANALYSIS.bracketBufferFrames) this.ring.shift();

    // Processing that cannot keep up is worse than a lower resolution.
    if (out.ms > 90) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames >= 20) {
      this.slowFrames = 0;
      this.onSlow?.();
    }

    const overlay: DetectionOverlay | null = res.overlay
      ? (() => {
          const o = res.overlay;
          const top = cropPointToVideo({ x: o.xTop, y: o.yTop }, roi, roll);
          const base = cropPointToVideo({ x: o.xBase, y: o.yBase }, roi, roll);
          return {
            xTop: top.x,
            yTop: top.y,
            xBase: base.x,
            yBase: base.y,
            heightPx: o.heightPx,
            flagEvidence: o.flagEvidence,
            ambiguous: o.ambiguous,
            confidence: o.confidence,
          };
        })()
      : null;

    const sortedProc = [...this.procTimes].sort((a, b) => a - b);
    const hz =
      this.analysisTimes.length > 1
        ? ((this.analysisTimes.length - 1) * 1000) / (this.analysisTimes[this.analysisTimes.length - 1] - this.analysisTimes[0])
        : 0;
    const debug: DebugInfo = {
      camWidth: vw,
      camHeight: vh,
      camFps: this.camFps,
      analysisHz: hz,
      procMsAvg: this.procTimes.reduce((a, b) => a + b, 0) / this.procTimes.length,
      procMsP95: sortedProc[Math.min(sortedProc.length - 1, Math.floor(sortedProc.length * 0.95))],
      usingWorker: this.deps.detector.usingWorker,
      roi,
      focalRatio: this.deps.optics().focalRatio,
      rawYards: res.rawYards,
      heightPx: res.heightPx,
      score: res.score,
      rollDeg: motion.rollRad != null ? (motion.rollRad * 180) / Math.PI : null,
      elevationDeg: motion.elevationRad != null ? (motion.elevationRad * 180) / Math.PI : null,
      shakeDps: motion.shakeDps,
      meanLuma: out.result.stats.meanLuma,
      candidates: out.result.candidates.map((c) => ({
        xBase: c.xBase,
        yTop: c.yTop,
        yBase: c.yBase,
        heightPx: c.heightPx,
        score: c.score,
        rank: c.rank,
        flagEvidence: c.flagEvidence,
        clipped: c.clipped,
        topAmbiguous: c.topAmbiguous,
      })),
    };

    this.snapshot = {
      running: this.running,
      paused: this.paused,
      reading: res.reading,
      far: res.far,
      detection: overlay,
      hint: res.hint,
      lighting: res.lighting,
      shaking: res.shaking,
      motionAvailable: motion.available,
      bracketOffered: res.bracketOffered,
      calibrated: this.deps.optics().calibrated,
      debug,
    };
    this.publish(res.newLock || res.reading.status !== "locked");
  }

  private publish(force = false) {
    const now = performance.now();
    if (!force && now - this.lastEmitAt < 80) return;
    this.lastEmitAt = now;
    this.snapshot = { ...this.snapshot, running: this.running, paused: this.paused };
    for (const l of this.listeners) l(this.snapshot);
  }

  private emptySnapshot(): SessionSnapshot {
    return {
      running: false,
      paused: false,
      reading: EMPTY_READING,
      far: false,
      detection: null,
      hint: "point-at-flag",
      lighting: "ok",
      shaking: false,
      motionAvailable: false,
      bracketOffered: false,
      calibrated: false,
      debug: {
        camWidth: 0,
        camHeight: 0,
        camFps: null,
        analysisHz: 0,
        procMsAvg: 0,
        procMsP95: 0,
        usingWorker: false,
        roi: null,
        focalRatio: 0,
        rawYards: null,
        heightPx: null,
        score: null,
        rollDeg: null,
        elevationDeg: null,
        shakeDps: null,
        meanLuma: null,
        candidates: [],
      },
    };
  }

  // ---- tap to bracket and calibration -------------------------------------

  /** Pick the sharpest recent frame (least blur, least rotation) and pause the live loop. */
  freezeForBracket(): BracketFrame | null {
    if (this.ring.length === 0) return null;
    const score = (e: RingEntry) => e.sharpness / (1 + e.shake / 15);
    const best = this.ring.reduce((a, b) => (score(b) > score(a) ? b : a));
    const suggestion = best.suggestion ?? [...this.ring].reverse().find((e) => e.suggestion)?.suggestion ?? null;
    this.pause();
    this.brackets++;
    return {
      image: best.image,
      roi: best.roi,
      rollRad: best.roll,
      elevationRad: best.elevation,
      suggestion,
      longSide: Math.max(this.deps.video.videoWidth, this.deps.video.videoHeight),
    };
  }

  /** Distance from two hand-placed (and edge-snapped) ends on a frozen frame. */
  async measureBracket(frame: BracketFrame, handles: BracketHandles): Promise<BracketResult | null> {
    const { result } = await this.deps.detector.measureFromHints(frame.image, handles);
    if (!result) return null;
    const optics = this.deps.optics();
    const focalPx = focalPxFromRatio(frame.longSide, optics.focalRatio);
    const elevation = clamp(frame.elevationRad, -0.44, 0.44);
    const yards = distanceYards({ heightPx: result.heightPx, stickHeightIn: optics.stickHeightIn, focalPx, elevationRad: elevation });
    if (!Number.isFinite(yards)) return null;
    const sigma = distanceSigmaYards({
      heightPx: result.heightPx,
      distanceYds: yards,
      endpointSigmaPx: result.snappedTop && result.snappedBase ? 0.5 : 0.9,
      calibrated: optics.calibrated,
      stickHeightFromUser: optics.stickFromUser,
    });
    return {
      yards,
      plusMinus: Math.max(1, Math.round(sigma)),
      heightPx: result.heightPx,
      handles: { xTop: result.xTop, yTop: result.yTop, xBase: result.xBase, yBase: result.yBase },
      snapped: result.snappedTop || result.snappedBase,
    };
  }

  /** Focal ratio from a bracketed object of known height at a known distance. */
  async calibrate(
    frame: BracketFrame,
    handles: BracketHandles,
    known: { objectHeightIn: number; distanceIn: number },
  ): Promise<{ ratio: number; heightPx: number } | null> {
    const { result } = await this.deps.detector.measureFromHints(frame.image, handles);
    const heightPx = result?.heightPx ?? Math.hypot(handles.xBase - handles.xTop, handles.yBase - handles.yTop);
    const ratio = focalRatioFromMeasurement({
      heightPx,
      objectHeightIn: known.objectHeightIn,
      distanceIn: known.distanceIn,
      longSidePx: frame.longSide,
      elevationRad: clamp(frame.elevationRad, -0.44, 0.44),
    });
    return ratio == null ? null : { ratio, heightPx };
  }
}
