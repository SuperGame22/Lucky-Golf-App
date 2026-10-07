/**
 * Flagstick detector: finds a thin, near-vertical line in a small crop of the
 * camera frame and measures its length to sub-pixel precision.
 *
 * Why classic image processing instead of a neural network:
 *  - there is no off-the-shelf flagstick model, and a trained detector would
 *    still only give a box, not a pixel-accurate top and base;
 *  - the distance error is dominated by endpoint precision (1 px at 100 yd is
 *    ~3 yd), so the measurement step has to be geometric anyway;
 *  - the user aims at the flag, so we only search a narrow crop. That keeps
 *    this to a few milliseconds even on older phones.
 *
 * Pipeline (all on the crop, in a worker when available):
 *   1. luma
 *   2. ridge map: "brighter (or darker) than both horizontal neighbours", at
 *      three widths, each normalised by its own background noise
 *   3. per column and tilt, a 1-D max-sum search (Kadane) up the column finds
 *      the strongest uninterrupted vertical run
 *   4. sub-pixel endpoint refinement from the run's profile
 *   5. flag-blob evidence near the top, used as a bonus, never a requirement
 */

export interface DetectorOptions {
  /** Ridge half-widths in pixels. 1..3 covers a stick from ~8 to 120 yd. */
  scales: number[];
  /** Tilts to try, in degrees; roll compensation handles the bulk of any lean. */
  slopesDeg: number[];
  /** Baseline subtracted per pixel in the run search (in noise-normalised units). */
  tau: number;
  /** Cap per pixel so one saturated row cannot carry a run. */
  zCap: number;
  minLengthPx: number;
  /** Minimum run score to report a candidate. */
  minScore: number;
  /** Candidates near the previous detection need only this fraction of minScore. */
  priorFactor: number;
  maxCandidates: number;
}

export const DEFAULT_DETECTOR_OPTIONS: DetectorOptions = {
  scales: [1, 2, 3],
  slopesDeg: [-3, -1.5, 0, 1.5, 3],
  tau: 1.0,
  zCap: 4,
  minLengthPx: 10,
  minScore: 20,
  priorFactor: 0.7,
  maxCandidates: 4,
};

export interface Prior {
  xBase: number;
  yTop: number;
  yBase: number;
}

export interface DetectInput {
  /** RGBA pixels of the crop. */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  prior?: Prior | null;
}

export interface Candidate {
  xTop: number;
  yTop: number;
  xBase: number;
  yBase: number;
  heightPx: number;
  /** Run-search score: how much stronger than background this line is, summed along its length. */
  score: number;
  /** Score after centrality, flag and tracking weights; used to choose between candidates. */
  rank: number;
  /** 0..1 */
  flagEvidence: number;
  /** The run touches the edge of the crop, so its length is not trustworthy. */
  clipped: boolean;
  /**
   * The top of the line sits exactly on a sharp change in background (typically
   * the horizon). A pale stick can vanish against bright sky, so the real top
   * may be higher than measured; the reading should not be trusted.
   */
  topAmbiguous: boolean;
  slopeDeg: number;
}

export interface FrameStats {
  meanLuma: number;
  clipHigh: number;
  clipLow: number;
  /** Mean squared gradient; higher is sharper. */
  sharpness: number;
}

export interface DetectionResult {
  best: Candidate | null;
  candidates: Candidate[];
  stats: FrameStats;
}

/** Rows per noise-normalisation band, and the floor on the noise level (8-bit levels). */
const BAND_ROWS = 64;
const NOISE_FLOOR = 4;
const RANK_SCORE_CAP = 150;
/** Minimum quality for a fitted edge to replace the coarse run end. */
const EDGE_QUALITY_MIN = 0.5;
/** In tap-to-bracket, an end is only nudged this far from where the user put it. */
const HAND_SNAP_PX = 2.5;
/** RGB distance above which a background change at the top of the line is treated as an edge. */
const BACKGROUND_EDGE_DIST = 45;

