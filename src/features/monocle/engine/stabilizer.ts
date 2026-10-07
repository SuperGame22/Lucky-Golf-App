import { RANGE, STABILIZER } from "../config/constants";
import { displayPlusMinus } from "./distance";

export interface StabilizerSample {
  /** Milliseconds, any monotonic clock. */
  t: number;
  yards: number;
  /** Frame-to-frame pixel noise contribution (1 sigma, yards). Averages down. */
  sigmaPixel: number;
  /** Focal-length and stick-height contribution (1 sigma, yards). Does not average down. */
  sigmaSystematic: number;
  confidence: number;
}

export type ReadingStatus = "searching" | "locking" | "locked" | "stale";

export interface StabilizedReading {
  status: ReadingStatus;
  /** Integer yards to display, or null while there is nothing trustworthy to show. */
  yards: number | null;
  plusMinus: number | null;
  /** 0..1 */
  confidence: number;
  samples: number;
  medianYards: number | null;
  stdErrPct: number | null;
  spreadPct: number | null;
}

const EMPTY: StabilizedReading = {
  status: "searching",
  yards: null,
  plusMinus: null,
  confidence: 0,
  samples: 0,
  medianYards: null,
  stdErrPct: null,
  spreadPct: null,
};

function weightedMedian(values: number[], weights: number[]): number {
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (const i of idx) {
    acc += weights[i];
    if (acc >= total / 2) return values[i];
  }
  return values[idx[idx.length - 1]];
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Turns a noisy stream of per-frame distances into one steady number.
 *
 *  - pools samples over a short window and takes a confidence-weighted median
 *  - throws out outliers (a frame that latched onto a branch or a shadow)
 *  - only reports "locked" once the *standard error of the estimate* is small
 *  - moves the displayed integer only when the estimate has clearly moved, so
 *    86/87/87/88/87 reads 87 instead of flickering
 *  - re-locks quickly when the user swings to a different target
 */
export class DistanceStabilizer {
  private samples: StabilizerSample[] = [];
  private shown: number | null = null;
  private lastSampleAt = -Infinity;
  private failingSince: number | null = null;
  private gaps: number[] = [];

  reset() {
    this.samples = [];
    this.shown = null;
    this.lastSampleAt = -Infinity;
    this.failingSince = null;
    this.gaps = [];
  }

  /**
   * Windows and timeouts are tuned for ~12 samples a second. On a slow device or
   * camera they stretch, so a phone that manages 3 a second locks a little more
   * slowly instead of never.
   */
  private timing() {
    const dt = this.gaps.length ? median(this.gaps) : 1000 / 12;
    return {
      window: Math.min(8000, Math.max(STABILIZER.windowMs, STABILIZER.minSamples * dt * 1.25)),
      stale: Math.max(STABILIZER.staleMs, 2.5 * dt),
      dropout: Math.max(STABILIZER.dropoutMs, 1.6 * dt),
    };
  }

  push(sample: StabilizerSample | null, t: number): StabilizedReading {
    if (sample) {
      if (Number.isFinite(this.lastSampleAt)) {
        this.gaps.push(t - this.lastSampleAt);
        if (this.gaps.length > 6) this.gaps.shift();
      }
      this.samples.push(sample);
      this.lastSampleAt = t;
    }
    const timing = this.timing();
    this.samples = this.samples.filter((s) => t - s.t <= timing.window);

    // Lost the target for good: forget everything so the next lock starts clean.
    if (t - this.lastSampleAt > timing.stale) {
      const hadValue = this.shown != null;
      this.samples = [];
      this.shown = null;
      this.failingSince = null;
      this.gaps = [];
      return hadValue ? { ...EMPTY } : EMPTY;
    }

    // A gap longer than a few frames: keep the number but show that it is not live.
    if (this.shown != null && t - this.lastSampleAt > timing.dropout) {
      const stats = this.samples.length ? this.stats() : null;
      return {
        ...EMPTY,
        status: "stale",
        yards: this.shown,
        samples: stats?.n ?? 0,
        medianYards: stats?.median ?? null,
        confidence: (stats?.meanConf ?? 0) * 0.6,
      };
    }

    this.handleJump();

    if (this.samples.length === 0) return this.stale(EMPTY);

    const stats = this.stats();
    const meetsLock =
      stats.n >= STABILIZER.minSamples &&
      stats.inlierFraction >= STABILIZER.minInlierFraction &&
      stats.stdErrPct <= STABILIZER.maxStdErrPct &&
      stats.spreadPct <= STABILIZER.maxSpreadPct &&
      stats.meanConf >= STABILIZER.minConfidence;

    const base = {
      samples: stats.n,
      medianYards: stats.median,
      stdErrPct: stats.stdErrPct,
      spreadPct: stats.spreadPct,
    };

    if (meetsLock) {
      this.failingSince = null;
      if (this.shown == null || Math.abs(stats.median - this.shown) >= STABILIZER.displayHysteresisYards) {
        this.shown = Math.round(stats.median);
      }
      const nEff = Math.min(stats.n, 4);
      const sigmaPix = median(this.samples.map((s) => s.sigmaPixel));
      const sigmaSys = median(this.samples.map((s) => s.sigmaSystematic));
      const sigma = Math.hypot(sigmaSys, sigmaPix / Math.sqrt(nEff));
      const consistency = 1 - Math.min(1, stats.stdErrPct / (STABILIZER.maxStdErrPct * 2));
      return {
        ...base,
        status: "locked",
        yards: this.shown,
        plusMinus: displayPlusMinus(sigma),
        confidence: stats.meanConf * (0.6 + 0.4 * consistency),
      };
    }

    // A previously locked value survives a brief wobble, dimmed, instead of vanishing.
    if (this.shown != null) {
      if (this.failingSince == null) this.failingSince = t;
      if (t - this.failingSince <= timing.stale) {
        return { ...base, status: "stale", yards: this.shown, plusMinus: null, confidence: stats.meanConf * 0.6 };
      }
      this.shown = null;
    }
    return { ...base, status: "locking", yards: null, plusMinus: null, confidence: stats.meanConf };
  }

  private stale(base: StabilizedReading): StabilizedReading {
    if (this.shown == null) return base;
    return { ...base, status: "stale", yards: this.shown };
  }

  /** If the latest few samples agree with each other but not with the shown value, the user moved targets. */
  private handleJump() {
    if (this.shown == null || this.samples.length < 4) return;
    const recent = this.samples.slice(-4);
    const gate = Math.max(STABILIZER.jumpYards, STABILIZER.jumpPct * this.shown);
    if (!recent.every((s) => Math.abs(s.yards - this.shown!) > gate)) return;
    const m = median(recent.map((s) => s.yards));
    if (!recent.every((s) => Math.abs(s.yards - m) <= 0.05 * m)) return;
    this.samples = recent;
    this.shown = null;
    this.failingSince = null;
  }

  private stats() {
    const ys = this.samples.map((s) => s.yards);
    const ws = this.samples.map((s) => Math.max(0.05, s.confidence));
    const m0 = weightedMedian(ys, ws);
    const mad0 = median(ys.map((y) => Math.abs(y - m0)));
    const gate = Math.max(3 * 1.4826 * mad0, 0.025 * m0, 1);
    const keep = this.samples.filter((s) => Math.abs(s.yards - m0) <= gate);
    const yk = keep.map((s) => s.yards);
    const wk = keep.map((s) => Math.max(0.05, s.confidence));
    const m = weightedMedian(yk, wk);
    const mad = median(yk.map((y) => Math.abs(y - m)));
    const spreadPct = Math.max(0.004, (1.4826 * mad) / Math.max(1, m));
    const n = keep.length;
    const stdErrPct = (spreadPct * 1.2533) / Math.sqrt(Math.max(1, n));
    const meanConf = keep.reduce((s, k) => s + k.confidence, 0) / Math.max(1, n);
    return { median: m, spreadPct, stdErrPct, n, meanConf, inlierFraction: n / Math.max(1, this.samples.length) };
  }
}

/**
 * Decides whether a distance is "wedge range", with hysteresis so a reading
 * hovering around the cut-off doesn't flip between a club and the warning.
 */
export class RangeGate {
  private far = false;

  constructor(
    private maxYards: number = RANGE.wedgeMaxYards,
    private band: number = RANGE.wedgeBandYards,
  ) {}

  setMax(maxYards: number) {
    this.maxYards = maxYards;
  }

  update(shownYards: number | null): boolean {
    if (shownYards == null) return this.far;
    if (!this.far && shownYards > this.maxYards) this.far = true;
    else if (this.far && shownYards <= this.maxYards - this.band) this.far = false;
    return this.far;
  }

  reset() {
    this.far = false;
  }
}
