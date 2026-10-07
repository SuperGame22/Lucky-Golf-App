import { STICK } from "../config/constants";

/**
 * Physically-motivated synthetic frames for testing the detector.
 *
 * A stick at 100 yd is ~0.3 px wide, so it is rendered by analytic area
 * coverage (not drawn as a line), blurred by an optical PSF, composited over a
 * textured background and finally hit with sensor noise. That reproduces the
 * "faint, sub-pixel line" problem the detector actually faces.
 */

export interface SynthOptions {
  width: number;
  height: number;
  distanceYd: number;
  focalPx: number;
  stickHeightIn?: number;
  /** y of the stick base (px). Default 80% down the frame. */
  baseY?: number;
  centerX?: number;
  tiltDeg?: number;
  background?: "grass" | "sky-grass" | "trees-grass";
  /** Row where the grass ends and sky/trees start. Default: 60% of the stick above its base. */
  horizonY?: number;
  /** 0-255 luma of the stick paint. */
  stickLuma?: number;
  flag?: boolean;
  flagColor?: [number, number, number];
  /** Per-pixel sensor noise, 8-bit levels. */
  noiseSigma?: number;
  /** Grass texture strength, 8-bit levels. */
  textureSigma?: number;
  /** Optical blur sigma in pixels. */
  blurSigma?: number;
  seed?: number;
}

export interface SynthTruth {
  yTop: number;
  yBase: number;
  heightPx: number;
  xBase: number;
  xTop: number;
  stickWidthPx: number;
}

export interface SynthFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  truth: SynthTruth;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianSource(rand: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare != null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/** Overlap length of [a0,a1] with [b0,b1]. */
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

function blurInPlace(buf: Float32Array, w: number, h: number, sigma: number) {
  if (sigma <= 0.05) return;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(buf.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < w) acc += buf[y * w + xx] * k[i + r];
      }
      tmp[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < h) acc += tmp[yy * w + x] * k[i + r];
      }
      buf[y * w + x] = acc;
    }
  }
}