interface RawRun {
  x: number;
  slopeIdx: number;
  start: number;
  end: number;
  score: number;
}

export class StickDetector {
  private opts: DetectorOptions;
  private w = 0;
  private h = 0;
  private luma = new Uint8Array(0);
  private q = new Uint8Array(0);
  private z = new Float32Array(0);
  private bandHist = new Uint32Array(0);

  constructor(options: Partial<DetectorOptions> = {}) {
    this.opts = { ...DEFAULT_DETECTOR_OPTIONS, ...options };
  }

  detect(input: DetectInput): DetectionResult {
    const { width: w, height: h, data } = input;
    this.alloc(w, h);
    const stats = this.computeLuma(data, w, h);
    this.computeRidgeMap(w, h);
    const runs = this.findRuns(w, h, input.prior ?? null);
    const candidates = this.refineAndRank(runs, data, w, h, input.prior ?? null);
    return { best: candidates[0] ?? null, candidates, stats };
  }

  /**
   * Re-measure a stick whose approximate ends the user marked by hand (tap to
   * bracket). Each end is nudged to the nearest clear edge within a few pixels,
   * and left exactly where the user put it if there is no clear edge.
   */
  measureFromHints(
    input: DetectInput,
    hint: { xTop: number; yTop: number; xBase: number; yBase: number },
  ): (Candidate & { snappedTop: boolean; snappedBase: boolean }) | null {
    const { width: w, height: h, data } = input;
    const dy = hint.yBase - hint.yTop;
    if (!(dy >= 4)) return null;
    this.alloc(w, h);
    this.computeLuma(data, w, h);
    this.computeRidgeMap(w, h);
    const slopeX = (hint.xBase - hint.xTop) / dy;
    const xAt = (y: number) => hint.xTop + (y - hint.yTop) * slopeX;
    const start = Math.max(0, Math.min(h - 1, Math.round(hint.yTop)));
    const end = Math.max(start + 1, Math.min(h - 1, Math.round(hint.yBase) - 1));
    const run: RawRun = { x: Math.round(xAt((start + end) / 2)), slopeIdx: -1, start, end, score: 0 };
    const ends = this.refineEnds(run, xAt, w, h);
    // A visible flag edge wins over the (flag-dimmed) line response for the top.
    const flag = analyzeFlag(data, w, h, xAt, ends.yTop, ends.yBase);
    let candTop: number | null = ends.topFit ? ends.yTop : null;
    if (flag.topEdge != null && Math.abs(flag.topEdge - hint.yTop) <= HAND_SNAP_PX) candTop = flag.topEdge;
    const snappedTop = candTop != null && Math.abs(candTop - hint.yTop) <= HAND_SNAP_PX;
    const snappedBase = ends.baseFit && Math.abs(ends.yBase - hint.yBase) <= HAND_SNAP_PX;
    const yTop = snappedTop ? (candTop as number) : hint.yTop;
    const yBase = snappedBase ? ends.yBase : hint.yBase;
    return {
      xTop: xAt(yTop),
      yTop,
      xBase: xAt(yBase),
      yBase,
      heightPx: Math.hypot(yBase - yTop, xAt(yBase) - xAt(yTop)),
      score: 0,
      rank: 0,
      flagEvidence: flag.evidence,
      clipped: false,
      topAmbiguous: false,
      slopeDeg: (Math.atan(slopeX) * 180) / Math.PI,
      snappedTop,
      snappedBase,
    };
  }

  /** The most recent normalised ridge map, for the debug overlay. */
  ridgeMap(): { z: Float32Array; width: number; height: number } {
    return { z: this.z, width: this.w, height: this.h };
  }

  private alloc(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.luma = new Uint8Array(w * h);
    this.q = new Uint8Array(w * h);
    this.z = new Float32Array(w * h);
  }