export function renderSynthRoi(opts: SynthOptions): SynthFrame {
  const { width: w, height: h } = opts;
  const rand = mulberry32(opts.seed ?? 1);
  const gauss = gaussianSource(rand);

  const stickIn = opts.stickHeightIn ?? STICK.defaultHeightIn;
  const heightPx = (stickIn / 36) * opts.focalPx / opts.distanceYd;
  const scalePxPerIn = opts.focalPx / (opts.distanceYd * 36);
  const stickWidthPx = STICK.diameterIn * scalePxPerIn;
  const baseY = opts.baseY ?? h * 0.8;
  const yTop = baseY - heightPx;
  const cx = opts.centerX ?? w / 2;
  const tan = Math.tan(((opts.tiltDeg ?? 0) * Math.PI) / 180);
  const xAt = (y: number) => cx + tan * (y - baseY);

  const bg = opts.background ?? "grass";
  const horizonY = opts.horizonY ?? baseY - heightPx * 0.6;
  // One pixel covers more ground the further away the stick is, so fine turf texture
  // averages out: ~12 levels at 20 yd falling to ~5 at 100 yd.
  const textureSigma = opts.textureSigma ?? Math.min(12, Math.max(4, 12 * Math.sqrt(20 / opts.distanceYd)));
  const noiseSigma = opts.noiseSigma ?? 5;

  // Background: vertically-correlated texture reads like grass blades.
  const rgb = new Float32Array(w * h * 3);
  const streak = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    const mow = 6 * Math.sin(y / 23);
    for (let x = 0; x < w; x++) {
      streak[x] = 0.62 * streak[x] + 0.78 * gauss();
      const tex = textureSigma * streak[x];
      let r: number;
      let g: number;
      let b: number;
      if (y >= horizonY) {
        r = 58 + mow * 0.4 + tex * 0.6;
        g = 112 + mow + tex;
        b = 42 + mow * 0.3 + tex * 0.5;
      } else if (bg === "sky-grass") {
        const t = y / Math.max(1, horizonY);
        r = 150 + 40 * t;
        g = 190 + 30 * t;
        b = 235 + 10 * t;
        r += gauss() * 3;
        g += gauss() * 3;
        b += gauss() * 3;
      } else if (bg === "trees-grass") {
        const blob = 14 * Math.sin(x / 5.3 + y / 7.1) + 10 * Math.sin(x / 2.9 - y / 3.7);
        r = 30 + blob * 0.4 + tex * 0.8;
        g = 58 + blob + tex * 1.1;
        b = 30 + blob * 0.3 + tex * 0.6;
      } else {
        r = 58 + tex * 0.6;
        g = 112 + tex;
        b = 42 + tex * 0.5;
      }
      const i = (y * w + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }

  // Stick coverage.
  const alphaStick = new Float32Array(w * h);
  const y0 = Math.max(0, Math.floor(yTop) - 1);
  const y1 = Math.min(h - 1, Math.ceil(baseY) + 1);
  for (let y = y0; y <= y1; y++) {
    const cy = overlap(y - 0.5, y + 0.5, yTop, baseY);
    if (cy <= 0) continue;
    const xc = xAt(y);
    const xa = Math.max(0, Math.floor(xc - stickWidthPx - 1));
    const xb = Math.min(w - 1, Math.ceil(xc + stickWidthPx + 1));
    for (let x = xa; x <= xb; x++) {
      alphaStick[y * w + x] = cy * overlap(x - 0.5, x + 0.5, xc - stickWidthPx / 2, xc + stickWidthPx / 2);
    }
  }

  // Flag coverage (a 14 x 10 in cloth hanging off the top, to the right).
  const alphaFlag = new Float32Array(w * h);
  if (opts.flag) {
    const fw = 14 * scalePxPerIn;
    const fh = 10 * scalePxPerIn;
    const fx0 = xAt(yTop) + stickWidthPx / 2;
    const fx1 = fx0 + fw;
    const fy0 = yTop;
    const fy1 = yTop + fh;
    for (let y = Math.max(0, Math.floor(fy0) - 1); y <= Math.min(h - 1, Math.ceil(fy1) + 1); y++) {
      const cy = overlap(y - 0.5, y + 0.5, fy0, fy1);
      if (cy <= 0) continue;
      for (let x = Math.max(0, Math.floor(fx0) - 1); x <= Math.min(w - 1, Math.ceil(fx1) + 1); x++) {
        alphaFlag[y * w + x] = cy * overlap(x - 0.5, x + 0.5, fx0, fx1);
      }
    }
  }

  const blur = opts.blurSigma ?? 0.7;
  blurInPlace(alphaStick, w, h, blur);
  blurInPlace(alphaFlag, w, h, blur);

  const sl = opts.stickLuma ?? 240;
  const fc = opts.flagColor ?? [225, 45, 40];
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 3;
    const as = Math.min(1, alphaStick[p]);
    const af = Math.min(1, alphaFlag[p]);
    let r = rgb[i] * (1 - as) + sl * as;
    let g = rgb[i + 1] * (1 - as) + sl * as;
    let b = rgb[i + 2] * (1 - as) + sl * as;
    r = r * (1 - af) + fc[0] * af;
    g = g * (1 - af) + fc[1] * af;
    b = b * (1 - af) + fc[2] * af;
    const o = p * 4;
    out[o] = r + gauss() * noiseSigma;
    out[o + 1] = g + gauss() * noiseSigma;
    out[o + 2] = b + gauss() * noiseSigma;
    out[o + 3] = 255;
  }

  return {
    data: out,
    width: w,
    height: h,
    truth: { yTop, yBase: baseY, heightPx, xBase: xAt(baseY), xTop: xAt(yTop), stickWidthPx },
  };
}