  private computeLuma(data: ArrayLike<number>, w: number, h: number): FrameStats {
    const luma = this.luma;
    const n = w * h;
    let sum = 0;
    let hi = 0;
    let lo = 0;
    for (let p = 0, o = 0; p < n; p++, o += 4) {
      const v = (77 * data[o] + 151 * data[o + 1] + 28 * data[o + 2]) >> 8;
      luma[p] = v;
      sum += v;
      if (v >= 250) hi++;
      else if (v <= 5) lo++;
    }
    let grad = 0;
    let gn = 0;
    for (let y = 0; y < h - 1; y += 2) {
      for (let x = 0; x < w - 1; x += 2) {
        const i = y * w + x;
        const dx = luma[i + 1] - luma[i];
        const dy = luma[i + w] - luma[i];
        grad += dx * dx + dy * dy;
        gn++;
      }
    }
    return { meanLuma: sum / n, clipHigh: hi / n, clipLow: lo / n, sharpness: gn ? grad / gn : 0 };
  }

  private computeRidgeMap(w: number, h: number) {
    const { luma, q, z } = this;
    const nb = Math.ceil(h / BAND_ROWS);
    if (this.bandHist.length < nb * 256) this.bandHist = new Uint32Array(nb * 256);
    const bandHist = this.bandHist;
    const bandCount = new Float32Array(nb);
    const norm = new Float32Array(nb);
    const rowNorm = new Float32Array(h);
    z.fill(0);

    for (const d of this.opts.scales) {
      bandHist.fill(0, 0, nb * 256);
      bandCount.fill(0);
      q.fill(0);
      for (let y = 0; y < h; y++) {
        const row = y * w;
        const b = (y / BAND_ROWS) | 0;
        const hb = b * 256;
        for (let x = d; x < w - d; x++) {
          const i = row + x;
          const l = luma[i];
          const a = l - luma[i - d];
          const c = l - luma[i + d];
          let v = 0;
          if (a > 0 && c > 0) v = a < c ? a : c;
          else if (a < 0 && c < 0) v = a > c ? -a : -c;
          q[i] = v;
          bandHist[hb + v]++;
        }
        bandCount[b] += Math.max(0, w - 2 * d);
      }

      // Normalise by the local 95th percentile (per band of rows) so that a smooth
      // sky above a textured fairway does not make the fairway look like a line.
      for (let b = 0; b < nb; b++) {
        const target = bandCount[b] * 0.95;
        let acc = 0;
        let p95 = 0;
        for (let v = 0; v < 256; v++) {
          acc += bandHist[b * 256 + v];
          if (acc >= target) {
            p95 = v;
            break;
          }
        }
        norm[b] = 1 / (Math.max(p95, NOISE_FLOOR) + 1);
      }
      for (let y = 0; y < h; y++) {
        const f = (y - BAND_ROWS / 2) / BAND_ROWS;
        const b0 = Math.max(0, Math.min(nb - 1, Math.floor(f)));
        const b1 = Math.min(nb - 1, b0 + 1);
        const t = Math.max(0, Math.min(1, f - b0));
        rowNorm[y] = norm[b0] * (1 - t) + norm[b1] * t;
      }
      for (let y = 0; y < h; y++) {
        const nr = rowNorm[y];
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const zv = q[row + x] * nr;
          if (zv > z[row + x]) z[row + x] = zv;
        }
      }
    }
  }

  private findRuns(w: number, h: number, prior: Prior | null): RawRun[] {
    const { z } = this;
    const { slopesDeg, tau, zCap, minLengthPx, minScore, priorFactor } = this.opts;
    const mid = h / 2;
    const bestPerColumn: RawRun[] = [];

    for (let x = 1; x < w - 1; x++) {
      let colBest: RawRun | null = null;
      for (let si = 0; si < slopesDeg.length; si++) {
        const t = Math.tan((slopesDeg[si] * Math.PI) / 180);
        let cur = 0;
        let curStart = 0;
        let best = 0;
        let bestStart = 0;
        let bestEnd = -1;
        for (let y = 0; y < h; y++) {
          const xi = t === 0 ? x : Math.round(x + t * (y - mid));
          let v: number;
          if (xi < 0 || xi >= w) v = -tau;
          else {
            const zz = z[y * w + xi];
            v = (zz > zCap ? zCap : zz) - tau;
          }
          if (cur > 0) cur += v;
          else {
            cur = v;
            curStart = y;
          }
          if (cur > best) {
            best = cur;
            bestStart = curStart;
            bestEnd = y;
          }
        }
        if (bestEnd - bestStart + 1 >= minLengthPx && (!colBest || best > colBest.score)) {
          colBest = { x, slopeIdx: si, start: bestStart, end: bestEnd, score: best };
        }
      }
      if (colBest) bestPerColumn.push(colBest);
    }

    const nearPrior = (r: RawRun) => {
      if (!prior) return false;
      const t = Math.tan((slopesDeg[r.slopeIdx] * Math.PI) / 180);
      const xb = r.x + t * (r.end - mid);
      const overlapY = Math.min(r.end, prior.yBase) - Math.max(r.start, prior.yTop);
      return Math.abs(xb - prior.xBase) <= 8 && overlapY > 0.5 * (prior.yBase - prior.yTop);
    };

    const passing = bestPerColumn
      .filter((r) => r.score >= (nearPrior(r) ? minScore * priorFactor : minScore))
      .sort((a, b) => b.score - a.score);

    // Non-maximum suppression: a stick lights up several adjacent columns and tilts.
    // Compare the two runs where they overlap, not at some fixed row.
    const xAtRow = (r: RawRun, y: number) => r.x + Math.tan((slopesDeg[r.slopeIdx] * Math.PI) / 180) * (y - mid);
    const kept: RawRun[] = [];
    for (const r of passing) {
      const dup = kept.some((k) => {
        const lo = Math.max(k.start, r.start);
        const hi = Math.min(k.end, r.end);
        const shorter = Math.min(k.end - k.start, r.end - r.start) + 1;
        if (hi - lo < 0.3 * shorter) return false;
        const y = (lo + hi) / 2;
        return Math.abs(xAtRow(k, y) - xAtRow(r, y)) <= 3;
      });
      if (!dup) kept.push(r);
      if (kept.length >= this.opts.maxCandidates + 2) break;
    }
    return kept;
  }

  private refineAndRank(runs: RawRun[], data: ArrayLike<number>, w: number, h: number, prior: Prior | null): Candidate[] {
    const { slopesDeg, maxCandidates } = this.opts;
    const mid = h / 2;
    const out: Candidate[] = [];

    for (const r of runs) {
      const slope = slopesDeg[r.slopeIdx];
      const t = Math.tan((slope * Math.PI) / 180);
      const xAt = (y: number) => r.x + t * (y - mid);
      const ends = this.refineEnds(r, xAt, w, h);
      let { yTop } = ends;
      const { yBase } = ends;
      const flag = analyzeFlag(data, w, h, xAt, yTop, yBase);
      // The flag dims the line response right where it hangs, so the stick's top is
      // better located by the top of the flag when one is clearly there.
      if (flag.topEdge != null && flag.topEdge < yTop) yTop = flag.topEdge;
      const heightPx = Math.hypot(yBase - yTop, xAt(yBase) - xAt(yTop));
      if (heightPx < this.opts.minLengthPx - 1) continue;
      const flagEvidence = flag.evidence;
      const topAmbiguous = flagEvidence < 0.5 && topAtBackgroundEdge(data, w, h, xAt, yTop, yBase - yTop);
      const clipped = r.start <= 1 || r.end >= h - 2;
      const xMid = xAt((r.start + r.end) / 2);
      const centrality = Math.exp(-(((xMid - w / 2) / (0.4 * w)) ** 2));
      // Capped so a very long line cannot outrank a flagstick on length alone.
      let rank = Math.min(r.score, RANK_SCORE_CAP) * (1 + 0.35 * flagEvidence) * (0.5 + 0.5 * centrality);
      if (prior && Math.abs(xAt(yBase) - prior.xBase) <= 8) rank *= 1.2;
      // A line that runs off the crop is a pole or a trunk, not a flagstick.
      if (clipped) rank *= 0.35;
      out.push({
        xTop: xAt(yTop),
        yTop,
        xBase: xAt(yBase),
        yBase,
        heightPx,
        score: r.score,
        rank,
        flagEvidence,
        clipped,
        topAmbiguous,
        slopeDeg: slope,
      });
    }
    out.sort((a, b) => b.rank - a.rank);
    return out.slice(0, maxCandidates);
  }

  /**
   * Sub-pixel top and base. The line response along the run looks like a
   * plateau between two noisy step edges; for each edge, pick the position
   * that best splits "on the stick" from "background" over a short window on
   * either side (the maximum-likelihood step fit), then interpolate between
   * pixels. Far more stable than "first threshold crossing" when the stick is
   * only a couple of noise-levels above the grass.
   */
  private refineEnds(r: RawRun, xAt: (y: number) => number, w: number, h: number) {
    const { z } = this;
    const pad = 12;
    const y0 = Math.max(0, r.start - pad);
    const y1 = Math.min(h - 1, r.end + pad);
    const n = y1 - y0 + 1;
    const prof = new Float32Array(n);
    for (let y = y0; y <= y1; y++) {
      const xc = Math.round(xAt(y));
      let m = 0;
      for (let dx = -1; dx <= 1; dx++) {
        const xi = xc + dx;
        if (xi >= 0 && xi < w) m = Math.max(m, z[y * w + xi]);
      }
      prof[y - y0] = m > this.opts.zCap ? this.opts.zCap : m;
    }

    const len = r.end - r.start + 1;
    const core0 = r.start - y0 + Math.floor(len * 0.2);
    const core1 = r.end - y0 - Math.floor(len * 0.2);
    const inside = medianOf(prof, core0, core1);
    const outsideTop = medianOf(prof, 0, r.start - y0 - 3);
    const outsideBase = medianOf(prof, r.end - y0 + 3, n - 1);
    const outside =
      Number.isNaN(outsideTop) ? outsideBase : Number.isNaN(outsideBase) ? outsideTop : (outsideTop + outsideBase) / 2;

    let yTop = r.start - 0.5;
    let yBase = r.end + 0.5;
    let topFit = false;
    let baseFit = false;
    if (!Number.isNaN(inside) && !Number.isNaN(outside) && inside - outside > 0.3) {
      const mid = (inside + outside) / 2;
      const contrast = inside - outside;
      const L = Math.max(4, Math.min(12, Math.floor(len * 0.3)));
      const top = stepEdge(prof, mid, r.start - y0, true, L, 8, contrast);
      const base = stepEdge(prof, mid, r.end + 1 - y0, false, L, 8, contrast);
      if (top.quality >= EDGE_QUALITY_MIN) {
        yTop = top.pos + y0;
        topFit = true;
      }
      if (base.quality >= EDGE_QUALITY_MIN) {
        yBase = base.pos + y0;
        baseFit = true;
      }
      if (yBase - yTop < this.opts.minLengthPx - 1) {
        yTop = r.start - 0.5;
        yBase = r.end + 0.5;
        topFit = false;
        baseFit = false;
      }
    }
    return { yTop, yBase, topFit, baseFit };
  }
}

function medianOf(a: Float32Array, i0: number, i1: number): number {
  const lo = Math.max(0, i0);
  const hi = Math.min(a.length - 1, i1);
  if (hi < lo) return NaN;
  const s = Array.from(a.subarray(lo, hi + 1)).sort((x, y) => x - y);
  return s[s.length >> 1];
}

/**
 * Maximum-likelihood location of a step edge near `near`.
 *   top edge  (`topEdge`): `near` is the first row on the stick
 *   base edge:             `near` is the first row below the stick
 * Returns the edge position between pixel rows (parabolic sub-pixel interpolation) and a
 * quality in about 0..1 saying how much like a real edge it was; below ~0.5 it is noise.
 */
function stepEdge(
  prof: Float32Array,
  mid: number,
  near: number,
  topEdge: boolean,
  L: number,
  radius: number,
  contrast: number,
): { pos: number; quality: number } {
  const n = prof.length;
  const score = (t: number): number => {
    // t is the first row of the "second" region (stick for the top edge, background for the base edge).
    let s = 0;
    for (let y = Math.max(0, t - L); y < t; y++) s += topEdge ? mid - prof[y] : prof[y] - mid;
    for (let y = t; y < Math.min(n, t + L); y++) s += topEdge ? prof[y] - mid : mid - prof[y];
    return s;
  };
  let bestT = Math.round(near);
  let bestS = -Infinity;
  const lo = Math.max(1, Math.round(near) - radius);
  const hi = Math.min(n - 1, Math.round(near) + radius);
  for (let t = lo; t <= hi; t++) {
    const sc = score(t);
    if (sc > bestS) {
      bestS = sc;
      bestT = t;
    }
  }
  let offset = 0;
  if (bestT > lo && bestT < hi) {
    const a = score(bestT - 1);
    const c = score(bestT + 1);
    const denom = a - 2 * bestS + c;
    if (denom < -1e-6) offset = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom));
  }
  // A real edge scores about L * contrast; noise scores about zero.
  return { pos: bestT - 0.5 + offset, quality: bestS / (L * Math.max(1e-6, contrast)) };
}

/** Mean RGB over a pixel box, or null if it falls outside the image. */
function boxMean(data: ArrayLike<number>, w: number, h: number, xa: number, xb: number, ya: number, yb: number) {
  const x0 = Math.max(0, Math.round(Math.min(xa, xb)));
  const x1 = Math.min(w - 1, Math.round(Math.max(xa, xb)));
  const y0 = Math.max(0, Math.round(Math.min(ya, yb)));
  const y1 = Math.min(h - 1, Math.round(Math.max(ya, yb)));
  if (x1 < x0 || y1 < y0) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const o = (y * w + x) * 4;
      r += data[o];
      g += data[o + 1];
      b += data[o + 2];
      n++;
    }
  }
  return n ? ([r / n, g / n, b / n] as const) : null;
}

const colorDist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface FlagAnalysis {
  /** 0..1: something flag-sized and differently coloured hangs beside the top of the line. */
  evidence: number;
  /** y of the flag's upper edge when it is clearly there, else null. */
  topEdge: number | null;
}

/**
 * Looks beside the top of the line for a flag. For each row, compares the colour
 * just beside the stick with the colour a little further out; a cloth shows up as
 * a run of rows where the two differ. The same comparison lower down the stick is
 * the control, so background texture cancels.
 */
export function analyzeFlag(
  data: ArrayLike<number>,
  w: number,
  h: number,
  xAt: (y: number) => number,
  yTop: number,
  yBase: number,
): FlagAnalysis {
  const H = yBase - yTop;
  if (H < 10) return { evidence: 0, topEdge: null };
  const inner = 2;
  const outer = Math.max(5, Math.round(0.3 * H));
  const ringW = Math.max(3, Math.round(0.25 * H));

  const y0 = Math.max(1, Math.round(yTop - 0.3 * H));
  const y1 = Math.min(h - 2, Math.round(yTop + 0.35 * H));
  let bestEvidence = 0;
  let bestTop: number | null = null;

  for (const side of [-1, 1] as const) {
    const dev: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const xc = xAt(y);
      const win = boxMean(data, w, h, xc + side * inner, xc + side * outer, y - 1, y + 1);
      const ring = boxMean(data, w, h, xc + side * (outer + 1), xc + side * (outer + ringW), y - 1, y + 1);
      dev.push(win && ring ? colorDist(win, ring) : 0);
    }
    // Control level: the same comparison lower down the stick, where there is no flag.
    const ctrl: number[] = [];
    for (let y = Math.round(yTop + 0.55 * H); y <= Math.round(yTop + 0.85 * H); y++) {
      const xc = xAt(y);
      const win = boxMean(data, w, h, xc + side * inner, xc + side * outer, y - 1, y + 1);
      const ring = boxMean(data, w, h, xc + side * (outer + 1), xc + side * (outer + ringW), y - 1, y + 1);
      if (win && ring) ctrl.push(colorDist(win, ring));
    }
    const ctrlLevel = Math.max(5, ctrl.length ? ctrl.sort((a, b) => a - b)[ctrl.length >> 1] : 5);

    // Peak over the zone where a flag can hang: from just above the top to a third of the way down.
    const zoneLo = Math.max(0, Math.round(yTop - 0.05 * H) - y0);
    const zoneHi = Math.min(dev.length - 1, Math.round(yTop + 0.3 * H) - y0);
    let peak = 0;
    let peakIdx = zoneLo;
    for (let i = zoneLo; i <= zoneHi; i++) {
      if (dev[i] > peak) {
        peak = dev[i];
        peakIdx = i;
      }
    }
    // A flag is a small blob: the difference must fall back to the control level a little way
    // below the top. A difference that persists is background structure (a tree line, a horizon).
    const tailLo = Math.max(0, Math.round(yTop + 0.22 * H) - y0);
    const tailHi = Math.min(dev.length - 1, Math.round(yTop + 0.35 * H) - y0);
    const tail = dev.slice(tailLo, tailHi + 1).sort((a, b) => a - b);
    const tailLevel = tail.length ? tail[tail.length >> 1] : ctrlLevel;
    const localised = tailLevel - ctrlLevel < 0.5 * (peak - ctrlLevel);
    const evidence = Math.min(1, Math.max(0, (peak - ctrlLevel) / 45)) * (localised ? 1 : 0.25);
    if (evidence <= bestEvidence) continue;
    bestEvidence = evidence;
    bestTop = null;
    if (evidence >= 0.3) {
      const thr = ctrlLevel + 0.5 * (peak - ctrlLevel);
      for (let i = 1; i <= peakIdx; i++) {
        if (dev[i] >= thr && dev[Math.min(dev.length - 1, i + 1)] >= thr) {
          const a = dev[i - 1];
          const pos = a >= thr ? i : i - 1 + (thr - a) / (dev[i] - a);
          bestTop = y0 + pos;
          break;
        }
      }
      // Only trust a flag edge that is near where the line says the top is.
      if (bestTop != null && (bestTop > yTop + 0.1 * H || bestTop < yTop - 0.3 * H)) bestTop = null;
    }
  }
  return { evidence: bestEvidence, topEdge: bestTop };
}

/**
 * True when the colour just above the top of the line differs sharply from the
 * colour just below it, i.e. the line ends exactly where the background changes.
 */
export function topAtBackgroundEdge(
  data: ArrayLike<number>,
  w: number,
  h: number,
  xAt: (y: number) => number,
  yTop: number,
  H: number,
): boolean {
  if (H < 10) return false;
  const span = Math.max(4, Math.round(0.15 * H));
  const inner = 3;
  const outer = Math.max(7, Math.round(0.3 * H));
  let worst = 0;
  for (const side of [-1, 1] as const) {
    const xa = xAt(yTop) + side * inner;
    const xb = xAt(yTop) + side * outer;
    const above = boxMean(data, w, h, xa, xb, yTop - span, yTop - 1);
    const below = boxMean(data, w, h, xa, xb, yTop + 1, yTop + span);
    if (above && below) worst = Math.max(worst, colorDist(above, below));
  }
  return worst > BACKGROUND_EDGE_DIST;
}
